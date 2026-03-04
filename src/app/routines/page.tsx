'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getFullRoutine, saveRoutinesBatch, ClassRoutine } from '@/lib/routine-data';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Copy, Printer, FilePen, FilePlus, Users, Info, AlertCircle, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { subjectNameNormalization as baseSubjectNameNormalization, getSubjects } from '@/lib/subjects';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

const subjectNameNormalization: { [key: string]: string } = {
    ...baseSubjectNameNormalization,
    'শারীরিক': 'শারীরিক শিক্ষা',
    'শারীরিক শিক্ষা': 'শারীরিক শিক্ষা',
    'ধর্ম': 'ধর্ম ও নৈতিক শিক্ষা',
    'বা ও বি': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'বাও বি': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'বা ও বি পরিচয়': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'বিজিএস': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'বিজ্ঞান': 'সাধারণ বিজ্ঞান',
    'সাধারণ বিজ্ঞান': 'সাধারণ বিজ্ঞান',
    'ইতিহাস': 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা',
    'ভূগোল': 'ভূগোল ও পরিবেশ',
    'পৌরনীতি': 'পৌরনীতি ও নাগরিকতা',
    'পৌর': 'পৌরনীতি ও নাগরিকতা',
    'উচ্চতর গণিত': 'উচ্চতর গণিত',
    'উচ্চতর': 'উচ্চতর গণিত',
    'জীব': 'জীব বিজ্ঞান',
    'জীববিজ্ঞান': 'জীব বিজ্ঞান',
    'কৃষি': 'কৃষি শিক্ষা',
    'বাংলা ১': 'বাংলা প্রথম',
    'বাংলা ২য়': 'বাংলা দ্বিতীয়',
    'ইংরেজি ১': 'ইংরেজি প্রথম',
    'ইংরেজি ২য়': 'ইংরেজি দ্বিতীয়',
    'আইসিটি': 'তথ্য ও যোগাযোগ প্রযুক্তি',
};

const teacherAllocations: Record<string, Record<string, string[]>> = {
    'আনিছুর': { 
        'বাংলাদেশ ও বিশ্ব পরিচয়': ['6', '7', '8', '9', '10'], 
        'ধর্ম ও নৈতিক শিক্ষা': ['6', '7'],
        'ইসলাম ধর্ম': ['6', '7']
    },
    'নীলা': { 
        'কৃষি শিক্ষা': ['6'],
        'ধর্ম ও নৈতিক শিক্ষা': ['6', '7', '8', '9', '10'],
        'হিন্দু ধর্ম': ['6', '7', '8', '9', '10']
    },
    'জান্নাতুন': { 
        'কৃষি শিক্ষা': ['6', '7'], 
        'পৌরনীতি ও নাগরিকতা': ['9', '10'], 
        'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা': ['9', '10'] 
    },
    'যুধিষ্ঠির': { 
        'বাংলা দ্বিতীয়': ['6', '7', '8', '9', '10'], 
        'ইংরেজি দ্বিতীয়': ['6', '7'] 
    },
    'ধনঞ্জয়': { 
        'গণিত': ['6', '7', '8', '9', '10'], 
        'রসায়ন': ['9', '10'], 
        'পদার্থ': ['9', '10'], 
        'উচ্চতর গণিত': ['9'] 
    },
    'আরিফুর': { 
        'ইংরেজি প্রথম': ['6', '7', '8', '9', '10'], 
        'ইংরেজি দ্বিতীয়': ['8', '9', '10'] 
    },
    'ওবায়দা': { 
        'বাংলা প্রথম': ['6', '7', '8', '9', '10'] 
    },
    'সারমিন': { 
        'তথ্য ও যোগাযোগ প্রযুক্তি': ['6', '7', '8', '9', '10'], 
        'ভূগোল ও পরিবেশ': ['9', '10'] 
    },
    'শান্তি': { 
        'সাধারণ বিজ্ঞান': ['6', '7', '8', '9', '10'], 
        'জীব বিজ্ঞান': ['9', '10'] 
    },
    'মাহাবুর': { 
        'কৃষি শিক্ষা': ['8', '9', '10'], 
        'ধর্ম ও নৈতিক শিক্ষা': ['8', '9', '10'],
        'ইসলাম ধর্ম': ['8', '9', '10']
    }
};


const parseSubjectTeacher = (cell: string): { subject: string, teacher: string | null } => {
    if (!cell) return { subject: '', teacher: null };
    const trimmedCell = cell.trim();
    if (!trimmedCell.includes(' - ')) {
        return { subject: trimmedCell, teacher: null };
    }
    const parts = trimmedCell.split(' - ');
    const teacher = parts.pop()?.trim() || null;
    const subject = parts.join(' - ').trim();
    return { subject, teacher };
};

