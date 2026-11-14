'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from "@/hooks/use-toast";
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useFirestore } from '@/firebase';
import { Student, isMale, isFemale } from '@/lib/student-data';
import { getSubjects, Subject as SubjectType } from '@/lib/subjects';
import { getAllResults, ClassResult } from '@/lib/results-data';
import { processStudentResults, StudentProcessedResult } from '@/lib/results-calculation';
import { getExams, Exam } from '@/lib/exam-data';
import Image from 'next/image';
import { 
    BarChart3, Users, CheckCircle2, XCircle, Printer, Search, 
    TrendingUp, UserCheck, UserX, Award, BookOpen, Filter, ArrowUpDown, RefreshCw, Eye
} from 'lucide-react';

const classNamesMap: { [key: string]: string } = { '6': 'ষষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': 'দশম' };
const groupNamesMap: { [key: string]: string } = { 'science': 'বিজ্ঞান', 'arts': 'মানবিক', 'commerce': 'ব্যবসায় শিক্ষা', 'all': 'সকল শাখা' };
const groupMap: Record<string, string> = { 
    'science': 'science', 'বিজ্ঞান': 'science', 'Science': 'science',
    'arts': 'arts', 'মানবিক': 'arts', 'humanities': 'arts', 'humanity': 'arts', 'Arts': 'arts',
    'commerce': 'commerce', 'ব্যবসায় শিক্ষা': 'commerce', 'business': 'commerce', 'Commerce': 'commerce',
    'none': 'none', 'all': 'none', 'general': 'none'
};

const toBengaliNumber = (str: string | number | undefined | null) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

interface SubjectStat {
    name: string;
    englishName?: string;
    fullMarks: number;
    totalAppeared: number;
    presentCount: number;
    absentCount: number;
    passedTotal: number;
    passedBoys: number;
    passedGirls: number;
    passRate: number;
    failedTotal: number;
    failedBoys: number;
    failedGirls: number;
    failRate: number;
    highestMarks: number;
    averageMarks: number;
}

