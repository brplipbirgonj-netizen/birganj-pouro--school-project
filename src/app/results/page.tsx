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
import { Student, studentFromDoc, addStudent } from '@/lib/student-data';
import { getSubjects, Subject as SubjectType } from '@/lib/subjects';
import { saveClassResults, getResultsForClass, getAllResults, deleteClassResult, ClassResult, StudentResult } from '@/lib/results-data';
import { processStudentResults, StudentProcessedResult } from '@/lib/results-calculation';
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, FileUp, Download, FilePen, BookOpen, AlertCircle, Trophy, Printer, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, orderBy, FirestoreError } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { getExams, Exam } from '@/lib/exam-data';
import { Badge } from '@/components/ui/badge';

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
    
    const isSubjectPermitted = useCallback((cls: string, sub: string) => {
        if (user?.role === 'admin') return true;
        if (hasPermission('manage:results')) return true;
        return user?.marksPermissions?.[cls]?.includes(sub) ?? false;
    }, [user, hasPermission]);

    const [exams, setExams] = useState<Exam[]>([]);
    const [examName, setExamName] = useState('');
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

    useEffect(() => {
        if (!db || !user) return;
        getExams(db, selectedYear).then(setExams);
    }, [db, selectedYear, user]);

    const updateSavedResults = useCallback(async () => {
        if (!db || !user) return;
        const allResults = await getAllResults(db, selectedYear, examName || undefined);
        
        if (user?.role !== 'admin' && !hasPermission('manage:results')) {
             setSavedResults(allResults.filter(res => isSubjectPermitted(res.className, res.subject)));
        } else {
             setSavedResults(allResults);
        }
    }, [db, selectedYear, user, examName, hasPermission, isSubjectPermitted]);
    
    useEffect(() => {
        updateSavedResults();
    }, [updateSavedResults]);

    const canEditCurrent = useMemo(() => {
        if (!className || !subject) return false;
        return isSubjectPermitted(className, subject);
    }, [className, subject, isSubjectPermitted]);

    const groupedResults = useMemo(() => {
        if (savedResults.length === 0) return {};
        const groups: { [key: string]: ClassResult[] } = {};
        savedResults.forEach(res => {
            const key = res.className;
            if (!groups[key]) groups[key] = [];
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
                if (groupA !== groupB) return groupA.localeCompare(groupB, 'bn');
                const indexA = subjectOrder.indexOf(a.subject);
                const indexB = subjectOrder.indexOf(b.subject);
                if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                if (indexA !== -1) return -1;
                if (indexB !== -1) return 1;
                return a.subject.localeCompare(b.subject, 'bn');
            });
        }
        return groups;
    }, [savedResults]);

    const sortedClassKeys = useMemo(() => Object.keys(groupedResults).sort((a, b) => parseInt(a) - parseInt(b)), [groupedResults]);
    const showGroupSelector = useMemo(() => parseInt(className) >= 9, [className]);

    useEffect(() => {
        let newSubjects = getSubjects(className, group).filter(s => s.isExamSubject !== false);
        if (user?.role !== 'admin' && !hasPermission('manage:results') && hasPermission('input:results') && className) {
            newSubjects = newSubjects.filter(s => isSubjectPermitted(className, s.name));
        }
        setAvailableSubjects(newSubjects);
        if (subject && !newSubjects.some(s => s.name === subject)) {
            setSubject('');
            setSelectedSubjectInfo(null);
        }
    }, [className, group, subject, user, hasPermission, isSubjectPermitted]);

    useEffect(() => {
        if (subject) {
            const subInfo = availableSubjects.find(s => s.name === subject);
            setSelectedSubjectInfo(subInfo || null);
            if (subInfo && studentsForClass.length === 0) setFullMarks(subInfo.fullMarks);
        } else setSelectedSubjectInfo(null);
    }, [subject, availableSubjects, studentsForClass.length]);
    
    const handleLoadStudents = async () => {
        if (!examName || !className || !subject || !db || !user) {
            toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ', description: 'অনুগ্রহ করে পরীক্ষা, শ্রেণি ও বিষয় নির্বাচন করুন।' });
            return;
        }
        setIsLoadingStudents(true);
        const filteredStudents = allStudents.filter(s => s.academicYear === selectedYear && s.className === className && (!showGroupSelector || !group || s.group === group)).sort((a,b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
        setStudentsForClass(filteredStudents);
        const existingResults = await getResultsForClass(db, selectedYear, examName, className, subject, group);
        const initialMarks = new Map<string, Marks>();
        if (existingResults) {
            setFullMarks(existingResults.fullMarks);
            existingResults.results.forEach(res => initialMarks.set(res.studentId, { written: res.written, mcq: res.mcq, practical: res.practical }));
        } else {
            const subInfo = availableSubjects.find(s => s.name === subject);
            setFullMarks(subInfo?.fullMarks || 100);
        }
        filteredStudents.forEach(student => { if (!initialMarks.has(student.id)) initialMarks.set(student.id, { written: undefined, mcq: undefined, practical: undefined }); });
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
        if (!canEditCurrent) { toast({ variant: 'destructive', title: 'পারমিশন নেই' }); return; }
        if (studentsForClass.length === 0) { toast({ variant: 'destructive', title: 'কোনো শিক্ষার্থী নেই' }); return; }
        const resultsData: StudentResult[] = Array.from(marks.entries()).map(([studentId, marks]) => ({ studentId, ...marks }));
        saveClassResults(db, { academicYear: selectedYear, examName, className, group: group || undefined, subject, fullMarks: fullMarks || selectedSubjectInfo?.fullMarks || 100, results: resultsData }).then(() => {
            updateSavedResults();
            toast({ title: 'ফলাফল সেভ হয়েছে' });
        }).catch(() => {});
    };

    const handleDeleteResult = (result: ClassResult) => {
        if (!db || !result.id || !user) return;
        if (!isSubjectPermitted(result.className, result.subject)) { toast({ variant: 'destructive', title: 'পারমিশন নেই' }); return; }
        deleteClassResult(db, result.id).then(() => { updateSavedResults(); toast({ title: 'ফলাফল মোছা হয়েছে' }); }).catch(() => {});
    }

    const handleEditClick = (resultToEdit: ClassResult) => {
        setExamName(resultToEdit.examName); setClassName(resultToEdit.className); setGroup(resultToEdit.group || ''); setFullMarks(resultToEdit.fullMarks);
        setTimeout(() => { setSubject(resultToEdit.subject); setStudentsForClass([]); setMarks(new Map()); window.scrollTo({ top: 0, behavior: 'smooth' }); }, 0);
    };

    const handleDownloadSample = () => {
       const ws = XLSX.utils.aoa_to_sheet([['রোল', 'লিখিত', 'বহুনির্বাচনী', 'ব্যবহারিক']]);
       const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'নম্বর নমুনা'); XLSX.writeFile(wb, 'marks_sample.xlsx');
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!db || !user || !className || !subject || !examName) { toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ" }); return; }
        if (!canEditCurrent) { toast({ variant: 'destructive', title: 'পারমিশন নেই' }); return; }
        const file = event.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(e.target?.result, { type: 'array' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                if (json.length === 0 || studentsForClass.length === 0) return;
                const newMarks = new Map(marks); let count = 0;
                for (const row of json as any[]) {
                    const roll = parseInt(String(row['রোল'] || row['roll'] || '').replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]), 10);
                    const student = studentsForClass.find(s => s.roll === roll);
                    if (!student) continue;
                    const sm = newMarks.get(student.id) || {};
                    const getVal = (k: string) => parseInt(String(row[k] || '').replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]), 10);
                    const w = getVal('লিখিত') || getVal('written'); if (!isNaN(w)) sm.written = w;
                    const m = getVal('বহুনির্বাচনী') || getVal('mcq'); if (!isNaN(m)) sm.mcq = m;
                    const p = getVal('ব্যবহারিক') || getVal('practical'); if (!isNaN(p)) sm.practical = p;
                    newMarks.set(student.id, sm); count++;
                }
                setMarks(newMarks); toast({ title: "নম্বর লোড হয়েছে", description: `${count} জনের তথ্য পাওয়া গেছে।` });
            } catch (error: any) { toast({ variant: "destructive", title: "ত্রুটি", description: error.message }); }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end p-4 border rounded-lg">
                <div className="space-y-2"><Label>পরীক্ষা</Label><Select value={examName} onValueChange={setExamName}><SelectTrigger><SelectValue placeholder="পরীক্ষা নির্বাচন" /></SelectTrigger><SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="class">শ্রেণি</Label><Select value={className} onValueChange={(v) => { setClassName(v); setGroup(''); setSubject(''); }}><SelectTrigger id="class"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger><SelectContent><SelectItem value="6">৬ষ্ঠ</SelectItem><SelectItem value="7">৭ম</SelectItem><SelectItem value="8">৮ম</SelectItem><SelectItem value="9">৯ম</SelectItem><SelectItem value="10">১০ম</SelectItem></SelectContent></Select></div>
                {showGroupSelector && (<div className="space-y-2"><Label htmlFor="group">গ্রুপ</Label><Select value={group} onValueChange={setGroup} required><SelectTrigger id="group"><SelectValue placeholder="গ্রুপ নির্বাচন" /></SelectTrigger><SelectContent><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent></Select></div>)}
                <div className="space-y-2"><Label htmlFor="subject">বিষয়</Label><Select value={subject} onValueChange={setSubject} disabled={!className || (showGroupSelector && !group)}><SelectTrigger id="subject"><SelectValue placeholder="বিষয় নির্বাচন" /></SelectTrigger><SelectContent>{availableSubjects.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="full-marks">পূর্ণমান</Label><Input id="full-marks" type="number" value={fullMarks || ''} onChange={(e) => setFullMarks(e.target.value === '' ? undefined : parseInt(e.target.value))} /></div>
                <Button onClick={handleLoadStudents} disabled={isLoadingStudents || !subject || !examName} className="w-full">{isLoadingStudents ? 'লোড হচ্ছে...' : 'লোড করুন'}</Button>
            </div>
            {studentsForClass.length > 0 && (
                <div className="border rounded-md">
                    <div className="bg-muted/30 p-2 flex justify-between items-center border-b">
                         <div className="flex items-center gap-2">{!canEditCurrent && <Badge variant="destructive">পারমিশন নেই</Badge>}</div>
                         <div className="flex gap-2"><Button variant="outline" size="sm" onClick={handleDownloadSample}><Download className="mr-2 h-4 w-4" /> নমুনা</Button><Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={!canEditCurrent}><FileUp className="mr-2 h-4 w-4" /> আপলোড</Button><input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" /></div>
                    </div>
                    <div className="max-h-[500px] overflow-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-white z-10">
                                <TableRow><TableHead>রোল</TableHead><TableHead>নাম</TableHead><TableHead>লিখিত</TableHead><TableHead>MCQ</TableHead>{selectedSubjectInfo?.practical && <TableHead>ব্যবহারিক</TableHead>}</TableRow>
                            </TableHeader>
                            <TableBody>
                                {studentsForClass.map(student => (
                                    <TableRow key={student.id}>
                                        <TableCell className="font-bold">{student.roll.toLocaleString('bn-BD')}</TableCell>
                                        <TableCell>{student.studentNameBn}</TableCell>
                                        <TableCell><Input type="number" value={marks.get(student.id)?.written || ''} onChange={(e) => handleMarkChange(student.id, 'written', e.target.value)} className="w-20 h-8" disabled={!canEditCurrent} /></TableCell>
                                        <TableCell><Input type="number" value={marks.get(student.id)?.mcq || ''} onChange={(e) => handleMarkChange(student.id, 'mcq', e.target.value)} className="w-20 h-8" disabled={!canEditCurrent} /></TableCell>
                                        {selectedSubjectInfo?.practical && <TableCell><Input type="number" value={marks.get(student.id)?.practical || ''} onChange={(e) => handleMarkChange(student.id, 'practical', e.target.value)} className="w-20 h-8" disabled={!canEditCurrent} /></TableCell>}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex justify-end p-4 border-t"><Button onClick={handleSaveResults} disabled={!canEditCurrent}>ফলাফল সেভ করুন</Button></div>
                </div>
            )}
            {savedResults.length > 0 && (
                <div className="space-y-4">
                    <h3 className="font-bold text-lg border-b pb-2">সংরক্ষিত তালিকা</h3>
                    <Accordion type="multiple" className="w-full">
                        {sortedClassKeys.map(ck => (
                            <AccordionItem value={ck} key={ck}>
                                <AccordionTrigger>শ্রেণি {classNamesMap[ck] || ck}</AccordionTrigger>
                                <AccordionContent>
                                    <div className="border rounded-md"><Table><TableHeader><TableRow><TableHead>বিষয়</TableHead><TableHead>শাখা</TableHead><TableHead className="text-right">কার্যক্রম</TableHead></TableRow></TableHeader><TableBody>{groupedResults[ck].map((res, i) => (
                                        <TableRow key={i} className={cn(!isSubjectPermitted(res.className, res.subject) && "opacity-50")}>
                                            <TableCell className="font-bold">{res.subject}</TableCell>
                                            <TableCell>{groupMap[res.group || ''] || 'সাধারণ'}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleEditClick(res)} disabled={!isSubjectPermitted(ck, res.subject)}><FilePen className="h-3.5 w-3.5" /></Button>
                                                    <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-7 w-7" disabled={!isSubjectPermitted(ck, res.subject)}><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                                                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>নিশ্চিত তো?</AlertDialogTitle><AlertDialogDescription>এটি স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>না</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteResult(res)}>হ্যাঁ</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}</TableBody></Table></div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            )}
        </div>
    );
};

const ResultSheetTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user } = useAuth();
    const [exams, setExams] = useState<Exam[]>([]);
    const [examName, setExamName] = useState('');
    const [className, setClassName] = useState('');
    const [groupFilter, setGroupFilter] = useState('all');
    const [processedResults, setProcessedResults] = useState<StudentProcessedResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };
    const groupNamesMap: { [key: string]: string } = { 'science': 'বিজ্ঞান', 'arts': 'মানবিক', 'commerce': 'ব্যবসায় শিক্ষা', 'all': 'সকল শাখা' };

    useEffect(() => { if (db && user) getExams(db, selectedYear).then(setExams); }, [db, selectedYear, user]);

    const handleViewResults = async () => {
        if (!examName || !className || !db || !user) { toast({ variant: 'destructive', title: 'তথ্য দিন' }); return; }
        setIsLoading(true);
        const students = allStudents.filter(s => s.academicYear === selectedYear && s.className === className && (parseInt(className) < 9 || groupFilter === 'all' || (s.group || '').toLowerCase().trim() === groupFilter)).sort((a,b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
        if (students.length === 0) { toast({ title: 'কোনো ছাত্র নেই' }); setProcessedResults([]); setIsLoading(false); return; }
        const allResults = await getAllResults(db, selectedYear, examName);
        const classRes = allResults.filter(r => r.className === className);
        const subs = getSubjects(className, groupFilter === 'all' ? undefined : groupFilter).filter(s => s.isExamSubject !== false);
        setProcessedResults(processStudentResults(students, classRes, subs));
        setIsLoading(false);
    };

    const groupedData = useMemo(() => {
        const groups: Record<string, StudentProcessedResult[]> = {};
        processedResults.forEach(res => {
            const g = (parseInt(className) >= 9 && groupFilter !== 'all') ? (res.student.group || 'all') : 'all';
            if (!groups[g]) groups[g] = [];
            groups[g].push(res);
        });
        return groups;
    }, [processedResults, className, groupFilter]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end p-4 border rounded-lg bg-white/50">
                <div className="space-y-2"><Label>পরীক্ষা</Label><Select value={examName} onValueChange={setExamName}><SelectTrigger className="bg-white"><SelectValue placeholder="সিলেক্ট করুন" /></SelectTrigger><SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>শ্রেণি</Label><Select value={className} onValueChange={c => { setClassName(c); setGroupFilter('all'); setProcessedResults([]); }}><SelectTrigger className="bg-white"><SelectValue placeholder="সিলেক্ট করুন" /></SelectTrigger><SelectContent><SelectItem value="6">৬ষ্ঠ</SelectItem><SelectItem value="7">৭ম</SelectItem><SelectItem value="8">৮ম</SelectItem><SelectItem value="9">৯ম</SelectItem><SelectItem value="10">১০ম</SelectItem></SelectContent></Select></div>
                {parseInt(className) >= 9 && (<div className="space-y-2"><Label>শাখা</Label><Select value={groupFilter} onValueChange={setGroupFilter}><SelectTrigger className="bg-white"><SelectValue placeholder="সকল শাখা" /></SelectTrigger><SelectContent><SelectItem value="all">সকল শাখা</SelectItem><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent></Select></div>)}
                <Button onClick={handleViewResults} disabled={isLoading || !examName || !className} className={cn("w-full shadow-md", parseInt(className) >= 9 ? "lg:col-span-2" : "lg:col-span-3")}>{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ফলাফল দেখুন'}</Button>
            </div>
            {Object.keys(groupedData).map(gk => {
                const results = groupedData[gk];
                const subs = getSubjects(className, gk === 'all' ? undefined : gk).filter(s => s.isExamSubject !== false);
                return (
                    <div key={gk} className="space-y-2">
                        <div className="flex justify-between items-center bg-primary/5 p-2 rounded-t-lg border-x border-t border-primary/20">
                            <h3 className="font-black text-primary text-sm">শাখা: {groupNamesMap[gk] || gk}</h3>
                            <Badge variant="outline" className="text-[10px]">মোট: {results.length.toLocaleString('bn-BD')}</Badge>
                        </div>
                        <div className="table-container border-2 border-primary/20 max-h-[600px] overflow-auto">
                            <Table className="min-w-max border-collapse">
                                <TableHeader className="sticky top-0 bg-white z-40">
                                    <TableRow className="h-8">
                                        <TableHead rowSpan={2} className="text-center font-black bg-white border-r border-b-2 sticky left-0 z-50 w-12 text-[11px] p-1">রোল</TableHead>
                                        <TableHead rowSpan={2} className="text-center font-black bg-white border-r border-b-2 sticky left-12 z-50 min-w-[120px] text-[11px] p-1">শিক্ষার্থীর নাম</TableHead>
                                        {subs.map(s => <TableHead key={s.name} colSpan={s.name.includes('ইংরেজি') ? 3 : (s.practical ? 6 : 5)} className="text-center border-x border-b font-black py-0.5 text-[10px] bg-slate-50 sticky top-0">{s.name}</TableHead>)}
                                        <TableHead rowSpan={2} className="text-center font-black border-l border-b-2 text-[10px] sticky top-0 bg-white">মোট</TableHead>
                                        <TableHead rowSpan={2} className="text-center font-black border-l border-b-2 text-[10px] sticky top-0 bg-white">GPA</TableHead>
                                        <TableHead rowSpan={2} className="text-center font-black border-l border-b-2 text-[10px] sticky top-0 bg-white">গ্রেড</TableHead>
                                        <TableHead rowSpan={2} className="text-center font-black border-l border-b-2 text-[10px] sticky top-0 bg-white">মেধা</TableHead>
                                        <TableHead rowSpan={2} className="text-center no-print border-l border-b-2 text-[10px] sticky top-0 bg-white">মার্কশিট</TableHead>
                                    </TableRow>
                                    <TableRow className="h-7 bg-muted/20">
                                        {subs.map(s => {
                                            const isEng = s.name.includes('ইংরেজি');
                                            return (
                                                <React.Fragment key={s.name}>
                                                    {!isEng && (<><TableHead className="text-[9px] text-center border-l border-b-2 font-bold p-0 sticky top-8 bg-muted/20">লিখিত</TableHead><TableHead className="text-[9px] text-center border-l border-b-2 font-bold p-0 sticky top-8 bg-muted/20">MCQ</TableHead>{s.practical && <TableHead className="text-[9px] text-center border-l border-b-2 font-bold p-0 sticky top-8 bg-muted/20">ব্যবহারিক</TableHead>}</>)}
                                                    <TableHead className="text-[9px] text-center border-l border-b-2 font-black bg-blue-50/50 p-0 sticky top-8">প্রাপ্ত</TableHead><TableHead className="text-[9px] text-center border-l border-b-2 font-bold p-0 sticky top-8 bg-muted/20">গ্রেড</TableHead><TableHead className="text-[9px] text-center border-l border-r border-b-2 font-bold p-0 sticky top-8 bg-muted/20">পয়েন্ট</TableHead>
                                                </React.Fragment>
                                            )
                                        })}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.map(res => (
                                        <TableRow key={res.student.id} className="h-7 hover:bg-accent/5">
                                            <TableCell className="text-center font-black sticky left-0 z-20 bg-white border-r text-[11px] p-1">{res.student.roll.toLocaleString('bn-BD')}</TableCell>
                                            <TableCell className="font-bold sticky left-12 z-20 bg-white border-r text-[10px] p-1 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                                                {res.student.studentNameBn}
                                                {gk === 'all' && res.student.group && <span className="block text-[8px] text-muted-foreground font-normal italic leading-none">{groupNamesMap[res.student.group] || res.student.group}</span>}
                                            </TableCell>
                                            {subs.map(s => {
                                                const sr = res.subjectResults.get(s.name);
                                                const isEng = s.name.includes('ইংরেজি');
                                                return (
                                                    <React.Fragment key={s.name}>
                                                        {!isEng && (<><TableCell className="text-center border-l text-[10px] p-0">{sr?.written?.toLocaleString('bn-BD') ?? '-'}</TableCell><TableCell className="text-center border-l text-[10px] p-0">{sr?.mcq?.toLocaleString('bn-BD') ?? '-'}</TableCell>{s.practical && <TableCell className="text-center border-l text-[10px] p-0">{sr?.practical?.toLocaleString('bn-BD') ?? '-'}</TableCell>}</>)}
                                                        <TableCell className="text-center border-l font-black bg-blue-50/10 text-blue-900 text-[10px] p-0">{sr?.marks?.toLocaleString('bn-BD') ?? '-'}</TableCell>
                                                        <TableCell className={cn("text-center border-l text-[9px] font-bold p-0", sr && !sr.isPass && "text-rose-600")}>{sr?.grade ?? '-'}</TableCell>
                                                        <TableCell className="text-center border-l border-r text-[9px] p-0">{sr?.point?.toFixed(2).toLocaleString('bn-BD') ?? '-'}</TableCell>
                                                    </React.Fragment>
                                                )
                                            })}
                                            <TableCell className="text-center font-black text-primary border-r text-[10px] p-0">{res.totalMarks.toLocaleString('bn-BD')}</TableCell>
                                            <TableCell className="text-center font-black border-r text-[10px] p-0">{res.gpa.toFixed(2).toLocaleString('bn-BD')}</TableCell>
                                            <TableCell className={cn("text-center font-black border-r text-[10px] p-0", !res.isPass && "text-rose-600")}>{res.isPass ? res.finalGrade : `F${res.failedSubjectsCount}`}</TableCell>
                                            <TableCell className={cn("text-center font-black text-[10px] p-0", !res.isPass && "text-rose-600")}>{res.isPass ? (res.meritPosition?.toLocaleString('bn-BD') || '-') : 'ফেল'}</TableCell>
                                            <TableCell className="text-center no-print p-0"><Link href={`/marksheet/${res.student.id}?academicYear=${selectedYear}&examName=${examName}`} target="_blank"><Button variant="ghost" size="icon" className="h-6 w-6 text-primary"><BookOpen className="h-3 w-3" /></Button></Link></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const MeritListTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { toast } = useToast(); const { selectedYear } = useAcademicYear(); const db = useFirestore(); const { user } = useAuth();
    const [exams, setExams] = useState<Exam[]>([]); const [examName, setExamName] = useState(''); const [className, setClassName] = useState(''); const [groupFilter, setGroupFilter] = useState('all'); const [processedResults, setProcessedResults] = useState<StudentProcessedResult[]>([]); const [isLoading, setIsLoading] = useState(false);
    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };
    useEffect(() => { if (db && user) getExams(db, selectedYear).then(setExams); }, [db, selectedYear, user]);
    const handleViewMeritList = async () => {
        if (!examName || !className || !db || !user) { toast({ variant: 'destructive', title: 'তথ্য দিন' }); return; }
        setIsLoading(true);
        const students = allStudents.filter(s => s.academicYear === selectedYear && s.className === className && (parseInt(className) < 9 || groupFilter === 'all' || (s.group || '').toLowerCase().trim() === groupFilter));
        if (students.length === 0) { setProcessedResults([]); setIsLoading(false); return; }
        const allRes = await getAllResults(db, selectedYear, examName);
        const classRes = allRes.filter(r => r.className === className);
        const subs = getSubjects(className, groupFilter === 'all' ? undefined : groupFilter).filter(s => s.isExamSubject !== false);
        const results = processStudentResults(students, classRes, subs);
        setProcessedResults(results.sort((a, b) => { if (a.isPass !== b.isPass) return a.isPass ? -1 : 1; if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks; return a.student.roll - b.student.roll; }));
        setIsLoading(false);
    };
    const handlePrint = () => { if (examName && className) window.open(`/results/merit-list?academicYear=${selectedYear}&examName=${examName}&className=${className}&group=${groupFilter}`, '_blank'); };
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end p-4 border rounded-lg bg-white/50">
                <div className="space-y-2"><Label>পরীক্ষা</Label><Select value={examName} onValueChange={setExamName}><SelectTrigger><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>শ্রেণি</Label><Select value={className} onValueChange={setClassName}><SelectTrigger><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent><SelectItem value="6">৬ষ্ঠ</SelectItem><SelectItem value="7">৭ম</SelectItem><SelectItem value="8">৮ম</SelectItem><SelectItem value="9">৯ম</SelectItem><SelectItem value="10">১০ম</SelectItem></SelectContent></Select></div>
                {parseInt(className) >= 9 && (<div className="space-y-2"><Label>শাখা</Label><Select value={groupFilter} onValueChange={setGroupFilter}><SelectTrigger><SelectValue placeholder="সকল শাখা" /></SelectTrigger><SelectContent><SelectItem value="all">সকল শাখা</SelectItem><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent></Select></div>)}
                <div className="flex gap-2 lg:col-span-1"><Button onClick={handleViewMeritList} disabled={isLoading || !examName || !className} className="flex-1">তালিকা দেখুন</Button><Button onClick={handlePrint} disabled={processedResults.length === 0} variant="outline"><Printer className="h-4 w-4" /></Button></div>
            </div>
            {processedResults.length > 0 && (
                <div className="border rounded-xl bg-white shadow-lg overflow-hidden animate-in fade-in">
                    <div className="bg-primary/5 p-4 border-b flex justify-between items-center"><h3 className="text-lg font-black text-primary flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" /> মেধা তালিকা: {classNamesMap[className]} শ্রেণি</h3><Badge variant="outline">{processedResults.length.toLocaleString('bn-BD')} জন</Badge></div>
                    <div className="overflow-x-auto"><Table><TableHeader className="bg-muted/50"><TableRow><TableHead className="text-center font-bold">মেধাস্থান</TableHead><TableHead className="text-center font-bold">রোল</TableHead><TableHead className="font-bold">শিক্ষার্থীর নাম</TableHead><TableHead className="text-center font-bold">মোট নম্বর</TableHead><TableHead className="text-center font-bold">GPA</TableHead><TableHead className="text-center font-bold">গ্রেড</TableHead><TableHead className="text-right font-bold">ফলাফল</TableHead></TableRow></TableHeader><TableBody>{processedResults.map((res, index) => (
                        <TableRow key={res.student.id} className={cn(res.isPass ? "hover:bg-accent/5" : "bg-rose-50/50")}>
                            <TableCell className="text-center">{res.isPass ? <span className="font-black">{(index + 1).toLocaleString('bn-BD')}</span> : '-'}</TableCell>
                            <TableCell className="text-center font-bold">{res.student.roll.toLocaleString('bn-BD')}</TableCell>
                            <TableCell className="font-black text-slate-800">{res.student.studentNameBn}</TableCell>
                            <TableCell className="text-center font-bold text-primary">{res.totalMarks.toLocaleString('bn-BD')}</TableCell>
                            <TableCell className="text-center font-black">{res.gpa.toFixed(2).toLocaleString('bn-BD')}</TableCell>
                            <TableCell className={cn("text-center font-bold", !res.isPass && "text-rose-600")}>{res.isPass ? res.finalGrade : `F${res.failedSubjectsCount}`}</TableCell>
                            <TableCell className="text-right"><Badge variant={res.isPass ? "default" : "destructive"} className="text-[10px] font-black">{res.isPass ? 'কৃতকার্য' : 'অকৃতকার্য'}</Badge></TableCell>
                        </TableRow>
                    ))}</TableBody></Table></div>
                </div>
            )}
        </div>
    );
};

const SpecialPromotionTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { toast } = useToast(); const { selectedYear } = useAcademicYear(); const db = useFirestore(); const { user, hasPermission } = useAuth();
    const [exams, setExams] = useState<Exam[]>([]); const [examName, setExamName] = useState(''); const [className, setClassName] = useState(''); const [group, setGroup] = useState(''); const [isLoading, setIsLoading] = useState(false); const [failedStudents, setFailedStudents] = useState<StudentProcessedResult[]>([]); const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    useEffect(() => { if (db && user) getExams(db, selectedYear).then(setExams); }, [db, selectedYear, user]);
    const handleViewFailed = async () => {
        if (!examName || !className || !db || !user) return;
        setIsLoading(true);
        const students = allStudents.filter(s => s.academicYear === selectedYear && s.className === className && (parseInt(className) < 9 || !group || (s.group || '').toLowerCase().trim() === group.toLowerCase().trim()));
        const allRes = await getAllResults(db, selectedYear, examName);
        const classRes = allRes.filter(r => r.className === className);
        const subs = getSubjects(className, group).filter(s => s.isExamSubject !== false);
        const results = processStudentResults(students, classRes, subs);
        setFailedStudents(results.filter(r => !r.isPass).sort((a,b) => a.student.roll - b.student.roll));
        setSelectedIds(new Set()); setIsLoading(false);
    };
    const handlePromote = async () => {
        if (!db || selectedIds.size === 0) return;
        setIsLoading(true);
        const nextYear = String(parseInt(selectedYear) + 1);
        const nextClass = String(parseInt(className) + 1);
        const promPromises = failedStudents.filter(r => selectedIds.has(r.student.id)).map(res => {
            const { id, createdAt, updatedAt, ...rest } = res.student;
            return addStudent(db, { ...rest, academicYear: nextYear, className: nextClass, roll: res.student.roll });
        });
        await Promise.all(promPromises); toast({ title: "সফল", description: `${promPromises.length} জনকে উত্তীর্ণ করা হয়েছে।` });
        setFailedStudents([]); setIsLoading(false);
    };
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end p-4 border rounded-lg bg-white/50">
                <div className="space-y-2"><Label>পরীক্ষা</Label><Select value={examName} onValueChange={setExamName}><SelectTrigger className="bg-white"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>শ্রেণি</Label><Select value={className} onValueChange={c => { setClassName(c); setGroup(''); }}><SelectTrigger className="bg-white"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent><SelectItem value="6">৬ষ্ঠ</SelectItem><SelectItem value="7">৭ম</SelectItem><SelectItem value="8">৮ম</SelectItem><SelectItem value="9">৯ম</SelectItem><SelectItem value="10">১০ম</SelectItem></SelectContent></Select></div>
                {parseInt(className) >= 9 && (<div className="space-y-2"><Label>গ্রুপ</Label><Select value={group} onValueChange={setGroup}><SelectTrigger className="bg-white"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent></Select></div>)}
                <Button onClick={handleViewFailed} disabled={isLoading || !examName || !className} className="lg:col-span-2">{isLoading ? 'লোড হচ্ছে...' : 'ফেল করা ছাত্র খোজুন'}</Button>
            </div>
            {failedStudents.length > 0 && (
                <div className="space-y-4">
                    <div className="border rounded-md overflow-x-auto"><Table><TableHeader className="bg-muted/50"><TableRow><TableHead className="w-12"><Checkbox checked={selectedIds.size === failedStudents.length} onCheckedChange={(c) => setSelectedIds(c ? new Set(failedStudents.map(s => s.student.id)) : new Set())} /></TableHead><TableHead className="text-center">রোল</TableHead><TableHead>নাম</TableHead><TableHead className="text-center">ফেল সংখ্যা</TableHead></TableRow></TableHeader><TableBody>{failedStudents.map(res => (
                        <TableRow key={res.student.id}><TableCell><Checkbox checked={selectedIds.has(res.student.id)} onCheckedChange={(c) => { const n = new Set(selectedIds); if (c) n.add(res.student.id); else n.delete(res.student.id); setSelectedIds(n); }} /></TableCell><TableCell className="text-center font-bold">{res.student.roll.toLocaleString('bn-BD')}</TableCell><TableCell className="font-bold">{res.student.studentNameBn}</TableCell><TableCell className="text-center text-rose-600 font-black">F{res.failedSubjectsCount}</TableCell></TableRow>
                    ))}</TableBody></Table></div>
                    <div className="flex justify-end"><AlertDialog><AlertDialogTrigger asChild><Button size="lg" disabled={selectedIds.size === 0}>নির্বাচিতদের উত্তীর্ণ করুন</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle><AlertDialogDescription>{selectedIds.size.toLocaleString('bn-BD')} জনকে পরের শ্রেণিতে উঠানো হবে।</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>বাতিল</AlertDialogCancel><AlertDialogAction onClick={handlePromote}>উত্তীর্ণ করুন</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
                </div>
            )}
        </div>
    );
};

const BulkUploadTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { toast } = useToast(); const { selectedYear } = useAcademicYear(); const db = useFirestore(); const { user, hasPermission } = useAuth();
    const [examName, setExamName] = useState(''); const [className, setClassName] = useState(''); const [group, setGroup] = useState(''); const [isLoading, setIsLoading] = useState(false); const fileInputRef = useRef<HTMLInputElement>(null);
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file || !db || !examName || !className) return;
        setIsLoading(true); const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const workbook = XLSX.read(ev.target?.result, { type: 'array' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
                const studentList = allStudents.filter(s => s.academicYear === selectedYear && s.className === className);
                const resultsToSave = new Map<string, ClassResult>();
                for (const row of json) {
                    const roll = parseInt(String(row['রোল'] || row['roll'] || '').replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]), 10);
                    const student = studentList.find(s => s.roll === roll); if (!student) continue;
                    const subs = getSubjects(student.className, student.group);
                    for (const header of Object.keys(row)) {
                        const m = header.match(/(.+?) \((.+)\)/); if (!m) continue;
                        const subjectName = m[1].trim(); const type = m[2].trim();
                        const si = subs.find(s => s.name === subjectName); if (!si) continue;
                        const docId = `${selectedYear}_${examName.replace(/\s+/g, '-')}_${student.className}_${student.group || 'none'}_${subjectName.replace(/\s+/g, '-')}`;
                        if (!resultsToSave.has(docId)) resultsToSave.set(docId, { academicYear: selectedYear, examName, className: student.className, group: student.group, subject: subjectName, fullMarks: si.fullMarks, results: [] });
                        const cr = resultsToSave.get(docId)!; let sr = cr.results.find(r => r.studentId === student.id);
                        if (!sr) { sr = { studentId: student.id }; cr.results.push(sr); }
                        const val = parseInt(String(row[header] || '').replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]), 10);
                        if (!isNaN(val)) { if (type === 'লিখিত') sr.written = val; else if (type === 'বহুনির্বাচনী') sr.mcq = val; else if (type === 'ব্যবহারিক') sr.practical = val; }
                    }
                }
                const prom = Array.from(resultsToSave.values()).map(r => saveClassResults(db, r));
                await Promise.all(prom); toast({ title: "সফল", description: "ফলাফল আপলোড সম্পন্ন।" });
            } catch (err: any) { toast({ variant: "destructive", title: "ভুল", description: err.message }); } finally { setIsLoading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
        };
        reader.readAsArrayBuffer(file);
    };
    return (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end p-4 border rounded-lg bg-white/50"><div className="space-y-2"><Label>পরীক্ষা</Label><Input value={examName} onChange={e => setExamName(e.target.value)} placeholder="উদা: বার্ষিক পরীক্ষা" /></div><div className="space-y-2"><Label>শ্রেণি</Label><Select value={className} onValueChange={setClassName}><SelectTrigger className="bg-white"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent><SelectItem value="6">৬ষ্ঠ</SelectItem><SelectItem value="7">৭ম</SelectItem><SelectItem value="8">৮ম</SelectItem><SelectItem value="9">৯ম</SelectItem><SelectItem value="10">১০ম</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>শাখা (৯ম-১০ম)</Label><Select value={group} onValueChange={setGroup} disabled={parseInt(className) < 9}><SelectTrigger className="bg-white"><SelectValue placeholder="সকল" /></SelectTrigger><SelectContent><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent></Select></div><Button onClick={() => fileInputRef.current?.click()} disabled={isLoading || !examName || !className} className="shadow-md"><FileUp className="mr-2 h-4 w-4" /> {isLoading ? 'আপলোড হচ্ছে...' : 'Excel আপলোড'}</Button><input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" /></div>);
};

export default function ResultsPage() {
    const [isClient, setIsClient] = useState(false); const [allStudents, setAllStudents] = useState<Student[]>([]); const [isLoading, setIsLoading] = useState(true);
    const db = useFirestore(); const { selectedYear } = useAcademicYear(); const { user, hasPermission } = useAuth();
    const canViewRes = hasPermission('manage:results') || hasPermission('input:results');
    useEffect(() => {
        setIsClient(true); if (!db || !user) return;
        const unsubscribe = onSnapshot(query(collection(db, "students")), (snap) => { setAllStudents(snap.docs.map(studentFromDoc)); setIsLoading(false); }, (err) => { if (err.code !== 'permission-denied') errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'students', operation: 'list' })); setIsLoading(false); });
        return () => unsubscribe();
    }, [db, user]);
    if (isClient && !canViewRes && !hasPermission('view:merit-list') && user?.role !== 'admin') return (<div className="flex min-h-screen w-full flex-col bg-violet-50"><Header /><main className="flex flex-1 items-center justify-center p-4"><Card className="p-8 text-center"><AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" /><h2 className="text-xl font-bold">প্রবেশাধিকার সংরক্ষিত</h2></Card></main></div>);
    return (
        <div className="flex min-h-screen w-full flex-col bg-violet-50 font-kalpurush">
            <Header />
            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-80">
                <Card className="border-2 border-primary/10 shadow-xl overflow-hidden">
                    <CardHeader className="bg-white/50 border-b">
                        <CardTitle className="text-2xl font-black text-primary">ফলাফল ব্যবস্থাপনা</CardTitle>
                        {isClient && <p className="text-xs font-bold text-muted-foreground">শিক্ষাবর্ষ: {selectedYear.toLocaleString('bn-BD')}</p>}
                    </CardHeader>
                    <CardContent className="pt-4">
                        {isClient ? (
                            <Tabs defaultValue={canViewRes ? "sheet" : "merit"}>
                                <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 bg-muted p-1 h-auto gap-1">
                                    {canViewRes && <TabsTrigger value="management" className="text-xs py-2 font-bold">নম্বর ইনপুট</TabsTrigger>}
                                    {canViewRes && <TabsTrigger value="sheet" className="text-xs py-2 font-bold">ফলাফল শিট</TabsTrigger>}
                                    {hasPermission('view:merit-list') && <TabsTrigger value="merit" className="text-xs py-2 font-bold">মেধা তালিকা</TabsTrigger>}
                                    {hasPermission('promote:students') && <TabsTrigger value="special-promotion" className="text-xs py-2 font-bold">বিশেষ পাশ</TabsTrigger>}
                                    {canViewRes && <TabsTrigger value="upload" className="text-xs py-2 font-bold">Excel আপলোড</TabsTrigger>}
                                </TabsList>
                                <TabsContent value="management" className="mt-4"><MarkManagementTab allStudents={allStudents} /></TabsContent>
                                <TabsContent value="sheet" className="mt-4"><ResultSheetTab allStudents={allStudents} /></TabsContent>
                                <TabsContent value="merit" className="mt-4"><MeritListTab allStudents={allStudents} /></TabsContent>
                                <TabsContent value="special-promotion" className="mt-4"><SpecialPromotionTab allStudents={allStudents} /></TabsContent>
                                <TabsContent value="upload" className="mt-4"><BulkUploadTab allStudents={allStudents} /></TabsContent>
                            </Tabs>
                        ) : (<div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>)}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
