'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Student, isFemale, getStudentPlaceholderImage, sanitizePhotoUrl } from '@/lib/student-data';
import { getFeeCollectionsForStudent, FeeCollection, FeeBreakdown } from '@/lib/fees-data';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { useToast } from "@/hooks/use-toast";
import { NewTransactionData, PaymentMethod } from '@/lib/transactions-data';
import { collection, doc, writeBatch, serverTimestamp, Timestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { FilePen, Trash2, Smartphone, Printer, Loader2, Save, AlertCircle, CheckCircle2, Clock, CalendarCheck, Banknote, ListTodo, Wallet, Coins, Star, GraduationCap, ListChecks } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { Skeleton } from './ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DatePicker } from './ui/date-picker';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';
import { MoneyReceipt } from './MoneyReceipt';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const BENGALI_MONTHS = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const classNamesMap: { [key: string]: string } = {
    '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

const toBengaliNumber = (str: string | number) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

const feeFields: { key: keyof FeeBreakdown; label: string }[] = [
    { key: 'tuitionCurrent', label: 'চলতি বেতন' },
    { key: 'tuitionDue', label: 'বকেয়া বেতন' },
    { key: 'tuitionAdvance', label: 'অগ্রিম বেতন' },
    { key: 'tuitionFine', label: 'জরিমানা' },
    { key: 'examFeeHalfYearly', label: 'অর্ধ-বার্ষিক' },
    { key: 'examFeeAnnual', label: 'বার্ষিক ফি' },
    { key: 'examFeePreNirbachoni', label: 'প্রাক-নির্বাচনী' },
    { key: 'examFeeNirbachoni', label: 'নির্বাচনী ফি' },
    { key: 'sessionFee', label: 'সেশন ফি' },
    { key: 'admissionFee', label: 'ভর্তি ফি' },
    { key: 'scoutFee', label: 'স্কাউট ফি' },
    { key: 'developmentFee', label: 'উন্নয়ন ফি' },
    { key: 'libraryFee', label: 'লাইব্রেরি ফি' },
    { key: 'tiffinFee', label: 'টিফিন ফি' },
    { key: 'otherFee', label: 'অন্যান্য ফি' },
];

const feeHeadMapping: { [key in keyof FeeBreakdown]?: string } = {
    tuitionCurrent: 'Tuition Fee',
    tuitionAdvance: 'Tuition Fee',
    tuitionDue: 'Tuition Fee',
    tuitionFine: 'Tuition Fee',
    examFeeHalfYearly: 'Exam Fee',
    examFeeAnnual: 'Exam Fee',
    examFeePreNirbachoni: 'Exam Fee',
    examFeeNirbachoni: 'Exam Fee',
    sessionFee: 'Session Fee',
    admissionFee: 'Admission Fee',
    scoutFee: 'Other',
    developmentFee: 'Other',
    libraryFee: 'Other',
    tiffinFee: 'Other',
    otherFee: 'Other'
};

const emptyBreakdown: FeeBreakdown = {};

function FeeCollectionForm({ student, onSave, existingCollection, open, onOpenChange, paidMonths }: { student: Student, onSave: () => void, existingCollection: FeeCollection | null, open: boolean, onOpenChange: (open: boolean) => void, paidMonths: Set<string> }) {
    const db = useFirestore();
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const { user } = useAuth();
    
    const [collectionDate, setCollectionDate] = useState<Date | undefined>(new Date());
    const [description, setDescription] = useState('');
    const [method, setMethod] = useState<PaymentMethod>('cash');
    const [breakdown, setBreakdown] = useState<FeeBreakdown>(emptyBreakdown);
    const [collectorName, setCollectorName] = useState<string>('');
    const [shouldSendSMS, setShouldSendSMS] = useState(true);
    const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());

    const effectiveMonthlyFee = useMemo(() => {
        if (!student) return 0;
        let fee = student.monthlyFee || 0;
        if (student.feeCategory === 'full-free') return 0;
        if (student.feeCategory === 'half-free') return Math.floor(fee / 2);
        return fee;
    }, [student]);

    useEffect(() => {
        if (!db || !user) return;
        const fetchCollectorName = async () => {
            if (user.role === 'teacher' && user.email) {
                const staffQuery = query(collection(db, 'staff'), where('email', '==', user.email.toLowerCase().trim()), limit(1));
                const staffSnap = await getDocs(staffQuery);
                if (!staffSnap.empty) setCollectorName(staffSnap.docs[0].data().nameBn);
                else setCollectorName(user.displayName || user.email || 'Admin');
            } else setCollectorName(user.displayName || 'Admin');
        };
        fetchCollectorName();
    }, [db, user]);

    useEffect(() => {
        if (open) {
            if (existingCollection) {
                setCollectionDate(new Date(existingCollection.collectionDate));
                setDescription(existingCollection.description);
                setBreakdown(existingCollection.breakdown || {});
                setMethod(existingCollection.method || 'cash');
                const monthsInDesc = new Set<string>();
                BENGALI_MONTHS.forEach(m => { if (existingCollection.description.includes(m)) monthsInDesc.add(m); });
                setSelectedMonths(monthsInDesc);
            } else {
                const today = new Date();
                setCollectionDate(today);
                const currentMonthName = BENGALI_MONTHS[today.getMonth()];
                setDescription(currentMonthName ? `${currentMonthName} মাসের বেতন` : '');
                const initial: FeeBreakdown = {};
                if (effectiveMonthlyFee > 0) initial.tuitionCurrent = effectiveMonthlyFee;
                setBreakdown(initial);
                setMethod('cash');
                setSelectedMonths(new Set([currentMonthName]));
            }
        }
    }, [existingCollection, open, student, effectiveMonthlyFee]);

    const handleMonthToggle = (month: string) => {
        const next = new Set(selectedMonths);
        if (next.has(month)) next.delete(month); else next.add(month);
        setSelectedMonths(next);
        const sortedSelected = BENGALI_MONTHS.filter(m => next.has(m));
        if (sortedSelected.length > 0) {
            setDescription(`${sortedSelected.join(', ')} মাসের বেতন`);
            setBreakdown(prev => ({ ...prev, tuitionCurrent: effectiveMonthlyFee * sortedSelected.length }));
        } else {
            setDescription('');
            setBreakdown(prev => ({ ...prev, tuitionCurrent: 0 }));
        }
    };

    const handleFeeChange = (field: keyof FeeBreakdown, value: string) => {
        const numValue = value === '' ? undefined : parseInt(value, 10);
        setBreakdown(prev => ({ ...prev, [field]: isNaN(numValue!) ? undefined : numValue }));
    };

    const totalAmount = useMemo(() => Object.values(breakdown).reduce((acc, val) => acc + (val || 0), 0), [breakdown]);

    const handleSave = async () => {
        if (!db || !student || !collectionDate || !user) return;
        if (totalAmount <= 0) { toast({ variant: 'destructive', title: 'টাকার পরিমাণ লিখুন' }); return; }

        const batch = writeBatch(db);
        if (existingCollection?.transactionIds) existingCollection.transactionIds.forEach(id => batch.delete(doc(db, 'transactions', id)));

        const feeCollectionId = existingCollection?.id || doc(collection(db, 'feeCollections')).id;
        const transactionsToCreate: { [head: string]: NewTransactionData } = {};
        const newTransactionIds: string[] = [];

        for (const key in breakdown) {
            const amount = breakdown[key as keyof FeeBreakdown];
            if (!amount || amount <= 0) continue;
            const head = feeHeadMapping[key as keyof FeeBreakdown] || 'Other';
            if (!transactionsToCreate[head]) transactionsToCreate[head] = { date: collectionDate, type: 'income', method, accountHead: head, description: `Fee from ${student.studentNameBn}, Roll: ${student.roll.toLocaleString('bn-BD')}`, amount: 0, academicYear: selectedYear, feeCollectionId };
            transactionsToCreate[head].amount += amount;
        }
        
        for (const head in transactionsToCreate) {
            const txRef = doc(collection(db, 'transactions'));
            newTransactionIds.push(txRef.id);
            batch.set(txRef, { ...transactionsToCreate[head], date: Timestamp.fromDate(transactionsToCreate[head].date) });
        }
        
        const feeCollectionData: any = { studentId: student.id, academicYear: selectedYear, collectionDate: Timestamp.fromDate(collectionDate), description, method, totalAmount, breakdown, transactionIds: newTransactionIds, collectorName, collectorUid: user.uid, updatedAt: serverTimestamp() };
        if (existingCollection) batch.update(doc(db, 'feeCollections', feeCollectionId), feeCollectionData);
        else { feeCollectionData.createdAt = serverTimestamp(); batch.set(doc(db, 'feeCollections', feeCollectionId), feeCollectionData); }

        batch.commit().then(() => {
            toast({ title: "ফি আদায় সফল হয়েছে" });
            if (shouldSendSMS && (student.guardianMobile || student.studentMobile)) {
                const msg = `সম্মানিত অভিভাবক, ${student.studentNameBn} এর ${description} বাবদ মোট ${totalAmount.toLocaleString('bn-BD')} টাকা আদায় করা হয়েছে। বীপৌউবি`;
                const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
                window.location.href = `sms:${(student.guardianMobile || student.studentMobile)!.replace(/[^\d+]/g, '')}${isIOS ? '&' : '?'}body=${encodeURIComponent(msg)}`;
            }
            onSave(); onOpenChange(false);
        }).catch(async (serverError: any) => {
            console.error("Batch save error:", serverError);
            const permissionError = new FirestorePermissionError({
                path: 'fee-collection-batch',
                operation: 'write',
                requestResourceData: { feeCollectionId, totalAmount }
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl flex flex-col max-h-[95vh] w-[95vw] font-kalpurush p-0 border-none shadow-2xl overflow-hidden">
                <DialogHeader className="p-6 bg-slate-50 border-b">
                    <DialogTitle className="text-xl font-black">{existingCollection ? 'ফি আদায় এডিট করুন' : 'নতুন ফি আদায়'}</DialogTitle>
                    <DialogDescription className="font-bold text-primary">{student.studentNameBn} (রোল: {student.roll.toLocaleString('bn-BD')})</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
                    <div className="space-y-3">
                        <Label className="font-black text-primary flex items-gap-2"><CalendarCheck className="h-4 w-4" /> কোন কোন মাসের বেতন নিচ্ছেন?</Label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {BENGALI_MONTHS.map(month => {
                                const isSelected = selectedMonths.has(month);
                                const isPaid = paidMonths.has(month) && !existingCollection?.description.includes(month);
                                return (
                                    <Button key={month} type="button" variant="outline" disabled={isPaid} onClick={() => handleMonthToggle(month)} className={cn("h-9 text-[10px] sm:text-xs font-black transition-all", isSelected ? "bg-primary text-white border-primary shadow-md" : "bg-white border-slate-200 text-slate-600", isPaid && "opacity-30 bg-emerald-50 text-emerald-800 border-emerald-100 cursor-not-allowed")}>
                                        {month} {isPaid && <CheckCircle2 className="h-3 w-3 ml-1" />}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="space-y-2"><Label className="font-bold">আদায়ের বিবরণ</Label><Input value={description} onChange={e => setDescription(e.target.value)} className="bg-slate-50 font-bold" /></div>
                        <div className="space-y-2"><Label className="font-bold">আদায়ের তারিখ</Label><DatePicker value={collectionDate} onChange={setCollectionDate} /></div>
                        <div className="space-y-2">
                            <Label className="font-bold">লেনদেনের মাধ্যম</Label>
                            <RadioGroup value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} className="flex items-center space-x-6 pt-2">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="cash" id="fee-cash" /><Label htmlFor="fee-cash" className="font-black">নগদ</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="bank" id="fee-bank" /><Label htmlFor="fee-bank" className="font-black">ব্যাংক</Label></div>
                            </RadioGroup>
                        </div>
                    </div>
                    <div className="space-y-4 border-t pt-6">
                        <Label className="font-black text-lg text-slate-800 border-l-4 border-primary pl-3"> বিস্তারিত হিসাব (Breakdown)</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {feeFields.map(field => (
                                <div key={field.key} className="space-y-1.5 p-3 rounded-lg border-2 border-slate-100 hover:border-primary/20 bg-slate-50/30">
                                    <Label className="font-black text-[10px] uppercase text-muted-foreground">{field.label}</Label>
                                    <div className="relative"><span className="absolute left-2 top-2 text-[10px] font-bold text-slate-400">৳</span><Input type="number" value={breakdown[field.key] || ''} onChange={(e) => handleFeeChange(field.key, e.target.value)} className="h-8 pl-5 font-black text-right" /></div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-primary/5 p-5 rounded-2xl border-2 border-dashed border-primary/20">
                        <div className="flex items-center space-x-3"><Checkbox id="send-sms" checked={shouldSendSMS} onCheckedChange={(c) => setShouldSendSMS(!!c)} /><Label htmlFor="send-sms" className="cursor-pointer text-sm font-black text-primary">সেভ করার পর ফোনে কনফার্মেশন মেসেজ ড্রাফট করুন</Label></div>
                        <div className="text-[10px] font-black text-muted-foreground">আদায়কারী: {collectorName || '...'}</div>
                    </div>
                </div>
                <DialogFooter className="p-6 bg-slate-50 border-t sticky bottom-0">
                    <div className="flex flex-col sm:flex-row justify-between w-full items-center gap-6">
                        <div className="text-center sm:text-left"><p className="text-xs font-bold text-muted-foreground uppercase mb-1">সর্বমোট আদায়যোগ্য টাকা</p><p className="font-black text-3xl text-primary">{totalAmount.toLocaleString('bn-BD')} ৳</p></div>
                        <div className="flex gap-3 w-full sm:w-auto"><Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 font-bold h-12">বাতিল</Button><Button onClick={handleSave} className="flex-1 min-w-[180px] font-black h-12 text-lg shadow-xl">{shouldSendSMS ? 'সেভ ও মেসেজ' : 'শুধুমাত্র সেভ'}</Button></div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function StudentFeeDialog({ student, open, onOpenChange, onFeeCollected }: { student: Student | null, open: boolean, onOpenChange: (open: boolean) => void, onFeeCollected: () => void }) {
    const db = useFirestore();
    const { schoolInfo } = useSchoolInfo();
    const { selectedYear } = useAcademicYear();
    const { toast } = useToast();
    const { hasPermission } = useAuth();
    
    const canEdit = hasPermission('special:edit-transaction');
    const canDelete = hasPermission('special:delete-transaction');

    const [feeCollections, setFeeCollections] = useState<FeeCollection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCollection, setEditingCollection] = useState<FeeCollection | null>(null);
    const [printingCollection, setPrintingCollection] = useState<FeeCollection | null>(null);
    
    const fetchFeeData = useCallback(async () => {
        if (!db || !student?.id) return;
        setIsLoading(true);
        const collections = await getFeeCollectionsForStudent(db, student.id, selectedYear);
        setFeeCollections(collections);
        setIsLoading(false);
    }, [db, student?.id, selectedYear]);

    useEffect(() => { if (open && student?.id) fetchFeeData(); }, [open, student?.id, fetchFeeData]);

    const paidMonths = useMemo(() => {
        const months = new Set<string>();
        feeCollections.forEach(c => BENGALI_MONTHS.forEach(m => { if (c.description?.includes(m)) months.add(m); }));
        return months;
    }, [feeCollections]);

    const duesSummary = useMemo(() => {
        if (!student) return { tuitionDue: 0, tuitionDueMonths: [], examDues: [], otherDues: 0 };
        
        let effectiveMonthlyFee = student.monthlyFee || 0;
        if (student.feeCategory === 'half-free') effectiveMonthlyFee = Math.floor(effectiveMonthlyFee / 2);
        else if (student.feeCategory === 'full-free') effectiveMonthlyFee = 0;

        const currentMonthIdx = new Date().getMonth();
        const tuitionDueMonths = BENGALI_MONTHS.filter((m, idx) => idx <= currentMonthIdx && !paidMonths.has(m));
        const tuitionDueAmount = tuitionDueMonths.length * effectiveMonthlyFee;
        
        const examDues: any[] = [];
        const paidCats = new Set<string>();
        feeCollections.forEach(c => c.breakdown && Object.entries(c.breakdown).forEach(([k, v]) => { if (v && v > 0) paidCats.add(k); }));
        
        [{ key: 'examFeeHalfYearly', label: 'অর্ধ-বার্ষিক' }, { key: 'examFeeAnnual', label: 'বার্ষিক' }, { key: 'examFeePreNirbachoni', label: 'প্রাক-নির্বাচনী' }, { key: 'examFeeNirbachoni', label: 'নির্বাচনী' }].forEach(ex => {
            const val = student[ex.key as keyof Student] as number;
            if (val && val > 0 && !paidCats.has(ex.key)) examDues.push({ label: ex.label, amount: val });
        });
        
        let otherDues = 0;
        ['sessionFee', 'admissionFee', 'scoutFee', 'developmentFee', 'libraryFee', 'tiffinFee', 'otherFee'].forEach(k => {
            const val = student[k as keyof Student] as number;
            if (val && val > 0 && !paidCats.has(k)) otherDues += val;
        });
        return { tuitionDue: tuitionDueAmount, tuitionDueMonths, examDues, otherDues };
    }, [student, paidMonths, feeCollections]);

    const handlePrint = (collection: FeeCollection) => {
        setPrintingCollection(collection);
        setTimeout(() => { window.print(); setPrintingCollection(null); }, 300);
    };

    const handleDelete = async (collection: FeeCollection) => {
        if(!db || !canDelete) return;
        const batch = writeBatch(db);
        batch.delete(doc(db, 'feeCollections', collection.id));
        if (collection.transactionIds) collection.transactionIds.forEach(id => batch.delete(doc(db, 'transactions', id)));
        batch.commit().then(() => { toast({title: "মুছে ফেলা হয়েছে"}); fetchFeeData(); onFeeCollected(); }).catch((serverError: any) => {
             const permissionError = new FirestorePermissionError({
                path: 'fee-collection-batch-delete',
                operation: 'delete',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
    };
    
    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl flex flex-col max-h-[95vh] w-[95vw] no-print font-kalpurush p-0 border-none shadow-2xl overflow-hidden rounded-2xl">
                <DialogHeader className="p-6 bg-primary text-white shrink-0">
                    <div className="flex flex-col md:flex-row items-center gap-5">
                        {isLoading || !student ? <Skeleton className="h-20 w-20 rounded-full bg-white/20" /> : <Avatar className="h-20 w-20 border-4 border-white shadow-xl"><AvatarImage src={sanitizePhotoUrl(student.photoUrl, student.gender) || getStudentPlaceholderImage(student.gender)} /></Avatar>}
                        <div className="flex-1 text-center md:text-left">
                            <DialogTitle className="text-2xl sm:text-3xl font-black">বেতন আদায়ের তথ্য</DialogTitle>
                            {student && (
                                <div className="space-y-1">
                                    <DialogDescription className="text-md font-bold text-white/90">{student.studentNameBn} (রোল: {toBengaliNumber(student.roll)})</DialogDescription>
                                    <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-1">
                                        <Badge variant="secondary" className="bg-white/20 text-white font-black">
                                            ক্যাটাগরি: {student.feeCategory === 'half-free' ? 'হাফ-ফ্রি' : student.feeCategory === 'full-free' ? 'ফুল-ফ্রি' : 'সাধারণ'}
                                        </Badge>
                                        {student.isStipendReceiver && <Badge className="bg-yellow-400 text-yellow-950 font-black"><Star className="h-3 w-3" /> উপবৃত্তিপ্রাপ্ত</Badge>}
                                    </div>
                                </div>
                            )}
                        </div>
                        <Button onClick={() => { setEditingCollection(null); setIsFormOpen(true); }} size="lg" className="bg-white text-primary hover:bg-slate-100 font-black shadow-lg">নতুন আদায়</Button>
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 bg-slate-50/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-[3px] border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,0.1)]">
                            <CardHeader className="p-4 bg-rose-50 border-b-2 border-black"><CardTitle className="text-sm font-black flex items-center gap-2 text-rose-700"><Clock className="h-4 w-4" /> বকেয়া বেতন</CardTitle></CardHeader>
                            <CardContent className="p-4">
                                <p className="text-2xl font-black text-rose-900">{toBengaliNumber(duesSummary.tuitionDue)} ৳</p>
                                <p className="text-[10px] font-bold text-muted-foreground mt-2 line-clamp-1">বকেয়া: {duesSummary.tuitionDueMonths.join(', ') || 'নেই'}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-[3px] border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,0.1)]">
                            <CardHeader className="p-4 bg-amber-50 border-b-2 border-black"><CardTitle className="text-sm font-black flex items-center gap-2 text-amber-700"><ListTodo className="h-4 w-4" /> পরীক্ষার ফি</CardTitle></CardHeader>
                            <CardContent className="p-4">
                                <p className="text-2xl font-black text-amber-900">{toBengaliNumber(duesSummary.examDues.reduce((a, d) => a + d.amount, 0))} ৳</p>
                                <p className="text-[10px] font-bold text-muted-foreground mt-2 line-clamp-1">বাকি: {duesSummary.examDues.map(d => d.label).join(', ') || 'নেই'}</p>
                            </CardContent>
                        </Card>
                        <Card className="border-[3px] border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,0.1)]">
                            <CardHeader className="p-4 bg-indigo-50 border-b-2 border-black"><CardTitle className="text-sm font-black flex items-center gap-2 text-indigo-700"><Wallet className="h-4 w-4" /> অন্যান্য ফি</CardTitle></CardHeader>
                            <CardContent className="p-4">
                                <p className="text-2xl font-black text-indigo-900">{toBengaliNumber(duesSummary.otherDues)} ৳</p>
                                <p className="text-[10px] font-bold text-muted-foreground mt-2">সেশন ও দাপ্তরিক ফি সমূহ</p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="bg-white border-[4px] border-black rounded-[32px] p-6 sm:p-8 shadow-[8px_8px_0px_rgba(0,0,0,0.1)]">
                        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><CalendarCheck className="h-5 w-5 text-primary" /> মাসিক পরিশোধের অবস্থা ({toBengaliNumber(selectedYear)})</h3>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            {BENGALI_MONTHS.map((month, idx) => {
                                const isPaid = paidMonths.has(month);
                                const isCur = idx <= new Date().getMonth();
                                return (
                                    <div key={month} className={cn("flex flex-col items-center justify-center w-full p-3 rounded-2xl border-2 transition-all duration-300", isPaid ? "bg-emerald-50 border-emerald-500/30 text-emerald-800" : isCur ? "bg-rose-50 border-rose-500/30 text-rose-800" : "bg-slate-50 border-slate-200 text-slate-400 opacity-60")}>
                                        <span className="text-[11px] font-black leading-none mb-2">{month}</span>
                                        <Badge className={cn("h-5 text-[9px] font-black border-none px-3", isPaid ? "bg-emerald-600" : isCur ? "bg-rose-600" : "bg-slate-300")}>{isPaid ? 'Paid' : 'Due'}</Badge>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="table-container !border-2 !border-black shadow-xl">
                        <Table className="min-w-[800px]">
                            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-md z-10"><TableRow className="border-b-2 border-black"><TableHead className="font-black text-black text-center">আদায়ের তারিখ</TableHead><TableHead className="font-black text-black">বিবরণ</TableHead><TableHead className="text-center font-black text-black">পদ্ধতি</TableHead><TableHead className="text-right font-black text-emerald-950">মোট টাকা</TableHead><TableHead className="text-center font-black text-black">রসিদ</TableHead><TableHead className="text-right font-black text-black pr-6">কার্যক্রম</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {feeCollections.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-20 italic">এখনও কোনো ফি আদায় করা হয়নি।</TableCell></TableRow> : feeCollections.map(c => (
                                    <TableRow key={c.id} className="hover:bg-primary/5 h-14">
                                        <TableCell className="text-center font-bold text-slate-600">{toBengaliNumber(format(c.collectionDate, "dd/MM/yyyy"))}</TableCell>
                                        <TableCell className="font-black text-slate-800">{c.description}</TableCell>
                                        <TableCell className="text-center"><Badge variant="outline" className={cn("text-[10px] font-black", c.method === 'bank' ? "border-blue-200 text-blue-700 bg-blue-50" : "border-amber-200 text-amber-700 bg-amber-50")}>{c.method === 'bank' ? 'Bank' : 'Cash'}</Badge></TableCell>
                                        <TableCell className="text-right font-black text-emerald-700 text-lg">{toBengaliNumber(c.totalAmount ?? 0)} ৳</TableCell>
                                        <TableCell className="text-center"><Button variant="ghost" size="icon" onClick={() => handlePrint(c)}><Printer className="h-5 w-5" /></Button></TableCell>
                                        <TableCell className="text-right pr-6"><div className="flex gap-1.5 justify-end">{canEdit && <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600" onClick={() => { setEditingCollection(c); setIsFormOpen(true); }}><FilePen className="h-4 w-4" /></Button>}{canDelete && <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent className="font-kalpurush"><AlertDialogHeader><AlertDialogTitle>মুছে ফেলতে চান?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>না</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(c)} className="bg-destructive font-black">হ্যাঁ</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
                <DialogFooter className="p-4 bg-white border-t"><DialogClose asChild><Button variant="outline" className="font-black h-10 px-10 border-2">বন্ধ করুন</Button></DialogClose></DialogFooter>
                {student && <FeeCollectionForm student={student} onSave={() => { fetchFeeData(); onFeeCollected(); }} existingCollection={editingCollection} open={isFormOpen} onOpenChange={setIsFormOpen} paidMonths={paidMonths} />}
            </DialogContent>
        </Dialog>
        {student && printingCollection && <div className="hidden print:block printable-area bg-white"><div className="flex items-center justify-center min-h-[297mm]"><MoneyReceipt collection={printingCollection} student={student} schoolInfo={schoolInfo} /></div></div>}
        </>
    );
}

function Avatar({ children, className }: { children: React.ReactNode, className?: string }) { return <div className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}>{children}</div>; }
function AvatarImage({ src }: { src?: string }) { return src ? <img src={src} className="aspect-square h-full w-full" alt="avatar" /> : null; }
function AvatarFallback({ children, className }: { children: React.ReactNode, className?: string }) { return <div className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}>{children}</div>; }