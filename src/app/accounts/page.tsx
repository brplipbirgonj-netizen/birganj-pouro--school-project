'use client';

import Image from 'next/image';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Student } from '@/lib/student-data';
import Link from 'next/link';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarIcon, Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Transaction, NewTransactionData, addTransaction, getTransactions, deleteTransaction, TransactionType } from '@/lib/transactions-data';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { StudentFeeDialog } from '@/components/StudentFeeDialog';
import { DatePicker } from '@/components/ui/date-picker';
import { useAuth } from '@/hooks/useAuth';
import { FeeCollection, feeCollectionFromDoc } from '@/lib/fees-data';


// Fee Collection Component
const FeeCollectionTab = ({ studentsForYear, isLoading, onFeeCollected }: { studentsForYear: Student[], isLoading: boolean, onFeeCollected: () => void }) => {
    const [feeStudent, setFeeStudent] = useState<Student | null>(null);

    const classes = ['6', '7', '8', '9', '10'];
    const classNamesMap: { [key: string]: string } = {
        '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম',
    };

    const getStudentsByClass = (className: string): Student[] => {
        return studentsForYear.filter((student) => student.className === className);
    };

    return (
        <>
        <Tabs defaultValue="6">
            <TabsList className="grid w-full grid-cols-5">
            {classes.map((className) => (
                <TabsTrigger key={className} value={className}>
                {classNamesMap[className]} শ্রেণি
                </TabsTrigger>
            ))}
            </TabsList>
            {classes.map((className) => (
            <TabsContent key={className} value={className}>
                <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>রোল</TableHead>
                            <TableHead>শিক্ষার্থীর নাম</TableHead>
                            <TableHead>পিতার নাম</TableHead>
                            <TableHead className="text-right">কার্যক্রম</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                    লোড হচ্ছে...
                                </TableCell>
                            </TableRow>
                        ) : getStudentsByClass(className).length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                    এই শ্রেণিতে কোনো শিক্ষার্থী নেই।
                                </TableCell>
                            </TableRow>
                        ) : (
                            getStudentsByClass(className).map((student) => (
                            <TableRow key={student.id}>
                                <TableCell>{student.roll.toLocaleString('bn-BD')}</TableCell>
                                <TableCell className="whitespace-nowrap">{student.studentNameBn}</TableCell>
                                <TableCell className="whitespace-nowrap">{student.fatherNameBn}</TableCell>
                                <TableCell className="text-right">
                                <Button onClick={() => setFeeStudent(student)}>বেতন আদায় করুন</Button>
                                </TableCell>
                            </TableRow>
                            ))
                        )}
                        </TableBody>
                    </Table>
                    </div>
                </CardContent>
                </Card>
            </TabsContent>
            ))}
        </Tabs>
        <StudentFeeDialog student={feeStudent} open={!!feeStudent} onOpenChange={() => setFeeStudent(null)} onFeeCollected={onFeeCollected} />
        </>
    )
}

