'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from "@/hooks/use-toast";
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Student, NewStudentData, addStudent, studentFromDoc } from '@/lib/student-data';
import { getSubjects, Subject as SubjectType } from '@/lib/subjects';
import { saveClassResults, getResultsForClass, getAllResults, deleteClassResult, ClassResult, StudentResult } from '@/lib/results-data';
import { processStudentResults, StudentProcessedResult } from '@/lib/results-calculation';
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, FileUp, Download, FilePen, BookOpen } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, orderBy, FirestoreError, getDocs } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';


type Marks = {
    written?: number;
    mcq?: number;
    practical?: number;
}

const MarkManagementTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user, hasPermission } = useAuth();
    const canManageResults = hasPermission('manage:results');
    
    const [className, setClassName] = useState('');
    const [group, setGroup] = useState('');
    const [subject, setSubject] = useState('');
    const [fullMarks, setFullMarks] = useState<number | undefined>(100);
    
    const [availableSubjects, setAvailableSubjects] = useState<SubjectType[]>([]);
    const [selectedSubjectInfo, setSelectedSubjectInfo] = useState<SubjectType | null>(null);

    const [studentsForClass, setStudentsForClass] = useState<Student[]>([]);
    const [marks, setMarks] = useState<Map<string, Marks>>(new Map());
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);

    const [savedResults, setSavedResults] = useState<ClassResult[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };
    const groupMap: { [key: string]: string } = { 'science': 'বিজ্ঞান', 'arts': 'মানবিক', 'commerce': 'ব্যবসায় শিক্ষা', 'সাধারণ': 'সাধারণ' };

    const updateSavedResults = useCallback(async () => {
        if (!db || !user) return;
        const allResults = await getAllResults(db, selectedYear);
        setSavedResults(allResults);
    }, [db, selectedYear, user]);
    
    useEffect(() => {
        updateSavedResults();
    }, [updateSavedResults]);

    const groupedResults = useMemo(() => {
        if (savedResults.length === 0) return {};

        const groups: { [key: string]: ClassResult[] } = {};
        savedResults.forEach(res => {
            const key = res.className;
            if (!groups[key]) {
                groups[key] = [];
            }
            groups[key].push(res);
        });

        const subjectOrder = [
            'বাংলা প্রথম', 'বাংলা দ্বিতীয়', 'ইংরেজি প্রথম', 'ইংরেজি দ্বিতীয়', 'গণিত', 'ধর্ম ও নৈতিক শিক্ষা',
            'তথ্য ও যোগাযোগ প্রযুক্তি', 'সাধারণ বিজ্ঞান', 'বিজ্ঞান', 'বাংলাদেশ ও বিশ্ব পরিচয়', 'কৃষি শিক্ষা',
            'পদার্থ', 'রসায়ন', 'জীব বিজ্ঞান', 'উচ্চতর গণিত', 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা',
            'ভূগোল ও পরিবেশ', 'পৌরনীতি ও নাগরিকতা', 'ব্যবসায় উদ্যোগ', 'হিসাব বিজ্ঞান', 'ফিন্যান্স ও ব্যাংকিং'
        ];

        for (const key in groups) {
            groups[key].sort((a, b) => {
                const groupA = a.group || '';
                const groupB = b.group || '';
                if (groupA !== groupB) {
                    return groupA.localeCompare(groupB, 'bn');
                }
                
                const indexA = subjectOrder.indexOf(a.subject);
                const indexB = subjectOrder.indexOf(b.subject);

                if (indexA !== -1 && indexB !== -1) {
                    return indexA - indexB;
                }
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;

                return a.subject.localeCompare(b.subject, 'bn');
            });
        }
        return groups;
    }, [savedResults]);

    const sortedClassKeys = useMemo(() => {
        return Object.keys(groupedResults).sort((a, b) => parseInt(a) - parseInt(b));
    }, [groupedResults]);

    const showGroupSelector = useMemo(() => className === '9' || className === '10', [className]);

    useEffect(() => {
        const newSubjects = getSubjects(className, group).filter(s => s.isExamSubject !== false);
        setAvailableSubjects(newSubjects);
        if (subject && !newSubjects.some(s => s.name === subject)) {
            setSubject('');
            setSelectedSubjectInfo(null);
        }
    }, [className, group, subject]);

    useEffect(() => {
        if (subject) {
            const subInfo = availableSubjects.find(s => s.name === subject);
            setSelectedSubjectInfo(subInfo || null);
            if (subInfo && studentsForClass.length === 0) {
                setFullMarks(subInfo.fullMarks);
            }
        } else {
            setSelectedSubjectInfo(null);
        }
    }, [subject, availableSubjects, studentsForClass.length]);
    
    const handleLoadStudents = async () => {
        if (!className || !subject || !db || !user) {
            toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ' });
            return;
        }

        setIsLoadingStudents(true);
        const filteredStudents = allStudents.filter(s => 
            s.academicYear === selectedYear && 
            s.className === className &&
            (!showGroupSelector || !group || s.group === group)
        ).sort((a,b) => a.roll - b.roll);
        setStudentsForClass(filteredStudents);

        const existingResults = await getResultsForClass(db, selectedYear, className, subject, group);
        const initialMarks = new Map<string, Marks>();

        if (existingResults) {
            setFullMarks(existingResults.fullMarks);
            existingResults.results.forEach(res => {
                initialMarks.set(res.studentId, {
                    written: res.written,
                    mcq: res.mcq,
                    practical: res.practical
                });
            });
        } else {
            const subInfo = availableSubjects.find(s => s.name === subject);
            setFullMarks(subInfo?.fullMarks || 100);
        }
        
        filteredStudents.forEach(student => {
            if (!initialMarks.has(student.id)) {
                initialMarks.set(student.id, { written: undefined, mcq: undefined, practical: undefined });
            }
        });

        setMarks(initialMarks);
        setIsLoadingStudents(false);
    };

    const handleMarkChange = (studentId: string, field: keyof Marks, value: string) => {
        const numValue = value === '' ? undefined : parseInt(value, 10);
        const newMarks = new Map(marks);
        const studentMarks = newMarks.get(studentId) || {};
        studentMarks[field] = isNaN(numValue!) ? undefined : numValue;
        newMarks.set(studentId, studentMarks);
        setMarks(newMarks);
    };

    const handleSaveResults = () => {
        if (!db || !user) return;
        if (studentsForClass.length === 0) {
            toast({ variant: 'destructive', title: 'কোনো শিক্ষার্থী নেই' });
            return;
        }

        const resultsData: StudentResult[] = Array.from(marks.entries()).map(([studentId, marks]) => ({
            studentId,
            ...marks
        }));

        saveClassResults(db, {
            academicYear: selectedYear,
            className,
            group: group || undefined,
            subject,
            fullMarks: fullMarks || selectedSubjectInfo?.fullMarks || 100,
            results: resultsData
        }).then(() => {
            updateSavedResults();
            toast({ title: 'ফলাফল সেভ হয়েছে' });
        }).catch(() => {
            // Error handled by listener
        });
    };

    const handleDeleteResult = (result: ClassResult) => {
        if (!db || !result.id || !user) return;
        deleteClassResult(db, result.id).then(() => {
            updateSavedResults();
            toast({ title: 'ফলাফল মোছা হয়েছে' });
        }).catch(() => {
            // Error handled by listener
        });
    }

    const handleEditClick = (resultToEdit: ClassResult) => {
        setClassName(resultToEdit.className);
        setGroup(resultToEdit.group || '');
        setFullMarks(resultToEdit.fullMarks);
        setTimeout(() => {
            setSubject(resultToEdit.subject);
            setStudentsForClass([]);
            setMarks(new Map());
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }, 0);
    };

    const handleDownloadSample = () => {
       const headers = [
            ['রোল', 'লিখিত', 'বহুনির্বাচনী', 'ব্যবহারিক']
        ];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'নম্বর নমুনা');
        XLSX.writeFile(wb, 'marks_sample.xlsx');
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!db || !user || !className || !subject) {
            toast({
                variant: "destructive",
                title: "প্রথমে শ্রেণি ও বিষয় নির্বাচন করুন",
            });
            return;
        }

        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                if (json.length === 0) {
                    toast({ variant: "destructive", title: "ফাইল খালি" });
                    return;
                }
                
                if (studentsForClass.length === 0) {
                    toast({ variant: "destructive", title: "শিক্ষার্থী লোড করা হয়নি" });
                    return;
                }

                const headerMapping: { [key: string]: keyof Marks } = {
                    'written': 'written', 'লিখিত': 'written',
                    'mcq': 'mcq', 'বহুনির্বাচনী': 'mcq',
                    'practical': 'practical', 'ব্যবহারিক': 'practical',
                };
                
                const bengaliToEnglishDigit: { [key: string]: string } = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
                const convertToNumber = (value: any): number | undefined => {
                    if (value === undefined || value === null || String(value).trim() === '') return undefined;
                    let strValue = String(value).trim();
                    strValue = strValue.replace(/[০-৯]/g, d => bengaliToEnglishDigit[d]);
                    const num = parseInt(strValue, 10);
                    return isNaN(num) ? undefined : num;
                };

                const newMarks = new Map(marks);
                let updatedCount = 0;
                const processingErrors: string[] = [];

                for (const [index, row] of json.entries()) {
                    const rollValue = (Object.keys(row as any).find(k => k.toLowerCase() === 'roll' || k === 'রোল') as any);
                    const roll = convertToNumber((row as any)[rollValue]);

                    if (roll === undefined) {
                        processingErrors.push(`সারি ${index + 2}: রোল নম্বর পাওয়া যায়নি।`);
                        continue;
                    }

                    const student = studentsForClass.find(s => s.roll === roll);
                    if (!student) {
                        processingErrors.push(`সারি ${index + 2}: রোল ${roll} এর জন্য কোনো শিক্ষার্থী পাওয়া যায়নি।`);
                        continue;
                    }

                    const studentMarks = newMarks.get(student.id) || {};
                    let rowUpdated = false;

                    for (const excelHeader of Object.keys(row as any)) {
                        const markKey = headerMapping[excelHeader.trim().toLowerCase()];
                        if (markKey) {
                            const markValue = convertToNumber((row as any)[excelHeader]);
                            if (markValue !== undefined) {
                                studentMarks[markKey] = markValue;
                                rowUpdated = true;
                            }
                        }
                    }
                    
                    if (rowUpdated) {
                        newMarks.set(student.id, studentMarks);
                        updatedCount++;
                    }
                }

                if (processingErrors.length > 0) {
                    throw new Error(processingErrors.join('\n'));
                }

                setMarks(newMarks);

                toast({
                    title: "নম্বর লোড হয়েছে",
                    description: `${updatedCount} জন শিক্ষার্থীর নম্বর Excel ফাইল থেকে লোড করা হয়েছে। পরিবর্তনগুলো সেভ করতে 'ফলাফল সেভ করুন' বাটনে ক্লিক করুন।`,
                });

            } catch (error: any) {
                console.error("File upload error:", error);
                toast({
                    variant: "destructive",
                    title: "ফাইল আপলোড ব্যর্থ হয়েছে",
                    description: error.message || "দয়া করে ফাইলের ফরম্যাট এবং আবশ্যকীয় তথ্য ঠিক আছে কিনা তা পরীক্ষা করুন।",
                    duration: 10000,
                });
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end p-4 border rounded-lg">
                <div className="space-y-2">
                    <Label htmlFor="class">শ্রেণি</Label>
                    <Select value={className} onValueChange={(value) => { setClassName(value); setGroup(''); setSubject(''); }}>
                        <SelectTrigger id="class"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="6">৬ষ্ঠ</SelectItem>
                            <SelectItem value="7">৭ম</SelectItem>
                            <SelectItem value="8">৮ম</SelectItem>
                            <SelectItem value="9">৯ম</SelectItem>
                            <SelectItem value="10">১০ম</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {showGroupSelector && (
                    <div className="space-y-2">
                        <Label htmlFor="group">গ্রুপ</Label>
                        <Select value={group} onValueChange={setGroup} required>
                            <SelectTrigger id="group"><SelectValue placeholder="গ্রুপ নির্বাচন করুন" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="science">বিজ্ঞান</SelectItem>
                                <SelectItem value="arts">মানবিক</SelectItem>
                                <SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
                
                <div className="space-y-2 lg:col-start-3">
                    <Label htmlFor="subject">বিষয়</Label>
                    <Select value={subject} onValueChange={setSubject} disabled={!className || (showGroupSelector && !group)}>
                        <SelectTrigger id="subject"><SelectValue placeholder="বিষয় নির্বাচন" /></SelectTrigger>
                        <SelectContent>
                            {availableSubjects.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="full-marks">পূর্ণমান</Label>
                    <Input 
                        id="full-marks" 
                        type="number" 
                        value={fullMarks || ''}
                        onChange={(e) => setFullMarks(e.target.value === '' ? undefined : parseInt(e.target.value))} 
                    />
                </div>
                
                <Button onClick={handleLoadStudents} disabled={isLoadingStudents || !subject} className="w-full">
                    {isLoadingStudents ? 'লোড হচ্ছে...' : 'শিক্ষার্থী লোড করুন'}
                </Button>
            </div>
            
            {studentsForClass.length > 0 && (
                <div className="overflow-x-auto border rounded-md">
                    {canManageResults && (
                        <div className="flex justify-end p-2 gap-2">
                            <Button variant="outline" size="sm" onClick={handleDownloadSample}>
                                <Download className="mr-2 h-4 w-4" />
                                নমুনা
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                <FileUp className="mr-2 h-4 w-4" />
                                আপলোড
                            </Button>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                        </div>
                    )}
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>রোল</TableHead>
                                <TableHead>শিক্ষার্থীর নাম</TableHead>
                                <TableHead>লিখিত</TableHead>
                                <TableHead>বহুনির্বাচনী</TableHead>
                                {selectedSubjectInfo?.practical && <TableHead>ব্যবহারিক</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {studentsForClass.map(student => (
                                <TableRow key={student.id}>
                                    <TableCell>{student.roll.toLocaleString('bn-BD')}</TableCell>
                                    <TableCell>{student.studentNameBn}</TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={marks.get(student.id)?.written || ''}
                                            onChange={(e) => handleMarkChange(student.id, 'written', e.target.value)}
                                            className="w-24"
                                            disabled={!canManageResults}
                                        />
                                    </TableCell>
                                     <TableCell>
                                        <Input
                                            type="number"
                                            value={marks.get(student.id)?.mcq || ''}
                                            onChange={(e) => handleMarkChange(student.id, 'mcq', e.target.value)}
                                            className="w-24"
                                            disabled={!canManageResults}
                                        />
                                    </TableCell>
                                    {selectedSubjectInfo?.practical && (
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={marks.get(student.id)?.practical || ''}
                                                onChange={(e) => handleMarkChange(student.id, 'practical', e.target.value)}
                                                className="w-24"
                                                disabled={!canManageResults}
                                            />
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {canManageResults && (
                        <div className="flex justify-end p-4 mt-4 border-t">
                            <Button onClick={handleSaveResults}>ফলাফল সেভ করুন</Button>
                        </div>
                    )}
                </div>
            )}

            {canManageResults && savedResults.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2">সংরক্ষিত ফলাফল (শিক্ষাবর্ষ {selectedYear.toLocaleString('bn-BD')})</h3>
                    {savedResults.length === 0 ? (
                        <div className="border rounded-md text-center text-muted-foreground py-8">
                            এই শিক্ষাবর্ষে কোনো ফলাফল সেভ করা হয়নি।
                        </div>
                    ) : (
                        <Accordion type="multiple" className="w-full">
                            {sortedClassKeys.map(classNameKey => (
                                <AccordionItem value={classNameKey} key={classNameKey}>
                                    <AccordionTrigger>শ্রেণি {classNamesMap[classNameKey] || classNameKey}</AccordionTrigger>
                                    <AccordionContent>
                                        {(() => {
                                            const resultsByGroup: Record<string, ClassResult[]> = (groupedResults[classNameKey] || []).reduce((acc, res) => {
                                                const groupKey = res.group || 'সাধারণ';
                                                if (!acc[groupKey]) {
                                                    acc[groupKey] = [];
                                                }
                                                acc[groupKey].push(res);
                                                return acc;
                                            }, {} as Record<string, ClassResult[]>);

                                            return Object.entries(resultsByGroup).map(([groupKey, results]) => (
                                                <div key={groupKey} className="mb-6 last:mb-0">
                                                    {(classNameKey === '9' || classNameKey === '10') && (
                                                        <h4 className="font-semibold text-md mb-2 pl-1">{groupMap[groupKey] || 'সাধারণ শাখা'}</h4>
                                                    )}
                                                    <div className="border rounded-md overflow-x-auto">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>ক্রমিক নং</TableHead>
                                                                    <TableHead>বিষয়</TableHead>
                                                                    <TableHead>পূর্ণমান</TableHead>
                                                                    <TableHead className="text-right">কার্যক্রম</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {results.map((res, i) => (
                                                                    <TableRow key={`${res.id}-${i}`}>
                                                                        <TableCell>{(i + 1).toLocaleString('bn-BD')}</TableCell>
                                                                        <TableCell>{res.subject}</TableCell>
                                                                        <TableCell>{res.fullMarks.toLocaleString('bn-BD')}</TableCell>
                                                                        <TableCell className="text-right">
                                                                            <div className="flex justify-end gap-2">
                                                                                <Button variant="outline" size="icon" onClick={() => handleEditClick(res)}>
                                                                                    <FilePen className="h-4 w-4" />
                                                                                </Button>
                                                                                <AlertDialog>
                                                                                    <AlertDialogTrigger asChild>
                                                                                        <Button variant="destructive" size="icon">
                                                                                            <Trash2 className="h-4 w-4" />
                                                                                        </Button>
                                                                                    </AlertDialogTrigger>
                                                                                    <AlertDialogContent>
                                                                                        <AlertDialogHeader>
                                                                                            <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                                                                                            <AlertDialogDescription>
                                                                                                এই বিষয়ের ফলাফল স্থায়ীভাবে মুছে যাবে।
                                                                                            </AlertDialogDescription>
                                                                                        </AlertDialogHeader>
                                                                                        <AlertDialogFooter>
                                                                                            <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                                                                            <AlertDialogAction onClick={() => handleDeleteResult(res)}>
                                                                                                মুছে ফেলুন
                                                                                            </AlertDialogAction>
                                                                                        </AlertDialogFooter>
                                                                                    </AlertDialogContent>
                                                                                </AlertDialog>
                                                                            </div>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    )}
                </div>
            )}

        </div>
    );
};

const ResultSheetTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user, hasPermission } = useAuth();
    const canPromote = hasPermission('promote:students');
    
    const [className, setClassName] = useState('');
    const [group, setGroup] = useState('');
    
    const [processedResults, setProcessedResults] = useState<StudentProcessedResult[]>([]);
    const [subjects, setSubjects] = useState<SubjectType[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleViewResults = async () => {
        if (!className || !db || !user) {
            toast({
                variant: 'destructive',
                title: 'শ্রেণি নির্বাচন করুন',
            });
            return;
        }

        setIsLoading(true);

        const studentsInClass = allStudents.filter(s => 
            s.academicYear === selectedYear && 
            s.className === className &&
            (className < '9' || !group || s.group === group)
        ).sort((a,b) => a.roll - b.roll);

        if (studentsInClass.length === 0) {
            toast({ title: 'এই শ্রেণিতে কোনো শিক্ষার্থী নেই।'});
            setProcessedResults([]);
            setSubjects([]);
            setIsLoading(false);
            return;
        }

        const allSubjectsForGroup = getSubjects(className, group).filter(s => s.isExamSubject !== false);
        setSubjects(allSubjectsForGroup);
        
        const resultsBySubjectPromises = allSubjectsForGroup.map(subject => {
            return getResultsForClass(db, selectedYear, className, subject.name, group);
        });
        const resultsBySubject = (await Promise.all(resultsBySubjectPromises)).filter((result): result is ClassResult => result !== undefined);


        const finalResults = processStudentResults(allStudents.filter(s => s.academicYear === selectedYear && s.className === className && (className < '9' || !group || s.group === group)), resultsBySubject, allSubjectsForGroup);
        setProcessedResults(finalResults);

        setIsLoading(false);
    };

    const handlePromoteStudents = async () => {
        if (!db || !user) return;
        if (processedResults.length === 0) {
            toast({
                variant: 'destructive',
                title: 'কোনো ফলাফল নেই',
            });
            return;
        }    
    
        const nextYear = String(parseInt(selectedYear, 10) + 1);
        
        const studentsInNextYearSnapshot = await getDocs(query(collection(db, "students"), where("academicYear", "==", nextYear)));
        const studentsInNextYear = studentsInNextYearSnapshot.docs.map(doc => studentFromDoc(doc));
    
        const passedStudentsToPromote = processedResults
            .filter(r => r.isPass && r.student.className !== '10')
            .sort((a, b) => (a.meritPosition || 999) - (b.meritPosition || 999));
        
        const promotionPromises: Promise<any>[] = [];
        let promotedCount = 0;
        let skippedCount = 0;
    
        passedStudentsToPromote.forEach((result, index) => {
            const { id, createdAt, updatedAt, ...currentData } = result.student;

            const isDuplicate = studentsInNextYear.some(s => 
                s.studentNameBn === currentData.studentNameBn && 
                s.fatherNameBn === currentData.fatherNameBn
            );
            
            if (isDuplicate) {
                skippedCount++;
                return;
            }

            const nextClass = String(parseInt(result.student.className, 10) + 1);
            const newStudentData: NewStudentData = {
                ...currentData,
                academicYear: nextYear,
                className: nextClass,
                roll: index + 1, 
                group: (nextClass === '9' || nextClass === '10') ? currentData.group : '',
                optionalSubject: (nextClass === '9' || nextClass === '10') ? currentData.optionalSubject : '',
            };
    
            promotionPromises.push(addStudent(db, newStudentData));
            promotedCount++;
        });
        
        await Promise.all(promotionPromises);
    
        const graduatedCount = processedResults.filter(r => r.isPass && r.student.className === '10').length;
        const failedCount = processedResults.filter(r => !r.isPass).length;
    
        let description = `${promotedCount} জন শিক্ষার্থী পরবর্তী শ্রেণিতে (${nextYear}) উত্তীর্ণ হয়েছে।`;
        if(graduatedCount > 0) description += ` ${graduatedCount} জন গ্র্যাজুয়েট হয়েছে।`;
        if(failedCount > 0) description += ` ${failedCount} জন ফেল করেছে।`;
        if(skippedCount > 0) description += ` ${skippedCount} জনের রেকর্ড ডুপ্লিকেট হওয়ায় তাদের উত্তীর্ণ করা হয়নি।`;

        toast({
            title: 'শিক্ষার্থী উত্তীর্ণ করা সম্পন্ন',
            description,
            duration: 8000,
        });
    
        setProcessedResults([]); 
        setSubjects([]);
    };

    const showGroupSelector = className === '9' || className === '10';

    const renderMeritPosition = (position?: number) => {
        if (!position) return '-';
        const bnPosition = position.toLocaleString('bn-BD');
        if (position === 1) return `${bnPosition}ম`;
        if (position === 2) return `${bnPosition}য়`;
        if (position === 3) return `${bnPosition}য়`;
        if ([4, 5, 6, 7, 8, 9, 10].includes(position)) {
             if (position === 4) return `${bnPosition}র্থ`;
             if (position === 5) return `${bnPosition}ম`;
             if (position === 6) return `${bnPosition}ষ্ঠ`;
             if (position === 7) return `${bnPosition}ম`;
             if (position === 8) return `${bnPosition}ম`;
             if (position === 9) return `${bnPosition}ম`;
             if (position === 10) return `${bnPosition}ম`;
        }
        return `${bnPosition}তম`;
    }

    const tableHeaders = useMemo(() => {
        if (subjects.length === 0) return null;

        return (
            <TableHeader>
                <TableRow>
                    <TableHead rowSpan={2} className="align-middle text-center bg-background sticky left-0 z-10 md:min-w-[80px]">রোল</TableHead>
                    <TableHead rowSpan={2} className="align-middle text-center min-w-[200px] bg-background md:sticky md:left-[80px] md:z-10">শিক্ষার্থীর নাম</TableHead>
                    {subjects.map(subject => (
                        <TableHead key={subject.name} colSpan={3} className={cn("text-center border-x")}>
                            {subject.name}
                        </TableHead>
                    ))}
                    <TableHead rowSpan={2} className="align-middle text-center">মোট নম্বর</TableHead>
                    <TableHead rowSpan={2} className="align-middle text-center">জি.পি.এ</TableHead>
                    <TableHead rowSpan={2} className="align-middle text-center">গ্রেড</TableHead>
                    <TableHead rowSpan={2} className="align-middle text-center">মেধাস্থান</TableHead>
                    <TableHead rowSpan={2} className="align-middle text-center">মার্কশিট</TableHead>
                </TableRow>
                <TableRow>
                    {subjects.map(subject => (
                        <React.Fragment key={`${subject.name}-cols`}>
                            <TableHead className="text-center border-l">মোট</TableHead>
                            <TableHead className="text-center border-l">গ্রেড</TableHead>
                            <TableHead className="text-center border-l border-r">পয়েন্ট</TableHead>
                        </React.Fragment>
                    ))}
                </TableRow>
            </TableHeader>
        );
    }, [subjects]);
    
    const passedStudentsToPromote = useMemo(() => processedResults.filter(r => r.isPass && r.student.className !== '10'), [processedResults]);
    const graduatedStudents = useMemo(() => processedResults.filter(r => r.isPass && r.student.className === '10'), [processedResults]);
    const failedStudents = useMemo(() => processedResults.filter(r => !r.isPass), [processedResults]);


    return (
         <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end p-4 border rounded-lg w-full">
                    <div className="space-y-2">
                        <Label htmlFor="class-sheet">শ্রেণি</Label>
                        <Select value={className} onValueChange={c => { setClassName(c); setGroup(''); }}>
                            <SelectTrigger id="class-sheet"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="6">৬ষ্ঠ</SelectItem>
                                <SelectItem value="7">৭ম</SelectItem>
                                <SelectItem value="8">৮ম</SelectItem>
                                <SelectItem value="9">৯ম</SelectItem>
                                <SelectItem value="10">১০ম</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {showGroupSelector && (
                        <div className="space-y-2">
                            <Label htmlFor="group-sheet">গ্রুপ</Label>
                            <Select value={group} onValueChange={g => { setGroup(g); }}>
                                <SelectTrigger id="group-sheet"><SelectValue placeholder="গ্রুপ নির্বাচন" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="science">বিজ্ঞান</SelectItem>
                                    <SelectItem value="arts">মানবিক</SelectItem>
                                    <SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    
                    <Button onClick={handleViewResults} disabled={isLoading || (showGroupSelector && !group)} className={cn("w-full", showGroupSelector ? "lg:col-span-2" : "lg:col-span-3")}>
                        {isLoading ? 'লোড হচ্ছে...' : 'ফলাফল দেখুন'}
                    </Button>
                </div>
                {canPromote && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button disabled={isLoading || processedResults.length === 0}>
                                পরবর্তী সেশনে উত্তীর্ণ করুন
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-2xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle>শিক্ষার্থী উত্তীর্ণের সারাংশ</AlertDialogTitle>
                                <AlertDialogDescription>
                                    আপনি কি {selectedYear.toLocaleString('bn-BD')} শিক্ষাবর্ষ থেকে {String(parseInt(selectedYear, 10) + 1).toLocaleString('bn-BD')} শিক্ষাবর্ষে শিক্ষার্থীদের উত্তীর্ণ করতে চান?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="max-h-[50vh] overflow-y-auto my-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div>
                                    <h4 className="font-semibold mb-2 border-b pb-1 text-green-600">উত্তীর্ণ হবে ({passedStudentsToPromote.length.toLocaleString('bn-BD')} জন)</h4>
                                    {passedStudentsToPromote.length > 0 ? (
                                        <ul className="text-sm space-y-1 list-decimal list-inside">
                                            {passedStudentsToPromote.map(res => <li key={res.student.id}>{res.student.studentNameBn} (রোল: {res.student.roll.toLocaleString('bn-BD')})</li>)}
                                        </ul>
                                    ) : <p className="text-sm text-muted-foreground">--</p>}
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2 border-b pb-1 text-blue-600">গ্র্যাজুয়েট হবে ({graduatedStudents.length.toLocaleString('bn-BD')} জন)</h4>
                                    {graduatedStudents.length > 0 ? (
                                        <ul className="text-sm space-y-1 list-decimal list-inside">
                                            {graduatedStudents.map(res => <li key={res.student.id}>{res.student.studentNameBn} (রোল: {res.student.roll.toLocaleString('bn-BD')})</li>)}
                                        </ul>
                                    ) : <p className="text-sm text-muted-foreground">--</p>}
                                    <h4 className="font-semibold mt-4 mb-2 border-b pb-1 text-destructive">ফেল করেছে ({failedStudents.length.toLocaleString('bn-BD')} জন)</h4>
                                    {failedStudents.length > 0 ? (
                                        <ul className="text-sm space-y-1 list-decimal list-inside text-destructive">
                                            {failedStudents.map(res => <li key={res.student.id}>{res.student.studentNameBn} (রোল: {res.student.roll.toLocaleString('bn-BD')})</li>)}
                                        </ul>
                                    ) : <p className="text-sm text-muted-foreground">--</p>}
                                </div>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                <AlertDialogAction onClick={handlePromoteStudents} disabled={passedStudentsToPromote.length === 0 && graduatedStudents.length === 0}>উত্তীর্ণ করুন</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
            </div>
            
            {isLoading && <p>ফলাফল লোড হচ্ছে...</p>}

            {processedResults.length > 0 && subjects.length > 0 && (
                <div className="border rounded-md overflow-x-auto relative">
                    <Table className="min-w-max">
                        {tableHeaders}
                        <TableBody>
                            {processedResults.map(res => (
                                <TableRow key={res.student.id}>
                                    <TableCell className="text-center bg-background sticky left-0 z-10 md:min-w-[80px]">{res.student.roll.toLocaleString('bn-BD')}</TableCell>
                                    <TableCell className="whitespace-nowrap bg-background md:sticky md:left-[80px] md:z-10">{res.student.studentNameBn}</TableCell>
                                    {subjects.map(subject => {
                                        const subjectRes = res.subjectResults.get(subject.name);
                                        return (
                                            <React.Fragment key={`${res.student.id}-${subject.name}`}>
                                                <TableCell className="text-center border-l font-semibold">{subjectRes?.marks?.toLocaleString('bn-BD') ?? '-'}</TableCell>
                                                <TableCell className={cn("text-center border-l", {"text-destructive font-bold": subjectRes && !subjectRes.isPass})}>{subjectRes?.grade ?? '-'}</TableCell>
                                                <TableCell className="text-center border-l border-r">{subjectRes?.point?.toFixed(2).toLocaleString('bn-BD') ?? '-'}</TableCell>
                                            </React.Fragment>
                                        )
                                    })}
                                    <TableCell className="text-center font-bold">{res.totalMarks.toLocaleString('bn-BD')}</TableCell>
                                    <TableCell className="text-center font-bold">{res.gpa.toFixed(2).toLocaleString('bn-BD')}</TableCell>
                                    <TableCell className="text-center font-bold">{res.finalGrade}</TableCell>
                                    <TableCell className={cn("text-center font-bold", {"text-destructive": !res.isPass})}>
                                        {res.isPass ? renderMeritPosition(res.meritPosition) : `ফেল (${res.failedSubjectsCount.toLocaleString('bn-BD')})`}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Link href={`/marksheet/${res.student.id}?academicYear=${selectedYear}&className=${className}&group=${group || ''}&optionalSubject=${res.student.optionalSubject || ''}`} target="_blank">
                                            <Button variant="outline" size="icon">
                                                <BookOpen className="h-4 w-4" />
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
};

const SpecialPromotionTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user, hasPermission } = useAuth();
    const canPromote = hasPermission('promote:students');

    const [className, setClassName] = useState('');
    const [group, setGroup] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [failedStudents, setFailedStudents] = useState<StudentProcessedResult[]>([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

    const showGroupSelector = className === '9' || className === '10';

    const handleViewFailedStudents = useCallback(async () => {
        if (!className || !db || !user) {
            toast({ variant: 'destructive', title: 'শ্রেণি নির্বাচন করুন' });
            return;
        }
        if (showGroupSelector && !group) {
            toast({ variant: 'destructive', title: 'গ্রুপ নির্বাচন করুন' });
            return;
        }

        setIsLoading(true);

        const studentsInClass = allStudents.filter(s =>
            s.academicYear === selectedYear &&
            s.className === className &&
            (className < '9' || !group || s.group === group)
        );

        if (studentsInClass.length === 0) {
            toast({ title: 'এই শ্রেণিতে কোনো শিক্ষার্থী নেই।' });
            setFailedStudents([]);
            setIsLoading(false);
            return;
        }

        const allSubjectsForGroup = getSubjects(className, group).filter(s => s.isExamSubject !== false);
        const resultsBySubjectPromises = allSubjectsForGroup.map(subject =>
            getResultsForClass(db, selectedYear, className, subject.name, group)
        );
        const resultsBySubject = (await Promise.all(resultsBySubjectPromises)).filter((result): result is ClassResult => result !== undefined);

        const finalResults = processStudentResults(studentsInClass, resultsBySubject, allSubjectsForGroup);
        const failed = finalResults.filter(r => !r.isPass).sort((a,b) => a.student.roll - b.student.roll);
        setFailedStudents(failed);
        setSelectedStudentIds(new Set());
        setIsLoading(false);
    }, [className, group, db, user, allStudents, selectedYear, toast, showGroupSelector]);

    const handleToggleStudent = (studentId: string) => {
        const newSelection = new Set(selectedStudentIds);
        if (newSelection.has(studentId)) {
            newSelection.delete(studentId);
        } else {
            newSelection.add(studentId);
        }
        setSelectedStudentIds(newSelection);
    };

    const handleToggleAll = () => {
        if (selectedStudentIds.size === failedStudents.length) {
            setSelectedStudentIds(new Set());
        } else {
            const allIds = new Set(failedStudents.map(s => s.student.id));
            setSelectedStudentIds(allIds);
        }
    };
    
    const handlePromoteSelected = async () => {
        if (!db || !user) return;
        if (selectedStudentIds.size === 0) {
            toast({ variant: 'destructive', title: 'কোনো শিক্ষার্থী নির্বাচন করা হয়নি' });
            return;
        }

        setIsLoading(true);
        const nextYear = String(parseInt(selectedYear, 10) + 1);
        
        const studentsInNextYearSnapshot = await getDocs(query(collection(db, "students"), where("academicYear", "==", nextYear)));
        const studentsInNextYear = studentsInNextYearSnapshot.docs.map(doc => studentFromDoc(doc));

        const studentsToPromote = failedStudents
            .filter(r => selectedStudentIds.has(r.student.id))
            .sort((a,b) => a.student.roll - b.student.roll);
        
        const nextClass = String(parseInt(className, 10) + 1);

        const studentsInNextClass = studentsInNextYear.filter(s => 
            s.className === nextClass && 
            (s.group || '') === (group || '')
        );

        let lastRoll = 0;
        studentsInNextClass.forEach(s => {
            if (s.roll > lastRoll) {
                lastRoll = s.roll;
            }
        });

        const promotionPromises: Promise<any>[] = [];
        let promotedCount = 0;
        let skippedCount = 0;

        for (const result of studentsToPromote) {
            if (result.student.className === '10') continue;
            
            const isDuplicate = studentsInNextYear.some(s => 
                s.studentNameBn === result.student.studentNameBn &&
                s.fatherNameBn === result.student.fatherNameBn
            );

            if (isDuplicate) {
                skippedCount++;
                continue;
            }

            lastRoll++;
            const { id, createdAt, updatedAt, ...currentData } = result.student;

            const newStudentData: NewStudentData = {
                ...currentData,
                academicYear: nextYear,
                className: nextClass,
                roll: lastRoll,
                group: (nextClass === '9' || nextClass === '10') ? currentData.group : '',
                optionalSubject: (nextClass === '9' || nextClass === '10') ? currentData.optionalSubject : '',
            };
            
            promotionPromises.push(addStudent(db, newStudentData));
            promotedCount++;
        }

        try {
            await Promise.all(promotionPromises);
            let description = `${promotedCount} জন শিক্ষার্থীকে বিশেষ বিবেচনায় পরবর্তী শ্রেণিতে উত্তীর্ণ করা হয়েছে।`;
            if (skippedCount > 0) {
                description += ` ${skippedCount} জনের রেকর্ড ডুপ্লিকেট হওয়ায় তাদের উত্তীর্ণ করা হয়নি।`
            }
            toast({
                title: "শিক্ষার্থী উত্তীর্ণ করা সম্পন্ন",
                description: description,
            });
            setFailedStudents([]);
            setSelectedStudentIds(new Set());
        } catch(error) {
            console.error(error);
            const permissionError = new FirestorePermissionError({
                path: 'students',
                operation: 'create',
            });
            errorEmitter.emit('permission-error', permissionError);
        } finally {
            setIsLoading(false);
        }
    };
    
    const selectedStudentsForDialog = failedStudents.filter(s => selectedStudentIds.has(s.student.id));

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end p-4 border rounded-lg w-full">
                <div className="space-y-2">
                    <Label htmlFor="class-special-promo">শ্রেণি</Label>
                    <Select value={className} onValueChange={c => { setClassName(c); setGroup(''); setFailedStudents([]); }}>
                        <SelectTrigger id="class-special-promo"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="6">৬ষ্ঠ</SelectItem>
                            <SelectItem value="7">৭ম</SelectItem>
                            <SelectItem value="8">৮ম</SelectItem>
                            <SelectItem value="9">৯ম</SelectItem>
                            <SelectItem value="10">১০ম (উত্তীর্ণ করা যাবে না)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {showGroupSelector && (
                    <div className="space-y-2">
                        <Label htmlFor="group-special-promo">গ্রুপ</Label>
                        <Select value={group} onValueChange={g => { setGroup(g); setFailedStudents([]); }}>
                            <SelectTrigger id="group-special-promo"><SelectValue placeholder="গ্রুপ নির্বাচন" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="science">বিজ্ঞান</SelectItem>
                                <SelectItem value="arts">মানবিক</SelectItem>
                                <SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <Button onClick={handleViewFailedStudents} disabled={isLoading || !className || (showGroupSelector && !group)} className={cn("w-full", showGroupSelector ? "lg:col-span-2" : "lg:col-span-3")}>
                    {isLoading ? 'লোড হচ্ছে...' : 'ফেল করা শিক্ষার্থী দেখুন'}
                </Button>
            </div>
            
            {failedStudents.length > 0 ? (
                 <div className="border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="p-2">
                                    <Checkbox
                                        checked={selectedStudentIds.size > 0 && selectedStudentIds.size === failedStudents.length}
                                        onCheckedChange={handleToggleAll}
                                        aria-label="সকলকে নির্বাচন করুন"
                                    />
                                </TableHead>
                                <TableHead>রোল</TableHead>
                                <TableHead>নাম</TableHead>
                                <TableHead>ফেল করা বিষয়ের সংখ্যা</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {failedStudents.map(res => (
                                <TableRow key={res.student.id} data-state={selectedStudentIds.has(res.student.id) && "selected"}>
                                    <TableCell className="p-2">
                                        <Checkbox
                                            checked={selectedStudentIds.has(res.student.id)}
                                            onCheckedChange={() => handleToggleStudent(res.student.id)}
                                            aria-label={`Select student ${res.student.studentNameBn}`}
                                        />
                                    </TableCell>
                                    <TableCell>{res.student.roll.toLocaleString('bn-BD')}</TableCell>
                                    <TableCell>{res.student.studentNameBn}</TableCell>
                                    <TableCell>{res.failedSubjectsCount.toLocaleString('bn-BD')}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                !isLoading && className && <p className="text-center text-muted-foreground p-8">এই শ্রেণিতে ফেল করা কোনো শিক্ষার্থী নেই অথবা আপনি এখনও তালিকা দেখেননি।</p>
            )}
            
            {canPromote && failedStudents.length > 0 &&
                <div className="flex justify-end">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button disabled={isLoading || selectedStudentIds.size === 0 || className === '10'}>নির্বাচিতদের উত্তীর্ণ করুন</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    নিম্নলিখিত {selectedStudentIds.size.toLocaleString('bn-BD')} জন শিক্ষার্থীকে বিশেষ বিবেচনায় পরবর্তী সেশনে উত্তীর্ণ করা হবে।
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <div className="max-h-60 overflow-y-auto my-4 border rounded-md p-2">
                                <ul className="list-disc pl-5">
                                    {selectedStudentsForDialog.map(res => <li key={res.student.id}>{res.student.studentNameBn} (রোল: {res.student.roll.toLocaleString('bn-BD')})</li>)}
                                </ul>
                            </div>
                            <AlertDialogFooter>
                                <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                <AlertDialogAction onClick={handlePromoteSelected}>উত্তীর্ণ করুন</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            }
        </div>
    );
};


const BulkUploadTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user } = useAuth();
    
    const [className, setClassName] = useState('');
    const [group, setGroup] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadSample = () => {
        if (!className) {
            toast({ variant: 'destructive', title: 'শ্রেণি নির্বাচন করুন' });
            return;
        }
    
        const headers: string[] = ['রোল', 'নাম'];
    
        const addHeader = (header: string, hasPractical: boolean) => {
            headers.push(`${header} (লিখিত)`);
            headers.push(`${header} (বহুনির্বাচনী)`);
            if (hasPractical) {
                headers.push(`${header} (ব্যবহারিক)`);
            }
        };
    
        if (className === '9' || className === '10') {
            if (!group) { 
                addHeader('বাংলা প্রথম', false);
                addHeader('বাংলা দ্বিতীয়', false);
                addHeader('ইংরেজি প্রথম', false);
                addHeader('ইংরেজি দ্বিতীয়', false);
                addHeader('গণিত', false);
                addHeader('ধর্ম ও নৈতিক শিক্ষা', false);
                addHeader('তথ্য ও যোগাযোগ প্রযুক্তি', false);
                addHeader('সাধারণ বিজ্ঞান/বাংলাদেশ ও বিশ্ব পরিচয়', false);
                addHeader('বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা/পদার্থ', true);
                addHeader('ভূগোল ও পরিবেশ/রসায়ন', true);
                addHeader('পৌরনীতি ও নাগরিকতা/জীব বিজ্ঞান', true);
                addHeader('কৃষি শিক্ষা/উচ্চতর গণিত', true);
    
            } else {
                const groupSubjects = getSubjects(className, group).filter(s => s.isExamSubject !== false);
                groupSubjects.forEach(sub => addHeader(sub.name, sub.practical));
            }
        } else { 
            const subjectsForTemplate = getSubjects(className).filter(s => s.isExamSubject !== false);
            subjectsForTemplate.forEach(subject => {
                addHeader(subject.name, subject.practical);
            });
        }
    
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ফলাফল নমুনা');
        XLSX.writeFile(wb, `results_sample_${className}_${group || 'all'}.xlsx`);
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!db || !user || !className) {
            toast({
                variant: "destructive",
                title: "প্রথমে শ্রেণি নির্বাচন করুন",
            });
            return;
        }
        setIsLoading(true);

        const file = event.target.files?.[0];
        if (!file) {
            setIsLoading(false);
            return;
        }

        const studentsForClass = allStudents.filter(s => 
            s.academicYear === selectedYear && 
            s.className === className
        );

        if (studentsForClass.length === 0) {
            toast({ variant: 'destructive', title: 'এই শ্রেণিতে কোনো শিক্ষার্থী নেই।'});
            setIsLoading(false);
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet) as any[];

                const resultsToSave = new Map<string, ClassResult>();

                for (const row of json) {
                    const bengaliToEnglishDigit: { [key: string]: string } = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };
                    const rollStr = String(row['রোল'] || '').replace(/[০-৯]/g, d => bengaliToEnglishDigit[d]);
                    const roll = parseInt(rollStr, 10);
                    if (isNaN(roll)) continue;

                    const student = studentsForClass.find(s => s.roll === roll);
                    if (!student) continue;

                    const studentSubjects = getSubjects(student.className, student.group);

                    for (const header of Object.keys(row)) {
                        const match = header.match(/(.+?) \((.+)\)/);
                        if (!match) continue;

                        let subjectName = match[1].trim();
                        const markType = match[2].trim();
                        
                        const { subjectNameNormalization } = await import('@/lib/subjects');
                        subjectName = subjectNameNormalization[subjectName] || subjectName;

                        if (subjectName.includes('/')) {
                            const applicableSubject = subjectName.split('/').map(p => p.trim()).find(p => studentSubjects.map(s => s.name).includes(subjectNameNormalization[p] || p));
                            if (applicableSubject) {
                                subjectName = subjectNameNormalization[applicableSubject] || applicableSubject;
                            } else {
                                continue;
                            }
                        }

                        const subjectInfo = studentSubjects.find(s => s.name === subjectName);
                        if (!subjectInfo) continue;

                        const { getDocumentId } = await import('@/lib/results-data');
                        const docId = getDocumentId({
                            academicYear: selectedYear,
                            className: student.className,
                            subject: subjectName,
                            group: student.group
                        });

                        if (!resultsToSave.has(docId)) {
                            resultsToSave.set(docId, {
                                academicYear: selectedYear,
                                className: student.className,
                                group: student.group,
                                subject: subjectName,
                                fullMarks: subjectInfo.fullMarks,
                                results: []
                            });
                        }

                        const classResult = resultsToSave.get(docId)!;
                        let studentResult = classResult.results.find(r => r.studentId === student.id);
                        if (!studentResult) {
                            studentResult = { studentId: student.id };
                            classResult.results.push(studentResult);
                        }
                        
                        const markStr = String(row[header] || '').replace(/[০-৯]/g, d => bengaliToEnglishDigit[d]);
                        const markValue = (row[header] !== undefined && row[header] !== null && row[header] !== '') ? parseInt(markStr, 10) : undefined;

                        if (markValue === undefined || isNaN(markValue)) continue;

                        if (markType === 'লিখিত') studentResult.written = markValue;
                        else if (markType === 'বহুনির্বাচনী') studentResult.mcq = markValue;
                        else if (markType === 'ব্যবহারিক') studentResult.practical = markValue;
                    }
                }
                
                const subjectsToUpdate = Array.from(resultsToSave.values());

                if (subjectsToUpdate.length === 0) {
                     toast({
                        variant: 'destructive',
                        title: "কোনো শিক্ষার্থীর নম্বর পাওয়া যায়নি",
                    });
                    setIsLoading(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                }

                const promises = subjectsToUpdate.map(async (newClassResult) => {
                    const existingResult = await getResultsForClass(db, newClassResult.academicYear, newClassResult.className, newClassResult.subject, newClassResult.group);
                    
                    if (existingResult) {
                        const studentResultsMap = new Map(existingResult.results.map(r => [r.studentId, r]));
                        newClassResult.results.forEach(newRes => {
                            studentResultsMap.set(newRes.studentId, { ...studentResultsMap.get(newRes.studentId), ...newRes });
                        });
                        newClassResult.results = Array.from(studentResultsMap.values());
                    }

                    return saveClassResults(db, newClassResult);
                });

                await Promise.all(promises);

                toast({
                    title: "ফলাফল আপলোড সম্পন্ন",
                    description: `${promises.length} টি বিষয়ের ফলাফল সফলভাবে সেভ/আপডেট হয়েছে।`,
                });

            } catch (error: any) {
                console.error("File upload error:", error);
                toast({
                    variant: "destructive",
                    title: "ফাইল আপলোড ব্যর্থ হয়েছে",
                    description: error.message || "দয়া করে ফাইলের ফরম্যাট এবং আবশ্যকীয় তথ্য ঠিক আছে কিনা তা পরীক্ষা করুন।",
                    duration: 10000,
                });
            } finally {
                setIsLoading(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };
    
    const showGroupSelector = className === '9' || className === '10';

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end p-4 border rounded-lg">
            <div className="space-y-2">
                <Label htmlFor="class-upload">শ্রেণি</Label>
                <Select value={className} onValueChange={setClassName}>
                    <SelectTrigger id="class-upload"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="6">৬ষ্ঠ</SelectItem>
                        <SelectItem value="7">৭ম</SelectItem>
                        <SelectItem value="8">৮ম</SelectItem>
                        <SelectItem value="9">৯ম</SelectItem>
                        <SelectItem value="10">১০ম</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className={`space-y-2 ${showGroupSelector ? '' : 'lg:hidden'}`}>
                <Label htmlFor="group-upload">গ্রুপ</Label>
                 <Select value={group || 'all'} onValueChange={(val) => setGroup(val === 'all' ? '' : val)} disabled={!showGroupSelector}>
                    <SelectTrigger id="group-upload"><SelectValue placeholder="গ্রুপ নির্বাচন" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">সকল গ্রুপ</SelectItem>
                        <SelectItem value="science">বিজ্ঞান</SelectItem>
                        <SelectItem value="arts">মানবিক</SelectItem>
                        <SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            <div className="hidden lg:block"></div>

            <div className="flex flex-col sm:flex-row items-center gap-2 w-full lg:col-span-2">
                <Button variant="outline" onClick={handleDownloadSample} className="w-full">
                    <Download className="mr-2 h-4 w-4" />
                    নমুনা ফাইল
                </Button>
                <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="w-full">
                    <FileUp className="mr-2 h-4 w-4" />
                    {isLoading ? 'আপলোড হচ্ছে...' : 'ফাইল আপলোড করুন'}
                </Button>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
            </div>
        </div>
    );
};


export default function ResultsPage() {
    const [isClient, setIsClient] = useState(false);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const { user, hasPermission } = useAuth();
    const canPromote = hasPermission('promote:students');

    const fetchAllStudents = useCallback(() => {
        if (!db || !user) return;
        
        const studentsQuery = query(collection(db, "students"));
        const unsubscribe = onSnapshot(studentsQuery, (querySnapshot) => {
            const studentsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                dob: doc.data().dob?.toDate(),
            })) as Student[];
            setAllStudents(studentsData);
            setIsLoading(false);
        }, (error: FirestoreError) => {
            if (error.code === 'permission-denied') return;
            const permissionError = new FirestorePermissionError({ path: 'students', operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
            setIsLoading(false);
        });

        return unsubscribe;
    }, [db, user]);


    useEffect(() => {
        setIsClient(true);
        const unsubscribe = fetchAllStudents();
        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [fetchAllStudents]);

    return (
        <div className="flex min-h-screen w-full flex-col bg-violet-50">
            <Header />
            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-80">
                <Card>
                    <CardHeader>
                        <CardTitle>ফলাফল</CardTitle>
                        {isClient && <p className="text-sm text-muted-foreground">শিক্ষাবর্ষ: {selectedYear.toLocaleString('bn-BD')}</p>}
                    </CardHeader>
                    <CardContent>
                        {isClient ? (
                            <Tabs defaultValue="management">
                                <TabsList className="inline-flex h-auto flex-wrap items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full">
                                    <TabsTrigger value="management">নম্বর ব্যবস্থাপনা</TabsTrigger>
                                    <TabsTrigger value="sheet">ফলাফল শিট</TabsTrigger>
                                    {canPromote && <TabsTrigger value="special-promotion">বিশেষ বিবেচনায় পাশ</TabsTrigger>}
                                    <TabsTrigger value="upload">এক্সেল আপলোড</TabsTrigger>
                                </TabsList>
                                <TabsContent value="management" className="mt-4">
                                     {isLoading ? <p>লোড হচ্ছে...</p> : <MarkManagementTab allStudents={allStudents} />}
                                </TabsContent>
                                <TabsContent value="sheet" className="mt-4">
                                    {isLoading ? <p>লোড হচ্ছে...</p> : <ResultSheetTab allStudents={allStudents} />}
                                </TabsContent>
                                {canPromote && (
                                    <TabsContent value="special-promotion" className="mt-4">
                                        {isLoading ? <p>লোড হচ্ছে...</p> : <SpecialPromotionTab allStudents={allStudents} />}
                                    </TabsContent>
                                )}
                                <TabsContent value="upload" className="mt-4">
                                     {isLoading ? <p>লোড হচ্ছে...</p> : <BulkUploadTab allStudents={allStudents} />}
                                </TabsContent>
                            </Tabs>
                        ) : (
                           <div className="space-y-4">
                               <div className="grid w-full grid-cols-4 h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
                                    <div className="inline-flex items-center justify-center rounded-sm bg-background shadow-sm h-8 w-full"><Skeleton className="h-4 w-24" /></div>
                                    <div className="inline-flex items-center justify-center rounded-sm h-8 w-full"><Skeleton className="h-4 w-24" /></div>
                                    <div className="inline-flex items-center justify-center rounded-sm h-8 w-full"><Skeleton className="h-4 w-24" /></div>
                                     <div className="inline-flex items-center justify-center rounded-sm h-8 w-full"><Skeleton className="h-4 w-24" /></div>
                                </div>
                                <div className="p-4 border rounded-lg">
                                    <Skeleton className="h-24 w-full" />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
