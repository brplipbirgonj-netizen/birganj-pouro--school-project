'use client';

import Image from 'next/image';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Student } from '@/lib/student-data';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, orderBy, FirestoreError } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Trash2, Smartphone, Search, AlertCircle, CheckCircle2, TrendingUp, Banknote, CreditCard, Wallet, PieChart as PieChartIcon, LayoutDashboard, Loader2, PlusCircle, MinusCircle, Landmark, Coins, FileText, Hash } from 'lucide-react';
import { format, isToday, isSameMonth } from 'date-fns';
import { bn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Transaction, NewTransactionData, addTransaction, getTransactions, deleteTransaction, TransactionType, PaymentMethod } from '@/lib/transactions-data';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { StudentFeeDialog } from '@/components/StudentFeeDialog';
import { DatePicker } from '@/components/ui/date-picker';
import { useAuth } from '@/hooks/useAuth';
import { FeeCollection, feeCollectionFromDoc } from '@/lib/fees-data';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, BarChart, Bar } from 'recharts';

const BENGALI_MONTHS = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

// Accounts Dashboard Component
const AccountsDashboardTab = ({ transactions, isLoading, onActionClick }: { transactions: Transaction[], isLoading: boolean, onActionClick: (type: 'income' | 'expense') => void }) => {
    const stats = useMemo(() => {
        const now = new Date();
        let todayIncome = 0;
        let monthlyIncome = 0;
        let monthlyExpense = 0;
        let cashBalance = 0;
        let bankBalance = 0;

        transactions.forEach(t => {
            const amount = Number(t.amount) || 0;
            const tDate = new Date(t.date);
            const method = t.method || 'cash';
            
            // Handle Contra Entries (Transfers)
            if (t.accountHead === 'ব্যাংকে জমা (Cash to Bank)') {
                cashBalance -= amount;
                bankBalance += amount;
                return;
            }
            if (t.accountHead === 'ব্যাংক থেকে উত্তোলন (Bank to Cash)') {
                cashBalance += amount;
                bankBalance -= amount;
                return;
            }

            if (t.type === 'income') {
                if (method === 'cash') cashBalance += amount;
                else bankBalance += amount;

                if (isToday(tDate)) todayIncome += amount;
                if (isSameMonth(tDate, now)) monthlyIncome += amount;
            } else {
                if (method === 'cash') cashBalance -= amount;
                else bankBalance -= amount;

                if (isSameMonth(tDate, now)) monthlyExpense += amount;
            }
        });

        return { todayIncome, monthlyIncome, monthlyExpense, cashBalance, bankBalance };
    }, [transactions]);

    const chartData = useMemo(() => {
        return [
            { name: 'আয়', value: stats.monthlyIncome, color: '#10b981' },
            { name: 'ব্যয়', value: stats.monthlyExpense, color: '#ef4444' }
        ];
    }, [stats]);

    const last7DaysData = useMemo(() => {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            return d;
        }).reverse();

        return last7Days.map(date => {
            const dateStr = format(date, 'yyyy-MM-dd');
            let income = 0;
            let expense = 0;
            transactions.forEach(t => {
                if (format(new Date(t.date), 'yyyy-MM-dd') === dateStr) {
                    // Contra entries aren't counted as simple income/expense for the chart
                    if (t.accountHead.includes('উত্তোলন') || t.accountHead.includes('জমা')) return;
                    if (t.type === 'income') income += t.amount;
                    else expense += t.amount;
                }
            });
            return {
                label: format(date, 'd MMM', { locale: bn }),
                income,
                expense
            };
        });
    }, [transactions]);

    if (isLoading) return <div className="p-12 text-center italic text-muted-foreground"><Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" /> ডেটা লোড হচ্ছে...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-2 border-emerald-100 bg-emerald-50/20 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Banknote className="h-24 w-24 text-emerald-900" />
                    </div>
                    <CardHeader className="pb-2 relative z-10">
                        <CardTitle className="text-xs font-black uppercase text-emerald-700">আজকের মোট আদায়</CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-black text-emerald-950">{stats.todayIncome.toLocaleString('bn-BD')} ৳</div>
                        <p className="text-[10px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> লাইভ আপডেট
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-2 border-primary/10 bg-primary/5 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Wallet className="h-24 w-24 text-primary" />
                    </div>
                    <CardHeader className="pb-2 relative z-10">
                        <CardTitle className="text-xs font-black uppercase text-primary">এই মাসের মোট আয়</CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-black text-slate-900">{stats.monthlyIncome.toLocaleString('bn-BD')} ৳</div>
                        <p className="text-[10px] font-bold text-muted-foreground mt-1">{BENGALI_MONTHS[new Date().getMonth()]} মাস</p>
                    </CardContent>
                </Card>

                <Card className="border-2 border-amber-100 bg-amber-50/20 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Coins className="h-24 w-24 text-amber-900" />
                    </div>
                    <CardHeader className="pb-2 relative z-10">
                        <CardTitle className="text-xs font-black uppercase text-amber-700">হাতে নগদ (Cash Balance)</CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-black text-amber-950">{stats.cashBalance.toLocaleString('bn-BD')} ৳</div>
                        <p className="text-[10px] font-bold text-amber-600 mt-1">অফিসে গচ্ছিত টাকা</p>
                    </CardContent>
                </Card>

                <Card className="border-2 border-blue-100 bg-blue-50/20 shadow-sm relative overflow-hidden group">
                    <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Landmark className="h-24 w-24 text-blue-900" />
                    </div>
                    <CardHeader className="pb-2 relative z-10">
                        <CardTitle className="text-xs font-black uppercase text-blue-700">ব্যাংক ব্যালেন্স (Bank Balance)</CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                        <div className="text-3xl font-black text-blue-950">{stats.bankBalance.toLocaleString('bn-BD')} ৳</div>
                        <p className="text-[10px] font-bold text-blue-600 mt-1">ব্যাংক একাউন্টের জের</p>
                    </CardContent>
                </Card>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button onClick={() => onActionClick('income')} className="h-16 text-lg font-black bg-emerald-600 hover:bg-emerald-700 shadow-lg">
                    <PlusCircle className="mr-2 h-6 w-6" /> আয় যোগ করুন
                </Button>
                <Button onClick={() => onActionClick('expense')} variant="destructive" className="h-16 text-lg font-black shadow-lg">
                    <MinusCircle className="mr-2 h-6 w-6" /> ব্যয় যোগ করুন
                </Button>
            </div>

            {/* Visual Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-2 border-black/5 shadow-md">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="text-sm font-black flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> গত ৭ দিনের আয়-ব্যয় চিত্র
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={last7DaysData}>
                                <defs>
                                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis hide />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: '2px solid black', fontWeight: 'bold', fontSize: '12px' }}
                                    formatter={(value: number) => [`${value.toLocaleString('bn-BD')} ৳`, '']}
                                />
                                <Area type="monotone" dataKey="income" name="আয়" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                                <Area type="monotone" dataKey="expense" name="ব্যয়" stroke="#ef4444" strokeWidth={3} fill="transparent" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="border-2 border-black/5 shadow-md">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="text-sm font-black flex items-center gap-2">
                            <PieChartIcon className="h-4 w-4" /> এই মাসের আয়-ব্যয় তুলনা
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px] pt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: '2px solid black', fontWeight: 'bold', fontSize: '12px' }}
                                    formatter={(value: number) => [`${value.toLocaleString('bn-BD')} ৳`, '']}
                                />
                                <Legend verticalAlign="bottom" align="center" iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

// Defaulters Tab Component
const DefaultersTab = ({ allStudents, selectedYear }: { allStudents: Student[], selectedYear: string }) => {
    const db = useFirestore();
    const { toast } = useToast();
    const [selectedMonth, setSelectedMonth] = useState<string>(BENGALI_MONTHS[new Date().getMonth()]);
    const [collections, setCollections] = useState<FeeCollection[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const classes = ['6', '7', '8', '9', '10'];

    useEffect(() => {
        if (!db) return;
        setIsLoading(true);
        const q = query(collection(db, 'feeCollections'), where('academicYear', '==', selectedYear));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setCollections(snapshot.docs.map(feeCollectionFromDoc).filter((f): f is FeeCollection => f !== null));
            setIsLoading(false);
        }, (error) => {
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [db, selectedYear]);

    const getDefaultersForClass = (cls: string) => {
        const studentsInClass = allStudents.filter(s => s.academicYear === selectedYear && s.className === cls);
        return studentsInClass.filter(student => {
            const hasPaid = collections.some(c => 
                c.studentId === student.id && 
                (c.description?.includes(selectedMonth))
            );
            return !hasPaid;
        }).sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
    };

    const handleSendReminder = (student: Student) => {
        const mobile = student.guardianMobile || student.studentMobile;
        if (!mobile) {
            toast({ variant: 'destructive', title: 'মোবাইল নম্বর নেই' });
            return;
        }
        const msg = `সম্মানিত অভিভাবক, আপনার সন্তান ${student.studentNameBn} এর ${selectedMonth} মাসের বিদ্যালয় ফি বকেয়া আছে। অনুগ্রহ করে দ্রুত পরিশোধ করুন। বীপৌউবি`;
        const encodedMsg = encodeURIComponent(msg);
        
        const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
        const separator = isIOS ? '&' : '?';
        window.location.href = `sms:${mobile}${separator}body=${encodedMsg}`;
    };

    return (
        <div className="space-y-6">
            <Card className="border-red-200">
                <CardHeader className="bg-red-50/50">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle className="text-red-900 flex items-center gap-2">
                                <AlertCircle className="h-5 w-5" /> বকেয়া তালিকা (শ্রেণিভিত্তিক)
                            </CardTitle>
                            <CardDescription>বেতন পরিশোধ করেনি এমন শিক্ষার্থীদের তালিকা দেখুন</CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="font-bold whitespace-nowrap">মাস নির্বাচন:</Label>
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="w-44 bg-white shadow-sm font-bold text-primary"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {BENGALI_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                    <Tabs defaultValue="6">
                        <TabsList className="grid w-full grid-cols-5 h-auto flex-wrap mb-6">
                            {classes.map(cls => (
                                <TabsTrigger key={cls} value={cls} className="py-2 font-bold">
                                    {classNamesMap[cls]}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                        {classes.map(cls => {
                            const defaulters = getDefaultersForClass(cls);
                            return (
                                <TabsContent key={cls} value={cls} className="mt-0">
                                    <div className="table-container">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="w-20 text-center">রোল</TableHead>
                                                    <TableHead>নাম</TableHead>
                                                    <TableHead>মোবাইল</TableHead>
                                                    <TableHead className="text-right">কার্যক্রম</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {isLoading ? (
                                                    <TableRow><TableCell colSpan={4} className="text-center py-12">লোড হচ্ছে...</TableCell></TableRow>
                                                ) : defaulters.length === 0 ? (
                                                    <TableRow><TableCell colSpan={4} className="text-center py-12 text-emerald-600 font-bold">অভিনন্দন! এই শ্রেণিতে কারো বেতন বকেয়া নেই।</TableCell></TableRow>
                                                ) : (
                                                    defaulters.map(student => (
                                                        <TableRow key={student.id}>
                                                            <TableCell className="text-center font-bold">{student.roll.toLocaleString('bn-BD')}</TableCell>
                                                            <TableCell className="font-bold">{student.studentNameBn}</TableCell>
                                                            <TableCell className="text-xs">{student.guardianMobile || student.studentMobile || '-'}</TableCell>
                                                            <TableCell className="text-right">
                                                                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleSendReminder(student)}>
                                                                    <Smartphone className="h-4 w-4 mr-2" /> SMS পাঠান
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="mt-4 p-3 bg-muted/20 text-xs font-bold text-muted-foreground flex justify-between rounded-lg">
                                        <span>মোট বকেয়া ({classNamesMap[cls]} শ্রেণি): {defaulters.length.toLocaleString('bn-BD')} জন</span>
                                        <span className="text-primary">{selectedMonth} মাস</span>
                                    </div>
                                </TabsContent>
                            )
                        })}
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
};

// Fee Collection Tab Component
const FeeCollectionTab = ({ studentsForYear, isLoading, onFeeCollected }: { studentsForYear: Student[], isLoading: boolean, onFeeCollected: () => void }) => {
    const [feeStudent, setFeeStudent] = useState<Student | null>(null);

    const classes = ['6', '7', '8', '9', '10'];

    const getStudentsByClass = (className: string): Student[] => {
        return studentsForYear.filter((student) => student.className === className);
    };

    return (
        <>
        <Tabs defaultValue="6">
            <TabsList className="grid w-full grid-cols-5 h-auto flex-wrap">
            {classes.map((className) => (
                <TabsTrigger key={className} value={className} className="py-2 text-xs sm:text-sm font-bold">
                {classNamesMap[className]}
                </TabsTrigger>
            ))}
            </TabsList>
            {classes.map((className) => (
            <TabsContent key={className} value={className}>
                <Card>
                <CardContent className="p-0">
                    <div className="table-container">
                    <Table className="min-w-[600px]">
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
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
                                <TableCell className="font-medium">{student.roll.toLocaleString('bn-BD')}</TableCell>
                                <TableCell className="whitespace-nowrap font-bold">{student.studentNameBn}</TableCell>
                                <TableCell className="whitespace-nowrap">{student.fatherNameBn}</TableCell>
                                <TableCell className="text-right">
                                <Button onClick={() => setFeeStudent(student)} size="sm">বেতন আদায়</Button>
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
        }, (error: FirestoreError) => {
            if (error.code === 'permission-denied') return;
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>বেতন আদায়ের রিপোর্ট</CardTitle>
                <div className="flex flex-col md:flex-row gap-4 mt-4 bg-muted/30 p-4 rounded-lg">
                    <div className="space-y-2 flex-1">
                        <Label>তারিখ দিয়ে ফিল্টার</Label>
                        <DatePicker value={dateFilter} onChange={setDateFilter} placeholder="তারিখ নির্বাচন করুন" />
                    </div>
                    <div className="space-y-2 flex-1">
                        <Label>আদায়কারী</Label>
                        <Select value={collectorFilter} onValueChange={setCollectorFilter}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="সকল আদায়কারী" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">সকল আদায়কারী</SelectItem>
                                {uniqueCollectors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="table-container">
                    <Table className="min-w-[850px]">
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
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
                                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">লোড হচ্ছে...</TableCell></TableRow>
                            ) : filteredCollections.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">কোনো রেকর্ড পাওয়া যায়নি।</TableCell></TableRow>
                            ) : (
                                filteredCollections.map(c => {
                                    const student = studentMap.get(c.studentId);
                                    return (
                                        <TableRow key={c.id} className="hover:bg-accent/5 transition-colors">
                                            <TableCell className="whitespace-nowrap">{format(c.collectionDate, 'PP', { locale: bn })}</TableCell>
                                            <TableCell className="font-bold">{student?.roll.toLocaleString('bn-BD') || '-'}</TableCell>
                                            <TableCell className="whitespace-nowrap font-bold text-primary">{student?.studentNameBn || '-'}</TableCell>
                                            <TableCell className="whitespace-nowrap">{student ? (classNamesMap[student.className] || student.className) : '-'}</TableCell>
                                            <TableCell className="text-right font-black text-emerald-700">{(c.totalAmount ?? 0).toLocaleString('bn-BD')} ৳</TableCell>
                                            <TableCell className="whitespace-nowrap text-xs">{c.collectorName || '-'}</TableCell>
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

// New Transaction Tab Component (Includes Income and Expense Entry)
const NewTransactionTab = ({ onTransactionAdded, initialType = 'income' }: { onTransactionAdded: () => void, initialType?: TransactionType }) => {
    const { toast } = useToast();
    const db = useFirestore();
    const { user } = useAuth();
    const { selectedYear } = useAcademicYear();

    const [date, setDate] = useState<Date | undefined>(new Date());
    const [type, setType] = useState<TransactionType>(initialType);
    const [method, setMethod] = useState<PaymentMethod>('cash');
    const [accountHead, setAccountHead] = useState('');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState<number | ''>('');
    const [voucherNo, setVoucherNo] = useState('');
    const [checkNo, setCheckNo] = useState('');

    const incomeHeads = ['বেতন (Tuition Fee)', 'পরীক্ষা ফি (Exam Fee)', 'ভর্তি ফি (Admission Fee)', 'সেশন ফি (Session Fee)', 'অনুদন (Donation)', 'ব্যাংক থেকে উত্তোলন (Bank to Cash)', 'অন্যান্য'];
    const expenseHeads = ['শিক্ষক/স্টাফ বেতন', 'বিদ্যুৎ ও ইউটিলিটি বিল', 'স্টেশনারি ও খাতা', 'মেরামত ও রক্ষণাবেক্ষণ', 'আপ্যায়ন খরচ', 'ব্যাংকে জমা (Cash to Bank)', 'অন্যান্য'];

    useEffect(() => {
        setType(initialType);
        setAccountHead('');
    }, [initialType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !user || !date || !type || !accountHead || !amount || amount <= 0) {
            toast({ variant: 'destructive', title: 'অনুগ্রহ করে সকল তথ্য পূরণ করুন এবং টাকার পরিমাণ শূন্যের বেশি রাখুন।' });
            return;
        }

        const newTransaction: NewTransactionData = {
            date,
            type,
            method,
            accountHead,
            description,
            amount: Number(amount),
            academicYear: selectedYear,
            voucherNo: type === 'expense' ? voucherNo : undefined,
            checkNo: method === 'bank' ? checkNo : undefined
        };

        try {
            await addTransaction(db, newTransaction);
            toast({ title: type === 'income' ? 'আয় যোগ হয়েছে।' : 'ব্যয় যোগ হয়েছে।', description: method === 'bank' ? 'ব্যাংক লেনদেন হিসেবে রেকর্ড করা হয়েছে।' : 'নগদ লেনদেন হিসেবে রেকর্ড করা হয়েছে।' });
            // Reset form
            setDate(new Date());
            setAccountHead('');
            setDescription('');
            setAmount('');
            setVoucherNo('');
            setCheckNo('');
            onTransactionAdded(); // Notify parent to refetch transactions
        } catch (error) {
            // Error is handled by the global listener
        }
    };

    return (
        <div className="pb-40">
            <Card className={cn("border-2", type === 'income' ? "border-emerald-100" : "border-rose-100")}>
                <CardHeader className={cn(type === 'income' ? "bg-emerald-50/50" : "bg-rose-50/50")}>
                    <CardTitle className="flex items-center gap-2">
                        {type === 'income' ? <PlusCircle className="text-emerald-600" /> : <MinusCircle className="text-rose-600" />}
                        নতুন {type === 'income' ? 'আয়' : 'ব্যয়'} এন্ট্রি করুন
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="date">তারিখ</Label>
                                <DatePicker value={date} onChange={setDate} placeholder="তারিখ" />
                            </div>
                            <div className="space-y-2">
                                <Label>লেনদেনের ধরণ</Label>
                                <RadioGroup value={type} onValueChange={(v) => { setType(v as TransactionType); setAccountHead(''); }} className="flex items-center space-x-4 pt-2">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="income" id="income" />
                                        <Label htmlFor="income" className="font-bold text-emerald-700">আয়</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="expense" id="expense" />
                                        <Label htmlFor="expense" className="font-bold text-rose-700">ব্যয়</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                            <div className="space-y-2">
                                <Label>পেমেন্ট পদ্ধতি</Label>
                                <RadioGroup value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} className="flex items-center space-x-4 pt-2">
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="cash" id="meth-cash" />
                                        <Label htmlFor="meth-cash" className="font-bold">নগদ (Cash)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="bank" id="meth-bank" />
                                        <Label htmlFor="meth-bank" className="font-bold">ব্যাংক (Bank)</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="account-head">খাত (Account Head)</Label>
                                <Select value={accountHead} onValueChange={setAccountHead}>
                                    <SelectTrigger id="account-head" className="bg-white font-bold"><SelectValue placeholder="খাত নির্বাচন করুন" /></SelectTrigger>
                                    <SelectContent>
                                        {(type === 'income' ? incomeHeads : expenseHeads).map(head => (
                                            <SelectItem key={head} value={head}>{head}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="amount">টাকার পরিমাণ</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 font-bold text-muted-foreground">৳</span>
                                    <input id="amount" type="number" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-8 text-lg font-black ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50" />
                                </div>
                            </div>

                            {type === 'expense' && (
                                <div className="space-y-2 animate-in slide-in-from-top-2">
                                    <Label htmlFor="voucherNo" className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-rose-500" /> ভাউচার নং
                                    </Label>
                                    <Input id="voucherNo" value={voucherNo} onChange={e => setVoucherNo(e.target.value)} placeholder="উদা: ই-১২৩" className="font-bold" />
                                </div>
                            )}

                            {method === 'bank' && (
                                <div className="space-y-2 animate-in slide-in-from-top-2">
                                    <Label htmlFor="checkNo" className="flex items-center gap-2">
                                        <Hash className="h-4 w-4 text-blue-500" /> চেক নং (Check No)
                                    </Label>
                                    <Input id="checkNo" value={checkNo} onChange={e => setCheckNo(e.target.value)} placeholder="উদা: ৪০২৩৪৫" className="font-bold" />
                                </div>
                            )}

                            <div className="lg:col-span-3 space-y-2">
                                <Label htmlFor="description">বিবরণ / মন্তব্য (ঐচ্ছিক)</Label>
                                <Input id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="বিস্তারিত তথ্য লিখুন..." />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <Button type="submit" size="lg" className={cn("px-12 font-black shadow-lg", type === 'income' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700")}>
                                {type === 'income' ? 'আয় সেভ করুন' : 'ব্যয় সেভ করুন'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
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
            // Check for Contra (Bank Transfers)
            if (tx.accountHead === 'ব্যাংকে জমা (Cash to Bank)') {
                balance -= tx.amount;
            } else if (tx.accountHead === 'ব্যাংক থেকে উত্তোলন (Bank to Cash)') {
                balance += tx.amount;
            } else {
                if (tx.type === 'income') {
                    balance += tx.amount;
                } else {
                    balance -= tx.amount;
                }
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
                <div className="table-container">
                    <Table className="min-w-[950px]">
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="font-bold">তারিখ</TableHead>
                                <TableHead className="font-bold">বিবরণ</TableHead>
                                <TableHead className="text-center font-bold">পদ্ধতি</TableHead>
                                <TableHead className="text-center font-bold">ভাউচার/চেক</TableHead>
                                <TableHead className="text-right font-bold">আয়</TableHead>
                                <TableHead className="text-right font-bold">ব্যয়</TableHead>
                                <TableHead className="text-right font-bold">ব্য্যালেন্স</TableHead>
                                {canManageTransactions && <TableHead className="text-right font-bold">কার্যক্রম</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={canManageTransactions ? 8 : 7} className="text-center p-12 text-muted-foreground"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow>
                            ) : cashbookData.length === 0 ? (
                                <TableRow><TableCell colSpan={canManageTransactions ? 8 : 7} className="text-center p-12 text-muted-foreground italic">কোনো লেনদেন পাওয়া যায়নি।</TableCell></TableRow>
                            ) : (
                                [...cashbookData].reverse().map(tx => (
                                    <TableRow key={tx.id} className="hover:bg-accent/5">
                                        <TableCell className="whitespace-nowrap">{format(new Date(tx.date), 'PP', { locale: bn })}</TableCell>
                                        <TableCell>
                                            <p className="font-bold">{tx.accountHead}</p>
                                            {tx.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{tx.description}</p>}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={cn(
                                                "text-[10px] font-bold px-2 py-0.5",
                                                tx.method === 'bank' ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700"
                                            )}>
                                                {tx.method === 'bank' ? 'Bank' : 'Cash'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex flex-col gap-1 items-center">
                                                {tx.voucherNo && <Badge variant="outline" className="bg-rose-50 text-rose-600 text-[9px] border-rose-100">V: {tx.voucherNo}</Badge>}
                                                {tx.checkNo && <Badge variant="outline" className="bg-blue-50 text-blue-600 text-[9px] border-blue-100">C: {tx.checkNo}</Badge>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right text-emerald-600 font-bold">
                                            {tx.accountHead.includes('উত্তোলন') ? tx.amount.toLocaleString('bn-BD') : (tx.type === 'income' && !tx.accountHead.includes('জমা') ? tx.amount.toLocaleString('bn-BD') : '-')}
                                        </TableCell>
                                        <TableCell className="text-right text-rose-600 font-bold">
                                            {tx.accountHead.includes('জমা') ? tx.amount.toLocaleString('bn-BD') : (tx.type === 'expense' && !tx.accountHead.includes('উত্তোলন') ? tx.amount.toLocaleString('bn-BD') : '-')}
                                        </TableCell>
                                        <TableCell className="text-right font-black text-primary">{tx.balance.toLocaleString('bn-BD')} ৳</TableCell>
                                        {canManageTransactions && (
                                            <TableCell className="text-right">
                                                <div className="flex justify-end">
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" disabled={!!tx.feeCollectionId} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                                                                <AlertDialogDescription>এই লেনদেনটি স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDelete(tx.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">মুছে ফেলুন</AlertDialogAction>
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
                    <p className="text-center p-12 text-muted-foreground"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></p>
                ) : Object.keys(ledgerData).length === 0 ? (
                    <p className="text-center p-12 text-muted-foreground italic">কোনো লেনদেন পাওয়া যায়নি।</p>
                ) : (
                    <Accordion type="multiple" className="w-full space-y-2">
                        {Object.entries(ledgerData).map(([head, data]) => (
                             <AccordionItem value={head} key={head} className="border-2 rounded-lg px-2 overflow-hidden">
                                <AccordionTrigger className="hover:no-underline">
                                    <div className="flex flex-col sm:flex-row justify-between w-full pr-4 text-left gap-2">
                                        <span className="font-bold text-primary">{head}</span>
                                        <div className="flex gap-4 text-xs">
                                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">আয়: {data.income.toLocaleString('bn-BD')}</span>
                                            <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">ব্যয়: {data.expense.toLocaleString('bn-BD')}</span>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2">
                                    <div className="table-container">
                                        <Table className="min-w-[600px]">
                                            <TableHeader className="bg-muted/30 sticky top-0 z-10">
                                                <TableRow>
                                                    <TableHead>তারিখ</TableHead>
                                                    <TableHead>বিবরণ</TableHead>
                                                    <TableHead className="text-right">আয়</TableHead>
                                                    <TableHead className="text-right">ব্যয়</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {data.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => (
                                                    <TableRow key={tx.id}>
                                                        <TableCell className="whitespace-nowrap">{format(new Date(tx.date), 'PP', { locale: bn })}</TableCell>
                                                        <TableCell className="max-w-[200px] truncate">
                                                            {tx.description || '-'}
                                                            {(tx.voucherNo || tx.checkNo) && (
                                                                <div className="flex gap-1 mt-1">
                                                                    {tx.voucherNo && <Badge variant="outline" className="text-[8px] font-black h-4">V: {tx.voucherNo}</Badge>}
                                                                    {tx.checkNo && <Badge variant="outline" className="text-[8px] font-black h-4">C: {tx.checkNo}</Badge>}
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right text-emerald-600 font-medium">{tx.type === 'income' ? tx.amount.toLocaleString('bn-BD') : '-'}</TableCell>
                                                        <TableCell className="text-right text-rose-600 font-medium">{tx.type === 'expense' ? tx.amount.toLocaleString('bn-BD') : '-'}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
            </CardContent>
        </Card>
    );
};


export default function AccountsPage() {
  const [isClient, setIsClient] = useState(false);
  const db = useFirestore();
  const { user, hasPermission } = useAuth();
  const { selectedYear } = useAcademicYear();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  
  const [activeTab, setActiveTab] = useState("dashboard");
  const [pendingEntryType, setPendingEntryType] = useState<TransactionType>('income');

  const canCollectFees = hasPermission('collect:fees');
  const canViewReports = hasPermission('view:collection-report');
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
    }, (error: FirestoreError) => {
        if (error.code === 'permission-denied') return;
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

  const tabs = [{ value: "dashboard", label: "ড্যাশবোর্ড" }];
  if (canCollectFees) {
      tabs.push({ value: "fee-collection", label: "আদায়" });
      tabs.push({ value: "defaulters", label: "বকেয়া" });
  }
  if (canViewReports) {
      tabs.push({ value: "collection-report", label: "রিপোর্ট" });
  }
  tabs.push({ value: "cashbook", label: "ক্যাশবুক" });
  tabs.push({ value: "ledger", label: "খতিয়ান" });
  if (canManageTransactions) tabs.push({ value: "new-transaction", label: "আয়/ব্যয় এন্ট্রি" });

  const handleDashboardAction = (type: TransactionType) => {
    setPendingEntryType(type);
    setActiveTab("new-transaction");
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-teal-100 font-kalpurush">
      <Header />
      <main className="p-4 md:p-8 pb-[500px]">
        <Card className="border-2 border-primary/10">
          <CardHeader>
             <CardTitle className="text-3xl font-black">হিসাব শাখা</CardTitle>
            {isClient && <p className="text-sm font-medium text-muted-foreground">শিক্ষাবর্ষ: {selectedYear.toLocaleString('bn-BD')}</p>}
          </CardHeader>
          <CardContent>
             {isClient ? (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="inline-flex h-auto flex-wrap items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full mb-6">
                    {tabs.map(tab => <TabsTrigger key={tab.value} value={tab.value} className="flex-1 min-w-[80px] font-bold">{tab.label}</TabsTrigger>)}
                  </TabsList>
                  
                  <TabsContent value="dashboard" className="mt-4">
                      <AccountsDashboardTab transactions={transactions} isLoading={isLoading} onActionClick={handleDashboardAction} />
                  </TabsContent>

                  {canCollectFees && (
                    <>
                    <TabsContent value="fee-collection" className="mt-4">
                        <FeeCollectionTab studentsForYear={studentsForYear} isLoading={isLoadingStudents} onFeeCollected={fetchTransactions} />
                    </TabsContent>
                    <TabsContent value="defaulters" className="mt-4">
                        <DefaultersTab allStudents={allStudents} selectedYear={selectedYear} />
                    </TabsContent>
                    </>
                  )}
                  
                  {canViewReports && (
                    <TabsContent value="collection-report" className="mt-4">
                        <CollectionReportTab allStudents={allStudents} />
                    </TabsContent>
                  )}

                   <TabsContent value="cashbook" className="mt-4">
                    <CashbookTab transactions={transactions} isLoading={isLoading} refetch={fetchTransactions} />
                  </TabsContent>
                   <TabsContent value="ledger" className="mt-4">
                    <LedgerTab transactions={transactions} isLoading={isLoading} />
                  </TabsContent>
                   {canManageTransactions && (
                    <TabsContent value="new-transaction" className="mt-4">
                      <NewTransactionTab onTransactionAdded={fetchTransactions} initialType={pendingEntryType} />
                    </TabsContent>
                   )}
                </Tabs>
             ) : (
                <div className="space-y-4">
                  <Skeleton className="h-12 w-full rounded-md" />
                  <Skeleton className="h-64 w-full rounded-md" />
                </div>
             )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