export const ResultStatisticsTab = ({ allStudents, onPrintRequested }: { allStudents: Student[], onPrintRequested?: (data: any) => void }) => {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const { schoolInfo } = useSchoolInfo();
    const db = useFirestore();

    const [exams, setExams] = useState<Exam[]>([]);
    const [examName, setExamName] = useState('');
    const [className, setClassName] = useState('10');
    const [groupFilter, setGroupFilter] = useState('all');
    const [isLoading, setIsLoading] = useState(false);
    const [processedResults, setProcessedResults] = useState<StudentProcessedResult[]>([]);
    const [subjectsList, setSubjectsList] = useState<SubjectType[]>([]);
    
    // View state
    const [activeView, setActiveView] = useState<'failed-list' | 'subject-breakdown' | 'all-list'>('failed-list');
    const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
    const [subjectStatusFilter, setSubjectStatusFilter] = useState<'all' | 'fail' | 'pass'>('fail');
    const [studentSearchQuery, setStudentSearchQuery] = useState('');
    const [isPrinting, setIsPrinting] = useState(false);

    useEffect(() => {
        if (!db) return;
        getExams(db, selectedYear).then(fetched => {
            setExams(fetched);
            if (fetched.length > 0 && !examName) {
                setExamName(fetched[0].name);
            }
        });
    }, [db, selectedYear]);

    const handleLoadData = async () => {
        if (!db || !examName || !className) return;
        setIsLoading(true);
        try {
            const targetStudents = allStudents.filter(s => {
                if (s.academicYear !== selectedYear) return false;
                if (String(s.className) !== String(className)) return false;
                if (parseInt(className) >= 9 && groupFilter !== 'all') {
                    const sGroupNorm = groupMap[(s.group || 'none').toLowerCase().trim()] || (s.group || 'none').toLowerCase().trim();
                    const filterGroupNorm = groupMap[groupFilter.toLowerCase().trim()] || groupFilter.toLowerCase().trim();
                    return sGroupNorm === filterGroupNorm;
                }
                return true;
            });

            if (targetStudents.length === 0) {
                setProcessedResults([]);
                setIsLoading(false);
                toast({ title: 'কোনো শিক্ষার্থী পাওয়া যায়নি' });
                return;
            }

            const allRes = await getAllResults(db, selectedYear, examName);
            const classRes = allRes.filter(r => String(r.className) === String(className));
            const subs = getSubjects(className, groupFilter === 'all' ? undefined : groupFilter).filter(s => s.isExamSubject !== false);
            
            setSubjectsList(subs);
            const results = processStudentResults(targetStudents, classRes, subs);
            setProcessedResults(results);
        } catch (e) {
            console.error('Error calculating statistics:', e);
            toast({ variant: 'destructive', title: 'তথ্য লোড করতে সমস্যা হয়েছে' });
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (examName && className) {
            handleLoadData();
        }
    }, [examName, className, groupFilter, selectedYear, allStudents]);

    // Overall Demographic & Result Statistics
    const stats = useMemo(() => {
        const total = processedResults.length;
        const totalBoys = processedResults.filter(r => isMale(r.student.gender)).length;
        const totalGirls = processedResults.filter(r => isFemale(r.student.gender)).length;
        
        const present = processedResults.filter(r => !r.isAbsent);
        const presentCount = present.length;
        const presentBoys = present.filter(r => isMale(r.student.gender)).length;
        const presentGirls = present.filter(r => isFemale(r.student.gender)).length;

        const absent = processedResults.filter(r => r.isAbsent);
        const absentCount = absent.length;
        const absentBoys = absent.filter(r => isMale(r.student.gender)).length;
        const absentGirls = absent.filter(r => isFemale(r.student.gender)).length;

        const passed = processedResults.filter(r => r.isPass && !r.isAbsent);
        const passedCount = passed.length;
        const passedBoys = passed.filter(r => isMale(r.student.gender)).length;
        const passedGirls = passed.filter(r => isFemale(r.student.gender)).length;
        const passRate = presentCount > 0 ? ((passedCount / presentCount) * 100).toFixed(1) : '0';
        const passRateBoys = presentBoys > 0 ? ((passedBoys / presentBoys) * 100).toFixed(1) : '0';
        const passRateGirls = presentGirls > 0 ? ((passedGirls / presentGirls) * 100).toFixed(1) : '0';

        const failed = processedResults.filter(r => !r.isPass && !r.isAbsent);
        const failedCount = failed.length;
        const failedBoys = failed.filter(r => isMale(r.student.gender)).length;
        const failedGirls = failed.filter(r => isFemale(r.student.gender)).length;
        const failRate = presentCount > 0 ? ((failedCount / presentCount) * 100).toFixed(1) : '0';

        const gpa5 = processedResults.filter(r => r.isPass && r.gpa >= 5.0);
        const gpa5Count = gpa5.length;
        const gpa5Boys = gpa5.filter(r => isMale(r.student.gender)).length;
        const gpa5Girls = gpa5.filter(r => isFemale(r.student.gender)).length;

        return {
            total, totalBoys, totalGirls,
            presentCount, presentBoys, presentGirls,
            absentCount, absentBoys, absentGirls,
            passedCount, passedBoys, passedGirls, passRate, passRateBoys, passRateGirls,
            failedCount, failedBoys, failedGirls, failRate,
            gpa5Count, gpa5Boys, gpa5Girls
        };
    }, [processedResults]);

    // Group-wise statistics (for class >= 9)
    const groupStats = useMemo(() => {
        if (parseInt(className) < 9) return [];
        const groups = ['science', 'arts', 'commerce'];
        
        return groups.map(grpKey => {
            const grpStudents = processedResults.filter(r => {
                const sGroupNorm = groupMap[(r.student.group || 'none').toLowerCase().trim()] || (r.student.group || 'none').toLowerCase().trim();
                return sGroupNorm === grpKey;
            });

            const total = grpStudents.length;
            const boys = grpStudents.filter(r => isMale(r.student.gender)).length;
            const girls = grpStudents.filter(r => isFemale(r.student.gender)).length;
            const present = grpStudents.filter(r => !r.isAbsent).length;
            const absent = grpStudents.filter(r => r.isAbsent).length;
            
            const passed = grpStudents.filter(r => r.isPass && !r.isAbsent);
            const passedCount = passed.length;
            const passedBoys = passed.filter(r => isMale(r.student.gender)).length;
            const passedGirls = passed.filter(r => isFemale(r.student.gender)).length;
            const passRate = present > 0 ? ((passedCount / present) * 100).toFixed(1) : '0';

            const failed = grpStudents.filter(r => !r.isPass && !r.isAbsent);
            const failedCount = failed.length;
            const failedBoys = failed.filter(r => isMale(r.student.gender)).length;
            const failedGirls = failed.filter(r => isFemale(r.student.gender)).length;

            const gpa5 = grpStudents.filter(r => r.isPass && r.gpa >= 5.0).length;

            return {
                groupKey: grpKey,
                name: groupNamesMap[grpKey] || grpKey,
                total, boys, girls,
                present, absent,
                passedCount, passedBoys, passedGirls, passRate,
                failedCount, failedBoys, failedGirls,
                gpa5
            };
        }).filter(g => g.total > 0);
    }, [processedResults, className]);

    // Subject-wise Pass-Fail Statistics
    const subjectStats = useMemo(() => {
        return subjectsList.map((sub): SubjectStat => {
            const studentsForThisSub = processedResults.filter(r => r.subjectResults.has(sub.name));
            const totalAppeared = studentsForThisSub.length;
            
            const presentStudents = studentsForThisSub.filter(r => !r.isAbsent);
            const presentCount = presentStudents.length;
            const absentCount = studentsForThisSub.filter(r => r.isAbsent).length;

            const passedStudents = presentStudents.filter(r => {
                const subRes = r.subjectResults.get(sub.name);
                return subRes && subRes.isPass;
            });
            const passedTotal = passedStudents.length;
            const passedBoys = passedStudents.filter(r => isMale(r.student.gender)).length;
            const passedGirls = passedStudents.filter(r => isFemale(r.student.gender)).length;
            const passRate = presentCount > 0 ? parseFloat(((passedTotal / presentCount) * 100).toFixed(1)) : 0;

            const failedStudents = presentStudents.filter(r => {
                const subRes = r.subjectResults.get(sub.name);
                return subRes && !subRes.isPass;
            });
            const failedTotal = failedStudents.length;
            const failedBoys = failedStudents.filter(r => isMale(r.student.gender)).length;
            const failedGirls = failedStudents.filter(r => isFemale(r.student.gender)).length;
            const failRate = presentCount > 0 ? parseFloat(((failedTotal / presentCount) * 100).toFixed(1)) : 0;

            let highestMarks = 0;
            let marksSum = 0;
            presentStudents.forEach(r => {
                const subRes = r.subjectResults.get(sub.name);
                if (subRes && subRes.marks !== undefined) {
                    if (subRes.marks > highestMarks) highestMarks = subRes.marks;
                    marksSum += subRes.marks;
                }
            });
            const averageMarks = presentCount > 0 ? parseFloat((marksSum / presentCount).toFixed(1)) : 0;

            return {
                name: sub.name,
                englishName: sub.englishName,
                fullMarks: sub.fullMarks,
                totalAppeared,
                presentCount,
                absentCount,
                passedTotal,
                passedBoys,
                passedGirls,
                passRate,
                failedTotal,
                failedBoys,
                failedGirls,
                failRate,
                highestMarks,
                averageMarks
            };
        });
    }, [subjectsList, processedResults]);

    // Failed students with explicit list of failed subjects
    const failedStudentsList = useMemo(() => {
        return processedResults
            .filter(r => !r.isPass && !r.isAbsent)
            .map(r => {
                const failedSubs: { name: string; marks?: number; grade?: string }[] = [];
                r.subjectResults.forEach((subRes, subName) => {
                    if (!subRes.isPass) {
                        failedSubs.push({
                            name: subName,
                            marks: subRes.marks,
                            grade: subRes.grade
                        });
                    }
                });

                return {
                    student: r.student,
                    totalMarks: r.totalMarks,
                    gpa: r.gpa,
                    finalGrade: r.finalGrade,
                    failedCount: r.failedSubjectsCount,
                    failedSubjects: failedSubs
                };
            })
            .sort((a, b) => {
                if (a.failedCount !== b.failedCount) return a.failedCount - b.failedCount;
                if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
                return (a.student.roll || 0) - (b.student.roll || 0);
            });
    }, [processedResults]);

    // Filtered students for Subject Details view
    const subjectDetailedStudents = useMemo(() => {
        if (!selectedSubjectFilter || selectedSubjectFilter === 'all') return [];

        return processedResults
            .filter(r => r.subjectResults.has(selectedSubjectFilter) && !r.isAbsent)
            .map(r => {
                const subRes = r.subjectResults.get(selectedSubjectFilter)!;
                return {
                    student: r.student,
                    written: subRes.written,
                    mcq: subRes.mcq,
                    practical: subRes.practical,
                    marks: subRes.marks,
                    grade: subRes.grade,
                    point: subRes.point,
                    isPass: subRes.isPass
                };
            })
            .filter(item => {
                if (subjectStatusFilter === 'fail') return !item.isPass;
                if (subjectStatusFilter === 'pass') return item.isPass;
                return true;
            })
            .sort((a, b) => (a.student.roll || 0) - (b.student.roll || 0));
    }, [processedResults, selectedSubjectFilter, subjectStatusFilter]);

    // All students list filtered by search query
    const filteredAllStudents = useMemo(() => {
        return processedResults.filter(r => {
            if (!studentSearchQuery) return true;
            const q = studentSearchQuery.toLowerCase().trim();
            const rollMatch = String(r.student.roll).includes(q);
            const nameMatch = (r.student.studentNameBn || '').toLowerCase().includes(q) || (r.student.studentNameEn || '').toLowerCase().includes(q);
            return rollMatch || nameMatch;
        });
    }, [processedResults, studentSearchQuery]);

    const handlePrint = () => {
        if (onPrintRequested) {
            onPrintRequested({
                examName,
                className,
                groupFilter,
                selectedYear,
                stats,
                groupStats,
                subjectStats,
                failedStudentsList
            });
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Control Bar */}
            <div className="p-4 border-2 rounded-2xl bg-white shadow-sm flex flex-col md:flex-row gap-4 items-end justify-between no-print">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto flex-1">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">পরীক্ষা</Label>
                        <Select value={examName} onValueChange={setExamName}>
                            <SelectTrigger className="bg-white font-bold h-10 border-2">
                                <SelectValue placeholder="পরীক্ষা নির্বাচন করুন" />
                            </SelectTrigger>
                            <SelectContent>
                                {exams.map((e, idx) => (
                                    <SelectItem key={e.id || idx} value={e.name} className="font-bold">
                                        {e.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">শ্রেণি</Label>
                        <Select value={className} onValueChange={c => { setClassName(c); setGroupFilter('all'); }}>
                            <SelectTrigger className="bg-white font-bold h-10 border-2">
                                <SelectValue placeholder="শ্রেণি নির্বাচন করুন" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="6" className="font-bold">৬ষ্ঠ শ্রেণি</SelectItem>
                                <SelectItem value="7" className="font-bold">৭ম শ্রেণি</SelectItem>
                                <SelectItem value="8" className="font-bold">৮ম শ্রেণি</SelectItem>
                                <SelectItem value="9" className="font-bold">৯ম শ্রেণি</SelectItem>
                                <SelectItem value="10" className="font-bold">১০ম শ্রেণি</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {parseInt(className) >= 9 && (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">শাখা / বিভাগ</Label>
                            <Select value={groupFilter} onValueChange={setGroupFilter}>
                                <SelectTrigger className="bg-white font-bold h-10 border-2">
                                    <SelectValue placeholder="সকল শাখা" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="font-bold">সকল শাখা</SelectItem>
                                    <SelectItem value="science" className="font-bold">বিজ্ঞান</SelectItem>
                                    <SelectItem value="arts" className="font-bold">মানবিক</SelectItem>
                                    <SelectItem value="commerce" className="font-bold">ব্যবসায় শিক্ষা</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <Button 
                        onClick={handleLoadData} 
                        disabled={isLoading || !examName} 
                        className="bg-primary hover:bg-primary/90 font-black h-10 px-5 shadow-sm"
                    >
                        {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-2" />}
                        পরিসংখ্যান লোড
                    </Button>
                    <Button 
                        onClick={handlePrint} 
                        disabled={processedResults.length === 0} 
                        variant="outline" 
                        className="border-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-black h-10 px-5 shadow-sm"
                    >
                        <Printer className="h-4 w-4 mr-2 text-emerald-600" />
                        রিপোর্ট প্রিন্ট
                    </Button>
                </div>
            </div>

            {/* Overall Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 no-print">
                {/* 1. Total Students */}
                <Card className="border-2 border-slate-200 shadow-sm bg-gradient-to-br from-slate-50 to-white">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs font-bold text-slate-500 flex items-center justify-between">
                            <span>মোট শিক্ষার্থী</span>
                            <Users className="h-4 w-4 text-slate-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-2xl font-black text-slate-900">{toBengaliNumber(stats.total)} জন</div>
                        <div className="text-[11px] font-bold text-slate-600 mt-1 flex justify-between">
                            <span>ছাত্র: {toBengaliNumber(stats.totalBoys)}</span>
                            <span>ছাত্রী: {toBengaliNumber(stats.totalGirls)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Present Students */}
                <Card className="border-2 border-blue-200 shadow-sm bg-gradient-to-br from-blue-50/50 to-white">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs font-bold text-blue-700 flex items-center justify-between">
                            <span>অংশগ্রহণকারী</span>
                            <UserCheck className="h-4 w-4 text-blue-600" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-2xl font-black text-blue-900">{toBengaliNumber(stats.presentCount)} জন</div>
                        <div className="text-[11px] font-bold text-blue-700 mt-1 flex justify-between">
                            <span>ছাত্র: {toBengaliNumber(stats.presentBoys)}</span>
                            <span>ছাত্রী: {toBengaliNumber(stats.presentGirls)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Absent Students */}
                <Card className="border-2 border-slate-200 shadow-sm bg-gradient-to-br from-slate-100/60 to-white">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs font-bold text-slate-600 flex items-center justify-between">
                            <span>অনুপস্থিত</span>
                            <UserX className="h-4 w-4 text-slate-500" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-2xl font-black text-slate-700">{toBengaliNumber(stats.absentCount)} জন</div>
                        <div className="text-[11px] font-bold text-slate-500 mt-1 flex justify-between">
                            <span>ছাত্র: {toBengaliNumber(stats.absentBoys)}</span>
                            <span>ছাত্রী: {toBengaliNumber(stats.absentGirls)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Passed Students */}
                <Card className="border-2 border-emerald-300 shadow-sm bg-gradient-to-br from-emerald-50/60 to-white">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs font-bold text-emerald-800 flex items-center justify-between">
                            <span>মোট কৃতকার্য</span>
                            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-2xl font-black text-emerald-800 flex items-baseline gap-1.5">
                            <span>{toBengaliNumber(stats.passedCount)} জন</span>
                            <span className="text-xs font-bold text-emerald-600">({toBengaliNumber(stats.passRate)}%)</span>
                        </div>
                        <div className="text-[11px] font-bold text-emerald-700 mt-1 flex justify-between">
                            <span>ছাত্র: {toBengaliNumber(stats.passedBoys)}</span>
                            <span>ছাত্রী: {toBengaliNumber(stats.passedGirls)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 5. Failed Students */}
                <Card className="border-2 border-rose-300 shadow-sm bg-gradient-to-br from-rose-50/60 to-white">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs font-bold text-rose-800 flex items-center justify-between">
                            <span>মোট অকৃতকার্য</span>
                            <XCircle className="h-4 w-4 text-rose-600" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-2xl font-black text-rose-800 flex items-baseline gap-1.5">
                            <span>{toBengaliNumber(stats.failedCount)} জন</span>
                            <span className="text-xs font-bold text-rose-600">({toBengaliNumber(stats.failRate)}%)</span>
                        </div>
                        <div className="text-[11px] font-bold text-rose-700 mt-1 flex justify-between">
                            <span>ছাত্র: {toBengaliNumber(stats.failedBoys)}</span>
                            <span>ছাত্রী: {toBengaliNumber(stats.failedGirls)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* 6. GPA 5.00 */}
                <Card className="border-2 border-amber-300 shadow-sm bg-gradient-to-br from-amber-50/60 to-white">
                    <CardHeader className="p-3 pb-1">
                        <CardTitle className="text-xs font-bold text-amber-900 flex items-center justify-between">
                            <span>GPA ৫.০০ (A+)</span>
                            <Award className="h-4 w-4 text-amber-600" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                        <div className="text-2xl font-black text-amber-900">{toBengaliNumber(stats.gpa5Count)} জন</div>
                        <div className="text-[11px] font-bold text-amber-700 mt-1 flex justify-between">
                            <span>ছাত্র: {toBengaliNumber(stats.gpa5Boys)}</span>
                            <span>ছাত্রী: {toBengaliNumber(stats.gpa5Girls)}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Group-wise Breakdown Table (for classes 9-10) */}
            {groupStats.length > 0 && (
                <Card className="border-2 border-slate-200 shadow-md overflow-hidden bg-white no-print">
                    <CardHeader className="bg-slate-50 p-4 border-b">
                        <CardTitle className="text-sm font-black text-slate-800 flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-primary" />
                            বিভাগ / শাখা ভিত্তিক ফলাফল বিবরণী (শ্রেণি: {classNamesMap[className]})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-100">
                                <TableRow className="h-9 border-b border-slate-300">
                                    <TableHead className="font-black text-black">শাখা/বিভাগ</TableHead>
                                    <TableHead className="text-center font-black text-black">মোট শিক্ষার্থী</TableHead>
                                    <TableHead className="text-center font-black text-black">উপস্থিত</TableHead>
                                    <TableHead className="text-center font-black text-black">অনুপস্থিত</TableHead>
                                    <TableHead className="text-center font-black text-emerald-900">মোট পাশ</TableHead>
                                    <TableHead className="text-center font-black text-emerald-800">ছাত্র পাশ</TableHead>
                                    <TableHead className="text-center font-black text-emerald-800">ছাত্রী পাশ</TableHead>
                                    <TableHead className="text-center font-black text-emerald-900">পাশের হার</TableHead>
                                    <TableHead className="text-center font-black text-rose-900">মোট ফেল</TableHead>
                                    <TableHead className="text-center font-black text-rose-800">ছাত্র ফেল</TableHead>
                                    <TableHead className="text-center font-black text-rose-800">ছাত্রী ফেল</TableHead>
                                    <TableHead className="text-center font-black text-amber-900">GPA ৫.০০</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupStats.map(g => (
                                    <TableRow key={g.groupKey} className="h-9 hover:bg-slate-50 border-b">
                                        <TableCell className="font-black text-primary">{g.name}</TableCell>
                                        <TableCell className="text-center font-bold">{toBengaliNumber(g.total)} (ছা: {toBengaliNumber(g.boys)} | ছা-ত্রী: {toBengaliNumber(g.girls)})</TableCell>
                                        <TableCell className="text-center font-bold text-blue-900">{toBengaliNumber(g.present)}</TableCell>
                                        <TableCell className="text-center font-bold text-slate-500">{toBengaliNumber(g.absent)}</TableCell>
                                        <TableCell className="text-center font-black text-emerald-800">{toBengaliNumber(g.passedCount)}</TableCell>
                                        <TableCell className="text-center font-bold text-emerald-700">{toBengaliNumber(g.passedBoys)}</TableCell>
                                        <TableCell className="text-center font-bold text-emerald-700">{toBengaliNumber(g.passedGirls)}</TableCell>
                                        <TableCell className="text-center font-black text-emerald-800">{toBengaliNumber(g.passRate)}%</TableCell>
                                        <TableCell className="text-center font-black text-rose-800">{toBengaliNumber(g.failedCount)}</TableCell>
                                        <TableCell className="text-center font-bold text-rose-700">{toBengaliNumber(g.failedBoys)}</TableCell>
                                        <TableCell className="text-center font-bold text-rose-700">{toBengaliNumber(g.failedGirls)}</TableCell>
                                        <TableCell className="text-center font-black text-amber-800">{toBengaliNumber(g.gpa5)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Subject-wise Pass-Fail Statistics Table */}
            <Card className="border-2 border-slate-200 shadow-md overflow-hidden bg-white no-print">
                <CardHeader className="bg-slate-50 p-4 border-b flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                            <BarChart3 className="h-5 w-5 text-indigo-600" />
                            বিষয়ভিত্তিক পাস ও ফেলের পূর্ণাঙ্গ পরিসংখ্যান
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-slate-600 mt-0.5">
                            প্রতিটি বিষয়ে কতজন পরীক্ষার্থী অংশ নিয়েছে, কতজন ছাত্র-ছাত্রী পাস করেছে এবং কতজন ফেল করেছে তার বিস্তারিত তালিকা
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-100">
                            <TableRow className="h-10 border-b border-slate-300">
                                <TableHead className="w-12 text-center font-black text-black">ক্রমিক</TableHead>
                                <TableHead className="font-black text-black min-w-[150px]">বিষয়ের নাম</TableHead>
                                <TableHead className="w-20 text-center font-black text-black">পূর্ণমান</TableHead>
                                <TableHead className="w-24 text-center font-black text-blue-900">অংশগ্রহণকারী</TableHead>
                                <TableHead className="w-24 text-center font-black text-emerald-900">মোট পাশ</TableHead>
                                <TableHead className="w-20 text-center font-black text-emerald-800">ছাত্র পাশ</TableHead>
                                <TableHead className="w-20 text-center font-black text-emerald-800">ছাত্রী পাশ</TableHead>
                                <TableHead className="w-20 text-center font-black text-emerald-900">পাশের হার</TableHead>
                                <TableHead className="w-24 text-center font-black text-rose-900">মোট ফেল</TableHead>
                                <TableHead className="w-20 text-center font-black text-rose-800">ছাত্র ফেল</TableHead>
                                <TableHead className="w-20 text-center font-black text-rose-800">ছাত্রী ফেল</TableHead>
                                <TableHead className="w-20 text-center font-black text-rose-900">ফেলের হার</TableHead>
                                <TableHead className="w-20 text-center font-black text-indigo-900">সর্বোচ্চ</TableHead>
                                <TableHead className="w-24 text-center font-black text-slate-700">অ্যাকশন</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {subjectStats.map((sub, idx) => (
                                <TableRow key={sub.name} className="h-10 hover:bg-slate-50 border-b border-slate-200">
                                    <TableCell className="text-center font-bold text-slate-600">{toBengaliNumber(idx + 1)}</TableCell>
                                    <TableCell className="font-black text-slate-900">{sub.name}</TableCell>
                                    <TableCell className="text-center font-bold text-slate-600">{toBengaliNumber(sub.fullMarks)}</TableCell>
                                    <TableCell className="text-center font-black text-blue-900">{toBengaliNumber(sub.presentCount)} জন</TableCell>
                                    <TableCell className="text-center font-black text-emerald-800">{toBengaliNumber(sub.passedTotal)}</TableCell>
                                    <TableCell className="text-center font-bold text-emerald-700">{toBengaliNumber(sub.passedBoys)}</TableCell>
                                    <TableCell className="text-center font-bold text-emerald-700">{toBengaliNumber(sub.passedGirls)}</TableCell>
                                    <TableCell className="text-center font-black text-emerald-800 bg-emerald-50/50">{toBengaliNumber(sub.passRate)}%</TableCell>
                                    <TableCell className="text-center font-black text-rose-800">{toBengaliNumber(sub.failedTotal)}</TableCell>
                                    <TableCell className="text-center font-bold text-rose-700">{toBengaliNumber(sub.failedBoys)}</TableCell>
                                    <TableCell className="text-center font-bold text-rose-700">{toBengaliNumber(sub.failedGirls)}</TableCell>
                                    <TableCell className="text-center font-black text-rose-800 bg-rose-50/50">{toBengaliNumber(sub.failRate)}%</TableCell>
                                    <TableCell className="text-center font-black text-indigo-900">{toBengaliNumber(sub.highestMarks)}</TableCell>
                                    <TableCell className="text-center">
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => {
                                                setSelectedSubjectFilter(sub.name);
                                                setActiveView('subject-breakdown');
                                                setSubjectStatusFilter('fail');
                                            }}
                                            className="h-7 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                                        >
                                            <Eye className="h-3.5 w-3.5 mr-1" />
                                            ফেল তালিকা
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Detailed Student-wise Pass-Fail Tabs */}
            <Card className="border-2 border-slate-200 shadow-md bg-white no-print">
                <CardHeader className="bg-slate-50 p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" />
                            কে কোন বিষয়ে ফেল বা পাশ করেছে তার পূর্ণাঙ্গ তথ্য
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-slate-600 mt-0.5">
                            প্রত্যেক শিক্ষার্থীর বিষয়ভিত্তিক বিস্তারিত অবস্থান দেখুন
                        </CardDescription>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <Button 
                            variant={activeView === 'failed-list' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveView('failed-list')}
                            className="font-bold text-xs h-8"
                        >
                            <XCircle className="h-3.5 w-3.5 mr-1 text-rose-400" />
                            ফেল করা শিক্ষার্থী ({toBengaliNumber(failedStudentsList.length)})
                        </Button>
                        <Button 
                            variant={activeView === 'subject-breakdown' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveView('subject-breakdown')}
                            className="font-bold text-xs h-8"
                        >
                            <Filter className="h-3.5 w-3.5 mr-1 text-indigo-400" />
                            বিষয় অনুযায়ী তালিকা
                        </Button>
                        <Button 
                            variant={activeView === 'all-list' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setActiveView('all-list')}
                            className="font-bold text-xs h-8"
                        >
                            <Users className="h-3.5 w-3.5 mr-1 text-blue-400" />
                            সকল শিক্ষার্থী ({toBengaliNumber(processedResults.length)})
                        </Button>
                    </div>
                </CardHeader>

                <CardContent className="p-4">
                    {/* View 1: Failed Students List with Detailed Failed Subjects */}
                    {activeView === 'failed-list' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center bg-rose-50 border border-rose-200 p-3 rounded-xl">
                                <span className="font-black text-rose-950 text-sm">
                                    মোট অকৃতকার্য শিক্ষার্থী: {toBengaliNumber(failedStudentsList.length)} জন (কম বিষয়ে ফেল থেকে ক্রমানুসারে সাজানো)
                                </span>
                            </div>

                            {failedStudentsList.length > 0 ? (
                                <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-slate-100">
                                            <TableRow className="h-10">
                                                <TableHead className="w-12 text-center font-black text-black">ক্রমিক</TableHead>
                                                <TableHead className="w-16 text-center font-black text-black">রোল</TableHead>
                                                <TableHead className="font-black text-black min-w-[150px]">শিক্ষার্থীর নাম</TableHead>
                                                <TableHead className="w-20 text-center font-black text-black">লিঙ্গ</TableHead>
                                                <TableHead className="w-24 text-center font-black text-black">শাখা/বিভাগ</TableHead>
                                                <TableHead className="w-24 text-center font-black text-rose-900">ফেল বিষয় সংখ্যা</TableHead>
                                                <TableHead className="font-black text-rose-900 min-w-[250px]">যেসব বিষয়ে ফেল করেছে</TableHead>
                                                <TableHead className="w-20 text-center font-black text-primary">মোট নম্বর</TableHead>
                                                <TableHead className="w-16 text-center font-black text-rose-700">গ্রেড</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {failedStudentsList.map((item, idx) => (
                                                <TableRow key={item.student.id} className="h-10 hover:bg-slate-50 border-b">
                                                    <TableCell className="text-center font-bold text-slate-600">{toBengaliNumber(idx + 1)}</TableCell>
                                                    <TableCell className="text-center font-black text-slate-900">{toBengaliNumber(item.student.roll)}</TableCell>
                                                    <TableCell className="font-bold text-slate-800">{item.student.studentNameBn}</TableCell>
                                                    <TableCell className="text-center font-bold text-xs text-slate-600">
                                                        {isFemale(item.student.gender) ? 'ছাত্রী' : 'ছাত্র'}
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold text-xs text-slate-600">
                                                        {groupNamesMap[item.student.group || ''] || item.student.group || 'সাধারণ'}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className="border-rose-300 text-rose-700 bg-rose-50 font-black px-2 py-0.5">
                                                            {toBengaliNumber(item.failedCount)} টি
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-wrap gap-1.5 py-1">
                                                            {item.failedSubjects.map((sub, sIdx) => (
                                                                <span 
                                                                    key={sIdx} 
                                                                    className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md border border-rose-200"
                                                                >
                                                                    <span>{sub.name}</span>
                                                                    {sub.marks !== undefined && (
                                                                        <span className="text-[10px] text-rose-900 font-black">({toBengaliNumber(sub.marks)})</span>
                                                                    )}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center font-black text-primary">{toBengaliNumber(item.totalMarks)}</TableCell>
                                                    <TableCell className="text-center font-black text-rose-700">{item.finalGrade}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-sm font-bold text-muted-foreground border-2 border-dashed rounded-xl">
                                    কোনো অকৃতকার্য শিক্ষার্থী নেই। সবাই পাশ করেছে!
                                </div>
                            )}
                        </div>
                    )}

                    {/* View 2: Subject-wise Detailed Breakdown */}
                    {activeView === 'subject-breakdown' && (
                        <div className="space-y-4">
                            <div className="p-4 border rounded-xl bg-slate-50 flex flex-col sm:flex-row gap-3 items-center justify-between">
                                <div className="flex items-center gap-3 w-full sm:w-auto">
                                    <Label className="font-bold text-xs shrink-0">বিষয় নির্বাচন:</Label>
                                    <Select value={selectedSubjectFilter} onValueChange={setSelectedSubjectFilter}>
                                        <SelectTrigger className="bg-white font-bold h-9 w-[200px]">
                                            <SelectValue placeholder="বিষয় সিলেক্ট করুন" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {subjectsList.map(s => (
                                                <SelectItem key={s.name} value={s.name} className="font-bold">
                                                    {s.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <Button 
                                        variant={subjectStatusFilter === 'fail' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setSubjectStatusFilter('fail')}
                                        className="font-bold text-xs h-8"
                                    >
                                        শুধুমাত্র ফেল
                                    </Button>
                                    <Button 
                                        variant={subjectStatusFilter === 'pass' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setSubjectStatusFilter('pass')}
                                        className="font-bold text-xs h-8"
                                    >
                                        শুধুমাত্র পাশ
                                    </Button>
                                    <Button 
                                        variant={subjectStatusFilter === 'all' ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setSubjectStatusFilter('all')}
                                        className="font-bold text-xs h-8"
                                    >
                                        সকল শিক্ষার্থী
                                    </Button>
                                </div>
                            </div>

                            {selectedSubjectFilter && selectedSubjectFilter !== 'all' ? (
                                <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                                    <div className="bg-slate-100 p-2.5 px-4 font-black text-sm text-slate-800 border-b flex justify-between">
                                        <span>বিষয়: {selectedSubjectFilter}</span>
                                        <span>মোট প্রদর্শিত: {toBengaliNumber(subjectDetailedStudents.length)} জন</span>
                                    </div>
                                    <Table>
                                        <TableHeader className="bg-slate-50">
                                            <TableRow className="h-9">
                                                <TableHead className="w-12 text-center font-black text-black">ক্রমিক</TableHead>
                                                <TableHead className="w-16 text-center font-black text-black">রোল</TableHead>
                                                <TableHead className="font-black text-black min-w-[150px]">শিক্ষার্থীর নাম</TableHead>
                                                <TableHead className="w-20 text-center font-black text-black">লিঙ্গ</TableHead>
                                                <TableHead className="w-24 text-center font-black text-black">শাখা/বিভাগ</TableHead>
                                                <TableHead className="w-16 text-center font-black text-black">লিখিত</TableHead>
                                                <TableHead className="w-16 text-center font-black text-black">MCQ</TableHead>
                                                <TableHead className="w-16 text-center font-black text-black">ব্যবহারিক</TableHead>
                                                <TableHead className="w-20 text-center font-black text-primary">প্রাপ্ত নম্বর</TableHead>
                                                <TableHead className="w-16 text-center font-black text-black">গ্রেড</TableHead>
                                                <TableHead className="w-20 text-center font-black text-black">ফলাফল</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {subjectDetailedStudents.map((item, idx) => (
                                                <TableRow key={item.student.id} className="h-9 hover:bg-slate-50 border-b">
                                                    <TableCell className="text-center font-bold text-slate-600">{toBengaliNumber(idx + 1)}</TableCell>
                                                    <TableCell className="text-center font-black text-slate-900">{toBengaliNumber(item.student.roll)}</TableCell>
                                                    <TableCell className="font-bold text-slate-800">{item.student.studentNameBn}</TableCell>
                                                    <TableCell className="text-center font-bold text-xs text-slate-600">
                                                        {isFemale(item.student.gender) ? 'ছাত্রী' : 'ছাত্র'}
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold text-xs text-slate-600">
                                                        {groupNamesMap[item.student.group || ''] || item.student.group || 'সাধারণ'}
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold text-slate-700">{item.written !== undefined ? toBengaliNumber(item.written) : '-'}</TableCell>
                                                    <TableCell className="text-center font-bold text-slate-700">{item.mcq !== undefined ? toBengaliNumber(item.mcq) : '-'}</TableCell>
                                                    <TableCell className="text-center font-bold text-slate-700">{item.practical !== undefined ? toBengaliNumber(item.practical) : '-'}</TableCell>
                                                    <TableCell className="text-center font-black text-primary">{toBengaliNumber(item.marks)}</TableCell>
                                                    <TableCell className={cn("text-center font-black", !item.isPass ? "text-rose-600" : "text-slate-800")}>{item.grade}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge className={cn("font-black text-[10px] px-2", item.isPass ? "bg-emerald-600" : "bg-rose-600")}>
                                                            {item.isPass ? 'কৃতকার্য' : 'অকৃতকার্য'}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {subjectDetailedStudents.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={11} className="h-24 text-center font-bold text-muted-foreground">
                                                        এই বিষয়ে কোনো শিক্ষার্থী পাওয়া যায়নি।
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-sm font-bold text-muted-foreground border-2 border-dashed rounded-xl">
                                    উপরে একটি বিষয় সিলেক্ট করুন।
                                </div>
                            )}
                        </div>
                    )}

                    {/* View 3: All Students List */}
                    {activeView === 'all-list' && (
                        <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                                <div className="relative w-full sm:w-72">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input 
                                        placeholder="নাম বা রোল দিয়ে খুঁজুন..." 
                                        value={studentSearchQuery} 
                                        onChange={e => setStudentSearchQuery(e.target.value)}
                                        className="pl-9 h-9 font-bold bg-white"
                                    />
                                </div>
                                <span className="font-bold text-xs text-slate-500">
                                    মোট: {toBengaliNumber(filteredAllStudents.length)} জন
                                </span>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-100">
                                        <TableRow className="h-10">
                                            <TableHead className="w-12 text-center font-black text-black">রোল</TableHead>
                                            <TableHead className="font-black text-black min-w-[150px]">শিক্ষার্থীর নাম</TableHead>
                                            <TableHead className="w-20 text-center font-black text-black">লিঙ্গ</TableHead>
                                            <TableHead className="w-24 text-center font-black text-black">শাখা/বিভাগ</TableHead>
                                            <TableHead className="w-20 text-center font-black text-primary">মোট নম্বর</TableHead>
                                            <TableHead className="w-16 text-center font-black text-black">GPA</TableHead>
                                            <TableHead className="w-16 text-center font-black text-black">গ্রেড</TableHead>
                                            <TableHead className="w-24 text-center font-black text-black">ফলাফল</TableHead>
                                            <TableHead className="font-black text-slate-800 min-w-[200px]">ফেল বিষয়সমূহ</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredAllStudents.map(res => {
                                            const failedSubs: string[] = [];
                                            res.subjectResults.forEach((sr, name) => {
                                                if (!sr.isPass) failedSubs.push(name);
                                            });

                                            return (
                                                <TableRow key={res.student.id} className="h-10 hover:bg-slate-50 border-b">
                                                    <TableCell className="text-center font-black text-slate-900">{toBengaliNumber(res.student.roll)}</TableCell>
                                                    <TableCell className="font-bold text-slate-800">{res.student.studentNameBn}</TableCell>
                                                    <TableCell className="text-center font-bold text-xs text-slate-600">
                                                        {isFemale(res.student.gender) ? 'ছাত্রী' : 'ছাত্র'}
                                                    </TableCell>
                                                    <TableCell className="text-center font-bold text-xs text-slate-600">
                                                        {groupNamesMap[res.student.group || ''] || res.student.group || 'সাধারণ'}
                                                    </TableCell>
                                                    <TableCell className="text-center font-black text-primary">{toBengaliNumber(res.totalMarks)}</TableCell>
                                                    <TableCell className="text-center font-black text-slate-800">{toBengaliNumber(res.gpa.toFixed(2))}</TableCell>
                                                    <TableCell className="text-center font-black text-slate-800">{res.finalGrade}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge className={cn("font-black text-[10px] px-2", res.isPass ? "bg-emerald-600" : (res.isAbsent ? "bg-slate-500" : "bg-rose-600"))}>
                                                            {res.isPass ? 'কৃতকার্য' : (res.isAbsent ? 'অনুপস্থিত' : 'অকৃতকার্য')}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {failedSubs.length > 0 ? (
                                                            <div className="flex flex-wrap gap-1">
                                                                {failedSubs.map((s, i) => (
                                                                    <span key={i} className="text-[10px] font-bold px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded">
                                                                        {s}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] font-bold text-emerald-700">-</span>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};
