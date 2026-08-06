
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
import { collection, doc, writeBatch, serverTimestamp, Timestamp, WithFieldValue, DocumentData, query, where, getDocs, limit } from 'firebase/firestore';
import { FilePen, Trash2, Smartphone, Printer, Loader2, Save, AlertCircle, CheckCircle2, Clock, CalendarCheck, Banknote, ListTodo, Wallet, Coins } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
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
    tiffinFee: 'Other'
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

    useEffect(() => {
        if (!db || !user) return;

        const fetchCollectorName = async () => {
            if (user.role === 'teacher' && user.email) {
                const staffQuery = query(collection(db, 'staff'), where('email', '==', user.email.toLowerCase().trim()), limit(1));
                const staffSnap = await getDocs(staffQuery);
                if (!staffSnap.empty) {
                    setCollectorName(staffSnap.docs[0].data().nameBn);
                } else {
                    setCollectorName(user.displayName || user.email || 'Admin');
                }
            } else {
                setCollectorName(user.displayName || 'Admin');
            }
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
                BENGALI_MONTHS.forEach(m => {
                    if (existingCollection.description.includes(m)) monthsInDesc.add(m);
                });
                setSelectedMonths(monthsInDesc);
            } else {
                const today = new Date();
                setCollectionDate(today);
                const currentMonthIndex = today.getMonth();
                const currentMonthName = BENGALI_MONTHS[currentMonthIndex];
                setDescription(currentMonthName ? `${currentMonthName} মাসের বেতন` : '');
                
                // Prefill breakdown if setup exists
                const initial: FeeBreakdown = {};
                if (student.monthlyFee) initial.tuitionCurrent = student.monthlyFee;
                setBreakdown(initial);
                
                setMethod('cash');
                setSelectedMonths(new Set([currentMonthName]));
            }
        }
    }, [existingCollection, open, student]);

    const handleMonthToggle = (month: string) => {
        const next = new Set(selectedMonths);
        if (next.has(month)) next.delete(month);
        else next.add(month);
        
        setSelectedMonths(next);
        
        const sortedSelected = BENGALI_MONTHS.filter(m => next.has(m));
        if (sortedSelected.length > 0) {
            setDescription(`${sortedSelected.join(', ')} মাসের বেতন`);
            // Update total tuition based on number of months
            if (student.monthlyFee) {
                setBreakdown(prev => ({ ...prev, tuitionCurrent: student.monthlyFee! * sortedSelected.length }));
            }
        } else {
            setDescription('');
        }
    };

    const handleFeeChange = (field: keyof FeeBreakdown, value: string) => {
        const numValue = value === '' ? undefined : parseInt(value, 10);
        setBreakdown(prev => ({ ...prev, [field]: isNaN(numValue!) ? undefined : numValue }));
    };

    const totalAmount = useMemo(() => {
        return Object.values(breakdown).reduce((acc, val) => acc + (val || 0), 0);
    }, [breakdown]);

     const handleSave = async () => {
        if (!db || !student || !collectionDate || !user) {
            toast({ variant: 'destructive', title: 'প্রয়োজনীয় তথ্য পূরণ করুন' });
            return;
        }
        if (totalAmount <= 0) {
            toast({ variant: 'destructive', title: 'টাকার পরিমাণ লিখুন', description: 'মোট আদায় অবশ্যই শূন্যের বেশি হতে হবে।' });
            return;
        }

        const batch = writeBatch(db);

        if (existingCollection && existingCollection.transactionIds) {
            existingCollection.transactionIds.forEach(id => {
                const transRef = doc(db, 'transactions', id);
                batch.delete(transRef);
            });
        }

        const feeCollectionId = existingCollection?.id || doc(collection(db, 'feeCollections')).id;
        
        const transactionsToCreate: { [head: string]: NewTransactionData } = {};
        const newTransactionIds: string[] = [];

        for (const key in breakdown) {
            const feeKey = key as keyof FeeBreakdown;
            const amount = breakdown[feeKey];
            if (!amount || amount <= 0) continue;

            const accountHead = feeHeadMapping[feeKey] || 'Other';
            if (!transactionsToCreate[accountHead]) {
                transactionsToCreate[accountHead] = {
                    date: collectionDate,
                    type: 'income',
                    method,
                    accountHead: accountHead,
                    description: `Fee from ${student.studentNameBn}, Roll: ${student.roll.toLocaleString('bn-BD')}`,
                    amount: 0,
                    academicYear: selectedYear,
                    feeCollectionId: feeCollectionId
                };
            }
            transactionsToCreate[accountHead].amount += amount;
        }
        
        for (const head in transactionsToCreate) {
            const txRef = doc(collection(db, 'transactions'));
            newTransactionIds.push(txRef.id);
            const data = { ...transactionsToCreate[head], date: Timestamp.fromDate(transactionsToCreate[head].date) };
            batch.set(txRef, data);
        }
        
        const feeCollectionRef = doc(db, 'feeCollections', feeCollectionId);

        const feeCollectionData: WithFieldValue<DocumentData> = {
            studentId: student.id,
            academicYear: selectedYear,
            collectionDate: Timestamp.fromDate(collectionDate),
            description,
            method,
            totalAmount,
            breakdown,
            transactionIds: newTransactionIds,
            collectorName: collectorName || user.email || 'System',
            collectorUid: user.uid,
            updatedAt: serverTimestamp(),
        };

        if (existingCollection) {
            batch.update(feeCollectionRef, feeCollectionData);
        } else {
            feeCollectionData.createdAt = serverTimestamp();
            batch.set(feeCollectionRef, feeCollectionData);
        }

        try {
            await batch.commit();
            toast({ title: "ফি আদায় সফল হয়েছে", description: `শিক্ষার্থীর ফি এবং ক্যাশবুক সফলভাবে আপডেট করা হয়েছে।` });
            
            if (shouldSendSMS) {
                const mobile = student.guardianMobile || student.studentMobile || '';
                if (mobile) {
                    const cleanNumber = mobile.replace(/[^\d+]/g, '');
                    const msg = `সম্মানিত অভিভাবক, ${student.studentNameBn} এর ${description} বাবদ মোট ${totalAmount.toLocaleString('bn-BD')} টাকা আদায় করা হয়েছে। বীপৌউবি`;
                    const encodedMsg = encodeURIComponent(msg);
                    
                    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
                    const separator = isIOS ? '&' : '?';
                    const smsUrl = `sms:${cleanNumber}${separator}body=${encodedMsg}`;
                    
                    setTimeout(() => {
                        window.location.href = smsUrl;
                    }, 500);
                }
            }

            onSave();
            onOpenChange(false);
        } catch (error) {
            console.error(error);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl flex flex-col max-h-[95vh] w-[95vw] font-kalpurush p-0 border-none shadow-2xl overflow-hidden">
                <DialogHeader className="p-6 bg-slate-50 border-b">
                    <DialogTitle className="text-xl font-black">{existingCollection ? 'ফি আদায় এডিট করুন' : 'নতুন ফি আদায়'}</DialogTitle>
                    <DialogDescription className="font-bold text-primary">
                        {student.studentNameBn} (রোল: {student.roll.toLocaleString('bn-BD')}) এর জন্য ফি আদায় করুন।
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
                    {/* Month Multi-Select Grid */}
                    <div className="space-y-3">
                        <Label className="font-black text-primary flex items-center gap-2">
                            <CalendarCheck className="h-4 w-4" /> কোন কোন মাসের বেতন নিচ্ছেন? (সিলেক্ট করুন)
                        </Label>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                            {BENGALI_MONTHS.map(month => {
                                const isSelected = selectedMonths.has(month);
                                const isPaid = paidMonths.has(month) && !existingCollection?.description.includes(month);
                                return (
                                    <Button
                                        key={month}
                                        type="button"
                                        variant="outline"
                                        disabled={isPaid}
                                        onClick={() => handleMonthToggle(month)}
                                        className={cn(
                                            "h-9 text-[10px] sm:text-xs font-black transition-all",
                                            isSelected ? "bg-primary text-white border-primary shadow-md" : "bg-white border-slate-200 text-slate-600",
                                            isPaid && "opacity-30 bg-emerald-50 text-emerald-800 border-emerald-100 cursor-not-allowed"
                                        )}
                                    >
                                        {month}
                                        {isPaid && <CheckCircle2 className="h-3 w-3 ml-1" />}
                                    </Button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="description" className="font-bold">আদায়ের বিবরণ</Label>
                            <Input id="description" value={description} onChange={e => setDescription(e.target.value)} className="bg-slate-50 font-bold border-2 focus:ring-primary" placeholder="উদা: জানুয়ারি মাসের বেতন" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="date" className="font-bold">আদায়ের তারিখ</Label>
                            <DatePicker value={collectionDate} onChange={date => setCollectionDate(date)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold">লেনদেনের মাধ্যম</Label>
                            <RadioGroup value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} className="flex items-center space-x-6 pt-2">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="cash" id="fee-cash" className="w-5 h-5" />
                                    <Label htmlFor="fee-cash" className="font-black text-slate-700">নগদ (Cash)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="bank" id="fee-bank" className="w-5 h-5" />
                                    <Label htmlFor="fee-bank" className="font-black text-slate-700">ব্যাংক (Bank)</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    </div>

                    <div className="space-y-4 border-t pt-6">
                        <Label className="font-black text-lg text-slate-800 border-l-4 border-primary pl-3">বিস্তারিত হিসাব (Breakdown)</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {feeFields.map(field => (
                                <div key={field.key} className="space-y-1.5 p-3 rounded-lg border-2 border-slate-100 hover:border-primary/20 transition-colors bg-slate-50/30">
                                    <Label htmlFor={field.key} className="font-black text-[10px] uppercase text-muted-foreground">{field.label}</Label>
                                    <div className="relative">
                                        <span className="absolute left-2 top-2 text-[10px] font-bold text-slate-400">৳</span>
                                        <Input
                                            id={field.key}
                                            type="number"
                                            value={breakdown[field.key] || ''}
                                            onChange={(e) => handleFeeChange(field.key, e.target.value)}
                                            className="h-8 pl-5 font-black text-right focus:bg-white"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-primary/5 p-5 rounded-2xl border-2 border-dashed border-primary/20">
                        <div className="flex items-center space-x-3">
                            <Checkbox 
                                id="send-sms" 
                                checked={shouldSendSMS} 
                                onCheckedChange={(checked) => setShouldSendSMS(!!checked)} 
                                className="w-5 h-5"
                            />
                            <Label htmlFor="send-sms" className="flex items-center gap-2 cursor-pointer text-sm font-black text-primary">
                                <Smartphone className="h-5 w-5" />
                                সেভ করার পর ফোনে কনফার্মেশন মেসেজ ড্রাফট করুন
                            </Label>
                        </div>
                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest bg-white px-3 py-1 rounded-full border shadow-sm">
                            আদায়কারী: {collectorName || '...'}
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-slate-50 border-t sticky bottom-0">
                    <div className="flex flex-col sm:flex-row justify-between w-full items-center gap-6">
                        <div className="text-center sm:text-left">
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">সর্বমোট আদায়যোগ্য টাকা</p>
                            <p className="font-black text-3xl text-primary">{totalAmount.toLocaleString('bn-BD')} ৳</p>
                        </div>
                        <div className="flex gap-3 w-full sm:w-auto">
                            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none font-bold h-12 px-8">বাতিল</Button>
                            <Button onClick={handleSave} className="flex-1 sm:flex-none min-w-[180px] font-black h-12 text-lg shadow-xl">
                                {shouldSendSMS ? 'সেভ ও মেসেজ' : 'শুধুমাত্র সেভ'}
                            </Button>
                        </div>
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
    
    const canEditTransaction = hasPermission('special:edit-transaction');
    const canDeleteTransaction = hasPermission('special:delete-transaction');

    const [feeCollections, setFeeCollections] = useState<FeeCollection[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCollection, setEditingCollection] = useState<FeeCollection | null>(null);
    const [printingCollection, setPrintingCollection] = useState<FeeCollection | null>(null);
    
    const studentId = student?.id;

    const fetchFeeData = useCallback(async () => {
        if (!db || !studentId) return;
        setIsLoading(true);
        const collections = await getFeeCollectionsForStudent(db, studentId, selectedYear);
        setFeeCollections(collections);
        setIsLoading(false);
    }, [db, studentId, selectedYear]);

    useEffect(() => {
        if (open && studentId) {
            fetchFeeData();
        }
    }, [open, studentId, fetchFeeData]);

    const paidMonths = useMemo(() => {
        const months = new Set<string>();
        feeCollections.forEach(c => {
            BENGALI_MONTHS.forEach(m => {
                if (c.description?.includes(m)) {
                    months.add(m);
                }
            });
        });
        return months;
    }, [feeCollections]);

    // Enhanced Dues Calculation
    const duesSummary = useMemo(() => {
        if (!student) return { tuitionDue: 0, tuitionDueMonths: [], examDues: [], otherDues: 0 };
        
        const currentMonthIdx = new Date().getMonth();
        const tuitionDueMonths = BENGALI_MONTHS.filter((m, idx) => idx <= currentMonthIdx && !paidMonths.has(m));
        const tuitionDueAmount = tuitionDueMonths.length * (student.monthlyFee || 0);

        const examDues = [];
        const paidCategories = new Set<string>();
        feeCollections.forEach(c => {
            if (c.breakdown) {
                Object.entries(c.breakdown).forEach(([k, v]) => {
                    if (v && v > 0) paidCategories.add(k);
                });
            }
        });

        const examCheck = [
            { key: 'examFeeHalfYearly', label: 'অর্ধ-বার্ষিক পরীক্ষা ফি' },
            { key: 'examFeeAnnual', label: 'বার্ষিক পরীক্ষা ফি' },
            { key: 'examFeePreNirbachoni', label: 'প্রাক-নির্বাচনী ফি' },
            { key: 'examFeeNirbachoni', label: 'নির্বাচনী পরীক্ষা ফি' },
        ];

        examCheck.forEach(exam => {
            const setupVal = student[exam.key as keyof Student] as number;
            if (setupVal && setupVal > 0 && !paidCategories.has(exam.key)) {
                examDues.push({ label: exam.label, amount: setupVal });
            }
        });

        let otherDuesAmount = 0;
        const otherCheck = [
            { key: 'sessionFee', label: 'সেশন চার্জ' },
            { key: 'admissionFee', label: 'ভর্তি ফি' },
            { key: 'scoutFee', label: 'স্কাউট ফি' },
            { key: 'developmentFee', label: 'উন্নয়ন ফি' },
            { key: 'libraryFee', label: 'লাইব্রেরি ফি' },
            { key: 'tiffinFee', label: 'টিফিন ফি' },
        ];

        otherCheck.forEach(item => {
            const setupVal = student[item.key as keyof Student] as number;
            if (setupVal && setupVal > 0 && !paidCategories.has(item.key)) {
                otherDuesAmount += setupVal;
            }
        });

        return { 
            tuitionDue: tuitionDueAmount, 
            tuitionDueMonths, 
            examDues, 
            otherDues: otherDuesAmount 
        };
    }, [student, paidMonths, feeCollections]);

    const handleEdit = (collection: FeeCollection) => {
        if (!canEditTransaction) {
            toast({ variant: 'destructive', title: 'দুঃখিত, আপনার এটি করার অনুমতি নেই।' });
            return;
        }
        setEditingCollection(collection);
        setIsFormOpen(true);
    };

    const handlePrint = (collection: FeeCollection) => {
        setPrintingCollection(collection);
        setTimeout(() => {
            window.print();
            setPrintingCollection(null);
        }, 300);
    };

    const handleAddNew = () => {
        setEditingCollection(null);
        setIsFormOpen(true);
    };

    const handleDelete = async (collection: FeeCollection) => {
        if(!db) return;
        if (!canDeleteTransaction) {
            toast({ variant: 'destructive', title: 'দুঃখিত, আপনার এটি করার অনুমতি নেই।' });
            return;
        }

        const batch = writeBatch(db);
        const feeCollectionRef = doc(db, 'feeCollections', collection.id);
        batch.delete(feeCollectionRef);

        if (collection.transactionIds) {
            collection.transactionIds.forEach(id => {
                const transRef = doc(db, 'transactions', id);
                batch.delete(transRef);
            });
        }
        
        try {
            await batch.commit();
            toast({title: "লেনদেন মুছে ফেলা হয়েছে।"});
            fetchFeeData();
            onFeeCollected();
        } catch(error) {
             console.error(error);
        }
    };
    
    return (
        <>
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl flex flex-col max-h-[95vh] w-[95vw] no-print font-kalpurush p-0 border-none shadow-2xl overflow-hidden rounded-2xl">
                <DialogHeader className="p-6 bg-primary text-white shrink-0">
                    <div className="flex flex-col md:flex-row items-center gap-5">
                        {isLoading || !student ? (
                            <Skeleton className="h-20 w-20 rounded-full bg-white/20" />
                        ) : (
                             <Avatar className="h-20 w-20 border-4 border-white shadow-xl">
                                <AvatarImage src={sanitizePhotoUrl(student.photoUrl, student.gender) || getStudentPlaceholderImage(student.gender)} />
                                <AvatarFallback className="text-primary font-black text-2xl bg-white">{student.studentNameBn?.charAt(0)}</AvatarFallback>
                             </Avatar>
                        )}
                        <div className="flex-1 text-center md:text-left space-y-1">
                            <DialogTitle className="text-2xl sm:text-3xl font-black">বেতন আদায়ের তথ্য</DialogTitle>
                            {isLoading || !student ? (
                                <Skeleton className="h-4 w-1/2 mx-auto md:mx-0 bg-white/20" />
                            ) : (
                                <DialogDescription className="text-md font-bold text-white/90">
                                    {student.studentNameBn} (রোল: {toBengaliNumber(student.roll)}, শ্রেণি: {classNamesMap[student.className] || student.className})
                                </DialogDescription>
                            )}
                        </div>
                        <Button onClick={handleAddNew} size="lg" className="bg-white text-primary hover:bg-slate-100 font-black shadow-lg">নতুন আদায়</Button>
                    </div>
                </DialogHeader>

                 {isLoading ? (
                    <div className="p-12 text-center flex flex-col items-center gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="font-bold text-muted-foreground italic">তথ্য লোড হচ্ছে...</p>
                    </div>
                 ) : (
                <>
                    <div className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-8 bg-slate-50/50">
                        {/* Summary of Dues - NEW SECTION */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card className="border-[3px] border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,0.1)]">
                                <CardHeader className="p-4 bg-rose-50 border-b-2 border-black">
                                    <CardTitle className="text-sm font-black flex items-center gap-2 text-rose-700">
                                        <Clock className="h-4 w-4" /> বকেয়া বেতন
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="flex justify-between items-center">
                                        <p className="text-2xl font-black text-rose-900">{toBengaliNumber(duesSummary.tuitionDue)} ৳</p>
                                        <Badge variant="outline" className="font-bold border-rose-200">{toBengaliNumber(duesSummary.tuitionDueMonths.length)} মাস</Badge>
                                    </div>
                                    <p className="text-[10px] font-bold text-muted-foreground mt-2 line-clamp-1">বকেয়া: {duesSummary.tuitionDueMonths.join(', ') || 'নেই'}</p>
                                </CardContent>
                            </Card>

                            <Card className="border-[3px] border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,0.1)]">
                                <CardHeader className="p-4 bg-amber-50 border-b-2 border-black">
                                    <CardTitle className="text-sm font-black flex items-center gap-2 text-amber-700">
                                        <ListTodo className="h-4 w-4" /> পরীক্ষার ফি
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <p className="text-2xl font-black text-amber-900">
                                        {toBengaliNumber(duesSummary.examDues.reduce((acc, d) => acc + d.amount, 0))} ৳
                                    </p>
                                    <p className="text-[10px] font-bold text-muted-foreground mt-2 line-clamp-1">
                                        বাকি: {duesSummary.examDues.map(d => d.label).join(', ') || 'নেই'}
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-[3px] border-black bg-white shadow-[4px_4px_0px_rgba(0,0,0,0.1)]">
                                <CardHeader className="p-4 bg-indigo-50 border-b-2 border-black">
                                    <CardTitle className="text-sm font-black flex items-center gap-2 text-indigo-700">
                                        <Wallet className="h-4 w-4" /> অন্যান্য ফি
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <p className="text-2xl font-black text-indigo-900">{toBengaliNumber(duesSummary.otherDues)} ৳</p>
                                    <p className="text-[10px] font-bold text-muted-foreground mt-2">সেশন ও দাপ্তরিক ফি সমূহ</p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Monthly Status Board */}
                        <div className="bg-white border-[4px] border-black rounded-[32px] p-6 sm:p-8 shadow-[8px_8px_0px_rgba(0,0,0,0.1)]">
                            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                                <CalendarCheck className="h-5 w-5 text-primary" /> মাসিক পরিশোধের অবস্থা ({toBengaliNumber(selectedYear)})
                            </h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                {BENGALI_MONTHS.map((month, idx) => {
                                    const isPaid = paidMonths.has(month);
                                    const currentMonthIdx = new Date().getMonth();
                                    const isCurrentOrPast = idx <= currentMonthIdx;

                                    return (
                                        <div key={month} className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-300",
                                            isPaid 
                                                ? "bg-emerald-50 border-emerald-500/30 text-emerald-800 shadow-sm" 
                                                : isCurrentOrPast 
                                                    ? "bg-rose-50 border-rose-500/30 text-rose-800 shadow-sm"
                                                    : "bg-slate-50 border-slate-200 text-slate-400 opacity-60"
                                        )}>
                                            <span className="text-[11px] font-black leading-none mb-2">{month}</span>
                                            <Badge variant="outline" className={cn(
                                                "h-5 text-[9px] font-black border-none px-3 uppercase",
                                                isPaid ? "bg-emerald-600 text-white" : isCurrentOrPast ? "bg-rose-600 text-white" : "bg-slate-300 text-white"
                                            )}>
                                                {isPaid ? 'Paid' : 'Due'}
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2 pl-2">
                                <Banknote className="h-5 w-5 text-emerald-600" /> বিগত আদায়ের রেকর্ডসমূহ
                            </h3>
                            <div className="table-container !border-2 !border-black shadow-xl">
                                <Table className="min-w-[800px]">
                                    <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-md z-10">
                                        <TableRow className="border-b-2 border-black">
                                            <TableHead className="font-black text-black text-center w-36">আদায়ের তারিখ</TableHead>
                                            <TableHead className="font-black text-black">বিবরণ (মাসসমূহ)</TableHead>
                                            <TableHead className="text-center font-black text-black w-24">পদ্ধতি</TableHead>
                                            <TableHead className="text-right font-black text-emerald-950 w-32">মোট টাকা</TableHead>
                                            <TableHead className="font-black text-center text-black w-20">রসিদ</TableHead>
                                            <TableHead className="text-right font-black text-black pr-6">কার্যক্রম</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {feeCollections.length === 0 ? (
                                            <TableRow><TableCell colSpan={6} className="text-center py-20 italic font-bold text-muted-foreground">এখনও কোনো ফি আদায় করা হয়নি।</TableCell></TableRow>
                                        ) : (
                                            feeCollections.map(collection => (
                                                <TableRow key={collection.id} className="hover:bg-primary/5 transition-colors h-14">
                                                    <TableCell className="text-center font-bold text-slate-600">{toBengaliNumber(format(collection.collectionDate, "dd/MM/yyyy"))}</TableCell>
                                                    <TableCell className="font-black text-slate-800">{collection.description || 'N/A'}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Badge variant="outline" className={cn(
                                                            "text-[10px] font-black px-3",
                                                            collection.method === 'bank' ? "border-blue-200 text-blue-700 bg-blue-50" : "border-amber-200 text-amber-700 bg-amber-50"
                                                        )}>
                                                            {collection.method === 'bank' ? 'Bank' : 'Cash'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right font-black text-emerald-700 text-lg">{toBengaliNumber(collection.totalAmount ?? 0)} ৳</TableCell>
                                                    <TableCell className="text-center">
                                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-500 hover:text-primary hover:bg-primary/10" onClick={() => handlePrint(collection)}>
                                                            <Printer className="h-5 w-5" />
                                                        </Button>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="flex gap-1.5 justify-end">
                                                            {canEditTransaction && (
                                                                <Button variant="outline" size="icon" className="h-8 w-8 text-blue-600 border-blue-100 hover:bg-blue-50" onClick={() => handleEdit(collection)}>
                                                                    <FilePen className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                            {canDeleteTransaction && (
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                                    <AlertDialogContent className="font-kalpurush">
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>রেকর্ডটি মুছতে চান?</AlertDialogTitle>
                                                                            <AlertDialogDescription className="font-bold">এই লেনদেনটি স্থায়ীভাবে মুছে যাবে। এটি ক্যাশবুক থেকেও স্বয়ংক্রিয়ভাবে মুছে যাবে।</AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel className="font-bold">বাতিল</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => handleDelete(collection)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-black">হ্যাঁ, মুছুন</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                    
                    <DialogFooter className="p-4 bg-white border-t -mx-0">
                        <DialogClose asChild><Button variant="outline" className="w-full sm:w-auto font-black h-10 px-10 border-2">বন্ধ করুন</Button></DialogClose>
                    </DialogFooter>

                    {student && (
                        <FeeCollectionForm 
                            student={student} 
                            onSave={() => { fetchFeeData(); onFeeCollected(); }} 
                            existingCollection={editingCollection}
                            open={isFormOpen}
                            onOpenChange={setIsFormOpen}
                            paidMonths={paidMonths}
                        />
                    )}
                </>
                )}
            </DialogContent>
        </Dialog>

        {/* Printable Area for Receipt */}
        {student && printingCollection && (
            <div className="hidden print:block printable-area bg-white">
                <div className="flex items-center justify-center min-h-[297mm]">
                    <MoneyReceipt 
                        collection={printingCollection} 
                        student={student} 
                        schoolInfo={schoolInfo} 
                    />
                </div>
            </div>
        )}
        </>
    );
}

function Avatar({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}>{children}</div>;
}
function AvatarImage({ src, className }: { src?: string, className?: string }) {
    return src ? <img src={src} className={cn("aspect-square h-full w-full", className)} alt="avatar" /> : null;
}
function AvatarFallback({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}>{children}</div>;
}
