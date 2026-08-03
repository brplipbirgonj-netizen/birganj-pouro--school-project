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
import { getSubjects, Subject as SubjectType, subjectNameNormalization } from '@/lib/subjects';
import { saveClassResults, getResultsForClass, getAllResults, deleteClassResult, ClassResult, StudentResult } from '@/lib/results-data';
import { processStudentResults, StudentProcessedResult } from '@/lib/results-calculation';
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, FileUp, Download, FilePen, BookOpen, AlertCircle, Trophy, Printer, Loader2, FileSpreadsheet, CheckCircle2, Save, Star, ChevronRight, LayoutGrid } from 'lucide-react';
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

const classNamesMap: { [key: string]: string } = { '6': 'ষষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };
const groupNamesMap: { [key: string]: string } = { 'science': 'বিজ্ঞান', 'arts': 'মানবিক', 'commerce': 'ব্যবসায় শিক্ষা', 'all': 'সকল শাখা' };

type Marks = {
    written?: number;
    mcq?: number;
    practical?: number;
}

const normalize = (name: string) => {
    if (!name) return "";
    const trimmed = name.trim();
    return (subjectNameNormalization[trimmed] || trimmed).toLowerCase();
};

const MarkManagementTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user, hasPermission } = useAuth();
    
    const isSubjectPermitted = useCallback((cls: string, sub: string) => {
        if (user?.role === 'admin') return true;
        if (hasPermission('manage:results')) return true;
        return (user as any)?.marksPermissions?.[cls]?.includes(sub) ?? false;
    }, [user, hasPermission]);

    const [exams, setExams] = useState<Exam[]>([]);
    const [examName, setExamName] = useState('');
    const [className, setClassName] = useState('');
    const [group, setGroup] = useState('');
    const [subject, setSubject] = useState('');
    const [fullMarks, setFullMarks] = useState<number>(100);
    
    const [availableSubjects, setAvailableSubjects] = useState<SubjectType[]>([]);
    const [selectedSubjectInfo, setSelectedSubjectInfo] = useState<SubjectType | null>(null);

    const [studentsForClass, setStudentsForClass] = useState<Student[]>([]);
    const [marks, setMarks] = useState<Map<string, Marks>>(new Map());
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const canUploadMarks = hasPermission('upload:marks');

    useEffect(() => {
        if (!db || !user) return;
        getExams(db, selectedYear).then(setExams);
    }, [db, selectedYear, user]);

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
        } else setSelectedSubjectInfo(null);
    }, [subject, availableSubjects]);
    
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
        const studentMarks = { ...(newMarks.get(studentId) || {}) };
        studentMarks[field] = isNaN(numValue!) ? undefined : numValue;
        newMarks.set(studentId, studentMarks);
        setMarks(newMarks);
    };

    const handleSaveResults = () => {
        if (!db || !user) return;
        if (!isSubjectPermitted(className, subject)) { toast({ variant: 'destructive', title: 'পারমিশন নেই' }); return; }
        if (studentsForClass.length === 0) { toast({ variant: 'destructive', title: 'কোনো শিক্ষার্থী নেই' }); return; }
        
        const resultsData: StudentResult[] = Array.from(marks.entries()).map(([studentId, marks]) => ({ studentId, ...marks }));
        saveClassResults(db, { 
            academicYear: selectedYear, 
            examName, 
            className, 
            group: group || undefined, 
            subject, 
            fullMarks: fullMarks, 
            results: resultsData 
        }).then(() => {
            toast({ title: 'ফলাফল সেভ হয়েছে' });
        }).catch(() => {});
    };

    const handleDownloadSample = () => {
       const ws = XLSX.utils.aoa_to_sheet([['রোল', 'লিখিত', 'বহুনির্বাচনী', 'ব্যবহারিক']]);
       const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'নম্বর নমুনা'); XLSX.writeFile(wb, 'marks_sample.xlsx');
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!db || !user || !className || !subject || !examName) { toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ" }); return; }
        if (!isSubjectPermitted(className, subject)) { toast({ variant: 'destructive', title: 'পারমিশন নেই' }); return; }
        if (!canUploadMarks) { toast({ variant: 'destructive', title: 'পারমিশন নেই', description: 'এক্সেল ফাইল আপলোড করার অনুমতি নেই।' }); return; }

        const file = event.target.files?.[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const workbook = XLSX.read(e.target?.result, { type: 'array' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                if (json.length === 0 || studentsForClass.length === 0) return;
                const newMarks = new Map(marks); let count = 0;
                for (const row of json as any[]) {
                    const rollStr = String(row['রোল'] || row['roll'] || '');
                    const roll = parseInt(rollStr.replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]), 10);
                    const student = studentsForClass.find(s => s.roll === roll);
                    if (!student) continue;
                    const sm = { ...(newMarks.get(student.id) || {}) };
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
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end p-4 border rounded-lg bg-white/50">
                <div className="space-y-2">
                    <Label>পরীক্ষা</Label>
                    <Select value={examName} onValueChange={setExamName}>
                        <SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="পরীক্ষা নির্বাচন" /></SelectTrigger>
                        <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="class">শ্রেণি</Label>
                    <Select value={className} onValueChange={(v) => { setClassName(v); setGroup(''); setSubject(''); }}>
                        <SelectTrigger id="class" className="bg-white h-9 text-xs"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger>
                        <SelectContent><SelectItem value="6">৬ষ্ঠ</SelectItem><SelectItem value="7">৭ম</SelectItem><SelectItem value="8">৮ম</SelectItem><SelectItem value="9">৯ম</SelectItem><SelectItem value="10">১০ম</SelectItem></SelectContent>
                    </Select>
                </div>
                {showGroupSelector && (
                    <div className="space-y-2">
                        <Label htmlFor="group">গ্রুপ</Label>
                        <Select value={group} onValueChange={setGroup} required>
                            <SelectTrigger id="group" className="bg-white h-9 text-xs"><SelectValue placeholder="গ্রুপ নির্বাচন" /></SelectTrigger>
                            <SelectContent><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent>
                        </Select>
                    </div>
                )}
                <div className="space-y-2">
                    <Label htmlFor="subject">বিষয়</Label>
                    <Select value={subject} onValueChange={setSubject} disabled={!className || (showGroupSelector && !group)}>
                        <SelectTrigger id="subject" className="bg-white h-9 text-xs"><SelectValue placeholder="বিষয় নির্বাচন" /></SelectTrigger>
                        <SelectContent>{availableSubjects.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <Button onClick={handleLoadStudents} disabled={isLoadingStudents || !subject || !examName} className="h-9 text-xs font-black">{isLoadingStudents ? 'লোড হচ্ছে...' : 'লোড করুন'}</Button>
            </div>
            
            {studentsForClass.length > 0 && (
                <Card className="overflow-hidden border-2 shadow-lg">
                    <CardHeader className="bg-muted/30 p-3 flex flex-row justify-between items-center space-y-0 border-b">
                         <div className="flex items-center gap-4">
                            <span className="font-black text-sm text-primary">{subject} ({studentsForClass.length.toLocaleString('bn-BD')} জন)</span>
                            <Badge variant="outline" className="bg-white font-black text-[10px] px-3">পূর্ণমান: {fullMarks.toLocaleString('bn-BD')}</Badge>
                         </div>
                         {canUploadMarks && (
                             <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handleDownloadSample} className="h-8 text-[10px] bg-white"><Download className="mr-2 h-3.5 w-3.5" /> নমুনা</Button>
                                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="h-8 text-[10px] bg-white"><FileUp className="mr-2 h-3.5 w-3.5" /> আপলোড</Button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                            </div>
                         )}
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[500px] overflow-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-white z-20 shadow-sm">
                                    <TableRow>
                                        <TableHead className="w-20 text-center font-black">রোল</TableHead>
                                        <TableHead className="font-black">শিক্ষার্থীর নাম</TableHead>
                                        <TableHead className="w-32 font-black">লিখিত</TableHead>
                                        <TableHead className="w-32 font-black">MCQ</TableHead>
                                        {selectedSubjectInfo?.practical && <TableHead className="w-32 font-black">ব্যবহারিক</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {studentsForClass.map(student => (
                                        <TableRow key={student.id} className="hover:bg-accent/5">
                                            <TableCell className="font-black text-center">{student.roll.toLocaleString('bn-BD')}</TableCell>
                                            <TableCell className="font-bold text-slate-700">{student.studentNameBn}</TableCell>
                                            <TableCell><Input type="number" value={marks.get(student.id)?.written || ''} onChange={(e) => handleMarkChange(student.id, 'written', e.target.value)} className="h-9 font-bold" /></TableCell>
                                            <TableCell><Input type="number" value={marks.get(student.id)?.mcq || ''} onChange={(e) => handleMarkChange(student.id, 'mcq', e.target.value)} className="h-9 font-bold" /></TableCell>
                                            {selectedSubjectInfo?.practical && <TableCell><Input type="number" value={marks.get(student.id)?.practical || ''} onChange={(e) => handleMarkChange(student.id, 'practical', e.target.value)} className="h-9 font-bold" /></TableCell>}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="flex justify-end p-4 border-t bg-muted/10"><Button onClick={handleSaveResults} size="lg" className="px-10 font-black shadow-md">প্রাপ্ত নম্বর সেভ করুন</Button></div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

const FullMarksTab = () => {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user, hasPermission } = useAuth();
    
    const [exams, setExams] = useState<Exam[]>([]);
    const [examName, setExamName] = useState('');
    const [savedResults, setSavedResults] = useState<ClassResult[]>([]);
    const [fullMarksInputs, setFullMarksInputs] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState<string | null>(null);

    useEffect(() => {
        if (!db || !user) return;
        getExams(db, selectedYear).then(setExams);
    }, [db, selectedYear, user]);

    const updateSavedResults = useCallback(async () => {
        if (!db || !user) return;
        const allResults = await getAllResults(db, selectedYear, examName || undefined);
        setSavedResults(allResults);
    }, [db, selectedYear, user, examName]);
    
    useEffect(() => {
        updateSavedResults();
    }, [updateSavedResults]);

    const isSubjectPermitted = useCallback((cls: string, sub: string) => {
        if (user?.role === 'admin') return true;
        if (hasPermission('manage:results') || hasPermission('manage:full-marks')) return true;
        return (user as any)?.marksPermissions?.[cls]?.includes(sub) ?? false;
    }, [user, hasPermission]);

    const handleUpdateFullMarks = async (cls: string, sub: string, exam: string, currentRecord: ClassResult | null, newVal: string) => {
        const val = parseInt(newVal, 10);
        if (isNaN(val) || !db || !user) return;
        if (!isSubjectPermitted(cls, sub)) {
            toast({ variant: 'destructive', title: 'পারমিশন নেই' });
            return;
        }
        
        const inputKey = `${cls}-${sub}-${exam}`;
        setIsSaving(inputKey);

        try {
            if (currentRecord) {
                await saveClassResults(db, { ...currentRecord, fullMarks: val });
            } else {
                await saveClassResults(db, {
                    academicYear: selectedYear,
                    examName: exam,
                    className: cls,
                    subject: sub,
                    fullMarks: val,
                    results: []
                });
            }
            toast({ title: 'পূর্ণমান সংরক্ষিত হয়েছে' });
            updateSavedResults();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(null);
        }
    };

    const handleDeleteResult = (id: string) => {
        if (!db || !id || !user) return;
        deleteClassResult(db, id).then(() => { updateSavedResults(); toast({ title: 'ফলাফল মোছা হয়েছে' }); }).catch(() => {});
    }

    const classes = ['6', '7', '8', '9', '10'];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="max-w-md p-4 border rounded-lg bg-white/50 shadow-sm">
                <div className="space-y-2">
                    <Label className="font-bold text-sm">১. পরীক্ষা নির্বাচন করুন</Label>
                    <Select value={examName} onValueChange={setExamName}>
                        <SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="পরীক্ষা নির্বাচন করুন" /></SelectTrigger>
                        <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>

            {examName && (
                <div className="space-y-4">
                    <h3 className="font-black text-xl text-primary flex items-center gap-2 px-2">
                        <CheckCircle2 className="h-6 w-6" /> বিষয় ভিত্তিক পূর্ণমান তালিকা ({examName})
                    </h3>
                    
                    <Accordion type="multiple" defaultValue={['6']} className="w-full space-y-3">
                        {classes.map(cls => {
                            const subjects = getSubjects(cls).filter(s => s.isExamSubject !== false);
                            const uniqueSubjects = Array.from(new Set(subjects.map(s => s.name)))
                                .map(name => subjects.find(s => s.name === name)!);

                            return (
                                <AccordionItem value={cls} key={cls} className="border-2 rounded-xl bg-white overflow-hidden shadow-sm">
                                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/10">
                                        <span className="font-black text-lg text-slate-800">{classNamesMap[cls]} শ্রেণি</span>
                                        <Badge variant="secondary" className="ml-2 font-bold">{uniqueSubjects.length.toLocaleString('bn-BD')} টি বিষয়</Badge>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-0 border-t">
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader className="bg-muted/30">
                                                    <TableRow>
                                                        <TableHead className="pl-6 font-bold">বিষয়ের নাম</TableHead>
                                                        <TableHead className="text-center font-bold">অবস্থা</TableHead>
                                                        <TableHead className="w-48 text-center font-bold">পূর্ণমান (Full Marks)</TableHead>
                                                        <TableHead className="text-right pr-6 font-bold">কার্যক্রম</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {uniqueSubjects.map((subInfo, i) => {
                                                        const existingRecord = savedResults.find(r => 
                                                            r.className === cls && 
                                                            r.subject === subInfo.name && 
                                                            r.examName === examName
                                                        );
                                                        
                                                        const inputKey = `${cls}-${subInfo.name}-${examName}`;
                                                        const inputValue = fullMarksInputs[inputKey] !== undefined 
                                                            ? fullMarksInputs[inputKey] 
                                                            : (existingRecord?.fullMarks?.toString() || subInfo.fullMarks.toString());
                                                        
                                                        const isPermitted = isSubjectPermitted(cls, subInfo.name);
                                                        const hasData = existingRecord && existingRecord.results.length > 0;

                                                        return (
                                                            <TableRow key={i} className="h-16 border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                                                                <TableCell className="font-black pl-6 text-primary text-base">
                                                                    {subInfo.name}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    {hasData ? (
                                                                        <Badge className="bg-emerald-600 text-[10px] font-black">নম্বর এন্ট্রি হয়েছে</Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground">বকেয়া</Badge>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <div className="flex items-center gap-2 justify-center">
                                                                        <Input 
                                                                            type="number" 
                                                                            value={inputValue}
                                                                            onChange={(e) => setFullMarksInputs(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                                                            className="h-10 w-24 text-center font-black bg-white border-2 text-lg" 
                                                                            disabled={!isPermitted} 
                                                                        />
                                                                        <Button 
                                                                            variant="outline" 
                                                                            size="icon" 
                                                                            className={cn(
                                                                                "h-10 w-10 shrink-0 shadow-sm border-2",
                                                                                isSaving === inputKey ? "text-slate-400" : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                                                            )}
                                                                            disabled={!isPermitted || isSaving === inputKey}
                                                                            onClick={() => handleUpdateFullMarks(cls, subInfo.name, examName, existingRecord || null, inputValue)}
                                                                        >
                                                                            {isSaving === inputKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-5 w-5" />}
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right pr-6">
                                                                    {existingRecord && (
                                                                        <AlertDialog>
                                                                            <AlertDialogTrigger asChild>
                                                                                <Button variant="outline" size="icon" className="h-9 w-9 text-rose-600 border-rose-100 hover:bg-rose-50" disabled={!isPermitted}>
                                                                                    <Trash2 className="h-4 w-4" />
                                                                                </Button>
                                                                            </AlertDialogTrigger>
                                                                            <AlertDialogContent>
                                                                                <AlertDialogHeader>
                                                                                    <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                                                                                    <AlertDialogDescription>
                                                                                        এই বিষয়ের জন্য এন্ট্রি করা সকল ফলাফল মুছে যাবে। (পূর্ণমান সংরক্ষিত থাকবে না)
                                                                                    </AlertDialogDescription>
                                                                                </AlertDialogHeader>
                                                                                <AlertDialogFooter>
                                                                                    <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                                                                    <AlertDialogAction onClick={() => handleDeleteResult(existingRecord.id!)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">মুছে ফেলুন</AlertDialogAction>
                                                                                </AlertDialogFooter>
                                                                            </AlertDialogContent>
                                                                        </AlertDialog>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            );
                        })}
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
    const [classResults, setClassResults] = useState<ClassResult[]>([]);

    useEffect(() => { 
        if (db && user) getExams(db, selectedYear).then(setExams); 
    }, [db, selectedYear, user]);

    const handleViewResults = async () => {
        if (!examName || !className || !db || !user) { toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ' }); return; }
        setIsLoading(true);
        const students = allStudents.filter(s => s.academicYear === selectedYear && s.className === className && (parseInt(className) < 9 || groupFilter === 'all' || (s.group || '').toLowerCase().trim() === groupFilter)).sort((a,b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
        if (students.length === 0) { toast({ title: 'কোনো শিক্ষার্থী নেই' }); setProcessedResults([]); setIsLoading(false); return; }
        const allResults = await getAllResults(db, selectedYear, examName);
        const classRes = allResults.filter(r => r.className === className);
        setClassResults(classRes);
        const subs = getSubjects(className, groupFilter === 'all' ? undefined : groupFilter).filter(s => s.isExamSubject !== false);
        setProcessedResults(processStudentResults(students, classRes, subs));
        setIsLoading(false);
    };

    const handleDownloadExcel = () => {
        if (processedResults.length === 0) return;
        const data: any[] = [];
        const subs = getSubjects(className, groupFilter === 'all' ? undefined : groupFilter).filter(s => {
            if (!s.isExamSubject) return false;
            const matchingRecord = classResults.find(r => normalize(r.subject) === normalize(s.name));
            const effectiveFullMarks = matchingRecord?.fullMarks ?? s.fullMarks;
            return effectiveFullMarks > 0;
        });

        processedResults.forEach(res => {
            const row: any = { 'রোল': res.student.roll, 'শিক্ষার্থীর নাম': res.student.studentNameBn, 'বিভাগ': groupNamesMap[res.student.group || ''] || res.student.group || 'সাধারণ' };
            subs.forEach(s => {
                const sr = res.subjectResults.get(s.name);
                const isEng = s.name.includes('ইংরেজি');
                if (!isEng) { 
                    row[`${s.name} (লিখিত)`] = sr?.written ?? '-'; 
                    row[`${s.name} (MCQ)`] = sr?.mcq ?? '-'; 
                    if (s.practical) row[`${s.name} (ব্যবহারিক)`] = sr?.practical ?? '-'; 
                }
                row[`${s.name} (প্রাপ্ত)`] = sr?.marks ?? '-'; 
                row[`${s.name} (গ্রেড)`] = sr?.grade ?? '-'; 
                row[`${s.name} (পয়েন্ট)`] = sr?.point ?? '-';
            });
            row['মোট নম্বর'] = res.totalMarks; 
            row['জি.পি.এ'] = res.gpa.toFixed(2); 
            row['গ্রেড'] = res.isPass ? res.finalGrade : `F${res.failedSubjectsCount}`; 
            row['মেধাস্থান'] = res.isPass ? (res.meritPosition || '-') : 'ফেল';
            data.push(row);
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new(); 
        XLSX.utils.book_append_sheet(wb, ws, "Result Sheet");
        XLSX.writeFile(wb, `${examName}_${classNamesMap[className]}_Result.xlsx`);
        toast({ title: 'Excel ডাউনলোড সম্পন্ন হয়েছে' });
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

    const subBgColors = ['bg-[#f0f9ff]', 'bg-[#ecfdf5]', 'bg-[#fffbeb]', 'bg-[#f5f3ff]', 'bg-[#fff7ed]', 'bg-[#fff1f2]'];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end p-4 border rounded-lg bg-white/50 shadow-sm">
                <div className="space-y-2">
                    <Label className="font-bold text-xs">পরীক্ষা</Label>
                    <Select value={examName} onValueChange={setExamName}>
                        <SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                        <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="font-bold text-xs">শ্রেণি</Label>
                    <Select value={className} onValueChange={c => { setClassName(c); setGroupFilter('all'); setProcessedResults([]); }}>
                        <SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                        <SelectContent><SelectItem value="6">৬ষ্ঠ</SelectItem><SelectItem value="7">৭ম</SelectItem><SelectItem value="8">৮ম</SelectItem><SelectItem value="9">৯ম</SelectItem><SelectItem value="10">১০ম</SelectItem></SelectContent>
                    </Select>
                </div>
                {parseInt(className) >= 9 && (
                    <div className="space-y-2">
                        <Label className="font-bold text-xs">শাখা</Label>
                        <Select value={groupFilter} onValueChange={setGroupFilter}>
                            <SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="সকল শাখা" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">সকল শাখা</SelectItem><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent>
                        </Select>
                    </div>
                )}
                <Button onClick={handleViewResults} disabled={isLoading || !examName || !className} className="lg:col-span-2 shadow-md h-9 font-black text-xs">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ফলাফল দেখুন'}</Button>
                <Button onClick={handleDownloadExcel} disabled={processedResults.length === 0} variant="outline" className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 h-9 font-black text-xs"><FileSpreadsheet className="h-3 w-3 mr-1" /> Excel</Button>
            </div>

            {Object.keys(groupedData).map(gk => {
                const results = groupedData[gk];
                const subs = getSubjects(className, gk === 'all' ? undefined : gk).filter(s => {
                    if (!s.isExamSubject) return false;
                    const matchingRecord = classResults.find(r => normalize(r.subject) === normalize(s.name));
                    const effectiveFullMarks = matchingRecord?.fullMarks ?? s.fullMarks;
                    return effectiveFullMarks > 0;
                });

                return (
                    <div key={gk} className="space-y-0">
                        <div className="flex justify-between items-center bg-primary/10 p-2 rounded-t-lg border-x-2 border-t-2 border-black">
                            <h3 className="font-black text-primary text-sm uppercase">শাখা: {groupNamesMap[gk] || gk}</h3>
                            <Badge variant="secondary" className="font-black px-3 text-xs">মোট: {results.length.toLocaleString('bn-BD')} জন</Badge>
                        </div>
                        <div className="table-container !border-2 !border-black relative rounded-b-lg !overflow-auto">
                            <table className="min-w-max border-separate border-spacing-0 w-full">
                                <thead className="z-30">
                                    <tr>
                                        <th rowSpan={2} className="text-center font-black bg-white border-r-2 border-b-2 border-black sticky left-0 top-0 z-40 w-[60px] text-[10px] p-1">রোল</th>
                                        <th rowSpan={2} className="text-center font-black bg-white border-r-2 border-b-2 border-black sticky left-[60px] top-0 z-40 min-w-[180px] text-[10px] p-1">শিক্ষার্থীর নাম</th>
                                        {subs.map((s, idx) => (
                                            <th 
                                                key={s.name} 
                                                colSpan={s.name.includes('ইংরেজি') ? 3 : (s.practical ? 6 : 5)} 
                                                className={cn(
                                                    "text-center border-r-2 border-b-2 border-black font-black py-1 text-[9px] sticky top-0 z-30 px-2",
                                                    subBgColors[idx % subBgColors.length]
                                                )}
                                            >
                                                {s.name}
                                            </th>
                                        ))}
                                        <th rowSpan={2} className="text-center font-black border-l-2 border-r-2 border-b-2 border-black text-[9px] bg-[#fff1f2] p-1 sticky top-0 right-[240px] z-40 w-[60px]">মোট</th>
                                        <th rowSpan={2} className="text-center font-black border-r-2 border-b-2 border-black text-[9px] bg-[#fff1f2] p-1 sticky top-0 right-[180px] z-40 w-[60px]">GPA</th>
                                        <th rowSpan={2} className="text-center font-black border-r-2 border-b-2 border-black text-[9px] bg-[#fff1f2] p-1 sticky top-0 right-[120px] z-40 w-[60px]">গ্রেড</th>
                                        <th rowSpan={2} className="text-center font-black border-r-2 border-b-2 border-black text-[9px] bg-[#fff1f2] p-1 sticky top-0 right-[60px] z-40 w-[60px]">মেধা</th>
                                        <th rowSpan={2} className="text-center font-black border-b-2 border-black text-[9px] bg-[#fff1f2] p-1 sticky top-0 right-0 z-40 w-[60px]">প্রিন্ট</th>
                                    </tr>
                                    <tr>
                                        {subs.map((s, idx) => {
                                            const isEng = s.name.includes('ইংরেজি');
                                            const bgColor = subBgColors[idx % subBgColors.length];
                                            return (
                                                <React.Fragment key={s.name}>
                                                    {!isEng && (
                                                        <>
                                                            <th className={cn("text-[8px] text-center border-r-2 border-b-2 border-black font-bold p-0.5 sticky top-7 z-20 w-10", bgColor)}>লিখিত</th>
                                                            <th className={cn("text-[8px] text-center border-r-2 border-b-2 border-black font-bold p-0.5 sticky top-7 z-20 w-10", bgColor)}>MCQ</th>
                                                            {s.practical && <th className={cn("text-[8px] text-center border-r-2 border-b-2 border-black font-bold p-0.5 sticky top-7 z-20 w-10", bgColor)}>ব্যবহারিক</th>}
                                                        </>
                                                    )}
                                                    <th className={cn("text-[8px] text-center border-r-2 border-b-2 border-black font-black bg-blue-200 text-blue-950 p-0.5 sticky top-7 z-20 w-12", bgColor)}>প্রাপ্ত</th>
                                                    <th className={cn("text-[8px] text-center border-r-2 border-b-2 border-black font-bold p-0.5 sticky top-7 z-20 w-8", bgColor)}>গ্রেড</th>
                                                    <th className={cn("text-[8px] text-center border-r-2 border-b-2 border-black font-bold p-0.5 sticky top-7 z-20 w-10", bgColor)}>পয়েন্ট</th>
                                                </React.Fragment>
                                            )
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map(res => (
                                        <tr key={res.student.id} className="h-8 hover:bg-slate-50 transition-colors">
                                            <td className="text-center font-black sticky left-0 z-20 bg-white border-r-2 border-b-2 border-black text-[10px] p-0.5 w-[60px]">{res.student.roll.toLocaleString('bn-BD')}</td>
                                            <td className="font-bold sticky left-[60px] z-20 bg-white border-r-2 border-b-2 border-black text-[10px] p-0.5 px-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[180px]">{res.student.studentNameBn}</td>
                                            {subs.map((s, idx) => {
                                                const sr = res.subjectResults.get(s.name);
                                                const isEng = s.name.includes('ইংরেজি');
                                                const bgColor = subBgColors[idx % subBgColors.length];
                                                return (
                                                    <React.Fragment key={s.name}>
                                                        {!isEng && (
                                                            <>
                                                                <td className={cn("text-center border-r-2 border-b-2 border-black text-[9px] p-0.5 font-medium", bgColor)}>{sr?.written?.toLocaleString('bn-BD') ?? '-' }</td>
                                                                <td className={cn("text-center border-r-2 border-b-2 border-black text-[9px] p-0.5 font-medium", bgColor)}>{sr?.mcq?.toLocaleString('bn-BD') ?? '-' }</td>
                                                                {s.practical && <td className={cn("text-center border-r-2 border-b-2 border-black text-[9px] p-0.5 font-medium", bgColor)}>{sr?.practical?.toLocaleString('bn-BD') ?? '-' }</td>}
                                                            </>
                                                        )}
                                                        <td className={cn("text-center border-r-2 border-b-2 border-black font-black bg-blue-100 text-blue-950 text-[10px] p-0.5", bgColor)}>{sr?.marks?.toLocaleString('bn-BD') ?? '-' }</td>
                                                        <td className={cn("text-center border-r-2 border-b-2 border-black text-[9px] font-black p-0.5", bgColor, sr && !sr.isPass && "text-rose-700 bg-rose-100")}>{sr?.grade ?? '-' }</td>
                                                        <td className={cn("text-center border-r-2 border-b-2 border-black text-[9px] p-0.5 font-bold", bgColor)}>{sr?.point?.toFixed(2).toLocaleString('bn-BD') ?? '-' }</td>
                                                    </React.Fragment>
                                                )
                                            })}
                                            <td className="text-center font-black text-primary border-r-2 border-b-2 border-black text-[10px] p-0.5 sticky right-[240px] bg-[#fff1f2] z-10 w-[60px]">{res.totalMarks.toLocaleString('bn-BD')}</td>
                                            <td className="text-center font-black border-r-2 border-b-2 border-black text-[10px] p-0.5 sticky right-[180px] bg-[#fff1f2] z-10 w-[60px]">{res.gpa.toFixed(2).toLocaleString('bn-BD')}</td>
                                            <td className={cn("text-center font-black border-r-2 border-b-2 border-black text-[9px] p-0.5 sticky right-[120px] bg-[#fff1f2] z-10 w-[60px]", !res.isPass && "text-rose-700")}>{res.isPass ? res.finalGrade : `F${res.failedSubjectsCount}`}</td>
                                            <td className={cn("text-center font-black border-r-2 border-b-2 border-black text-[9px] p-0.5 sticky right-[60px] bg-[#fff1f2] z-10 w-[60px]", !res.isPass && "text-rose-500 italic text-[8px]")}>{res.isPass ? (res.meritPosition?.toLocaleString('bn-BD') || '-') : 'ফেল'}</td>
                                            <td className="text-center p-0.5 border-b-2 border-black sticky right-0 bg-[#fff1f2] z-10 w-[60px]">
                                                <Link href={`/marksheet/${res.student.id}?academicYear=${selectedYear}&examName=${examName}`} target="_blank">
                                                    <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-white shadow-sm border border-slate-200"><Printer className="h-3 w-3 text-primary" /></Button>
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const MeritListTab = ({ allStudents }: { allStudents: Student[] }) => {
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

    useEffect(() => { 
        if (db && user) getExams(db, selectedYear).then(setExams); 
    }, [db, selectedYear, user]);

    const handleViewMeritList = async () => {
        if (!examName || !className || !db || !user) { toast({ variant: 'destructive', title: 'তথ্য দিন' }); return; }
        setIsLoading(true);
        const students = allStudents.filter(s => s.academicYear === selectedYear && s.className === className && (parseInt(className) < 9 || groupFilter === 'all' || (s.group || '').toLowerCase().trim() === groupFilter));
        if (students.length === 0) { setProcessedResults([]); setIsLoading(false); return; }
        const allRes = await getAllResults(db, selectedYear, examName);
        const classRes = allRes.filter(r => r.className === className);
        const subs = getSubjects(className, groupFilter === 'all' ? undefined : groupFilter).filter(s => s.isExamSubject !== false);
        const results = processStudentResults(students, classRes, subs);
        setProcessedResults(results.sort((a, b) => { 
            if (a.isPass !== b.isPass) return a.isPass ? -1 : 1; 
            if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks; 
            return a.student.roll - b.student.roll; 
        }));
        setIsLoading(false);
    };

    const handlePrint = () => { 
        if (examName && className) window.open(`/results/merit-list?academicYear=${selectedYear}&examName=${examName}&className=${className}&group=${groupFilter}`, '_blank'); 
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end p-4 border rounded-lg bg-white/50 shadow-sm">
                <div className="space-y-2"><Label className="font-bold text-sm">পরীক্ষা</Label><Select value={examName} onValueChange={setExamName}><SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label className="font-bold text-sm">শ্রেণি</Label><Select value={className} onValueChange={setClassName}><SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent><SelectItem value="6">৬ষ্ঠ</SelectItem><SelectItem value="7">৭ম</SelectItem><SelectItem value="8">৮ম</SelectItem><SelectItem value="9">৯ম</SelectItem><SelectItem value="10">১০ম</SelectItem></SelectContent></Select></div>
                {parseInt(className) >= 9 && (<div className="space-y-2"><Label className="font-bold text-sm">শাখা</Label><Select value={groupFilter} onValueChange={setGroupFilter}><SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="সকল শাখা" /></SelectTrigger><SelectContent><SelectItem value="all">সকল শাখা</SelectItem><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent></Select></div>)}
                <div className="flex gap-2 lg:col-span-1"><Button onClick={handleViewMeritList} disabled={isLoading || !examName || !className} className="flex-1 font-black shadow-md h-9 text-xs">তালিকা দেখুন</Button><Button onClick={handlePrint} disabled={processedResults.length === 0} variant="outline" className="border-primary text-primary hover:bg-primary/5 h-9"><Printer className="h-4 w-4" /></Button></div>
            </div>
            {processedResults.length > 0 && (
                <div className="border-2 border-primary/10 rounded-xl bg-white shadow-lg overflow-hidden">
                    <div className="bg-primary/5 p-4 border-b flex justify-between items-center"><h3 className="text-lg font-black text-primary flex items-center gap-2"><Trophy className="h-5 w-5 text-amber-500" /> মেধা তালিকা: {classNamesMap[className]} শ্রেণি</h3><Badge variant="outline" className="font-black">মোট {processedResults.length.toLocaleString('bn-BD')} জন</Badge></div>
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="text-center font-black">মেধাস্থান</TableHead>
                                    <TableHead className="text-center font-black">রোল</TableHead>
                                    <TableHead className="font-black">শিক্ষার্থীর নাম</TableHead>
                                    <TableHead className="text-center font-black">মোট নম্বর</TableHead>
                                    <TableHead className="text-center font-black">জি.পি.এ</TableHead>
                                    <TableHead className="text-center font-black">গ্রেড</TableHead>
                                    <TableHead className="text-right font-black pr-6">ফলাফল</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {processedResults.map((res, index) => (
                                    <TableRow key={res.student.id} className={cn("h-12", res.isPass ? "hover:bg-accent/5" : "bg-rose-50/50")}>
                                        <TableCell className="text-center">{res.isPass ? <span className="font-black text-lg text-emerald-700">{(index + 1).toLocaleString('bn-BD')}</span> : '-'}</TableCell>
                                        <TableCell className="text-center font-bold">{res.student.roll.toLocaleString('bn-BD')}</TableCell>
                                        <TableCell className="font-black text-slate-800">{res.student.studentNameBn}</TableCell>
                                        <TableCell className="text-center font-bold text-primary">{res.totalMarks.toLocaleString('bn-BD')}</TableCell>
                                        <TableCell className="text-center font-black">{res.gpa.toFixed(2).toLocaleString('bn-BD')}</TableCell>
                                        <TableCell className={cn("text-center font-bold", !res.isPass && "text-rose-600")}>{res.isPass ? res.finalGrade : `F${res.failedSubjectsCount}`}</TableCell>
                                        <TableCell className="text-right pr-6"><Badge variant={res.isPass ? "default" : "destructive"} className="text-[10px] font-black">{res.isPass ? 'কৃতকার্য' : 'অকৃতকার্য'}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </div>
    );
};

const SpecialPromotionTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { toast } = useToast(); 
    const { selectedYear } = useAcademicYear(); 
    const db = useFirestore(); 
    const { user } = useAuth();
    const [exams, setExams] = useState<Exam[]>([]); 
    const [examName, setExamName] = useState(''); 
    const [className, setClassName] = useState(''); 
    const [group, setGroup] = useState(''); 
    const [isLoading, setIsLoading] = useState(false); 
    const [failedStudents, setFailedStudents] = useState<StudentProcessedResult[]>([]); 
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => { 
        if (db && user) getExams(db, selectedYear).then(setExams); 
    }, [db, selectedYear, user]);

    const handleViewFailed = async () => {
        if (!examName || !className || !db || !user) return;
        setIsLoading(true);
        const students = allStudents.filter(s => s.academicYear === selectedYear && s.className === className && (parseInt(className) < 9 || !group || (s.group || '').toLowerCase().trim() === group.toLowerCase().trim()));
        const allRes = await getAllResults(db, selectedYear, examName);
        const classRes = allRes.filter(r => r.className === className);
        const subs = getSubjects(className, group).filter(s => s.isExamSubject !== false);
        const results = processStudentResults(students, classRes, subs);
        setFailedStudents(results.filter(r => !r.isPass).sort((a,b) => a.student.roll - b.student.roll));
        setSelectedIds(new Set()); 
        setIsLoading(false);
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
        await Promise.all(promPromises); 
        toast({ title: "সফল", description: `${promPromises.length} জনকে উত্তীর্ণ করা হয়েছে।` });
        setFailedStudents([]); 
        setIsLoading(false);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end p-4 border rounded-lg bg-white/50 shadow-sm">
                <div className="space-y-2"><Label className="font-bold text-sm">পরীক্ষা</Label><Select value={examName} onValueChange={setExamName}><SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label className="font-bold text-sm">শ্রেণি</Label><Select value={className} onValueChange={c => { setClassName(c); setGroup(''); }}><SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent><SelectItem value="6">৬ষ্ঠ</SelectItem><SelectItem value="7">৭ম</SelectItem><SelectItem value="8">৮ম</SelectItem><SelectItem value="9">৯ম</SelectItem><SelectItem value="10">১০ম</SelectItem></SelectContent></Select></div>
                {parseInt(className) >= 9 && (<div className="space-y-2"><Label className="font-bold text-sm">গ্রুপ</Label><Select value={group} onValueChange={setGroup}><SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent></Select></div>)}
                <Button onClick={handleViewFailed} disabled={isLoading || !examName || !className} className="lg:col-span-2 h-9 text-xs font-black">{isLoading ? 'লোড হচ্ছে...' : 'অকৃতকার্য শিক্ষার্থী খুঁজুন'}</Button>
            </div>
            {failedStudents.length > 0 && (
                <div className="space-y-4">
                    <div className="border-2 border-primary/10 rounded-md overflow-hidden bg-white">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="w-12 text-center"><Checkbox checked={selectedIds.size === failedStudents.length} onCheckedChange={(c) => setSelectedIds(c ? new Set(failedStudents.map(s => s.student.id)) : new Set())} /></TableHead>
                                    <TableHead className="text-center font-black">রোল</TableHead>
                                    <TableHead className="font-black">নাম</TableHead>
                                    <TableHead className="text-center font-black">ফেল সংখ্যা</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failedStudents.map(res => (
                                    <TableRow key={res.student.id} className="h-10 hover:bg-rose-50">
                                        <TableCell className="text-center"><Checkbox checked={selectedIds.has(res.student.id)} onCheckedChange={(c) => { const n = new Set(selectedIds); if (c) n.add(res.student.id); else n.delete(res.student.id); setSelectedIds(n); }} /></TableCell>
                                        <TableCell className="text-center font-bold">{res.student.roll.toLocaleString('bn-BD')}</TableCell>
                                        <TableCell className="font-bold">{res.student.studentNameBn}</TableCell>
                                        <TableCell className="text-center text-rose-600 font-black">F{res.failedSubjectsCount}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex justify-end">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button size="lg" disabled={selectedIds.size === 0} className="font-black shadow-lg">নির্বাচিতদের উত্তীর্ণ করুন ({selectedIds.size.toLocaleString('bn-BD')} জন)</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                                    <AlertDialogDescription>{selectedIds.size.toLocaleString('bn-BD')} জনকে পরের শ্রেণিতে উঠানো হবে।</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                    <AlertDialogAction onClick={handlePromote} className="bg-primary hover:bg-primary/90">উত্তীর্ণ করুন</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            )}
        </div>
    );
};

const BulkUploadTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { toast } = useToast(); 
    const { selectedYear } = useAcademicYear(); 
    const db = useFirestore(); 
    const { user, hasPermission } = useAuth();
    const [examName, setExamName] = useState(''); 
    const [className, setClassName] = useState(''); 
    const [group, setGroup] = useState(''); 
    const [isLoading, setIsLoading] = useState(false); 
    const fileInputRef = useRef<HTMLInputElement>(null);

    const canUploadMarks = hasPermission('upload:marks');

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file || !db || !examName || !className) return;
        if (!canUploadMarks) {
            toast({ variant: 'destructive', title: 'পারমিশন নেই', description: 'এক্সেল ফাইল আপলোড করার অনুমতি নেই।' });
            return;
        }
        setIsLoading(true); const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                const workbook = XLSX.read(ev.target?.result, { type: 'array' });
                const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as any[];
                const studentList = allStudents.filter(s => s.academicYear === selectedYear && s.className === className);
                const resultsToSave = new Map<string, ClassResult>();
                for (const row of json) {
                    const rollStr = String(row['রোল'] || row['roll'] || '');
                    const roll = parseInt(rollStr.replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]), 10);
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

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end p-6 border-2 border-dashed border-primary/20 rounded-xl bg-white/50 animate-in fade-in duration-500">
            <div className="space-y-2"><Label className="font-bold text-sm">পরীক্ষা</Label><Input value={examName} onChange={e => setExamName(e.target.value)} placeholder="উদা: বার্ষিক পরীক্ষা" className="bg-white h-9 text-xs" /></div>
            <div className="space-y-2"><Label className="font-bold text-sm">শ্রেণি</Label><Select value={className} onValueChange={setClassName}><SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent><SelectItem value="6">৬ষ্ঠ</SelectItem><SelectItem value="7">৭ম</SelectItem><SelectItem value="8">৮ম</SelectItem><SelectItem value="9">৯ম</SelectItem><SelectItem value="10">১০ম</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label className="font-bold text-sm">শাখা (৯ম-১০ম)</Label><Select value={group} onValueChange={setGroup} disabled={parseInt(className) < 9}><SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="সকল" /></SelectTrigger><SelectContent><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent></Select></div>
            <Button onClick={() => fileInputRef.current?.click()} disabled={isLoading || !examName || !className} className="shadow-md h-12 font-black text-xs"><FileUp className="mr-2 h-5 w-5" /> {isLoading ? 'আপলোড হচ্ছে...' : 'Excel ফাইল আপলোড করুন'}</Button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
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
    
    const canViewRes = hasPermission('manage:results') || hasPermission('input:results');
    const canManageFullMarks = hasPermission('manage:full-marks') || hasPermission('manage:results');
    const canUploadMarks = hasPermission('upload:marks');

    const [activeSection, setActiveSection] = useState('management');

    useEffect(() => {
        setIsClient(true); 
        if (!db || !user) return;
        const unsubscribe = onSnapshot(query(collection(db, "students")), (snap) => { 
            setAllStudents(snap.docs.map(studentFromDoc)); 
            setIsLoading(false); 
        }, (err) => { 
            if (err.code !== 'permission-denied') errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'students', operation: 'list' })); 
            setIsLoading(false); 
        });
        return () => unsubscribe();
    }, [db, user]);

    useEffect(() => {
        if (canViewRes) setActiveSection('management');
        else if (canManageFullMarks) setActiveSection('full-marks');
        else if (hasPermission('view:merit-list')) setActiveSection('merit');
    }, [canViewRes, canManageFullMarks, hasPermission]);

    const sidebarItems = useMemo(() => {
        const items = [];
        if (canViewRes) {
            items.push({ id: 'management', label: 'নম্বর ইনপুট', icon: FilePen, color: 'text-indigo-600 bg-indigo-50' });
            items.push({ id: 'sheet', label: 'ফলাফল শিট', icon: FileSpreadsheet, color: 'text-emerald-600 bg-emerald-50' });
        }
        if (canManageFullMarks) {
            items.push({ id: 'full-marks', label: 'বিষয় ও পূর্ণমান', icon: CheckCircle2, color: 'text-violet-600 bg-violet-50' });
        }
        if (hasPermission('view:merit-list')) {
            items.push({ id: 'merit', label: 'মেধা তালিকা', icon: Trophy, color: 'text-amber-600 bg-amber-50' });
        }
        if (hasPermission('promote:students')) {
            items.push({ id: 'special-promotion', label: 'বিশেষ পাশ', icon: Star, color: 'text-rose-600 bg-rose-50' });
        }
        if (canUploadMarks) {
            items.push({ id: 'upload', label: 'Excel আপলোড', icon: FileUp, color: 'text-blue-600 bg-blue-50' });
        }
        return items;
    }, [canViewRes, canManageFullMarks, hasPermission, canUploadMarks]);

    if (isClient && !canViewRes && !hasPermission('view:merit-list') && user?.role !== 'admin' && !canManageFullMarks) return (
        <div className="flex min-h-screen w-full flex-col bg-violet-50">
            <Header />
            <main className="flex flex-1 items-center justify-center p-4">
                <Card className="p-8 text-center border-2 border-primary/20">
                    <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                    <h2 className="text-xl font-bold">প্রবেশাধিকার সংরক্ষিত</h2>
                </Card>
            </main>
        </div>
    );

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#F6F7F9] font-kalpurush">
            <Header />
            <main className="flex-1 flex flex-col md:flex-row h-full max-w-[1600px] mx-auto w-full md:p-6 lg:p-10 gap-8 pb-40">
                
                {/* Sidebar Navigation - Fixed/Sticky */}
                <aside className="w-full md:w-60 shrink-0 space-y-1 no-print bg-white md:bg-transparent p-4 md:p-0 border-b md:border-0 sticky top-20 md:top-28 self-start">
                    <h2 className="text-2xl font-black mb-6 px-4 hidden md:block text-slate-900 tracking-tight">ফলাফল ব্যবস্থাপনা</h2>
                    <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-1 scrollbar-none">
                        {sidebarItems.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveSection(item.id)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-bold whitespace-nowrap min-w-fit",
                                    activeSection === item.id 
                                        ? "bg-white shadow-md text-primary scale-105" 
                                        : "text-muted-foreground hover:bg-slate-200/50"
                                )}
                            >
                                <div className={cn("p-1.5 rounded-lg shrink-0", activeSection === item.id ? item.color : "bg-muted")}>
                                    <item.icon className="h-3.5 w-3.5" />
                                </div>
                                <span className="text-xs">{item.label}</span>
                                {activeSection === item.id && <ChevronRight className="ml-auto h-3.5 w-3.5 hidden md:block" />}
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Content Area */}
                <div className="flex-1 min-w-0 bg-white md:rounded-[32px] shadow-2xl md:border-[1px] border-slate-200/50 overflow-hidden min-h-[700px] flex flex-col transition-all duration-500 animate-in fade-in slide-in-from-right-4">
                    <div className="p-4 sm:p-6 lg:p-8 flex-1">
                        {isLoading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-64 w-full" />
                            </div>
                        ) : (
                            <>
                                {activeSection === 'management' && <MarkManagementTab allStudents={allStudents} />}
                                {activeSection === 'full-marks' && <FullMarksTab />}
                                {activeSection === 'sheet' && <ResultSheetTab allStudents={allStudents} />}
                                {activeSection === 'merit' && <MeritListTab allStudents={allStudents} />}
                                {activeSection === 'special-promotion' && <SpecialPromotionTab allStudents={allStudents} />}
                                {activeSection === 'upload' && <BulkUploadTab allStudents={allStudents} />}
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
