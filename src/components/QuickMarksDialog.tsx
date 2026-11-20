
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { FilePen, Loader2, Save, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react';
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
    written?: number;
    mcq?: number;
    practical?: number;
    studentName?: string;
    studentId?: string;
}

interface SubjectLimits {
    writtenLimit: number;
    mcqLimit: number;
    practicalLimit: number;
    fullMarks: number;
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
    const { user } = useAuth();

    const [isOpen, setIsOpen] = useState(false);
    const [exams, setExams] = useState<Exam[]>([]);
    const [examName, setExamName] = useState(initialExam || 'অর্ধ-বার্ষিক পরীক্ষা');
    const [className, setClassName] = useState(initialClass || '6');
    const [group, setGroup] = useState(initialGroup || 'all');
    const [subject, setSubject] = useState(initialSubject || '');
    const [rawInput, setRawInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [classStudents, setClassStudents] = useState<Student[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(false);

    // Subject limits loaded from Firebase or derived from subject info
    const [subjectLimits, setSubjectLimits] = useState<SubjectLimits | null>(null);
    const [isLoadingLimits, setIsLoadingLimits] = useState(false);

    // Conflict / overwrite state
    const [existingCount, setExistingCount] = useState(0);
    const [isConfirmingOverwrite, setIsConfirmingOverwrite] = useState(false);

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

    // Reset conflict state when key selectors change
    useEffect(() => {
        setIsConfirmingOverwrite(false);
        setExistingCount(0);
        setSubjectLimits(null);
    }, [examName, className, group, subject]);

    // Load students for current class
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

    // Load subject limits from Firebase (or derive from subject info)
    const loadSubjectLimits = useCallback(async () => {
        if (!db || !selectedYear || !examName || !className || !subject) return;
        setIsLoadingLimits(true);
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
            const subInfo = availableSubjects.find(s => s.name === subject);
            const isIct = normSub.includes('তথ্য ও যোগাযোগ') || normSub.includes('আইসিটি') || normSub.toLowerCase() === 'ict';
            const defaultFull = subInfo?.fullMarks || (isIct ? 100 : 100);

            if (snap.exists()) {
                const data = snap.data() as ClassResult;
                setExistingCount(data.results?.length || 0);
                setSubjectLimits({
                    writtenLimit: data.writtenLimit ?? (subInfo?.practical ? 70 : defaultFull),
                    mcqLimit: data.mcqLimit ?? (isIct ? 25 : (subInfo?.practical ? 30 : 0)),
                    practicalLimit: data.practicalLimit ?? (isIct ? 25 : (subInfo?.practical ? 25 : 0)),
                    fullMarks: data.fullMarks ?? defaultFull
                });
            } else {
                setExistingCount(0);
                // Derive from subject info
                const mcqLimit = isIct ? 25 : (subInfo?.practical ? 30 : 0);
                const practicalLimit = isIct ? 25 : (subInfo?.practical ? 25 : 0);
                const writtenLimit = isIct ? 50 : (subInfo?.practical ? 70 : defaultFull);
                setSubjectLimits({ writtenLimit, mcqLimit, practicalLimit, fullMarks: defaultFull });
            }
        } catch (err) {
            console.error('Error loading subject limits:', err);
        } finally {
            setIsLoadingLimits(false);
        }
    }, [db, selectedYear, examName, className, group, subject, availableSubjects]);

    useEffect(() => {
        if (isOpen && subject && examName && className) {
            loadSubjectLimits();
        }
    }, [isOpen, subject, examName, className, group]);

    // Parse multi-field input: রোল-লিখিত-বহুনিবাচনী-ব্যাবহারিক
    const parsedItems: ParsedItem[] = useMemo(() => {
        if (!rawInput.trim()) return [];
        const normalized = toEnglishDigits(rawInput);

        // Split by commas or newlines to get individual entries
        const entries = normalized.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);

        const map = new Map<number, { written?: number; mcq?: number; practical?: number }>();

        for (const entry of entries) {
            // Match: roll[-written[-mcq[-practical]]]
            // Note: regex built dynamically to avoid Tailwind scanning the literal class
            const sepPattern = new RegExp('[' + String.fromCharCode(45) + ':=]');
            const parts = entry.split(sepPattern).map(p => p.trim()).filter(Boolean);
            const nums = parts.map(p => parseInt(p, 10)).filter(n => !isNaN(n));
            if (nums.length >= 1) {
                const roll = nums[0];
                if (roll <= 0) continue;
                const existing = map.get(roll) || {};
                if (nums.length >= 2) existing.written = nums[1];
                if (nums.length >= 3) existing.mcq = nums[2];
                if (nums.length >= 4) existing.practical = nums[3];
                map.set(roll, existing);
            }
        }

        const items: ParsedItem[] = [];
        map.forEach((marks, roll) => {
            const st = classStudents.find(s => s.roll === roll);
            items.push({
                roll,
                written: marks.written,
                mcq: marks.mcq,
                practical: marks.practical,
                studentName: st?.studentNameBn || st?.studentNameEn || '',
                studentId: st?.id
            });
        });

        return items.sort((a, b) => a.roll - b.roll);
    }, [rawInput, classStudents]);