// Collection Report Tab Component
const CollectionReportTab = ({ allStudents }: { allStudents: Student[] }) => {
    const db = useFirestore();
    const { user } = useAuth();
    const { selectedYear } = useAcademicYear();
    const [collections, setCollections] = useState<FeeCollection[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
    const [collectorFilter, setCollectorFilter] = useState<string>('all');

    useEffect(() => {
        if (!db || !user) return;
        setIsLoading(true);
        const q = query(
            collection(db, 'feeCollections'),
            where('academicYear', '==', selectedYear)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs
                .map(doc => feeCollectionFromDoc(doc))
                .filter((c): c is FeeCollection => c !== null)
                .sort((a, b) => b.collectionDate.getTime() - a.collectionDate.getTime());
            
            setCollections(data);
            setIsLoading(false);
        }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'feeCollections', operation: 'list' }));
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, user, selectedYear]);

    const studentMap = useMemo(() => {
        const map = new Map<string, Student>();
        allStudents.forEach(s => map.set(s.id, s));
        return map;
    }, [allStudents]);

    const uniqueCollectors = useMemo(() => {
        const collectors = new Set<string>();
        collections.forEach(c => {
            if (c.collectorName) collectors.add(c.collectorName);
        });
        return Array.from(collectors).sort();
    }, [collections]);

    const filteredCollections = useMemo(() => {
        return collections.filter(c => {
            const matchesCollector = collectorFilter === 'all' || c.collectorName === collectorFilter;
            const matchesDate = !dateFilter || format(c.collectionDate, 'yyyy-MM-dd') === format(dateFilter, 'yyyy-MM-dd');
            return matchesCollector && matchesDate;
        });
    }, [collections, collectorFilter, dateFilter]);

    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

    return (
        <Card>
            <CardHeader>
                <CardTitle>বেতন আদায়ের রিপোর্ট</CardTitle>
                <div className="flex flex-col md:flex-row gap-4 mt-4">
                    <div className="space-y-2 flex-1">
                        <Label>তারিখ দিয়ে ফিল্টার</Label>
                        <DatePicker value={dateFilter} onChange={setDateFilter} placeholder="তারিখ নির্বাচন করুন" />
                    </div>
                    <div className="space-y-2 flex-1">
                        <Label>আদায়কারী</Label>
                        <Select value={collectorFilter} onValueChange={setCollectorFilter}>
                            <SelectTrigger><SelectValue placeholder="সকল আদায়কারী" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">সকল আদায়কারী</SelectItem>
                                {uniqueCollectors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>তারিখ</TableHead>
                                <TableHead>রোল</TableHead>
                                <TableHead>নাম</TableHead>
                                <TableHead>শ্রেণি</TableHead>
                                <TableHead className="text-right">মোট আদায়</TableHead>
                                <TableHead>আদায়কারী</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8">লোড হচ্ছে...</TableCell></TableRow>
                            ) : filteredCollections.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-8">কোনো রেকর্ড পাওয়া যায়নি।</TableCell></TableRow>
                            ) : (
                                filteredCollections.map(c => {
                                    const student = studentMap.get(c.studentId);
                                    return (
                                        <TableRow key={c.id}>
                                            <TableCell>{format(c.collectionDate, 'PP', { locale: bn })}</TableCell>
                                            <TableCell>{student?.roll.toLocaleString('bn-BD') || '-'}</TableCell>
                                            <TableCell>{student?.studentNameBn || '-'}</TableCell>
                                            <TableCell>{student ? (classNamesMap[student.className] || student.className) : '-'}</TableCell>
                                            <TableCell className="text-right font-semibold">{c.totalAmount.toLocaleString('bn-BD')} ৳</TableCell>
                                            <TableCell>{c.collectorName || '-'}</TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

// New Transaction Component
const NewTransactionTab = ({ onTransactionAdded }: { onTransactionAdded: () => void }) => {
    const { toast } = useToast();
    const db = useFirestore();
    const { user } = useAuth();
    const { selectedYear } = useAcademicYear();

    const [date, setDate] = useState<Date | undefined>(new Date());
    const [type, setType] = useState<TransactionType>('income');
    const [accountHead, setAccountHead] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState<number | ''>('');

    const incomeHeads = ['Tuition Fee', 'Exam Fee', 'Admission Fee', 'Session Fee', 'Donation', 'Other'];
    const expenseHeads = ['Salary', 'Utilities', 'Stationery', 'Maintenance', 'Other'];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !user || !date || !type || !accountHead || !amount || amount <= 0) {
            toast({ variant: 'destructive', title: 'অনুগ্রহ করে সকল তথ্য পূরণ করুন এবং টাকার পরিমাণ শূন্যের বেশি রাখুন।' });
            return;
        }

        const newTransaction: NewTransactionData = {
            date,
            type,
            accountHead,
            description,
            amount: Number(amount),
            academicYear: selectedYear
        };

        try {
            await addTransaction(db, newTransaction);
            toast({ title: 'লেনদেন যোগ হয়েছে।' });
            // Reset form
            setDate(new Date());
            setAccountHead('');
            setDescription('');
            setAmount('');
            onTransactionAdded(); // Notify parent to refetch transactions
        } catch (error) {
            // Error is handled by the global listener
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>নতুন আয়/ব্যয় যোগ করুন</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="date">তারিখ</Label>
                            <DatePicker value={date} onChange={setDate} placeholder="তারিখ" />
                        </div>
                        <div className="space-y-2">
                             <Label>লেনদেনের ধরণ</Label>
                            <RadioGroup value={type} onValueChange={(v) => setType(v as TransactionType)} className="flex items-center space-x-4 pt-2">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="income" id="income" />
                                    <Label htmlFor="income">আয়</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="expense" id="expense" />
                                    <Label htmlFor="expense">ব্যয়</Label>
                                </div>
                            </RadioGroup>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="account-head">খাত</Label>
                            <Select value={accountHead} onValueChange={setAccountHead}>
                                <SelectTrigger id="account-head"><SelectValue placeholder="খাত নির্বাচন করুন" /></SelectTrigger>
                                <SelectContent>
                                    {(type === 'income' ? incomeHeads : expenseHeads).map(head => (
                                        <SelectItem key={head} value={head}>{head}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="amount">টাকার পরিমাণ</Label>
                            <Input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} required />
                        </div>
                        <div className="md:col-span-2 space-y-2">
                            <Label htmlFor="description">বিবরণ</Label>
                            <Input id="description" value={description} onChange={e => setDescription(e.target.value)} />
                        </div>
                    </div>
                     <div className="flex justify-end">
                        <Button type="submit">লেনদেন সেভ করুন</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}

// Cashbook Tab Component
const CashbookTab = ({ transactions, isLoading, refetch }: { transactions: Transaction[], isLoading: boolean, refetch: () => void }) => {
    const db = useFirestore();
    const { toast } = useToast();
    const { user, hasPermission } = useAuth();
    const canManageTransactions = hasPermission('manage:transactions');

    const sortedTransactions = useMemo(() => {
        return [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions]);

    const cashbookData = useMemo(() => {
        let balance = 0;
        return sortedTransactions.map(tx => {
            if (tx.type === 'income') {
                balance += tx.amount;
            } else {
                balance -= tx.amount;
            }
            return { ...tx, balance };
        });
    }, [sortedTransactions]);

    const handleDelete = async (id: string) => {
        if(!db || !user) return;
        try {
            await deleteTransaction(db, id);
            toast({ title: 'লেনদেন মুছে ফেলা হয়েছে।'});
            refetch();
        } catch (error) {
            // error handled by listener
        }
    }

    return (
        <Card>
             <CardHeader>
                <CardTitle>ক্যাশবুক</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>তারিখ</TableHead>
                                <TableHead>বিবরণ</TableHead>
                                <TableHead className="text-right">আয়</TableHead>
                                <TableHead className="text-right">ব্যয়</TableHead>
                                <TableHead className="text-right">ব্যালেন্স</TableHead>
                                {canManageTransactions && <TableHead className="text-right">কার্যক্রম</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={canManageTransactions ? 6 : 5} className="text-center p-8">লোড হচ্ছে...</TableCell></TableRow>
                            ) : cashbookData.length === 0 ? (
                                <TableRow><TableCell colSpan={canManageTransactions ? 6 : 5} className="text-center p-8">কোনো লেনদেন পাওয়া যায়নি।</TableCell></TableRow>
                            ) : (
                                cashbookData.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell>{format(new Date(tx.date), 'PP', { locale: bn })}</TableCell>
                                        <TableCell>
                                            <p className="font-medium">{tx.accountHead}</p>
                                            {tx.description && <p className="text-sm text-muted-foreground">{tx.description}</p>}
                                        </TableCell>
                                        <TableCell className="text-right text-green-600">{tx.type === 'income' ? tx.amount.toLocaleString('bn-BD') : '-'}</TableCell>
                                        <TableCell className="text-right text-red-600">{tx.type === 'expense' ? tx.amount.toLocaleString('bn-BD') : '-'}</TableCell>
                                        <TableCell className="text-right font-semibold">{tx.balance.toLocaleString('bn-BD')}</TableCell>
                                        {canManageTransactions && (
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="icon" disabled={!!tx.feeCollectionId}><Trash2 className="h-4 w-4" /></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                                                            <AlertDialogDescription>এই লেনদেনটি স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(tx.id)}>মুছে ফেলুন</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}

// Ledger Tab Component
const LedgerTab = ({ transactions, isLoading }: { transactions: Transaction[], isLoading: boolean }) => {
    
    const ledgerData = useMemo(() => {
        const grouped: { [key: string]: { income: number, expense: number, transactions: Transaction[] } } = {};
        transactions.forEach(tx => {
            if (!grouped[tx.accountHead]) {
                grouped[tx.accountHead] = { income: 0, expense: 0, transactions: [] };
            }
            if (tx.type === 'income') {
                grouped[tx.accountHead].income += tx.amount;
            } else {
                grouped[tx.accountHead].expense += tx.amount;
            }
            grouped[tx.accountHead].transactions.push(tx);
        });
        return grouped;
    }, [transactions]);
    
    return (
         <Card>
             <CardHeader>
                <CardTitle>খতিয়ান (লেজার)</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <p className="text-center p-8">লোড হচ্ছে...</p>
                ) : Object.keys(ledgerData).length === 0 ? (
                    <p className="text-center p-8">কোনো লেনদেন পাওয়া যায়নি।</p>
                ) : (
                    <Accordion type="multiple" className="w-full">
                        {Object.entries(ledgerData).map(([head, data]) => (
                             <AccordionItem value={head} key={head}>
                                <AccordionTrigger>
                                    <div className="flex justify-between w-full pr-4">
                                        <span>{head}</span>
                                        <div className="flex gap-4">
                                            <span className="text-green-600">মোট আয়: {data.income.toLocaleString('bn-BD')}</span>
                                            <span className="text-red-600">মোট ব্যয়: {data.expense.toLocaleString('bn-BD')}</span>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>তারিখ</TableHead>
                                                <TableHead>বিবরণ</TableHead>
                                                <TableHead className="text-right">আয়</TableHead>
                                                <TableHead className="text-right">ব্যয়</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(tx => (
                                                <TableRow key={tx.id}>
                                                    <TableCell>{format(new Date(tx.date), 'PP', { locale: bn })}</TableCell>
                                                    <TableCell>{tx.description || '-'}</TableCell>
                                                    <TableCell className="text-right text-green-600">{tx.type === 'income' ? tx.amount.toLocaleString('bn-BD') : '-'}</TableCell>
                                                    <TableCell className="text-right text-red-600">{tx.type === 'expense' ? tx.amount.toLocaleString('bn-BD') : '-'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
            </CardContent>
        </Card>
    )
}


export default function AccountsPage() {
  const [isClient, setIsClient] = useState(false);
  const db = useFirestore();
  const { user, hasPermission } = useAuth();
  const { selectedYear } = useAcademicYear();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const canCollectFees = hasPermission('collect:fees');
  const canManageTransactions = hasPermission('manage:transactions');

  const fetchTransactions = useCallback(async () => {
    if (!db || !user) return;
    setIsLoading(true);
    const fetchedTransactions = await getTransactions(db, selectedYear);
    setTransactions(fetchedTransactions);
    setIsLoading(false);
  }, [db, user, selectedYear]);

  const fetchStudents = useCallback(() => {
    if (!db || !user) return;
    setIsLoadingStudents(true);
    const studentsQuery = query(collection(db, "students"), orderBy("roll"));
    const unsubscribe = onSnapshot(studentsQuery, (querySnapshot) => {
        const studentsData = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            dob: doc.data().dob?.toDate(),
        })) as Student[];
        setAllStudents(studentsData);
        setIsLoadingStudents(false);
    }, (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'students', operation: 'list' }));
        setIsLoadingStudents(false);
    });
    return unsubscribe;
  }, [db, user]);

  useEffect(() => {
    setIsClient(true);
    fetchTransactions();
    const unsubStudents = fetchStudents();
    return () => unsubStudents?.();
  }, [fetchTransactions, fetchStudents]);

  const studentsForYear = useMemo(() => {
    return allStudents.filter(student => student.academicYear === selectedYear);
  }, [allStudents, selectedYear]);

  const tabs = [];
  if (canCollectFees) {
      tabs.push({ value: "fee-collection", label: "বেতন আদায়" });
      tabs.push({ value: "collection-report", label: "আদায়ের রিপোর্ট" });
  }
  tabs.push({ value: "cashbook", label: "ক্যাশবুক" });
  tabs.push({ value: "ledger", label: "খতিয়ান" });
  if (canManageTransactions) tabs.push({ value: "new-transaction", label: "নতুন লেনদেন" });


  return (
    <div className="flex min-h-screen w-full flex-col bg-teal-100">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-24">
        <Card>
          <CardHeader>
             <CardTitle>হিসাব শাখা</CardTitle>
            {isClient && <p className="text-sm text-muted-foreground">শিক্ষাবর্ষ: {selectedYear.toLocaleString('bn-BD')}</p>}
          </CardHeader>
          <CardContent>
             {isClient ? (
                <Tabs defaultValue={tabs[0]?.value || 'cashbook'}>
                  <TabsList className="inline-flex h-auto flex-wrap items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
                    {tabs.map(tab => <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>)}
                  </TabsList>
                  {canCollectFees && (
                    <>
                        <TabsContent value="fee-collection" className="mt-4">
                            <FeeCollectionTab studentsForYear={studentsForYear} isLoading={isLoadingStudents} onFeeCollected={fetchTransactions} />
                        </TabsContent>
                        <TabsContent value="collection-report" className="mt-4">
                            <CollectionReportTab allStudents={allStudents} />
                        </TabsContent>
                    </>
                  )}
                   <TabsContent value="cashbook" className="mt-4">
                    <CashbookTab transactions={transactions} isLoading={isLoading} refetch={fetchTransactions} />
                  </TabsContent>
                   <TabsContent value="ledger" className="mt-4">
                    <LedgerTab transactions={transactions} isLoading={isLoading} />
                  </TabsContent>
                   {canManageTransactions && (
                    <TabsContent value="new-transaction" className="mt-4">
                      <NewTransactionTab onTransactionAdded={fetchTransactions} />
                    </TabsContent>
                   )}
                </Tabs>
             ) : (
                <div className="space-y-4">
                  <div className="grid w-full grid-cols-4 h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground mb-4">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="flex justify-center"><Skeleton className="h-8 w-[80%]" /></div>
                    ))}
                  </div>
                   <div className="border rounded-md p-4">
                      <Skeleton className="h-8 w-1/4 mb-4" />
                       <Skeleton className="h-4 w-1/2 mb-6" />
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                <TableRow>
                                    <TableHead><Skeleton className="h-6 w-16" /></TableHead>
                                    <TableHead><Skeleton className="h-6 w-32" /></TableHead>
                                    <TableHead><Skeleton className="h-6 w-32" /></TableHead>
                                    <TableHead className="text-right"><Skeleton className="h-6 w-24 ml-auto" /></TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {[...Array(5)].map((_, i) => (
                                    <TableRow key={i}>
                                    <TableCell><Skeleton className="h-6 w-10" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                                    <TableCell className="text-right">
                                        <Skeleton className="h-10 w-32 ml-auto" />
                                    </TableCell>
                                    </TableRow>
                                ))}
                                </TableBody>
                            </Table>
                        </div>
                   </div>
                </div>
             )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
