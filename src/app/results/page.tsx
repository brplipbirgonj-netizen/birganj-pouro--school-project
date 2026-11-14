
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from "@/hooks/use-toast";
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Student, studentFromDoc, getStudentPlaceholderImage, sanitizePhotoUrl, isFemale } from '@/lib/student-data';
import { getSubjects, Subject as SubjectType, subjectNameNormalization } from '@/lib/subjects';
import { saveClassResults, getResultsForClass, getAllResults, deleteClassResult, ClassResult, StudentResult, ExamAttendanceRecord, saveExamAttendance, getExamAttendance } from '@/lib/results-data';
import { processStudentResults, StudentProcessedResult, getGradePoint, checkPartFails } from '@/lib/results-calculation';
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
    Trash2, FileUp, Download, FilePen, BookOpen, AlertCircle, Trophy, Printer, Loader2, 
    FileSpreadsheet, CheckCircle2, Save, Star, ChevronRight, LayoutGrid, FileText, 
    Search, Sparkles, Settings, ListTodo, List, XCircle, UserCheck, RefreshCcw, RotateCcw, Plus, AlertTriangle, Info, History,
    BarChart3
} from 'lucide-react';
import { ResultStatisticsTab } from './ResultStatisticsTab';
import * as XLSX from 'xlsx';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, orderBy, FirestoreError, getDocs, limit, doc, writeBatch, serverTimestamp, Timestamp, QueryDocumentSnapshot } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { getExams, Exam } from '@/lib/exam-data';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { SpecialClassResult, saveSpecialResults, getSpecialResultsForClass } from '@/lib/special-results-data';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';

const BENGALI_MONTHS = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

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