const useRoutineAnalysis = (routine: Record<string, Record<string, string[]>>) => {
    const analysis = useMemo(() => {
        const colorPalette = [
            '#FDEDEC', '#F5EEF8', '#EAF2F8', '#D6EAF8',
            '#D1F2EB', '#D0ECE7', '#D4EFDF', '#FCF3CF',
            '#FDEBD0', '#FAE5D3', '#F6DDCC', '#FADBD8',
            '#E5E7E9', '#E8DAEF', '#D2B4DE', '#A9CCE3',
            '#A3E4D7', '#A2D9CE', '#ABEBC6', '#F9E79F',
            '#FAD7A0', '#F5CBA7', '#EDBB99', '#D98880'
        ];

        const teacherClashes = new Set<string>();
        const consecutiveClassClashes = new Set<string>();
        const breakClashes = new Set<string>();
        const subjectRepetitionClashes = new Set<string>();
        const teacherSubjectMismatchClashes = new Set<string>();
        
        const teacherStats: { [teacher: string]: { 
            total: number, 
            daily: { [day: string]: { classes: string[], before: number, after: number }},
            fullSchedule: { [day: string]: string[] } 
        } } = {};
        const classStats: { [cls: string]: { [subject: string]: number } } = {};
        
        const allIndividualTeachers = new Set<string>();
        Object.keys(teacherAllocations).forEach(t => allIndividualTeachers.add(t));

        const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"];
        const classes = Object.keys(routine);
        const periodsCount = 6;

        classes.forEach(cls => {
            days.forEach(day => {
                const dayRoutine = routine[cls]?.[day];
                if (dayRoutine) {
                    dayRoutine.forEach(cell => {
                        if (cell) {
                            const { teacher } = parseSubjectTeacher(cell);
                            if (teacher) {
                                teacher.split('/').forEach(t => {
                                    const trimmedTeacher = t.trim();
                                    if (trimmedTeacher && !allIndividualTeachers.has(trimmedTeacher)) {
                                        allIndividualTeachers.add(trimmedTeacher);
                                    }
                                });
                            }
                        }
                    });
                }
            });
        });

        allIndividualTeachers.forEach(t => {
            teacherStats[t] = { 
                total: 0, 
                daily: { 
                    'রবিবার': { classes: [], before: 0, after: 0 }, 
                    'সোমবার': { classes: [], before: 0, after: 0 }, 
                    'মঙ্গলবার': { classes: [], before: 0, after: 0 }, 
                    'বুধবার': { classes: [], before: 0, after: 0 }, 
                    'বৃহস্পতিবার': { classes: [], before: 0, after: 0 } 
                },
                fullSchedule: {
                    'রবিবার': Array(6).fill(''),
                    'সোমবার': Array(6).fill(''),
                    'মঙ্গলবার': Array(6).fill(''),
                    'বুধবার': Array(6).fill(''),
                    'বৃহস্পতিবার': Array(6).fill('')
                }
            };
        });
        
        const sortedTeachers = Array.from(allIndividualTeachers).sort();
        const teacherColorMap = new Map<string, string>();
        sortedTeachers.forEach((teacher, index) => {
            teacherColorMap.set(teacher, colorPalette[index % colorPalette.length]);
        });
        
        days.forEach(day => {
            const teachersAt3rd = new Map<string, string[]>(); // Before break (index 2)
            const teachersAt4th = new Map<string, string[]>(); // After break (index 3)

            for (let periodIdx = 0; periodIdx < periodsCount; periodIdx++) {
                const periodTeachers = new Map<string, string>();
                classes.forEach(cls => {
                    const cell = routine[cls]?.[day]?.[periodIdx];
                    if (cell) {
                        const { subject, teacher } = parseSubjectTeacher(cell);
                        if (teacher) {
                            teacher.split('/').forEach(t => {
                                const trimmedTeacher = t.trim();
                                if (!trimmedTeacher) return;

                                if (teacherStats[trimmedTeacher]) {
                                    teacherStats[trimmedTeacher].fullSchedule[day][periodIdx] = cls;
                                }

                                if (periodTeachers.has(trimmedTeacher)) {
                                    teacherClashes.add(`${cls}-${day}-${periodIdx}`);
                                    const existingCls = periodTeachers.get(trimmedTeacher)!;
                                    teacherClashes.add(`${existingCls}-${day}-${periodIdx}`);
                                } else {
                                    periodTeachers.set(trimmedTeacher, cls);
                                }

                                if (periodIdx === 2) { // 3rd period
                                    if (!teachersAt3rd.has(trimmedTeacher)) teachersAt3rd.set(trimmedTeacher, []);
                                    teachersAt3rd.get(trimmedTeacher)!.push(cls);
                                } else if (periodIdx === 3) { // 4th period
                                    if (!teachersAt4th.has(trimmedTeacher)) teachersAt4th.set(trimmedTeacher, []);
                                    teachersAt4th.get(trimmedTeacher)!.push(cls);
                                }
                            })
                        }
                    }
                });
            }

            teachersAt3rd.forEach((classesBefore, teacher) => {
                if (teachersAt4th.has(teacher)) {
                    const classesAfter = teachersAt4th.get(teacher)!;
                    classesBefore.forEach(cls => breakClashes.add(`${cls}-${day}-2`));
                    classesAfter.forEach(cls => breakClashes.add(`${cls}-${day}-3`));
                }
            });
        });

        classes.forEach(cls => {
            classStats[cls] = {};
            const subjectsInClass = getSubjects(cls);
            days.forEach(day => {
                const dayRoutine = routine[cls]?.[day];
                if (dayRoutine) {
                    const subjectCountInDay = new Map<string, number[]>();

                    dayRoutine.forEach((cell, periodIdx) => {
                        const { subject, teacher } = parseSubjectTeacher(cell);
                        if (!subject && !teacher) return;

                        const subjectsInCell = subject.split('/').map(s => s.trim()).filter(Boolean);
                        
                        subjectsInCell.forEach(s => {
                            const normalizedSubject = subjectNameNormalization[s] || s;
                            const subjectInfo = subjectsInClass.find(sub => sub.name === normalizedSubject || sub.name === s);
                            if (subjectInfo) {
                                if (!classStats[cls][subjectInfo.name]) classStats[cls][subjectInfo.name] = 0;
                                classStats[cls][subjectInfo.name] += 1;
                            }

                            if (!subjectCountInDay.has(s)) {
                                subjectCountInDay.set(s, []);
                            }
                            subjectCountInDay.get(s)!.push(periodIdx);
                        });

                        if (teacher) {
                            teacher.split('/').forEach(t => {
                                const trimmedTeacher = t.trim();
                                if (!trimmedTeacher || !teacherStats[trimmedTeacher]) return;
                                
                                teacherStats[trimmedTeacher].total++;
                                teacherStats[trimmedTeacher].daily[day].classes.push(`${subject} (${cls} শ্রেণি)`);
                                if (periodIdx < 3) {
                                    teacherStats[trimmedTeacher].daily[day].before++;
                                } else {
                                    teacherStats[trimmedTeacher].daily[day].after++;
                                }
                            });
                        }
                        
                        if (subject && teacher) {
                            const teachersInCell = teacher.split('/').map(t => t.trim()).filter(Boolean);
                            const subjectsInCellNormalized = subjectsInCell.map(s => subjectNameNormalization[s] || s);
                            const classNumber = cls.split('-')[0];

                            teachersInCell.forEach(t => {
                                if (!teacherAllocations[t]) return;
                                
                                let isAllocated = false;
                                for (const subj of subjectsInCellNormalized) {
                                    if (teacherAllocations[t][subj]?.includes(classNumber)) {
                                        isAllocated = true;
                                        break;
                                    }
                                }
                                
                                if (!isAllocated) {
                                    teacherSubjectMismatchClashes.add(`${cls}-${day}-${periodIdx}`);
                                }
                            });
                        }
                    });

                    subjectCountInDay.forEach((indices, subjectName) => {
                        const normalizedSub = subjectNameNormalization[subjectName] || subjectName;
                        if (indices.length > 1) {
                           const subjectInfo = subjectsInClass.find(s => s.name === normalizedSub);
                           const isLanguage = normalizedSub.includes('বাংলা') || normalizedSub.includes('ইংরেজি');
                           if (subjectInfo && !isLanguage) {
                                indices.forEach(idx => subjectRepetitionClashes.add(`${cls}-${day}-${idx}`));
                           }
                        }
                    });

                    const consecutivePairs = [[0, 1], [1, 2], [3, 4], [4, 5]];
                    consecutivePairs.forEach(([p1, p2]) => {
                        const cell1 = dayRoutine[p1];
                        const cell2 = dayRoutine[p2];
                        if (!cell1 || !cell2) return;

                        const teacher1 = parseSubjectTeacher(cell1).teacher;
                        const teacher2 = parseSubjectTeacher(cell2).teacher;
                        if (teacher1 && teacher2) {
                            const teachers1 = teacher1.split('/').map(t => t.trim()).filter(Boolean);
                            const teachers2 = teacher2.split('/').map(t => t.trim()).filter(Boolean);
                            const hasOverlap = teachers1.some(t => teachers2.includes(t));
                            if (hasOverlap) {
                                consecutiveClassClashes.add(`${cls}-${day}-${p1}`);
                                consecutiveClassClashes.add(`${cls}-${day}-${p2}`);
                            }
                        }
                    });
                }
            });
        });

        return { conflicts: { teacherClashes, consecutiveClassClashes, breakClashes, subjectRepetitionClashes, teacherSubjectMismatchClashes }, stats: { teacherStats, classStats }, teacherColorMap };
    }, [routine]);

    return analysis;
};

