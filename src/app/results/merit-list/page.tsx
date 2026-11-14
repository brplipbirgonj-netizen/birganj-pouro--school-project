
'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { getAllResults, ClassResult } from '@/lib/results-data';
import { getSubjects } from '@/lib/subjects';
import { processStudentResults, StudentProcessedResult } from '@/lib/results-calculation';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Printer, Loader2, ArrowLeft, AlertCircle, Sparkles, Trophy, UserCheck } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const classNamesMap: { [key: string]: string } = {
  '6': 'ষষ্ঠ', '7': 'সপ্তম', '8': 'অষ্টম', '9': 'নবম', '10': 'দশম',
};

const toBengaliNumber = (str: string | number | undefined | null) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

const STUDENTS_PER_PAGE = 30; // Adjusted for increased row height

function MeritListPrintContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const db = useFirestore();
    const { schoolInfo, isLoading: isSchoolLoading } = useSchoolInfo();
    const { user, hasPermission, loading: authLoading } = useAuth();

    const academicYear = searchParams.get('academicYear') || '';
    const examName = searchParams.get('examName') || '';
    const className = searchParams.get('className') || '';
    const groupFilter = searchParams.get('group') || 'all';
    const consideredFailsParam = searchParams.get('consideredFails') || '';

    const [consideredFails, setConsideredFails] = useState<number[]>(() => {
        return consideredFailsParam ? consideredFailsParam.split(',').map(Number).filter(Boolean) : [];
    });

    useEffect(() => {
        if (consideredFailsParam) {
            setConsideredFails(consideredFailsParam.split(',').map(Number).filter(Boolean));
        }
    }, [consideredFailsParam]);

    const [results, setResults] = useState<StudentProcessedResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const canViewMeritList = hasPermission('view:merit-list');

    useEffect(() => {
        if (authLoading) return;
        if (!user || !canViewMeritList) {
            return;
        }

        if (!db || !academicYear || !examName || !className) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch all students for the class
                const studentQuery = query(
                    collection(db, 'students'),
                    where('academicYear', '==', academicYear),
                    where('className', '==', className)
                );
                const studentSnap = await getDocs(studentQuery);
                
                const groupComparisonMap: Record<string, string> = { 'science': 'science', 'বিজ্ঞান': 'science', 'arts': 'arts', 'মানবিক': 'arts', 'humanities': 'arts', 'commerce': 'commerce', 'ব্যবসায় শিক্ষা': 'commerce', 'business': 'commerce' };
                
                const students = studentSnap.docs.map(studentFromDoc).filter(s => {
                    const classNum = parseInt(className);
                    if (classNum < 9 || groupFilter === 'all') return true;
                    
                    const sGroup = groupComparisonMap[(s.group || '').toLowerCase().trim()] || (s.group || '').toLowerCase().trim();
                    const fGroup = groupComparisonMap[groupFilter.toLowerCase().trim()] || groupFilter.toLowerCase().trim();
                    return sGroup === fGroup;
                });

                if (students.length === 0) {
                    setIsLoading(false);
                    return;
                }

                const allResults = await getAllResults(db, academicYear, examName);
                const resultsBySubject = allResults.filter(r => r.className === className);
                const subjects = getSubjects(className, groupFilter === 'all' ? undefined : groupFilter).filter(s => s.isExamSubject !== false);
                
                const finalResults = processStudentResults(students, resultsBySubject, subjects);
                
                const sortedResults = finalResults.sort((a, b) => {
                    if (a.isPass !== b.isPass) return a.isPass ? -1 : 1;
                    if (a.isAbsent !== b.isAbsent) return a.isAbsent ? 1 : -1;
                    if (a.isPass) {
                        if (Math.abs(b.gpa - a.gpa) > 0.001) return b.gpa - a.gpa;
                        if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
                        return a.student.roll - b.student.roll;
                    }
                    // Priority logic for failed students: fewer failed subjects come first
                    if (a.failedSubjectsCount !== b.failedSubjectsCount) return a.failedSubjectsCount - b.failedSubjectsCount;
                    if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
                    return a.student.roll - b.student.roll;
                });

                setResults(sortedResults);
            } catch (e) {
                console.error(e);
            }
            setIsLoading(false);
        };

        fetchData();
    }, [db, academicYear, examName, className, groupFilter, user, canViewMeritList, authLoading]);

    const regularPassedStudents = useMemo(() => {
        return results
            .filter(r => r.isPass && !r.isAbsent)
            .sort((a, b) => {
                if (Math.abs(b.gpa - a.gpa) > 0.001) return b.gpa - a.gpa;
                if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
                return a.student.roll - b.student.roll;
            });
    }, [results]);

    const specialPassedStudents = useMemo(() => {
        if (consideredFails.length === 0) return [];
        return results
            .filter(r => !r.isPass && !r.isAbsent && consideredFails.includes(r.failedSubjectsCount))
            .sort((a, b) => {
                if (a.failedSubjectsCount !== b.failedSubjectsCount) return a.failedSubjectsCount - b.failedSubjectsCount;
                if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
                return a.student.roll - b.student.roll;
            });
    }, [results, consideredFails]);

    const failedStudents = useMemo(() => {
        return results
            .filter(r => !r.isPass && !r.isAbsent && !consideredFails.includes(r.failedSubjectsCount))
            .sort((a, b) => {
                if (a.failedSubjectsCount !== b.failedSubjectsCount) return a.failedSubjectsCount - b.failedSubjectsCount;
                if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
                return a.student.roll - b.student.roll;
            });
    }, [results, consideredFails]);

    const absentStudents = useMemo(() => {
        return results
            .filter(r => r.isAbsent)
            .sort((a, b) => a.student.roll - b.student.roll);
    }, [results]);

    const getSpecialPassTitle = (fails: number[]) => {
        const sorted = [...fails].sort((a, b) => a - b);
        if (sorted.length === 0) return '';
        const bengaliNums = sorted.map(n => toBengaliNumber(n));
        let numStr = '';
        if (bengaliNums.length === 1) {
            numStr = `${bengaliNums[0]} বিষয়ে`;
        } else if (bengaliNums.length === 2) {
            numStr = `${bengaliNums[0]} ও ${bengaliNums[1]} বিষয়ে`;
        } else {
            numStr = `${bengaliNums.slice(0, -1).join(', ')} ও ${bengaliNums[bengaliNums.length - 1]} বিষয়ে`;
        }
        return `${numStr} ফেল করে বিশেষ বিবেচনায় পাশ করা শিক্ষার্থীর তালিকা`;
    };

    if (authLoading || isSchoolLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4 font-kalpurush">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium">লোড হচ্ছে...</p>
            </div>
        );
    }

    if (!user || !canViewMeritList) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4 text-center font-kalpurush">
                <AlertCircle className="h-16 w-16 text-destructive mb-4" />
                <h1 className="text-2xl font-bold mb-2">প্রবেশাধিকার সংরক্ষিত</h1>
                <p className="text-muted-foreground mb-6">আপনার এই পৃষ্ঠাটি দেখার অনুমতি নেই।</p>
                <Button onClick={() => router.push('/')}>হোম পেজে ফিরে যান</Button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4 font-kalpurush">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium">মেধা তালিকা তৈরি হচ্ছে...</p>
            </div>
        );
    }

    const groupNamesMap: { [key: string]: string } = { 'science': 'বিজ্ঞান', 'arts': 'মানবিক', 'commerce': 'ব্যবসায় শিক্ষা', 'all': 'সকল শাখা' };

    return (
        <div className="bg-slate-200 min-h-screen p-4 sm:p-8 font-kalpurush print:p-0 print:bg-white flex flex-col items-center">
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0.4in !important;
                    }
                    html, body {
                        background: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                    }
                    .merit-print-page {
                        padding: 0 !important;
                        margin: 0 !important;
                        box-sizing: border-box !important;
                        display: block !important;
                        width: 100% !important;
                        position: relative !important;
                        border: none !important;
                    }
                    .merit-main-content {
                        display: block !important;
                        padding: 0 !important;
                        width: 100% !important;
                    }
                    .printable-header {
                        padding: 0 0 3mm 0 !important;
                        width: 100% !important;
                    }
                    .print-footer {
                        padding: 6mm 0 2mm 0 !important;
                        width: 100% !important;
                        page-break-inside: avoid !important;
                    }
                    .merit-section-block {
                        page-break-inside: auto !important;
                        margin-bottom: 5mm !important;
                    }
                    .merit-section-block table {
                        page-break-inside: auto !important;
                    }
                    .merit-section-block tr {
                        page-break-inside: avoid !important;
                        height: 22px !important;
                    }
                    .merit-section-block table td, 
                    .merit-section-block table th {
                        padding: 2.5px 5px !important;
                        font-size: 11px !important;
                        line-height: 1.2 !important;
                        border: 1px solid black !important;
                    }
                    .merit-section-block table th {
                        font-weight: 900 !important;
                        background-color: #f8fafc !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>

            <div className="w-full max-w-[210mm] flex flex-wrap justify-between items-center gap-4 mb-6 no-print bg-white p-4 rounded-xl shadow-md border">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4" /></Button>
                    <div>
                        <h1 className="text-xl font-bold text-primary">মেধা তালিকা প্রিন্ট প্রিভিউ</h1>
                        <p className="text-xs text-muted-foreground">{classNamesMap[className]} শ্রেণি | {examName} | মোট {toBengaliNumber(results.length)} জন</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
                    <span className="text-xs font-black text-amber-900 flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                        বিশেষ বিবেচনা:
                    </span>
                    {[1, 2, 3, 4, 5, 6].map(failCount => (
                        <label key={failCount} className="flex items-center gap-1.5 cursor-pointer text-xs font-black text-slate-700">
                            <Checkbox 
                                checked={consideredFails.includes(failCount)}
                                onCheckedChange={(checked) => {
                                    if (checked) {
                                        setConsideredFails(prev => [...prev, failCount].sort());
                                    } else {
                                        setConsideredFails(prev => prev.filter(c => c !== failCount));
                                    }
                                }}
                                className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
                            />
                            <span>{toBengaliNumber(failCount)} বিষয়</span>
                        </label>
                    ))}
                </div>

                <Button onClick={() => window.print()} size="lg" className="shadow-lg bg-emerald-600 hover:bg-emerald-700">
                    <Printer className="mr-2 h-5 w-5" />
                    প্রিন্ট করুন
                </Button>
            </div>

            <div className="w-full max-w-[210mm] print:max-w-none">
                {results.length === 0 ? (
                    <div className="bg-white p-10 border-2 rounded-xl text-center">
                        কোনো ফলাফল পাওয়া যায়নি।
                    </div>
                ) : (
                    <div className="printable-area merit-print-page w-full bg-white mx-auto shadow-2xl relative text-black flex flex-col print:shadow-none print:m-0 p-8 sm:p-10 print:p-0">
                        {schoolInfo.logoUrl && (
                            <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none opacity-5">
                                <Image src={schoolInfo.logoUrl} alt="Watermark" width={400} height={400} />
                            </div>
                        )}

                        <header className="relative z-10 border-b-2 border-primary/30 pb-3 mb-4 printable-header">
                            <div className="flex items-center justify-center gap-3.5 mx-auto">
                                {schoolInfo.logoUrl && (
                                    <div className="relative w-14 h-14 shrink-0">
                                        <Image src={schoolInfo.logoUrl} alt="Logo" fill className="object-contain" />
                                    </div>
                                )}
                                <div className="text-center">
                                    <h1 className="text-2xl font-black text-primary leading-tight uppercase tracking-tight">{schoolInfo.name}</h1>
                                    <p className="text-[12px] font-bold text-slate-700">{schoolInfo.address}</p>
                                    <p className="text-[10px] font-bold text-slate-600 mt-0.5">
                                        EIIN: {toBengaliNumber(schoolInfo.eiin)} | কোড: {toBengaliNumber(schoolInfo.code)} | শিক্ষাবর্ষ: {toBengaliNumber(academicYear)}
                                    </p>
                                </div>
                                {schoolInfo.logoUrl && (
                                    <div className="w-14 h-14 shrink-0 invisible" aria-hidden="true" />
                                )}
                            </div>
                        </header>

                        <div className="relative z-10 text-center mb-6">
                            <div className="inline-block bg-primary/5 border-2 border-primary/20 px-10 py-1 rounded-full shadow-sm">
                                <h2 className="text-lg font-black text-primary uppercase tracking-wider">
                                    {examName} - মেধা ও ফলাফল তালিকা
                                </h2>
                            </div>
                            <p className="mt-2 font-black text-slate-800 text-sm">
                                শ্রেণি: {classNamesMap[className]} {groupFilter !== 'all' && `(${groupNamesMap[groupFilter] || groupFilter})`}
                            </p>
                        </div>

                        <main className="relative z-10 merit-main-content space-y-6">
                            {/* ১. নিয়মিত কৃতকার্য শিক্ষার্থী */}
                            {regularPassedStudents.length > 0 && (
                                <div className="merit-section-block border-[1.5px] border-black overflow-hidden rounded-sm">
                                    <div className="bg-slate-100 font-black text-center py-1.5 text-xs border-b border-black text-slate-900 uppercase">
                                        মেধা তালিকা (কৃতকার্য শিক্ষার্থী) - মোট {toBengaliNumber(regularPassedStudents.length)} জন
                                    </div>
                                    <table className="border-collapse w-full">
                                        <thead className="bg-slate-50">
                                            <tr className="h-8 border-b border-black">
                                                <th className="text-center font-black text-slate-900 border-r border-black w-14">মেধা</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-14">রোল</th>
                                                <th className="font-black text-slate-900 border-r border-black text-left pl-3">শিক্ষার্থীর নাম</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-20">শাখা/বিভাগ</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-20">মোট নম্বর</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-20">জি.পি.এ</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-16">গ্রেড</th>
                                                <th className="text-center font-black text-slate-900 w-20">ফলাফল</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {regularPassedStudents.map((res, idx) => (
                                                <tr key={res.student.id} className="h-7 border-b border-black last:border-0 hover:bg-slate-50">
                                                    <td className="text-center font-black border-r border-black">{toBengaliNumber(idx + 1)}</td>
                                                    <td className="text-center font-bold border-r border-black">{toBengaliNumber(res.student.roll)}</td>
                                                    <td className="font-bold border-r border-black pl-3">{res.student.studentNameBn}</td>
                                                    <td className="text-center font-bold border-r border-black text-slate-700 text-[11px]">{groupNamesMap[res.student.group || ''] || res.student.group || 'সাধারণ'}</td>
                                                    <td className="text-center font-black border-r border-black text-primary">{toBengaliNumber(res.totalMarks)}</td>
                                                    <td className="text-center font-black border-r border-black">{toBengaliNumber(res.gpa.toFixed(2))}</td>
                                                    <td className="text-center font-black border-r border-black">{res.finalGrade}</td>
                                                    <td className="text-center font-black text-emerald-800 text-[11px]">কৃতকার্য</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* ২. বিশেষ বিবেচনায় পাশ করা শিক্ষার্থী */}
                            {specialPassedStudents.length > 0 && (
                                <div className="merit-section-block border-[1.5px] border-black overflow-hidden rounded-sm">
                                    <div className="bg-amber-100/70 font-black text-center py-1.5 text-xs border-b border-black text-amber-950">
                                        {getSpecialPassTitle(consideredFails)} - মোট {toBengaliNumber(specialPassedStudents.length)} জন
                                    </div>
                                    <table className="border-collapse w-full">
                                        <thead className="bg-amber-50">
                                            <tr className="h-8 border-b border-black">
                                                <th className="text-center font-black text-slate-900 border-r border-black w-14">মেধাক্রম</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-14">রোল</th>
                                                <th className="font-black text-slate-900 border-r border-black text-left pl-3">শিক্ষার্থীর নাম</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-20">শাখা/বিভাগ</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-20">ফেল বিষয়</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-20">মোট নম্বর</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-20">জি.পি.এ</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-16">গ্রেড</th>
                                                <th className="text-center font-black text-slate-900 w-20">ফলাফল</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {specialPassedStudents.map((res, idx) => (
                                                <tr key={res.student.id} className="h-7 border-b border-black last:border-0 bg-amber-50/20">
                                                    <td className="text-center font-black border-r border-black text-amber-900">{toBengaliNumber(idx + 1)}</td>
                                                    <td className="text-center font-bold border-r border-black">{toBengaliNumber(res.student.roll)}</td>
                                                    <td className="font-bold border-r border-black pl-3">{res.student.studentNameBn}</td>
                                                    <td className="text-center font-bold border-r border-black text-slate-700 text-[11px]">{groupNamesMap[res.student.group || ''] || res.student.group || 'সাধারণ'}</td>
                                                    <td className="text-center font-bold border-r border-black text-amber-900">{toBengaliNumber(res.failedSubjectsCount)}টি</td>
                                                    <td className="text-center font-black border-r border-black text-primary">{toBengaliNumber(res.totalMarks)}</td>
                                                    <td className="text-center font-black border-r border-black">{toBengaliNumber(res.gpa.toFixed(2))}</td>
                                                    <td className="text-center font-black border-r border-black text-amber-800">{res.finalGrade}</td>
                                                    <td className="text-center font-black text-emerald-800 text-[11px]">পাশ</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* ৩. অকৃতকার্য শিক্ষার্থী */}
                            {failedStudents.length > 0 && (
                                <div className="merit-section-block border-[1.5px] border-black overflow-hidden rounded-sm">
                                    <div className="bg-rose-100/60 font-black text-center py-1.5 text-xs border-b border-black text-rose-950">
                                        অকৃতকার্য শিক্ষার্থীর তালিকা - মোট {toBengaliNumber(failedStudents.length)} জন
                                    </div>
                                    <table className="border-collapse w-full">
                                        <thead className="bg-rose-50/40">
                                            <tr className="h-8 border-b border-black">
                                                <th className="text-center font-black text-slate-900 border-r border-black w-14">ক্রমিক</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-14">রোল</th>
                                                <th className="font-black text-slate-900 border-r border-black text-left pl-3">শিক্ষার্থীর নাম</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-20">শাখা/বিভাগ</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-20">ফেল বিষয়</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-20">মোট নম্বর</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-20">জি.পি.এ</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-16">গ্রেড</th>
                                                <th className="text-center font-black text-slate-900 w-20">ফলাফল</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {failedStudents.map((res, idx) => (
                                                <tr key={res.student.id} className="h-7 border-b border-black last:border-0 bg-rose-50/20">
                                                    <td className="text-center font-black border-r border-black text-rose-800">{toBengaliNumber(idx + 1)}</td>
                                                    <td className="text-center font-bold border-r border-black">{toBengaliNumber(res.student.roll)}</td>
                                                    <td className="font-bold border-r border-black pl-3">{res.student.studentNameBn}</td>
                                                    <td className="text-center font-bold border-r border-black text-slate-700 text-[11px]">{groupNamesMap[res.student.group || ''] || res.student.group || 'সাধারণ'}</td>
                                                    <td className="text-center font-bold border-r border-black text-rose-700">{toBengaliNumber(res.failedSubjectsCount)}টি</td>
                                                    <td className="text-center font-black border-r border-black text-primary">{toBengaliNumber(res.totalMarks)}</td>
                                                    <td className="text-center font-black border-r border-black">{toBengaliNumber(res.gpa.toFixed(2))}</td>
                                                    <td className="text-center font-black border-r border-black text-rose-600">F{toBengaliNumber(res.failedSubjectsCount)}</td>
                                                    <td className="text-center font-black text-rose-700 text-[11px]">অকৃতকার্য</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* ৪. অনুপস্থিত শিক্ষার্থী */}
                            {absentStudents.length > 0 && (
                                <div className="merit-section-block border-[1.5px] border-black overflow-hidden rounded-sm">
                                    <div className="bg-slate-100 font-black text-center py-1.5 text-xs border-b border-black text-slate-800">
                                        অনুপস্থিত শিক্ষার্থীর তালিকা - মোট {toBengaliNumber(absentStudents.length)} জন
                                    </div>
                                    <table className="border-collapse w-full">
                                        <thead className="bg-slate-50">
                                            <tr className="h-8 border-b border-black">
                                                <th className="text-center font-black text-slate-900 border-r border-black w-14">ক্রমিক</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-14">রোল</th>
                                                <th className="font-black text-slate-900 border-r border-black text-left pl-3">শিক্ষার্থীর নাম</th>
                                                <th className="text-center font-black text-slate-900 border-r border-black w-24">শাখা/বিভাগ</th>
                                                <th className="text-center font-black text-slate-900 w-20">অবস্থা</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {absentStudents.map((res, idx) => (
                                                <tr key={res.student.id} className="h-7 border-b border-black last:border-0 hover:bg-slate-50">
                                                    <td className="text-center font-black border-r border-black text-slate-700">{toBengaliNumber(idx + 1)}</td>
                                                    <td className="text-center font-bold border-r border-black">{toBengaliNumber(res.student.roll)}</td>
                                                    <td className="font-bold border-r border-black pl-3">{res.student.studentNameBn}</td>
                                                    <td className="text-center font-bold border-r border-black text-slate-700 text-[11px]">
                                                        {groupNamesMap[res.student.group || ''] || res.student.group || 'সাধারণ'}
                                                    </td>
                                                    <td className="text-center font-black text-slate-600 text-[11px]">অনুপস্থিত</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </main>

                        <footer className="relative z-10 pt-10 flex justify-around items-end print-footer mt-auto pb-6 px-10">
                            <div className="text-center">
                                <div className="w-48 border-t-2 border-black pt-1 font-black text-sm uppercase">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                            </div>
                            <div className="text-center">
                                <div className="w-48 border-t-2 border-black pt-1 font-black text-sm uppercase">প্রধান শিক্ষকের স্বাক্ষর ও সিল</div>
                            </div>
                        </footer>
                        
                        <div className="text-[8px] text-slate-400 italic text-center relative z-10 mb-2 px-10 flex justify-between w-full">
                            <span>রিপোর্ট জেনারেট: {format(new Date(), 'PPpp', { locale: bn })}</span>
                            <span>Digital Management Portal | {schoolInfo.name}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function MeritListPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">লোড হচ্ছে...</div>}>
            <MeritListPrintContent />
        </Suspense>
    );
}
