'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { Copy, Printer, FilePen, FilePlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { subjectNameNormalization as baseSubjectNameNormalization, getSubjects } from '@/lib/subjects';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';

const subjectNameNormalization: { [key: string]: string } = {
    ...baseSubjectNameNormalization,
    'শারীরিক': 'শারীরিক শিক্ষা',
    'শারীরিক শিক্ষা': 'শারীরিক শিক্ষা',
    'ধর্ম': 'ধর্ম ও নৈতিক শিক্ষা',
    'বাও বি': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'বিজ্ঞান': 'সাধারণ বিজ্ঞান',
    'ইতিহাস': 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা',
    'ভূগোল': 'ভূগোল ও পরিবেশ',
    'পৌরনীতি': 'পৌরনীতি ও নাগরিকতা',
    'পৌর': 'পৌরনীতি ও নাগরিকতা',
    'উচ্চতর গণিত': 'উচ্চতর গণিত',
    'উচ্চতর': 'উচ্চতর গণিত',
    'জীব': 'জীব বিজ্ঞান',
    'কৃষি': 'কৃষি শিক্ষা',
};

const teacherAllocations: Record<string, Record<string, string[]>> = {
    'আনিছুর': { 'বাংলাদেশ ও বিশ্ব পরিচয়': ['7', '8', '9', '10'], 'ধর্ম ও নৈতিক শিক্ষা': ['6', '7'] },
    'নীলা': { 'ধর্ম ও নৈতিক শিক্ষা': ['6', '7', '8', '9', '10'], 'শারীরিক শিক্ষা': ['8'] },
    'জান্নাতুন': { 'বাংলাদেশ ও বিশ্ব পরিচয়': ['6'], 'কৃষি শিক্ষা': ['6', '8'], 'পৌরনীতি ও নাগরিকতা': ['9', '10'], 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা': ['9', '10'] },
    'যুধিষ্ঠির': { 'বাংলা দ্বিতীয়': ['6', '7', '8', '9', '10'], 'ইংরেজি দ্বিতীয়': ['6', '7'] },
    'ধনঞ্জয়': { 'গণিত': ['6', '7', '8', '9', '10'], 'রসায়ন': ['9', '10'], 'পদার্থ': ['9', '10'], 'উচ্চতর গণিত': ['9'] },
    'আরিফুর': { 'ইংরেজি প্রথম': ['6', '7', '8', '9', '10'], 'ইংরেজি দ্বিতীয়': ['8', '9', '10'] },
    'ওবায়দা': { 'বাংলা প্রথম': ['6', '7', '8', '9', '10'], 'শারীরিক শিক্ষা': ['7'] },
    'শারমিন': { 'তথ্য ও যোগাযোগ প্রযুক্তি': ['6', '7', '8', '9', '10'], 'ভূগোল ও পরিবেশ': ['9', '10'] },
    'শান্তি': { 'সাধারণ বিজ্ঞান': ['6', '7', '8', '9', '10'], 'জীব বিজ্ঞান': ['9', '10'] },
    'মাহাবুব': { 'কৃষি শিক্ষা': ['7', '9', '10'], 'ধর্ম ও নৈতিক শিক্ষা': ['8', '9', '10'], 'শারীরিক শিক্ষা': ['6'] }
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
        
        const teacherStats: { [teacher: string]: { total: number, sixthPeriods: { [day: string]: string[] }, daily: { [day: string]: { classes: string[], before: number, after: number }} } } = {};
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
                sixthPeriods: { 'রবিবার': [], 'সোমবার': [], 'মঙ্গলবার': [], 'বুধবার': [], 'বৃহস্পতিবার': [] },
                daily: { 
                    'রবিবার': { classes: [], before: 0, after: 0 }, 
                    'সোমবার': { classes: [], before: 0, after: 0 }, 
                    'মঙ্গলবার': { classes: [], before: 0, after: 0 }, 
                    'বুধবার': { classes: [], before: 0, after: 0 }, 
                    'বৃহস্পতিবার': { classes: [], before: 0, after: 0 } 
                } 
            };
        });
        
        const sortedTeachers = Array.from(allIndividualTeachers).sort();
        const teacherColorMap = new Map<string, string>();
        sortedTeachers.forEach((teacher, index) => {
            teacherColorMap.set(teacher, colorPalette[index % colorPalette.length]);
        });
        
        days.forEach(day => {
            for (let periodIdx = 0; periodIdx < periodsCount; periodIdx++) {
                const periodTeachers = new Map<string, string>();
                classes.forEach(cls => {
                    const cell = routine[cls]?.[day]?.[periodIdx];
                    if (cell) {
                        const { teacher } = parseSubjectTeacher(cell);
                        if (teacher) {
                            teacher.split('/').forEach(t => {
                                const trimmedTeacher = t.trim();
                                if (!trimmedTeacher) return;
                                if (periodTeachers.has(trimmedTeacher)) {
                                    teacherClashes.add(`${cls}-${day}-${periodIdx}`);
                                    const existingCls = periodTeachers.get(trimmedTeacher)!;
                                    teacherClashes.add(`${existingCls}-${day}-${periodIdx}`);
                                } else {
                                    periodTeachers.set(trimmedTeacher, cls);
                                }
                            })
                        }
                    }
                });
            }
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
                        
                        const subjectsInCell = subject.split('/').map(s => s.trim()).filter(Boolean);
                        
                        subjectsInCell.forEach(s => {
                            const normalizedSubject = subjectNameNormalization[s] || s;
                            const subjectInfo = subjectsInClass.find(sub => sub.name === normalizedSubject || sub.name === s);
                            if (subjectInfo) {
                                if (!classStats[cls][subjectInfo.name]) classStats[cls][subjectInfo.name] = 0;
                                classStats[cls][subjectInfo.name] += 1;
                            }
                        });


                        if(subject) {
                             subjectsInCell.forEach(s => {
                                if (!subjectCountInDay.has(s)) {
                                   subjectCountInDay.set(s, []);
                                }
                                subjectCountInDay.get(s)!.push(periodIdx);
                             });
                        }
                        if (teacher) {
                            teacher.split('/').forEach(t => {
                                const trimmedTeacher = t.trim();
                                if (!trimmedTeacher || !teacherStats[trimmedTeacher]) return;
                                
                                teacherStats[trimmedTeacher].total++;
                                teacherStats[trimmedTeacher].daily[day].classes.push(`${subject} (${cls} শ্রেণি)`);
                                 if (periodIdx === 5) {
                                    teacherStats[trimmedTeacher].sixthPeriods[day].push(`${subject} (${cls} শ্রেণি)`);
                                }
                                if (periodIdx < 3) {
                                    teacherStats[trimmedTeacher].daily[day].before++;
                                } else {
                                    teacherStats[trimmedTeacher].daily[day].after++;
                                }
                            });
                        }
                        
                        if (subject && teacher) {
                            const teachersInCell = teacher.split('/').map(t => t.trim()).filter(Boolean);
                            const subjectsInCellNormalized = subject.split('/').map(s => subjectNameNormalization[s.trim()] || s.trim()).filter(Boolean);
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
                        if (indices.length > 1) {
                           const subjectInfo = subjectsInClass.find(s => s.name === subjectName);
                           if (subjectInfo && subjectInfo.name !== 'বাংলা প্রথম' && subjectInfo.name !== 'বাংলা দ্বিতীয়' && subjectInfo.name !== 'ইংরেজি প্রথম' && subjectInfo.name !== 'ইংরেজি দ্বিতীয়') {
                                indices.forEach(idx => subjectRepetitionClashes.add(`${cls}-${day}-${idx}`));
                           }
                        }
                    });

                    const consecutivePairs = [[0, 1], [1, 2], [3, 4], [4, 5]];
                    consecutivePairs.forEach(([p1, p2]) => {
                        const teacher1 = parseSubjectTeacher(dayRoutine[p1]).teacher;
                        const teacher2 = parseSubjectTeacher(dayRoutine[p2]).teacher;
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

                    const teacherBeforeBreak = parseSubjectTeacher(dayRoutine[2]).teacher;
                    const teacherAfterBreak = parseSubjectTeacher(dayRoutine[3]).teacher;
                    if (teacherBeforeBreak && teacherAfterBreak) {
                        const teachersBefore = teacherBeforeBreak.split('/').map(t => t.trim()).filter(Boolean);
                        const teachersAfter = teacherAfterBreak.split('/').map(t => t.trim()).filter(Boolean);
                        const hasOverlap = teachersBefore.some(t => teachersAfter.includes(t));
                         if (hasOverlap) {
                            breakClashes.add(`${cls}-${day}-2`);
                            breakClashes.add(`${cls}-${day}-3`);
                        }
                    }
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

    return (
        <Accordion type="multiple" className="w-full space-y-4">
            <AccordionItem value="teacher-stats">
                <AccordionTrigger className="text-lg font-semibold">শিক্ষকভিত্তিক পরিসংখ্যান</AccordionTrigger>
                <AccordionContent>
                    <div className="overflow-x-auto border rounded-lg">
                        <Table className="border-collapse border">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="border">ক্রমিক</TableHead>
                                    <TableHead className="border">শিক্ষকের নাম</TableHead>
                                    <TableHead className="border">মোট ক্লাস</TableHead>
                                    <TableHead className="border">৬ষ্ঠ পিরিয়ডে</TableHead>
                                    <TableHead className="border">দিনভিত্তিক ক্লাস (বিরতির আগে, পরে)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {teachers.map((teacher, index) => (
                                    <TableRow key={teacher} className="border">
                                        <TableCell className="border text-center">{(index + 1).toLocaleString('bn-BD')}</TableCell>
                                        <TableCell className="font-medium border">{teacher}</TableCell>
                                        <TableCell className="border text-center">{teacherStats[teacher].total.toLocaleString('bn-BD')}</TableCell>
                                        <TableCell className="border">
                                            <ul className="list-none p-0 m-0 text-xs">
                                                {Object.entries(teacherStats[teacher].sixthPeriods)
                                                    .filter(([, classes]) => (classes as string[]).length > 0)
                                                    .map(([day]) => (
                                                        <li key={day}>{day}</li>
                                                ))}
                                            </ul>
                                        </TableCell>
                                        <TableCell className="border">
                                            <ul className="list-disc list-inside text-xs space-y-1">
                                                {Object.entries(teacherStats[teacher].daily).map(([day, dayStats]) => {
                                                    return (dayStats as any).classes.length > 0 && (
                                                        <li key={day}>
                                                            <strong>{day}:</strong> {(dayStats as any).classes.length.toLocaleString('bn-BD')}টি 
                                                            ({`আগে: ${(dayStats as any).before.toLocaleString('bn-BD')}, `}
                                                            {`পরে: ${(dayStats as any).after.toLocaleString('bn-BD')}`})
                                                        </li>
                                                    )
                                                })}
                                            </ul>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </AccordionContent>
            </AccordionItem>
            <AccordionItem value="class-stats">
                <AccordionTrigger className="text-lg font-semibold">শ্রেণিভিত্তিক পরিসংখ্যান</AccordionTrigger>
                <AccordionContent>
                     <div className="overflow-x-auto border rounded-lg">
                        <Table className="border-collapse border">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="border">শ্রেণি</TableHead>
                                    <TableHead className="border">ক্রমিক</TableHead>
                                    <TableHead className="border">বিষয়</TableHead>
                                    <TableHead className="border">সাপ্তাহিক ক্লাস সংখ্যা</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {classes.map(cls => {
                                    const subjectsToExcludeForCommerce = ['ব্যবসায় উদ্যোগ', 'হিসাব বিজ্ঞান', 'ফিন্যান্স ও ব্যাংকিং'];
                                    const subjectsForClass = getSubjects(cls, undefined)
                                        .filter(subject => !subjectsToExcludeForCommerce.includes(subject.name))
                                        .sort((a,b) => parseInt(a.code) - parseInt(b.code));
                                    
                                    if(subjectsForClass.length === 0) return null;
                                    
                                    const rows = subjectsForClass.map((subject, subjectIndex) => {
                                        const count = classStats[cls]?.[subject.name] || 0;
                                        return (
                                            <TableRow key={`${cls}-${subject.name}`} className="border">
                                                {subjectIndex === 0 && <TableCell rowSpan={subjectsForClass.length} className="font-medium align-top border text-center">{classNamesMap[cls]}</TableCell>}
                                                <TableCell className="border text-center">{(subjectIndex + 1).toLocaleString('bn-BD')}</TableCell>
                                                <TableCell className="border">{subject.name}</TableCell>
                                                <TableCell className="border text-center">{count.toLocaleString('bn-BD')}</TableCell>
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
    const periods = [ { name: "১ম", time: "১০:৩০ - ১১:২০" }, { name: "২য়", time: "১১:২০ - ১২:১০" }, { name: "৩য়", time: "১২:১০ - ০১:০০" } ];
    const postBreakPeriods = [ { name: "৪র্থ", time: "০১:৪০ - ০২:৩০" }, { name: "৫ম", time: "০২:৩০ - ০৩:২০" }, { name: "৬ষ্ঠ", time: "০৩:২০ - ০৪:১০" } ];
    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

    const routineForClass = routineData[className] || {};

    return (
        <Card>
            <CardHeader>
                <CardTitle>ক্লাস রুটিন (শ্রেণি - {classNamesMap[className] || className})</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table className="border">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="border-r font-bold align-middle text-center">বার</TableHead>
                                {periods.map(p => <TableHead key={p.name} className="border-r text-center font-semibold">{p.name} পিরিয়ড<br/><span className="font-normal text-xs">{p.time}</span></TableHead>)}
                                <TableHead className="border-r text-center font-semibold bg-gray-100">বিরতি<br/><span className="font-normal text-xs">০১:০০ - ০১:৪০</span></TableHead>
                                {postBreakPeriods.map(p => <TableHead key={p.name} className="border-r text-center font-semibold">{p.name} পিরিয়ড<br/><span className="font-normal text-xs">{p.time}</span></TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {days.map(day => (
                                <TableRow key={day}>
                                    <TableCell className="font-semibold border-r">{day}</TableCell>
                                    {[...Array(3)].map((_, periodIdx) => {
                                        const cellContent = (routineForClass[day] || [])[periodIdx] || '';
                                        return <EditableCell key={`${day}-${periodIdx}`} content={cellContent} isEditMode={isEditMode} onCellChange={(value) => onCellChange(className, day, periodIdx, value)} conflictKey={`${className}-${day}-${periodIdx}`} conflicts={conflicts} teacherColorMap={teacherColorMap} isMounted={isMounted} />;
                                    })}
                                    <TableCell className="border-r text-center bg-muted font-semibold">টিফিন</TableCell>
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
    const periods = [ { name: "১ম", time: "১০:৩০ - ১১:২০" }, { name: "২য়", time: "১১:২০ - ১২:১০" }, { name: "৩য়", time: "১২:১০ - ০১:০০" } ];
    const postBreakPeriods = [ { name: "৪র্থ", time: "০১:৪০ - ০২:৩০" }, { name: "৫ম", time: "০২:৩০ - ০৩:২০" }, { name: "৬ষ্ঠ", time: "০৩:২০ - ০৪:১০" } ];
    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

    return (
        <div className="overflow-x-auto">
           <Table className="border">
                <TableHeader>
                   <TableRow>
                       <TableHead className="border-r font-bold align-middle text-center min-w-[100px]">বার</TableHead>
                       <TableHead className="border-r font-bold align-middle text-center min-w-[80px]">শ্রেণি</TableHead>
                       {periods.map(p => <TableHead key={p.name} className="border-r text-center font-semibold min-w-[150px]">{p.name} পিরিয়ড<br/><span className="font-normal text-xs">{p.time}</span></TableHead>)}
                       <TableHead className="border-r text-center font-semibold bg-gray-100 min-w-[100px]">বিরতি<br/><span className="font-normal text-xs">০১:০০ - ০১:৪০</span></TableHead>
                       {postBreakPeriods.map(p => <TableHead key={p.name} className="border-r text-center font-semibold min-w-[150px]">{p.name} পিরিয়ড<br/><span className="font-normal text-xs">{p.time}</span></TableHead>)}
                   </TableRow>
               </TableHeader>
               <TableBody>
                   {days.map((day) => (
                       classes.map((cls, classIndex) => (
                           <TableRow key={`${day}-${cls}`}>
                               {classIndex === 0 && (
                                    <TableCell className="font-semibold border-r align-middle text-center" rowSpan={classes.length}>{day}</TableCell>
                               )}
                               <TableCell className="font-semibold border-r text-center">{classNamesMap[cls]}</TableCell>
                               {[...Array(3)].map((_, periodIdx) => {
                                   const cellContent = (routineData[cls]?.[day] || [])[periodIdx] || '';
                                   return <EditableCell key={`${day}-${cls}-${periodIdx}`} content={cellContent} isEditMode={isEditMode} onCellChange={(value) => onCellChange(cls, day, periodIdx, value)} conflictKey={`${cls}-${day}-${periodIdx}`} conflicts={conflicts} teacherColorMap={teacherColorMap} isMounted={isMounted} />;
                               })}
                               <TableCell className="border-r text-center bg-muted font-semibold">টিফিন</TableCell>
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
            className={cn("w-full h-full p-1 text-xs border-transparent rounded-none focus:bg-amber-100 text-center", { "bg-red-100": isConflict })}
        />
    ) : (
        <div className="p-2 text-xs text-center">{content || <>&nbsp;</>}</div>
    );

    if (!isMounted || !isConflict) {
        return (
            <TableCell 
                className={cn("border-r p-0", { "bg-red-100 text-red-700": isConflict && !isEditMode })}
                style={!isEditMode && !isConflict && color ? { backgroundColor: color } : {}}
            >
                {cellContent}
            </TableCell>
        );
    }
    
    return (
        <TableCell className="border-r p-0">
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
             <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg items-end no-print">
                <div className="space-y-2 flex-1">
                    <Label htmlFor="class-name">শ্রেণি</Label>
                    <Select value={className} onValueChange={setClassName}>
                        <SelectTrigger id="class-name"><SelectValue placeholder="শ্রেণি নির্বাচন করুন" /></SelectTrigger>
                        <SelectContent>
                           <SelectItem value="all">সকল শ্রেণি</SelectItem>
                           <SelectItem value="6">৬ষ্ঠ</SelectItem>
                           <SelectItem value="7">৭ম</SelectItem>
                           <SelectItem value="8">৮ম</SelectItem>
                           <SelectItem value="9">৯ম</SelectItem>
                           <SelectItem value="10">১০ম</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            {className === 'all' ? (
                 <Card>
                    <CardHeader className="no-print">
                        <CardTitle>সকল শ্রেণির সম্মিলিত ক্লাস রুটিন</CardTitle>
                    </CardHeader>
                    <CardContent>
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
        </div>
    );
};

const ExamRoutineTab = () => {
    const [examName, setExamName] = useState('');

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg">
                <div className="space-y-2 flex-1">
                    <Label htmlFor="exam-name">পরীক্ষা</Label>
                    <Select value={examName} onValueChange={setExamName}>
                        <SelectTrigger id="exam-name"><SelectValue placeholder="পরীক্ষা নির্বাচন করুন" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="half-yearly">অর্ধ-বার্ষিক পরীক্ষা</SelectItem>
                            <SelectItem value="annual">বার্ষিক পরীক্ষা</SelectItem>
                            <SelectItem value="pre-test">প্রাক-নির্বাচনী পরীক্ষা</SelectItem>
                            <SelectItem value="test">নির্বাচনী পরীক্ষা</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="flex items-end">
                     <Button>রুটিন দেখুন</Button>
                </div>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>পরীক্ষার রুটিন</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground p-8">
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

    const handlePrint = () => {
        window.print();
    };

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
            // The error is handled by the saveRoutinesBatch function's catch block
            toast({ variant: 'destructive', title: 'রুটিন কপি করা যায়নি।' });
        }
    };

    return (
        <>
            <div className="flex min-h-screen w-full flex-col bg-fuchsia-100 no-print">
                <Header />
                <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                <div>
                                    <CardTitle>রুটিন</CardTitle>
                                    {isClient ? (
                                        <p className="text-sm text-muted-foreground">শিক্ষাবর্ষ: {selectedYear.toLocaleString('bn-BD')}</p>
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
                                                    <Button onClick={handleSaveChanges}>পরিবর্তন সেভ করুন</Button>
                                                </>
                                            ) : (
                                                <>
                                                     <Button variant="outline" onClick={handlePrint} className="no-print">
                                                        <Printer className="mr-2 h-4 w-4" /> রুটিন প্রিন্ট করুন
                                                    </Button>
                                                    {canManageRoutines && (
                                                        <>
                                                        <AlertDialog open={isCopyDialogOpen} onOpenChange={setIsCopyDialogOpen}>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="outline" className="no-print">
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
                                                                <Button variant="outline">
                                                                    <FilePlus className="mr-2 h-4 w-4" /> ফাঁকা রুটিন তৈরি করুন
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
                                                        <Button variant="outline" onClick={() => setIsEditMode(true)}><FilePen className="mr-2 h-4 w-4" /> রুটিন এডিট করুন</Button>
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
                        <CardContent>
                            {isClient && !isLoading ? (
                                <Tabs defaultValue="class-routine">
                                    <TabsList className="grid w-full grid-cols-3">
                                        <TabsTrigger value="class-routine">ক্লাস রুটিন</TabsTrigger>
                                        <TabsTrigger value="exam-routine">পরীক্ষার রুটিন</TabsTrigger>
                                        <TabsTrigger value="statistics">পরিসংখ্যান</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="class-routine" className="mt-4">
                                        <ClassRoutineTab routineData={routineData} conflicts={conflicts} isEditMode={isEditMode && canManageRoutines} onCellChange={handleCellChange} teacherColorMap={teacherColorMap!} isMounted={isMounted} />
                                    </TabsContent>
                                    <TabsContent value="exam-routine" className="mt-4">
                                        <ExamRoutineTab />
                                    </TabsContent>
                                    <TabsContent value="statistics" className="mt-4">
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
                 <div className="printable-area routine-print-container">
                    {isLoading || isSchoolInfoLoading ? (
                        <div className="flex items-center justify-center h-full">লোড হচ্ছে...</div>
                    ) : (
                        <>
                             <header className="flex items-center gap-4 mb-2">
                                {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="School Logo" width={50} height={50} className="object-contain" />}
                                <div className="text-center flex-grow">
                                    <h1 className="text-xl font-bold">{schoolInfo.name}</h1>
                                    <p className="text-[10px]">{schoolInfo.address}</p>
                                    <h2 className="text-base font-semibold mt-1">
                                        ক্লাস রুটিন - {selectedYear.toLocaleString('bn-BD')}
                                    </h2>
                                </div>
                                <div className="w-[50px]"></div> {/* Spacer */}
                            </header>
                            <CombinedRoutineTable 
                                routineData={routineData}
                                conflicts={conflicts}
                                isEditMode={false}
                                onCellChange={() => {}}
                                teacherColorMap={teacherColorMap}
                                isMounted={isMounted}
                            />
                        </>
                    )}
                </div>
            )}
        </>
    );
}
