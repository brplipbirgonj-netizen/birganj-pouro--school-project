'use client';

import Image from 'next/image';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { Trash2, Smartphone, Search, AlertCircle, TrendingUp, Banknote, CreditCard, Wallet, PieChart as PieChartIcon, LayoutDashboard, Loader2, PlusCircle, MinusCircle, Landmark, Coins, FileText, Hash, ChevronRight, BookOpen, LayoutGrid, ListChecks } from 'lucide-react';
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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';

const BENGALI_MONTHS = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const classNamesMap: { [key: string]: string } = { '6': 'ষষ্ঠ শ্রেণি', '7': 'সপ্তম শ্রেণি', '8': 'অষ্টম শ্রেণি', '9': 'নবম শ্রেণি', '10': 'দশম শ্রেণি' };

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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button onClick={() => onActionClick('income')} className="h-16 text-lg font-black bg-emerald-600 hover:bg-emerald-700 shadow-lg">
                    <PlusCircle className="mr-2 h-6 w-6" /> আয় যোগ করুন
                </Button>
                <Button onClick={() => onActionClick('expense')} variant="destructive" className="h-16 text-lg font-black shadow-lg">
                    <MinusCircle className="mr-2 h-6 w-6" /> ব্যয় যোগ করুন
                </Button>
            </div>

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
                    <CardContent className="h-[350px] pt-4">
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
        <div className="space-y-6 animate-in fade-in duration-500">
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
                                <SelectTrigger className="w-44 bg-white shadow-sm font-bold text-primary h-9 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {BENGALI_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                    <div className="flex flex-col gap-8">
                        {classes.map(cls => {
                            const defaulters = getDefaultersForClass(cls);
                            if (defaulters.length === 0) return null;
                            return (
                                <div key={cls} className="space-y-3">
                                    <h3 className="font-black text-lg text-slate-800 border-l-4 border-red-500 pl-3">{classNamesMap[cls]} শ্রেণি</h3>
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
                                                {defaulters.map(student => (
                                                    <TableRow key={student.id}>
                                                        <TableCell className="text-center font-bold">{student.roll.toLocaleString('bn-BD')}</TableCell>
                                                        <TableCell className="font-bold">{student.studentNameBn}</TableCell>
                                                        <TableCell className="text-xs">{student.guardianMobile || student.studentMobile || '-'}</TableCell>
                                                        <TableCell className="text-right">
                                                            <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50 h-8 text-xs font-bold" onClick={() => handleSendReminder(student)}>
                                                                <Smartphone className="h-3.5 w-3.5 mr-2" /> SMS পাঠান
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )
                        })}
                        {isLoading && <div className="text-center p-20 italic">তথ্য লোড হচ্ছে...</div>}
                        {!isLoading && classes.every(cls => getDefaultersForClass(cls).length === 0) && (
                            <div className="text-center py-20 text-emerald-600 font-black text-xl">অভিনন্দন! কারো বেতন বকেয়া নেই।</div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// Fee Collection Tab Component
const FeeCollectionTab = ({ studentsForYear, isLoading, onFeeCollected }: { studentsForYear: Student[], isLoading: boolean, onFeeCollected: () => void }) => {
    const [feeStudent, setFeeStudent] = useState<Student | null>(null);
    const [selectedClass, setSelectedClass] = useState('6');
    const classes = ['6', '7', '8', '9', '10'];

    const filteredStudents = useMemo(() => {
        return studentsForYear.filter((student) => student.className === selectedClass);
    }, [studentsForYear, selectedClass]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg bg-white/50 items-end">
                <div className="space-y-2 flex-1">
                    <Label className="font-bold text-primary">শ্রেণি নির্বাচন</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger className="bg-white h-9 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {classes.map(c => <SelectItem key={c} value={c}>{classNamesMap[c]} শ্রেণি</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="border-2 border-teal-100 shadow-lg">
                <CardContent className="p-0">
                    <div className="table-container">
                    <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="text-center w-20">রোল</TableHead>
                            <TableHead>শিক্ষার্থীর নাম</TableHead>
                            <TableHead>পিতার নাম</TableHead>
                            <TableHead className="text-right">কার্যক্রম</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-20 italic">লোড হচ্ছে...</TableCell></TableRow>
                        ) : filteredStudents.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-20 italic">এই শ্রেণিতে কোনো শিক্ষার্থী নেই।</TableCell></TableRow>
                        ) : (
                            filteredStudents.map((student) => (
                            <TableRow key={student.id}>
                                <TableCell className="font-black text-center">{student.roll.toLocaleString('bn-BD')}</TableCell>
                                <TableCell className="whitespace-nowrap font-bold text-slate-800">{student.studentNameBn}</TableCell>
                                <TableCell className="whitespace-nowrap text-muted-foreground">{student.fatherNameBn}</TableCell>
                                <TableCell className="text-right">
                                <Button onClick={() => setFeeStudent(student)} size="sm" className="bg-teal-600 hover:bg-teal-700 font-bold h-8 text-xs">বেতন আদায়</Button>
                                </TableCell>
                            </TableRow>
                            ))
                        )}
                        </TableBody>
                    </Table>
                    </div>
                </CardContent>
            </Card>
            <StudentFeeDialog student={feeStudent} open={!!feeStudent} onOpenChange={() => setFeeStudent(null)} onFeeCollected={onFeeCollected} />
        </div>
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
        const q = query(collection(db, 'feeCollections'), where('academicYear', '==', selectedYear));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs
                .map(doc => feeCollectionFromDoc(doc))
                .filter((c): c is FeeCollection => c !== null)
                .sort((a, b) => b.collectionDate.getTime() - a.collectionDate.getTime());
            setCollections(data);
            setIsLoading(false);
        }, (error: FirestoreError) => {
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
        collections.forEach(c => { if (c.collectorName) collectors.add(c.collectorName); });
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
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row gap-4 bg-muted/30 p-4 rounded-lg">
                <div className="space-y-2 flex-1">
                    <Label className="text-xs font-bold">তারিখ দিয়ে ফিল্টার</Label>
                    <DatePicker value={dateFilter} onChange={setDateFilter} placeholder="তারিখ নির্বাচন করুন" />
                </div>
                <div className="space-y-2 flex-1">
                    <Label className="text-xs font-bold">আদায়কারী</Label>
                    <Select value={collectorFilter} onValueChange={setCollectorFilter}>
                        <SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="সকল আদায়কারী" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">সকল আদায়কারী</SelectItem>
                            {uniqueCollectors.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            <Card className="border-none shadow-none">
                <CardHeader className="px-0 pt-0">
                    <CardTitle className="text-xl">আদায় রিপোর্ট</CardTitle>
                </CardHeader>
                <CardContent className="px-0 pt-2">
                    <div className="table-container">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead>তারিখ</TableHead>
                                    <TableHead className="text-center w-20">রোল</TableHead>
                                    <TableHead>নাম</TableHead>
                                    <TableHead>শ্রেণি</TableHead>
                                    <TableHead className="text-right">মোট আদায়</TableHead>
                                    <TableHead>আদায়কারী</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-20 italic">লোড হচ্ছে...</TableCell></TableRow>
                                ) : filteredCollections.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-20 italic">কোনো রেকর্ড পাওয়া যায়নি।</TableCell></TableRow>
                                ) : (
                                    filteredCollections.map(c => {
                                        const student = studentMap.get(c.studentId);
                                        return (
                                            <TableRow key={c.id} className="hover:bg-accent/5">
                                                <TableCell className="whitespace-nowrap">{format(c.collectionDate, 'PP', { locale: bn })}</TableCell>
                                                <TableCell className="font-black text-center">{student?.roll.toLocaleString('bn-BD') || '-'}</TableCell>
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
        </div>
    );
};

// New Transaction Tab Component
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

    useEffect(() => { setType(initialType); setAccountHead(''); }, [initialType]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !user || !date || !type || !accountHead || !amount || amount <= 0) {
            toast({ variant: 'destructive', title: 'অনুগ্রহ করে সকল তথ্য পূরণ করুন।' });
            return;
        }

        const newTransaction: NewTransactionData = {
            date, type, method, accountHead, description, amount: Number(amount), academicYear: selectedYear,
            voucherNo: type === 'expense' ? voucherNo : undefined,
            checkNo: method === 'bank' ? checkNo : undefined
        };

        try {
            await addTransaction(db, newTransaction);
            toast({ title: 'লেনদেন সফলভাবে যোগ হয়েছে।' });
            setAccountHead(''); setDescription(''); setAmount(''); setVoucherNo(''); setCheckNo('');
            onTransactionAdded();
        } catch (error) {}
    };

    return (
        <Card className={cn("border-2 shadow-lg animate-in fade-in duration-500", type === 'income' ? "border-emerald-100" : "border-rose-100")}>
            <CardHeader className={cn("rounded-t-lg p-4", type === 'income' ? "bg-emerald-50/50" : "bg-rose-50/50")}>
                <CardTitle className="flex items-center gap-2 text-lg">
                    {type === 'income' ? <PlusCircle className="text-emerald-600" /> : <MinusCircle className="text-rose-600" />}
                    নতুন {type === 'income' ? 'আয়' : 'ব্যয়'} এন্ট্রি করুন
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="space-y-2"><Label className="text-xs font-bold">তারিখ</Label><DatePicker value={date} onChange={setDate} /></div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold">লেনদেনের ধরণ</Label>
                            <RadioGroup value={type} onValueChange={(v) => { setType(v as TransactionType); setAccountHead(''); }} className="flex items-center space-x-4 pt-2">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="income" id="inc" /><Label htmlFor="inc" className="font-bold text-emerald-700">আয়</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="expense" id="exp" /><Label htmlFor="exp" className="font-bold text-rose-700">ব্যয়</Label></div>
                            </RadioGroup>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold">পেমেন্ট পদ্ধতি</Label>
                            <RadioGroup value={method} onValueChange={(v) => setMethod(v as PaymentMethod)} className="flex items-center space-x-4 pt-2">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="cash" id="m-cash" /><Label htmlFor="m-cash" className="font-bold">নগদ</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="bank" id="m-bank" /><Label htmlFor="m-bank" className="font-bold">ব্যাংক</Label></div>
                            </RadioGroup>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold">খাত (Account Head)</Label>
                            <Select value={accountHead} onValueChange={setAccountHead}>
                                <SelectTrigger className="bg-white h-9 text-xs"><SelectValue placeholder="খাত নির্বাচন করুন" /></SelectTrigger>
                                <SelectContent>{(type === 'income' ? incomeHeads : expenseHeads).map(head => <SelectItem key={head} value={head}>{head}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold">টাকার পরিমাণ</Label>
                            <div className="relative"><span className="absolute left-3 top-2.5 font-bold text-muted-foreground">৳</span><input type="number" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pl-8 text-lg font-black ring-offset-background" /></div>
                        </div>
                        {type === 'expense' && <div className="space-y-2"><Label className="text-xs font-bold">ভাউচার নং</Label><Input value={voucherNo} onChange={e => setVoucherNo(e.target.value)} placeholder="উদা: ই-১২৩" className="h-9 text-xs" /></div>}
                        {method === 'bank' && <div className="space-y-2"><Label className="text-xs font-bold">চেক নং</Label><Input value={checkNo} onChange={e => setCheckNo(e.target.value)} placeholder="উদা: ৪০২৩৪৫" className="h-9 text-xs" /></div>}
                        <div className="lg:col-span-3 space-y-2"><Label className="text-xs font-bold">বিবরণ / মন্তব্য (ঐচ্ছিক)</Label><Input value={description} onChange={e => setDescription(e.target.value)} placeholder="বিস্তারিত তথ্য লিখুন..." className="h-9 text-xs" /></div>
                    </div>
                    <div className="flex justify-end pt-4"><Button type="submit" size="lg" className={cn("px-12 font-black shadow-lg h-12", type === 'income' ? "bg-emerald-600" : "bg-rose-600")}>সেভ করুন</Button></div>
                </form>
            </CardContent>
        </Card>
    );
};

// Cashbook Tab Component
const CashbookTab = ({ transactions, isLoading, refetch }: { transactions: Transaction[], isLoading: boolean, refetch: () => void }) => {
    const db = useFirestore();
    const { toast } = useToast();
    const { user, hasPermission } = useAuth();
    const canManageTransactions = hasPermission('manage:transactions');

    const cashbookData = useMemo(() => {
        let balance = 0;
        return [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(tx => {
            if (tx.accountHead === 'ব্যাংকে জমা (Cash to Bank)') balance -= tx.amount;
            else if (tx.accountHead === 'ব্যাংক থেকে উত্তোলন (Bank to Cash)') balance += tx.amount;
            else if (tx.type === 'income') balance += tx.amount;
            else balance -= tx.amount;
            return { ...tx, balance };
        });
    }, [transactions]);

    const handleDelete = async (id: string) => {
        if(!db) return;
        try { await deleteTransaction(db, id); toast({ title: 'লেনদেন মুছে ফেলা হয়েছে।' }); refetch(); } catch (error) {}
    }

    return (
        <Card className="border-none shadow-none animate-in fade-in duration-500">
            <CardHeader className="px-0 pt-0"><CardTitle className="text-xl">ক্যাশবুক</CardTitle></CardHeader>
            <CardContent className="px-0 pt-4">
                <div className="table-container">
                    <Table className="min-w-[950px]">
                        <TableHeader className="bg-muted/50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead>তারিখ</TableHead>
                                <TableHead>বিবরণ</TableHead>
                                <TableHead className="text-center">পদ্ধতি</TableHead>
                                <TableHead className="text-center">ভাউচার/চেক</TableHead>
                                <TableHead className="text-right">আয়</TableHead>
                                <TableHead className="text-right">ব্যয়</TableHead>
                                <TableHead className="text-right">ব্য্যালেন্স</TableHead>
                                {canManageTransactions && <TableHead className="text-right">কার্যক্রম</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-20 italic">লোড হচ্ছে...</TableCell></TableRow>
                            ) : cashbookData.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-20 italic">কোনো লেনদেন পাওয়া যায়নি।</TableCell></TableRow>
                            ) : (
                                [...cashbookData].reverse().map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell className="whitespace-nowrap">{format(new Date(tx.date), 'PP', { locale: bn })}</TableCell>
                                        <TableCell><p className="font-bold text-xs">{tx.accountHead}</p><p className="text-[9px] text-muted-foreground truncate max-w-[200px]">{tx.description}</p></TableCell>
                                        <TableCell className="text-center"><Badge variant="outline" className={cn("text-[9px] font-black", tx.method === 'bank' ? "text-blue-700 bg-blue-50" : "text-amber-700 bg-amber-50")}>{tx.method === 'bank' ? 'Bank' : 'Cash'}</Badge></TableCell>
                                        <TableCell className="text-center"><div className="flex flex-col gap-1 items-center">{tx.voucherNo && <Badge className="text-[8px] bg-rose-50 text-rose-600">V: {tx.voucherNo}</Badge>}{tx.checkNo && <Badge className="text-[8px] bg-blue-50 text-blue-600">C: {tx.checkNo}</Badge>}</div></TableCell>
                                        <TableCell className="text-right text-emerald-600 font-bold">{tx.type === 'income' ? tx.amount.toLocaleString('bn-BD') : '-'}</TableCell>
                                        <TableCell className="text-right text-rose-600 font-bold">{tx.type === 'expense' ? tx.amount.toLocaleString('bn-BD') : '-'}</TableCell>
                                        <TableCell className="text-right font-black text-primary">{tx.balance.toLocaleString('bn-BD')} ৳</TableCell>
                                        {canManageTransactions && (
                                            <TableCell className="text-right">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" disabled={!!tx.feeCollectionId} className="text-rose-500 h-8 w-8"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>মুছে ফেলতে চান?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>না</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(tx.id)}>হ্যাঁ</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
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
    );
};

// Ledger Tab Component
const LedgerTab = ({ transactions, isLoading }: { transactions: Transaction[], isLoading: boolean }) => {
    const ledgerData = useMemo(() => {
        const grouped: Record<string, { income: number, expense: number, items: Transaction[] }> = {};
        transactions.forEach(tx => {
            if (!grouped[tx.accountHead]) grouped[tx.accountHead] = { income: 0, expense: 0, items: [] };
            if (tx.type === 'income') grouped[tx.accountHead].income += tx.amount;
            else grouped[tx.accountHead].expense += tx.amount;
            grouped[tx.accountHead].items.push(tx);
        });
        return grouped;
    }, [transactions]);
    
    return (
         <Card className="border-none shadow-none animate-in fade-in duration-500">
             <CardHeader className="px-0 pt-0"><CardTitle className="text-xl">খতিয়ান (লেজার)</CardTitle></CardHeader>
            <CardContent className="px-0 pt-4">
                {isLoading ? <p className="text-center py-20 italic">লোড হচ্ছে...</p> : Object.keys(ledgerData).length === 0 ? <p className="text-center py-20 italic">তথ্য নেই</p> : (
                    <Accordion type="multiple" className="w-full space-y-3">
                        {Object.entries(ledgerData).map(([head, data]) => (
                             <AccordionItem value={head} key={head} className="border-2 rounded-xl px-4 bg-white shadow-sm overflow-hidden">
                                <AccordionTrigger className="hover:no-underline font-black text-base py-4">
                                    <div className="flex justify-between w-full pr-4 text-left">
                                        <span>{head}</span>
                                        <div className="flex gap-4 text-[10px]">
                                            <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-100">আয়: {data.income.toLocaleString('bn-BD')}</Badge>
                                            <Badge variant="outline" className="text-rose-700 bg-rose-50 border-rose-100">ব্যয়: {data.expense.toLocaleString('bn-BD')}</Badge>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 p-0">
                                    <div className="table-container max-h-[300px]">
                                        <Table>
                                            <TableHeader className="bg-muted/30"><TableRow><TableHead>তারিখ</TableHead><TableHead>বিবরণ</TableHead><TableHead className="text-right">আয়</TableHead><TableHead className="text-right">ব্যয়</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {data.items.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(tx => (
                                                    <TableRow key={tx.id} className="h-10">
                                                        <TableCell className="text-xs">{format(new Date(tx.date), 'PP', { locale: bn })}</TableCell>
                                                        <TableCell className="text-[10px]">{tx.description || '-'}</TableCell>
                                                        <TableCell className="text-right font-bold text-emerald-600 text-xs">{tx.type === 'income' ? tx.amount.toLocaleString('bn-BD') : '-'}</TableCell>
                                                        <TableCell className="text-right font-bold text-rose-600 text-xs">{tx.type === 'expense' ? tx.amount.toLocaleString('bn-BD') : '-'}</TableCell>
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
  const [activeSection, setActiveSection] = useState("dashboard");
  const [pendingEntryType, setPendingEntryType] = useState<TransactionType>('income');

  const fetchTransactions = useCallback(async () => {
    if (!db || !user) return;
    setIsLoading(true);
    const fetched = await getTransactions(db, selectedYear);
    setTransactions(fetched);
    setIsLoading(false);
  }, [db, user, selectedYear]);

  const fetchStudents = useCallback(() => {
    if (!db || !user) return;
    setIsLoadingStudents(true);
    const unsubscribe = onSnapshot(query(collection(db, "students")), (snap) => {
        setAllStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[]);
        setIsLoadingStudents(false);
    }, (error) => { setIsLoadingStudents(false); });
    return unsubscribe;
  }, [db, user]);

  useEffect(() => { setIsClient(true); fetchTransactions(); const unsub = fetchStudents(); return () => unsub?.(); }, [fetchTransactions, fetchStudents]);

  const canCollectFees = hasPermission('collect:fees');
  const canViewReports = hasPermission('view:collection-report');
  const canManageTransactions = hasPermission('manage:transactions');

  const sidebarItems = useMemo(() => {
    const items = [{ id: 'dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard, color: 'text-indigo-600 bg-indigo-50' }];
    if (canCollectFees) {
        items.push({ id: 'fee-collection', label: 'বেতন আদায়', icon: Banknote, color: 'text-emerald-600 bg-emerald-50' });
        items.push({ id: 'defaulters', label: 'বকেয়া তালিকা', icon: AlertCircle, color: 'text-rose-600 bg-rose-50' });
    }
    if (canViewReports) items.push({ id: 'collection-report', label: 'আদায় রিপোর্ট', icon: ListChecks, color: 'text-violet-600 bg-violet-50' });
    items.push({ id: 'cashbook', label: 'ক্যাশবুক', icon: BookOpen, color: 'text-blue-600 bg-blue-50' });
    items.push({ id: 'ledger', label: 'খতিয়ান (লেজার)', icon: LayoutGrid, color: 'text-amber-600 bg-amber-50' });
    if (canManageTransactions) items.push({ id: 'new-transaction', label: 'আয়/ব্যয় এন্ট্রি', icon: PlusCircle, color: 'text-primary bg-primary/10' });
    return items;
  }, [canCollectFees, canViewReports, canManageTransactions]);

  if (!isClient) return null;

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F6F7F9] font-kalpurush">
      <Header />
      <main className="flex-1 flex flex-col md:flex-row h-full max-w-[1600px] mx-auto w-full md:p-6 lg:p-10 gap-8 pb-[500px]">
        
        {/* Sidebar Navigation - Fixed/Sticky */}
        <aside className="w-full md:w-60 shrink-0 space-y-1 no-print bg-white md:bg-transparent p-4 md:p-0 border-b md:border-0 sticky top-20 md:top-28 self-start">
            <h2 className="text-2xl font-black mb-6 px-4 hidden md:block text-slate-900 tracking-tight">হিসাব শাখা</h2>
            <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-1 scrollbar-none">
                {sidebarItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={cn(
                            "flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 font-bold whitespace-nowrap min-w-fit",
                            activeSection === item.id ? "bg-white shadow-md text-primary scale-105" : "text-muted-foreground hover:bg-slate-200/50"
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

        <div className="flex-1 min-w-0 bg-white md:rounded-[32px] shadow-2xl md:border-[1px] border-slate-200/50 overflow-hidden min-h-[700px] flex flex-col transition-all duration-500 animate-in fade-in slide-in-from-right-4">
            <div className="p-4 sm:p-6 lg:p-8 flex-1">
                {isLoadingStudents && allStudents.length === 0 ? <div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div> : (
                    <>
                        <div className="mb-6 border-b pb-4 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-black text-slate-800">{sidebarItems.find(i => i.id === activeSection)?.label}</h2>
                                <p className="text-xs font-bold text-muted-foreground mt-1">শিক্ষাবর্ষ: {selectedYear.toLocaleString('bn-BD')}</p>
                            </div>
                        </div>

                        {activeSection === 'dashboard' && <AccountsDashboardTab transactions={transactions} isLoading={isLoading} onActionClick={(t) => { setPendingEntryType(t); setActiveSection('new-transaction'); }} />}
                        {activeSection === 'fee-collection' && <FeeCollectionTab studentsForYear={allStudents.filter(s => s.academicYear === selectedYear)} isLoading={isLoadingStudents} onFeeCollected={fetchTransactions} />}
                        {activeSection === 'defaulters' && <DefaultersTab allStudents={allStudents} selectedYear={selectedYear} />}
                        {activeSection === 'collection-report' && <CollectionReportTab allStudents={allStudents} />}
                        {activeSection === 'cashbook' && <CashbookTab transactions={transactions} isLoading={isLoading} refetch={fetchTransactions} />}
                        {activeSection === 'ledger' && <LedgerTab transactions={transactions} isLoading={isLoading} />}
                        {activeSection === 'new-transaction' && <NewTransactionTab onTransactionAdded={fetchTransactions} initialType={pendingEntryType} />}
                    </>
                )}
            </div>
        </div>
      </main>
    </div>
  );
}
