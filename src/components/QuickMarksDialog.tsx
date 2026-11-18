'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useAuth } from '@/hooks/useAuth';
import { getExams, Exam } from '@/lib/exam-data';
import { getSubjects, Subject as SubjectType, subjectNameNormalization } from '@/lib/subjects';
import { saveClassResults, ClassResult, StudentResult, getDocumentId } from '@/lib/results-data';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { studentFromDoc, Student } from '@/lib/student-data';
import { FilePen, Loader2, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const classNamesMap: Record<string, string> = {
    '6': 'ষষ্ঠ',
    '7': '৭ম',
    '8': '৮ম',
    '9': '৯ম',
    '10': 'দশম'
};

const toBengaliNumber = (str: string | number | undefined | null) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

function toEnglishDigits(str: string): string {
    const bengali = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return str.replace(/[০-৯]/g, d => String(bengali.indexOf(d)));
}

interface ParsedItem {
    roll: number;
    mark: number;
    studentName?: string;
    studentId?: string;
}

export interface QuickMarksDialogProps {
    initialClass?: string;
    initialSubject?: string;
    initialExam?: string;
    initialGroup?: string;
    triggerButton?: React.ReactNode;
    onSaveSuccess?: () => void;
}

export function QuickMarksDialog({
    initialClass = '6',
    initialSubject = '',
    initialExam = '',
    initialGroup = 'all',
    triggerButton,
    onSaveSuccess
}: QuickMarksDialogProps) {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user, hasPermission } = useAuth();

    const [isOpen, setIsOpen] = useState(false);
    const [exams, setExams] = useState<Exam[]>([]);
    const [examName, setExamName] = useState(initialExam || 'অর্ধ-বার্ষিক পরীক্ষা');
    const [className, setClassName] = useState(initialClass || '6');
    const [group, setGroup] = useState(initialGroup || 'all');
    const [subject, setSubject] = useState(initialSubject || '');
    const [markType, setMarkType] = useState<'written' | 'mcq' | 'practical'>('written');
    const [rawInput, setRawInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [classStudents, setClassStudents] = useState<Student[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);

    // Sync initial props
    useEffect(() => {
        if (initialClass) setClassName(initialClass);
        if (initialSubject) setSubject(initialSubject);
        if (initialExam) setExamName(initialExam);
        if (initialGroup) setGroup(initialGroup);
    }, [initialClass, initialSubject, initialExam, initialGroup]);

    // Load available exams
    useEffect(() => {
        if (!db || !selectedYear) return;
        getExams(db, selectedYear).then(res => {
            if (res && res.length > 0) {
                setExams(res);
                if (!examName) setExamName(res[0].name);
            }
        }).catch(() => {});
    }, [db, selectedYear]);

    // Load subjects for chosen class and group
    const showGroupSelector = useMemo(() => parseInt(className) >= 9, [className]);

    const availableSubjects = useMemo(() => {
        return getSubjects(className, group === 'all' ? undefined : group).filter(s => s.isExamSubject !== false);
    }, [className, group]);

    useEffect(() => {
        if (availableSubjects.length > 0 && (!subject || !availableSubjects.some(s => s.name === subject))) {
            setSubject(availableSubjects[0].name);
        }
    }, [availableSubjects, subject]);

    // Load students for current class to map rolls to names & IDs
    useEffect(() => {
        if (!db || !selectedYear || !className || !isOpen) return;
        let isCancelled = false;
        setIsLoadingStudents(true);

        const q = query(
            collection(db, 'students'),
            where('academicYear', '==', selectedYear),
            where('className', '==', className)
        );

        getDocs(q).then(snap => {
            if (isCancelled) return;
            const sts = snap.docs.map(d => studentFromDoc(d)).sort((a, b) => a.roll - b.roll);
            setClassStudents(sts);
        }).catch(err => {
            console.error('Error fetching students for quick marks:', err);
        }).finally(() => {
            if (!isCancelled) setIsLoadingStudents(false);
        });

        return () => { isCancelled = true; };
    }, [db, selectedYear, className, isOpen]);

    // Parse raw input into roll -> mark pairs
    const parsedItems: ParsedItem[] = useMemo(() => {
        if (!rawInput.trim()) return [];
        const normalized = toEnglishDigits(rawInput);
        const separators = ['-', ':', '='].join('');
        const regex = new RegExp('(?:(?:roll|রোল)\\s*)?(\\d+)\\s*[' + separators + ']\\s*(\\d+)', 'gi');
        const map = new Map<number, number>();
        let match;

        while ((match = regex.exec(normalized)) !== null) {
            const roll = parseInt(match[1], 10);
            const mark = parseInt(match[2], 10);
            if (!isNaN(roll) && !isNaN(mark)) {
                map.set(roll, mark);
            }
        }

        const items: ParsedItem[] = [];
        map.forEach((mark, roll) => {
            const st = classStudents.find(s => s.roll === roll);
            items.push({
                roll,
                mark,
                studentName: st?.studentNameBn || st?.studentNameEn || '',
                studentId: st?.id
            });
        });

        return items.sort((a, b) => a.roll - b.roll);
    }, [rawInput, classStudents]);

    // Submit handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !selectedYear || !examName || !className || !subject) {
            toast({ variant: 'destructive', title: 'পরীক্ষা, শ্রেণি ও বিষয় নির্বাচন করুন' });
            return;
        }

        if (parsedItems.length === 0) {
            toast({ variant: 'destructive', title: 'কোনো রোল ও নম্বর পাওয়া যায়নি', description: 'অনুগ্রহ করে "১-৮৫, ২-৭৮" ফরম্যাটে লিখুন।' });
            return;
        }

        setIsSaving(true);
        try {
            const effectiveGroup = (parseInt(className) < 9 || group === 'all') ? undefined : group;
            const normSub = subjectNameNormalization[subject] || subject;
            const docId = getDocumentId({
                academicYear: selectedYear,
                examName,
                className,
                group: effectiveGroup,
                subject: normSub
            });

            const docRef = doc(db, 'results', docId);
            const snap = await getDoc(docRef);
            const existingData = snap.exists() ? (snap.data() as ClassResult) : null;

            // Merge with existing results
            const resultsMap = new Map<string, StudentResult>();
            if (existingData?.results && Array.isArray(existingData.results)) {
                existingData.results.forEach(r => {
                    resultsMap.set(r.studentId, { ...r });
                });
            }

            let appliedCount = 0;
            const unmappedRolls: number[] = [];

            parsedItems.forEach(item => {
                let stId = item.studentId;
                if (!stId) {
                    const found = classStudents.find(s => s.roll === item.roll);
                    if (found) stId = found.id;
                }

                if (stId) {
                    const current = resultsMap.get(stId) || { studentId: stId };
                    if (markType === 'mcq') {
                        current.mcq = item.mark;
                    } else if (markType === 'practical') {
                        current.practical = item.mark;
                    } else {
                        current.written = item.mark;
                    }
                    resultsMap.set(stId, current);
                    appliedCount++;
                } else {
                    unmappedRolls.push(item.roll);
                }
            });

            const subInfo = availableSubjects.find(s => s.name === subject);
            const isIct = normSub.includes('তথ্য ও যোগাযোগ') || normSub.includes('আইসিটি') || normSub.toLowerCase() === 'ict';
            const defaultFull = subInfo?.fullMarks || (isIct ? 50 : 100);

            const payload: ClassResult = {
                academicYear: selectedYear,
                examName,
                className,
                group: effectiveGroup || undefined,
                subject: normSub,
                fullMarks: existingData?.fullMarks || defaultFull,
                writtenLimit: existingData?.writtenLimit ?? (subInfo?.practical ? 70 : defaultFull),
                mcqLimit: existingData?.mcqLimit ?? (subInfo?.practical ? 30 : 0),
                practicalLimit: existingData?.practicalLimit ?? (isIct ? 25 : (subInfo?.practical ? 25 : 0)),
                results: Array.from(resultsMap.values())
            };

            await saveClassResults(db, payload);

            toast({
                title: 'কুইক নম্বর ইনপুট সফল হয়েছে!',
                description: `${appliedCount} জন শিক্ষার্থীর নম্বর সংরক্ষিত হয়েছে (${classNamesMap[className]} শ্রেণি - ${subject})।${unmappedRolls.length > 0 ? ` [রোল ${unmappedRolls.join(', ')} শ্রেণির তালিকায় মেলেনি]` : ''}`
            });

            setRawInput('');
            setIsOpen(false);
            if (onSaveSuccess) onSaveSuccess();
        } catch (err: any) {
            console.error('Error saving quick marks:', err);
            toast({ variant: 'destructive', title: 'নম্বর সংরক্ষণ ব্যর্থ হয়েছে', description: err?.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {triggerButton || (
                    <Button className="h-12 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 shadow-lg font-black gap-2 transition-all border-b-4 border-amber-800 active:border-b-0 active:translate-y-1 text-white">
                        <FilePen className="h-5 w-5" /> কুইক নম্বর ইনপুট
                    </Button>
                )}
            </DialogTrigger>

            <DialogContent className="font-kalpurush sm:max-w-lg max-h-[92vh] overflow-y-auto p-0 border-none shadow-2xl rounded-2xl">
                <DialogHeader className="p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-t-2xl">
                    <DialogTitle className="text-xl font-black flex items-center gap-2">
                        <FilePen className="h-5 w-5" /> কুইক নম্বর ইনপুট
                    </DialogTitle>
                    <DialogDescription className="text-amber-100 font-bold text-xs mt-1">
                        শ্রেণি, বিষয় ও পরীক্ষা সিলেক্ট করে "রোল-নম্বর" ফরম্যাটে একসাথে সবার নম্বর সহজে ইনপুট করুন।
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Exam, Class & Group Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-xs font-black text-slate-700">পরীক্ষার নাম</Label>
                            <Select value={examName} onValueChange={setExamName}>
                                <SelectTrigger className="h-10 border-2 font-black text-xs bg-white">
                                    <SelectValue placeholder="পরীক্ষা নির্বাচন করুন" />
                                </SelectTrigger>
                                <SelectContent className="font-kalpurush">
                                    {exams.length > 0 ? (
                                        exams.map(e => (
                                            <SelectItem key={e.id} value={e.name} className="font-bold text-xs">
                                                {e.name}
                                            </SelectItem>
                                        ))
                                    ) : (
                                        <>
                                            <SelectItem value="অর্ধ-বার্ষিক পরীক্ষা" className="font-bold text-xs">অর্ধ-বার্ষিক পরীক্ষা</SelectItem>
                                            <SelectItem value="বার্ষিক পরীক্ষা" className="font-bold text-xs">বার্ষিক পরীক্ষা</SelectItem>
                                            <SelectItem value="প্রাক-নির্বাচনী পরীক্ষা" className="font-bold text-xs">প্রাক-নির্বাচনী পরীক্ষা</SelectItem>
                                            <SelectItem value="নির্বাচনী পরীক্ষা" className="font-bold text-xs">নির্বাচনী পরীক্ষা</SelectItem>
                                        </>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs font-black text-slate-700">শ্রেণি</Label>
                            <Select value={className} onValueChange={setClassName}>
                                <SelectTrigger className="h-10 border-2 font-black text-xs bg-white">
                                    <SelectValue placeholder="শ্রেণি নির্বাচন করুন" />
                                </SelectTrigger>
                                <SelectContent className="font-kalpurush">
                                    {Object.entries(classNamesMap).map(([id, label]) => (
                                        <SelectItem key={id} value={id} className="font-bold text-xs">
                                            {label} শ্রেণি
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Group (if >= 9) and Subject */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {showGroupSelector && (
                            <div className="space-y-1">
                                <Label className="text-xs font-black text-slate-700">শাখা / বিভাগ</Label>
                                <Select value={group} onValueChange={setGroup}>
                                    <SelectTrigger className="h-10 border-2 font-black text-xs bg-white">
                                        <SelectValue placeholder="বিভাগ" />
                                    </SelectTrigger>
                                    <SelectContent className="font-kalpurush">
                                        <SelectItem value="all" className="font-bold text-xs">সকল বিভাগ</SelectItem>
                                        <SelectItem value="science" className="font-bold text-xs">বিজ্ঞান</SelectItem>
                                        <SelectItem value="arts" className="font-bold text-xs">মানবিক</SelectItem>
                                        <SelectItem value="commerce" className="font-bold text-xs">ব্যবসায় শিক্ষা</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className={cn("space-y-1", !showGroupSelector && "sm:col-span-2")}>
                            <Label className="text-xs font-black text-slate-700">বিষয়</Label>
                            <Select value={subject} onValueChange={setSubject}>
                                <SelectTrigger className="h-10 border-2 font-black text-xs bg-white">
                                    <SelectValue placeholder="বিষয় নির্বাচন করুন" />
                                </SelectTrigger>
                                <SelectContent className="font-kalpurush max-h-56">
                                    {availableSubjects.map(s => (
                                        <SelectItem key={s.name} value={s.name} className="font-bold text-xs">
                                            {s.name} {s.fullMarks ? `(${toBengaliNumber(s.fullMarks)})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Mark Component Type Toggle (Written / MCQ / Practical) */}
                    <div className="space-y-1.5 bg-amber-50/60 p-2.5 rounded-xl border border-amber-200">
                        <Label className="text-xs font-black text-amber-950 block">কোন অংশের নম্বর ইনপুট করছেন?</Label>
                        <div className="grid grid-cols-3 gap-1.5">
                            <button
                                type="button"
                                onClick={() => setMarkType('written')}
                                className={cn(
                                    "py-1.5 text-xs font-black rounded-lg border transition-all text-center",
                                    markType === 'written' ? "bg-amber-600 text-white border-amber-600 shadow-2xs" : "bg-white text-slate-700 border-slate-300 hover:bg-amber-100/50"
                                )}
                            >
                                লিখিত (Written)
                            </button>
                            <button
                                type="button"
                                onClick={() => setMarkType('mcq')}
                                className={cn(
                                    "py-1.5 text-xs font-black rounded-lg border transition-all text-center",
                                    markType === 'mcq' ? "bg-amber-600 text-white border-amber-600 shadow-2xs" : "bg-white text-slate-700 border-slate-300 hover:bg-amber-100/50"
                                )}
                            >
                                নৈর্ব্যক্তিক (MCQ)
                            </button>
                            <button
                                type="button"
                                onClick={() => setMarkType('practical')}
                                className={cn(
                                    "py-1.5 text-xs font-black rounded-lg border transition-all text-center",
                                    markType === 'practical' ? "bg-amber-600 text-white border-amber-600 shadow-2xs" : "bg-white text-slate-700 border-slate-300 hover:bg-amber-100/50"
                                )}
                            >
                                ব্যবহারিক (Practical)
                            </button>
                        </div>
                    </div>

                    {/* Quick Marks Input Textarea */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-black text-slate-800">
                                রোল-নম্বর ইনপুট করুন
                            </Label>
                            <span className="text-[11px] font-bold text-amber-800">
                                ফরম্যাট: রোল-নম্বর, রোল-নম্বর
                            </span>
                        </div>
                        <Textarea
                            rows={4}
                            value={rawInput}
                            onChange={e => setRawInput(e.target.value)}
                            placeholder="যেমন: ১-৮৫, ২-৭৮, ৩-৯২, ৪-৬৫, ৫-৮০..."
                            className="font-black text-sm border-2 border-amber-300 focus-visible:ring-amber-500 bg-white placeholder:text-slate-400 placeholder:font-normal leading-relaxed"
                        />
                        <p className="text-[10px] font-bold text-slate-500">
                            * কমা (,), স্পেস বা নতুন লাইনে হাইফেন (-) দিয়ে রোল ও নম্বর লিখুন। বাংলা বা ইংরেজি দুই ধরনের সংখ্যাই সমর্থিত।
                        </p>
                    </div>

                    {/* Live Preview Badges */}
                    {parsedItems.length > 0 && (
                        <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-300 space-y-2">
                            <div className="flex items-center justify-between text-xs font-black text-emerald-950">
                                <span className="flex items-center gap-1">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    মোট শনাক্ত: {toBengaliNumber(parsedItems.length)} জন
                                </span>
                                <span className="text-[11px] text-emerald-800 font-bold">
                                    {markType === 'written' ? 'লিখিত' : markType === 'mcq' ? 'MCQ' : 'ব্যবহারিক'} অংশ
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                                {parsedItems.map((item) => (
                                    <span
                                        key={item.roll}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-emerald-950 shadow-2xs"
                                    >
                                        <span className="font-black">রোল {toBengaliNumber(item.roll)}:</span>
                                        <span className="text-amber-800 font-black">{toBengaliNumber(item.mark)}</span>
                                        {item.studentName && (
                                            <span className="text-slate-500 text-[9px] truncate max-w-[65px]">
                                                ({item.studentName})
                                            </span>
                                        )}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        disabled={isSaving || parsedItems.length === 0}
                        className="w-full h-11 bg-amber-600 hover:bg-amber-700 font-black text-white text-sm shadow-md rounded-xl transition-all"
                    >
                        {isSaving ? (
                            <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        নম্বর সংরক্ষণ করুন ({toBengaliNumber(parsedItems.length)} জন)
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