    // Validation warnings based on subject limits
    const validationWarnings = useMemo(() => {
        const warnings: string[] = [];
        if (!subjectLimits) return warnings;

        const hasUserMcq = parsedItems.some(i => i.mcq !== undefined);
        const hasUserPractical = parsedItems.some(i => i.practical !== undefined);

        if (hasUserMcq && subjectLimits.mcqLimit === 0) {
            warnings.push('এই বিষয়ে বহুনিবাচনী (MCQ) নেই, তাই বহুনিবাচনী নম্বর সংরক্ষণ করা হবে না।');
        }
        if (hasUserPractical && subjectLimits.practicalLimit === 0) {
            warnings.push('এই বিষয়ে ব্যবহারিক নেই, তাই ব্যবহারিক নম্বর সংরক্ষণ করা হবে না।');
        }
        return warnings;
    }, [parsedItems, subjectLimits]);

    // Submit handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !selectedYear || !examName || !className || !subject) {
            toast({ variant: 'destructive', title: 'পরীক্ষা, শ্রেণি ও বিষয় নির্বাচন করুন' });
            return;
        }

        if (parsedItems.length === 0) {
            toast({ variant: 'destructive', title: 'কোনো তথ্য পাওয়া যায়নি', description: '\"রোল-লিখিত-বহুনিবাচনী-ব্যবহারিক\" ফরম্যাটে লিখুন।' });
            return;
        }

        // If existing data and not yet confirmed → show confirmation
        if (existingCount > 0 && !isConfirmingOverwrite) {
            setIsConfirmingOverwrite(true);
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
                    if (item.written !== undefined) current.written = item.written;
                    // Only save MCQ if subject supports it
                    if (item.mcq !== undefined && (subjectLimits?.mcqLimit ?? 0) > 0) {
                        current.mcq = item.mcq;
                    }
                    // Only save practical if subject supports it
                    if (item.practical !== undefined && (subjectLimits?.practicalLimit ?? 0) > 0) {
                        current.practical = item.practical;
                    }
                    resultsMap.set(stId, current);
                    appliedCount++;
                } else {
                    unmappedRolls.push(item.roll);
                }
            });

            const subInfo = availableSubjects.find(s => s.name === subject);
            const isIct = normSub.includes('তথ্য ও যোগাযোগ') || normSub.includes('আইসিটি') || normSub.toLowerCase() === 'ict';
            const defaultFull = subInfo?.fullMarks || (isIct ? 100 : 100);

            const payload: ClassResult = {
                academicYear: selectedYear,
                examName,
                className,
                group: effectiveGroup || undefined,
                subject: normSub,
                fullMarks: existingData?.fullMarks || defaultFull,
                writtenLimit: existingData?.writtenLimit ?? (subjectLimits?.writtenLimit ?? (subInfo?.practical ? 70 : defaultFull)),
                mcqLimit: existingData?.mcqLimit ?? (subjectLimits?.mcqLimit ?? (isIct ? 25 : (subInfo?.practical ? 30 : 0))),
                practicalLimit: existingData?.practicalLimit ?? (subjectLimits?.practicalLimit ?? (isIct ? 25 : (subInfo?.practical ? 25 : 0))),
                results: Array.from(resultsMap.values())
            };

            await saveClassResults(db, payload);

            toast({
                title: 'কুইক নম্বর ইনপুট সফল হয়েছে!',
                description: `${appliedCount} জন শিক্ষার্থীর নম্বর সংরক্ষিত হয়েছে (${classNamesMap[className]} শ্রেণি - ${subject})।${unmappedRolls.length > 0 ? ` [রোল ${unmappedRolls.join(', ')} শ্রেণির তালিকায় মেলেনি]` : ''}`
            });

            setRawInput('');
            setIsOpen(false);
            setIsConfirmingOverwrite(false);
            setExistingCount(0);
            if (onSaveSuccess) onSaveSuccess();
        } catch (err: any) {
            console.error('Error saving quick marks:', err);
            toast({ variant: 'destructive', title: 'নম্বর সংরক্ষণ ব্যর্থ হয়েছে', description: err?.message });
        } finally {
            setIsSaving(false);
        }
    };

    const hasMcq = (subjectLimits?.mcqLimit ?? 0) > 0;
    const hasPractical = (subjectLimits?.practicalLimit ?? 0) > 0;

    const formatHint = useMemo(() => {
        const parts = ['রোল', 'লিখিত'];
        if (hasMcq) parts.push('বহুনিবাচনী');
        if (hasPractical) parts.push('ব্যবহারিক');
        return parts.join('-');
    }, [hasMcq, hasPractical]);

    const exampleHint = useMemo(() => {
        if (hasMcq && hasPractical) return 'যেমন: ১-৮৫-২৫-২০, ২-৭৮-২২-১৮';
        if (hasMcq) return 'যেমন: ১-৮৫-২৫, ২-৭৮-২২';
        if (hasPractical) return 'যেমন: ১-৮৫-২০, ২-৭৮-১৮';
        return 'যেমন: ১-৮৫, ২-৭৮, ৩-৯২';
    }, [hasMcq, hasPractical]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            setIsOpen(open);
            if (!open) {
                setRawInput('');
                setIsConfirmingOverwrite(false);
                setExistingCount(0);
            }
        }}>
            <DialogTrigger asChild>
                {triggerButton || (
                    <Button className="h-12 w-full sm:w-auto px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 shadow-lg font-black gap-2 transition-all border-b-4 border-amber-800 active:border-b-0 active:translate-y-1 text-white text-xs sm:text-sm">
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
                        শ্রেণি, বিষয় ও পরীক্ষা সিলেক্ট করে একসাথে সবার লিখিত-বহুনিবাচনী-ব্যবহারিক নম্বর ইনপুট করুন।
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="p-5 space-y-4">
                    {/* Exam, Class Row */}
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
                                        <SelectItem value="commerce" className="font-bold text-xs">ব্যবসায় শিক্ষা</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className={cn("space-y-1", !showGroupSelector && "sm:col-span-2")}>
                            <Label className="text-xs font-black text-slate-700">বিষয়</Label>
                            <Select value={subject} onValueChange={setSubject}>
                                <SelectTrigger className="h-10 border-2 font-black text-xs bg-white">
                                    <SelectValue placeholder="বিষয় নির্বাচন করুন" />
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

                    {/* Subject Limits Info Bar */}
                    {subjectLimits && !isLoadingLimits && (
                        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold">
                            <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded-lg border border-blue-200">
                                লিখিত: {toBengaliNumber(subjectLimits.writtenLimit)}
                            </span>
                            {subjectLimits.mcqLimit > 0 && (
                                <span className="bg-purple-100 text-purple-900 px-2 py-0.5 rounded-lg border border-purple-200">
                                    বহুনিবাচনী: {toBengaliNumber(subjectLimits.mcqLimit)}
                                </span>
                            )}
                            {subjectLimits.practicalLimit > 0 && (
                                <span className="bg-green-100 text-green-900 px-2 py-0.5 rounded-lg border border-green-200">
                                    ব্যবহারিক: {toBengaliNumber(subjectLimits.practicalLimit)}
                                </span>
                            )}
                            {!subjectLimits.mcqLimit && !subjectLimits.practicalLimit && (
                                <span className="text-slate-500 text-[10px]">শুধু লিখিত নম্বর গ্রহণযোগ্য</span>
                            )}
                        </div>
                    )}
                    {isLoadingLimits && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-bold">
                            <Loader2 className="h-3 w-3 animate-spin" /> বিষয়ের তথ্য লোড হচ্ছে...
                        </div>
                    )}

                    {/* Quick Marks Input Textarea */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-black text-slate-800">
                                নম্বর ইনপুট করুন
                            </Label>
                            <span className="text-[11px] font-bold text-amber-800">
                                ফরম্যাট: {formatHint}
                            </span>
                        </div>
                        <Textarea
                            rows={4}
                            value={rawInput}
                            onChange={e => {
                                setRawInput(e.target.value);
                                setIsConfirmingOverwrite(false);
                            }}
                            placeholder={exampleHint + '...'}
                            className="font-black text-sm border-2 border-amber-300 focus-visible:ring-amber-500 bg-white placeholder:text-slate-400 placeholder:font-normal leading-relaxed"
                        />
                        <p className="text-[10px] font-bold text-slate-500">
                            * কমা (,) বা নতুন লাইনে হাইফেন (-) দিয়ে আলাদা করুন। বাংলা ও ইংরেজি উভয় সংখ্যা সমর্থিত।
                        </p>
                    </div>

                    {/* Validation Warnings */}
                    {validationWarnings.length > 0 && (
                        <div className="bg-orange-50 border border-orange-300 rounded-xl p-3 space-y-1">
                            {validationWarnings.map((w, i) => (
                                <div key={i} className="flex items-start gap-2 text-[11px] font-bold text-orange-900">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-orange-600" />
                                    {w}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Live Preview Badges */}
                    {parsedItems.length > 0 && (
                        <div className="bg-emerald-50/80 p-3 rounded-xl border border-emerald-300 space-y-2">
                            <div className="flex items-center justify-between text-xs font-black text-emerald-950">
                                <span className="flex items-center gap-1">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    মোট শনাক্ত: {toBengaliNumber(parsedItems.length)} জন
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                                {parsedItems.map((item) => (
                                    <span
                                        key={item.roll}
                                        className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-emerald-300 text-emerald-950 shadow-2xs"
                                    >
                                        <span className="font-black">রোল {toBengaliNumber(item.roll)}:</span>
                                        {item.written !== undefined && (
                                            <span className="text-blue-800 font-black">লি.{toBengaliNumber(item.written)}</span>
                                        )}
                                        {item.mcq !== undefined && hasMcq && (
                                            <span className="text-purple-800 font-black">MCQ.{toBengaliNumber(item.mcq)}</span>
                                        )}
                                        {item.practical !== undefined && hasPractical && (
                                            <span className="text-green-800 font-black">ব্য.{toBengaliNumber(item.practical)}</span>
                                        )}
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

                    {/* Overwrite Confirmation Warning */}
                    {isConfirmingOverwrite && existingCount > 0 && (
                        <div className="bg-yellow-50 border-2 border-yellow-400 rounded-xl p-3 flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-yellow-700" />
                            <div className="text-xs font-black text-yellow-900">
                                এই বিষয়ে ইতিমধ্যে {toBengaliNumber(existingCount)} জনের নম্বর এন্ট্রি রয়েছে।
                                পুনরায় সেভ করতে নিচের বোতামে আবার ক্লিক করুন (নতুন তথ্য মার্জ হবে, পুরোনো মুছবে না)।
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        disabled={isSaving || parsedItems.length === 0}
                        className={cn(
                            "w-full h-11 font-black text-white text-sm shadow-md rounded-xl transition-all",
                            isConfirmingOverwrite
                                ? "bg-yellow-600 hover:bg-yellow-700"
                                : "bg-amber-600 hover:bg-amber-700"
                        )}
                    >
                        {isSaving ? (
                            <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        {isConfirmingOverwrite
                            ? `পুনরায় সংরক্ষণ নিশ্চিত করুন (${toBengaliNumber(parsedItems.length)} জন)`
                            : `নম্বর সংরক্ষণ করুন (${toBengaliNumber(parsedItems.length)} জন)`
                        }
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
