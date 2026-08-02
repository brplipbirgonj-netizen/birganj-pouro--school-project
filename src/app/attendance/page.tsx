'use client';

import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Student } from '@/lib/student-data';
import { getAttendanceFromStorage, DailyAttendance, saveDailyAttendance, getAttendanceForClassAndDate, StudentAttendance, AttendanceStatus, getConsecutiveAbsences } from '@/lib/attendance-data';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, orderBy, FirestoreError, getDocs } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import { Label } from "@/components/ui/label";
import { isHoliday, Holiday, getHolidays } from '@/lib/holiday-data';
import { format, eachDayOfInterval, subDays, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { bn } from 'date-fns/locale';
import { DatePicker } from '@/components/ui/date-picker';
import { useAuth } from '@/hooks/useAuth';
import { Edit2, RotateCcw, AlertCircle, Smartphone, CalendarX, Check, X, Search, CalendarDays, CalendarCheck, Plus, Save, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

const BENGALI_MONTHS = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

// Digital Attendance sheet component
const AttendanceSheet = ({ 
    classId, 
    students, 
    currentAttendance, 
    onStatusChange, 
    onRefresh 
}: { 
    classId: string, 
    students: Student[], 
    currentAttendance: Map<string, AttendanceStatus>,
    onStatusChange: (studentId: string, status: AttendanceStatus) => void,
    onRefresh: () => void
}) => {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user } = useAuth();
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const dayOfWeek = today.getDay(); 

    const [savedAttendance, setSavedAttendance] = useState<DailyAttendance | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [activeHoliday, setActiveHoliday] = useState<Holiday | undefined>(undefined);
    const [isEditing, setIsEditing] = useState(false);

    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; 
    const isAdmin = user?.role === 'admin';

    useEffect(() => {
        if (!db || !user) return;
        
        const checkExistingData = async () => {
            const existingAttendance = await getAttendanceForClassAndDate(db, todayStr, classId, selectedYear);
            setSavedAttendance(existingAttendance);
            
            // If data exists and we are not in current memory state, populate it
            if (existingAttendance && currentAttendance.size === 0) {
                existingAttendance.attendance.forEach(item => {
                    onStatusChange(item.studentId, item.status);
                });
            }

            const holidayToday = await isHoliday(db, todayStr);
            setActiveHoliday(holidayToday);
            
            setIsLoading(false);
        }

        checkExistingData();
    }, [classId, todayStr, selectedYear, db, user, currentAttendance.size, onStatusChange]);

    const handleSaveAttendance = () => {
        if (!db || !user) return;
        
        // Strict blocking: Even admins shouldn't take regular attendance on holidays
        if (isWeekend) {
            toast({ variant: "destructive", title: "আজ সাপ্তাহিক ছুটি। হাজিরা গ্রহণ সম্ভব নয়।" });
            return;
        }
        if (activeHoliday) {
            toast({ variant: "destructive", title: `আজ ${activeHoliday.description}। হাজিরা বন্ধ রয়েছে।` });
            return;
        }

        // Logic Change: If student is not clicked, mark as absent automatically
        const attendanceData: StudentAttendance[] = students.map(student => ({
            studentId: student.id,
            status: currentAttendance.get(student.id) || 'absent'
        }));

        const dailyAttendance: DailyAttendance = {
            date: todayStr,
            academicYear: selectedYear,
            className: classId,
            attendance: attendanceData,
        };

        saveDailyAttendance(db, dailyAttendance).then(() => {
            setSavedAttendance(dailyAttendance);
            setIsEditing(false);
            onRefresh();
            toast({ 
                title: isEditing ? "হাজিরা আপডেট হয়েছে" : "হাজিরা সেভ হয়েছে",
                description: currentAttendance.size < students.length ? "বাকি শিক্ষার্থীদের অনুপস্থিত হিসেবে ধরা হয়েছে।" : undefined
            });
        }).catch(() => {});
    };

    if (isLoading) {
        return <p className="text-center p-8 italic">লোড হচ্ছে...</p>
    }

    // UI Block for holidays and weekends (For everyone)
    if (isWeekend) {
        return <p className="text-center text-rose-600 font-bold p-12 bg-rose-50 rounded-lg border-2 border-dashed border-rose-200">আজ সাপ্তাহিক ছুটি, তাই হাজিরা বন্ধ আছে।</p>
    }

    if (activeHoliday) {
        return <p className="text-center text-amber-700 font-bold p-12 bg-amber-50 rounded-lg border-2 border-dashed border-amber-200">আজ {activeHoliday.description}, তাই হাজিরা বন্ধ আছে।</p>;
    }
    
    if (savedAttendance && !isEditing) {
        const savedMap = new Map(savedAttendance.attendance.map(item => [item.studentId, item.status]));
        const presentCount = savedAttendance.attendance.filter(a => a.status === 'present').length;
        const absentCount = savedAttendance.attendance.length - presentCount;

        return (
            <div className="p-4 space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-muted/20 p-4 rounded-lg border">
                    <div>
                        <h3 className="font-black text-xl text-primary">আজকের হাজিরা সম্পন্ন হয়েছে</h3>
                        <div className="mt-1 flex flex-wrap gap-4 text-sm font-bold">
                            <Badge variant="outline" className="bg-white">মোট: {(presentCount + absentCount).toLocaleString('bn-BD')}</Badge>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">উপস্থিত: {presentCount.toLocaleString('bn-BD')}</Badge>
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">অনুপস্থিত: {absentCount.toLocaleString('bn-BD')}</Badge>
                        </div>
                    </div>
                    {isAdmin && (
                        <Button variant="outline" onClick={() => setIsEditing(true)} className="flex items-center gap-2 border-primary text-primary hover:bg-primary/5 shadow-sm">
                            <Edit2 className="h-4 w-4" /> হাজিরা সংশোধন করুন
                        </Button>
                    )}
                </div>
                 <div className="overflow-x-auto border rounded-lg shadow-sm bg-white">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-20 text-center">রোল</TableHead>
                                <TableHead>শিক্ষার্থীর নাম</TableHead>
                                <TableHead className="text-right">অবস্থা</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {students.map(student => (
                                <TableRow key={student.id} className="hover:bg-muted/10 h-14">
                                    <TableCell className="text-center font-black">{student.roll.toLocaleString('bn-BD')}</TableCell>
                                    <TableCell className="font-bold">{student.studentNameBn}</TableCell>
                                    <TableCell className="text-right">
                                         <span className={cn(
                                             "px-4 py-1.5 rounded-full text-sm font-black shadow-sm flex items-center gap-2 ml-auto w-fit",
                                             savedMap.get(student.id) === 'present' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'
                                         )}>
                                            {savedMap.get(student.id) === 'present' ? <><Check className="h-4 w-4" /> উপস্থিত</> : <><X className="h-4 w-4" /> অনুপস্থিত</>}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 </div>
            </div>
        );
    }
    
    return (
        <div className="animate-in fade-in duration-500">
            <div className="p-4 bg-muted/30 border-b flex justify-between items-center">
                <span className="text-xs font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Edit2 className="h-3 w-3" /> {isEditing ? 'হাজিরা সংশোধন' : 'নতুন হাজিরা নিন'}
                </span>
                {isEditing && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="h-8 text-xs font-bold text-rose-600">
                        <RotateCcw className="h-3 w-3 mr-1" /> বাতিল করুন
                    </Button>
                )}
            </div>
            <div className="table-container">
                <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="w-20 text-center">রোল</TableHead>
                            <TableHead>নাম</TableHead>
                            <TableHead className="text-right">হাজিরা বাটন</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {students.map(student => {
                            const currentStatus = currentAttendance.get(student.id);
                            return (
                                <TableRow key={student.id} className="hover:bg-accent/5 h-16 transition-colors">
                                    <TableCell className="text-center font-black text-lg">{student.roll.toLocaleString('bn-BD')}</TableCell>
                                    <TableCell className="font-black text-slate-700">{student.studentNameBn}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end items-center gap-3">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={currentStatus === 'present' ? 'default' : 'outline'}
                                                className={cn(
                                                    "h-10 px-6 font-black transition-all duration-300 border-2",
                                                    currentStatus === 'present' 
                                                        ? "bg-emerald-600 hover:bg-emerald-700 text-white scale-110 shadow-xl border-emerald-700 ring-4 ring-emerald-100 z-10" 
                                                        : "text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 opacity-60 hover:opacity-100"
                                                )}
                                                onClick={() => onStatusChange(student.id, 'present')}
                                            >
                                                <Check className={cn("mr-2 h-5 w-5", currentStatus === 'present' ? "block" : "hidden")} />
                                                উপস্থিত
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={currentStatus === 'absent' ? 'default' : 'outline'}
                                                className={cn(
                                                    "h-10 px-6 font-black transition-all duration-300 border-2",
                                                    currentStatus === 'absent' 
                                                        ? "bg-rose-600 hover:bg-rose-700 text-white scale-110 shadow-xl border-rose-700 ring-4 ring-rose-100 z-10" 
                                                        : "text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 opacity-60 hover:opacity-100"
                                                )}
                                                onClick={() => onStatusChange(student.id, 'absent')}
                                            >
                                                <X className={cn("mr-2 h-5 w-5", currentStatus === 'absent' ? "block" : "hidden")} />
                                                অনুপস্থিত
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
            <div className="flex justify-end p-6 mt-4 border-t gap-4 bg-muted/10">
                {isEditing && <Button variant="outline" onClick={() => setIsEditing(false)} className="font-bold">বাতিল</Button>}
                <Button onClick={handleSaveAttendance} size="lg" className="shadow-2xl min-w-[200px] font-black h-14 text-lg">
                    {isEditing ? 'পরিবর্তন সেভ করুন' : 'হাজিরা সেভ করুন'}
                </Button>
            </div>
        </div>
    );
};

const DigitalAttendanceTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { selectedYear } = useAcademicYear();
    const [classAttendance, setClassAttendance] = useState<Record<string, Map<string, AttendanceStatus>>>({
        '6': new Map(), '7': new Map(), '8': new Map(), '9': new Map(), '10': new Map()
    });

    const studentsForYear = useMemo(() => {
        return allStudents.filter(student => student.academicYear === selectedYear);
    }, [allStudents, selectedYear]);

    const classes = ['6', '7', '8', '9', '10'];

    const getStudentsByClass = (className: string): Student[] => {
        return studentsForYear.filter((student) => student.className === className);
    };

    const handleStatusChange = (className: string, studentId: string, status: AttendanceStatus) => {
        setClassAttendance(prev => {
            const nextMap = new Map(prev[className]);
            nextMap.set(studentId, status);
            return { ...prev, [className]: nextMap };
        });
    };

    const getPresentCount = (className: string) => {
        const map = classAttendance[className];
        let count = 0;
        map.forEach(status => {
            if (status === 'present') count++;
        });
        return count;
    };

    const today = new Date();
    const formattedDate = format(today, "EEEE, d MMMM yyyy", { locale: bn });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between bg-primary/5 p-3 rounded-lg border-2 border-primary/10">
                <p className="text-sm font-black text-primary flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> আজকের তারিখ: {formattedDate}
                </p>
                <p className="text-[10px] font-bold text-muted-foreground italic hidden sm:block">বাটন ক্লিক করে হাজিরা নিশ্চিত করুন। বাকিরা স্বয়ংক্রিয়ভাবে অনুপস্থিত হবে।</p>
            </div>
            <Tabs defaultValue="6">
                <TabsList className="grid w-full grid-cols-5 h-auto flex-wrap bg-muted p-1">
                    {classes.map((className) => {
                        const count = getPresentCount(className);
                        return (
                            <TabsTrigger key={className} value={className} className="py-2.5 text-xs sm:text-sm font-black flex flex-col sm:flex-row items-center gap-1">
                                <span>{classNamesMap[className]}</span>
                                {count > 0 && <Badge variant="secondary" className="bg-emerald-600 text-white text-[10px] px-2 h-5 ml-1 shadow-sm">({count.toLocaleString('bn-BD')})</Badge>}
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
                {classes.map((className) => (
                    <TabsContent key={className} value={className}>
                        <Card className="border-2 border-primary/5 shadow-md bg-white">
                            <CardContent className="p-0">
                                {getStudentsByClass(className).length === 0 ? (
                                    <p className="text-center text-muted-foreground py-12 italic">এই শ্রেণিতে কোনো শিক্ষার্থী নেই।</p>
                                ) : (
                                    <AttendanceSheet 
                                        classId={className} 
                                        students={getStudentsByClass(className)} 
                                        currentAttendance={classAttendance[className]}
                                        onStatusChange={(sId, status) => handleStatusChange(className, sId, status)}
                                        onRefresh={() => {}}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
};

const QuickRollAttendanceTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { toast } = useToast();
    const { user } = useAuth();
    
    const [selectedClass, setSelectedClass] = useState<string>('6');
    const [rollsInput, setRollsInput] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSave = async () => {
        if (!db || !user || !selectedClass) return;
        
        setIsProcessing(true);
        try {
            const today = new Date();
            const todayStr = format(today, 'yyyy-MM-dd');
            
            // 1. Get all students of this class
            const classStudents = allStudents.filter(s => s.academicYear === selectedYear && s.className === selectedClass);
            
            if (classStudents.length === 0) {
                toast({ variant: 'destructive', title: 'এই শ্রেণিতে কোনো শিক্ষার্থী নেই' });
                setIsProcessing(false);
                return;
            }

            // 2. Parse rolls (handle Bengali digits too)
            const bnToEn = (str: string) => str.replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]);
            const inputRolls = rollsInput
                .split(/[\s,]+/)
                .map(r => parseInt(bnToEn(r.trim()), 10))
                .filter(r => !isNaN(r));

            if (inputRolls.length === 0 && rollsInput.trim() !== '') {
                 toast({ variant: 'destructive', title: 'রোল নম্বরগুলো সঠিক নয়' });
                 setIsProcessing(false);
                 return;
            }

            // 3. Map to attendance status
            const attendanceData: StudentAttendance[] = classStudents.map(student => ({
                studentId: student.id,
                status: inputRolls.includes(student.roll) ? 'present' : 'absent'
            }));

            const dailyAttendance: DailyAttendance = {
                date: todayStr,
                academicYear: selectedYear,
                className: selectedClass,
                attendance: attendanceData,
            };

            await saveDailyAttendance(db, dailyAttendance);
            
            toast({ 
                title: 'হাজিরা সফলভাবে সংরক্ষিত হয়েছে', 
                description: `${inputRolls.length.toLocaleString('bn-BD')} জন উপস্থিত এবং বাকিরা অনুপস্থিত হিসেবে গণ্য হয়েছে।` 
            });
            setRollsInput('');
        } catch (e) {
            console.error(e);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="mt-4 space-y-6 animate-in fade-in duration-500">
            <Card className="border-2 border-primary/10 shadow-lg">
                <CardHeader className="bg-primary/5">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Plus className="h-5 w-5" /> রোল ইনপুট দিয়ে দ্রুত হাজিরা
                    </CardTitle>
                    <CardDescription>শ্রেণি সিলেক্ট করে উপস্থিত শিক্ষার্থীদের রোল নম্বরগুলো লিখুন। বাকিরা স্বয়ংক্রিয়ভাবে অনুপস্থিত হবে।</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="max-w-md space-y-2">
                        <Label className="font-black text-primary">শ্রেণি নির্বাচন করুন</Label>
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {['6', '7', '8', '9', '10'].map(c => <SelectItem key={c} value={c}>{classNamesMap[c]} শ্রেণি</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="font-black text-primary">উপস্থিত রোল নম্বরসমূহ (কমা বা স্পেস দিয়ে লিখুন)</Label>
                        <Textarea 
                            placeholder="উদা: ১, ২, ৫, ১০, ১২..." 
                            className="min-h-[150px] text-lg font-black tracking-widest leading-relaxed focus:ring-primary"
                            value={rollsInput}
                            onChange={e => setRollsInput(e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground italic font-bold">*** বাংলা বা ইংরেজি উভয় অংকেই রোল নম্বর লেখা যাবে।</p>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button 
                            onClick={handleSave} 
                            disabled={isProcessing || !rollsInput.trim()}
                            className="px-12 h-14 text-lg font-black shadow-xl"
                        >
                            {isProcessing ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                            হাজিরা সেভ করুন
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// Missed Attendance Tab Component
const MissedAttendanceTab = () => {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const { toast } = useToast();
    const [selectedClass, setSelectedClass] = useState<string>('6');
    const [selectedMonth, setSelectedMonth] = useState<string>(BENGALI_MONTHS[new Date().getMonth()]);
    const [missedDays, setMissedDays] = useState<Date[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => { setIsClient(true); }, []);

    const fetchMissedAttendance = useCallback(async () => {
        if (!db) return;
        setIsLoading(true);
        try {
            // Get Month Dates
            const monthIndex = BENGALI_MONTHS.indexOf(selectedMonth);
            const year = parseInt(selectedYear);
            const start = startOfMonth(new Date(year, monthIndex));
            const end = endOfMonth(new Date(year, monthIndex));
            const today = new Date();
            const realEnd = end > today ? today : end;

            const allDatesInMonth = eachDayOfInterval({ start, end: realEnd });
            
            // Fetch Holidays
            const holidays = await getHolidays(db);
            const holidayDates = holidays.map(h => h.date);

            // Fetch Existing Attendance for this month and class
            const q = query(
                collection(db, 'attendance'),
                where('academicYear', '==', selectedYear),
                where('className', '==', selectedClass),
                where('date', '>=', format(start, 'yyyy-MM-dd')),
                where('date', '<=', format(realEnd, 'yyyy-MM-dd'))
            );
            const snap = await getDocs(q);
            const takenDates = snap.docs.map(doc => doc.data().date);

            // Filter missed days: Workday, No Holiday, Not in TakenDates
            const missed = allDatesInMonth.filter(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const isWeekend = date.getDay() === 5 || date.getDay() === 6;
                const isHoliday = holidayDates.includes(dateStr);
                return !isWeekend && !isHoliday && !takenDates.includes(dateStr);
            });

            setMissedDays(missed.sort((a, b) => b.getTime() - a.getTime()));
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'তথ্য আনা সম্ভব হয়নি' });
        }
        setIsLoading(false);
    }, [db, selectedClass, selectedMonth, selectedYear, toast]);

    useEffect(() => {
        if (isClient) fetchMissedAttendance();
    }, [fetchMissedAttendance, isClient]);

    if (!isClient) return null;

    return (
        <div className="mt-4 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-white/50 items-end">
                <div className="space-y-2">
                    <Label className="font-bold text-primary">শ্রেণি নির্বাচন</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {['6', '7', '8', '9', '10'].map(c => <SelectItem key={c} value={c}>{classNamesMap[c]} শ্রেণি</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="font-bold text-primary">মাস নির্বাচন</Label>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {BENGALI_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={fetchMissedAttendance} disabled={isLoading} className="font-bold">বকেয়া হাজিরা দেখুন</Button>
            </div>

            <Card className="border-2 border-amber-100 shadow-lg">
                <CardHeader className="bg-amber-50/50">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-amber-800 flex items-center gap-2">
                                <CalendarX className="h-5 w-5" /> বকেয়া হাজিরার তালিকা (Missed Days)
                            </CardTitle>
                            <CardDescription>স্কুল খোলা থাকা সত্ত্বেও যেসব দিনে হাজিরা নেওয়া হয়নি</CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-white text-amber-800 border-amber-200 font-black h-8 px-4">
                            মোট বকেয়া: {missedDays.length.toLocaleString('bn-BD')} দিন
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-12 text-center italic text-muted-foreground">বিশ্লেষণ করা হচ্ছে...</div>
                    ) : missedDays.length === 0 ? (
                        <div className="p-12 text-center text-emerald-600 font-black text-lg">
                            অসাধারণ! এই মাসে এখন পর্যন্ত সকল কার্যদিবসের হাজিরা সম্পন্ন হয়েছে।
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="w-20 text-center">ক্রমিক</TableHead>
                                    <TableHead>তারিখ</TableHead>
                                    <TableHead>বার</TableHead>
                                    <TableHead className="text-right">স্ট্যাটাস</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {missedDays.map((date, idx) => (
                                    <TableRow key={date.getTime()} className="hover:bg-amber-50/50 h-12">
                                        <TableCell className="text-center font-bold">{(idx + 1).toLocaleString('bn-BD')}</TableCell>
                                        <TableCell className="font-black text-slate-700">{format(date, 'd MMMM yyyy', { locale: bn })}</TableCell>
                                        <TableCell className="font-bold text-muted-foreground">{format(date, 'EEEE', { locale: bn })}</TableCell>
                                        <TableCell className="text-right">
                                            <Badge variant="destructive" className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100">হাজিরা নেওয়া হয়নি</Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

// Risks/Alerts Tab
const AbsenceAlertsTab = ({ allStudents }: { allStudents: Student[] }) => {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const [selectedClass, setSelectedClass] = useState<string>('6');
    const [alerts, setAlerts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchAlerts = useCallback(async () => {
        if (!db) return;
        setIsLoading(true);
        try {
            const data = await getConsecutiveAbsences(db, selectedClass, selectedYear);
            setAlerts(data);
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    }, [db, selectedClass, selectedYear]);

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    const studentMap = useMemo(() => {
        const map = new Map<string, Student>();
        allStudents.forEach(s => map.set(s.id, s));
        return map;
    }, [allStudents]);

    return (
        <div className="mt-4 space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg bg-white/50 items-end">
                <div className="space-y-2 flex-1">
                    <Label className="font-bold text-primary">শ্রেণি নির্বাচন</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {['6', '7', '8', '9', '10'].map(c => <SelectItem key={c} value={c}>{classNamesMap[c]} শ্রেণি</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <Button onClick={fetchAlerts} disabled={isLoading} className="font-bold">আপডেট দেখুন</Button>
            </div>

            <Card className="border-2 border-rose-100">
                <CardHeader className="bg-rose-50/30">
                    <CardTitle className="text-rose-700 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5" /> অনুপস্থিতি সতর্কবার্তা
                    </CardTitle>
                    <CardDescription>টানা ৩ দিনের বেশি অনুপস্থিত শিক্ষার্থীদের তালিকা</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-12 text-center text-muted-foreground">লোড হচ্ছে...</div>
                    ) : alerts.length === 0 ? (
                        <div className="p-12 text-center text-red-600 font-black text-xl animate-in fade-in zoom-in duration-500">
                            এই শ্রেণিতে বর্তমানে তিন দিনের বেশি অনুপস্থিত শিক্ষার্থী নেই।
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-20 text-center">রোল</TableHead>
                                    <TableHead>নাম</TableHead>
                                    <TableHead className="text-center">অনুপস্থিতি দিন</TableHead>
                                    <TableHead className="text-right">শেষ তারিখ</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {alerts.map(alert => {
                                    const student = studentMap.get(alert.studentId);
                                    return (
                                        <TableRow key={alert.studentId} className="hover:bg-rose-50 transition-colors">
                                            <TableCell className="text-center font-black">{student?.roll.toLocaleString('bn-BD') || '-'}</TableCell>
                                            <TableCell className="font-bold text-rose-900">{student?.studentNameBn || '-'}</TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="destructive" className="font-black px-3">{alert.absentDays.toLocaleString('bn-BD')} দিন</Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-xs font-bold text-muted-foreground">
                                                {format(new Date(alert.lastAbsentDate), 'PP', { locale: bn })}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

// Attendance Report sheet
interface StudentReport {
    student: Student;
    presentDays: number;
    absentDays: number;
    totalDays: number;
}
const ReportSheet = ({ classId, students, startDate, endDate }: { classId: string, students: Student[], startDate?: Date, endDate?: Date }) => {
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user } = useAuth();
    const [reportData, setReportData] = useState<StudentReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !user) return;

        const fetchAttendance = async () => {
            setIsLoading(true);
            const allAttendanceFromDb = await getAttendanceFromStorage(db);
            const allAttendanceForClass = allAttendanceFromDb.filter(
                att => att.academicYear === selectedYear && att.className === classId
            );

            const allAttendance = allAttendanceForClass.filter(att => {
                 if (!startDate || !endDate) {
                    return true;
                }
                try {
                    const attDate = new Date(att.date);
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);

                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);

                    return attDate >= start && attDate <= end;
                } catch(e) {
                    return false;
                }
            });
            
            const studentReports = students.map(student => {
                let presentDays = 0;
                let absentDays = 0;

                allAttendance.forEach(dailyRecord => {
                    const studentAttendance = dailyRecord.attendance.find(a => a.studentId === student.id);
                    if (studentAttendance) {
                        if (studentAttendance.status === 'present') {
                            presentDays++;
                        } else {
                            absentDays++;
                        }
                    }
                });

                return {
                    student: student,
                    presentDays,
                    absentDays,
                    totalDays: allAttendance.length,
                };
            });

            setReportData(studentReports);
            setIsLoading(false);
        }

        fetchAttendance();

    }, [classId, students, selectedYear, db, user, startDate, endDate]);

     if (isLoading) {
        return <p className="text-center p-8 italic">রিপোর্ট তৈরি হচ্ছে...</p>
    }

    if (students.length === 0) {
        return <p className="text-center text-muted-foreground p-8">এই শ্রেণিতে কোনো শিক্ষার্থী নেই।</p>
    }

    if (reportData.length === 0 || reportData[0].totalDays === 0) {
        return <p className="text-center text-muted-foreground p-8 italic">এই নির্বাচনি সীমার মধ্যে কোনো হাজিরা রেকর্ড পাওয়া যায়নি।</p>
    }


    return (
        <div className="table-container">
            <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                        <TableHead className="w-20 text-center">রোল</TableHead>
                        <TableHead>শিক্ষার্থীর নাম</TableHead>
                        <TableHead className="text-center">মোট কার্যদিবস</TableHead>
                        <TableHead className="text-center">উপস্থিত</TableHead>
                        <TableHead className="text-center">অনুপস্থিত</TableHead>
                        <TableHead className="text-right">উপস্থিতির হার (%)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {reportData.map(report => (
                        <TableRow key={report.student.id} className="hover:bg-accent/5 transition-colors">
                            <TableCell className="text-center font-black">{report.student.roll.toLocaleString('bn-BD')}</TableCell>
                            <TableCell className="font-bold text-slate-700">{report.student.studentNameBn}</TableCell>
                            <TableCell className="text-center font-medium">{report.totalDays.toLocaleString('bn-BD')}</TableCell>
                            <TableCell className="text-center text-emerald-600 font-black">{report.presentDays.toLocaleString('bn-BD')}</TableCell>
                            <TableCell className="text-center text-rose-600 font-black">{report.absentDays.toLocaleString('bn-BD')}</TableCell>
                            <TableCell className="text-right font-black text-primary">
                                {report.totalDays > 0 ? 
                                    ((report.presentDays / report.totalDays) * 100).toFixed(2).toLocaleString('bn-BD') + '%' 
                                    : 'N/A'
                                }
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

const AttendanceReportTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { selectedYear } = useAcademicYear();
    const [startDate, setStartDate] = useState<Date | undefined>(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const [endDate, setEndDate] = useState<Date | undefined>(new Date());
    
    const studentsForYear = useMemo(() => {
        return allStudents.filter(student => student.academicYear === selectedYear);
    }, [allStudents, selectedYear]);
    const classes = ['6', '7', '8', '9', '10'];

    const getStudentsByClass = (className: string): Student[] => {
        return studentsForYear.filter((student) => student.className === className);
    };

    return (
        <div className="mt-4 space-y-6">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border-2 border-dashed rounded-lg items-end bg-white/50">
                <div className="w-full space-y-2">
                    <Label className="font-bold text-primary flex items-center gap-2">শুরুর তারিখ</Label>
                    <DatePicker value={startDate} onChange={setStartDate} placeholder="শুরুর তারিখ" />
                </div>
                <div className="w-full space-y-2">
                    <Label className="font-bold text-primary flex items-center gap-2">শেষের তারিখ</Label>
                    <DatePicker value={endDate} onChange={setEndDate} placeholder="শেষের তারিখ" />
                </div>
            </div>
            <Tabs defaultValue="6">
                <TabsList className="grid w-full grid-cols-5 h-auto flex-wrap bg-muted p-1">
                    {classes.map((className) => (
                        <TabsTrigger key={className} value={className} className="py-2 text-xs sm:text-sm font-black">
                            {classNamesMap[className]} শ্রেণি
                        </TabsTrigger>
                    ))}
                </TabsList>
                {classes.map((className) => (
                    <TabsContent key={className} value={className}>
                        <Card className="border-2 border-primary/5 shadow-md">
                            <CardContent className="p-0">
                                <ReportSheet classId={className} students={getStudentsByClass(className)} startDate={startDate} endDate={endDate} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
};

// Main Page Component
export default function AttendancePage() {
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const db = useFirestore();
    const { user } = useAuth();
    const { selectedYear } = useAcademicYear();
     const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!db || !user) return;
        setIsLoading(true);
        const studentsQuery = query(collection(db, "students"), orderBy("roll"));

        const unsubscribe = onSnapshot(studentsQuery, (querySnapshot) => {
            const studentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), dob: doc.data().dob?.toDate(), })) as Student[];
            setAllStudents(studentsData);
            setIsLoading(false);
        }, (error: FirestoreError) => {
            if (error.code === 'permission-denied') return;
            const permissionError = new FirestorePermissionError({ path: 'students', operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, user]);
    
    return (
        <div className="flex min-h-screen w-full flex-col bg-amber-50 font-kalpurush">
            <Header />
            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-80">
                <Card className="border-2 border-primary/10 shadow-2xl overflow-hidden rounded-xl">
                    <CardHeader className="bg-white/70 border-b backdrop-blur-sm">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <CardTitle className="text-3xl font-black text-primary flex items-center gap-3">
                                    <CalendarCheck className="h-8 w-8" /> হাজিরা ব্যবস্থাপনা
                                </CardTitle>
                                {isClient && <p className="text-sm font-black text-muted-foreground mt-1">শিক্ষাবর্ষ: {selectedYear.toLocaleString('bn-BD')}</p>}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 bg-slate-50/30">
                        {isLoading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-64 w-full" />
                            </div>
                        ) : (
                            <Tabs defaultValue="digital-attendance">
                                <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto md:h-14 mb-8 gap-2 bg-muted/50 p-1.5 rounded-lg border">
                                    <TabsTrigger value="digital-attendance" className="font-black text-sm md:text-md data-[state=active]:shadow-lg">ডিজিটাল হাজিরা</TabsTrigger>
                                    <TabsTrigger value="quick-roll" className="font-black text-sm md:text-md data-[state=active]:shadow-lg text-emerald-700">রোল ইনপুট</TabsTrigger>
                                    <TabsTrigger value="report" className="font-black text-sm md:text-md data-[state=active]:shadow-lg">রিপোর্ট</TabsTrigger>
                                    <TabsTrigger value="missed-attendance" className="font-black text-sm md:text-md data-[state=active]:shadow-lg text-amber-700">বকেয়া হাজিরা</TabsTrigger>
                                    <TabsTrigger value="alerts" className="font-black text-sm md:text-md data-[state=active]:shadow-lg text-rose-700">সতর্কবার্তা</TabsTrigger>
                                </TabsList>
                                <TabsContent value="digital-attendance" className="mt-4 animate-in slide-in-from-left-4 duration-500">
                                    <DigitalAttendanceTab allStudents={allStudents} />
                                </TabsContent>
                                <TabsContent value="quick-roll" className="mt-4">
                                    <QuickRollAttendanceTab allStudents={allStudents} />
                                </TabsContent>
                                <TabsContent value="report" className="mt-4 animate-in slide-in-from-right-4 duration-500">
                                    <AttendanceReportTab allStudents={allStudents} />
                                </TabsContent>
                                <TabsContent value="missed-attendance" className="mt-4 animate-in fade-in duration-500">
                                    <MissedAttendanceTab />
                                </TabsContent>
                                <TabsContent value="alerts" className="mt-4 animate-in zoom-in-95 duration-500">
                                    <AbsenceAlertsTab allStudents={allStudents} />
                                </TabsContent>
                            </Tabs>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}

