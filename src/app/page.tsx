
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, GraduationCap, Clock, Bell, Info, Plus, Trash2, Sparkles, Loader2, FileText, Upload } from 'lucide-react';
import { Student } from '@/lib/student-data';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { getAttendanceForDate } from '@/lib/attendance-data';
import { getFullRoutine, ClassRoutine } from '@/lib/routine-data';
import { getNotices, addNotice, deleteNotice, Notice } from '@/lib/notice-data';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, FirestoreError } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { isHoliday, Holiday } from '@/lib/holiday-data';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { generateNotice } from '@/ai/flows/generate-notice-flow';

const parseTeacherName = (cell: string): string => {
    if (!cell || !cell.includes(' - ')) return 'N/A';
    const parts = cell.split(' - ');
    return parts.pop()?.trim() || 'N/A';
};

const periodTimes = [
  { name: "১ম", start: { h: 10, m: 30 }, end: { h: 11, m: 20 } },
  { name: "২য়", start: { h: 11, m: 20 }, end: { h: 12, m: 10 } },
  { name: "৩য়", start: { h: 12, m: 10 }, end: { h: 13, m: 0 } },
  { name: "বিরতি", start: { h: 13, m: 0 }, end: { h: 13, m: 40 } },
  { name: "৪র্থ", start: { h: 13, m: 40 }, end: { h: 14, m: 30 } },
  { name: "৫ম", start: { h: 14, m: 30 }, end: { h: 15, m: 20 } },
  { name: "৬ষ্ঠ", start: { h: 15, m: 20 }, end: { h: 16, m: 10 } },
];

const dayMap = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const classNamesMap: { [key: string]: string } = {
    '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম',
};

