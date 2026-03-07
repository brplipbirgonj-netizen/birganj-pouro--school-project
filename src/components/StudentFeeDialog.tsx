'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Student } from '@/lib/student-data';
import { getFeeCollectionsForStudent, FeeCollection, FeeBreakdown } from '@/lib/fees-data';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { useToast } from "@/hooks/use-toast";
import { NewTransactionData } from '@/lib/transactions-data';
import { collection, doc, writeBatch, serverTimestamp, Timestamp, WithFieldValue, DocumentData, query, where, getDocs, limit } from 'firebase/firestore';
import { FilePen, Trash2, Smartphone } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Skeleton } from './ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DatePicker } from './ui/date-picker';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox } from '@/components/ui/checkbox';

const classNamesMap: { [key: string]: string } = {
    '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

const feeFields: { key: keyof FeeBreakdown; label: string }[] = [
    { key: 'tuitionCurrent', label: 'চলতি' },
    { key: 'tuitionAdvance', label: 'অগ্রিম' },
    { key: 'tuitionDue', label: 'বকেয়া' },
    { key: 'tuitionFine', label: 'জরিমানা' },
    { key: 'examFeeHalfYearly', label: 'অর্ধ-বার্ষিক' },
    { key: 'examFeeAnnual', label: 'বার্ষিক' },
    { key: 'examFeePreNirbachoni', label: 'প্রাক-নির্বাচনী' },
    { key: 'examFeeNirbachoni', label: 'নির্বাচনী' },
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

function FeeCollectionForm({ student, onSave, existingCollection, open, onOpenChange }: { student: Student, onSave: () => void, existingCollection: FeeCollection | null, open: boolean, onOpenChange: (open: boolean) => void }) {
    const db = useFirestore();
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const { user } = useAuth();
    
    const [collectionDate, setCollectionDate] = useState<Date | undefined>(new Date());
    const [description, setDescription] = useState('');
    const [breakdown, setBreakdown] = useState<FeeBreakdown>(emptyBreakdown);
    const [collectorName, setCollectorName] = useState<string>('');
    const [shouldSendSMS, setShouldSendSMS] = useState(true);

    const bengaliMonths = useMemo(() => [
        'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
        'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ], []);

    useEffect(() => {
        if (!db || !user) return;

        const fetchCollectorName = async () => {
            if (user.role === 'teacher' && user.email) {
                const staffQuery = query(collection(db, 'staff'), where('email', '==', user.email.toLowerCase()), limit(1));
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
            } else {
                const today = new Date();
                setCollectionDate(today);
                const currentMonthIndex = today.getMonth();
                const currentMonthName = bengaliMonths[currentMonthIndex];
                setDescription(currentMonthName ? `${currentMonthName} মাসের বেতন` : '');
                setBreakdown(emptyBreakdown);
            }
        }
    }, [existingCollection, open, bengaliMonths]);

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
                    
                    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
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
            const permissionError = new FirestorePermissionError({
                path: 'feeCollections/ or transactions/',
                operation: 'write',
                requestResourceData: feeCollectionData,
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl flex flex-col max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>{existingCollection ? 'ফি আদায় এডিট করুন' : 'নতুন ফি আদায়'}</DialogTitle>
                    <DialogDescription>
                        {student.studentNameBn} (রোল: {student.roll.toLocaleString('bn-BD')}) এর জন্য ফি আদায় করুন।
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-grow overflow-y-auto -mx-6 px-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="date">আদায়ের তারিখ</Label>
                            <DatePicker value={collectionDate} onChange={setCollectionDate} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">বিবরণ</Label>
                            <div className="flex gap-2">
                                <Select 
                                    onValueChange={(month) => month && setDescription(`${month} মাসের বেতন`)}
                                    defaultValue={bengaliMonths[new Date().getMonth()]}
                                >
                                    <SelectTrigger className="w-[180px]">
                                        <SelectValue placeholder="মাস নির্বাচন" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {bengaliMonths.map(month => (
                                            <SelectItem key={month} value={month}>{month}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Input id="description" value={description} onChange={e => setDescription(e.target.value)} />
                            </div>
                        </div>
                    </div>
                    <div className="border-t pt-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {feeFields.map(field => (
                                <div key={field.key} className="space-y-2">
                                    <Label htmlFor={field.key}>{field.label}</Label>
                                    <Input
                                        id={field.key}
                                        type="number"
                                        value={breakdown[field.key] || ''}
                                        onChange={(e) => handleFeeChange(field.key, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/50 p-4 rounded-lg mt-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox 
                                id="send-sms" 
                                checked={shouldSendSMS} 
                                onCheckedChange={(checked) => setShouldSendSMS(!!checked)} 
                            />
                            <Label htmlFor="send-sms" className="flex items-center gap-2 cursor-pointer">
                                <Smartphone className="h-4 w-4 text-primary" />
                                সেভ করার পর ফোনে মেসেজ ড্রাফট করুন
                            </Label>
                        </div>
                        <div className="text-xs text-muted-foreground">
                            আদায়কারী: {collectorName || 'লোড হচ্ছে...'}
                        </div>
                    </div>
                </div>

                <DialogFooter className="pt-4 border-t -mx-6 px-6 pb-6 mt-auto">
                    <div className="flex justify-between w-full items-center">
                        <p className="font-semibold text-lg">মোট আদায়: {totalAmount.toLocaleString('bn-BD')} টাকা</p>
                        <div className="flex gap-2">
                             <DialogClose asChild><Button variant="ghost">বাতিল</Button></DialogClose>
                            <Button onClick={handleSave} className="min-w-[120px]">
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
    const { selectedYear } = useAcademicYear();
    const { toast } = useToast();
    const { hasPermission } = useAuth();
    const canManageTransactions = hasPermission('manage:transactions');

    const [feeCollections, setFeeCollections] = useState<FeeCollection[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingCollection, setEditingCollection] = useState<FeeCollection | null>(null);
    
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

    const handleEdit = (collection: FeeCollection) => {
        setEditingCollection(collection);
        setIsFormOpen(true);
    };

    const handleAddNew = () => {
        setEditingCollection(null);
        setIsFormOpen(true);
    };

    const handleDelete = async (collection: FeeCollection) => {
        if(!db) return;

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
             const permissionError = new FirestorePermissionError({ path: 'feeCollections/', operation: 'delete' });
             errorEmitter.emit('permission-error', permissionError);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        {isLoading || !student ? (
                            <Skeleton className="h-24 w-24 rounded-lg" />
                        ) : (
                             student.photoUrl && <Image src={student.photoUrl} alt="Student photo" width={96} height={96} className="rounded-lg border object-cover" />
                        )}
                        <div className="flex-1 text-center md:text-left space-y-2">
                            <DialogTitle className="text-2xl">ছাত্র/ ছাত্রীর বেতন আদায় তথ্য</DialogTitle>
                            {isLoading || !student ? (
                                <Skeleton className="h-4 w-1/2" />
                            ) : (
                                <DialogDescription>
                                    <span className="font-semibold">{student.studentNameBn}</span> (রোল: {student.roll.toLocaleString('bn-BD')}, শ্রেণি: {classNamesMap[student.className] || student.className})
                                </DialogDescription>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                 {isLoading ? (
                    <div className="p-8 text-center">
                        <p>Loading...</p>
                    </div>
                 ) : (
                <>
                    <div className="py-4">
                        <div className="border rounded-md max-h-[40vh] overflow-auto">
                            <Table className="min-w-[650px]">
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>আদায়ের তারিখ</TableHead>
                                        <TableHead>বিবরণ</TableHead>
                                        <TableHead className="text-right">মোট টাকা</TableHead>
                                        <TableHead>আদায়কারী</TableHead>
                                        {canManageTransactions && <TableHead className="text-right">কার্যক্রম</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {feeCollections.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center h-24">কোনো ফি আদায় করা হয়নি।</TableCell></TableRow>
                                    ) : (
                                        feeCollections.map(collection => (
                                            <TableRow key={collection.id}>
                                                <TableCell className="whitespace-nowrap">{format(collection.collectionDate, "PP", { locale: bn })}</TableCell>
                                                <TableCell>{collection.description || 'N/A'}</TableCell>
                                                <TableCell className="text-right font-medium whitespace-nowrap">{(collection.totalAmount ?? 0).toLocaleString('bn-BD')} ৳</TableCell>
                                                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{collection.collectorName || '-'}</TableCell>
                                                {canManageTransactions && (
                                                    <TableCell className="text-right">
                                                        <div className="flex gap-2 justify-end">
                                                            <Button variant="outline" size="icon" onClick={() => handleEdit(collection)}>
                                                                <FilePen className="h-4 w-4" />
                                                            </Button>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild><Button variant="destructive" size="icon"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                                                                        <AlertDialogDescription>এই লেনদেনটি স্থায়ীভাবে মুছে যাবে। এটি ক্যাশবুক থেকেও মুছে যাবে।</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDelete(collection)}>মুছে ফেলুন</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </div>
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <Button onClick={handleAddNew}>নতুন ফি আদায় করুন</Button>
                    </div>

                    {student && (
                        <FeeCollectionForm 
                            student={student} 
                            onSave={() => { fetchFeeData(); onFeeCollected(); }} 
                            existingCollection={editingCollection}
                            open={isFormOpen}
                            onOpenChange={setIsFormOpen}
                        />
                    )}
                </>
                )}
            </DialogContent>
        </Dialog>
    );
}