const RoutineStatistics = ({ stats }: { stats: any }) => {
    const { teacherStats, classStats } = stats;
    const teachers = Object.keys(teacherStats).sort();
    const classes = Object.keys(classStats).sort((a,b) => parseInt(a) - parseInt(b));
    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };
    const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"];
    const periodLabels = ["১ম", "২য়", "৩য়", "৪র্থ", "৫ম", "৬ষ্ঠ"];

    const [selectedTeacher, setSelectedTeacher] = useState<string>('');

    const teacherSummary = useMemo(() => {
        if (!selectedTeacher || !teacherStats[selectedTeacher]) return null;
        const stats = teacherStats[selectedTeacher];
        let totalBefore = 0;
        let totalAfter = 0;
        Object.values(stats.daily).forEach((d: any) => {
            totalBefore += d.before;
            totalAfter += d.after;
        });
        return {
            name: selectedTeacher,
            total: stats.total,
            before: totalBefore,
            after: totalAfter
        };
    }, [selectedTeacher, teacherStats]);

    return (
        <Accordion type="multiple" className="w-full space-y-4">
            <AccordionItem value="teacher-schedule-view">
                <AccordionTrigger className="text-lg font-semibold bg-muted/20 px-4 rounded-t-lg">শিক্ষকের ব্যক্তিগত রুটিন (পিরিয়ড অনুযায়ী)</AccordionTrigger>
                <AccordionContent className="p-4 border rounded-b-lg space-y-6">
                    <div className="max-w-md space-y-2">
                        <Label className="font-bold text-primary">শিক্ষক নির্বাচন করুন</Label>
                        <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                            <SelectTrigger className="bg-white">
                                <SelectValue placeholder="শিক্ষকের নাম" />
                            </SelectTrigger>
                            <SelectContent>
                                {teachers.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedTeacher ? (
                        <div className="border-2 border-green-600 rounded-lg overflow-x-auto bg-white shadow-sm">
                            <Table className="min-w-[800px]">
                                <TableHeader>
                                    <TableRow className="bg-primary text-primary-foreground border-b-2 border-primary-foreground/20">
                                        <TableCell colSpan={8} className="font-bold py-3 text-center text-base">
                                            শিক্ষকের নাম: {teacherSummary?.name} | 
                                            সাপ্তাহিক মোট ক্লাস: {teacherSummary?.total.toLocaleString('bn-BD')} টি | 
                                            বিরতির আগে: {teacherSummary?.before.toLocaleString('bn-BD')} টি | 
                                            বিরতির পরে: {teacherSummary?.after.toLocaleString('bn-BD')} টি
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="bg-primary/5">
                                        <TableHead className="font-bold border-r text-center w-24">বার</TableHead>
                                        {periodLabels.map((p, i) => (
                                            <React.Fragment key={p}>
                                                <TableHead className="text-center font-bold border-r">{p} পিরিয়ড</TableHead>
                                                {i === 2 && <TableHead className="text-center font-bold bg-amber-50 text-amber-900 w-16">টিফিন</TableHead>}
                                            </React.Fragment>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {days.map(day => (
                                        <TableRow key={day} className="hover:bg-muted/30">
                                            <TableCell className="font-bold border-r text-center bg-gray-50">{day}</TableCell>
                                            {teacherStats[selectedTeacher].fullSchedule[day].map((cls, idx) => (
                                                <React.Fragment key={`${day}-${idx}`}>
                                                    <TableCell className={cn(
                                                        "text-center border-r font-black py-4",
                                                        cls ? "text-primary bg-primary/5" : "text-muted-foreground/30 font-normal"
                                                    )}>
                                                        {cls ? `${classNamesMap[cls] || cls} শ্রেণি` : '-'}
                                                    </TableCell>
                                                    {idx === 2 && <TableCell className="bg-amber-50/20 border-r" />}
                                                </React.Fragment>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/10 rounded-lg border-2 border-dashed">
                            <User className="h-12 w-12 mb-2 opacity-20" />
                            <p>কোনো শিক্ষকের ব্যক্তিগত রুটিন দেখতে ড্রপডাউন থেকে তাঁর নাম সিলেক্ট করুন।</p>
                        </div>
                    )}
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="class-stats">
                <AccordionTrigger className="text-lg font-semibold bg-muted/20 px-4 rounded-t-lg">শ্রেণিভিত্তিক বিষয় পরিসংখ্যান</AccordionTrigger>
                <AccordionContent className="p-0 border rounded-b-lg">
                     <div className="overflow-x-auto">
                        <Table className="border-collapse border-green-600">
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="text-center">শ্রেণি</TableHead>
                                    <TableHead>বিষয়</TableHead>
                                    <TableHead className="text-center">সাপ্তাহিক পিরিয়ড</TableHead>
                                    <TableHead>অবস্থা</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {classes.map(cls => {
                                    const subjectsForClass = getSubjects(cls, undefined)
                                        .sort((a,b) => parseInt(a.code) - parseInt(b.code));
                                    
                                    if(subjectsForClass.length === 0) return null;
                                    
                                    const rows = subjectsForClass.map((subject, subjectIndex) => {
                                        const count = classStats[cls]?.[subject.name] || 0;
                                        
                                        return (
                                            <TableRow key={`${cls}-${subject.name}`} className="h-8">
                                                {subjectIndex === 0 && <TableCell rowSpan={subjectsForClass.length} className="font-black align-top text-center border-r bg-muted/10">{classNamesMap[cls]}</TableCell>}
                                                <TableCell className="text-xs">{subject.name}</TableCell>
                                                <TableCell className="text-center font-bold">{count.toLocaleString('bn-BD')}</TableCell>
                                                <TableCell>
                                                    {count > 0 ? (
                                                        <Badge variant="outline" className="text-[10px] h-5 bg-emerald-50 text-emerald-700 border-emerald-200">সক্রিয়</Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-[10px] h-5 bg-red-50 text-red-700 border-red-200 opacity-50">শূন্য</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    });
                                    return rows;
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};


const RoutineTable = ({ className, routineData, conflicts, isEditMode, onCellChange, teacherColorMap, isMounted }: { className: string, routineData: any, conflicts: any, isEditMode: boolean, onCellChange: (cls: string, day: string, periodIdx: number, value: string) => void, teacherColorMap: Map<string, string>, isMounted: boolean }) => {
    const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"];
    const periods = [ 
        { name: "১ম", time: "১০:৩০ - ১১:২০" }, 
        { name: "২য়", time: "১১:২০ - ১২:১০" }, 
        { name: "৩য়", time: "১২:১০ - ০১:০০" }
    ];
    const postBreakPeriods = [ 
        { name: "৪র্থ", time: "০২:০০ - ০২:৪০" }, 
        { name: "৫ম", time: "০২:৪০ - ০৩:২০" }, 
        { name: "৬ষ্ঠ", time: "০৩:২০ - ০৪:০০" } 
    ];
    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

    const routineForClass = routineData[className] || {};

    return (
        <Card className="border-2 border-green-600">
            <CardHeader>
                <CardTitle>ক্লাস রুটিন (শ্রেণি - {classNamesMap[className] || className})</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table className="border-collapse border-green-600 border min-w-[800px]">
                        <TableHeader>
                            <TableRow className="bg-muted/50">
                                <TableHead className="border-r font-bold align-middle text-center w-[100px]">বার</TableHead>
                                {periods.map(p => <TableHead key={p.name} className="border-r text-center font-semibold">{p.name} পিরিয়ড<br/><span className="font-normal text-[10px] text-muted-foreground">{p.time}</span></TableHead>)}
                                <TableHead className="border-r text-center font-semibold bg-amber-50 text-amber-900 w-[80px]">বিরতি<br/><span className="font-normal text-[10px]">০১:০০ - ০২:০০</span></TableHead>
                                {postBreakPeriods.map(p => <TableHead key={p.name} className="border-r text-center font-semibold">{p.name} পিরিয়ড<br/><span className="font-normal text-[10px] text-muted-foreground">{p.time}</span></TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {days.map(day => (
                                <TableRow key={day}>
                                    <TableCell className="font-bold border-r text-center bg-gray-50">{day}</TableCell>
                                    {[...Array(3)].map((_, periodIdx) => {
                                        const cellContent = (routineForClass[day] || [])[periodIdx] || '';
                                        return <EditableCell key={`${day}-${periodIdx}`} content={cellContent} isEditMode={isEditMode} onCellChange={(value) => onCellChange(className, day, periodIdx, value)} conflictKey={`${className}-${day}-${periodIdx}`} conflicts={conflicts} teacherColorMap={teacherColorMap} isMounted={isMounted} />;
                                    })}
                                    <TableCell className="border-r text-center bg-amber-50/50 font-bold text-amber-800 text-xs">টিফিন</TableCell>
                                    {[...Array(3)].map((_, i) => {
                                        const periodIdx = i + 3;
                                        const cellContent = (routineForClass[day] || [])[periodIdx] || '';
                                        return <EditableCell key={`${day}-${periodIdx}`} content={cellContent} isEditMode={isEditMode} onCellChange={(value) => onCellChange(className, day, periodIdx, value)} conflictKey={`${className}-${day}-${periodIdx}`} conflicts={conflicts} teacherColorMap={teacherColorMap} isMounted={isMounted} />;
                                    })}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

const CombinedRoutineTable = ({ routineData, conflicts, isEditMode, onCellChange, teacherColorMap, isMounted }: { routineData: Record<string, Record<string, string[]>>, conflicts: any, isEditMode: boolean, onCellChange: (cls: string, day: string, periodIdx: number, value: string) => void, teacherColorMap: Map<string, string>, isMounted: boolean }) => {
    const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"];
    const classes = ['6', '7', '8', '9', '10'];
    const periods = [ 
        { name: "১ম", time: "১০:৩০ - ১১:২০" }, 
        { name: "২য়", time: "১১:২০ - ১২:১০" }, 
        { name: "৩য়", time: "১২:১০ - ০১:০০" }
    ];
    const postBreakPeriods = [ 
        { name: "৪র্থ", time: "০২:০০ - ০২:৪০" }, 
        { name: "৫ম", time: "০২:৪০ - ০৩:২০" }, 
        { name: "৬ষ্ঠ", time: "০৩:২০ - ০৪:০০" } 
    ];
    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

    return (
        <div className="overflow-x-auto w-full border-2 border-green-600 rounded-lg shadow-inner bg-white">
           <Table className="border-collapse w-full min-w-[900px] print:min-w-full print:text-[8px] border-green-600">
                <TableHeader>
                   <TableRow className="bg-muted/50 h-14 print:h-8">
                       <TableHead className="border-r font-bold align-middle text-center w-[100px] print:w-[60px] border-green-600">বার</TableHead>
                       <TableHead className="border-r font-bold align-middle text-center w-[80px] print:w-[40px] border-green-600">শ্রেণি</TableHead>
                       {periods.map(p => (
                           <TableHead key={p.name} className="border-r text-center font-bold min-w-[110px] print:min-w-[70px] border-green-600">
                               {p.name}<br/>
                               <span className="font-normal text-[10px] text-muted-foreground print:hidden">{p.time}</span>
                           </TableHead>
                       ))}
                       <TableHead className="border-r text-center font-bold bg-amber-50 text-amber-900 w-[50px] print:w-[30px] print:text-[7px] border-green-600">বিরতি</TableHead>
                       {postBreakPeriods.map(p => (
                           <TableHead key={p.name} className="border-r text-center font-bold min-w-[110px] print:min-w-[70px] border-green-600">
                               {p.name}<br/>
                               <span className="font-normal text-[10px] text-muted-foreground print:hidden">{p.time}</span>
                           </TableHead>
                       ))}
                   </TableRow>
               </TableHeader>
               <TableBody>
                   {days.map((day) => (
                       classes.map((cls, classIndex) => (
                           <TableRow 
                             key={`${day}-${cls}`} 
                             className={cn(
                                "h-12 print:h-7 hover:bg-muted/20 transition-colors",
                                classIndex === 0 && "border-t-[3px] border-t-green-600",
                                classIndex === classes.length - 1 && "border-b-[3px] border-b-green-600"
                             )}
                           >
                               {classIndex === 0 && (
                                    <TableCell className="font-black border-r align-middle text-center bg-gray-50 print:bg-white text-sm print:text-[10px] border-l-[4px] border-l-green-600/20 border-green-600" rowSpan={classes.length}>
                                        {day}
                                    </TableCell>
                               )}
                               <TableCell className="font-bold border-r text-center bg-gray-50/50 print:bg-white text-xs print:text-[8px] border-green-600">{classNamesMap[cls]}</TableCell>
                               {[...Array(3)].map((_, periodIdx) => {
                                   const cellContent = (routineData[cls]?.[day] || [])[periodIdx] || '';
                                   return <EditableCell key={`${day}-${cls}-${periodIdx}`} content={cellContent} isEditMode={isEditMode} onCellChange={(value) => onCellChange(cls, day, periodIdx, value)} conflictKey={`${cls}-${day}-${periodIdx}`} conflicts={conflicts} teacherColorMap={teacherColorMap} isMounted={isMounted} />;
                               })}
                               {classIndex === 0 && (
                                    <TableCell className="border-r text-center bg-amber-50/30 font-black text-[11px] print:text-[8px] align-middle text-amber-800 border-green-600" rowSpan={classes.length}>
                                        <div className="[writing-mode:vertical-lr] rotate-180 py-4 print:py-1 tracking-widest uppercase">টিফিন</div>
                                    </TableCell>
                               )}
                               {[...Array(3)].map((_, i) => {
                                   const periodIdx = i + 3;
                                   const cellContent = (routineData[cls]?.[day] || [])[periodIdx] || '';
                                   return <EditableCell key={`${day}-${cls}-${periodIdx}`} content={cellContent} isEditMode={isEditMode} onCellChange={(value) => onCellChange(cls, day, periodIdx, value)} conflictKey={`${cls}-${day}-${periodIdx}`} conflicts={conflicts} teacherColorMap={teacherColorMap} isMounted={isMounted} />;
                               })}
                           </TableRow>
                       ))
                   ))}
               </TableBody>
           </Table>
        </div>
    );
};

const EditableCell = ({ content, isEditMode, onCellChange, conflictKey, conflicts, teacherColorMap, isMounted }: { content: string, isEditMode: boolean, onCellChange: (value: string) => void, conflictKey: string, conflicts: any, teacherColorMap: Map<string, string>, isMounted: boolean }) => {
    const isTeacherClash = conflicts.teacherClashes.has(conflictKey);
    const isConsecutiveClash = conflicts.consecutiveClassClashes.has(conflictKey);
    const isBreakClash = conflicts.breakClashes.has(conflictKey);
    const isSubjectRepetitionClash = conflicts.subjectRepetitionClashes.has(conflictKey);
    const isTeacherSubjectMismatch = conflicts.teacherSubjectMismatchClashes.has(conflictKey);
    const isConflict = isTeacherClash || isConsecutiveClash || isBreakClash || isSubjectRepetitionClash || isTeacherSubjectMismatch;

    let tooltipContent = '';
    if (isTeacherClash) tooltipContent += 'একই সময়ে এই শিক্ষকের অন্য ক্লাসে ক্লাস রয়েছে। ';
    if (isConsecutiveClash) tooltipContent += 'একই শিক্ষকের এই ক্লাসে পরপর ক্লাস পড়েছে। ';
    if (isBreakClash) tooltipContent += 'বিরতির আগে ও পরে একই শিক্ষকের ক্লাস পড়েছে। ';
    if (isSubjectRepetitionClash) tooltipContent += 'একই দিনে এই শ্রেণিতে এই বিষয়টি একাধিকবার রয়েছে। ';
    if (isTeacherSubjectMismatch) tooltipContent += 'এই বিষয়ের জন্য নির্ধারিত শিক্ষক নন। ';

    const { teacher } = parseSubjectTeacher(content);
    const teachersInCell = teacher ? teacher.split('/').map(t => t.trim()) : [];
    const firstTeacher = teachersInCell.length > 0 ? teachersInCell[0] : null;
    const color = firstTeacher ? teacherColorMap.get(firstTeacher) : undefined;

    const cellContent = isEditMode ? (
        <Input
            value={content}
            onChange={(e) => onCellChange(e.target.value)}
            className={cn("w-full h-full p-1 text-[11px] border-transparent rounded-none focus:bg-amber-100 text-center min-h-[40px]", { "bg-red-100": isConflict })}
        />
    ) : (
        <div className="p-2 print:p-0.5 text-[11px] print:text-[8px] text-center leading-tight break-words font-medium">
            {content || <>&nbsp;</>}
        </div>
    );

    if (!isMounted || !isConflict) {
        return (
            <TableCell 
                className={cn("border-r p-0 h-auto align-middle border-green-600", { "bg-red-100 text-red-700": isConflict && !isEditMode })}
                style={!isEditMode && !isConflict && color ? { backgroundColor: color } : {}}
            >
                {cellContent}
            </TableCell>
        );
    }
    
    return (
        <TableCell className="border-r p-0 h-auto align-middle border-green-600">
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <div
                            className={cn("w-full h-full", { "bg-red-100 text-red-700": isConflict && !isEditMode })}
                            style={!isEditMode && !isConflict && color ? { backgroundColor: color } : {}}
                        >
                            {cellContent}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{tooltipContent}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </TableCell>
    );
};

const ClassRoutineTab = ({ routineData, conflicts, isEditMode, onCellChange, teacherColorMap, isMounted }: { routineData: any, conflicts: any, isEditMode: boolean, onCellChange: (cls: string, day: string, periodIdx: number, value: string) => void, teacherColorMap: Map<string, string>, isMounted: boolean }) => {
    const [className, setClassName] = useState('all');
    
    return (
        <div className="space-y-6">
             <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg items-end no-print bg-white/50">
                <div className="space-y-2 flex-1">
                    <Label htmlFor="class-name" className="font-bold text-primary">শ্রেণি নির্বাচন করুন</Label>
                    <Select value={className} onValueChange={setClassName}>
                        <SelectTrigger id="class-name" className="bg-white"><SelectValue placeholder="শ্রেণি নির্বাচন করুন" /></SelectTrigger>
                        <SelectContent>
                           <SelectItem value="all">সকল শ্রেণির সম্মিলিত রুটিন</SelectItem>
                           <SelectItem value="6">৬ষ্ঠ শ্রেণি</SelectItem>
                           <SelectItem value="7">৭ম শ্রেণি</SelectItem>
                           <SelectItem value="8">৮ম শ্রেণি</SelectItem>
                           <SelectItem value="9">৯ম শ্রেণি</SelectItem>
                           <SelectItem value="10">১০ম শ্রেণি</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            {className === 'all' ? (
                 <Card className="border-green-600 overflow-hidden border-2">
                    <CardHeader className="no-print bg-primary/5">
                        <CardTitle className="text-xl flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" /> সকল শ্রেণির সম্মিলিত ক্লাস রুটিন
                        </CardTitle>
                        <CardDescription>নিচে স্ক্রল করে ডানে-বামে সব তথ্য দেখুন</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6">
                        <CombinedRoutineTable routineData={routineData} conflicts={conflicts} isEditMode={isEditMode} onCellChange={onCellChange} teacherColorMap={teacherColorMap} isMounted={isMounted} />
                    </CardContent>
                </Card>
            ) : (
                <RoutineTable 
                    className={className} 
                    routineData={routineData}
                    conflicts={conflicts}
                    isEditMode={isEditMode}
                    onCellChange={onCellChange}
                    teacherColorMap={teacherColorMap}
                    isMounted={isMounted}
                />
            )}

            <div className="no-print mt-8 p-6 bg-blue-50 border border-blue-200 rounded-xl shadow-sm">
                <h4 className="text-lg font-black text-blue-800 flex items-center gap-2 mb-4">
                    <Info className="h-5 w-5" /> রুটিন তৈরির নিয়ম ও শর্তাবলী (Validation Logic):
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <div className="flex gap-3">
                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-blue-900">শিক্ষক সংঘর্ষ (Teacher Clash)</p>
                                <p className="text-xs text-blue-700 leading-relaxed">একজন শিক্ষক একই সময়ে একাধিক ক্লাসে উপস্থিত থাকতে পারবেন না। এমন হলে ঘরটি লাল হবে।</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-blue-900">টানা ক্লাস (Consecutive Classes)</p>
                                <p className="text-xs text-blue-700 leading-relaxed">একই শিক্ষকের একই ক্লাসে পরপর দুটি পিরিয়ড থাকা উচিত নয়। সিস্টেম এটি স্বয়ংক্রিয়ভাবে চেক করে।</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-blue-900">বিরতি সংঘর্ষ (Break Clash)</p>
                                <p className="text-xs text-blue-700 leading-relaxed">টিফিনের ঠিক আগে (৩য় পিরিয়ড) এবং ঠিক পরে (৪র্থ পিরিয়ড) একই শিক্ষক কোনো ক্লাস নিতে পারবেন না (পুরো স্কুলের জন্য প্রযোজ্য)।</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3">
                        <div className="flex gap-3">
                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-blue-900">বিষয়ের পুনরাবৃত্তি (Subject Repetition)</p>
                                <p className="text-xs text-blue-700 leading-relaxed">একই দিনে একই বিষয় একাধিকবার নেওয়া যাবে না (বাংলা ও ইংরেজি ১ম/২য় পত্র বাদে)।</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            <div>
                                <p className="font-bold text-blue-900">শিক্ষক বরাদ্দ (Teacher Allocation)</p>
                                <p className="text-xs text-blue-700 leading-relaxed">শিক্ষককে অবশ্যই তার জন্য নির্ধারিত বিষয় এবং শ্রেণিতে বরাদ্দ করতে হবে। অন্যথায় এরর দেখাবে।</p>
                            </div>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-blue-100 flex items-center gap-3">
                            <div className="h-4 w-4 bg-red-100 border border-red-300 rounded"></div>
                            <p className="text-xs font-medium text-blue-800">রুটিনের যেকোনো ঘর <strong>লাল</strong> হওয়ার অর্থ সেখানে উপরের কোনো একটি শর্ত ভঙ্গ হয়েছে।</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ExamRoutineTab = () => {
    const [examName, setExamName] = useState('');

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg bg-white/50">
                <div className="space-y-2 flex-1">
                    <Label htmlFor="exam-name">পরীক্ষা</Label>
                    <Select value={examName} onValueChange={setExamName}>
                        <SelectTrigger id="exam-name" className="bg-white"><SelectValue placeholder="পরীক্ষা নির্বাচন করুন" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="half-yearly">অর্ধ-বার্ষিক পরীক্ষা</SelectItem>
                            <SelectItem value="annual">বার্ষিক পরীক্ষা</SelectItem>
                            <SelectItem value="pre-test">প্রাক-নির্বাচনী পরীক্ষা</SelectItem>
                            <SelectItem value="test">নির্বাচনী পরীক্ষা</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="flex items-end">
                     <Button className="w-full sm:auto">রুটিন দেখুন</Button>
                </div>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>পরীক্ষার রুটিন</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground p-12 bg-muted/20 rounded-lg border-2 border-dashed">
                        পরীক্ষার রুটিন পরিচালনা করার ফিচার শীঘ্রই আসছে।
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};


export default function RoutinesPage() {
    const { selectedYear, availableYears } = useAcademicYear();
    const [isClient, setIsClient] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    
    const db = useFirestore();
    const { toast } = useToast();
    const [originalRoutineData, setOriginalRoutineData] = useState<Record<string, Record<string, string[]>>>({});
    const [routineData, setRoutineData] = useState<Record<string, Record<string, string[]>>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);

    const [isCopyDialogOpen, setIsCopyDialogOpen] = useState(false);
    const [targetYear, setTargetYear] = useState('');
    const { schoolInfo, isLoading: isSchoolInfoLoading } = useSchoolInfo();
    const { user, hasPermission } = useAuth();
    const canManageRoutines = hasPermission('manage:routines');

    const fetchData = useCallback(async () => {
        if (!db || !user) return;
        setIsLoading(true);
        const routinesFromDb = await getFullRoutine(db, selectedYear);
        const transformedData: Record<string, Record<string, string[]>> = {};
        routinesFromDb.forEach(r => {
            if (!transformedData[r.className]) {
                transformedData[r.className] = {};
            }
            const periods = r.periods || [];
            while (periods.length < 6) {
                periods.push('');
            }
            transformedData[r.className][r.day] = periods.slice(0, 6);
        });
        setRoutineData(transformedData);
        setOriginalRoutineData(transformedData);
        setIsLoading(false);
    }, [db, user, selectedYear]);

    useEffect(() => {
        setIsClient(true);
        fetchData();
    }, [fetchData]);
    
    useEffect(() => {
        if (isClient) {
            setIsMounted(true);
        }
    }, [isClient]);

    const { conflicts, stats, teacherColorMap } = useRoutineAnalysis(routineData);
    
    const handleCellChange = (className: string, day: string, periodIndex: number, value: string) => {
        setRoutineData(prevData => {
            const newData = JSON.parse(JSON.stringify(prevData));
            if (!newData[className]) newData[className] = {};
            if (!newData[className][day]) newData[className][day] = Array(6).fill('');
            newData[className][day][periodIndex] = value;
            return newData;
        });
    };

    const handleSaveChanges = () => {
        if (!db) return;
        
        const routinesToSave: ClassRoutine[] = [];
        Object.keys(routineData).forEach(className => {
            Object.keys(routineData[className]).forEach(day => {
                routinesToSave.push({
                    academicYear: selectedYear,
                    className,
                    day,
                    periods: routineData[className][day]
                });
            });
        });

        saveRoutinesBatch(db, routinesToSave).then(() => {
            toast({ title: 'রুটিন সেভ হয়েছে' });
            setIsEditMode(false);
            setOriginalRoutineData(routineData);
        }).catch(() => {
            toast({ variant: 'destructive', title: 'সেভ করা যায়নি' });
        });
    };

    const handleCancelEdit = () => {
        setRoutineData(originalRoutineData);
        setIsEditMode(false);
    };

    const handleCreateBlankRoutine = () => {
        const blankRoutine: Record<string, Record<string, string[]>> = {};
        const classes = ['6', '7', '8', '9', '10'];
        const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"];
        
        classes.forEach(cls => {
            blankRoutine[cls] = {};
            days.forEach(day => {
                blankRoutine[cls][day] = Array(6).fill('');
            });
        });

        setRoutineData(blankRoutine);
        setOriginalRoutineData(blankRoutine);
        if (!isEditMode) {
            setIsEditMode(true);
        }
        toast({ title: 'ফাঁকা রুটিন তৈরি হয়েছে', description: 'এখন আপনি রুটিনটি পূরণ করতে পারেন।' });
    };

    const handlePrint = useCallback(() => {
        if (typeof window !== 'undefined') {
            window.print();
        }
    }, []);

    const handleCopyRoutine = async () => {
        if (!db) return;
        if (!targetYear) {
            toast({ variant: 'destructive', title: 'লক্ষ্য শিক্ষাবর্ষ নির্বাচন করুন।' });
            return;
        }
        if (targetYear === selectedYear) {
            toast({ variant: 'destructive', title: 'উৎস এবং লক্ষ্য শিক্ষাবর্ষ একই হতে পারে না।' });
            return;
        }
        
        const sourceRoutines = await getFullRoutine(db, selectedYear);

        if (sourceRoutines.length === 0) {
            toast({ variant: 'destructive', title: `উৎস শিক্ষাবর্ষে (${selectedYear}) কোনো রুটিন পাওয়া যায়নি।` });
            return;
        }

        const targetRoutinesData: ClassRoutine[] = sourceRoutines.map(routine => ({
            academicYear: targetYear,
            className: routine.className,
            day: routine.day,
            periods: routine.periods,
        }));
        
        try {
            await saveRoutinesBatch(db, targetRoutinesData);
            toast({ title: 'রুটিন সফলভাবে কপি হয়েছে।', description: `${selectedYear} থেকে ${targetYear} শিক্ষাবর্ষে রুটিন কপি করা হয়েছে।` });
            setIsCopyDialogOpen(false);
            setTargetYear('');
        } catch (error) {
            toast({ variant: 'destructive', title: 'রুটিন কপি করা যায়নি।' });
        }
    };

    return (
        <>
            <div className="flex min-h-screen w-full flex-col bg-fuchsia-100 no-print">
                <Header />
                <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-24">
                    <Card className="shadow-xl border-2 border-green-600">
                        <CardHeader className="bg-white/50">
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div>
                                    <CardTitle className="text-2xl font-black text-primary">রুটিন ব্যবস্থাপনা</CardTitle>
                                    {isClient ? (
                                        <p className="text-sm text-muted-foreground font-medium">শিক্ষাবর্ষ: {selectedYear.toLocaleString('bn-BD')}</p>
                                    ) : (
                                        <Skeleton className="h-5 w-32 mt-1" />
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center justify-start sm:justify-end gap-2">
                                    {isClient && !isLoading ? (
                                        <>
                                            {isEditMode && canManageRoutines ? (
                                                <>
                                                    <Button variant="outline" onClick={handleCancelEdit}>বাতিল</Button>
                                                    <Button onClick={handleSaveChanges} className="shadow-md">পরিবর্তন সেভ করুন</Button>
                                                </>
                                            ) : (
                                                <>
                                                     <Button variant="outline" onClick={handlePrint} className="no-print bg-white">
                                                        <Printer className="mr-2 h-4 w-4" /> রুটিন প্রিন্ট করুন
                                                    </Button>
                                                    {canManageRoutines && (
                                                        <>
                                                        <AlertDialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="outline" className="no-print bg-white">
                                                                    <Copy className="mr-2 h-4 w-4" /> রুটিন কপি করুন
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>রুটিন কপি করুন</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        বর্তমান শিক্ষাবর্ষ ({selectedYear.toLocaleString('bn-BD')}) এর রুটিনটি অন্য একটি শিক্ষাবর্ষে কপি করুন।
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <div className="py-4">
                                                                    <Label htmlFor="target-year">লক্ষ্য শিক্ষাবর্ষ</Label>
                                                                    <Select value={targetYear} onValueChange={setTargetYear}>
                                                                        <SelectTrigger id="target-year">
                                                                            <SelectValue placeholder="শিক্ষাবর্ষ নির্বাচন করুন" />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {availableYears.filter(y => y !== selectedYear).map(year => (
                                                                                <SelectItem key={year} value={year}>{year.toLocaleString('bn-BD')}</SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={handleCopyRoutine}>কপি করুন</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="outline" className="bg-white">
                                                                    <FilePlus className="mr-2 h-4 w-4" /> ফাঁকা রুটিন
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        এটি বর্তমান রুটিনের সকল তথ্য মুছে একটি নতুন ফাঁকা রুটিন তৈরি করবে। এই কাজটি ফিরিয়ে আনা যাবে না।
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={handleCreateBlankRoutine}>
                                                                        এগিয়ে যান
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                        <Button variant="outline" className="bg-white" onClick={() => setIsEditMode(true)}><FilePen className="mr-2 h-4 w-4" /> রুটিন এডিট</Button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <div className="flex items-center justify-end gap-2">
                                            <Skeleton className="h-9 w-44" />
                                            <Skeleton className="h-9 w-36" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            {isClient && !isLoading ? (
                                <Tabs defaultValue="class-routine">
                                    <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-lg h-12">
                                        <TabsTrigger value="class-routine" className="data-[state=active]:bg-white data-[state=active]:text-primary font-bold">ক্লাস রুটিন</TabsTrigger>
                                        <TabsTrigger value="exam-routine" className="data-[state=active]:bg-white data-[state=active]:text-primary font-bold">পরীক্ষার রুটিন</TabsTrigger>
                                        <TabsTrigger value="statistics" className="data-[state=active]:bg-white data-[state=active]:text-primary font-bold">পরিসংখ্যান</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="class-routine" className="mt-6">
                                        <ClassRoutineTab routineData={routineData} conflicts={conflicts} isEditMode={isEditMode && canManageRoutines} onCellChange={handleCellChange} teacherColorMap={teacherColorMap!} isMounted={isMounted} />
                                    </TabsContent>
                                    <TabsContent value="exam-routine" className="mt-6">
                                        <ExamRoutineTab />
                                    </TabsContent>
                                    <TabsContent value="statistics" className="mt-6">
                                        <RoutineStatistics stats={stats} />
                                    </TabsContent>
                                </Tabs>
                            ) : (
                            <div className="space-y-4">
                                <div className="grid w-full grid-cols-3 h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
                                        <div className="inline-flex items-center justify-center rounded-sm bg-background shadow-sm h-8 w-full"><Skeleton className="h-4 w-24" /></div>
                                        <div className="inline-flex items-center justify-center rounded-sm h-8 w-full"><Skeleton className="h-4 w-24" /></div>
                                        <div className="inline-flex items-center justify-center rounded-sm h-8 w-full"><Skeleton className="h-4 w-24" /></div>
                                    </div>
                                    <div className="p-4 border rounded-lg">
                                        <Skeleton className="h-48 w-full" />
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </main>
            </div>
            {isClient && (
                 <div className="printable-area routine-print-container text-black bg-white hidden print:flex">
                    <style jsx global>{`
                        @media print {
                            .routine-print-container {
                                display: flex !important;
                                flex-direction: column !important;
                                visibility: visible !important;
                                width: 210mm !important;
                                height: 297mm !important;
                                padding: 5mm 8mm !important;
                                box-sizing: border-box !important;
                            }
                            .routine-print-container table {
                                width: 100% !important;
                                border-collapse: collapse !important;
                                table-layout: auto !important;
                                border: 2px solid #16a34a !important;
                            }
                            .routine-print-container td, .routine-print-container th {
                                font-size: 8px !important;
                                padding: 1.5px 2px !important;
                                border: 1px solid #16a34a !important;
                                vertical-align: middle !important;
                                line-height: 1 !important;
                            }
                            .routine-print-container header {
                                margin-bottom: 4px !important;
                            }
                            .routine-print-container header h1 {
                                font-size: 16px !important;
                                margin-bottom: 1px !important;
                            }
                            .routine-print-container header p {
                                font-size: 10px !important;
                                margin-bottom: 1px !important;
                            }
                            .routine-print-container header h2 {
                                font-size: 12px !important;
                                margin-top: 2px !important;
                            }
                            .routine-print-container footer {
                                margin-top: 6px !important;
                                padding-top: 4px !important;
                            }
                        }
                    `}</style>
                    {isLoading || isSchoolInfoLoading ? (
                        <div className="flex items-center justify-center h-full">লোড হচ্ছে...</div>
                    ) : (
                        <div className="flex flex-col h-full w-full">
                             <header className="flex items-center gap-4 border-b-2 border-black pb-1 printable-header">
                                {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="School Logo" width={50} height={50} className="object-contain" />}
                                <div className="text-center flex-grow">
                                    <h1 className="text-2xl font-black">{schoolInfo.name}</h1>
                                    <p className="text-xs font-bold">{schoolInfo.address}</p>
                                    <h2 className="text-lg font-extrabold mt-1 underline">
                                        ক্লাস রুটিন - {selectedYear.toLocaleString('bn-BD')}
                                    </h2>
                                </div>
                                <div className="w-[50px]"></div>
                            </header>
                            <div className="flex-1 w-full overflow-hidden mt-1">
                                <CombinedRoutineTable 
                                    routineData={routineData}
                                    conflicts={conflicts}
                                    isEditMode={false}
                                    onCellChange={() => {}}
                                    teacherColorMap={teacherColorMap}
                                    isMounted={isMounted}
                                />
                            </div>
                            <footer className="mt-4 pt-4 flex justify-between text-[10px] font-bold print-footer">
                                <div className="text-center w-40 border-t border-black pt-1">রুটিন কমিটির স্বাক্ষর</div>
                                <div className="text-center w-40 border-t border-black pt-1">প্রধান শিক্ষকের স্বাক্ষর</div>
                            </footer>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}
