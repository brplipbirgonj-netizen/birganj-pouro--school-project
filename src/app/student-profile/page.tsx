'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import Image from 'next/image';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { DailyAttendance } from '@/lib/attendance-data';
import { FeeCollection, feeCollectionFromDoc } from '@/lib/fees-data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, CheckCircle2, XCircle, User, Banknote, CalendarCheck, AlertTriangle, Printer } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useSchoolInfo } from '@/context/SchoolInfoContext';

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

function StudentProfileSearchContent() {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();
    const { schoolInfo } = useSchoolInfo();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [isMounted, setIsMounted] = useState(false);
    const [roll, setRoll] = useState<string>('');
    const [className, setClassName] = useState<string>('');
    const [startMonth, setStartMonth] = useState<string>(BENGALI_MONTHS[0]);
    const [endMonth, setEndMonth] = useState<string>(BENGALI_MONTHS[new Date().getMonth()]);
    
    const [isLoading, setIsLoading] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [studentData, setStudentData] = useState<Student | null>(null);
    const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, total: 0 });
    const [paidMonths, setPaidMonths] = useState<string[]>([]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Handle incoming search params from action popup
    useEffect(() => {
        if (isMounted && !authLoading && user) {
            const urlRoll = searchParams.get('roll');
            const urlClass = searchParams.get('class');
            if (urlRoll && urlClass) {
                setRoll(urlRoll);
                setClassName(urlClass);
                // Trigger search after a tiny delay to ensure states are updated
                setTimeout(() => {
                    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
                    handleSearch(fakeEvent, urlRoll, urlClass);
                }, 100);
            }
        }
    }, [isMounted, authLoading, user, searchParams]);

    useEffect(() => {
        if (isMounted && !authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router, isMounted]);

    const handleSearch = async (e: React.FormEvent, overrideRoll?: string, overrideClass?: string) => {
        e.preventDefault();
        const searchRoll = overrideRoll || roll;
        const searchClass = overrideClass || className;

        if (!db || !searchRoll || !searchClass || !user) {
            toast({ variant: 'destructive', title: 'অনুগ্রহ করে রোল এবং শ্রেণি পূরণ করুন।' });
            return;
        }

        setIsLoading(true);
        try {
            const bnToEn = (str: string) => str.replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d).toString());
            const rollEn = parseInt(bnToEn(searchRoll), 10);

            if (isNaN(rollEn)) {
                toast({ variant: 'destructive', title: 'ভুল রোল নম্বর', description: 'অনুগ্রহ করে সঠিক সংখ্যা ব্যবহার করুন।' });
                setIsLoading(false);
                return;
            }

            const studentQuery = query(
                collection(db, 'students'),
                where('academicYear', '==', selectedYear),
                where('className', '==', searchClass),
                where('roll', '==', rollEn)
            );
            const studentSnap = await getDocs(studentQuery);

            if (studentSnap.empty) {
                toast({ variant: 'destructive', title: 'শিক্ষার্থী পাওয়া যায়নি।', description: 'অনুগ্রহ করে রোল ও শ্রেণি পরীক্ষা করুন।' });
                setIsLoading(false);
                return;
            }

            const foundStudent = studentFromDoc(studentSnap.docs[0]);
            setStudentData(foundStudent);

            const startIdx = BENGALI_MONTHS.indexOf(startMonth);
            const endIdx = BENGALI_MONTHS.indexOf(endMonth);
            
            const startDate = `${selectedYear}-${String(startIdx + 1).padStart(2, '0')}-01`;
            const endDate = `${selectedYear}-${String(endIdx + 1).padStart(2, '0')}-31`;

            const attQuery = query(
                collection(db, 'attendance'),
                where('academicYear', '==', selectedYear),
                where('className', '==', searchClass),
                where('date', '>=', startDate),
                where('date', '<=', endDate)
            );
            
            const attSnap = await getDocs(attQuery).catch(error => {
                if (error.message?.includes('index')) throw error;
                return { docs: [] };
            });
            const attRecords = attSnap.docs.map(doc => doc.data() as DailyAttendance);

            let presentCount = 0;
            let totalCount = 0;

            attRecords.forEach(record => {
                const studentAtt = record.attendance?.find(a => a.studentId === foundStudent.id);
                if (studentAtt) {
                    totalCount++;
                    if (studentAtt.status === 'present') presentCount++;
                }
            });

            setAttendanceStats({
                present: presentCount,
                absent: totalCount - presentCount,
                total: totalCount
            });

            const feeQuery = query(
                collection(db, 'feeCollections'),
                where('studentId', '==', foundStudent.id),
                where('academicYear', '==', selectedYear)
            );
            const feeSnap = await getDocs(feeQuery);
            const feeRecords = feeSnap.docs.map(feeCollectionFromDoc).filter((f): f is FeeCollection => f !== null);
            
            const monthsPaid = new Set<string>();
            feeRecords.forEach(record => {
                BENGALI_MONTHS.forEach(m => {
                    if (record.description && record.description.includes(m)) {
                        monthsPaid.add(m);
                    }
                });
            });
            setPaidMonths(Array.from(monthsPaid));

            setShowProfile(true);
        } catch (error: any) {
            console.error("Search Error:", error);
            if (error.message?.includes('building') || error.message?.includes('index')) {
                toast({
                    variant: 'default',
                    className: 'bg-amber-50 border-amber-200 text-amber-900',
                    title: 'ইন্ডেক্স তৈরি হচ্ছে',
                    description: 'প্রয়োজনীয় ইনডেক্সটি বর্তমানে ফায়ারবেসে তৈরি হচ্ছে। এটি সক্রিয় হতে সাধারণত ৩-৫ মিনিট সময় লাগে। দয়া করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
                    duration: 8000,
                });
            } else {
                toast({ variant: 'destructive', title: 'অনুসন্ধান ব্যর্থ হয়েছে', description: 'সার্ভারে সংযোগ করতে সমস্যা হচ্ছে, আবার চেষ্টা করুন।' });
            }
        } finally {
            setIsLoading(false);
        }
    };

    const attendancePercentage = useMemo(() => {
        if (attendanceStats.total === 0) return 0;
        return (attendanceStats.present / attendanceStats.total) * 100;
    }, [attendanceStats]);

    if (!isMounted || authLoading) {
        return (
            <div className="flex min-h-screen w-full flex-col bg-indigo-50">
                <Header />
                <main className="flex flex-1 flex-col items-center justify-center p-4">
                    <Card className="w-full max-w-lg shadow-xl">
                        <CardHeader><Skeleton className="h-8 w-3/4 mx-auto mb-2" /><Skeleton className="h-4 w-1/2 mx-auto" /></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                            <div className="grid grid-cols-2 gap-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
                            <Skeleton className="h-10 w-full" />
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-indigo-50">
            <div className="no-print w-full flex flex-col">
                <Header />
                <main className="flex flex-1 flex-col items-center justify-center p-4 min-h-[calc(100vh-64px)] pb-40">
                    <Card className="w-full max-w-lg shadow-xl">
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl text-primary font-bold">শিক্ষার্থী প্রোফাইল অনুসন্ধান</CardTitle>
                            <CardDescription>রোল এবং শ্রেণি দিয়ে শিক্ষার্থীর বিস্তারিত তথ্য দেখুন</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handleSearch} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="roll">রোল নম্বর</Label>
                                        <Input id="roll" type="text" value={roll} onChange={e => setRoll(e.target.value)} required placeholder="উদা: ১ বা 1" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="class">শ্রেণি</Label>
                                        <Select value={className} onValueChange={setClassName} required>
                                            <SelectTrigger id="class"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="6">৬ষ্ঠ</SelectItem>
                                                <SelectItem value="7">৭ম</SelectItem>
                                                <SelectItem value="8">৮ম</SelectItem>
                                                <SelectItem value="9">৯ম</SelectItem>
                                                <SelectItem value="10">১০ম</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="start-month">শুরুর মাস</Label>
                                        <Select value={startMonth} onValueChange={setStartMonth}>
                                            <SelectTrigger id="start-month"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {BENGALI_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="end-month">শেষের মাস</Label>
                                        <Select value={endMonth} onValueChange={endMonth => setEndMonth(endMonth)}>
                                            <SelectTrigger id="end-month"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {BENGALI_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <Button type="submit" className="w-full h-12 text-lg shadow-md" disabled={isLoading}>
                                    {isLoading ? 'অনুসন্ধান করা হচ্ছে...' : <><Search className="mr-2 h-5 w-5" /> তথ্য দেখুন</>}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </main>
            </div>

            {studentData && (
                <div className="printable-area p-10 text-black bg-white min-h-screen">
                    <header className="flex items-center justify-between border-b-4 border-black pb-4 mb-6">
                        <div className="w-20 h-20 relative flex items-center justify-center">
                            {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" width={80} height={80} className="object-contain" />}
                        </div>
                        <div className="text-center flex-1">
                            <h1 className="text-2xl font-extrabold">{schoolInfo.name}</h1>
                            <p className="text-sm font-medium">{schoolInfo.address}</p>
                            <h2 className="text-xl font-bold mt-2 underline decoration-2 underline-offset-4 uppercase tracking-wider">শিক্ষার্থী প্রোফাইল রিপোর্ট</h2>
                        </div>
                        <div className="w-20"></div>
                    </header>

                    <div className="flex justify-between items-start gap-8 mb-8 p-4 border-2 border-black rounded-lg">
                        <div className="space-y-2 text-md flex-1">
                            <p><strong>শিক্ষার্থীর নাম:</strong> {studentData.studentNameBn}</p>
                            <p><strong>রোল নম্বর:</strong> {toBengaliNumber(studentData.roll)}</p>
                            <p><strong>শ্রেণি:</strong> {classNamesMap[studentData.className]} শ্রেণি</p>
                            <p><strong>শিক্ষাবর্ষ:</strong> {toBengaliNumber(studentData.academicYear)}</p>
                            <p><strong>পিতার নাম:</strong> {studentData.fatherNameBn}</p>
                            <p><strong>মোবাইল:</strong> {studentData.guardianMobile || '-'}</p>
                        </div>
                        <div className="shrink-0">
                            <div className="w-32 h-32 border-2 border-black relative overflow-hidden rounded-md shadow-sm">
                                {studentData.photoUrl ? (
                                    <Image src={studentData.photoUrl} alt="Student" fill className="object-cover" />
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center bg-gray-100 text-gray-400">ছবি নেই</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <section>
                            <h3 className="text-lg font-bold border-b-2 border-black mb-4 pb-1 inline-block">হাজিরা পরিসংখ্যান ({startMonth} - {endMonth})</h3>
                            <div className="grid grid-cols-3 border-2 border-black text-center rounded-lg overflow-hidden">
                                <div className="p-3 border-r-2 border-black bg-gray-50"><p className="font-bold text-sm">মোট কার্যদিবস</p><p className="text-xl font-black">{toBengaliNumber(attendanceStats.total)}</p></div>
                                <div className="p-3 border-r-2 border-black bg-gray-50 text-green-800"><p className="font-bold text-sm">উপস্থিতি</p><p className="text-xl font-black">{toBengaliNumber(attendanceStats.present)}</p></div>
                                <div className="p-3 bg-gray-50 text-red-800"><p className="font-bold text-sm">অনুপস্থিতি</p><p className="text-xl font-black">{toBengaliNumber(attendanceStats.absent)}</p></div>
                            </div>
                            <div className="mt-3 flex justify-between items-center bg-gray-100 p-2 rounded border border-black">
                                <span className="text-md font-bold">উপস্থিতির হার:</span>
                                <span className="text-xl font-black">{toBengaliNumber(attendancePercentage.toFixed(2))}%</span>
                            </div>
                        </section>

                        <section>
                            <h3 className="text-lg font-bold border-b-2 border-black mb-4 pb-1 inline-block">বেতন পরিশোধের অবস্থা (শিক্ষাবর্ষ {toBengaliNumber(selectedYear)})</h3>
                            <div className="grid grid-cols-4 gap-2">
                                {BENGALI_MONTHS.map(month => {
                                    const isPaid = paidMonths.includes(month);
                                    return (
                                        <div key={month} className={cn("p-2 border-2 text-center rounded-md", isPaid ? "border-green-600 bg-green-50" : "border-red-600 bg-red-50")}>
                                            <p className="font-black text-xs">{month}</p>
                                            <p className={cn("text-[10px] font-bold mt-1 uppercase", isPaid ? "text-green-700" : "text-red-700")}>{isPaid ? 'পরিশোধিত' : 'বকেয়া'}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    </div>

                    <footer className="mt-20 flex justify-between px-4">
                        <div className="text-center w-48 border-t-2 border-black pt-1 font-bold text-sm">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                        <div className="text-center w-48 border-t-2 border-black pt-1 font-bold text-sm">প্রধান শিক্ষকের স্বাক্ষর</div>
                    </footer>
                </div>
            )}

            <Dialog open={showProfile} onOpenChange={setShowProfile}>
                <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto no-print">
                    {studentData && (
                        <>
                            <DialogHeader>
                                <div className="flex flex-col md:flex-row items-center gap-6 pb-4 border-b">
                                    <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-full border-4 border-primary/20 shadow-lg">
                                        {studentData.photoUrl ? (
                                            <Image src={studentData.photoUrl} alt={studentData.studentNameBn} fill className="object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-muted">
                                                <User className="h-16 w-16 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-center md:text-left space-y-1">
                                        <DialogTitle className="text-3xl font-bold text-primary">{studentData.studentNameBn}</DialogTitle>
                                        <p className="text-lg font-medium text-muted-foreground">
                                            রোল: {toBengaliNumber(studentData.roll)} | {classNamesMap[studentData.className]} শ্রেণি
                                        </p>
                                        <DialogDescription className="text-md">
                                            শিক্ষাবর্ষ: {toBengaliNumber(studentData.academicYear)}
                                        </DialogDescription>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="space-y-8 pt-4">
                                <section className="space-y-4">
                                    <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2 text-primary">
                                        <CalendarCheck className="h-5 w-5" /> হাজিরা রিপোর্ট ({startMonth} - {endMonth})
                                    </h3>
                                    <div className="grid grid-cols-3 gap-4 text-center">
                                        <div className="p-3 bg-green-50 rounded-lg border border-green-100 shadow-sm">
                                            <p className="text-sm text-green-600 font-medium">উপস্থিত</p>
                                            <p className="text-2xl font-bold">{toBengaliNumber(attendanceStats.present)} দিন</p>
                                        </div>
                                        <div className="p-3 bg-red-50 rounded-lg border border-red-100 shadow-sm">
                                            <p className="text-sm text-red-600 font-medium">অনুপস্থিত</p>
                                            <p className="text-2xl font-bold">{toBengaliNumber(attendanceStats.absent)} দিন</p>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 shadow-sm">
                                            <p className="text-sm text-blue-600 font-medium">মোট দিন</p>
                                            <p className="text-2xl font-bold">{toBengaliNumber(attendanceStats.total)} দিন</p>
                                        </div>
                                    </div>
                                    <div className="space-y-2 pt-2">
                                        <div className="flex justify-between text-sm font-medium">
                                            <span>উপস্থিতির হার</span>
                                            <span className={cn("font-bold", attendancePercentage < 75 ? "text-red-600" : "text-green-600")}>
                                                {toBengaliNumber(attendancePercentage.toFixed(2))}%
                                            </span>
                                        </div>
                                        <Progress value={attendancePercentage} className="h-3" />
                                        {attendancePercentage < 75 && (
                                            <p className="text-[10px] text-red-500 flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3" /> উপস্থিতির হার ৭৫% এর নিচে।
                                            </p>
                                        )}
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2 text-primary">
                                        <Banknote className="h-5 w-5" /> বেতন পরিশোধের অবস্থা
                                    </h3>
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                        {BENGALI_MONTHS.map(month => {
                                            const isPaid = paidMonths.includes(month);
                                            return (
                                                <div 
                                                    key={month}
                                                    className={cn(
                                                        "flex flex-col items-center justify-center p-2 rounded-md border text-center transition-all",
                                                        isPaid ? "bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm" : "bg-red-50 border-red-200 text-red-600"
                                                    )}
                                                >
                                                    {isPaid ? <CheckCircle2 className="h-4 w-4 mb-1" /> : <XCircle className="h-4 w-4 mb-1" />}
                                                    <span className="text-xs font-bold">{month}</span>
                                                    <span className="text-[10px]">{isPaid ? 'পরিশোধিত' : 'বকেয়া'}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                                
                                <div className="flex justify-end pt-4 border-t">
                                    <Button variant="outline" onClick={() => window.print()} className="gap-2">
                                        <Printer className="h-4 w-4" /> রিপোর্ট প্রিন্ট করুন
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function StudentProfileSearchPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen w-full flex-col bg-indigo-50"><Header /><main className="flex-1 flex items-center justify-center">লোড হচ্ছে...</main></div>}>
            <StudentProfileSearchContent />
        </Suspense>
    );
}