const normalize = (name: string) => {
    if (!name) return "";
    const trimmed = name.trim();
    return (subjectNameNormalization[trimmed] || trimmed).toLowerCase();
};

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
        return (user as any)?.marksPermissions?.[cls]?.includes(sub) ?? false;
    }, [user, hasPermission]);

    const [exams, setExams] = useState<Exam[]>([]);
    const [examName, setExamName] = useState('');
    const [className, setClassName] = useState('');
    const [group, setGroup] = useState('all');
    const [subject, setSubject] = useState('');
    const [fullMarks, setFullMarks] = useState<number>(100);
    
    const [availableSubjects, setAvailableSubjects] = useState<SubjectType[]>([]);
    const [selectedSubjectInfo, setSelectedSubjectInfo] = useState<SubjectType | null>(null);

    const [studentsForClass, setStudentsForClass] = useState<Student[]>([]);
    const [marks, setMarks] = useState<Map<string, Marks>>(new Map());
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);
    const [examAttendance, setExamAttendance] = useState<Record<string, 'present' | 'absent'>>({});

    const [storedLimits, setStoredLimits] = useState<{ written: number, mcq: number, practical: number }>({ written: 70, mcq: 30, practical: 0 });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const canUploadMarks = hasPermission('upload:marks');

    useEffect(() => {
        if (!db || !user) return;
        getExams(db, selectedYear).then(setExams);
    }, [db, selectedYear, user]);

    const showGroupSelector = useMemo(() => parseInt(className) >= 9, [className]);

    useEffect(() => {
        let newSubjects = getSubjects(className, group === 'all' ? undefined : group).filter(s => s.isExamSubject !== false);
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
            toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ' });
            return;
        }
        setIsLoadingStudents(true);

        try {
            const normSub = subjectNameNormalization[subject] || subject;
            const q = query(
                collection(db, 'results'),
                where('academicYear', '==', selectedYear),
                where('examName', '==', examName),
                where('className', '==', className),
                where('subject', '==', normSub)
            );
            const snap = await getDocs(q);
            const matchingResults = snap.docs.map(d => d.data() as ClassResult);
            
            if (matchingResults.length === 0) {
                toast({ variant: 'destructive', title: 'পূর্ণমান সেট করা নেই' });
                setIsLoadingStudents(false);
                setStudentsForClass([]);
                return;
            }

            const filteredStudents = allStudents.filter(s => {
                if (s.academicYear !== selectedYear || s.className !== className) return false;
                if (!showGroupSelector || group === 'all') return true;
                const sGrp = groupMap[(s.group || '').toLowerCase().trim()] || (s.group || '').toLowerCase().trim();
                const fGrp = groupMap[group.toLowerCase().trim()] || group.toLowerCase().trim();
                return sGrp === fGrp;
            }).sort((a,b) => a.roll - b.roll);

            setStudentsForClass(filteredStudents);
            
            const initialMarks = new Map<string, Marks>();
            const firstRes = matchingResults[0];
            const isIct = normalize(subject).includes('তথ্য ও যোগাযোগ') || normalize(subject).includes('আইসিটি') || normalize(subject) === 'ict';
            const effPracticalLimit = (firstRes.practicalLimit !== undefined && firstRes.practicalLimit > 0) ? firstRes.practicalLimit : (isIct ? 25 : 0);
            const effMcqLimit = (firstRes.mcqLimit !== undefined && firstRes.mcqLimit > 0) ? firstRes.mcqLimit : (isIct ? 25 : (firstRes.mcqLimit ?? 0));
            const effFullMarks = firstRes.fullMarks > 0 ? firstRes.fullMarks : (isIct ? 50 : firstRes.fullMarks);
            setFullMarks(effFullMarks);
            setStoredLimits({
                written: firstRes.writtenLimit ?? 0,
                mcq: effMcqLimit,
                practical: effPracticalLimit
            });

            // Smart Data Loading with Priority: General/none group first, then specific group overlay
            matchingResults.filter(r => {
                const rg = (r.group || 'none').toLowerCase().trim();
                return rg === 'none' || rg === 'all' || !r.group;
            }).forEach(resRecord => {
                resRecord.results.forEach(res => {
                    const existing = initialMarks.get(res.studentId) || {};
                    initialMarks.set(res.studentId, { ...existing, written: res.written, mcq: res.mcq, practical: res.practical });
                });
            });

            matchingResults.filter(r => {
                const rg = (r.group || 'none').toLowerCase().trim();
                return rg !== 'none' && rg !== 'all' && Boolean(r.group);
            }).forEach(resRecord => {
                resRecord.results.forEach(res => {
                    const existing = initialMarks.get(res.studentId) || {};
                    const hasMarks = res.written !== undefined || res.mcq !== undefined || res.practical !== undefined;
                    if (hasMarks || !initialMarks.has(res.studentId)) {
                        initialMarks.set(res.studentId, {
                            written: res.written !== undefined ? res.written : existing.written,
                            mcq: res.mcq !== undefined ? res.mcq : existing.mcq,
                            practical: res.practical !== undefined ? res.practical : existing.practical,
                        });
                    }
                });
            });
            
            filteredStudents.forEach(student => {
                if (!initialMarks.has(student.id)) initialMarks.set(student.id, {});
            });
            setMarks(initialMarks);

            // Load exam attendance for this class/exam/group
            try {
                const attRecord = await getExamAttendance(db, selectedYear, examName, className, group);
                setExamAttendance(attRecord?.attendance || {});
            } catch (attErr) {
                console.warn("Could not load exam attendance:", attErr);
                setExamAttendance({});
            }
        } catch (e) {
            console.error(e);
        }
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const table = e.currentTarget.closest('table');
            if (!table) return;
            
            const inputs = Array.from(table.querySelectorAll('tbody input[type="number"]:not([readonly])')) as HTMLInputElement[];
            const index = inputs.indexOf(e.currentTarget);
            
            if (index >= 0 && index < inputs.length - 1) {
                const nextInput = inputs[index + 1];
                nextInput.focus();
                nextInput.select();
            }
        }
    };

    const handleSaveResults = async () => {
        if (!db || !user) return;
        if (!isSubjectPermitted(className, subject)) { toast({ variant: 'destructive', title: 'পারমিশন নেই' }); return; }
        if (studentsForClass.length === 0) { toast({ variant: 'destructive', title: 'কোনো শিক্ষার্থী নেই' }); return; }
        
        const resultsData: StudentResult[] = Array.from(marks.entries()).map(([studentId, marks]) => ({ studentId, ...marks }));
        const effectiveGroup = (parseInt(className) < 9 || group === 'all') ? undefined : group;
        
        const isIct = normalize(subject).includes('তথ্য ও যোগাযোগ') || normalize(subject).includes('আইসিটি') || normalize(subject) === 'ict';
        const practicalLimitToSave = storedLimits.practical > 0 ? storedLimits.practical : (isIct ? 25 : 0);
        const fullMarksToSave = fullMarks > 0 ? fullMarks : (isIct ? 50 : fullMarks);

        await saveClassResults(db, { 
            academicYear: selectedYear, 
            examName, 
            className, 
            group: effectiveGroup || undefined, 
            subject, 
            fullMarks: fullMarksToSave,
            writtenLimit: storedLimits.written,
            mcqLimit: storedLimits.mcq,
            practicalLimit: practicalLimitToSave,
            results: resultsData 
        });
        
        toast({ title: 'ফলাফল সেভ হয়েছে' });
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
        reader.readAsDataURL(file);
    };

    const numberInputClass = "h-9 font-bold border-2 border-black focus:ring-primary shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end p-4 border rounded-lg bg-white/50 shadow-sm">
                <div className="space-y-2">
                    <Label>পরীক্ষা</Label>
                    <Select value={examName} onValueChange={setExamName}>
                        <SelectTrigger className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="পরীক্ষা নির্বাচন" /></SelectTrigger>
                        <SelectContent>{exams.filter(e => Boolean(e?.name)).map((e, idx) => <SelectItem key={`exam-opt-${e.id || idx}-${e.name}`} value={e.name}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="class">শ্রেণি</Label>
                    <Select value={className} onValueChange={(v) => { setClassName(v); setGroup('all'); setSubject(''); }}>
                        <SelectTrigger id="class" className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger>
                        <SelectContent><SelectItem value="6">৬ষ্ঠ</SelectItem><SelectItem value="7">৭ম</SelectItem><SelectItem value="8">৮ম</SelectItem><SelectItem value="9">৯ম</SelectItem><SelectItem value="10">১০ম</SelectItem></SelectContent>
                    </Select>
                </div>
                {showGroupSelector && (
                    <div className="space-y-2">
                        <Label htmlFor="group">গ্রুপ</Label>
                        <Select value={group} onValueChange={setGroup} required>
                            <SelectTrigger id="group" className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="গ্রুপ নির্বাচন" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">সকল শাখা</SelectItem>
                                <SelectItem value="science">বিজ্ঞান</SelectItem>
                                <SelectItem value="arts">মানবিক</SelectItem>
                                <SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div className="space-y-2">
                    <Label htmlFor="subject">বিষয়</Label>
                    <Select value={subject} onValueChange={setSubject} disabled={!className || (showGroupSelector && !group)}>
                        <SelectTrigger id="subject" className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="বিষয় নির্বাচন" /></SelectTrigger>
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
                            <Badge variant="outline" className="bg-white font-black text-[10px] px-3">পূর্ণমান: {toBengaliNumber(fullMarks)}</Badge>
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
                                <TableHeader className="sticky top-0 bg-white z-20 shadow-sm border-b-2 border-black">
                                    <TableRow>
                                        <TableHead className="w-20 text-center font-black">রোল</TableHead>
                                        <TableHead className="font-black">শিক্ষার্থীর নাম</TableHead>
                                        {storedLimits.written > 0 && <TableHead className="w-28 font-black text-center">লিখিত ({toBengaliNumber(storedLimits.written)})</TableHead>}
                                        {storedLimits.mcq > 0 && <TableHead className="w-28 font-black text-center">MCQ ({toBengaliNumber(storedLimits.mcq)})</TableHead>}
                                        {(storedLimits.practical > 0 || normalize(subject).includes('তথ্য ও যোগাযোগ') || normalize(subject).includes('আইসিটি')) && (
                                            <TableHead className="w-28 font-black text-center">ব্যবহারিক ({toBengaliNumber(storedLimits.practical > 0 ? storedLimits.practical : 25)})</TableHead>
                                        )}
                                        <TableHead className="w-24 text-center font-black text-blue-900">মোট</TableHead>
                                        <TableHead className="w-32 text-center font-black">অবস্থা</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {studentsForClass.map(student => {
                                        const sMarks = marks.get(student.id);
                                        const written = sMarks?.written ?? 0;
                                        const mcq = sMarks?.mcq ?? 0;
                                        const practical = sMarks?.practical ?? 0;
                                        const total = written + mcq + practical;
                                        
                                        const isAnyMarkEntered = sMarks?.written !== undefined || sMarks?.mcq !== undefined || sMarks?.practical !== undefined;

                                        const partFails = checkPartFails({
                                            subjectName: subject,
                                            fullMarks,
                                            written: sMarks?.written,
                                            mcq: sMarks?.mcq,
                                            practical: sMarks?.practical,
                                            writtenLimit: storedLimits.written,
                                            mcqLimit: storedLimits.mcq,
                                            practicalLimit: storedLimits.practical,
                                            hasPractical: storedLimits.practical > 0,
                                        });

                                        const isAnyFail = isAnyMarkEntered && !partFails.isPass;

                                        const writtenOver = written > storedLimits.written;
                                        const mcqOver = mcq > storedLimits.mcq;
                                        const practicalOver = practical > storedLimits.practical;

                                        const isStudentAbsent = examAttendance[student.id] === 'absent';

                                        return (
                                            <TableRow key={student.id} className={cn("hover:bg-accent/5", isStudentAbsent && "bg-amber-50/40")}>
                                                <TableCell className="font-black text-center border-r">{toBengaliNumber(student.roll)}</TableCell>
                                                <TableCell className={cn("font-bold border-r transition-colors", isAnyMarkEntered && isAnyFail ? "text-red-600" : "text-slate-700")}>
                                                    <div className="flex items-center gap-2">
                                                        <span>{student.studentNameBn}</span>
                                                        {isStudentAbsent && (
                                                            <Badge variant="destructive" className="text-[10px] bg-rose-600 text-white font-black px-1.5 py-0 h-4 leading-none">
                                                                অনুপস্থিত
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                {storedLimits.written > 0 && (
                                                    <TableCell className="border-r">
                                                        <Input 
                                                            type="number" 
                                                            value={sMarks?.written ?? ''} 
                                                            placeholder={isStudentAbsent ? "অনুপস্থিত" : undefined}
                                                            onChange={(e) => handleMarkChange(student.id, 'written', e.target.value)} 
                                                            onKeyDown={handleKeyDown} 
                                                            className={cn(numberInputClass, (writtenOver || (sMarks?.written !== undefined && partFails.writtenFail)) && "bg-red-100 border-red-500 text-red-700 font-bold", isStudentAbsent && "border-amber-400 bg-amber-50/60")}
                                                        />
                                                    </TableCell>
                                                )}
                                                {storedLimits.mcq > 0 && (
                                                    <TableCell className="border-r">
                                                        <Input 
                                                            type="number" 
                                                            value={sMarks?.mcq ?? ''} 
                                                            placeholder={isStudentAbsent ? "অনুপস্থিত" : undefined}
                                                            onChange={(e) => handleMarkChange(student.id, 'mcq', e.target.value)} 
                                                            onKeyDown={handleKeyDown} 
                                                            className={cn(numberInputClass, (mcqOver || (sMarks?.mcq !== undefined && partFails.mcqFail)) && "bg-red-100 border-red-500 text-red-700 font-bold", isStudentAbsent && "border-amber-400 bg-amber-50/60")}
                                                        />
                                                    </TableCell>
                                                )}
                                                {storedLimits.practical > 0 && (
                                                    <TableCell className="border-r">
                                                        <Input 
                                                            type="number" 
                                                            value={sMarks?.practical ?? ''} 
                                                            placeholder={isStudentAbsent ? "অনুপস্থিত" : undefined}
                                                            onChange={(e) => handleMarkChange(student.id, 'practical', e.target.value)} 
                                                            onKeyDown={handleKeyDown} 
                                                            className={cn(numberInputClass, (practicalOver || (sMarks?.practical !== undefined && partFails.practicalFail)) && "bg-red-100 border-red-500 text-red-700 font-bold", isStudentAbsent && "border-amber-400 bg-amber-50/60")}
                                                        />
                                                    </TableCell>
                                                )}
                                                <TableCell className="text-center font-black text-blue-900 bg-slate-50/50 border-r">
                                                    {toBengaliNumber(total)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={cn("font-black px-3", 
                                                        isStudentAbsent ? "bg-rose-700 text-white" : 
                                                        (!isAnyMarkEntered ? "bg-slate-300 text-slate-600" : (isAnyFail ? "bg-rose-600" : "bg-emerald-600"))
                                                    )}>
                                                        {isStudentAbsent ? 'অনুপস্থিত' : (!isAnyMarkEntered ? 'এন্ট্রি হয়নি' : (isAnyFail ? 'অকৃতকার্য' : 'কৃতকার্য'))}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="flex justify-between items-center p-4 border-t bg-muted/10">
                            <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> এন্টার চাপলে পরবর্তী শিক্ষার্থীর ইনপুট ঘরে চলে যাবে।</p>
                            <Button onClick={handleSaveResults} size="lg" className="px-10 font-black shadow-md"><Save className="mr-2 h-4 w-4" /> প্রাপ্ত নম্বর সেভ করুন</Button>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

const ExamAttendanceTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user } = useAuth();

    const [exams, setExams] = useState<Exam[]>([]);
    const [examName, setExamName] = useState('');
    const [className, setClassName] = useState('6');
    const [group, setGroup] = useState('all');

    const [studentsForClass, setStudentsForClass] = useState<Student[]>([]);
    const [attendanceMap, setAttendanceMap] = useState<Record<string, 'present' | 'absent'>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const showGroupSelector = useMemo(() => parseInt(className) >= 9, [className]);

    useEffect(() => {
        if (!db || !user) return;
        getExams(db, selectedYear).then(setExams);
    }, [db, selectedYear, user]);

    const handleLoadAttendance = useCallback(async () => {
        if (!examName || !className || !db) return;
        setIsLoading(true);
        try {
            const filtered = allStudents.filter(s => {
                if (s.academicYear !== selectedYear || s.className !== className) return false;
                if (showGroupSelector && group !== 'all') {
                    const sGrp = groupMap[(s.group || '').toLowerCase().trim()] || (s.group || '').toLowerCase().trim();
                    const fGrp = groupMap[group.toLowerCase().trim()] || group.toLowerCase().trim();
                    if (sGrp !== fGrp) return false;
                }
                return true;
            }).sort((a, b) => a.roll - b.roll);

            setStudentsForClass(filtered);

            // Fetch saved attendance
            const attRecord = await getExamAttendance(db, selectedYear, examName, className, group);
            const initialMap: Record<string, 'present' | 'absent'> = {};
            filtered.forEach(s => {
                if (attRecord?.attendance && attRecord.attendance[s.id]) {
                    initialMap[s.id] = attRecord.attendance[s.id];
                } else {
                    initialMap[s.id] = 'present';
                }
            });
            setAttendanceMap(initialMap);
        } catch (e) {
            console.error("Error loading attendance:", e);
            toast({ variant: 'destructive', title: 'উপস্থিতি তালিকা লোড করতে সমস্যা হয়েছে' });
        }
        setIsLoading(false);
    }, [examName, className, group, db, selectedYear, allStudents, showGroupSelector, toast]);

    useEffect(() => {
        if (examName && className) {
            handleLoadAttendance();
        }
    }, [examName, className, group, handleLoadAttendance]);

    const handleToggleStatus = (studentId: string, status: 'present' | 'absent') => {
        setAttendanceMap(prev => ({
            ...prev,
            [studentId]: status
        }));
    };

    const handleMarkAll = (status: 'present' | 'absent') => {
        setAttendanceMap(prev => {
            const next = { ...prev };
            studentsForClass.forEach(s => {
                next[s.id] = status;
            });
            return next;
        });
        toast({ title: status === 'present' ? 'সকলকে উপস্থিত মার্ক করা হয়েছে' : 'সকলকে অনুপস্থিত মার্ক করা হয়েছে' });
    };

    const handleSave = async () => {
        if (!db || !examName || !className) {
            toast({ variant: 'destructive', title: 'পরীক্ষা ও শ্রেণি নির্বাচন করুন' });
            return;
        }
        setIsSaving(true);
        try {
            await saveExamAttendance(db, {
                academicYear: selectedYear,
                examName,
                className,
                group: showGroupSelector ? group : 'none',
                attendance: attendanceMap,
            });
            toast({ title: 'উপস্থিতি তালিকা সফলভাবে সংরক্ষিত হয়েছে' });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'সংরক্ষণ ব্যর্থ হয়েছে' });
        }
        setIsSaving(false);
    };

    const filteredDisplayStudents = useMemo(() => {
        if (!searchQuery.trim()) return studentsForClass;
        const q = searchQuery.toLowerCase().trim();
        return studentsForClass.filter(s => 
            s.studentNameBn?.toLowerCase().includes(q) ||
            s.studentNameEn?.toLowerCase().includes(q) ||
            s.roll.toString().includes(q) ||
            s.generatedId?.toLowerCase().includes(q) ||
            s.id?.toLowerCase().includes(q)
        );
    }, [studentsForClass, searchQuery]);

    const presentCount = useMemo(() => {
        return studentsForClass.filter(s => attendanceMap[s.id] !== 'absent').length;
    }, [studentsForClass, attendanceMap]);

    const absentCount = useMemo(() => {
        return studentsForClass.filter(s => attendanceMap[s.id] === 'absent').length;
    }, [studentsForClass, attendanceMap]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end p-4 border rounded-xl bg-white/60 shadow-sm">
                <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">পরীক্ষার নাম</Label>
                    <Select value={examName} onValueChange={setExamName}>
                        <SelectTrigger className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="পরীক্ষা নির্বাচন" /></SelectTrigger>
                        <SelectContent>{exams.filter(e => Boolean(e?.name)).map((e, idx) => <SelectItem key={`exam-${e.id || idx}-${e.name}`} value={e.name}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">শ্রেণি</Label>
                    <Select value={className} onValueChange={(val) => { setClassName(val); setGroup('all'); }}>
                        <SelectTrigger className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger>
                        <SelectContent>{Object.entries(classNamesMap).map(([val, label]) => <SelectItem key={val} value={val}>{label} শ্রেণি</SelectItem>)}</SelectContent>
                    </Select>
                </div>

                {showGroupSelector && (
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">শাখা / বিভাগ</Label>
                        <Select value={group} onValueChange={setGroup}>
                            <SelectTrigger className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="শাখা" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">সকল শাখা</SelectItem>
                                <SelectItem value="science">বিজ্ঞান</SelectItem>
                                <SelectItem value="arts">মানবিক</SelectItem>
                                <SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                <Button onClick={handleLoadAttendance} disabled={isLoading || !examName} className="h-9 text-xs font-black">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RefreshCcw className="h-3.5 w-3.5 mr-1.5" />}
                    তালিকা রিফ্রেশ
                </Button>
            </div>

            {studentsForClass.length > 0 ? (
                <Card className="overflow-hidden border-2 shadow-lg rounded-2xl bg-white">
                    <CardHeader className="bg-muted/30 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="font-black text-slate-800 text-sm">
                                {classNamesMap[className]} শ্রেণি {group !== 'all' && `(${groupNamesMap[group] || group})`} - {examName}
                            </span>
                            <Badge variant="outline" className="bg-white font-black text-xs px-3 border-slate-300">
                                মোট: {toBengaliNumber(studentsForClass.length)} জন
                            </Badge>
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 font-black text-xs px-3">
                                উপস্থিত: {toBengaliNumber(presentCount)} জন
                            </Badge>
                            <Badge className="bg-rose-600 hover:bg-rose-600 font-black text-xs px-3">
                                অনুপস্থিত: {toBengaliNumber(absentCount)} জন
                            </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            <div className="relative flex-1 md:w-48">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input 
                                    placeholder="রোল বা নাম খুঁজুন..." 
                                    value={searchQuery} 
                                    onChange={(e) => setSearchQuery(e.target.value)} 
                                    className="pl-8 h-8 text-xs font-bold bg-white"
                                />
                            </div>
                            <Button variant="outline" size="sm" onClick={() => handleMarkAll('present')} className="h-8 text-xs font-bold text-emerald-700 hover:bg-emerald-50 border-emerald-200">
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> সবাই উপস্থিত
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleMarkAll('absent')} className="h-8 text-xs font-bold text-rose-700 hover:bg-rose-50 border-rose-200">
                                <XCircle className="h-3.5 w-3.5 mr-1" /> সবাই অনুপস্থিত
                            </Button>
                        </div>
                    </CardHeader>

                    <CardContent className="p-0">
                        <div className="max-h-[550px] overflow-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-slate-50 z-20 shadow-sm border-b-2 border-slate-200">
                                    <TableRow className="h-10">
                                        <TableHead className="w-20 text-center font-black">রোল</TableHead>
                                        <TableHead className="font-black">শিক্ষার্থীর তথ্য</TableHead>
                                        <TableHead className="w-28 text-center font-black">শাখা/বিভাগ</TableHead>
                                        <TableHead className="w-64 text-center font-black">উপস্থিতি নির্বাচন</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredDisplayStudents.map(student => {
                                        const status = attendanceMap[student.id] || 'present';
                                        const isAbsent = status === 'absent';

                                        return (
                                            <TableRow key={student.id} className={cn("h-12 hover:bg-accent/5 transition-colors", isAbsent && "bg-rose-50/50")}>
                                                <TableCell className="font-black text-center border-r text-base">
                                                    {toBengaliNumber(student.roll)}
                                                </TableCell>
                                                <TableCell className="border-r">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8 border border-slate-200">
                                                            <AvatarImage src={sanitizePhotoUrl(student.photoUrl)} alt={student.studentNameBn} />
                                                            <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                                                                {student.studentNameBn?.slice(0, 2) || 'শিক্ষার্থী'}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className={cn("font-bold text-sm", isAbsent ? "text-rose-700" : "text-slate-800")}>
                                                                {student.studentNameBn}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground font-mono font-medium">
                                                                ID: {student.generatedId || student.id.slice(0, 6)} {student.studentNameEn && `| ${student.studentNameEn}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-xs border-r text-slate-600">
                                                    {groupNamesMap[student.group || ''] || student.group || 'সাধারণ'}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="inline-flex rounded-lg border p-1 bg-slate-100 gap-1">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleToggleStatus(student.id, 'present')}
                                                            className={cn(
                                                                "px-3 py-1 text-xs font-black rounded-md transition-all flex items-center gap-1.5",
                                                                !isAbsent 
                                                                    ? "bg-emerald-600 text-white shadow-sm" 
                                                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                                            )}
                                                        >
                                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                                            উপস্থিত
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleToggleStatus(student.id, 'absent')}
                                                            className={cn(
                                                                "px-3 py-1 text-xs font-black rounded-md transition-all flex items-center gap-1.5",
                                                                isAbsent 
                                                                    ? "bg-rose-600 text-white shadow-sm" 
                                                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                                                            )}
                                                        >
                                                            <XCircle className="h-3.5 w-3.5" />
                                                            অনুপস্থিত
                                                        </button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-t bg-muted/10 gap-3">
                            <p className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                                <Info className="h-4 w-4 text-primary shrink-0" />
                                অনুপস্থিত নির্বাচিত শিক্ষার্থীদের নম্বর ইনপুট, ফলাফল শিট ও মেধা তালিকায় 'অনুপস্থিত' হিসেবে নির্ধারণ করা হবে।
                            </p>
                            <Button 
                                onClick={handleSave} 
                                disabled={isSaving} 
                                size="lg" 
                                className="px-8 font-black shadow-md bg-emerald-700 hover:bg-emerald-800"
                            >
                                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
                                উপস্থিতি সংরক্ষণ করুন
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="p-12 text-center border-2 border-dashed rounded-2xl bg-white/50">
                    <UserCheck className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-slate-700">কোনো শিক্ষার্থী পাওয়া যায়নি</h3>
                    <p className="text-xs text-muted-foreground mt-1">উপরে পরীক্ষা ও শ্রেণি নির্বাচন করে তালিকা দেখুন।</p>
                </Card>
            )}
        </div>
    );
};

const SubjectReportTab = ({ allStudents, onPrintRequested }: { allStudents: Student[], onPrintRequested: (data: any) => void }) => {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user, hasPermission } = useAuth();
    
    const [exams, setExams] = useState<Exam[]>([]);
    const [examName, setExamName] = useState('');
    const [className, setClassName] = useState('');
    const [group, setGroup] = useState('all');
    const [subject, setSubject] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [availableSubjects, setAvailableSubjects] = useState<SubjectType[]>([]);
    const [results, setResults] = useState<ClassResult | null>(null);

    const isSubjectPermitted = useCallback((cls: string, sub: string) => {
        if (user?.role === 'admin') return true;
        if (hasPermission('manage:results')) return true;
        return (user as any)?.marksPermissions?.[cls]?.includes(sub) ?? false;
    }, [user, hasPermission]);

    useEffect(() => {
        if (!db || !user) return;
        getExams(db, selectedYear).then(setExams);
    }, [db, selectedYear, user]);

    useEffect(() => {
        let newSubjects = getSubjects(className, group === 'all' ? undefined : group).filter(s => s.isExamSubject !== false);
        if (user?.role !== 'admin' && !hasPermission('manage:results') && className) {
            newSubjects = newSubjects.filter(s => isSubjectPermitted(className, s.name));
        }
        setAvailableSubjects(newSubjects);
    }, [className, group, user, hasPermission, isSubjectPermitted]);

    const handleLoadReport = async () => {
        if (!examName || !className || !subject || !db) {
            toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ' });
            return;
        }
        setIsLoading(true);
        try {
            const normSub = subjectNameNormalization[subject] || subject;
            const q = query(
                collection(db, 'results'),
                where('academicYear', '==', selectedYear),
                where('examName', '==', examName),
                where('className', '==', className),
                where('subject', '==', normSub)
            );
            const snap = await getDocs(q);
            const matchingResults = snap.docs.map(d => d.data() as ClassResult);
            
            if (matchingResults.length === 0) {
                toast({ title: 'কোনো ফলাফল পাওয়া যায়নি' });
                setResults(null);
            } else {
                const mergedResults: ClassResult = {
                    ...matchingResults[0],
                    results: []
                };
                const studentResultsMap = new Map<string, StudentResult>();

                // Priority 1: Load general/none records
                matchingResults.filter(r => {
                    const rg = (r.group || 'none').toLowerCase().trim();
                    return rg === 'none' || rg === 'all' || !r.group;
                }).forEach(r => {
                    r.results.forEach(sr => studentResultsMap.set(sr.studentId, sr));
                });

                // Priority 2: Overlay specific group records (so specific group takes precedence if marks exist)
                matchingResults.filter(r => {
                    const rg = (r.group || 'none').toLowerCase().trim();
                    return rg !== 'none' && rg !== 'all' && Boolean(r.group);
                }).forEach(r => {
                    r.results.forEach(sr => {
                        const existing = studentResultsMap.get(sr.studentId);
                        const hasMarks = sr.written !== undefined || sr.mcq !== undefined || sr.practical !== undefined;
                        if (hasMarks || !existing) {
                            studentResultsMap.set(sr.studentId, {
                                studentId: sr.studentId,
                                written: sr.written !== undefined ? sr.written : existing?.written,
                                mcq: sr.mcq !== undefined ? sr.mcq : existing?.mcq,
                                practical: sr.practical !== undefined ? sr.practical : existing?.practical,
                            });
                        }
                    });
                });

                mergedResults.results = Array.from(studentResultsMap.values());
                setResults(mergedResults);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrintBlank = () => {
        if (!className || !subject) {
            toast({ variant: 'destructive', title: 'শ্রেণি ও বিষয় নির্বাচন করুন' });
            return;
        }
        const students = allStudents
            .filter(s => {
                const yearMatch = s.academicYear === selectedYear;
                const classMatch = s.className === className;
                if (!yearMatch || !classMatch) return false;
                if (!group || group === 'all') return true;
                const sGroupNorm = groupMap[(s.group || '').toLowerCase().trim()] || (s.group || '').toLowerCase().trim();
                const filterGroupNorm = groupMap[group.toLowerCase().trim()] || group.toLowerCase().trim();
                return sGroupNorm === filterGroupNorm;
            })
            .sort((a, b) => a.roll - b.roll)
            .map(student => ({
                student,
                marks: {},
                obtainedMarks: '',
                grade: '',
                point: 0,
                isPass: true
            }));

        onPrintRequested({ 
            studentData: students, 
            info: { examName: examName || 'ফাঁকা ফরম', className, subject, group, fullMarks: availableSubjects.find(s => s.name === subject)?.fullMarks || 100 },
            isBlank: true 
        });
    };

    const reportStudents = useMemo(() => {
        if (!results) return [];
        return allStudents
            .filter(s => {
                const yearMatch = s.academicYear === selectedYear;
                const classMatch = s.className === className;
                if (!yearMatch || !classMatch) return false;
                if (parseInt(className) < 9 || !group || group === 'all') return true;
                const sGroupNorm = groupMap[(s.group || '').toLowerCase().trim()] || (s.group || '').toLowerCase().trim();
                const filterGroupNorm = groupMap[group.toLowerCase().trim()] || group.toLowerCase().trim();
                return sGroupNorm === filterGroupNorm;
            })
            .sort((a, b) => a.roll - b.roll)
            .map(student => {
                const marks = results.results.find(r => r.studentId === student.id);
                const obtainedMarks = (marks?.written || 0) + (marks?.mcq || 0) + (marks?.practical || 0);
                const percentage = results.fullMarks > 0 ? (obtainedMarks / results.fullMarks) * 100 : 0;
                
                const partFails = checkPartFails({
                    subjectName: subject,
                    fullMarks: results.fullMarks,
                    written: marks?.written,
                    mcq: marks?.mcq,
                    practical: marks?.practical,
                    writtenLimit: results.writtenLimit,
                    mcqLimit: results.mcqLimit,
                    practicalLimit: results.practicalLimit,
                    hasPractical: Boolean(results.practicalLimit && results.practicalLimit > 0),
                });

                const isPass = partFails.isPass;
                const { grade, point } = getGradePoint(percentage);

                return {
                    student,
                    marks: marks || { studentId: student.id },
                    obtainedMarks,
                    grade: isPass ? grade : 'F',
                    point: isPass ? point : 0,
                    isPass,
                    writtenFail: partFails.writtenFail,
                    mcqFail: partFails.mcqFail,
                    practicalFail: partFails.practicalFail,
                };
            });
    }, [results, allStudents, selectedYear, className, group, subject]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end p-4 border rounded-lg bg-white/50 shadow-sm">
                <div className="space-y-2">
                    <Label className="text-xs font-bold">পরীক্ষা</Label>
                    <Select value={examName} onValueChange={setExamName}>
                        <SelectTrigger className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                        <SelectContent>{exams.filter(e => Boolean(e?.name)).map((e, idx) => <SelectItem key={`exam-opt-${e.id || idx}-${e.name}`} value={e.name}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="font-bold text-xs">শ্রেণি</Label>
                    <Select value={className} onValueChange={setClassName}>
                        <SelectTrigger className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                        <SelectContent>{Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                {parseInt(className) >= 9 && (
                    <div className="space-y-2">
                        <Label className="text-xs font-bold">শাখা</Label>
                        <Select value={group} onValueChange={setGroup}>
                            <SelectTrigger className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="সকল" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">সকল শাখা</SelectItem><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent>
                        </Select>
                    </div>
                )}
                <div className="space-y-2">
                    <Label className="text-xs font-bold">বিষয়</Label>
                    <Select value={subject} onValueChange={setSubject} disabled={!className}>
                        <SelectTrigger className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="বিষয়" /></SelectTrigger>
                        <SelectContent>{availableSubjects.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <Button onClick={handleLoadReport} disabled={isLoading || !subject || !examName} className="h-9 text-xs font-black">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'রিপোর্ট দেখুন'}
                </Button>
                <Button onClick={handlePrintBlank} variant="outline" className="h-9 text-xs font-black border-amber-600 text-amber-700 hover:bg-amber-50">
                    <Printer className="mr-2 h-4 w-4" /> ফাঁকা মার্কশিট
                </Button>
            </div>

            {results && (
                <Card className="border-2 shadow-lg overflow-hidden">
                    <CardHeader className="bg-primary/5 p-4 border-b flex flex-row justify-between items-center space-y-0">
                        <div>
                            <CardTitle className="text-base font-black text-primary">{subject} - নম্বর ফর্দ ({examName})</CardTitle>
                            <CardDescription className="font-bold text-[10px]">শ্রেণি: {classNamesMap[className]} | শাখা: {groupNamesMap[group || 'all']}</CardDescription>
                        </div>
                        <Button variant="outline" className="font-black h-9 border-primary text-primary" onClick={() => onPrintRequested({ studentData: reportStudents, info: { examName, className, subject, group, fullMarks: results.fullMarks }, isBlank: false })}>
                            <Printer className="mr-2 h-4 w-4" /> প্রিন্ট (PDF)
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="table-container !max-h-[550px]">
                            <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                                    <TableRow>
                                        <TableHead className="w-20 text-center font-black">রোল</TableHead>
                                        <TableHead className="font-black">নাম</TableHead>
                                        <TableHead className="text-center font-black">লিখিত</TableHead>
                                        <TableHead className="text-center font-black">MCQ</TableHead>
                                        <TableHead className="text-center font-black">ব্যবহারিক</TableHead>
                                        <TableHead className="text-center font-black">প্রাপ্ত নম্বর</TableHead>
                                        <TableHead className="text-center font-black">গ্রেড</TableHead>
                                        <TableHead className="text-right pr-6 font-black">পয়েন্ট</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reportStudents.map(({ student, marks, obtainedMarks, grade, point, isPass, writtenFail, mcqFail, practicalFail }) => (
                                        <TableRow key={student.id} className={cn("hover:bg-slate-50 h-10", !isPass && "bg-rose-50/50")}>
                                            <TableCell className={cn("text-center font-black", !isPass && "text-rose-600")}>{toBengaliNumber(student.roll)}</TableCell>
                                            <TableCell className={cn("font-bold text-slate-700", !isPass && "text-rose-700")}>{student.studentNameBn}</TableCell>
                                            <TableCell className={cn("text-center", writtenFail ? "text-rose-600 font-bold bg-rose-50/50" : (!isPass ? "text-slate-700" : ""))}>{marks.written ?? '-'}</TableCell>
                                            <TableCell className={cn("text-center", mcqFail ? "text-rose-600 font-bold bg-rose-50/50" : (!isPass ? "text-slate-700" : ""))}>{marks.mcq ?? '-'}</TableCell>
                                            <TableCell className={cn("text-center", practicalFail ? "text-rose-600 font-bold bg-rose-50/50" : (!isPass ? "text-slate-700" : ""))}>{marks.practical ?? '-'}</TableCell>
                                            <TableCell className={cn("text-center font-black", isPass ? "text-blue-900" : "text-rose-700")}>
                                                {toBengaliNumber(obtainedMarks)}
                                            </TableCell>
                                            <TableCell className={cn("text-center font-black", isPass ? "text-emerald-700" : "text-rose-700")}>{grade}</TableCell>
                                            <TableCell className={cn("text-right pr-6 font-black", isPass ? "text-slate-700" : "text-rose-700")}>{toBengaliNumber(point.toFixed(2))}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

const ResultSheetTab = ({ allStudents, onPrint }: { allStudents: Student[], onPrint: (data: any) => void }) => {
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

    const bulkUploadRef = useRef<HTMLInputElement>(null);
    const [isBulkUploading, setIsBulkUploading] = useState(false);

    const tableContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const topScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const scrollingRef = useRef<string | null>(null);

    const handleScrollSync = (key: string, source: 'top' | 'table') => {
        const top = topScrollRefs.current[key];
        const table = tableContainerRefs.current[key];
        if (!top || !table) return;

        if (scrollingRef.current && scrollingRef.current !== source + key) return;
        
        scrollingRef.current = source + key;
        if (source === 'top') {
            table.scrollLeft = top.scrollLeft;
        } else {
            top.scrollLeft = table.scrollLeft;
        }
        
        requestAnimationFrame(() => {
            scrollingRef.current = null;
        });
    };

    const calculateTableWidth = (subs: SubjectType[]) => {
        let width = 60 + 200 + 350; 
        subs.forEach(s => {
            const isEng = s.name.includes('ইংরেজি');
            const isIct = normalize(s.name).includes('তথ্য ও যোগাযোগ') || normalize(s.name).includes('আইসিটি') || normalize(s.name) === 'ict';
            const hasPrac = s.practical || isIct;
            if (isEng) {
                width += 144; 
            } else if (hasPrac) {
                width += 288; 
            } else {
                width += 240; 
            }
        });
        return width;
    };

    useEffect(() => { 
        if (db && user) getExams(db, selectedYear).then(setExams); 
    }, [db, selectedYear, user]);

    const handleViewResults = async () => {
        if (!examName || !className || !db || !user) { toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ' }); return; }
        setIsLoading(true);
        try {
            const students = allStudents.filter(s => {
                const yearMatch = s.academicYear === selectedYear;
                const classMatch = s.className === className;
                if (!yearMatch || !classMatch) return false;
                if (parseInt(className) < 9 || groupFilter === 'all') return true;
                
                const sGroupNorm = groupMap[(s.group || '').toLowerCase().trim()] || (s.group || '').toLowerCase().trim();
                const filterGroupNorm = groupMap[groupFilter.toLowerCase().trim()] || groupFilter.toLowerCase().trim();
                return sGroupNorm === filterGroupNorm;
            }).sort((a,b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));

            if (students.length === 0) { toast({ title: 'কোনো শিক্ষার্থী নেই' }); setProcessedResults([]); setIsLoading(false); return; }
            
            const allRes = await getAllResults(db, selectedYear, examName).catch(() => []);
            const classRes = allRes.filter(r => r.className === className);
            setClassResults(classRes);
            const subs = getSubjects(className, groupFilter === 'all' ? undefined : groupFilter).filter(s => s.isExamSubject !== false);
            setProcessedResults(processStudentResults(students, classRes, subs));
        } catch (e) {
            console.error(e);
        }
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
                const isIct = normalize(s.name).includes('তথ্য ও যোগাযোগ') || normalize(s.name).includes('আইসিটি') || normalize(s.name) === 'ict';
                const hasPrac = s.practical || isIct;
                if (!isEng) { 
                    row[`${s.name} (লিখিত)`] = sr?.written ?? '-'; 
                    row[`${s.name} (MCQ)`] = sr?.mcq ?? '-'; 
                    if (hasPrac) row[`${s.name} (ব্যবহারিক)`] = sr?.practical ?? '-'; 
                }
                row[`${s.name} (প্রাপ্ত)`] = sr?.marks ?? '-'; 
                row[`${s.name} (গ্রেড)`] = sr?.grade ?? '-'; 
                row[`${s.name} (পয়েন্ট)`] = sr?.point ?? '-';
            });
            row['মোট নম্বর'] = res.totalMarks; 
            row['জি.পি.এ'] = res.gpa.toFixed(2); 
            row['গ্রেড'] = res.finalGrade; 
            row['মেধাস্থান'] = res.isPass ? (res.meritPosition || '-') : (res.isAbsent ? 'অনুপস্থিত' : 'ফেল');
            data.push(row);
        });
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new(); 
        XLSX.utils.book_append_sheet(wb, ws, "Result Sheet");
        XLSX.writeFile(wb, `${examName}_${classNamesMap[className]}_Result.xlsx`);
        toast({ title: 'Excel ডাউনলোড সম্পন্ন হয়েছে' });
    };

    const handleDownloadBulkSample = () => {
        if (!className || !examName) {
            toast({ variant: 'destructive', title: 'শ্রেণি ও পরীক্ষা নির্বাচন করুন' });
            return;
        }
        
        const students = allStudents
            .filter(s => {
                const yearMatch = s.academicYear === selectedYear;
                const classMatch = s.className === className;
                if (!yearMatch || !classMatch) return false;
                if (parseInt(className) < 9 || groupFilter === 'all') return true;
                
                const sGrp = groupMap[(s.group || '').toLowerCase().trim()] || (s.group || '').toLowerCase().trim();
                const fGrp = groupMap[groupFilter.toLowerCase().trim()] || groupFilter.toLowerCase().trim();
                return sGrp === fGrp;
            })
            .sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
        
        const subjects = getSubjects(className, groupFilter === 'all' ? undefined : groupFilter).filter(s => s.isExamSubject !== false);
        
        const headers = ['রোল', 'নাম', 'বিভাগ'];
        subjects.forEach(s => {
            const isEng = s.name.includes('ইংরেজি');
            const isIct = normalize(s.name).includes('তথ্য ও যোগাযোগ') || normalize(s.name).includes('আইসিটি') || normalize(s.name) === 'ict';
            const hasPrac = s.practical || isIct;
            if (!isEng) {
                headers.push(`${s.name} - লিখিত`);
                headers.push(`${s.name} - MCQ`);
                if (hasPrac) headers.push(`${s.name} - ব্যবহারিক`);
            } else {
                headers.push(`${s.name} - প্রাপ্ত`);
            }
        });

        getAllResults(db!, selectedYear, examName).then(allRes => {
            const classRes = allRes.filter(r => r.className === className);
            const sheetData = students.map(s => {
                const row: any = { 'রোল': s.roll, 'নাম': s.studentNameBn, 'বিভাগ': s.group || 'সাধারণ' };
                
                const rawSGroup = (s.group || 'none').toLowerCase().trim();
                const studentGroupNormalized = groupMap[rawSGroup] || rawSGroup;

                subjects.forEach(sub => {
                    const subRes = classRes.find(r => {
                        const rGroupRaw = (r.group || 'none').toLowerCase().trim();
                        const rGroupNorm = groupMap[rGroupRaw] || rGroupRaw;
                        return normalize(r.subject) === normalize(sub.name) && (parseInt(className) < 9 || rGroupNorm === studentGroupNormalized);
                    }) || classRes.find(r => {
                        const rGroupRaw = (r.group || 'none').toLowerCase().trim();
                        const rGroupNorm = groupMap[rGroupRaw] || rGroupRaw;
                        return normalize(r.subject) === normalize(sub.name) && rGroupNorm === 'none';
                    });

                    const marks = subRes?.results.find(mr => mr.studentId === s.id);
                    const isEng = sub.name.includes('ইংরেজি');
                    if (!isEng) {
                        row[`${sub.name} - লিখিত`] = marks?.written ?? '';
                        row[`${sub.name} - MCQ`] = marks?.mcq ?? '';
                        if (sub.practical) row[`${sub.name} - ব্যবহারিক`] = marks?.practical ?? '';
                    } else {
                        row[`${sub.name} - প্রাপ্ত`] = (marks?.written || 0) + (marks?.mcq || 0) + (marks?.practical || 0) || '';
                    }
                });
                return row;
            });

            const ws = XLSX.utils.json_to_sheet(sheetData, { header: headers });
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Result Entry");
            XLSX.writeFile(wb, `Bulk_Result_Entry_Class_${className}_${examName}.xlsx`);
        });
    };

    const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !db || !className || !examName) return;

        setIsBulkUploading(true);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
                const wsname = workbook.SheetNames[0];
                const ws = workbook.Sheets[wsname];
                const json = XLSX.utils.sheet_to_json(ws) as any[];
                
                if (json.length === 0) {
                    toast({ variant: 'destructive', title: 'ফাইলটি খালি' });
                    setIsBulkUploading(false);
                    return;
                }

                const studentsInClass = allStudents.filter(s => s.academicYear === selectedYear && s.className === className);
                const subjects = getSubjects(className).filter(s => s.isExamSubject !== false);
                
                const subjectsToSave: Record<string, ClassResult> = {};
                const allExisting = await getAllResults(db, selectedYear, examName);
                const classExisting = allExisting.filter(r => r.className === className);

                for (const row of json) {
                    const roll = parseInt(String(row['রোল'] || row['roll'] || '0').replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]), 10);
                    
                    const rowGroupRaw = String(row['বিভাগ'] || row['Group'] || row['group'] || '').toLowerCase().trim();
                    const rowGroupNorm = groupMap[rowGroupRaw] || rowGroupRaw;

                    const student = studentsInClass.find(s => {
                        const rollMatch = s.roll === roll;
                        if (!rollMatch) return false;
                        if (parseInt(className) < 9) return true;
                        
                        if (!rowGroupNorm) return true;
                        const sGroupRaw = (s.group || 'none').toLowerCase().trim();
                        const sGroupNorm = groupMap[sGroupRaw] || sGroupRaw;
                        return sGroupNorm === rowGroupNorm;
                    });

                    if (!student) continue;

                    const studentGroupRaw = (student.group || 'none').toLowerCase().trim();
                    let studentGroup = groupMap[studentGroupRaw] || studentGroupRaw;
                    if (parseInt(className) < 9) studentGroup = 'none';

                    subjects.forEach(sub => {
                        const isEng = sub.name.includes('ইংরেজি');
                        let marks: StudentResult | null = null;

                        if (!isEng) {
                            const wVal = row[`${sub.name} - লিখিত`];
                            const mVal = row[`${sub.name} - MCQ`];
                            const pVal = row[`${sub.name} - ব্যবহারিক`];
                            
                            const w = parseInt(String(wVal || '').replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]), 10);
                            const m = parseInt(String(mVal || '').replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]), 10);
                            const p = parseInt(String(pVal || '').replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]), 10);
                            
                            if (!isNaN(w) || !isNaN(m) || !isNaN(p)) {
                                marks = { studentId: student.id, written: isNaN(w) ? undefined : w, mcq: isNaN(m) ? undefined : m, practical: isNaN(p) ? undefined : p };
                            }
                        } else {
                            const totalVal = row[`${sub.name} - প্রাপ্ত`];
                            const total = parseInt(String(totalVal || '').replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]), 10);
                            if (!isNaN(total)) {
                                marks = { studentId: student.id, written: total, mcq: 0, practical: 0 };
                            }
                        }

                        if (marks) {
                            const normalizedName = subjectNameNormalization[sub.name] || sub.name;
                            const uniqueKey = `${normalizedName}-${studentGroup}`;
                            
                            if (!subjectsToSave[uniqueKey]) {
                                const existing = classExisting.find(r => 
                                    (normalize(r.subject) === normalize(normalizedName)) && 
                                    ((groupMap[(r.group || 'none').toLowerCase()] || (r.group || 'none').toLowerCase()) === studentGroup)
                                );
                                
                                subjectsToSave[uniqueKey] = existing ? JSON.parse(JSON.stringify(existing)) : { 
                                    academicYear: selectedYear, 
                                    examName, 
                                    className, 
                                    group: studentGroup === 'none' ? undefined : studentGroup, 
                                    subject: normalizedName, 
                                    fullMarks: sub.fullMarks, 
                                    results: [] 
                                };
                            }
                            
                            const resultArr = subjectsToSave[uniqueKey].results;
                            const existingIdx = resultArr.findIndex(r => r.studentId === student.id);
                            if (existingIdx > -1) resultArr[existingIdx] = marks;
                            else resultArr.push(marks);
                        }
                    });
                }

                const promises = Object.values(subjectsToSave).map(cr => saveClassResults(db, cr));
                await Promise.all(promises);

                toast({ title: 'ফলাফল আপলোড সম্পন্ন', description: `${toBengaliNumber(Object.keys(subjectsToSave).length)} টি বিষয়ের তথ্য সিঙ্ক করা হয়েছে।` });
                handleViewResults();
            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'ত্রুটি', description: 'ফাইলটি প্রসেস করা সম্ভব হয়নি।' });
            } finally {
                setIsBulkUploading(false);
                if (bulkUploadRef.current) bulkUploadRef.current.value = '';
            }
        };
        reader.readAsBinaryString(file);
    };

    const groupedData = useMemo(() => {
        const groups: Record<string, StudentProcessedResult[]> = {};
        processedResults.forEach(res => {
            const g = (parseInt(className) >= 9 && groupFilter !== 'all') ? (groupMap[(res.student.group || 'all').toLowerCase().trim()] || res.student.group || 'all') : 'all';
            if (!groups[g]) groups[g] = [];
            groups[g].push(res);
        });
        
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => (a.student.roll || 0) - (b.student.roll || 0));
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
                        <SelectTrigger className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                        <SelectContent>{exams.filter(e => Boolean(e?.name)).map((e, idx) => <SelectItem key={`exam-opt-${e.id || idx}-${e.name}`} value={e.name}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="font-bold text-xs">শ্রেণি</Label>
                    <Select value={className} onValueChange={c => { setClassName(c); setGroupFilter('all'); setProcessedResults([]); }}>
                        <SelectTrigger className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                        <SelectContent><SelectItem value="6">৬ষ্ঠ</SelectItem><SelectItem value="7">৭ম</SelectItem><SelectItem value="8">৮ম</SelectItem><SelectItem value="9">৯ম</SelectItem><SelectItem value="10">১০ম</SelectItem></SelectContent>
                    </Select>
                </div>
                {parseInt(className) >= 9 && (
                    <div className="space-y-2">
                        <Label className="font-bold text-xs">শাখা</Label>
                        <Select value={groupFilter} onValueChange={setGroupFilter}>
                            <SelectTrigger className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="সকল শাখা" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">সকল শাখা</SelectItem><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent>
                        </Select>
                    </div>
                )}
                <Button onClick={handleViewResults} disabled={isLoading || !examName || !className} className="lg:col-span-1 shadow-md h-9 font-black text-xs">{isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ফলাফল দেখুন'}</Button>
                <div className="flex flex-col gap-1.5 lg:col-span-2">
                    <div className="flex gap-2">
                        <Button onClick={handleDownloadExcel} disabled={processedResults.length === 0} variant="outline" className="flex-1 border-emerald-600 text-emerald-700 hover:bg-emerald-50 h-9 font-black text-xs"><FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel</Button>
                        <Button onClick={() => onPrint({ results: groupedData, classResults, className, groupFilter, examName })} disabled={processedResults.length === 0} variant="outline" className="flex-1 border-primary text-primary hover:bg-primary/5 h-9 font-black text-xs"><Printer className="h-3.5 w-3.5 mr-1" /> প্রিন্ট</Button>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleDownloadBulkSample} disabled={!className || !examName} variant="outline" className="flex-1 text-[9px] h-7 font-bold border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50"><Download className="h-3.5 w-3.5 mr-1" /> নমুনা ডাউনলোড</Button>
                        <Button onClick={() => bulkUploadRef.current?.click()} disabled={isBulkUploading || !className || !examName} className="flex-1 text-[9px] h-7 font-black bg-indigo-600 hover:bg-indigo-700 shadow-md">
                            {isBulkUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileUp className="h-3.5 w-3.5 mr-1" />}
                            Excel আপলোড (সব বিষয়)
                        </Button>
                        <input type="file" ref={bulkUploadRef} className="hidden" accept=".xlsx, .xls" onChange={handleBulkUpload} />
                    </div>
                </div>
            </div>

            {Object.keys(groupedData).map(gk => {
                const results = groupedData[gk];
                const subs = getSubjects(className, gk === 'all' ? undefined : gk).filter(s => {
                    if (!s.isExamSubject) return false;
                    const matchingRecord = classResults.find(r => {
                        const nameMatch = normalize(r.subject) === normalize(s.name);
                        if (!nameMatch) return false;
                        
                        if (parseInt(className) >= 9) {
                            const rGroupRaw = (r.group || 'none').toLowerCase().trim();
                            const rGroupNorm = groupMap[rGroupRaw] || rGroupRaw;
                            const groupKeyNorm = groupMap[gk.toLowerCase().trim()] || gk.toLowerCase().trim();
                            
                            return rGroupNorm === 'none' || rGroupNorm === groupKeyNorm || gk === 'all';
                        }
                        return true;
                    });
                    const effectiveFullMarks = matchingRecord?.fullMarks ?? s.fullMarks;
                    return effectiveFullMarks > 0;
                });

                const totalTableWidth = calculateTableWidth(subs);

                return (
                    <div key={gk} className="space-y-0">
                        <div className="flex justify-between items-center bg-primary/10 p-2 rounded-t-lg border-2 border-black">
                            <h3 className="font-black text-primary text-sm uppercase">শাখা: {groupNamesMap[gk] || gk}</h3>
                            <Badge variant="secondary" className="font-black px-3 text-xs">মোট: {toBengaliNumber(results.length)} জন</Badge>
                        </div>
                        
                        <div 
                            ref={el => { topScrollRefs.current[gk] = el; }}
                            onScroll={() => handleScrollSync(gk, 'top')}
                            className="overflow-x-auto no-print mb-1 h-3 scrollbar-thin scrollbar-thumb-primary/20"
                            style={{ width: '100%' }}
                        >
                            <div style={{ width: `${totalTableWidth}px`, height: '1px' }} />
                        </div>

                        <div 
                            ref={el => { tableContainerRefs.current[gk] = el; }}
                            onScroll={() => handleScrollSync(gk, 'table')}
                            className="table-container !border-2 !border-black relative rounded-b-lg !overflow-auto"
                        >
                            <table className="min-w-max border-separate border-spacing-0 w-full">
                                <thead className="z-30">
                                    <tr>
                                        <th rowSpan={2} className="text-center font-black bg-white border-r-2 border-b-2 border-black sticky left-0 top-0 z-50 w-[60px] text-[12px] p-1 h-[64px] box-border">রোল</th>
                                        <th rowSpan={2} className="text-center font-black bg-white border-r-2 border-b-2 border-black sticky left-[60px] top-0 z-50 min-w-[200px] text-[12px] p-1 h-[64px] box-border">শিক্ষার্থীর নাম</th>
                                        {subs.map((s, idx) => (
                                            <th 
                                                key={s.name} 
                                                colSpan={s.name.includes('ইংরেজি') ? 3 : ((s.practical || normalize(s.name).includes('তথ্য ও যোগাযোগ') || normalize(s.name).includes('আইসিটি')) ? 6 : 5)} 
                                                className={cn(
                                                    "text-center border-r-2 border-b-2 border-black font-black py-1 text-[12px] sticky top-0 z-40 px-2 h-[32px] box-border",
                                                    subBgColors[idx % subBgColors.length]
                                                )}
                                            >
                                                {s.name}
                                            </th>
                                        ))}
                                        <th rowSpan={2} className="text-center font-black border-l-2 border-r-2 border-b-2 border-black text-[14px] bg-[#fff1f2] p-1 sticky top-0 right-[280px] z-50 w-[70px] h-[64px] box-border">মোট</th>
                                        <th rowSpan={2} className="text-center font-black border-r-2 border-b-2 border-black text-[14px] bg-[#fff1f2] p-1 sticky top-0 right-[210px] z-50 w-[70px] h-[64px] box-border">GPA</th>
                                        <th rowSpan={2} className="text-center font-black border-r-2 border-b-2 border-black text-[13px] p-0.5 sticky top-0 right-[140px] bg-[#fff1f2] z-50 w-[70px] h-[64px] box-border">গ্রেড</th>
                                        <th rowSpan={2} className="text-center font-black border-r-2 border-b-2 border-black text-[13px] p-0.5 sticky top-0 right-[70px] bg-[#fff1f2] z-50 w-[70px] h-[64px] box-border">মেধা</th>
                                        <th rowSpan={2} className="text-center font-black border-b-2 border-black text-[14px] bg-[#fff1f2] p-1 sticky top-0 right-0 z-50 w-[70px] h-[64px] box-border">প্রিন্ট</th>
                                    </tr>
                                    <tr className="h-[32px]">
                                        {subs.map((s, idx) => {
                                            const isEng = s.name.includes('ইংরেজি');
                                            const bgColor = subBgColors[idx % subBgColors.length];
                                            return (
                                                <React.Fragment key={s.name}>
                                                    {!isEng && (
                                                        <>
                                                            <th className={cn("text-[11px] text-center border-r-2 border-b-2 border-black font-bold p-0.5 sticky top-[32px] z-30 w-12 h-[32px] box-border", bgColor)}>লিখিত</th>
                                                            <th className={cn("text-[11px] text-center border-r-2 border-b-2 border-black font-bold p-0.5 sticky top-[32px] z-30 w-12 h-[32px] box-border", bgColor)}>MCQ</th>
                                                            {(s.practical || normalize(s.name).includes('তথ্য ও যোগাযোগ') || normalize(s.name).includes('আইসিটি')) && <th className={cn("text-[11px] text-center border-r-2 border-b-2 border-black font-bold p-0.5 sticky top-[32px] z-30 w-12 h-[32px] box-border", bgColor)}>ব্যবহারিক</th>}
                                                        </>
                                                    )}
                                                    <th className={cn("text-[11px] text-center border-r-2 border-b-2 border-black font-black bg-blue-200 text-blue-950 p-0.5 sticky top-[32px] z-30 w-14 h-[32px] box-border", bgColor)}>প্রাপ্ত</th>
                                                    <th className={cn("text-[11px] text-center border-r-2 border-b-2 border-black font-bold p-0.5 sticky top-[32px] z-30 w-10 h-[32px] box-border", bgColor)}>গ্রেড</th>
                                                    <th className={cn("text-[11px] text-center border-r-2 border-b-2 border-black font-bold p-0.5 sticky top-[32px] z-30 w-12 h-[32px] box-border", bgColor)}>পয়েন্ট</th>
                                                </React.Fragment>
                                            )
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map(res => (
                                        <tr key={res.student.id} className="h-10 hover:bg-slate-50 transition-colors">
                                            <td className="text-center font-black sticky left-0 z-20 bg-white border-r-2 border-b-2 border-black text-[13px] p-0.5 w-[60px] h-10 box-border">{toBengaliNumber(res.student.roll)}</td>
                                            <td className="font-bold sticky left-[60px] z-20 bg-white border-r-2 border-b-2 border-black text-[13px] p-0.5 px-3 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px] h-10 box-border">{res.student.studentNameBn}</td>
                                            {subs.map((s, idx) => {
                                                const sr = res.subjectResults.get(s.name);
                                                const isEng = s.name.includes('ইংরেজি');
                                                const bgColor = subBgColors[idx % subBgColors.length];
                                                return (
                                                    <React.Fragment key={`${res.student.id}-${s.name}`}>
                                                        {!isEng && (
                                                            <>
                                                                <td className={cn("text-center border-r-2 border-b-2 border-black text-[12px] p-0.5 font-medium h-10 box-border", bgColor, sr?.writtenFail && "text-rose-600 font-black bg-rose-100")}>{toBengaliNumber(sr?.written ?? '-') }</td>
                                                                <td className={cn("text-center border-r-2 border-b-2 border-black text-[12px] p-0.5 font-medium h-10 box-border", bgColor, sr?.mcqFail && "text-rose-600 font-black bg-rose-100")}>{toBengaliNumber(sr?.mcq ?? '-') }</td>
                                                                {(s.practical || normalize(s.name).includes('তথ্য ও যোগাযোগ') || normalize(s.name).includes('আইসিটি')) && <td className={cn("text-center border-r-2 border-b-2 border-black text-[12px] p-0.5 font-medium h-10 box-border", bgColor, sr?.practicalFail && "text-rose-600 font-black bg-rose-100")}>{toBengaliNumber(sr?.practical ?? '-') }</td>}
                                                            </>
                                                        )}
                                                        <td className={cn("text-center border-r-2 border-b-2 border-black font-black bg-blue-100 text-blue-950 text-[13px] p-0.5 h-10 box-border", bgColor)}>{toBengaliNumber(sr?.marks ?? '-') }</td>
                                                        <td className={cn("text-center border-r-2 border-b-2 border-black text-[12px] font-black p-0.5 h-10 box-border", bgColor, sr && !sr.isPass && "text-rose-700 bg-rose-100")}>{sr?.grade ?? '-' }</td>
                                                        <td className={cn("text-center border-r-2 border-b-2 border-black text-[12px] p-0.5 font-bold h-10 box-border", bgColor)}>{toBengaliNumber(sr?.point?.toFixed(2) ?? '-') }</td>
                                                    </React.Fragment>
                                                )
                                            })}
                                            <td className="text-center font-black text-primary border-l-2 border-r-2 border-b-2 border-black text-[14px] p-0.5 sticky right-[280px] bg-[#fff1f2] z-20 w-[70px] h-10 box-border">{toBengaliNumber(res.totalMarks)}</td>
                                            <td className="text-center font-black border-r-2 border-b-2 border-black text-[14px] p-0.5 sticky right-[210px] bg-[#fff1f2] z-20 w-[70px] h-10 box-border">{toBengaliNumber(res.gpa.toFixed(2))}</td>
                                            <td className={cn("text-center font-black border-r-2 border-b-2 border-black text-[13px] p-0.5 sticky right-[140px] bg-[#fff1f2] z-20 w-[70px] h-10 box-border", !res.isPass && "text-rose-700")}>{res.finalGrade}</td>
                                            <td className={cn("text-center font-black border-r-2 border-b-2 border-black text-[13px] p-0.5 sticky right-[70px] bg-[#fff1f2] z-20 w-[70px] h-10 box-border", !res.isPass && (res.isAbsent ? "text-slate-500 italic text-[11px]" : "text-rose-500 italic text-[11px]"))}>{res.isPass ? (toBengaliNumber(res.meritPosition || '-')) : (res.isAbsent ? 'অনুপস্থিত' : 'ফেল')}</td>
                                            <td className="text-center p-0.5 border-b-2 border-black sticky right-0 bg-[#fff1f2] z-20 w-[70px] h-10 box-border">
                                                <Link href={`/marksheet/${res.student.id}?academicYear=${selectedYear}&examName=${examName}`} target="_blank">
                                                    <Button variant="ghost" size="icon" className="h-6 v-6 hover:bg-white shadow-sm border border-slate-200"><Printer className="h-4 w-4 text-primary" /></Button>
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

const FullMarksTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user, hasPermission } = useAuth();
    
    const [exams, setExams] = useState<Exam[]>([]);
    const [examName, setExamName] = useState('');
    const [selectedClass, setSelectedClass] = useState('6');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [savedResults, setSavedResults] = useState<ClassResult[]>([]);
    
    const [writtenLimits, setWrittenLimits] = useState<Record<string, string>>({});
    const [mcqLimits, setMcqLimits] = useState<Record<string, string>>({});
    const [practicalLimits, setPracticalLimits] = useState<Record<string, string>>({});
    
    const [isSaving, setIsSaving] = useState<string | null>(null);
    const [isSavingAll, setIsSavingAll] = useState(false);

    useEffect(() => {
        if (!db || !user) return;
        getExams(db, selectedYear).then(setExams);
    }, [db, selectedYear, user]);

    const updateSavedResults = useCallback(async () => {
        if (!db || !user) return;
        const allResults = await getAllResults(db, selectedYear, examName || undefined).catch(() => []);
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

    const classes = ['6', '7', '8', '9', '10'];
    const currentSubjects = useMemo(() => {
        const subjects = getSubjects(selectedClass, selectedGroup === 'all' ? undefined : selectedGroup).filter(s => s.isExamSubject !== false);
        return Array.from(new Set(subjects.map(s => s.name)))
            .map(name => subjects.find(s => s.name === name)!);
    }, [selectedClass, selectedGroup]);

    const handleUpdateFullMarks = (cls: string, sub: string, exam: string, currentRecord: ClassResult | null, defaultW: string, defaultM: string, defaultP: string) => {
        if (!db || !user) return;
        if (!isSubjectPermitted(cls, sub)) {
            toast({ variant: 'destructive', title: 'পারমিশন নেই' });
            return;
        }

        const inputKey = `${cls}-${sub}-${exam}`;
        const wLimit = parseInt(writtenLimits[inputKey] ?? defaultW, 10) || 0;
        const mLimit = parseInt(mcqLimits[inputKey] ?? defaultM, 10) || 0;
        const pLimit = parseInt(practicalLimits[inputKey] ?? defaultP, 10) || 0;
        const totalFm = wLimit + mLimit + pLimit;

        if (totalFm <= 0) {
            toast({ variant: 'destructive', title: 'পূর্ণমান ০ হতে পারে না' });
            return;
        }

        setIsSaving(inputKey);

        const effectiveGroup = (parseInt(cls) < 9 || selectedGroup === 'all') ? undefined : selectedGroup;

        const dataToSave: ClassResult = currentRecord 
            ? { ...currentRecord, fullMarks: totalFm, writtenLimit: wLimit, mcqLimit: mLimit, practicalLimit: pLimit }
            : { academicYear: selectedYear, examName: exam, className: cls, subject: sub, fullMarks: totalFm, writtenLimit: wLimit, mcqLimit: mLimit, practicalLimit: pLimit, results: [], group: effectiveGroup };

        saveClassResults(db, dataToSave).finally(() => {
            setIsSaving(null);
            updateSavedResults();
        });
        
        toast({ title: 'পূর্ণমান সংরক্ষিত হয়েছে' });
    };

    const handleSaveAllFullMarks = async () => {
        if (!db || !user || !examName) return;
        setIsSavingAll(true);
        
        let updateCount = 0;
        const promises = [];

        for (const subInfo of currentSubjects) {
            if (!isSubjectPermitted(selectedClass, subInfo.name)) continue;

            const inputKey = `${selectedClass}-${subInfo.name}-${examName}`;
            
            const matchingRecords = savedResults.filter(r => 
                r.className === selectedClass && 
                normalize(r.subject) === normalize(subInfo.name) && 
                r.examName === examName &&
                (parseInt(selectedClass) < 9 || (selectedGroup === 'all' ? (!r.group || r.group === 'none') : r.group === selectedGroup))
            );
            
            const existingRecord = matchingRecords.length > 0 ? matchingRecords[0] : null;
            const isEnglish = normalize(subInfo.name).includes('ইংরেজি') || normalize(subInfo.name).includes('english');
            const isIct = normalize(subInfo.name).includes('তথ্য ও যোগাযোগ') || normalize(subInfo.name).includes('আইসিটি') || normalize(subInfo.name) === 'ict';
            const hasPractical = subInfo.practical || isIct;

            const defaultW = existingRecord?.writtenLimit?.toString() || (existingRecord ? '0' : (isIct ? '0' : (subInfo.fullMarks === 100 ? (hasPractical ? '50' : '70') : (subInfo.fullMarks === 0 ? '0' : '35'))));
            const defaultM = existingRecord?.mcqLimit?.toString() || (existingRecord ? (isIct && (!existingRecord.mcqLimit || existingRecord.mcqLimit === 0) ? '25' : '0') : (isEnglish ? '0' : (isIct ? '25' : (subInfo.fullMarks === 100 ? (hasPractical ? '25' : '30') : (subInfo.fullMarks === 0 ? '0' : '15')))));
            const defaultP = existingRecord?.practicalLimit?.toString() || (existingRecord ? (isIct && (!existingRecord.practicalLimit || existingRecord.practicalLimit === 0) ? '25' : '0') : (hasPractical ? '25' : '0'));

            const wLimit = parseInt(writtenLimits[inputKey] ?? defaultW, 10) || 0;
            const mLimit = parseInt(mcqLimits[inputKey] ?? defaultM, 10) || 0;
            const pLimit = parseInt(practicalLimits[inputKey] ?? defaultP, 10) || 0;
            const totalFm = wLimit + mLimit + pLimit;

            if (totalFm <= 0) continue;

            const effectiveGroup = (parseInt(selectedClass) < 9 || selectedGroup === 'all') ? undefined : selectedGroup;

            const dataToSave: ClassResult = existingRecord 
                ? { ...existingRecord, fullMarks: totalFm, writtenLimit: wLimit, mcqLimit: mLimit, practicalLimit: pLimit }
                : { academicYear: selectedYear, examName: examName, className: selectedClass, subject: subInfo.name, fullMarks: totalFm, writtenLimit: wLimit, mcqLimit: mLimit, practicalLimit: pLimit, results: [], group: effectiveGroup };

            promises.push(saveClassResults(db, dataToSave));
            updateCount++;
        }

        if (updateCount > 0) {
            await Promise.all(promises);
            toast({ title: 'সকল পূর্ণমান সংরক্ষিত হয়েছে', description: `${toBengaliNumber(updateCount)} টি বিষয়ের তথ্য আপডেট হয়েছে।` });
            updateSavedResults();
        }
        setIsSavingAll(false);
    };

    const handleDeleteResult = (id: string) => {
        if (!db || !id || !user) return;
        deleteClassResult(db, id);
        toast({ title: 'ফলাফল মোছা হয়েছে' });
        setTimeout(updateSavedResults, 500);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6 items-end p-6 bg-white border-2 border-black/5 rounded-3xl shadow-sm no-print">
                <div className="w-full md:w-64 space-y-2">
                    <Label className="font-black text-xs text-primary mb-1 block uppercase tracking-wider">১. পরীক্ষা নির্বাচন</Label>
                    <Select value={examName} onValueChange={setExamName}>
                        <SelectTrigger className="h-11 border-2 font-black"><SelectValue placeholder="পরীক্ষা নির্বাচন করুন" /></SelectTrigger>
                        <SelectContent>
                            {exams.filter(e => Boolean(e?.name)).map((e, idx) => <SelectItem key={`exam-opt-${e.id || idx}-${e.name}`} value={e.name}>{e.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-1 w-full md:w-48 space-y-2">
                    <Label className="font-black text-xs text-primary mb-1 block uppercase tracking-wider">২. শ্রেণি নির্বাচন করুন</Label>
                    <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedGroup('all'); }}>
                        <SelectTrigger className="h-11 border-2 font-black"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger>
                        <SelectContent>
                            {classes.map(cls => (
                                <SelectItem key={cls} value={cls} className="font-bold">{classNamesMap[cls]} শ্রেণি</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {parseInt(selectedClass) >= 9 && (
                    <div className="w-full md:w-48 space-y-2">
                        <Label className="font-black text-xs text-primary mb-1 block uppercase tracking-wider">৩. শাখা নির্বাচন</Label>
                        <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                            <SelectTrigger className="h-11 border-2 font-black"><SelectValue placeholder="সকল শাখা" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">সকল শাখা</SelectItem>
                                <SelectItem value="science">বিজ্ঞান</SelectItem>
                                <SelectItem value="arts">মানবিক</SelectItem>
                                <SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            <div className="space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between px-2">
                    <h3 className="font-black text-xl text-primary flex items-center gap-2">
                        <CheckCircle2 className="h-6 w-6" /> {classNamesMap[selectedClass]} শ্রেণির বিষয় ও পূর্ণমান তালিকা
                    </h3>
                    <Badge variant="outline" className="font-black border-primary text-primary px-4 h-8">
                        মোট {toBengaliNumber(currentSubjects.length)} টি বিষয়
                    </Badge>
                </div>
                
                <Card className="border-2 border-black overflow-hidden shadow-xl rounded-2xl bg-white">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-muted/50 border-b-2 border-black">
                                    <TableRow>
                                        <TableHead className="pl-8 font-black text-black">ক্রমিক</TableHead>
                                        <TableHead className="font-black text-black">বিষয়ের নাম</TableHead>
                                        <TableHead className="w-32 text-center font-black text-black">লিখিত</TableHead>
                                        <TableHead className="w-32 text-center font-black text-black">MCQ</TableHead>
                                        <TableHead className="w-32 text-center font-black text-black">ব্যবহারিক</TableHead>
                                        <TableHead className="w-32 text-center font-black text-primary">মোট পূর্ণমান</TableHead>
                                        <TableHead className="text-right pr-8 font-black text-black">কার্যক্রম</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {currentSubjects.map((subInfo, i) => {
                                        const matchingRecords = savedResults.filter(r => 
                                            r.className === selectedClass && 
                                            normalize(r.subject) === normalize(subInfo.name) && 
                                            r.examName === examName &&
                                            (parseInt(selectedClass) < 9 || (selectedGroup === 'all' ? (!r.group || r.group === 'none') : r.group === selectedGroup))
                                        );
                                        
                                        const existingRecord = matchingRecords.length > 0 ? matchingRecords[0] : null;
                                        const inputKey = `${selectedClass}-${subInfo.name}-${examName}`;
                                        
                                        const isEnglish = normalize(subInfo.name).includes('ইংরেজি') || normalize(subInfo.name).includes('english');
                                        const isIct = normalize(subInfo.name).includes('তথ্য ও যোগাযোগ') || normalize(subInfo.name).includes('আইসিটি') || normalize(subInfo.name) === 'ict';
                                        const hasPractical = subInfo.practical || isIct;

                                        const defaultW = existingRecord?.writtenLimit?.toString() || (existingRecord ? '0' : (isIct ? '0' : (subInfo.fullMarks === 100 ? (hasPractical ? '50' : '70') : (subInfo.fullMarks === 0 ? '0' : '35'))));
                                        const defaultM = existingRecord?.mcqLimit?.toString() || (existingRecord ? (isIct && (!existingRecord.mcqLimit || existingRecord.mcqLimit === 0) ? '25' : '0') : (isEnglish ? '0' : (isIct ? '25' : (subInfo.fullMarks === 100 ? (hasPractical ? '25' : '30') : (subInfo.fullMarks === 0 ? '0' : '15')))));
                                        const defaultP = existingRecord?.practicalLimit?.toString() || (existingRecord ? (isIct && (!existingRecord.practicalLimit || existingRecord.practicalLimit === 0) ? '25' : '0') : (hasPractical ? '25' : '0'));

                                        const wVal = writtenLimits[inputKey] ?? defaultW;
                                        const mVal = mcqLimits[inputKey] ?? defaultM;
                                        const pVal = practicalLimits[inputKey] ?? defaultP;
                                        
                                        const autoTotal = (parseInt(wVal, 10) || 0) + (parseInt(mVal, 10) || 0) + (parseInt(pVal, 10) || 0);

                                        const isPermitted = isSubjectPermitted(selectedClass, subInfo.name);

                                        return (
                                            <TableRow key={`${selectedClass}-${subInfo.name}`} className="h-16 border-b last:border-0 hover:bg-slate-50/50 transition-colors">
                                                <TableCell className="pl-8 font-bold text-muted-foreground">{toBengaliNumber(i + 1)}</TableCell>
                                                <TableCell className="font-black text-primary text-base">
                                                    {subInfo.name}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Input 
                                                        type="number" 
                                                        value={wVal}
                                                        onChange={(e) => setWrittenLimits(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                                        className="h-10 w-24 text-center font-black bg-white border-2 border-black/20 focus:border-primary text-base mx-auto" 
                                                        disabled={!isPermitted} 
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Input 
                                                        type="number" 
                                                        value={mVal}
                                                        onChange={(e) => setMcqLimits(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                                        className="h-10 w-24 text-center font-black bg-white border-2 border-black/20 focus:border-primary text-base mx-auto" 
                                                        disabled={!isPermitted || isEnglish} 
                                                        placeholder={isEnglish ? 'N/A' : ''}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Input 
                                                        type="number" 
                                                        value={pVal}
                                                        onChange={(e) => setPracticalLimits(prev => ({ ...prev, [inputKey]: e.target.value }))}
                                                        className="h-10 w-24 text-center font-black bg-white border-2 border-black/20 focus:border-primary text-base mx-auto" 
                                                        disabled={!isPermitted || !hasPractical} 
                                                        placeholder={!hasPractical ? 'N/A' : ''}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="h-10 w-24 flex items-center justify-center font-black bg-primary/5 border-2 border-primary/20 text-primary text-lg rounded-md mx-auto">
                                                        {toBengaliNumber(autoTotal)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <div className="flex gap-2 justify-end">
                                                        <Button 
                                                            variant="outline" 
                                                            size="icon" 
                                                            className={cn(
                                                                "h-9 w-9 shrink-0 shadow-sm border-2",
                                                                isSaving === inputKey ? "text-slate-400" : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                                            )}
                                                            disabled={!isPermitted || isSaving === inputKey}
                                                            onClick={() => handleUpdateFullMarks(selectedClass, subInfo.name, examName, existingRecord || null, defaultW, defaultM, defaultP)}
                                                        >
                                                            {isSaving === inputKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                        </Button>
                                                        {existingRecord && (
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="outline" size="icon" className="h-9 w-9 text-rose-600 border-rose-100 hover:bg-rose-50" disabled={!isPermitted}>
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent className="font-kalpurush">
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle className="font-black text-rose-700">আপনি কি নিশ্চিত?</AlertDialogTitle>
                                                                        <AlertDialogDescription className="font-bold">
                                                                            এই বিষয়ের জন্য এন্ট্রি করা সকল ফলাফল মুছে যাবে। (পূর্ণমান সংরক্ষিত থাকবে না)
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel className="font-bold">বাতিল</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteResult(existingRecord.id!)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-black">মুছে ফেলুন</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-slate-50 p-6 border-t-2 border-black flex justify-between items-center no-print">
                        <p className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                            <Info className="h-4 w-4 text-primary" /> সব বিষয়ের তথ্য ইনপুট দেওয়ার পর এক ক্লিকে সেভ করুন।
                        </p>
                        <Button 
                            onClick={handleSaveAllFullMarks} 
                            disabled={isSavingAll || !examName || currentSubjects.length === 0}
                            className="h-14 px-12 text-lg font-black shadow-2xl transition-all"
                        >
                            {isSavingAll ? <Loader2 className="h-5 w-5 mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                            সকল বিষয়ের পূর্ণমান সেভ করুন
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        </div>
    );
};

const MeritListTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user } = useAuth();
    const [exams, setExams] = useState<Exam[]>([]);
    const [examName, setExamName] = useState('');
    const [className, setClassName] = useState('');
    const [groupFilter, setGroupFilter] = useState('all');
    const [consideredFails, setConsideredFails] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [meritResults, setMeritResults] = useState<StudentProcessedResult[]>([]);

    useEffect(() => { 
        if (db && user) getExams(db, selectedYear).then(setExams); 
    }, [db, selectedYear, user]);

    const handleViewMeritList = async () => {
        if (!examName || !className || !db) return;
        setIsLoading(true);
        try {
            const students = allStudents.filter(s => {
                const yearMatch = s.academicYear === selectedYear;
                const classMatch = s.className === className;
                if (!yearMatch || !classMatch) return false;
                if (parseInt(className) < 9 || groupFilter === 'all') return true;
                
                const sGroupNorm = groupMap[(s.group || '').toLowerCase().trim()] || (s.group || '').toLowerCase().trim();
                const filterGroupNorm = groupMap[groupFilter.toLowerCase().trim()] || groupFilter.toLowerCase().trim();
                return sGroupNorm === filterGroupNorm;
            });

            if (students.length === 0) { setMeritResults([]); setIsLoading(false); return; }

            const allRes = await getAllResults(db, selectedYear, examName);
            const classRes = allRes.filter(r => r.className === className);
            const subs = getSubjects(className, groupFilter === 'all' ? undefined : groupFilter).filter(s => s.isExamSubject !== false);
            setMeritResults(processStudentResults(students, classRes, subs));
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    };

    const regularPassedStudents = useMemo(() => {
        return meritResults
            .filter(r => r.isPass && !r.isAbsent)
            .sort((a, b) => {
                if (Math.abs(b.gpa - a.gpa) > 0.001) return b.gpa - a.gpa;
                if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
                return a.student.roll - b.student.roll;
            });
    }, [meritResults]);

    const specialPassedStudents = useMemo(() => {
        if (consideredFails.length === 0) return [];
        return meritResults
            .filter(r => !r.isPass && !r.isAbsent && consideredFails.includes(r.failedSubjectsCount))
            .sort((a, b) => {
                if (a.failedSubjectsCount !== b.failedSubjectsCount) return a.failedSubjectsCount - b.failedSubjectsCount;
                if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
                return a.student.roll - b.student.roll;
            });
    }, [meritResults, consideredFails]);

    const failedStudents = useMemo(() => {
        return meritResults
            .filter(r => !r.isPass && !r.isAbsent && !consideredFails.includes(r.failedSubjectsCount))
            .sort((a, b) => {
                if (a.failedSubjectsCount !== b.failedSubjectsCount) return a.failedSubjectsCount - b.failedSubjectsCount;
                if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
                return a.student.roll - b.student.roll;
            });
    }, [meritResults, consideredFails]);

    const absentStudents = useMemo(() => {
        return meritResults
            .filter(r => r.isAbsent)
            .sort((a, b) => a.student.roll - b.student.roll);
    }, [meritResults]);

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

    const queryFails = consideredFails.length > 0 ? `&consideredFails=${consideredFails.join(',')}` : '';

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end p-4 border rounded-lg bg-white/50 shadow-sm">
                <div className="space-y-2">
                    <Label className="text-xs font-bold">পরীক্ষা</Label>
                    <Select value={examName} onValueChange={setExamName}>
                        <SelectTrigger className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                        <SelectContent>{exams.filter(e => Boolean(e?.name)).map((e, idx) => <SelectItem key={`exam-opt-${e.id || idx}-${e.name}`} value={e.name}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="font-bold text-xs">শ্রেণি</Label>
                    <Select value={className} onValueChange={setClassName}>
                        <SelectTrigger className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                        <SelectContent>{Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                {parseInt(className) >= 9 && (
                    <div className="space-y-2">
                        <Label className="text-xs font-bold">শাখা</Label>
                        <Select value={groupFilter} onValueChange={setGroupFilter}>
                            <SelectTrigger className="bg-white h-9 text-xs font-bold border-2"><SelectValue placeholder="সকল শাখা" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">সকল শাখা</SelectItem><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent>
                        </Select>
                    </div>
                )}
                <Button onClick={handleViewMeritList} disabled={isLoading || !examName || !className} className="h-9 text-xs font-black">মেধা তালিকা দেখুন</Button>
                <Link href={`/results/merit-list?academicYear=${selectedYear}&examName=${encodeURIComponent(examName)}&className=${className}&group=${groupFilter}${queryFails}`} target="_blank">
                    <Button variant="outline" disabled={meritResults.length === 0} className="w-full h-9 text-xs font-black border-primary text-primary"><Printer className="h-3.5 w-3.5 mr-1" /> প্রিন্ট তালিকা</Button>
                </Link>
            </div>

            {meritResults.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 border rounded-xl bg-amber-50/50 shadow-sm">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-amber-600" />
                            বিশেষ বিবেচনায় পাশ নির্বাচন:
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                            {[1, 2, 3, 4, 5, 6].map(failCount => (
                                <label 
                                    key={failCount} 
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-black cursor-pointer transition-all",
                                        consideredFails.includes(failCount) 
                                            ? "bg-amber-100 border-amber-400 text-amber-900 shadow-sm" 
                                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                    )}
                                >
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
                                    <span>{toBengaliNumber(failCount)} বিষয়ে ফেল</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="text-[11px] font-bold text-amber-800">
                        * টিক দিলে তাদের ফলাফল 'পাশ' দেখাবে এবং পৃথক তালিকায় তাদের মেধাক্রম ১, ২, ৩... সাজানো হবে।
                    </div>
                </div>
            )}

            {meritResults.length > 0 && (
                <div className="space-y-6">
                    {/* ১. নিয়মিত কৃতকার্য শিক্ষার্থী */}
                    <Card className="border-2 shadow-lg rounded-2xl overflow-hidden bg-white">
                        <CardHeader className="bg-emerald-500/10 p-4 border-b flex flex-row justify-between items-center">
                            <CardTitle className="text-base font-black text-emerald-950 flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-amber-500" />
                                মেধা তালিকা (কৃতকার্য শিক্ষার্থী) - {examName}
                            </CardTitle>
                            <Badge className="bg-emerald-700 font-black px-4">{toBengaliNumber(regularPassedStudents.length)} জন</Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            {regularPassedStudents.length > 0 ? (
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="w-16 text-center font-black">মেধা</TableHead>
                                            <TableHead className="w-16 text-center font-black">রোল</TableHead>
                                            <TableHead className="font-black">নাম</TableHead>
                                            <TableHead className="w-24 text-center font-black">শাখা/বিভাগ</TableHead>
                                            <TableHead className="text-center font-black">মোট নম্বর</TableHead>
                                            <TableHead className="text-center font-black">GPA</TableHead>
                                            <TableHead className="text-center font-black">গ্রেড</TableHead>
                                            <TableHead className="text-center font-black">ফলাফল</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {regularPassedStudents.map((res, idx) => (
                                            <TableRow key={res.student.id} className="h-11 hover:bg-slate-50">
                                                <TableCell className="text-center font-black text-lg text-emerald-800">{toBengaliNumber(idx + 1)}</TableCell>
                                                <TableCell className="text-center font-bold">{toBengaliNumber(res.student.roll)}</TableCell>
                                                <TableCell className="font-bold text-slate-800">{res.student.studentNameBn}</TableCell>
                                                <TableCell className="text-center font-bold text-slate-600 text-xs">{groupNamesMap[res.student.group || ''] || res.student.group || 'সাধারণ'}</TableCell>
                                                <TableCell className="text-center font-black text-blue-900">{toBengaliNumber(res.totalMarks)}</TableCell>
                                                <TableCell className="text-center font-black">{toBengaliNumber(res.gpa.toFixed(2))}</TableCell>
                                                <TableCell className="text-center font-black">{res.finalGrade}</TableCell>
                                                <TableCell className="text-center"><Badge className="font-black px-3 bg-emerald-600">কৃতকার্য</Badge></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="p-6 text-center text-sm font-bold text-muted-foreground">কোনো শিক্ষার্থী নিয়মিত পাস করেনি।</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ২. বিশেষ বিবেচনায় পাশ করা শিক্ষার্থী */}
                    {specialPassedStudents.length > 0 && (
                        <Card className="border-2 border-amber-300 shadow-lg rounded-2xl overflow-hidden bg-white">
                            <CardHeader className="bg-amber-500/15 p-4 border-b border-amber-200 flex flex-row justify-between items-center">
                                <CardTitle className="text-base font-black text-amber-950 flex items-center gap-2">
                                    <Sparkles className="h-5 w-5 text-amber-600" />
                                    {getSpecialPassTitle(consideredFails)}
                                </CardTitle>
                                <Badge className="bg-amber-600 font-black px-4">{toBengaliNumber(specialPassedStudents.length)} জন</Badge>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-amber-50/50">
                                        <TableRow>
                                            <TableHead className="w-20 text-center font-black text-amber-950">মেধাক্রম</TableHead>
                                            <TableHead className="w-16 text-center font-black">রোল</TableHead>
                                            <TableHead className="font-black">নাম</TableHead>
                                            <TableHead className="w-24 text-center font-black text-amber-950">শাখা/বিভাগ</TableHead>
                                            <TableHead className="text-center font-black">ফেল বিষয়</TableHead>
                                            <TableHead className="text-center font-black">মোট নম্বর</TableHead>
                                            <TableHead className="text-center font-black">GPA</TableHead>
                                            <TableHead className="text-center font-black">গ্রেড</TableHead>
                                            <TableHead className="text-center font-black">ফলাফল</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {specialPassedStudents.map((res, idx) => (
                                            <TableRow key={res.student.id} className="h-11 bg-amber-50/20 hover:bg-amber-100/40">
                                                <TableCell className="text-center font-black text-lg text-amber-900">{toBengaliNumber(idx + 1)}</TableCell>
                                                <TableCell className="text-center font-bold">{toBengaliNumber(res.student.roll)}</TableCell>
                                                <TableCell className="font-bold text-slate-800">{res.student.studentNameBn}</TableCell>
                                                <TableCell className="text-center font-bold text-slate-600 text-xs">{groupNamesMap[res.student.group || ''] || res.student.group || 'সাধারণ'}</TableCell>
                                                <TableCell className="text-center font-bold text-amber-800">{toBengaliNumber(res.failedSubjectsCount)}টি</TableCell>
                                                <TableCell className="text-center font-black text-blue-900">{toBengaliNumber(res.totalMarks)}</TableCell>
                                                <TableCell className="text-center font-black">{toBengaliNumber(res.gpa.toFixed(2))}</TableCell>
                                                <TableCell className="text-center font-black text-amber-700">{res.finalGrade}</TableCell>
                                                <TableCell className="text-center"><Badge className="font-black px-3 bg-emerald-600">পাশ</Badge></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {/* ৩. অকৃতকার্য শিক্ষার্থী */}
                    {failedStudents.length > 0 && (
                        <Card className="border-2 border-rose-200 shadow-lg rounded-2xl overflow-hidden bg-white">
                            <CardHeader className="bg-rose-50 p-4 border-b border-rose-200 flex flex-row justify-between items-center">
                                <CardTitle className="text-base font-black text-rose-950 flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-rose-600" />
                                    অকৃতকার্য শিক্ষার্থীর তালিকা
                                </CardTitle>
                                <Badge className="bg-rose-600 font-black px-4">{toBengaliNumber(failedStudents.length)} জন</Badge>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-rose-50/40">
                                        <TableRow>
                                            <TableHead className="w-20 text-center font-black text-rose-950">ক্রমিক</TableHead>
                                            <TableHead className="w-16 text-center font-black">রোল</TableHead>
                                            <TableHead className="font-black">নাম</TableHead>
                                            <TableHead className="w-24 text-center font-black text-rose-950">শাখা/বিভাগ</TableHead>
                                            <TableHead className="text-center font-black">ফেল বিষয়</TableHead>
                                            <TableHead className="text-center font-black">মোট নম্বর</TableHead>
                                            <TableHead className="text-center font-black">GPA</TableHead>
                                            <TableHead className="text-center font-black">গ্রেড</TableHead>
                                            <TableHead className="text-center font-black">ফলাফল</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {failedStudents.map((res, idx) => (
                                            <TableRow key={res.student.id} className="h-11 bg-rose-50/20 hover:bg-rose-100/30">
                                                <TableCell className="text-center font-black text-base text-rose-800">{toBengaliNumber(idx + 1)}</TableCell>
                                                <TableCell className="text-center font-bold">{toBengaliNumber(res.student.roll)}</TableCell>
                                                <TableCell className="font-bold text-slate-800">{res.student.studentNameBn}</TableCell>
                                                <TableCell className="text-center font-bold text-slate-600 text-xs">{groupNamesMap[res.student.group || ''] || res.student.group || 'সাধারণ'}</TableCell>
                                                <TableCell className="text-center font-bold text-rose-700">{toBengaliNumber(res.failedSubjectsCount)}টি</TableCell>
                                                <TableCell className="text-center font-black text-blue-900">{toBengaliNumber(res.totalMarks)}</TableCell>
                                                <TableCell className="text-center font-black">{toBengaliNumber(res.gpa.toFixed(2))}</TableCell>
                                                <TableCell className="text-center font-black text-rose-600">{res.finalGrade}</TableCell>
                                                <TableCell className="text-center"><Badge className="font-black px-3 bg-rose-600">অকৃতকার্য</Badge></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}

                    {/* ৪. অনুপস্থিত শিক্ষার্থী */}
                    {absentStudents.length > 0 && (
                        <Card className="border-2 border-slate-200 shadow-lg rounded-2xl overflow-hidden bg-white">
                            <CardHeader className="bg-slate-100 p-4 border-b flex flex-row justify-between items-center">
                                <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                                    <UserCheck className="h-5 w-5 text-slate-600" />
                                    অনুপস্থিত শিক্ষার্থীর তালিকা
                                </CardTitle>
                                <Badge className="bg-slate-600 font-black px-4">{toBengaliNumber(absentStudents.length)} জন</Badge>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="w-20 text-center font-black text-slate-800">ক্রমিক</TableHead>
                                            <TableHead className="w-16 text-center font-black">রোল</TableHead>
                                            <TableHead className="font-black">নাম</TableHead>
                                            <TableHead className="w-24 text-center font-black text-slate-800">শাখা/বিভাগ</TableHead>
                                            <TableHead className="text-center font-black">অবস্থা</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {absentStudents.map((res, idx) => (
                                            <TableRow key={res.student.id} className="h-11 hover:bg-slate-50">
                                                <TableCell className="text-center font-black text-base text-slate-700">{toBengaliNumber(idx + 1)}</TableCell>
                                                <TableCell className="text-center font-bold">{toBengaliNumber(res.student.roll)}</TableCell>
                                                <TableCell className="font-bold text-slate-700">{res.student.studentNameBn}</TableCell>
                                                <TableCell className="text-center font-bold text-slate-600 text-xs">
                                                    {groupNamesMap[res.student.group || ''] || res.student.group || 'সাধারণ'}
                                                </TableCell>
                                                <TableCell className="text-center"><Badge className="font-black px-3 bg-slate-500">অনুপস্থিত</Badge></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
};

const PromotionTab = ({ allStudents }: { allStudents: Student[] }) => {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const { toast } = useToast();
    
    const [sourceClass, setSourceClass] = useState('6');
    const [targetYear, setTargetYear] = useState<string>((parseInt(selectedYear) + 1).toString());
    const [targetClass, setTargetClass] = useState<string>('7');
    const [passedStudents, setPassedStudents] = useState<StudentProcessedResult[]>([]);
    const [failedStudents, setFailedStudents] = useState<StudentProcessedResult[]>([]);
    const [selectedIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(false);
    const [isPromoting, setIsPromoting] = useState(false);
    
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [promotionMode, setPromotionType] = useState<'pass' | 'special'>('pass');
    const [projectedPromotions, setProjectedPromotions] = useState<any[]>([]);

    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyLoading, setHistoryHistoryLoading] = useState(false);
    const [promotedHistory, setPromotedHistory] = useState<any[]>([]);
    const [unpromotedHistory, setUnpromotedHistory] = useState<any[]>([]);

    const handleLoadSource = async () => {
        if (!sourceClass || !db) return;
        setIsLoading(true);
        try {
            const classStudents = allStudents.filter(s => s.academicYear === selectedYear && s.className === sourceClass);
            const allRes = await getAllResults(db, selectedYear, 'বার্ষিক পরীক্ষা').catch(() => []);
            const classRes = allRes.filter(r => r.className === sourceClass);
            const subs = getSubjects(sourceClass).filter(s => s.isExamSubject !== false);
            const processed = processStudentResults(classStudents, classRes, subs);
            
            setPassedStudents(processed.filter(r => r.isPass).sort((a,b) => (a.meritPosition || 0) - (b.meritPosition || 0)));
            setFailedStudents(processed.filter(r => !r.isPass).sort((a,b) => {
                if (a.failedSubjectsCount !== b.failedSubjectsCount) return a.failedSubjectsCount - b.failedSubjectsCount;
                return b.totalMarks - a.totalMarks;
            }));
            setSelectedStudentIds(new Set());
        } catch (e) { console.error(e); }
        setIsLoading(false);
    };

    const handleShowPreview = async (mode: 'pass' | 'special') => {
        if (isPromoting) return;
        setPromotionType(mode);
        const studentsToPromote = mode === 'pass' ? passedStudents : failedStudents.filter(f => selectedIds.has(f.student.id));
        if (studentsToPromote.length === 0) {
            toast({ variant: 'destructive', title: 'কোনো শিক্ষার্থী নির্বাচিত করা হয়নি' });
            return;
        }

        setIsPromoting(true);
        try {
            const startRoll = mode === 'pass' ? 1 : passedStudents.length + 1;
            
            const projected = studentsToPromote.map((res, index) => {
                const s = res.student;
                return {
                    name: s.studentNameBn,
                    id: s.id,
                    generatedId: s.generatedId,
                    currentRoll: s.roll,
                    projectedRoll: startRoll + index,
                    resData: res
                };
            });

            setProjectedPromotions(projected);
            setIsPreviewOpen(true);
        } catch (e) { console.error(e); }
        setIsPromoting(false);
    };

    const updateProjectedRoll = (studentId: string, newRoll: string) => {
        const bnToEn = (str: string) => str.replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)].toString());
        const rollNum = parseInt(bnToEn(newRoll).trim(), 10);
        setProjectedPromotions(prev => prev.map(p => 
            p.id === studentId ? { ...p, projectedRoll: isNaN(rollNum) ? 0 : rollNum } : p
        ));
    };

    const handleConfirmPromotion = async () => {
        if (!db || isPromoting) return;
        setIsPromoting(true);
        try {
            const batch = writeBatch(db);
            const targetSnap = await getDocs(query(collection(db, 'students'), where('academicYear', '==', String(targetYear)), where('className', '==', String(targetClass))));
            const existingTargetStudents = targetSnap.docs.map(studentFromDoc);
            const newAdmissions = existingTargetStudents.filter(s => !s._promoStatus);
            const alreadyPromoted = existingTargetStudents.filter(s => !!s._promoStatus);
            const studentsToPromote = projectedPromotions;
            const normalizeStr = (s: any) => String(s || '').trim().toLowerCase();

            for (let i = 0; i < studentsToPromote.length; i++) {
                const item = studentsToPromote[i];
                const res = item.resData;
                const s = res.student;
                const yearSuffix = String(targetYear).slice(-2);
                const classCode = String(targetClass).padStart(2, '0');
                const rollSerial = String(item.projectedRoll).padStart(4, '0');
                const newGeneratedId = `${yearSuffix}${classCode}${rollSerial}`;
                const studentData = { ...s, roll: item.projectedRoll, generatedId: newGeneratedId, academicYear: String(targetYear), className: String(targetClass), updatedAt: serverTimestamp(), _promoStatus: res.isPass ? 'pass' : 'fail', _promoRank: res.meritPosition || 999, _promoFailCount: res.failedSubjectsCount, _promoTotalMarks: res.totalMarks };
                delete (studentData as any).id;
                delete (studentData as any).createdAt;
                Object.keys(studentData).forEach(key => { if ((studentData as any)[key] === undefined) delete (studentData as any)[key]; });
                const existingRec = existingTargetStudents.find(ts => normalizeStr(ts.studentNameBn) === normalizeStr(s.studentNameBn) && normalizeStr(ts.fatherNameBn) === normalizeStr(s.fatherNameBn) && normalizeStr(ts.motherNameBn) === normalizeStr(s.motherNameBn));
                if (existingRec) batch.update(doc(db, 'students', existingRec.id), studentData);
                else batch.set(doc(collection(db, 'students')), studentData);
            }

            const newlyPromotedSourceIds = new Set(studentsToPromote.map(p => p.id));
            const distinctPromotedCount = alreadyPromoted.filter(ap => !newlyPromotedSourceIds.has(ap.id)).length + studentsToPromote.length;
            const totalPromotedNowCount = distinctPromotedCount;

            newAdmissions.sort((a,b) => a.roll - b.roll).forEach((nas, idx) => {
                const newRoll = totalPromotedNowCount + idx + 1;
                const yearSuffix = String(targetYear).slice(-2);
                const classCode = String(targetClass).padStart(2, '0');
                const rollSerial = String(newRoll).padStart(4, '0');
                const newId = `${yearSuffix}${classCode}${rollSerial}`;
                batch.update(doc(db, 'students', nas.id), { roll: newRoll, generatedId: newId, updatedAt: serverTimestamp() });
            });

            await batch.commit();
            toast({ title: 'প্রমোশন সফল', description: `${studentsToPromote.length} জন শিক্ষার্থীকে উন্নীত করা হয়েছে।` });
            setIsPreviewOpen(false);
            handleLoadSource();
        } catch (e) { 
            console.error(e);
            toast({ variant: 'destructive', title: 'প্রমোশন করা যায়নি' });
        }
        setIsPromoting(false);
    };

    const handleLoadHistory = async () => {
        if (!db || !sourceClass) return;
        setHistoryHistoryLoading(true);
        setIsHistoryOpen(true);
        try {
            const tYear = (parseInt(selectedYear) + 1).toString();
            const tClass = (parseInt(sourceClass) + 1).toString();

            const [sourceSnap, targetSnap] = await Promise.all([
                getDocs(query(collection(db, 'students'), where('academicYear', '==', selectedYear), where('className', '==', sourceClass))),
                getDocs(query(collection(db, 'students'), where('academicYear', '==', tYear), where('className', '==', tClass)))
            ]);

            const sourceList = sourceSnap.docs.map(studentFromDoc);
            const targetList = targetSnap.docs.map(studentFromDoc);

            const promoted: any[] = [];
            const unpromoted: any[] = [];
            const normalizeStr = (s: any) => String(s || '').trim().toLowerCase();

            sourceList.forEach(s => {
                const match = targetList.find(t => 
                    normalizeStr(t.studentNameBn) === normalizeStr(s.studentNameBn) && 
                    normalizeStr(t.fatherNameBn) === normalizeStr(s.fatherNameBn) && 
                    normalizeStr(t.motherNameBn) === normalizeStr(s.motherNameBn)
                );
                if (match) promoted.push({ ...s, targetRoll: match.roll, targetId: match.generatedId });
                else unpromoted.push(s);
            });

            setPromotedHistory(promoted.sort((a,b) => a.targetRoll - b.targetRoll));
            setUnpromotedHistory(unpromoted.sort((a,b) => a.roll - b.roll));
        } catch (e) { console.error(e); }
        setHistoryHistoryLoading(false);
    };

    const toggleSelection = (id: string) => {
        const n = new Set(selectedIds);
        if (n.has(id)) n.delete(id); else n.add(id);
        setSelectedStudentIds(n);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end p-6 border-2 border-primary/10 rounded-2xl bg-white shadow-sm">
                <div className="space-y-2">
                    <Label className="font-bold text-xs">সোর্স শ্রেণি (বর্তমান)</Label>
                    <Select value={sourceClass} onValueChange={v => { setSourceClass(v); const next = (parseInt(v)+1); setTargetClass(String(next)); setTargetYear((parseInt(selectedYear) + 1).toString()); }}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{['6', '7', '8', '9'].map(v => <SelectItem key={v} value={v}>{classNamesMap[v]} শ্রেণি</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2"><Label className="font-bold text-xs">টার্গেট বছর</Label><Input value={toBengaliNumber(targetYear)} disabled className="bg-slate-50 font-black" /></div>
                <div className="space-y-2"><Label className="font-bold text-xs">টার্গেট শ্রেণি</Label><Input value={classNamesMap[targetClass] + ' শ্রেণি'} disabled className="bg-slate-50 font-black" /></div>
                <Button onClick={handleLoadSource} disabled={isLoading} className="h-10 font-black"><Search className="h-4 w-4 mr-2" /> তালিকা লোড</Button>
                <Button onClick={handleLoadHistory} variant="outline" className="h-10 font-black border-primary text-primary"><History className="h-4 w-4 mr-2" /> হিস্টোরি ও সংশোধন</Button>
            </div>

            {passedStudents.length > 0 && (
                <Card className="border-2 shadow-xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-emerald-50 border-b-2 border-emerald-100 flex flex-row justify-between items-center p-6">
                        <div><CardTitle className="text-xl font-black text-emerald-800">পাস করা শিক্ষার্থীদের তালিকা</CardTitle><CardDescription className="font-bold">মেধাক্রম অনুযায়ী অটোমেটিক রোল ১ থেকে এসাইন হবে</CardDescription></div>
                        <Button onClick={() => handleShowPreview('pass')} className="bg-emerald-600 hover:bg-emerald-700 font-black h-12 px-10 shadow-xl"><CheckCircle2 className="mr-2 h-5 v-5" /> সকল পাসকৃতদের প্রমোশন দিন</Button>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[400px] overflow-auto">
                        <Table>
                            <TableHeader className="bg-muted/30 sticky top-0 z-10"><TableRow><TableHead className="text-center font-black">মেধাস্থান</TableHead><TableHead className="text-center font-black">বর্তমান রোল</TableHead><TableHead className="font-black">নাম</TableHead><TableHead className="text-center font-black">মোট নম্বর</TableHead><TableHead className="text-right pr-10 font-black">GPA</TableHead></TableRow></TableHeader>
                            <TableBody>{passedStudents.map(res => (<TableRow key={res.student.id} className="h-12 hover:bg-emerald-50/30 transition-colors"><TableCell className="text-center font-black text-emerald-700">{toBengaliNumber(res.meritPosition || '-')}</TableCell><TableCell className="text-center font-bold">{toBengaliNumber(res.student.roll)}</TableCell><TableCell className="font-bold">{res.student.studentNameBn}</TableCell><TableCell className="text-center font-black text-primary">{toBengaliNumber(res.totalMarks)}</TableCell><TableCell className="text-right pr-10 font-black">{toBengaliNumber(res.gpa.toFixed(2))}</TableCell></TableRow>))}</TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {failedStudents.length > 0 && (
                <Card className="border-2 shadow-xl rounded-3xl overflow-hidden">
                    <CardHeader className="bg-rose-50 border-b-2 border-rose-100 flex flex-row justify-between items-center p-6">
                        <div><CardTitle className="text-xl font-black text-rose-800">অকৃতকার্য শিক্ষার্থীদের তালিকা (বিশেষ পাশ)</CardTitle><CardDescription className="font-bold text-rose-600">কম ফেল এবং বেশি নম্বর অনুযায়ী এরা পাস করাদের পরে সিরিয়াল পাবে</CardDescription></div>
                        <Button onClick={() => handleShowPreview('special')} disabled={selectedIds.size === 0} className="bg-rose-600 hover:bg-rose-700 font-black h-12 px-8 shadow-xl"><Plus className="mr-2 h-5 v-5" /> নির্বাচিতদের প্রমোশন দিন</Button>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[400px] overflow-auto">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-12 text-center"><Checkbox onCheckedChange={c => setSelectedStudentIds(c ? new Set(failedStudents.map(f => f.student.id)) : new Set())} /></TableHead>
                                    <TableHead className="w-20 text-center font-black">বর্তমান রোল</TableHead>
                                    <TableHead className="font-black">নাম</TableHead>
                                    <TableHead className="text-center font-black">ফেল করা বিষয়</TableHead>
                                    <TableHead className="text-right pr-10 font-black">মোট নম্বর</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failedStudents.map(res => (
                                    <TableRow key={res.student.id} className="h-14 hover:bg-rose-50/50 cursor-pointer" onClick={() => toggleSelection(res.student.id)}>
                                        <TableCell className="text-center" onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.has(res.student.id)} onCheckedChange={() => toggleSelection(res.student.id)} /></TableCell>
                                        <TableCell className="text-center font-black">{toBengaliNumber(res.student.roll)}</TableCell>
                                        <TableCell className="font-bold text-slate-800">{res.student.studentNameBn}</TableCell>
                                        <TableCell className="text-center"><Badge variant="outline" className="text-rose-600 border-rose-200">{toBengaliNumber(res.failedSubjectsCount)} টি বিষয়</Badge></TableCell>
                                        <TableCell className="text-right pr-10 font-black">{toBengaliNumber(res.totalMarks)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col font-kalpurush p-0 border-none shadow-2xl rounded-2xl overflow-hidden">
                    <DialogHeader className="p-6 bg-primary text-white shrink-0">
                        <DialogTitle className="text-2xl font-black flex items-center gap-2"><Sparkles className="h-6 w-6" /> প্রমোশন কনফার্মেশন ও প্রিভিউ</DialogTitle>
                        <DialogDescription className="text-white/80 font-bold">{classNamesMap[sourceClass]} থেকে {classNamesMap[targetClass]} শ্রেণিতে উন্নীতকরণের তালিকা</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50"><Card className="border-2 border-black/5 bg-white shadow-inner rounded-xl"><div className="grid grid-cols-4 p-3 text-[10px] font-black uppercase text-muted-foreground tracking-widest text-center"><span>শিক্ষার্থীর নাম (আইডি)</span><span>বর্তমান রোল</span><span>স্ট্যাটাস</span><span className="text-primary">নতুন রোল</span></div><div className="divide-y-2 divide-slate-50">{projectedPromotions.map((item) => (<div key={item.id} className="grid grid-cols-4 p-4 items-center text-center hover:bg-primary/5 transition-colors"><div className="flex flex-col items-center"><span className="font-black text-slate-800 text-sm truncate px-1">{item.name}</span><span className="text-[10px] font-bold text-muted-foreground">ID: {toBengaliNumber(item.generatedId || '')}</span></div><span className="font-bold text-slate-500">{toBengaliNumber(item.currentRoll)}</span><span><Badge className={item.isPass ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"}>{item.isPass ? 'কৃতকার্য' : 'বিশেষ পাশ'}</Badge></span><div className="flex justify-center"><Input type="number" value={item.projectedRoll} onChange={(e) => updateProjectedRoll(item.id, e.target.value)} className="w-20 h-9 text-center font-black border-2 border-primary/20 bg-white" /></div></div>))}</div></Card></div>
                    <DialogFooter className="p-6 bg-white border-t flex gap-3"><Button variant="outline" onClick={() => setIsPreviewOpen(false)} className="flex-1 font-bold h-12">বাতিল</Button><Button onClick={handleConfirmPromotion} disabled={isPromoting} className="flex-1 min-w-[200px] h-12 text-lg font-black bg-emerald-600 hover:bg-emerald-700 shadow-xl">{isPromoting ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />}প্রমোশন নিশ্চিত করুন</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col font-kalpurush p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="p-6 bg-slate-800 text-white shrink-0">
                        <DialogTitle className="text-2xl font-black flex items-center gap-2"><History className="h-7 w-7" /> প্রমোশন হিস্টোরি ও তালিকা</DialogTitle>
                        <DialogDescription className="text-slate-300 font-bold">{classNamesMap[sourceClass]} শ্রেণি থেকে পরবর্তী শ্রেণিতে প্রমোশন স্ট্যাটাস</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden bg-slate-100 p-0 flex flex-col">
                        <Tabs defaultValue="promoted" className="w-full h-full flex flex-col">
                            <TabsList className="grid w-full grid-cols-2 h-14 bg-white/50 p-1 border-b rounded-none">
                                <TabsTrigger value="promoted" className="font-black text-base data-[state=active]:bg-white data-[state=active]:text-emerald-700">প্রমোশনপ্রাপ্ত ({toBengaliNumber(promotedHistory.length)})</TabsTrigger>
                                <TabsTrigger value="unpromoted" className="font-black text-base data-[state=active]:bg-white data-[state=active]:text-rose-700">প্রমোশনহীন ({toBengaliNumber(unpromotedHistory.length)})</TabsTrigger>
                            </TabsList>
                            <div className="flex-1 overflow-hidden">
                                <TabsContent value="promoted" className="h-full m-0 outline-none">
                                    <ScrollArea className="h-full p-4">
                                        {historyLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div> : promotedHistory.length === 0 ? <p className="text-center py-20 italic">কেউ প্রমোশন পায়নি</p> : (
                                            <Card className="border-none shadow-sm"><Table><TableHeader className="bg-muted/50">
                                                <TableRow><TableHead className="font-black">আইডি</TableHead><TableHead className="font-black">নাম</TableHead><TableHead className="text-center font-black">বর্তমান রোল</TableHead><TableHead className="text-right pr-6 font-black">টার্গেট আইডি</TableHead></TableRow>
                                            </TableHeader><TableBody>{promotedHistory.map(s => (
                                                <TableRow key={s.id} className="h-14"><TableCell className="font-black text-xs">{toBengaliNumber(s.generatedId)}</TableCell><TableCell className="font-bold text-slate-800">{s.studentNameBn}</TableCell><TableCell className="text-center font-black text-emerald-700 text-lg">{toBengaliNumber(s.targetRoll)}</TableCell><TableCell className="text-right pr-6 font-bold text-xs text-primary">{toBengaliNumber(s.targetId)}</TableCell></TableRow>
                                            ))}</TableBody></Table></Card>
                                        )}
                                    </ScrollArea>
                                </TabsContent>
                                <TabsContent value="unpromoted" className="h-full m-0 outline-none">
                                    <ScrollArea className="h-full p-4">
                                        {historyLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div> : unpromotedHistory.length === 0 ? <p className="text-center py-20 text-emerald-600 font-black">সবাই প্রমোশন পেয়েছে!</p> : (
                                            <Card className="border-none shadow-sm"><Table><TableHeader className="bg-muted/50">
                                                <TableRow><TableHead className="font-black">আইডি</TableHead><TableHead className="font-black">নাম</TableHead><TableHead className="text-center font-black">রোল</TableHead><TableHead className="text-right pr-6 font-black">অবস্থা</TableHead></TableRow>
                                            </TableHeader><TableBody>{unpromotedHistory.map(s => (
                                                <TableRow key={s.id} className="h-14"><TableCell className="font-black text-xs">{toBengaliNumber(s.generatedId)}</TableCell><TableCell className="font-bold text-slate-800">{s.studentNameBn}</TableCell><TableCell className="text-center font-bold">{toBengaliNumber(s.roll)}</TableCell><TableCell className="text-right pr-6"><Badge variant="destructive" className="bg-rose-100 text-rose-700 border-rose-200">বকেয়া</Badge></TableCell></TableRow>
                                            ))}</TableBody></Table></Card>
                                        )}
                                    </ScrollArea>
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                    <DialogFooter className="p-4 bg-white border-t shrink-0"><Button variant="outline" className="font-black w-full" onClick={() => setIsHistoryOpen(false)}>বন্ধ করুন</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const ResultSearchTab = ({ allStudents }: { allStudents: Student[] }) => {
    const db = useFirestore();
    const { selectedYear, availableYears } = useAcademicYear();
    const { toast } = useToast();
    const [searchYear, setSearchYear] = useState(selectedYear);
    const [searchClass, setSearchClass] = useState('');
    const [searchExam, setSearchExam] = useState('');
    const [searchRoll, setSearchRoll] = useState('');
    const [searchStudentId, setSearchStudentId] = useState('');
    const [exams, setExams] = useState<Exam[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<StudentProcessedResult | null>(null);

    useEffect(() => { if (db && searchYear) getExams(db, searchYear).then(setExams); }, [db, searchYear]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const bnToEn = (str: string) => str.toString().replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)].toString());
        if (!db || !searchYear || !searchClass || !searchExam || !searchRoll || !searchStudentId) {
            toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ', description: 'সবগুলো ঘর পূরণ করুন।' });
            return;
        }
        setIsSearching(true);
        try {
            const cleanRoll = parseInt(bnToEn(searchRoll).trim(), 10);
            const cleanStudentId = bnToEn(searchStudentId).trim().toUpperCase().replace(/\s/g, '');
            
            const studentQuery = query(
                collection(db, 'students'), 
                where('academicYear', '==', searchYear), 
                where('className', '==', searchClass), 
                where('roll', '==', cleanRoll), 
                limit(1)
            );
            const studentSnap = await getDocs(studentQuery);
            
            if (studentSnap.empty) {
                toast({ variant: 'destructive', title: 'শিক্ষার্থী পাওয়া যায়নি' });
                setIsSearching(false); return;
            }
            
            const foundStudent = studentFromDoc(studentSnap.docs[0]);
            const dbStudentId = bnToEn(foundStudent.generatedId || '').trim().toUpperCase().replace(/\s/g, '');
            
            if (dbStudentId !== cleanStudentId && foundStudent.generatedId !== cleanStudentId) {
                 toast({ variant: 'destructive', title: 'আইডি মেলেনি', description: 'অনুগ্রহ করে সঠিক আইডি নম্বরটি পুনরায় লিখুন।' });
                 setIsSearching(false); return;
            }
            
            const allResults = await getAllResults(db, searchYear, searchExam);
            const classRes = allResults.filter(r => r.className === searchClass);
            if (classRes.length === 0) {
                toast({ variant: 'destructive', title: 'ফলাফল প্রকাশিত হয়নি' });
                setIsSearching(false); return;
            }
            const classStudentsSnap = await getDocs(query(collection(db, 'students'), where('academicYear', '==', searchYear), where('className', '==', searchClass)));
            const classStudents = classStudentsSnap.docs.map(studentFromDoc);
            const subs = getSubjects(searchClass, foundStudent.group).filter(s => s.isExamSubject !== false);
            const processedResultsList = processStudentResults(classStudents, classRes, subs);
            const studentProcessed = processedResultsList.find(r => r.student.id === foundStudent.id);
            if (studentProcessed) setSearchResult(studentProcessed);
            else toast({ variant: 'destructive', title: 'ফলাফল পাওয়া যায়নি' });
        } catch (error: any) {
            console.error("Result Search Error:", error);
            toast({ variant: 'destructive', title: 'সার্ভার ত্রুটি' });
        } finally { setIsSearching(false); }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {!searchResult ? (
                <Card className="max-w-xl mx-auto border-none shadow-xl rounded-[32px] overflow-hidden">
                    <CardHeader className="bg-primary text-white p-8">
                        <CardTitle className="text-2xl font-black flex items-center gap-3"><Search className="h-8 w-8" /> ফলাফল অনুসন্ধান</CardTitle>
                        <CardDescription className="text-white/80 font-bold">সঠিক তথ্য দিয়ে ড্রাফট রেজাল্ট সামারি দেখুন</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 bg-white space-y-6">
                        <form onSubmit={handleSearch} className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-black text-xs uppercase text-muted-foreground">শিক্ষাবর্ষ</Label>
                                    <Select value={searchYear} onValueChange={setSearchYear}>
                                        <SelectTrigger className="h-12 bg-slate-50 border-2 font-black text-lg"><SelectValue /></SelectTrigger>
                                        <SelectContent>{availableYears.map(y => <SelectItem key={y} value={y} className="font-bold">{toBengaliNumber(y)}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-black text-xs uppercase text-muted-foreground">শ্রেণি</Label>
                                    <Select value={searchClass} onValueChange={setSearchClass}>
                                        <SelectTrigger className="h-12 bg-slate-50 border-2 font-black text-lg"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                                        <SelectContent>{Object.entries(classNamesMap).map(([id, label]) => <SelectItem key={id} value={id} className="font-bold">{label} শ্রেণি</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-black text-xs uppercase text-muted-foreground">পরীক্ষার নাম</Label>
                                <Select value={searchExam} onValueChange={setSearchExam}>
                                    <SelectTrigger className="h-12 bg-slate-50 border-2 font-black text-lg"><SelectValue placeholder="পরীক্ষা নির্বাচন করুন" /></SelectTrigger>
                                    <SelectContent>
                                        {exams.filter(e => Boolean(e?.name)).map((e, idx) => <SelectItem key={`exam-srch-${e.id || idx}-${e.name}`} value={e.name} className="font-bold">{e.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-black text-xs uppercase text-muted-foreground">রোল নম্বর</Label>
                                    <Input value={searchRoll} onChange={e => setSearchRoll(e.target.value)} placeholder="উদা: ১" className="font-black text-xl h-12 border-2" required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-black text-xs uppercase text-muted-foreground">শিক্ষার্থী আইডি (ID)</Label>
                                    <Input value={searchStudentId} onChange={e => setSearchStudentId(e.target.value)} placeholder="ID লিখুন" className="font-black text-xl h-12 uppercase border-2" required />
                                </div>
                            </div>
                            <Button type="submit" className="w-full h-14 text-xl font-black shadow-xl" disabled={isSearching}>
                                {isSearching ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <Search className="mr-2 h-6 w-6" />}
                                ফলাফল দেখুন
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            ) : (
                <div className="max-w-4xl mx-auto space-y-6 animate-in zoom-in-95 duration-500">
                    <Card className="border-[4px] border-black rounded-[32px] overflow-hidden shadow-2xl bg-white">
                        <CardHeader className="p-8 bg-primary text-white flex flex-row items-center gap-8 border-b-0">
                            <Avatar className="h-28 w-28 border-4 border-white shadow-xl overflow-hidden shrink-0 rounded-full">
                                <AvatarImage src={sanitizePhotoUrl(searchResult.student.photoUrl, searchResult.student.gender) || getStudentPlaceholderImage(searchResult.student.gender)} />
                                <AvatarFallback className="bg-white/20 text-3xl font-black">S</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                                <CardTitle className="text-3xl font-black mb-1">{searchResult.student.studentNameBn}</CardTitle>
                                <CardDescription className="text-white/80 font-bold text-lg mt-1">
                                    রোল: {toBengaliNumber(searchResult.student.roll)} | {classNamesMap[searchResult.student.className]} শ্রেণি | {searchExam}
                                </CardDescription>
                            </div>
                            <Button variant="outline" className="bg-white/10 text-white border-white/20 hover:bg-white/20 font-black h-12 px-6" onClick={() => setSearchResult(null)}><RotateCcw className="mr-2 h-5 w-5" /> পুনরায় খুঁজুন</Button>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8 bg-slate-50/50">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                                <Card className="p-6 text-center border-[3px] border-black shadow-[4px_4px_0px_rgba(0,0,0,0.1)] rounded-2xl bg-white group hover:scale-105 transition-all"><p className="text-[10px] font-black text-muted-foreground uppercase mb-2">মোট নম্বর</p><p className="text-4xl font-black text-primary group-hover:scale-110 transition-transform">{toBengaliNumber(searchResult.totalMarks)}</p></Card>
                                <Card className="p-6 text-center border-[3px] border-black shadow-[4px_4px_0px_rgba(0,0,0,0.1)] rounded-2xl bg-white group hover:scale-105 transition-all"><p className="text-[10px] font-black text-muted-foreground uppercase mb-2">GPA</p><p className="text-4xl font-black text-primary group-hover:scale-110 transition-transform">{toBengaliNumber(searchResult.gpa.toFixed(2))}</p></Card>
                                <Card className="p-6 text-center border-[3px] border-black shadow-[4px_4px_0px_rgba(0,0,0,0.1)] rounded-2xl bg-white group hover:scale-105 transition-all"><p className="text-[10px] font-black text-muted-foreground uppercase mb-2">গ্রেড</p><p className={cn("text-4xl font-black group-hover:scale-110 transition-transform", searchResult.isPass ? "text-emerald-600" : "text-rose-600")}>{searchResult.finalGrade}</p></Card>
                                <Card className="p-6 text-center border-[3px] border-black shadow-[4px_4px_0px_rgba(0,0,0,0.1)] rounded-2xl bg-white group hover:scale-105 transition-all"><p className="text-[10px] font-black text-muted-foreground uppercase mb-2">মেধাস্থান</p><p className="text-4xl font-black text-amber-600 group-hover:scale-110 transition-transform">{searchResult.isPass ? toBengaliNumber(searchResult.meritPosition || '-') : '-'}</p></Card>
                            </div>
                            <div className="border-[3px] border-black rounded-[32px] overflow-hidden bg-white shadow-xl">
                                <Table>
                                    <TableHeader className="bg-primary/5 h-14">
                                        <TableRow className="border-b-[3px] border-black">
                                            <TableHead className="font-black text-slate-800 text-sm pl-10">বিষয়ের নাম</TableHead>
                                            <TableHead className="text-center font-black text-slate-800 text-sm">প্রাপ্ত নম্বর</TableHead>
                                            <TableHead className="text-center font-black text-slate-800 text-sm">গ্রেড</TableHead>
                                            <TableHead className="text-right pr-10 font-black text-slate-800 text-sm">পয়েন্ট</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {Array.from(searchResult.subjectResults.entries()).map(([name, res]) => (
                                            <TableRow key={name} className="h-12 border-b-2 border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                                <TableCell className="font-bold text-slate-700 pl-10">{name}</TableCell>
                                                <TableCell className="text-center font-black text-blue-900 text-xl">{toBengaliNumber(res.marks)}</TableCell>
                                                <TableCell className={cn("text-center font-black text-base", res.isPass ? "text-emerald-700" : "text-rose-600")}>{res.grade}</TableCell>
                                                <TableCell className="text-right pr-10 font-bold text-base">{toBengaliNumber(res.point.toFixed(2))}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                    <div className="flex justify-center no-print">
                        <Button className="h-16 px-16 text-2xl font-black shadow-2xl bg-emerald-600 hover:bg-emerald-700 rounded-full" onClick={() => window.print()}><Printer className="mr-3 h-8 w-8" /> মার্কশিট প্রিন্ট করুন</Button>
                    </div>
                </div>
            )}
        </div>
    );
};

const SpecialExamTab = ({ allStudents, onPrintRequested }: { allStudents: Student[], onPrintRequested: (data: any) => void }) => {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    
    const [selectedMonth, setSelectedMonth] = useState<string>(BENGALI_MONTHS[new Date().getMonth()]);
    const [selectedExam, setSelectedExam] = useState<string>('বিশেষ পরীক্ষা-১');
    const [selectedClass, setSelectedClass] = useState<string>('6');
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    
    const [specialMode, setSpecialMode] = useState<'input' | 'sheet' | 'fullmarks'>('input');
    const [specialMarks, setSpecialMarks] = useState<Map<string, number>>(new Map());
    const [specialFullMarks, setSpecialFullMarks] = useState<string>('20');
    
    const [allSpecialResults, setAllSpecialResults] = useState<SpecialClassResult[]>([]);

    const classes = ['6', '7', '8', '9', '10'];
    const specialExams = ['বিশেষ পরীক্ষা-১', 'বিশেষ পরীক্ষা-২', 'বিশেষ পরীক্ষা-৩', 'বিশেষ পরীক্ষা-৪', 'বিশেষ পরীক্ষা-৫'];

    const availableSubjects = useMemo(() => {
        if (!selectedClass) return [];
        const baseSubs = getSubjects(selectedClass).filter(s => s.isExamSubject !== false);
        
        if (specialMode === 'sheet' && parseInt(selectedClass) >= 9) {
            const resultList: any[] = [];
            const seen = new Set<string>();
            const coreNames = ['বাংলা প্রথম', 'বাংলা দ্বিতীয়', 'ইংরেজি প্রথম', 'ইংরেজি দ্বিতীয়', 'গণিত', 'ধর্ম ও নৈতিক শিক্ষা', 'তথ্য ও যোগাযোগ প্রযুক্তি'];

            baseSubs.forEach(s => {
                if (coreNames.some(cn => normalize(cn) === normalize(s.name))) {
                    if (!seen.has(normalize(s.name))) { resultList.push(s); seen.add(normalize(s.name)); }
                }
            });

            const combinedPairs = [
                { name: 'পদার্থ / ইতিহাস', isCombined: true, subList: ['পদার্থ', 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা'] },
                { name: 'রসায়ন / ভূগোল', isCombined: true, subList: ['রসায়ন', 'ভূগোল ও পরিবেশ'] },
                { name: 'জীব বিজ্ঞান / পৌরনীতি', isCombined: true, subList: ['জীব বিজ্ঞান', 'পৌরনীতি ও নাগরিকতা'] },
                { name: 'উচ্চতর গণিত / কৃষি / ফিন্যান্স', isCombined: true, subList: ['উচ্চতর গণিত', 'কৃষি শিক্ষা', 'ফিন্যান্স ও ব্যাংকিং', 'হিসাব বিজ্ঞান', 'ব্যবসায় উদ্যোগ'] },
                { name: 'বিজ্ঞান / বা ও বি', isCombined: true, subList: ['সাধারণ বিজ্ঞান', 'বাংলাদেশ ও বিশ্ব পরিচয়'] }
            ];

            combinedPairs.forEach(p => resultList.push(p));
            return resultList;
        }

        return baseSubs;
    }, [selectedClass, specialMode]);

    const handleLoadForInput = async () => {
        if (!db || !selectedMonth || !selectedClass || !selectedSubject || !selectedExam) return;
        setIsLoading(true);
        try {
            const results = await getSpecialResultsForClass(db, selectedYear, selectedClass, selectedMonth).catch(() => []);
            const matching = results.find(r => normalize(r.subject) === normalize(selectedSubject) && r.examType === selectedExam);
            
            const initialMap = new Map();
            if (matching) {
                setSpecialFullMarks(matching.fullMarks.toString());
                matching.results.forEach(r => initialMap.set(r.studentId, r.marks));
            } else setSpecialFullMarks('20');
            setSpecialMarks(initialMap);
        } catch (e) { console.error(e); }
        setIsLoading(false);
    };

    const handleSaveSpecialMarks = async () => {
        if (!db || !selectedClass || !selectedSubject || !selectedExam || !selectedMonth) return;
        setIsLoading(true);
        try {
            const resultsData = Array.from(specialMarks.entries()).map(([id, m]) => ({ studentId: id, marks: m }));
            await saveSpecialResults(db, {
                academicYear: selectedYear,
                className: selectedClass,
                subject: selectedSubject,
                examType: selectedExam,
                month: selectedMonth,
                fullMarks: parseInt(specialFullMarks, 10) || 20,
                results: resultsData
            });
            toast({ title: 'বিশেষ পরীক্ষার নম্বর সংরক্ষিত হয়েছে' });
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    };

    const handleLoadFullSheet = async () => {
        if (!db || !selectedMonth || !selectedClass) return;
        setIsLoading(true);
        try {
            const results = await getSpecialResultsForClass(db, selectedYear, selectedClass, selectedMonth).catch(() => []);
            setAllSpecialResults(results);
        } catch (e) { console.error(e); }
        setIsLoading(false);
    };

    const filteredStudents = useMemo(() => {
        return allStudents
            .filter(s => s.academicYear === selectedYear && s.className === selectedClass)
            .sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
    }, [allStudents, selectedYear, selectedClass]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const table = e.currentTarget.closest('table');
            if (!table) return;
            const inputs = Array.from(table.querySelectorAll('tbody input[type="number"]')) as HTMLInputElement[];
            const index = inputs.indexOf(e.currentTarget);
            if (index >= 0 && index < inputs.length - 1) {
                const nextInput = inputs[index + 1];
                nextInput.focus();
                nextInput.select();
            }
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="flex flex-wrap gap-2 no-print">
                <Button variant={specialMode === 'input' ? 'default' : 'outline'} onClick={() => setSpecialMode('input')} className="font-black h-10 px-6 rounded-xl shadow-sm"><FilePen className="h-4 w-4 mr-2" /> নম্বর ইনপুট</Button>
                <Button variant={specialMode === 'sheet' ? 'default' : 'outline'} onClick={() => setSpecialMode('sheet')} className="font-black h-10 px-6 rounded-xl shadow-sm"><LayoutGrid className="h-4 w-4 mr-2" /> ফলাফল শিট</Button>
                <Button variant={specialMode === 'fullmarks' ? 'default' : 'outline'} onClick={() => setSpecialMode('fullmarks')} className="font-black h-10 px-6 rounded-xl shadow-sm"><Settings className="h-4 w-4 mr-2" /> পূর্ণমান সেটআপ</Button>
            </div>

            {specialMode === 'input' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end p-6 border-2 border-black/5 bg-white shadow-sm rounded-2xl">
                        <div className="space-y-2"><Label className="font-bold text-xs text-primary">মাস</Label><Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue placeholder="মাস" /></SelectTrigger><SelectContent>{BENGALI_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label className="font-bold text-xs text-primary">পরীক্ষা</Label><Select value={selectedExam} onValueChange={setSelectedExam}><SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue placeholder="পরীক্ষা" /></SelectTrigger><SelectContent>{specialExams.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label className="font-bold text-xs text-primary">শ্রেণি</Label><Select value={selectedClass} onValueChange={setSelectedClass}><SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent>{classes.map(c => <SelectItem key={c} value={c}>{classNamesMap[c]} শ্রেণি</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label className="font-bold text-xs text-primary">বিষয়</Label><Select value={selectedSubject} onValueChange={setSelectedSubject} disabled={!selectedClass}><SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue placeholder="বিষয়" /></SelectTrigger><SelectContent>{getSubjects(selectedClass).filter(s => s.isExamSubject !== false).map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
                        <Button onClick={handleLoadForInput} disabled={isLoading || !selectedMonth || !selectedExam || !selectedSubject} className="font-black h-11 shadow-md">লোড করুন</Button>
                    </div>

                    {filteredStudents.length > 0 && selectedSubject && (
                        <Card className="border-2 border-black overflow-hidden shadow-xl rounded-2xl">
                            <CardHeader className="bg-primary/5 p-4 border-b-2 border-black flex flex-row justify-between items-center">
                                <div><CardTitle className="text-base font-black text-primary">{selectedSubject} - {selectedExam}</CardTitle><CardDescription className="font-bold">পূর্ণমান: {toBengaliNumber(specialFullMarks)} | মাস: {selectedMonth}</CardDescription></div>
                                <div className="flex items-center gap-3"><Label className="text-xs font-black">পূর্ণমান এডিট:</Label><Input type="number" value={specialFullMarks} onChange={e => setSpecialFullMarks(e.target.value)} className="w-16 h-8 text-center font-black border-2 border-primary/20" /></div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="max-h-[500px] overflow-auto">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-white z-10 border-b-2 border-black">
                                            <TableRow><TableHead className="w-20 text-center font-black border-r-2 border-black text-black">রোল</TableHead><TableHead className="font-black border-r-2 border-black text-black">শিক্ষার্থীর নাম</TableHead><TableHead className="w-40 text-center font-black text-black">প্রাপ্ত নম্বর</TableHead></TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredStudents.map(s => (
                                                <TableRow key={s.id} className="h-12 hover:bg-slate-50 transition-colors border-b-2 border-black">
                                                    <TableCell className="text-center font-black border-r-2 border-black text-lg">{toBengaliNumber(s.roll)}</TableCell>
                                                    <TableCell className="font-bold border-r-2 border-black text-slate-800">{s.studentNameBn}</TableCell>
                                                    <TableCell className="p-1 text-center"><Input type="number" value={specialMarks.get(s.id) ?? ''} onChange={e => setSpecialMarks(prev => new Map(prev).set(s.id, parseInt(e.target.value, 10)))} onKeyDown={handleKeyDown} className="w-28 mx-auto h-9 text-center font-black border-2 border-black text-lg focus:bg-amber-50 shadow-sm" /></TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="p-6 bg-slate-50 border-t-2 border-black flex justify-end"><Button onClick={handleSaveSpecialMarks} disabled={isLoading} size="lg" className="px-16 h-14 text-xl font-black shadow-2xl"><Save className="mr-2 h-6 w-6" /> প্রাপ্ত নম্বর সেভ করুন</Button></div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {specialMode === 'sheet' && (
                <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border rounded-2xl bg-white shadow-sm no-print items-end">
                        <div className="space-y-2"><Label className="font-bold">মাস নির্বাচন</Label><Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue placeholder="মাস" /></SelectTrigger><SelectContent>{BENGALI_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><Label className="font-bold">শ্রেণি</Label><Select value={selectedClass} onValueChange={setSelectedClass}><SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent>{classes.map(c => <SelectItem key={c} value={c}>{classNamesMap[c]} শ্রেণি</SelectItem>)}</SelectContent></Select></div>
                        <div className="flex gap-2">
                            <Button onClick={handleLoadFullSheet} disabled={isLoading || !selectedMonth || !selectedClass} className="flex-1 font-black h-11"><Search className="mr-2 h-4 w-4" /> রিপোর্ট লোড করুন</Button>
                            <Button onClick={() => onPrintRequested({ allSpecialResults, students: filteredStudents, availableSubjects, month: selectedMonth, year: selectedYear, className: selectedClass })} variant="outline" disabled={allSpecialResults.length === 0} className="h-11 border-2 border-primary text-primary font-black shadow-sm"><Printer className="h-4 w-4" /></Button>
                        </div>
                    </div>

                    {allSpecialResults.length > 0 && (
                        <div className="special-sheet-container w-full bg-white text-black font-kalpurush overflow-hidden border-[4px] border-black rounded-[32px] shadow-2xl">
                            <div className="table-container !max-h-[550px] !overflow-auto !border-0 !rounded-none">
                                <table className="w-full border-separate border-spacing-0 border-black text-[11px]">
                                    <thead>
                                        <tr className="bg-slate-100 h-[40px]">
                                            <th rowSpan={2} className="border-r-2 border-b-2 border-black font-black p-1 w-[45px] text-center sticky left-0 top-0 z-[60] bg-slate-100 h-[80px] box-border">রোল</th>
                                            <th rowSpan={2} className="border-r-2 border-b-2 border-black font-black p-1 text-left min-w-[180px] pl-3 sticky left-[10px] top-0 z-[60] bg-slate-100 h-[80px] box-border">শিক্ষার্থীর নাম</th>
                                            {availableSubjects.map((sub, i) => (
                                                <th key={sub.name} colSpan={3} className={cn("border-r-2 border-b-2 border-black font-black p-1 text-center h-[40px] box-border sticky top-0 z-40", i % 2 === 0 ? "bg-blue-100" : "bg-emerald-100")}>{sub.name}</th>
                                            ))}
                                            <th rowSpan={2} className="border-b-2 border-black font-black p-1 w-20 text-center bg-yellow-100 text-yellow-950 h-[80px] box-border sticky top-0 right-0 z-50">মোট নম্বর</th>
                                        </tr>
                                        <tr className="bg-slate-50 h-[40px]">
                                            {availableSubjects.map((sub, sIdx) => (
                                                <React.Fragment key={`${sub.name}-h`}>
                                                    <th className={cn("border-r-2 border-b-2 border-black font-black p-0.5 w-10 sticky top-[40px] z-40 h-[40px] box-border text-center", sIdx % 2 === 0 ? "bg-blue-50" : "bg-emerald-50")}>প-১</th>
                                                    <th className={cn("border-r-2 border-b-2 border-black font-black p-0.5 w-10 sticky top-[40px] z-40 h-[40px] box-border text-center", sIdx % 2 === 0 ? "bg-blue-50" : "bg-emerald-50")}>প-২</th>
                                                    <th className={cn("border-r-2 border-b-2 border-black font-black p-0.5 w-10 sticky top-[40px] z-40 h-[40px] box-border text-center", sIdx % 2 === 0 ? "bg-blue-50" : "bg-emerald-50")}>প-৩</th>
                                                </React.Fragment>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredStudents.map(student => {
                                            let studentTotal = 0;
                                            return (
                                                <tr key={student.id} className="h-10 hover:bg-slate-50 transition-colors">
                                                    <td className="border-r-2 border-b-2 border-black text-center font-black sticky left-0 z-30 bg-white w-[45px] h-10 box-border">{toBengaliNumber(student.roll)}</td>
                                                    <td className="border-r-2 border-b-2 border-black font-bold px-3 whitespace-nowrap sticky left-[10px] z-30 bg-white min-w-[180px] h-10 box-border">{student.studentNameBn}</td>
                                                    {availableSubjects.map((sub, sIdx) => (
                                                        <React.Fragment key={`${student.id}-${sub.name}`}>
                                                            {['বিশেষ পরীক্ষা-১', 'বিশেষ পরীক্ষা-২', 'বিশেষ পরীক্ষা-৩'].map((type) => {
                                                                const match = allSpecialResults.find(r => {
                                                                    const normalizedSearch = normalize(sub.name);
                                                                    const normalizedRecord = normalize(r.subject);
                                                                    if (sub.isCombined) return sub.subList.some((innerSub: string) => normalizedRecord.includes(normalize(innerSub))) && r.examType === type;
                                                                    return normalizedRecord === normalizedSearch && r.examType === type;
                                                                });
                                                                const marks = match?.results.find(res => res.studentId === student.id)?.marks;
                                                                if (marks !== undefined) studentTotal += marks;
                                                                return <td key={type} className={cn("border-r-2 border-b-2 border-black text-center font-black text-blue-900 h-10 w-10 min-w-10", sIdx % 2 === 0 ? "bg-blue-50/20" : "bg-emerald-50/20")}>{marks !== undefined ? toBengaliNumber(marks) : '-'}</td>;
                                                            })}
                                                        </React.Fragment>
                                                    ))}
                                                    <td className="text-center font-black bg-yellow-50 text-base border-b-2 border-black sticky right-0 z-20 w-20 min-w-20 h-10 box-border">{toBengaliNumber(studentTotal)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {specialMode === 'fullmarks' && (
                <div className="animate-in fade-in duration-500">
                    <Card className="max-w-md mx-auto border-2 shadow-lg rounded-3xl overflow-hidden">
                        <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-lg font-black flex items-center gap-2"><Settings className="h-5 w-5" /> বিশেষ পরীক্ষার পূর্ণমান নির্ধারণ</CardTitle></CardHeader>
                        <CardContent className="p-8 space-y-6">
                             <div className="space-y-4">
                                <p className="text-sm font-bold text-muted-foreground leading-relaxed text-center">বিশেষ পরীক্ষার ফলাফল ইনপুট দেওয়ার সময় সরাসরি ওই সেকশন থেকেই পূর্ণমান এডিট করতে পারবেন। ডিফল্ট পূর্ণমান ২০ হিসেবে সেট করা থাকে।</p>
                                <div className="p-6 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/20 text-center"><AlertCircle className="h-10 w-10 text-primary mx-auto mb-3 opacity-30" /><p className="text-xs font-black uppercase tracking-widest text-primary">শীঘ্রই আরও উন্নত সেটিংস যুক্ত হবে</p></div>
                             </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};

const BulkUploadTab = () => {
    return (
        <Card className="border-2 border-dashed border-primary/20 bg-primary/5 p-12 text-center rounded-[32px] animate-in zoom-in-95 duration-500">
            <FileUp className="h-20 w-20 text-primary mx-auto mb-6 opacity-30" />
            <h3 className="text-2xl font-black text-slate-800 mb-2">Excel থেকে ফলাফল আপলোড করুন</h3>
            <p className="text-base font-bold text-muted-foreground mb-8 max-w-xl mx-auto">ফলাফল শিট ট্যাব থেকে নমুনা ফাইল ডাউনলোড করে সকল বিষয়ের নম্বর একসাথে এন্ট্রি করে আপলোড করতে পারবেন।</p>
            <div className="flex justify-center gap-4">
                <Link href="/student-list"><Button variant="outline" className="font-bold border-primary text-primary h-12 px-8">শিক্ষার্থী তালিকা দেখুন</Button></Link>
                <Link href="#sheet"><Button className="font-black h-12 px-8 shadow-xl">ফলাফল শিট ট্যাবে যান</Button></Link>
            </div>
        </Card>
    );
};

export default function ResultsPage() {
    const [isClient, setIsClient] = useState(false); 
    const [allStudents, setAllStudents] = useState<Student[]>([]); 
    const [isLoading, setIsLoading] = useState(true);
    const db = useFirestore(); 
    const { selectedYear } = useAcademicYear(); 
    const { user, hasPermission } = useAuth();
    const { schoolInfo } = useSchoolInfo();
    
    const canViewRes = hasPermission('manage:results') || hasPermission('input:results');
    const canManageFullMarks = hasPermission('manage:full-marks') || hasPermission('manage:results');

    const [activeSection, setActiveSection] = useState('management');
    const [printingReport, setPrintingReport] = useState<any>(null);
    const [fullSheetPrintData, setFullSheetPrintData] = useState<any>(null);
    const [specialPrintData, setSpecialPrintData] = useState<any>(null);
    const [statisticsPrintData, setStatisticsPrintData] = useState<any>(null);

    useEffect(() => {
        setIsClient(true); 
        if (!db || !user) return;
        const unsubscribe = onSnapshot(query(collection(db, "students")), (snap) => { 
            setAllStudents(snap.docs.map(studentFromDoc)); 
            setIsLoading(false); 
        }, (err) => { 
            console.error("Firestore error:", err);
            setIsLoading(false); 
        });
        return () => unsubscribe();
    }, [db, user]);

    useEffect(() => {
        if (canViewRes) setActiveSection('management');
        else if (canManageFullMarks) setActiveSection('full-marks');
        else if (hasPermission('view:merit-list')) setActiveSection('merit');
        else if (hasPermission('promote:students')) setActiveSection('promotion');
        else if (hasPermission('manage:special-results')) setActiveSection('special-exam');
    }, [canViewRes, canManageFullMarks, hasPermission]);

    const handleSubjectPrint = (data: any) => {
        setPrintingReport(data);
        setTimeout(() => { window.print(); setPrintingReport(null); }, 1500);
    };

    const handleFullSheetPrint = (data: any) => {
        setFullSheetPrintData(data);
        setTimeout(() => { window.print(); setFullSheetPrintData(null); }, 1500);
    };

    const handleSpecialPrint = (data: any) => {
        setSpecialPrintData(data);
        setTimeout(() => { window.print(); setSpecialPrintData(null); }, 1500);
    };

    const handleStatisticsPrint = (data: any) => {
        setStatisticsPrintData(data);
        setTimeout(() => { window.print(); setStatisticsPrintData(null); }, 1500);
    };

    const sidebarItems = useMemo(() => {
        const items = [];
        if (canViewRes) {
            items.push({ id: 'management', label: 'নম্বর ইনপুট', icon: FilePen, color: 'text-indigo-600 bg-indigo-50' });
            items.push({ id: 'attendance', label: 'উপস্থিত শিক্ষার্থীর তালিকা', icon: UserCheck, color: 'text-emerald-600 bg-emerald-50' });
            items.push({ id: 'subject-report', label: 'বিষয় ভিত্তিক রিপোর্ট', icon: FileText, color: 'text-emerald-600 bg-emerald-50' });
            items.push({ id: 'sheet', label: 'ফলাফল শিট', icon: FileSpreadsheet, color: 'text-blue-600 bg-blue-50' });
            items.push({ id: 'statistics', label: 'ফলাফল পরিসংখ্যান ও পাস-ফেল', icon: BarChart3, color: 'text-purple-600 bg-purple-50' });
        }
        items.push({ id: 'search', label: 'ফলাফল অনুসন্ধান', icon: Search, color: 'text-blue-600 bg-blue-50' });
        if (canManageFullMarks) items.push({ id: 'full-marks', label: 'বিষয় ও পূর্ণমান', icon: CheckCircle2, color: 'text-violet-600 bg-violet-50' });
        if (hasPermission('view:merit-list')) items.push({ id: 'merit', label: 'মেধা তালিকা', icon: Trophy, color: 'text-amber-600 bg-amber-50' });
        if (hasPermission('promote:students')) items.push({ id: 'promotion', label: 'প্রমোশন', icon: Star, color: 'text-rose-600 bg-rose-50' });
        if (hasPermission('upload:marks')) items.push({ id: 'upload', label: 'Excel আপলোড', icon: FileUp, color: 'text-blue-600 bg-blue-50' });
        if (hasPermission('manage:special-results') || hasPermission('manage:results') || user?.role === 'admin') items.push({ id: 'special-exam', label: 'বিশেষ পরীক্ষা', icon: Sparkles, color: 'text-amber-600 bg-amber-50' });
        return items;
    }, [canViewRes, canManageFullMarks, hasPermission, user]);

    const subBgColors = ['bg-[#f0f9ff]', 'bg-[#ecfdf5]', 'bg-[#fffbeb]', 'bg-[#f5f3ff]', 'bg-[#fff7ed]', 'bg-[#fff1f2]'];

    if (isClient && !canViewRes && !hasPermission('view:merit-list') && !hasPermission('promote:students') && !hasPermission('manage:special-results') && user?.role !== 'admin' && !canManageFullMarks) return (
        <div className="flex min-h-screen w-full flex-col bg-violet-50"><Header /><main className="flex flex-1 items-center justify-center p-4"><Card className="p-8 text-center border-2 border-primary/20"><AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" /><h2 className="text-xl font-bold">প্রবেশাধিকার সংরক্ষিত</h2></Card></main></div>
    );

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#F6F7F9] font-kalpurush">
            <Header />
            <main className="flex-1 p-4 md:p-8 no-print pb-40">
                <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-8">
                    <aside className="w-full md:w-64 shrink-0 space-y-1 bg-white md:bg-transparent p-4 md:p-0 border-b md:border-0 sticky top-20 md:top-28 self-start">
                        <h2 className="text-2xl font-black mb-6 px-4 hidden md:block text-slate-900 tracking-tight">ফলাফল ব্যবস্থাপনা</h2>
                        <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-1 scrollbar-none">
                            {sidebarItems.map(item => (
                                <button key={item.id} onClick={() => setActiveSection(item.id)} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold whitespace-nowrap min-w-fit", activeSection === item.id ? "bg-white shadow-md text-primary scale-105" : "text-muted-foreground hover:bg-slate-200/50")}><div className={cn("p-1.5 rounded-lg shrink-0", activeSection === item.id ? item.color : "bg-muted")}><item.icon className="h-4 w-4" /></div><span className="text-sm font-black">{item.label}</span>{activeSection === item.id && <ChevronRight className="ml-auto h-3.5 w-3.5 hidden md:block" />}</button>
                            ))}
                        </div>
                    </aside>
                    <div className="flex-1 min-w-0 bg-white md:rounded-[32px] shadow-2xl md:border-[1px] border-slate-200/50 overflow-hidden min-h-[700px] flex flex-col transition-all duration-500 animate-in fade-in slide-in-from-right-4">
                        <div className="p-4 sm:p-6 lg:p-8 flex-1">
                            <div className="mb-6 border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print"><div><h2 className="text-2xl font-black text-slate-800">{sidebarItems.find(i => i.id === activeSection)?.label}</h2><p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">{schoolInfo.name}</p></div></div>
                            {isLoading ? (<div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>) : (
                                <div className="animate-in fade-in duration-500">
                                    {activeSection === 'management' && <MarkManagementTab allStudents={allStudents} />}
                                    {activeSection === 'attendance' && <ExamAttendanceTab allStudents={allStudents} />}
                                    {activeSection === 'subject-report' && <SubjectReportTab allStudents={allStudents} onPrintRequested={handleSubjectPrint} />}
                                    {activeSection === 'sheet' && <ResultSheetTab allStudents={allStudents} onPrint={handleFullSheetPrint} />}
                                    {activeSection === 'statistics' && <ResultStatisticsTab allStudents={allStudents} onPrintRequested={handleStatisticsPrint} />}
                                    {activeSection === 'search' && <ResultSearchTab allStudents={allStudents} />}
                                    {activeSection === 'full-marks' && <FullMarksTab allStudents={allStudents} />}
                                    {activeSection === 'merit' && <MeritListTab allStudents={allStudents} />}
                                    {activeSection === 'promotion' && <PromotionTab allStudents={allStudents} />}
                                    {activeSection === 'upload' && <BulkUploadTab />}
                                    {activeSection === 'special-exam' && <SpecialExamTab allStudents={allStudents} onPrintRequested={handleSpecialPrint} />}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {printingReport && (
                <div className="hidden print:block printable-area bg-white text-black font-kalpurush">
                    <style jsx global>{`
                        @media print {
                            @page { size: A4 portrait; margin: 15mm !important; }
                            .printable-area { padding: 0 !important; margin: 0 !important; border: none !important; }
                            .printable-area table tr { height: auto !important; }
                            .printable-area table td, .printable-area table th { padding: 2px 8px !important; font-size: 11px !important; border: 1px solid black !important; }
                            .no-print { display: none !important; }
                        }
                    `}</style>
                    <header className="border-b-4 border-emerald-800 pb-4 mb-6">
                        <div className="flex items-center gap-6 mb-2">
                            {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" width={80} height={80} className="object-contain" />}
                            <div className="text-center flex-grow">
                                <h1 className="text-4xl font-black text-emerald-950 leading-none mb-1">{schoolInfo.name}</h1>
                                <p className="text-sm font-bold text-slate-700">{schoolInfo.address}</p>
                                <div className="mt-2 inline-block border-2 border-emerald-800 px-8 py-0.5 rounded-full bg-emerald-50 shadow-sm">
                                    <h2 className="text-xl font-black uppercase text-emerald-900">
                                        {printingReport.info.examName} - {toBengaliNumber(selectedYear)}
                                    </h2>
                                </div>
                            </div>
                            <div className="w-20"></div>
                        </div>
                        
                        <div className="flex flex-col gap-2 mt-4 px-2 font-black text-lg">
                            <div className="flex justify-between items-center border-b-2 border-slate-300 pb-1">
                                <span>বিষয়ঃ {printingReport.info.subject}</span>
                                <span>শ্রেণিঃ {classNamesMap[printingReport.info.className]} শ্রেণি {printingReport.info.group && printingReport.info.group !== 'all' && `(${groupNamesMap[printingReport.info.group]})`}</span>
                                <span>পূর্ণমান: {toBengaliNumber(printingReport.info.fullMarks)}</span>
                            </div>
                        </div>
                    </header>
                    <Table className="border-2 border-black">
                        <TableHeader className="bg-slate-100"><TableRow className="border-b-2 border-black"><TableHead className="w-16 text-center font-black border-r-2 border-black text-black">রোল</TableHead><TableHead className="font-black border-r-2 border-black text-black">শিক্ষার্থীর নাম</TableHead><TableHead className="w-20 text-center font-black border-r-2 border-black text-black">লিখিত</TableHead><TableHead className="w-20 text-center font-black border-r-2 border-black text-black">নৈবেত্তিক</TableHead><TableHead className="w-20 text-center font-black border-r-2 border-black text-black">ব্যবহারিক</TableHead><TableHead className={cn("w-20 text-center font-black text-black", !printingReport.isBlank && "border-r-2 border-black")}>{printingReport.isBlank ? 'মোট' : 'প্রাপ্ত'}</TableHead>{!printingReport.isBlank && <TableHead className="w-20 text-center font-black border-r-2 border-black text-black">গ্রেড</TableHead>}{!printingReport.isBlank && <TableHead className="w-20 text-center font-black border-r-2 border-black text-black">পয়েন্ট</TableHead>}</TableRow></TableHeader>
                        <TableBody>
                          {printingReport.studentData.map((item: any) => (
                            <TableRow key={item.student.id} className={cn("border-b border-slate-400", printingReport.isBlank ? "h-12" : "h-7", !item.isPass && "bg-rose-50/50")}>
                                <TableCell className="text-center font-black border-r-2 border-black">{toBengaliNumber(item.student.roll)}</TableCell>
                                <TableCell className="font-bold border-r-2 border-black">{item.student.studentNameBn}</TableCell>
                                <TableCell className={cn("text-center border-r-2 border-black", !printingReport.isBlank && item.writtenFail && "text-rose-600 font-bold")}>{printingReport.isBlank ? '' : toBengaliNumber(item.marks.written ?? '-')}</TableCell>
                                <TableCell className={cn("text-center border-r-2 border-black", !printingReport.isBlank && item.mcqFail && "text-rose-600 font-bold")}>{printingReport.isBlank ? '' : toBengaliNumber(item.marks.mcq ?? '-')}</TableCell>
                                <TableCell className={cn("text-center border-r-2 border-black", !printingReport.isBlank && item.practicalFail && "text-rose-600 font-bold")}>{printingReport.isBlank ? '' : toBengaliNumber(item.marks.practical ?? '-')}</TableCell>
                                <TableCell className="text-center font-black border-r-2 border-black">{printingReport.isBlank ? '' : toBengaliNumber(item.obtainedMarks)}</TableCell>
                                {!printingReport.isBlank && (
                                    <>
                                        <TableCell className="text-center font-black border-r-2 border-black">{item.grade}</TableCell>
                                        <TableCell className="text-center font-black">{toBengaliNumber(item.point.toFixed(2))}</TableCell>
                                    </>
                                )}
                            </TableRow>
                          ))}
                        </TableBody>
                    </Table>
                    <footer className="mt-20 flex justify-between px-10 no-screen"><div className="text-center w-48 border-t-2 border-black pt-1 font-black">শ্রেণি শিক্ষকের স্বাক্ষর</div><div className="text-center w-48 border-t-2 border-black pt-1 font-black">প্রধান শিক্ষকের স্বাক্ষর</div></footer>
                </div>
            )}

            {fullSheetPrintData && (
                <div className="hidden print:block printable-area bg-white text-black p-2 font-kalpurush w-full box-border">
                    <style jsx global>{`
                        @media print {
                            @page { size: A4 landscape; margin: 4mm !important; }
                            .printable-area { width: 100% !important; padding: 0 !important; }
                            .result-sheet-page { page-break-after: always; min-height: 185mm; display: flex; flex-direction: column; width: 100%; box-sizing: border-box; padding: 2mm !important; }
                            table { border-collapse: collapse !important; border: 1px solid black !important; width: 100% !important; table-layout: auto !important; }
                            th, td { border: 1px solid black !important; padding: 1.5px 2px !important; font-size: 9px !important; line-height: 1.15 !important; text-align: center; }
                            .no-print { display: none !important; }
                        }
                    `}</style>
                    {Object.keys(fullSheetPrintData.results).map(gk => {
                        const results = fullSheetPrintData.results[gk];
                        const allSubs = getSubjects(fullSheetPrintData.className, gk === 'all' ? undefined : gk).filter(s => {
                            if (!s.isExamSubject) return false;
                            const matchingRecord = fullSheetPrintData.classResults.find((r: any) => {
                                const nameMatch = normalize(r.subject) === normalize(s.name);
                                if (!nameMatch) return false;
                                if (parseInt(fullSheetPrintData.className) >= 9) {
                                    const rGroupRaw = (r.group || 'none').toLowerCase().trim();
                                    const rGroupNorm = groupMap[rGroupRaw] || rGroupRaw;
                                    const groupKeyNorm = groupMap[gk.toLowerCase().trim()] || groupMap[gk.trim()] || gk.toLowerCase().trim();
                                    return rGroupNorm === 'none' || rGroupNorm === groupKeyNorm || gk === 'all';
                                }
                                return true;
                            });
                            return (matchingRecord?.fullMarks ?? s.fullMarks) > 0;
                        });

                        const mid = Math.ceil(allSubs.length / 2);
                        const subsPart1 = allSubs.slice(0, mid);
                        const subsPart2 = allSubs.slice(mid);

                        // Chunk students by 10 per page
                        const studentChunks = [];
                        for (let i = 0; i < results.length; i += 10) {
                            studentChunks.push(results.slice(i, i + 10));
                        }

                        return studentChunks.map((chunk, chunkIdx) => (
                            <div key={`${gk}-${chunkIdx}`} className="result-sheet-page">
                                <header className="text-center border-b-[1.5px] border-black pb-1 mb-2 flex flex-col items-center">
                                    <div className="flex items-center gap-3">
                                        {schoolInfo.logoUrl && <img src={schoolInfo.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />}
                                        <h1 className="text-base font-black uppercase leading-tight">{schoolInfo.name}</h1>
                                    </div>
                                    <div className="mt-1 inline-block border-[1.5px] border-black px-6 py-0.5 rounded-full font-black text-[10px] uppercase bg-slate-50">
                                        {fullSheetPrintData.examName} - ফলাফল বিবরণী (শ্রেণি: {classNamesMap[fullSheetPrintData.className]} | শাখা: {groupNamesMap[gk] || gk})
                                    </div>
                                    <div className="flex gap-4 mt-1 font-bold text-[9px]">
                                        <span>সেশন: {toBengaliNumber(selectedYear)}</span>
                                        <span>পৃষ্ঠা: {toBengaliNumber(chunkIdx + 1)}/{toBengaliNumber(studentChunks.length)}</span>
                                    </div>
                                </header>

                                {/* Part 1 Table */}
                                <div className="space-y-0.5 flex-1">
                                    <table className="w-full">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th rowSpan={2} className="w-8">রোল</th>
                                                <th rowSpan={2} className="min-w-[140px] text-left pl-2">শিক্ষার্থীর নাম</th>
                                                {subsPart1.map((s, idx) => {
                                                    const isIct = normalize(s.name).includes('তথ্য ও যোগাযোগ') || normalize(s.name).includes('আইসিটি') || normalize(s.name) === 'ict';
                                                    const hasPrac = s.practical || isIct;
                                                    return (
                                                        <th key={s.name} colSpan={s.name.includes('ইংরেজি') ? 3 : (hasPrac ? 6 : 5)} className={subBgColors[idx % subBgColors.length]}>{s.name}</th>
                                                    );
                                                })}
                                            </tr>
                                            <tr className="bg-white">
                                                {subsPart1.map((s, idx) => {
                                                    const isEng = s.name.includes('ইংরেজি');
                                                    const isIct = normalize(s.name).includes('তথ্য ও যোগাযোগ') || normalize(s.name).includes('আইসিটি') || normalize(s.name) === 'ict';
                                                    const hasPrac = s.practical || isIct;
                                                    const bg = subBgColors[idx % subBgColors.length];
                                                    return (
                                                        <React.Fragment key={s.name}>
                                                            {!isEng && <><th className={bg}>লিখিত</th><th className={bg}>MCQ</th>{hasPrac && <th className={bg}>ব্যবহারিক</th>}</>}
                                                            <th className="bg-blue-50">প্রাপ্ত</th><th className={bg}>গ্রেড</th><th className={bg}>পয়েন্ট</th>
                                                        </React.Fragment>
                                                    )
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {chunk.map((res: StudentProcessedResult) => (
                                                <tr key={res.student.id} className={cn("h-[24px]", !res.isPass && "bg-rose-50/50")}>
                                                    <td className="font-black">{toBengaliNumber(res.student.roll)}</td>
                                                    <td className="text-left pl-2 font-bold whitespace-nowrap">{res.student.studentNameBn}</td>
                                                    {subsPart1.map((s, idx) => {
                                                        const sr = res.subjectResults.get(s.name);
                                                        const isEng = s.name.includes('ইংরেজি');
                                                        const isIct = normalize(s.name).includes('তথ্য ও যোগাযোগ') || normalize(s.name).includes('আইসিটি') || normalize(s.name) === 'ict';
                                                        const hasPrac = s.practical || isIct;
                                                        const bg = subBgColors[idx % subBgColors.length];
                                                        return (
                                                            <React.Fragment key={s.name}>
                                                                {!isEng && <><td className={cn(bg, sr?.writtenFail && "text-rose-600 font-black")}>{toBengaliNumber(sr?.written ?? '-')}</td><td className={cn(bg, sr?.mcqFail && "text-rose-600 font-black")}>{toBengaliNumber(sr?.mcq ?? '-')}</td>{hasPrac && <td className={cn(bg, sr?.practicalFail && "text-rose-600 font-black")}>{toBengaliNumber(sr?.practical ?? '-')}</td>}</>}
                                                                <td className="font-black bg-blue-50/30">{toBengaliNumber(sr?.marks ?? '-')}</td>
                                                                <td className={cn(bg, sr && !sr.isPass && "text-rose-700 font-black")}>{sr?.grade ?? '-'}</td>
                                                                <td className={bg}>{toBengaliNumber(sr?.point?.toFixed(2) ?? '-')}</td>
                                                            </React.Fragment>
                                                        )
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Gap and Part 2 Table */}
                                    <div className="h-[5px]" /> 
                                    <table className="w-full">
                                        <thead className="bg-slate-50">
                                            <tr>
                                                <th rowSpan={2} className="w-8">রোল</th>
                                                <th rowSpan={2} className="min-w-[140px] text-left pl-2">শিক্ষার্থীর নাম</th>
                                                {subsPart2.map((s, idx) => {
                                                    const isIct = normalize(s.name).includes('তথ্য ও যোগাযোগ') || normalize(s.name).includes('আইসিটি') || normalize(s.name) === 'ict';
                                                    const hasPrac = s.practical || isIct;
                                                    return (
                                                        <th key={s.name} colSpan={s.name.includes('ইংরেজি') ? 3 : (hasPrac ? 6 : 5)} className={subBgColors[(mid + idx) % subBgColors.length]}>{s.name}</th>
                                                    );
                                                })}
                                                <th rowSpan={2} className="w-12 bg-blue-50">মোট</th>
                                                <th rowSpan={2} className="w-12 bg-blue-50">GPA</th>
                                                <th rowSpan={2} className="w-10 bg-blue-50">গ্রেড</th>
                                                <th rowSpan={2} className="w-12 bg-blue-50">মেধা</th>
                                            </tr>
                                            <tr className="bg-white">
                                                {subsPart2.map((s, idx) => {
                                                    const isEng = s.name.includes('ইংরেজি');
                                                    const isIct = normalize(s.name).includes('তথ্য ও যোগাযোগ') || normalize(s.name).includes('আইসিটি') || normalize(s.name) === 'ict';
                                                    const hasPrac = s.practical || isIct;
                                                    const bg = subBgColors[(mid + idx) % subBgColors.length];
                                                    return (
                                                        <React.Fragment key={s.name}>
                                                            {!isEng && <><th className={bg}>লিখিত</th><th className={bg}>MCQ</th>{hasPrac && <th className={bg}>ব্যবহারিক</th>}</>}
                                                            <th className="bg-blue-50">প্রাপ্ত</th><th className={bg}>গ্রেড</th><th className={bg}>পয়েন্ট</th>
                                                        </React.Fragment>
                                                    )
                                                })}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {chunk.map((res: StudentProcessedResult) => (
                                                <tr key={res.student.id} className={cn("h-[24px]", !res.isPass && "bg-rose-50/50")}>
                                                    <td className="font-black">{toBengaliNumber(res.student.roll)}</td>
                                                    <td className="text-left pl-2 font-bold whitespace-nowrap">{res.student.studentNameBn}</td>
                                                    {subsPart2.map((s, idx) => {
                                                        const sr = res.subjectResults.get(s.name);
                                                        const isEng = s.name.includes('ইংরেজি');
                                                        const isIct = normalize(s.name).includes('তথ্য ও যোগাযোগ') || normalize(s.name).includes('আইসিটি') || normalize(s.name) === 'ict';
                                                        const hasPrac = s.practical || isIct;
                                                        const bg = subBgColors[(mid + idx) % subBgColors.length];
                                                        return (
                                                            <React.Fragment key={s.name}>
                                                                {!isEng && <><td className={cn(bg, sr?.writtenFail && "text-rose-600 font-black")}>{toBengaliNumber(sr?.written ?? '-')}</td><td className={cn(bg, sr?.mcqFail && "text-rose-600 font-black")}>{toBengaliNumber(sr?.mcq ?? '-')}</td>{hasPrac && <td className={cn(bg, sr?.practicalFail && "text-rose-600 font-black")}>{toBengaliNumber(sr?.practical ?? '-')}</td>}</>}
                                                                <td className="font-black bg-blue-50/30">{toBengaliNumber(sr?.marks ?? '-')}</td>
                                                                <td className={cn(bg, sr && !sr.isPass && "text-rose-700 font-black")}>{sr?.grade ?? '-'}</td>
                                                                <td className={bg}>{toBengaliNumber(sr?.point?.toFixed(2) ?? '-')}</td>
                                                            </React.Fragment>
                                                        )
                                                    })}
                                                    <td className="font-black bg-blue-50/20">{toBengaliNumber(res.totalMarks)}</td>
                                                    <td className="font-black bg-blue-50/20">{toBengaliNumber(res.gpa.toFixed(2))}</td>
                                                    <td className={cn("font-black bg-blue-50/20", !res.isPass && "text-rose-700")}>{res.finalGrade}</td>
                                                    <td className={cn("font-bold bg-blue-50/20", !res.isPass && (res.isAbsent ? "text-slate-600 italic text-[10px]" : "text-rose-600"))}>{res.isPass ? toBengaliNumber(res.meritPosition || '-') : (res.isAbsent ? 'অনুপস্থিত' : 'ফেল')}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <footer className="mt-6 flex justify-between px-10 border-t border-black pt-2 pb-4 no-screen">
                                    <div className="text-center w-40 border-t border-black pt-0.5 font-black text-[10px]">অফিস সহকারীর স্বাক্ষর</div>
                                    <div className="text-center w-40 border-t border-black pt-0.5 font-black text-[10px]">প্রধান শিক্ষকের স্বাক্ষর</div>
                                </footer>
                            </div>
                        ));
                    })}
                </div>
            )}

            {specialPrintData && (
                <div className="hidden print:block printable-area bg-white text-black p-4 font-kalpurush w-full box-border border-[6px] border-double border-black/30">
                    <style jsx global>{`
                        @media print {
                            @page { size: A4 landscape; margin: 5mm !important; }
                            .printable-area { padding: 0 !important; margin: 0 !important; border: none !important; width: 100% !important; }
                            table { border-collapse: collapse !important; border: 1px solid black !important; width: 100% !important; }
                            th, td { border: 1px solid black !important; padding: 2px !important; font-size: 9px !important; text-align: center; }
                            .no-print { display: none !important; }
                        }
                    `}</style>
                    <header className="text-center border-b-2 border-black pb-2 mb-4 flex flex-col items-center">
                        {schoolInfo.logoUrl && <img src={schoolInfo.logoUrl} alt="Logo" className="w-12 h-12 object-contain mb-1" />}
                        <h1 className="text-xl font-black">{schoolInfo.name}</h1>
                        <p className="text-[12px] font-bold">{schoolInfo.address}</p>
                        <div className="mt-1 inline-block border-2 border-black px-6 py-0.5 rounded-full font-black text-xs uppercase bg-slate-50">বিশেষ পরীক্ষার ফলাফল শিট - {specialPrintData.month} {toBengaliNumber(specialPrintData.year)}</div>
                        <p className="text-[12px] font-bold mt-1">শ্রেণি: {classNamesMap[specialPrintData.className] || specialPrintData.className}</p>
                    </header>
                    <table className="w-full">
                        <thead>
                            <tr className="bg-slate-100">
                                <th rowSpan={2} className="w-12">রোল</th>
                                <th rowSpan={2} className="min-w-[150px] text-left pl-2">শিক্ষার্থীর নাম</th>
                                {specialPrintData.availableSubjects.map((sub: any) => (
                                    <th key={sub.name} colSpan={3}>{sub.name}</th>
                                ))}
                                <th rowSpan={2} className="w-16">মোট</th>
                            </tr>
                            <tr className="bg-slate-50">
                                {specialPrintData.availableSubjects.map((sub: any) => (
                                    <React.Fragment key={sub.name}><th className="w-8">প-১</th><th className="w-8">প-২</th><th className="w-8">প-৩</th></React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {specialPrintData.students.map((student: any) => {
                                let total = 0;
                                return (
                                    <tr key={student.id}>
                                        <td className="font-bold">{toBengaliNumber(student.roll)}</td>
                                        <td className="text-left pl-2 font-bold">{student.studentNameBn}</td>
                                        {specialPrintData.availableSubjects.map((sub: any) => (
                                            ['বিশেষ পরীক্ষা-১', 'বিশেষ পরীক্ষা-২', 'বিশেষ পরীক্ষা-৩'].map(type => {
                                                const match = specialPrintData.allSpecialResults.find((r: any) => {
                                                    const normSearch = normalize(sub.name);
                                                    const normRecord = normalize(r.subject);
                                                    if (sub.isCombined) return sub.subList.some((inner: string) => normalize(inner) === normRecord) && r.examType === type;
                                                    return normRecord === normSearch && r.examType === type;
                                                });
                                                const m = match?.results.find((res: any) => res.studentId === student.id)?.marks;
                                                if (m !== undefined) total += m;
                                                return <td key={type}>{m !== undefined ? toBengaliNumber(m) : '-'}</td>;
                                            })
                                        ))}
                                        <td className="font-black bg-slate-50">{toBengaliNumber(total)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {statisticsPrintData && (
                <div className="hidden print:block printable-area bg-white text-black font-kalpurush p-6">
                    <style jsx global>{`
                        @media print {
                            @page { size: A4 portrait; margin: 10mm !important; }
                            body { background: white !important; }
                            .no-print { display: none !important; }
                            .printable-area { display: block !important; padding: 0 !important; margin: 0 !important; width: 100% !important; }
                            .printable-area table { border-collapse: collapse !important; width: 100% !important; margin-bottom: 12px !important; }
                            .printable-area th, .printable-area td { border: 1px solid black !important; padding: 3px 6px !important; font-size: 10px !important; }
                            .printable-area th { background-color: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        }
                    `}</style>

                    {/* Printable Header */}
                    <header className="border-b-2 border-black pb-3 mb-4 text-center">
                        <div className="flex items-center justify-center gap-3.5 mx-auto">
                            {schoolInfo.logoUrl && (
                                <img src={schoolInfo.logoUrl} alt="Logo" className="w-14 h-14 object-contain" />
                            )}
                            <div className="text-center">
                                <h1 className="text-2xl font-black text-black leading-tight uppercase tracking-tight">{schoolInfo.name}</h1>
                                <p className="text-[12px] font-bold text-slate-800">{schoolInfo.address}</p>
                                <p className="text-[10px] font-bold text-slate-700 mt-0.5">
                                    EIIN: {toBengaliNumber(schoolInfo.eiin)} | কোড: {toBengaliNumber(schoolInfo.code)} | শিক্ষাবর্ষ: {toBengaliNumber(statisticsPrintData.selectedYear)}
                                </p>
                            </div>
                            {schoolInfo.logoUrl && (
                                <div className="w-14 h-14 shrink-0 invisible" aria-hidden="true" />
                            )}
                        </div>

                        <div className="mt-2.5 inline-block border-[1.5px] border-black px-8 py-0.5 rounded-full font-black text-sm uppercase bg-slate-50">
                            {statisticsPrintData.examName} - বিষয়ভিত্তিক পাস-ফেল ও ফলাফল পরিসংখ্যান প্রতিবেদন
                        </div>
                        <p className="mt-1 font-black text-black text-xs">
                            শ্রেণি: {classNamesMap[statisticsPrintData.className]} {statisticsPrintData.groupFilter !== 'all' && `(${groupNamesMap[statisticsPrintData.groupFilter] || statisticsPrintData.groupFilter})`}
                        </p>
                    </header>

                    {/* ১. সার্বিক ও লিঙ্গভিত্তিক পরিসংখ্যান সারসংক্ষেপ */}
                    <div className="mb-4">
                        <div className="font-black text-xs text-black border-b border-black pb-1 mb-1 uppercase">
                            ১. সার্বিক ও লিঙ্গভিত্তিক পরিসংখ্যান সারসংক্ষেপ
                        </div>
                        <table className="w-full text-center">
                            <thead>
                                <tr>
                                    <th>বিবরণ</th>
                                    <th>মোট শিক্ষার্থী</th>
                                    <th>অংশগ্রহণকারী (উপস্থিত)</th>
                                    <th>অনুপস্থিত</th>
                                    <th>মোট পাশ (কৃতকার্য)</th>
                                    <th>পাশের হার (%)</th>
                                    <th>মোট ফেল (অকৃতকার্য)</th>
                                    <th>ফেলের হার (%)</th>
                                    <th>GPA ৫.০০</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="font-black">ছাত্র</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.totalBoys)}</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.presentBoys)}</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.absentBoys)}</td>
                                    <td className="font-bold">{toBengaliNumber(statisticsPrintData.stats.passedBoys)}</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.passRateBoys)}%</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.failedBoys)}</td>
                                    <td>-</td>
                                    <td className="font-bold">{toBengaliNumber(statisticsPrintData.stats.gpa5Boys)}</td>
                                </tr>
                                <tr>
                                    <td className="font-black">ছাত্রী</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.totalGirls)}</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.presentGirls)}</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.absentGirls)}</td>
                                    <td className="font-bold">{toBengaliNumber(statisticsPrintData.stats.passedGirls)}</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.passRateGirls)}%</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.failedGirls)}</td>
                                    <td>-</td>
                                    <td className="font-bold">{toBengaliNumber(statisticsPrintData.stats.gpa5Girls)}</td>
                                </tr>
                                <tr className="font-black bg-slate-50">
                                    <td>সর্বমোট</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.total)}</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.presentCount)}</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.absentCount)}</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.passedCount)}</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.passRate)}%</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.failedCount)}</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.failRate)}%</td>
                                    <td>{toBengaliNumber(statisticsPrintData.stats.gpa5Count)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* ২. শাখা / বিভাগ ভিত্তিক ফলাফল পরিসংখ্যান */}
                    {statisticsPrintData.groupStats.length > 0 && (
                        <div className="mb-4">
                            <div className="font-black text-xs text-black border-b border-black pb-1 mb-1 uppercase">
                                ২. শাখা / বিভাগ ভিত্তিক ফলাফল পরিসংখ্যান
                            </div>
                            <table className="w-full text-center">
                                <thead>
                                    <tr>
                                        <th>শাখা/বিভাগ</th>
                                        <th>মোট শিক্ষার্থী</th>
                                        <th>উপস্থিত</th>
                                        <th>অনুপস্থিত</th>
                                        <th>মোট পাশ</th>
                                        <th>ছাত্র পাশ</th>
                                        <th>ছাত্রী পাশ</th>
                                        <th>পাশের হার</th>
                                        <th>মোট ফেল</th>
                                        <th>GPA ৫.০০</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {statisticsPrintData.groupStats.map((g: any) => (
                                        <tr key={g.groupKey}>
                                            <td className="font-black">{g.name}</td>
                                            <td>{toBengaliNumber(g.total)}</td>
                                            <td>{toBengaliNumber(g.present)}</td>
                                            <td>{toBengaliNumber(g.absent)}</td>
                                            <td className="font-bold">{toBengaliNumber(g.passedCount)}</td>
                                            <td>{toBengaliNumber(g.passedBoys)}</td>
                                            <td>{toBengaliNumber(g.passedGirls)}</td>
                                            <td className="font-black">{toBengaliNumber(g.passRate)}%</td>
                                            <td>{toBengaliNumber(g.failedCount)}</td>
                                            <td className="font-bold">{toBengaliNumber(g.gpa5)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* ৩. বিষয়ভিত্তিক পাস ও ফেল পরিসংখ্যান */}
                    <div className="mb-4">
                        <div className="font-black text-xs text-black border-b border-black pb-1 mb-1 uppercase">
                            ৩. বিষয়ভিত্তিক পাস ও ফেল পরিসংখ্যান
                        </div>
                        <table className="w-full text-center">
                            <thead>
                                <tr>
                                    <th className="w-8">ক্রমিক</th>
                                    <th className="text-left pl-2">বিষয়ের নাম</th>
                                    <th className="w-12">পূর্ণমান</th>
                                    <th className="w-16">পরীক্ষার্থী</th>
                                    <th className="w-14">মোট পাশ</th>
                                    <th className="w-12">ছাত্র পাশ</th>
                                    <th className="w-12">ছাত্রী পাশ</th>
                                    <th className="w-14">পাশের হার</th>
                                    <th className="w-14">মোট ফেল</th>
                                    <th className="w-12">ছাত্র ফেল</th>
                                    <th className="w-12">ছাত্রী ফেল</th>
                                    <th className="w-14">ফেলের হার</th>
                                    <th className="w-12">সর্বোচ্চ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {statisticsPrintData.subjectStats.map((sub: any, idx: number) => (
                                    <tr key={sub.name}>
                                        <td>{toBengaliNumber(idx + 1)}</td>
                                        <td className="text-left pl-2 font-bold">{sub.name}</td>
                                        <td>{toBengaliNumber(sub.fullMarks)}</td>
                                        <td className="font-bold">{toBengaliNumber(sub.presentCount)}</td>
                                        <td className="font-bold">{toBengaliNumber(sub.passedTotal)}</td>
                                        <td>{toBengaliNumber(sub.passedBoys)}</td>
                                        <td>{toBengaliNumber(sub.passedGirls)}</td>
                                        <td className="font-black">{toBengaliNumber(sub.passRate)}%</td>
                                        <td className="font-bold">{toBengaliNumber(sub.failedTotal)}</td>
                                        <td>{toBengaliNumber(sub.failedBoys)}</td>
                                        <td>{toBengaliNumber(sub.failedGirls)}</td>
                                        <td>{toBengaliNumber(sub.failRate)}%</td>
                                        <td className="font-bold">{toBengaliNumber(sub.highestMarks)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* ৪. অকৃতকার্য শিক্ষার্থীদের তালিকা ও ফেলকৃত বিষয়সমূহ */}
                    {statisticsPrintData.failedStudentsList.length > 0 && (
                        <div className="mb-6">
                            <div className="font-black text-xs text-black border-b border-black pb-1 mb-1 uppercase">
                                ৪. অকৃতকার্য শিক্ষার্থীদের তালিকা ও ফেলকৃত বিষয়সমূহ (মোট: {toBengaliNumber(statisticsPrintData.failedStudentsList.length)} জন)
                            </div>
                            <table className="w-full">
                                <thead>
                                    <tr>
                                        <th className="w-8 text-center">ক্রমিক</th>
                                        <th className="w-12 text-center">রোল</th>
                                        <th className="text-left pl-2">শিক্ষার্থীর নাম</th>
                                        <th className="w-12 text-center">লিঙ্গ</th>
                                        <th className="w-16 text-center">শাখা</th>
                                        <th className="w-14 text-center">ফেল সংখ্যা</th>
                                        <th className="text-left pl-2">ফেলকৃত বিষয়সমূহ</th>
                                        <th className="w-14 text-center">মোট নম্বর</th>
                                        <th className="w-12 text-center">গ্রেড</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {statisticsPrintData.failedStudentsList.map((item: any, idx: number) => (
                                        <tr key={item.student.id}>
                                            <td className="text-center font-bold">{toBengaliNumber(idx + 1)}</td>
                                            <td className="text-center font-black">{toBengaliNumber(item.student.roll)}</td>
                                            <td className="pl-2 font-bold">{item.student.studentNameBn}</td>
                                            <td className="text-center">{isFemale(item.student.gender) ? 'ছাত্রী' : 'ছাত্র'}</td>
                                            <td className="text-center">{groupNamesMap[item.student.group || ''] || item.student.group || 'সাধারণ'}</td>
                                            <td className="text-center font-black">{toBengaliNumber(item.failedCount)} টি</td>
                                            <td className="pl-2">
                                                {item.failedSubjects.map((s: any, i: number) => (
                                                    <span key={i} className="mr-2 inline-block">
                                                        {s.name}{s.marks !== undefined ? `(${toBengaliNumber(s.marks)})` : ''}
                                                        {i < item.failedSubjects.length - 1 ? ',' : ''}
                                                    </span>
                                                ))}
                                            </td>
                                            <td className="text-center font-bold">{toBengaliNumber(item.totalMarks)}</td>
                                            <td className="text-center font-black">{item.finalGrade}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Printable Footer / Signatures */}
                    <div className="mt-12 pt-6 flex justify-between items-center text-xs font-black">
                        <div className="text-center border-t border-black pt-1 w-36">শ্রেণি শিক্ষক</div>
                        <div className="text-center border-t border-black pt-1 w-44">পরীক্ষা কমিটির আহ্বায়ক</div>
                        <div className="text-center border-t border-black pt-1 w-36">প্রধান শিক্ষক</div>
                    </div>
                </div>
            )}
        </div>
    );
}
