
'use client';

import { useState, useMemo, useEffect, Suspense, useCallback } from 'react';
import Image from 'next/image';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { DailyAttendance } from '@/lib/attendance-data';
import { FeeCollection, feeCollectionFromDoc } from '@/lib/fees-data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, CheckCircle2, XCircle, User, Banknote, CalendarCheck, AlertTriangle, Printer, LayoutGrid, Info, MapPin, Phone, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { format, startOfYear, endOfYear, eachDayOfInterval, isSameDay } from 'date-fns';
import { bn } from 'date-fns/locale';

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

const religionMapBn: Record<string, string> = {
    'islam': 'ইসলাম', 'hinduism': 'হিন্দু', 'buddhism': 'বৌদ্ধ', 'christianity': 'খ্রিস্টান', 'other': 'অন্যান্য'
};

const groupMapBn: Record<string, string> = {
    'science': 'বিজ্ঞান', 'arts': 'মানবিক', 'commerce': 'ব্যবসায় শিক্ষা', 'general': 'সাধারণ'
};

// Heatmap Component
const AttendanceHeatmap = ({ records, year, holidays }: { records: DailyAttendance[], year: string, holidays: string[] }) => {
    const monthIndices = Array.from({ length: 12 }, (_, i) => i);

    return (
        <div className="w-full overflow-x-auto pb-10 scrollbar-thin scrollbar-thumb-primary/30 bg-slate-50/50 p-6 rounded-2xl border-2 border-dashed border-primary/20">
            <div className="flex gap-8 min-w-max p-2">
                {monthIndices.map(monthIdx => {
                    const monthStart = new Date(parseInt(year), monthIdx, 1);
                    const monthEnd = new Date(parseInt(year), monthIdx + 1, 0);
                    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
                    
                    // Organize days into weeks (Sunday to Saturday)
                    const weeks: (Date | null)[][] = [Array(7).fill(null)];
                    let currentWeekIdx = 0;
                    
                    daysInMonth.forEach(day => {
                        const dayOfWeek = day.getDay();
                        if (dayOfWeek === 0 && weeks[currentWeekIdx].some(d => d !== null)) {
                            currentWeekIdx++;
                            weeks[currentWeekIdx] = Array(7).fill(null);
                        }
                        weeks[currentWeekIdx][dayOfWeek] = day;
                    });

                    while (weeks.length < 6) {
                        weeks.push(Array(7).fill(null));
                    }

                    return (
                        <div 
                            key={monthIdx} 
                            className="flex flex-col border-[4px] border-black rounded-xl p-5 bg-white shadow-[10px_10px_0px_rgba(0,0,0,0.1)] hover:translate-y-[-5px] transition-all duration-300"
                        >
                            <div className="text-center font-black text-xl mb-5 text-primary border-b-[4px] border-black pb-2 uppercase tracking-widest bg-primary/5 -mx-5 -mt-5 rounded-t-lg pt-3">
                                {BENGALI_MONTHS[monthIdx]}
                            </div>
                            <div className="flex gap-4">
                                <div className="flex flex-col justify-between text-[11px] font-black text-muted-foreground py-1 h-[228px] shrink-0 border-r-2 border-dashed border-slate-200 pr-2">
                                    <span>রবি</span><span>সোম</span><span>মঙ্গল</span><span>বুধ</span><span>বৃহঃ</span><span>শুক্র</span><span>শনি</span>
                                </div>
                                
                                <div className="flex gap-2.5">
                                    {weeks.map((week, wIdx) => (
                                        <div key={wIdx} className="flex flex-col gap-2.5">
                                            {week.map((day, dIdx) => {
                                                if (!day) return <div key={dIdx} className="w-8 h-8 bg-slate-50/30 rounded-md border border-dashed border-slate-100" />;
                                                
                                                const dateStr = format(day, 'yyyy-MM-dd');
                                                const record = records.find(r => r.date === dateStr);
                                                const holiday = holidays.includes(dateStr);
                                                const isWeekend = day.getDay() === 5 || day.getDay() === 6;

                                                let colorClass = "bg-slate-100 hover:bg-slate-200";
                                                let statusText = "রেকর্ড নেই";
                                                
                                                if (holiday || isWeekend) {
                                                    colorClass = "bg-yellow-400 shadow-sm hover:bg-yellow-500 ring-1 ring-yellow-500/20";
                                                    statusText = isWeekend ? "সাপ্তাহিক ছুটি" : "সরকারি ছুটি";
                                                }

                                                if (record) {
                                                    const att = record.attendance.find(a => !!a);
                                                    if (att?.status === 'present') {
                                                        colorClass = "bg-green-600 shadow-md scale-110 z-10 hover:bg-green-700 ring-2 ring-green-600/30";
                                                        statusText = "উপস্থিত";
                                                    } else if (att?.status === 'absent') {
                                                        colorClass = "bg-red-600 shadow-md scale-110 z-10 hover:bg-red-700 ring-2 ring-red-600/30";
                                                        statusText = "অনুপস্থিত";
                                                    }
                                                }

                                                return (
                                                    <TooltipProvider key={dIdx}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <div className={cn(
                                                                    "w-8 h-8 rounded-md transition-all cursor-pointer border border-black/5", 
                                                                    colorClass
                                                                )} />
                                                            </TooltipTrigger>
                                                            <TooltipContent className="font-kalpurush">
                                                                <p className="text-sm font-black">{format(day, 'PPP', { locale: bn })}</p>
                                                                <p className="text-xs font-bold">{statusText}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="mt-10 flex flex-wrap items-center gap-8 text-sm font-black text-slate-700 bg-white p-5 rounded-xl border-4 border-black shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-green-600 rounded-md shadow-md ring-2 ring-green-600/30" /> 
                    <span>উপস্থিত</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-red-600 rounded-md shadow-md ring-2 ring-red-600/30" /> 
                    <span>অনুপস্থিত</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-yellow-400 rounded-md shadow-sm ring-2 ring-yellow-400/30" /> 
                    <span>সরকারি/সাপ্তাহিক ছুটি</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-slate-100 rounded-md border border-black/10" /> 
                    <span>রেকর্ড নেই</span>
                </div>
            </div>
        </div>
    );
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
    
    const [isLoading, setIsLoading] = useState(false);
    const [showProfile, setShowProfile] = useState(false);
    const [studentData, setStudentData] = useState<Student | null>(null);
    const [attendanceRecords, setAttendanceRecords] = useState<DailyAttendance[]>([]);
    const [holidays, setHolidays] = useState<string[]>([]);
    const [paidMonths, setPaidMonths] = useState<string[]>([]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isMounted && !authLoading && user) {
            const urlRoll = searchParams.get('roll');
            const urlClass = searchParams.get('class');
            if (urlRoll && urlClass) {
                setRoll(urlRoll);
                setClassName(urlClass);
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
                toast({ variant: 'destructive', title: 'ভুল রোল নম্বর' });
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
                toast({ variant: 'destructive', title: 'শিক্ষার্থী পাওয়া যায়নি।' });
                setIsLoading(false);
                return;
            }

            const foundStudent = studentFromDoc(studentSnap.docs[0]);
            setStudentData(foundStudent);

            const holidaySnap = await getDocs(collection(db, 'holidays'));
            setHolidays(holidaySnap.docs.map(d => d.data().date));

            const attQuery = query(
                collection(db, 'attendance'),
                where('academicYear', '==', selectedYear),
                where('className', '==', searchClass)
            );
            const attSnap = await getDocs(attQuery);
            const records = attSnap.docs.map(doc => {
                const data = doc.data();
                const studentAtt = data.attendance?.find((a: any) => a.studentId === foundStudent.id);
                return {
                    ...data,
                    attendance: studentAtt ? [studentAtt] : [] 
                } as DailyAttendance;
            });
            setAttendanceRecords(records);

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
                    if (record.description?.includes(m)) monthsPaid.add(m);
                });
            });
            setPaidMonths(Array.from(monthsPaid));

            setShowProfile(true);
        } catch (error: any) {
            console.error("Search Error:", error);
            toast({ variant: 'destructive', title: 'অনুসন্ধান ব্যর্থ হয়েছে' });
        } finally {
            setIsLoading(false);
        }
    };

    const attendanceStats = useMemo(() => {
        let present = 0;
        let total = 0;
        attendanceRecords.forEach(r => {
            if (r.attendance.length > 0) {
                total++;
                if (r.attendance[0].status === 'present') present++;
            }
        });
        return { present, absent: total - present, total };
    }, [attendanceRecords]);

    const attendancePercentage = attendanceStats.total > 0 ? (attendanceStats.present / attendanceStats.total) * 100 : 0;

    if (!isMounted || authLoading) {
        return (
            <div className="flex min-h-screen w-full flex-col">
                <Header />
                <main className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-indigo-50 font-kalpurush">
            <div className="no-print w-full flex flex-col">
                <Header />
                <main className="flex flex-1 flex-col items-center justify-center p-4 min-h-[calc(100vh-64px)] pb-80">
                    <Card className="w-full max-w-lg shadow-xl border-2 border-primary/10">
                        <CardHeader className="text-center bg-primary/5 rounded-t-lg">
                            <CardTitle className="text-2xl text-primary font-black">শিক্ষার্থী প্রোফাইল অনুসন্ধান</CardTitle>
                            <CardDescription>রোল এবং শ্রেণি দিয়ে শিক্ষার্থীর বিস্তারিত তথ্য দেখুন</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <form onSubmit={handleSearch} className="space-y-6">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="roll" className="font-bold">রোল নম্বর</Label>
                                        <Input id="roll" value={roll} onChange={e => setRoll(e.target.value)} required placeholder="উদা: ১" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="class" className="font-bold">শ্রেণি</Label>
                                        <Select value={className} onValueChange={setClassName} required>
                                            <SelectTrigger id="class" className="bg-white"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger>
                                            <SelectContent position="item-aligned">
                                                {Object.entries(classNamesMap).map(([id, label]) => (
                                                    <SelectItem key={id} value={id}>{label} শ্রেণি</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <Button type="submit" className="w-full h-12 text-lg shadow-md font-black" disabled={isLoading}>
                                    {isLoading ? 'অনুসন্ধান করা হচ্ছে...' : <><Search className="mr-2 h-5 w-5" /> তথ্য দেখুন</>}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>
                </main>
            </div>

            {/* Print Layout */}
            {studentData && (
                <div className="hidden print:block printable-area font-kalpurush">
                    <div className="flex flex-col h-full text-black p-8">
                        <header className="flex items-center gap-6 border-b-4 border-emerald-800 pb-4 mb-8 printable-header">
                            {schoolInfo.logoUrl && (
                                <div className="relative w-24 h-24">
                                    <Image src={schoolInfo.logoUrl} alt="Logo" fill className="object-contain" />
                                </div>
                            )}
                            <div className="text-center flex-grow">
                                <h1 className="text-4xl font-black text-emerald-900">{schoolInfo.name}</h1>
                                <p className="text-lg font-bold">{schoolInfo.address}</p>
                                <div className="mt-2 inline-block bg-emerald-50 px-4 py-1 rounded border-2 border-emerald-800">
                                    <h2 className="text-xl font-black uppercase tracking-widest">শিক্ষার্থী প্রোফাইল রিপোর্ট</h2>
                                </div>
                            </div>
                            <div className="w-24 h-24 border-2 border-black p-1 bg-white flex items-center justify-center overflow-hidden">
                                {studentData.photoUrl ? (
                                    <Image src={studentData.photoUrl} alt="Student" width={96} height={96} className="object-cover w-full h-full" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">ছবি নেই</div>
                                )}
                            </div>
                        </header>

                        <div className="space-y-8 flex-grow">
                            <section>
                                <h3 className="text-xl font-black border-b-2 border-black pb-1 mb-4 flex items-center gap-2">
                                    <User className="h-5 w-5" /> ব্যক্তিগত তথ্য
                                </h3>
                                <div className="grid grid-cols-2 gap-y-3 text-lg font-semibold">
                                    <div className="flex">
                                        <span className="w-40 text-gray-600">শিক্ষার্থী আইডি</span>
                                        <span className="font-bold">: {toBengaliNumber(studentData.generatedId || '')}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-40 text-gray-600">পূর্ণ নাম</span>
                                        <span className="font-bold">: {studentData.studentNameBn}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-40 text-gray-600">শ্রেণি ও রোল</span>
                                        <span className="font-bold">: {classNamesMap[studentData.className]} শ্রেণি, রোল- {toBengaliNumber(studentData.roll)}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-40 text-gray-600">শিক্ষাবর্ষ</span>
                                        <span className="font-bold">: {toBengaliNumber(selectedYear)}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-40 text-gray-600">পিতার নাম</span>
                                        <span className="font-bold">: {studentData.fatherNameBn}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-40 text-gray-600">মাতার নাম</span>
                                        <span className="font-bold">: {studentData.motherNameBn}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-40 text-gray-600">জন্ম তারিখ</span>
                                        <span className="font-bold">: {studentData.dob ? format(new Date(studentData.dob), 'dd/MM/yyyy', { locale: bn }) : '-'}</span>
                                    </div>
                                    <div className="flex">
                                        <span className="w-40 text-gray-600">ধর্ম ও লিঙ্গ</span>
                                        <span className="font-bold">: {religionMapBn[studentData.religion?.toLowerCase() || ''] || studentData.religion}, {studentData.gender === 'male' ? 'ছাত্র' : 'ছাত্রী'}</span>
                                    </div>
                                </div>
                            </section>

                            <section className="grid grid-cols-2 gap-8">
                                <div className="border-2 border-emerald-100 p-4 rounded-lg bg-emerald-50/10">
                                    <h3 className="text-xl font-black border-b-2 border-emerald-800 pb-1 mb-4 flex items-center gap-2">
                                        <CalendarCheck className="h-5 w-5 text-emerald-800" /> হাজিরা রিপোর্ট
                                    </h3>
                                    <div className="space-y-2 text-lg font-bold">
                                        <div className="flex justify-between"><span>মোট কার্যদিবস</span> <span>{toBengaliNumber(attendanceStats.total)} দিন</span></div>
                                        <div className="flex justify-between text-emerald-700"><span>উপস্থিত</span> <span>{toBengaliNumber(attendanceStats.present)} দিন</span></div>
                                        <div className="flex justify-between text-rose-700"><span>অনুপস্থিত</span> <span>{toBengaliNumber(attendanceStats.absent)} দিন</span></div>
                                        <div className="flex justify-between border-t pt-2 text-blue-800 border-emerald-800"><span>উপস্থিতির হার</span> <span>{toBengaliNumber(attendancePercentage.toFixed(1))}%</span></div>
                                    </div>
                                </div>
                                <div className="border-2 border-amber-100 p-4 rounded-lg bg-amber-50/10">
                                    <h3 className="text-xl font-black border-b-2 border-amber-800 pb-1 mb-4 flex items-center gap-2">
                                        <Banknote className="h-5 w-5 text-amber-800" /> বেতন পরিশোধের অবস্থা
                                    </h3>
                                    <div className="grid grid-cols-4 gap-2">
                                        {BENGALI_MONTHS.map(m => {
                                            const isPaid = paidMonths.includes(m);
                                            return (
                                                <div key={m} className={cn(
                                                    "p-1 text-[9px] text-center border rounded flex flex-col items-center justify-center min-h-[42px] font-black",
                                                    isPaid ? "border-emerald-700 text-emerald-800 bg-emerald-50" : "border-rose-300 text-rose-700 bg-rose-50"
                                                )}>
                                                    <span className="leading-tight">{m}</span>
                                                    <span className="text-[7px] mt-0.5 uppercase">{isPaid ? 'পরিশোধিত' : 'বকেয়া'}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-xl font-black border-b-2 border-black pb-1 mb-4 flex items-center gap-2">
                                    <MapPin className="h-5 w-5" /> যোগাযোগ ও ঠিকানা
                                </h3>
                                <div className="grid grid-cols-2 gap-8 text-lg font-bold">
                                    <div>
                                        <p className="text-sm text-gray-500 uppercase tracking-tighter">বর্তমান ঠিকানা</p>
                                        <p>{studentData.presentVillage || '-'}, {studentData.presentUnion || '-'}</p>
                                        <p>{studentData.presentUpazila || '-'}, {studentData.presentDistrict || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500 uppercase tracking-tighter">মোবাইল নম্বর</p>
                                        <p>{studentData.guardianMobile || '-'}</p>
                                        <p>{studentData.studentMobile || '-'}</p>
                                    </div>
                                </div>
                            </section>
                        </div>

                        <footer className="mt-auto border-t-2 border-black pt-12 pb-4 flex justify-between print-footer">
                            <div className="text-center w-48">
                                <div className="border-t-2 border-black pt-1 font-black text-sm">অভিভাবকের স্বাক্ষর</div>
                            </div>
                            <div className="text-center w-48">
                                <div className="border-t-2 border-black pt-1 font-black text-sm">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                            </div>
                            <div className="text-center w-48">
                                <div className="border-t-2 border-black pt-1 font-black text-sm">প্রধান শিক্ষকের স্বাক্ষর</div>
                            </div>
                        </footer>
                    </div>
                </div>
            )}

            {/* Screen Profile Dialog */}
            <Dialog open={showProfile} onOpenChange={setShowProfile}>
                <DialogContent className="sm:max-w-4xl max-h-[95vh] overflow-y-auto p-0 no-print font-kalpurush">
                    <DialogHeader className="sr-only">
                        <DialogTitle>শিক্ষার্থী প্রোফাইল</DialogTitle>
                    </DialogHeader>
                    
                    {studentData && (
                        <div className="flex flex-col">
                            {/* Standard Header Size */}
                            <div className="relative h-40 sm:h-48 bg-gradient-to-r from-indigo-600 to-purple-600">
                                <div className="absolute -bottom-4 left-6 flex items-end gap-4">
                                    <div className="relative h-24 w-24 sm:h-32 sm:w-32 rounded-full border-4 border-white overflow-hidden bg-white shadow-xl">
                                        {studentData.photoUrl ? (
                                            <Image src={studentData.photoUrl} alt={studentData.studentNameBn} fill className="object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center bg-muted">
                                                <User className="h-12 w-12 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="pb-6 hidden sm:block">
                                        <h1 className="text-2xl font-black text-white drop-shadow-md">
                                            {studentData.studentNameBn}
                                        </h1>
                                        <p className="text-sm font-bold text-white/90 drop-shadow-sm">
                                            রোল: {toBengaliNumber(studentData.roll)} | {classNamesMap[studentData.className]} শ্রেণি
                                        </p>
                                    </div>
                                </div>
                                <div className="absolute top-4 right-4">
                                    <Button variant="secondary" size="sm" className="bg-white/80 font-black" onClick={() => window.print()}>
                                        <Printer className="h-4 w-4 mr-2" /> প্রিন্ট
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-8 px-6 space-y-6 pb-8">
                                <div className="sm:hidden text-center pt-8">
                                    <h1 className="text-2xl font-black text-black">{studentData.studentNameBn}</h1>
                                    <p className="text-sm font-bold text-muted-foreground">
                                        রোল: {toBengaliNumber(studentData.roll)} | {classNamesMap[studentData.className]} শ্রেণি
                                    </p>
                                </div>

                                <Tabs defaultValue="info" className="w-full">
                                    <TabsList className="grid w-full grid-cols-3 h-10 bg-muted/50 p-1">
                                        <TabsTrigger value="info" className="font-bold text-xs"><Info className="h-3.5 w-3.5 mr-1" /> তথ্য</TabsTrigger>
                                        <TabsTrigger value="attendance" className="font-bold text-xs"><CalendarCheck className="h-3.5 w-3.5 mr-1" /> হাজিরা</TabsTrigger>
                                        <TabsTrigger value="fees" className="font-bold text-xs"><Banknote className="h-3.5 w-3.5 mr-1" /> বেতন</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="info" className="pt-4 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <Card className="border-none shadow-sm bg-indigo-50/30 p-4">
                                                <h3 className="font-black text-indigo-900 mb-4 border-b pb-1">ব্যক্তিগত তথ্য</h3>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between border-b border-indigo-100 py-1"><span>শিক্ষার্থী আইডি:</span> <span className="font-bold">{toBengaliNumber(studentData.generatedId || '')}</span></div>
                                                    <div className="flex justify-between border-b border-indigo-100 py-1"><span>জন্ম তারিখ:</span> <span className="font-bold">{studentData.dob ? format(new Date(studentData.dob), 'dd MMMM yyyy', { locale: bn }) : '-'}</span></div>
                                                    <div className="flex justify-between border-b border-indigo-100 py-1"><span>লিঙ্গ:</span> <span className="font-bold">{studentData.gender === 'male' ? 'ছাত্র' : 'ছাত্রী'}</span></div>
                                                    <div className="flex justify-between py-1"><span>ধর্ম:</span> <span className="font-bold">{religionMapBn[studentData.religion?.toLowerCase() || ''] || studentData.religion || 'অন্যান্য'}</span></div>
                                                </div>
                                            </Card>
                                            <Card className="border-none shadow-sm bg-indigo-50/30 p-4">
                                                <h3 className="font-black text-indigo-900 mb-4 border-b pb-1">যোগাযোগ</h3>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between border-b border-indigo-100 py-1"><span>পিতার নাম:</span> <span className="font-bold">{studentData.fatherNameBn}</span></div>
                                                    <div className="flex justify-between border-b border-indigo-100 py-1"><span>মোবাইল:</span> <span className="font-bold text-primary">{studentData.guardianMobile || '-'}</span></div>
                                                    <div className="flex flex-col py-1"><span>ঠিকানা:</span> <span className="font-bold">{studentData.presentVillage}, {studentData.presentUpazila}</span></div>
                                                </div>
                                            </Card>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="attendance" className="pt-4 space-y-6">
                                        <Card className="border-none shadow-sm p-4">
                                            <div className="grid grid-cols-3 gap-4 mb-6">
                                                <div className="p-3 bg-emerald-50 rounded-lg text-center border border-emerald-100">
                                                    <p className="text-[10px] font-black text-emerald-700 uppercase">উপস্থিতি</p>
                                                    <p className="text-xl font-black">{toBengaliNumber(attendanceStats.present)} দিন</p>
                                                </div>
                                                <div className="p-3 bg-rose-50 rounded-lg text-center border border-rose-100">
                                                    <p className="text-[10px] font-black text-rose-700 uppercase">অনুপস্থিতি</p>
                                                    <p className="text-xl font-black">{toBengaliNumber(attendanceStats.absent)} দিন</p>
                                                </div>
                                                <div className="p-3 bg-blue-50 rounded-lg text-center border border-blue-100">
                                                    <p className="text-[10px] font-black text-blue-700 uppercase">হার (%)</p>
                                                    <p className="text-xl font-black">{toBengaliNumber(attendancePercentage.toFixed(1))}%</p>
                                                </div>
                                            </div>

                                            <div className="space-y-1 mb-8">
                                                <div className="flex justify-between text-[10px] font-black uppercase text-muted-foreground">
                                                    <span>বার্ষিক প্রগতি</span>
                                                    <span>{toBengaliNumber(attendancePercentage.toFixed(0))}%</span>
                                                </div>
                                                <Progress value={attendancePercentage} className="h-2" />
                                            </div>

                                            {/* Large Heatmap Only */}
                                            <div className="border-t pt-6">
                                                <h3 className="text-xs font-black mb-4 uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                                    <LayoutGrid className="h-3.5 w-3.5" /> বার্ষিক অ্যাটেন্ডেন্স হিটম্যাপ
                                                </h3>
                                                <AttendanceHeatmap records={attendanceRecords} year={selectedYear} holidays={holidays} />
                                            </div>
                                        </Card>
                                    </TabsContent>

                                    <TabsContent value="fees" className="pt-4 space-y-6">
                                        <Card className="border-none shadow-sm p-4">
                                            <h3 className="font-black text-primary mb-4 border-b pb-1">বেতন রিপোর্ট ({toBengaliNumber(selectedYear)})</h3>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                                                {BENGALI_MONTHS.map(month => {
                                                    const isPaid = paidMonths.includes(month);
                                                    return (
                                                        <div key={month} className={cn(
                                                            "flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all",
                                                            isPaid ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-rose-50 border-rose-200 text-rose-600 opacity-60"
                                                        )}>
                                                            {isPaid ? <CheckCircle2 className="h-5 w-5 mb-1" /> : <XCircle className="h-5 w-5 mb-1" />}
                                                            <span className="text-[10px] font-black">{month}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </Card>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default function StudentProfileSearchPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen w-full items-center justify-center bg-indigo-50"><p>লোড হচ্ছে...</p></div>}>
            <StudentProfileSearchContent />
        </Suspense>
    );
}