const NoticeBoard = () => {
    const db = useFirestore();
    const { user } = useAuth();
    const { toast } = useToast();
    const [notices, setNotices] = useState<Notice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const isAdmin = user?.role === 'admin';

    const [newNotice, setNewNotice] = useState({ title: '', content: '', priority: 'normal' as Notice['priority'], pdfUrl: '' });
    const [uploadingPdf, setUploadingPdf] = useState(false);

    const fetchNotices = useCallback(async () => {
        if (!db || !user) return;
        setIsLoading(true);
        try {
            const data = await getNotices(db, 10);
            setNotices(data);
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    }, [db, user]);

    useEffect(() => {
        if (user) {
            fetchNotices();
        }
    }, [user, fetchNotices]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            toast({ variant: 'destructive', title: 'ভুল ফাইল ফরম্যাট', description: 'শুধুমাত্র পিডিএফ ফাইল আপলোড করুন।' });
            return;
        }

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            toast({ variant: 'destructive', title: 'ফাইল সাইজ অনেক বড়', description: '২ মেগাবাইটের কম সাইজের পিডিএফ আপলোড করুন।' });
            return;
        }

        setUploadingPdf(true);
        const reader = new FileReader();
        reader.onload = (event) => {
            setNewNotice(prev => ({ ...prev, pdfUrl: event.target?.result as string }));
            setUploadingPdf(false);
            toast({ title: 'পিডিএফ ফাইল যুক্ত হয়েছে' });
        };
        reader.onerror = () => {
            setUploadingPdf(false);
            toast({ variant: 'destructive', title: 'ফাইল পড়তে সমস্যা হয়েছে' });
        };
        reader.readAsDataURL(file);
    };

    const handleAddNotice = async () => {
        if (!db || !user) return;
        if (!newNotice.title || !newNotice.content) {
            toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ', description: 'শিরোনাম ও বিষয়বস্তু লিখুন।' });
            return;
        }

        const senderName = user.role === 'admin' ? 'প্রধান শিক্ষক' : (user.displayName || user.email || 'শিক্ষক');

        try {
            await addNotice(db, {
                title: newNotice.title,
                content: newNotice.content,
                priority: newNotice.priority,
                pdfUrl: newNotice.pdfUrl || undefined,
                senderName: senderName
            });
            toast({ title: 'নোটিশ প্রকাশিত হয়েছে' });
            setIsAddOpen(false);
            setNewNotice({ title: '', content: '', priority: 'normal', pdfUrl: '' });
            fetchNotices();
        } catch (e) {}
    };

    const handleAIGenerate = async () => {
        if (!newNotice.title) {
            toast({ variant: 'destructive', title: 'শিরোনাম লিখুন', description: 'এআই দিয়ে জেনারেট করতে প্রথমে একটি সংক্ষিপ্ত শিরোনাম বা বিষয় লিখুন।' });
            return;
        }
        setIsGenerating(true);
        try {
            const result = await generateNotice({ topic: newNotice.title });
            if (result) {
                setNewNotice(prev => ({
                    ...prev,
                    title: result.title,
                    content: result.content
                }));
                toast({ title: 'নোটিশ তৈরি হয়েছে' });
            }
        } catch (e) {
            console.error("AI Generation Error:", e);
            toast({ variant: 'destructive', title: 'এআই কাজ করছে না', description: 'সার্ভারে সমস্যা অথবা API Key সেটিংস চেক করুন।' });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!db) return;
        try {
            await deleteNotice(db, id);
            toast({ title: 'নোটিশ মুছে ফেলা হয়েছে' });
            fetchNotices();
        } catch (e) {}
    };

    const openPdf = (url: string) => {
        const win = window.open();
        if (win) {
            win.document.write(`<iframe src="${url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
        }
    };

    return (
        <Card className="lg:col-span-1 shadow-md border-primary/10">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-primary/5 rounded-t-lg">
                <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary animate-pulse" />
                    <CardTitle className="text-lg">নোটিশ বোর্ড</CardTitle>
                </div>
                {isAdmin && (
                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8 bg-white"><Plus className="h-4 w-4" /></Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader><DialogTitle>নতুন নোটিশ তৈরি করুন</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>শিরোনাম / বিষয়</Label>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            className="h-7 text-xs text-primary bg-primary/5 hover:bg-primary/10"
                                            onClick={handleAIGenerate}
                                            disabled={isGenerating}
                                        >
                                            {isGenerating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                                            AI দিয়ে লিখুন
                                        </Button>
                                    </div>
                                    <Input 
                                        placeholder="উদা: শীতকালীন ছুটি সংক্রান্ত"
                                        value={newNotice.title} 
                                        onChange={e => setNewNotice({...newNotice, title: e.target.value})} 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>ধরণ</Label>
                                    <Select value={newNotice.priority} onValueChange={(v: any) => setNewNotice({...newNotice, priority: v})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="normal">সাধারণ</SelectItem>
                                            <SelectItem value="important">গুরুত্বপূর্ণ</SelectItem>
                                            <SelectItem value="urgent">জরুরি</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>বিষয়বস্তু</Label>
                                    <Textarea 
                                        placeholder="নোটিশের বিস্তারিত লিখুন..."
                                        value={newNotice.content} 
                                        onChange={e => setNewNotice({...newNotice, content: e.target.value})} 
                                        className="min-h-[150px]" 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>পিডিএফ ফাইল (ঐচ্ছিক)</Label>
                                    <div className="flex items-center gap-4">
                                        <Button variant="outline" type="button" onClick={() => document.getElementById('pdf-upload')?.click()} className="w-full border-dashed" disabled={uploadingPdf}>
                                            {uploadingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                            {newNotice.pdfUrl ? 'ফাইল পরিবর্তন করুন' : 'পিডিএফ আপলোড করুন'}
                                        </Button>
                                        <input id="pdf-upload" type="file" accept=".pdf" className="hidden" onChange={handleFileChange} />
                                        {newNotice.pdfUrl && <Badge variant="secondary" className="whitespace-nowrap"><FileText className="mr-1 h-3 w-3" /> ফাইল যুক্ত হয়েছে</Badge>}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <DialogClose asChild><Button variant="ghost">বাতিল</Button></DialogClose>
                                <Button onClick={handleAddNotice} disabled={uploadingPdf || isGenerating}>প্রকাশ করুন</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent className="p-4">
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 scrollbar-thin">
                    {isLoading ? (
                        [...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-md" />)
                    ) : notices.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 text-sm italic">বর্তমানে কোনো নোটিশ নেই।</p>
                    ) : (
                        notices.map(notice => (
                            <div key={notice.id} className={cn(
                                "p-3 rounded-lg border-l-4 shadow-sm relative group transition-all hover:bg-accent/5",
                                notice.priority === 'urgent' ? "bg-red-50 border-l-red-500" : notice.priority === 'important' ? "bg-amber-50 border-l-amber-500" : "bg-blue-50 border-l-blue-500"
                            )}>
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-bold text-sm leading-tight pr-6">{notice.title}</h4>
                                    {isAdmin && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                                                    <AlertDialogDescription>এই নোটিশটি স্থায়ীভাবে মুছে ফেলা হবে।</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(notice.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">মুছে ফেলুন</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                                <p className="text-xs text-muted-foreground mb-3 whitespace-pre-wrap leading-relaxed text-justify">{notice.content}</p>
                                
                                {notice.pdfUrl && (
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="h-7 text-[10px] w-full mb-3 bg-white hover:bg-primary hover:text-white transition-colors"
                                        onClick={() => openPdf(notice.pdfUrl!)}
                                    >
                                        <FileText className="mr-1 h-3 w-3" /> পিডিএফ দেখুন
                                    </Button>
                                )}

                                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold border-t border-dashed pt-2">
                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(notice.date, 'dd MMM p', { locale: bn })}</span>
                                    <span>{notice.senderName === 'dlswf.roy@gmail.com' ? 'প্রধান শিক্ষক' : notice.senderName}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

const LiveRoutineCard = () => {
    const db = useFirestore();
    const { user } = useAuth();
    const { selectedYear } = useAcademicYear();
    const [fullRoutine, setFullRoutine] = useState<ClassRoutine[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isLoading, setIsLoading] = useState(true);
    const [activeHoliday, setActiveHoliday] = useState<Holiday | undefined>(undefined);

    useEffect(() => {
        if (!db || !user) return;
        setIsLoading(true);
        const fetchData = async () => {
            try {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const [routineData, holidayInfo] = await Promise.all([
                    getFullRoutine(db, selectedYear),
                    isHoliday(db, todayStr),
                ]);
                setFullRoutine(routineData);
                setActiveHoliday(holidayInfo);
            } catch (e) {
                console.error(e);
            }
            setIsLoading(false);
        };
        fetchData();
    }, [db, selectedYear, user]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const getCurrentPeriodInfo = () => {
        const now = currentTime;
        const currentDayName = dayMap[now.getDay()];

        if (activeHoliday) {
            return { status: `আজ ${activeHoliday.description}।`, runningClasses: [], isSpecialStatus: true };
        }
        
        if (currentDayName === 'শুক্রবার' || currentDayName === 'শনিবার') {
            return { status: 'আজ সাপ্তাহিক ছুটি।', runningClasses: [], isSpecialStatus: true };
        }

        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        let periodIndex = -1;
        let status = 'ক্লাস চলছে';
        
        for(let i=0; i<periodTimes.length; i++) {
            const period = periodTimes[i];
            const startMinutes = period.start.h * 60 + period.start.m;
            const endMinutes = period.end.h * 60 + period.end.m;

            if(currentMinutes >= startMinutes && currentMinutes < endMinutes) {
                if (period.name === 'বিরতি') {
                    return { status: 'এখন টিফিনের বিরতি চলছে।', runningClasses: [], isSpecialStatus: false };
                }
                if (i < 3) periodIndex = i;
                if (i > 3) periodIndex = i - 1;
                break;
            }
        }
        
        if (periodIndex === -1) {
             return { status: 'এখন কোনো ক্লাস চলছে না।', runningClasses: [], isSpecialStatus: false };
        }

        const runningClasses = fullRoutine
            .filter(r => r.day === currentDayName)
            .map(r => {
                const periodContent = r.periods[periodIndex];
                if (periodContent) {
                    const adjustedPeriodIndex = periodIndex + (periodIndex >= 3 ? 1 : 0);
                    const periodInfo = periodTimes[adjustedPeriodIndex];
                    return {
                        className: r.className,
                        displayClassName: classNamesMap[r.className] || r.className,
                        teacher: parseTeacherName(periodContent),
                        period: periodInfo.name,
                        time: `${periodInfo.start.h.toString().padStart(2, '0')}:${periodInfo.start.m.toString().padStart(2, '0')} - ${periodInfo.end.h.toString().padStart(2, '0')}:${periodInfo.end.m.toString().padStart(2, '0')}`
                    };
                }
                return null;
            })
            .filter((c): c is NonNullable<typeof c> => c !== null)
            .sort((a, b) => parseInt(a.className) - parseInt(b.className));

        if (runningClasses.length === 0 && status === 'ক্লাস চলছে') {
            status = 'এখন কোনো ক্লাস চলছে না।';
        }

        return { status, runningClasses, isSpecialStatus };
    };

    const { status, runningClasses, isSpecialStatus } = getCurrentPeriodInfo();

    return (
        <Card className="lg:col-span-2 shadow-md border-primary/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> লাইভ ক্লাস রুটিন
                </CardTitle>
                 <Badge variant="outline" className="flex items-center gap-2 bg-white">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    {currentTime.toLocaleTimeString('bn-BD', { hour: 'numeric', minute: 'numeric' })}
                </Badge>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-2 pt-4">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                    </div>
                ) : runningClasses.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>সময়</TableHead>
                                <TableHead>শিক্ষক</TableHead>
                                <TableHead>শ্রেণি</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {runningClasses.map((rc, index) => (
                                <TableRow key={index}>
                                    <TableCell className="text-xs">{rc.time}</TableCell>
                                    <TableCell className="font-medium">{rc.teacher}</TableCell>
                                    <TableCell>{rc.displayClassName}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="flex items-center justify-center h-32 text-center">
                        <p className={cn(
                            "text-muted-foreground transition-all duration-500",
                            isSpecialStatus ? "text-red-600 font-black text-3xl drop-shadow-sm" : "text-lg"
                        )}>
                            {status}
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalTeachers, setTotalTeachers] = useState(0);
  const [totalPresent, setTotalPresent] = useState(0);
  const [totalAbsent, setTotalAbsent] = useState(0);
  const [classAttendance, setClassAttendance] = useState<Record<string, { present: number; absent: number; total: number }>>({});
  const [attendanceTaken, setAttendanceTaken] = useState(false);
  const { selectedYear } = useAcademicYear();
  const db = useFirestore();
  
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
      if (!db || !user) return;

      const studentsQuery = query(collection(db, 'students'), where('academicYear', '==', selectedYear));
      
      const unsubscribeStudents = onSnapshot(studentsQuery, async (studentsSnapshot) => {
        if (!user) return;
        const studentsForYear = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Student[];
        setTotalStudents(studentsForYear.length);
        
        const classMap: Record<string, { present: number; absent: number; total: number }> = {
            '6': { present: 0, absent: 0, total: 0 },
            '7': { present: 0, absent: 0, total: 0 },
            '8': { present: 0, absent: 0, total: 0 },
            '9': { present: 0, absent: 0, total: 0 },
            '10': { present: 0, absent: 0, total: 0 },
        };

        studentsForYear.forEach(student => {
            if (classMap[student.className]) {
                classMap[student.className].total++;
            }
        });

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        try {
            const todaysAttendance = await getAttendanceForDate(db, todayStr, selectedYear);
            setAttendanceTaken(todaysAttendance.length > 0);

            if (todaysAttendance.length > 0) {
                let totalPresentCount = 0;
                let totalAbsentCount = 0;
                todaysAttendance.forEach(classAttendanceRecord => {
                    const className = classAttendanceRecord.className;
                    if (classMap[className]) {
                        let presentCount = 0;
                        let absentCount = 0;
                        
                        classAttendanceRecord.attendance.forEach(studentAttendance => {
                            const studentExistsInYear = studentsForYear.some(s => s.id === studentAttendance.studentId && s.className === className);
                            if (studentExistsInYear) {
                                if (studentAttendance.status === 'present') {
                                    presentCount++;
                                } else {
                                    absentCount++;
                                }
                            }
                        });
                        classMap[className].present = presentCount;
                        classMap[className].absent = absentCount;
                        totalPresentCount += presentCount;
                        totalAbsentCount += absentCount;
                    }
                });
                setTotalPresent(totalPresentCount);
                setTotalAbsent(totalAbsentCount);
            } else {
                setTotalPresent(0);
                setTotalAbsent(0);
            }
        } catch (e) {}
        
        setClassAttendance(classMap);
      },
      async (error: FirestoreError) => {
        if (error.code === 'permission-denied') return;
        if (user) {
            const permissionError = new FirestorePermissionError({
                path: 'students',
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
        }
      });

      const staffQuery = query(collection(db, 'staff'), where('isActive', '==', true), where('staffType', '==', 'teacher'));
      const unsubscribeStaff = onSnapshot(staffQuery, (querySnapshot) => {
        if (!user) return;
        setTotalTeachers(querySnapshot.size);
      },
      async (error: FirestoreError) => {
        if (error.code === 'permission-denied') return;
        if (user) {
            const permissionError = new FirestorePermissionError({
                path: 'staff',
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
        }
      });

      return () => {
        unsubscribeStudents();
        unsubscribeStaff();
      };

  }, [selectedYear, db, user]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-sky-100">
          <p>লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-sky-100">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
          <Card className="bg-sky-100 border-sky-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-sky-800">
                মোট শিক্ষার্থী
              </CardTitle>
              <Users className="h-4 w-4 text-sky-700" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-sky-900">{totalStudents.toLocaleString('bn-BD')}</div>
              <p className="text-xs text-sky-600">
                শিক্ষাবর্ষ {selectedYear.toLocaleString('bn-BD')}
              </p>
            </CardContent>
          </Card>
          
           <Card className="bg-emerald-100 border-emerald-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-800">
                মোট উপস্থিত
              </CardTitle>
              <Users className="h-4 w-4 text-emerald-700" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-900">{totalPresent.toLocaleString('bn-BD')}</div>
              <p className="text-xs text-emerald-600">
                আজকের মোট উপস্থিত শিক্ষার্থী
              </p>
            </CardContent>
          </Card>

          <Card className="bg-rose-100 border-rose-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-rose-800">
                মোট অনুপস্থিত
              </CardTitle>
              <Users className="h-4 w-4 text-rose-700" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-rose-900">{totalAbsent.toLocaleString('bn-BD')}</div>
              <p className="text-xs text-rose-600">
                আজকের মোট অনুপস্থিত শিক্ষার্থী
              </p>
            </CardContent>
          </Card>

          <Card className="bg-amber-100 border-amber-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-800">
                মোট শিক্ষক
              </CardTitle>
              <GraduationCap className="h-4 w-4 text-amber-700" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-900">{totalTeachers.toLocaleString('bn-BD')}</div>
              <p className="text-xs text-amber-600">
                &nbsp;
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
          <Card className="lg:col-span-1 shadow-md border-primary/10">
            <CardHeader className="bg-primary/5 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" /> আজকের হাজিরা
                </CardTitle>
                <CardDescription>
                    {attendanceTaken ? 'শ্রেণিভিত্তিক আজকের উপস্থিতির সারসংক্ষেপ' : 'আজ এখনও কোনো শ্রেণির হাজিরা নেওয়া হয়নি।'}
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-4">শ্রেণি</TableHead>
                            <TableHead className="text-center">মোট</TableHead>
                            <TableHead className="text-center">উপস্থিত</TableHead>
                            <TableHead className="text-center">অনুপস্থিত</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {Object.entries(classAttendance).map(([className, data]) => (
                            <TableRow key={className}>
                                <TableCell className="font-medium pl-4">{classNamesMap[className]} শ্রেণি</TableCell>
                                <TableCell className="text-center">{data.total.toLocaleString('bn-BD')}</TableCell>
                                <TableCell className="text-center text-emerald-600 font-semibold">{data.present.toLocaleString('bn-BD')}</TableCell>
                                <TableCell className="text-center text-rose-600 font-semibold">{data.absent.toLocaleString('bn-BD')}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
          </Card>
          <LiveRoutineCard />
          <NoticeBoard />
        </div>
      </main>
    </div>
  );
}
