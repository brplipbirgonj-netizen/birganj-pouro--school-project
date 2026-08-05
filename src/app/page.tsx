'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, GraduationCap, Clock, Bell, Info, Plus, Trash2, CheckCircle2, XCircle, Banknote, PieChart as PieChartIcon, UserMinus, Sparkles, Loader2, FilePen, Megaphone, RefreshCcw, Image as ImageIcon } from 'lucide-react';
import { Student } from '@/lib/student-data';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { getAttendanceForDate } from '@/lib/attendance-data';
import { getFullRoutine, ClassRoutine } from '@/lib/routine-data';
import { getProxyClasses, ProxyClass } from '@/lib/proxy-data';
import { getNotices, addNotice, deleteNotice, Notice } from '@/lib/notice-data';
import { getStaffAttendanceByDate } from '@/lib/staff-attendance-data';
import { getStaff } from '@/lib/staff-data';
import { generateNotice } from '@/ai/flows/generate-notice-flow';
import { getGalleryConfig, GalleryConfig, defaultGalleryConfig } from '@/lib/gallery-data';
import { getTransactions, Transaction } from '@/lib/transactions-data';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, FirestoreError, orderBy, limit, doc, Timestamp } from 'firebase/firestore';
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
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import Image from 'next/image';

const parseTeacherName = (cell: string): string => {
    if (!cell || !cell.includes(' - ')) return 'N/A';
    const parts = cell.split(' - ');
    return parts.pop()?.trim() || 'N/A';
};

const periodTimes = [
  { name: "১ম", start: { h: 10, m: 30 }, end: { h: 11, m: 20 } },
  { name: "২য়", start: { h: 11, m: 20 }, end: { h: 12, m: 10 } },
  { name: "৩য়", start: { h: 12, m: 10 }, end: { h: 13, m: 0 } },
  { name: "বিরতি", start: { h: 13, m: 0 }, end: { h: 14, m: 0 } },
  { name: "৪র্থ", start: { h: 14, m: 0 }, end: { h: 14, m: 40 } },
  { name: "৫ম", start: { h: 14, m: 40 }, end: { h: 15, m: 20 } },
  { name: "৬ষ্ঠ", start: { h: 15, m: 20 }, end: { h: 16, m: 0 } },
];

const dayMap = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const classNamesMap: { [key: string]: string } = {
    '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম',
};

// Scrolling Notice Ticker Component
const NoticeTicker = () => {
    const db = useFirestore();
    const { user } = useAuth();
    const [latestNotice, setLatestNotice] = useState<Notice | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !user) return;
        
        const q = query(collection(db, 'notices'), orderBy('date', 'desc'), limit(1));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                setLatestNotice({
                    id: snapshot.docs[0].id,
                    ...data,
                    date: data.date instanceof Timestamp ? data.date.toDate() : (data.date ? new Date(data.date) : new Date()),
                } as Notice);
            } else {
                setLatestNotice(null);
            }
            setIsLoading(false);
        }, async (error: FirestoreError) => {
            if (error.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'notices',
                    operation: 'list',
                }));
            }
        });

        return () => unsubscribe();
    }, [db, user]);

    if (latestNotice) {
        return (
            <div className="w-full bg-yellow-100 text-red-700 h-8 flex items-center overflow-hidden border-y-2 border-red-500 shadow-md sticky top-16 md:top-24 z-40 font-kalpurush group cursor-default">
                <div className="bg-red-600 text-white px-3 h-full flex items-center gap-1.5 shrink-0 z-10 shadow-lg">
                    <Megaphone className="h-3.5 w-3.5 animate-bounce" />
                    <span className="font-black text-xs whitespace-nowrap leading-none">জরুরি নোটিশ:</span>
                </div>
                <div className="flex-1 relative overflow-hidden h-full flex items-center">
                    <div className="absolute whitespace-nowrap animate-marquee flex items-center gap-10 group-hover:pause-animation">
                        <span className="font-black text-xs tracking-tight">
                            <span className="text-blue-800">[{latestNotice.title}]</span> - {latestNotice.content.replace(/\n/g, ' ')}
                        </span>
                        <span className="font-black text-xs tracking-tight">
                            <span className="text-blue-800">[{latestNotice.title}]</span> - {latestNotice.content.replace(/\n/g, ' ')}
                        </span>
                    </div>
                </div>
                <style jsx>{`
                    @keyframes marquee {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .animate-marquee {
                        animation: marquee 35s linear infinite;
                        display: inline-flex;
                        width: max-content;
                    }
                    .pause-animation {
                        animation-play-state: paused;
                    }
                `}</style>
            </div>
        );
    }

    if (isLoading) return <div className="h-8 w-full mb-4 bg-muted animate-pulse" />;
    return null;
};

const GalleryCard = () => {
    const db = useFirestore();
    const { user } = useAuth();
    const [config, setConfig] = useState<GalleryConfig>(defaultGalleryConfig);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !user) return;
        const unsub = onSnapshot(doc(db, 'school', 'gallery'), (snap) => {
            if (snap.exists()) {
                setConfig(snap.data() as GalleryConfig);
            }
            setIsLoading(false);
        }, async (error: FirestoreError) => {
            if (error.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'school/gallery',
                    operation: 'get',
                }));
            }
        });
        return () => unsub();
    }, [db, user]);

    const activeImages = useMemo(() => config.images.filter(img => img.isActive), [config.images]);

    useEffect(() => {
        if (activeImages.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentIdx(prev => (prev + 1) % activeImages.length);
        }, config.duration * 1000);
        return () => clearInterval(interval);
    }, [activeImages, config.duration]);

    if (isLoading) return <Skeleton className="h-full w-full rounded-lg" />;

    return (
        <Card className="relative overflow-hidden bg-white border-2 border-black shadow-sm group hover:shadow-lg transition-all duration-500">
            <CardHeader className="p-3 bg-primary/5 border-b border-black/10 relative z-20">
                <CardTitle className="text-xs font-black text-primary flex items-center gap-1.5 uppercase">
                    <ImageIcon className="h-3.5 w-3.5" /> বিদ্যালয় গ্যালারি
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 relative h-28 sm:h-32 overflow-hidden">
                {activeImages.length > 0 ? (
                    <div className="relative w-full h-full">
                        {activeImages.map((img, idx) => (
                            <div 
                                key={img.id}
                                className={cn(
                                    "absolute inset-0 transition-opacity duration-1000",
                                    idx === currentIdx ? "opacity-100 z-10" : "opacity-0 z-0"
                                )}
                            >
                                <Image 
                                    src={img.url} 
                                    alt={img.title} 
                                    fill 
                                    className="object-cover"
                                    data-ai-hint="school landscape"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-[2px] p-1 text-center">
                                    <p className="text-[10px] text-white font-black truncate">{img.title}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-muted-foreground italic">
                        <ImageIcon className="h-8 w-8 mb-1 opacity-20" />
                        <p className="text-[10px]">ছবি নেই</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const TeachersOnLeaveCard = () => {
    const db = useFirestore();
    const { user } = useAuth();
    const [onLeave, setOnLeave] = useState<{name: string, designation: string, type?: string}[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !user) return;
        
        const fetchLeaveInfo = async () => {
            setIsLoading(true);
            try {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const [attRecord, allStaff] = await Promise.all([
                    getStaffAttendanceByDate(db, todayStr),
                    getStaff(db)
                ]);

                if (attRecord) {
                    const leaveEntries = attRecord.attendance.filter(a => a.status === 'leave');
                    const leaveDetails = leaveEntries.map(l => {
                        const staff = allStaff.find(s => s.id === l.staffId);
                        return { 
                            name: staff?.nameBn || 'অজানা', 
                            designation: staff?.designation || '',
                            type: l.leaveType 
                        };
                    });
                    setOnLeave(leaveDetails);
                } else {
                    setOnLeave([]);
                }
            } catch (e) {
                console.error("Error fetching leave info:", e);
            }
            setIsLoading(false);
        };
        
        fetchLeaveInfo();
    }, [db, user]);

    return (
        <Card className="lg:col-span-1 shadow-md border-2 border-black bg-rose-50/30">
            <CardHeader className="bg-rose-100/50 rounded-t-lg pb-3">
                <CardTitle className="text-lg flex items-center gap-2 text-rose-800">
                    <UserMinus className="h-5 w-5" /> ছুটিতে থাকা শিক্ষক ও কর্মচারী
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
                {isLoading ? (
                    <Skeleton className="h-24 w-full rounded-md" />
                ) : onLeave.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-muted-foreground italic text-center">
                        <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2 opacity-20" />
                        <p className="text-xs">আজ সব শিক্ষক ও কর্মচারী উপস্থিত আছেন।</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {onLeave.map((person, idx) => (
                            <div key={idx} className="flex flex-col gap-0.5 p-2.5 bg-white rounded-lg border border-rose-100 shadow-sm">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                        <span className="font-bold text-rose-900 text-sm">{person.name}</span>
                                    </div>
                                    {person.type && (
                                        <Badge variant="outline" className="text-[9px] h-4 font-black bg-rose-50 text-rose-700 border-rose-200">
                                            {person.type}
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-[10px] font-bold text-muted-foreground pl-3.5 italic">
                                    {person.designation}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const NoticeBoard = () => {
    const db = useFirestore();
    const { user } = useAuth();
    const { toast } = useToast();
    const [notices, setNotices] = useState<Notice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const isAdmin = user?.role === 'admin';

    const [newNotice, setNewNotice] = useState({ title: '', content: '', priority: 'normal' as Notice['priority'] });

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

    const handleAiGenerate = async () => {
      if (!aiTopic.trim()) {
        toast({ variant: 'destructive', title: 'বিষয় লিখুন', description: 'AI দিয়ে ড্রাফট করতে একটি বিষয় লিখুন।' });
        return;
      }

      setIsAiLoading(true);
      try {
        const result = await generateNotice({ topic: aiTopic });
        setNewNotice(prev => ({
          ...prev,
          title: result.title,
          content: result.content
        }));
        toast({ title: 'AI ড্রাফট তৈরি হয়েছে', description: 'এখন আপনি এটি এডিট বা পাবলিশ করতে পারেন।' });
        setAiTopic('');
      } catch (error) {
        toast({ variant: 'destructive', title: 'AI ত্রুটি', description: 'দুঃখিত, এই মুহূর্তে ড্রাফট তৈরি করা সম্ভব হচ্ছে না।' });
      } finally {
        setIsAiLoading(false);
      }
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
                senderName: senderName
            });
            toast({ title: 'নোটিশ প্রকাশিত হয়েছে' });
            setIsAddOpen(false);
            setNewNotice({ title: '', content: '', priority: 'normal' });
            fetchNotices();
        } catch (e) {}
    };

    const handleDelete = async (id: string) => {
        if (!db) return;
        try {
            await deleteNotice(db, id);
            toast({ title: 'নোটিশ মুছে ফেলা হয়েছে' });
            fetchNotices();
        } catch (e) {}
    };

    return (
        <Card className="lg:col-span-1 shadow-md border-2 border-black">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-primary/5 rounded-t-lg">
                <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary animate-pulse" />
                    <CardTitle className="text-lg">নোটিশ বোর্ড</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                   <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={fetchNotices}>
                        <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                   </Button>
                    {isAdmin && (
                        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="h-8 bg-white"><Plus className="h-4 w-4" /></Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <FilePen className="h-5 w-5" /> নতুন নোটিশ তৈরি করুন
                                </DialogTitle>
                                </DialogHeader>
                                
                                <div className="space-y-6 py-4">
                                    <div className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl space-y-3">
                                    <div className="flex items-center gap-2 text-indigo-700 font-black text-sm uppercase tracking-wider">
                                        <Sparkles className="h-4 w-4 animate-bounce" /> AI দিয়ে ড্রাফট করুন (অ্যাডভান্সড)
                                    </div>
                                    <div className="flex gap-2">
                                        <Input 
                                        placeholder="বিষয় লিখুন (উদা: শীতকালীন ছুটি)" 
                                        value={aiTopic}
                                        onChange={e => setAiTopic(e.target.value)}
                                        className="bg-white border-indigo-200"
                                        />
                                        <Button 
                                        onClick={handleAiGenerate} 
                                        disabled={isAiLoading}
                                        className="bg-indigo-600 hover:bg-indigo-700 shrink-0"
                                        >
                                        {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    <p className="text-[10px] text-indigo-600 font-bold italic">*** শুধু টপিকটি লিখুন, AI আপনার হয়ে একটি সুন্দর নোটিশ লিখে দেবে।</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="font-bold">শিরোনাম / বিষয়</Label>
                                        <Input 
                                            placeholder="উদা: শীতকালীন ছুটি সংক্রান্ত"
                                            value={newNotice.title} 
                                            onChange={e => setNewNotice({...newNotice, title: e.target.value})} 
                                            className="font-bold"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold">ধরণ (Priority)</Label>
                                        <Select value={newNotice.priority} onValueChange={(v: any) => setNewNotice({...newNotice, priority: v})}>
                                            <SelectTrigger className="font-bold"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="normal">সাধারণ (Normal)</SelectItem>
                                                <SelectItem value="important">গুরুত্বপূর্ণ (Important)</SelectItem>
                                                <SelectItem value="urgent">জরুরি (Urgent)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="font-bold"> বিস্তারিত বিষয়বস্তু</Label>
                                        <Textarea 
                                            placeholder="নোটিশের বিস্তারিত লিখুন..."
                                            value={newNotice.content} 
                                            onChange={e => setNewNotice({...newNotice, content: e.target.value})} 
                                            className="min-h-[180px] font-medium leading-relaxed" 
                                        />
                                    </div>
                                </div>

                                <DialogFooter className="border-t pt-4">
                                    <DialogClose asChild><Button variant="ghost" className="font-bold">বাতিল</Button></DialogClose>
                                    <Button onClick={handleAddNotice} className="px-8 font-black shadow-lg">প্রকাশ করুন</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
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
                                
                                <div className="flex justify-between items-center text-[10px] text-muted-foreground font-semibold border-t border-dashed pt-2">
                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(notice.date, 'dd MMM p', { locale: bn })}</span>
                                    <span>{(notice.senderName === 'dlswf.roy@gmail.com' || notice.senderName === 'System Admin') ? 'প্রধান শিক্ষক' : notice.senderName}</span>
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
    const [proxies, setProxies] = useState<ProxyClass[]>([]);
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeHoliday, setActiveHoliday] = useState<Holiday | undefined>(undefined);

    useEffect(() => {
        if (!db || !user) return;
        setIsLoading(true);
        const fetchData = async () => {
            try {
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const [routineData, holidayInfo, proxyData] = await Promise.all([
                    getFullRoutine(db, selectedYear),
                    isHoliday(db, todayStr),
                    getProxyClasses(db, todayStr, selectedYear)
                ]);
                setFullRoutine(routineData || []);
                setActiveHoliday(holidayInfo);
                setProxies(proxyData || []);
            } catch (e) {
                console.error(e);
            }
            setIsLoading(false);
        };
        fetchData();
        setCurrentTime(new Date());
    }, [db, selectedYear, user]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const getCurrentPeriodInfo = () => {
        if (!currentTime) return { status: 'লোড হচ্ছে...', runningClasses: [], isSpecialStatus: false, nextClasses: [], nextStatus: '' };
        
        const now = currentTime;
        const currentDayName = dayMap[now.getDay()];
        let status = 'ক্লাস চলছে';
        let runningClasses: any[] = [];
        let isSpecialStatus = false;
        let nextClasses: any[] = [];
        let nextStatus = '';

        if (activeHoliday) {
            isSpecialStatus = true;
            return { status: `আজ ${activeHoliday.description}।`, runningClasses: [], isSpecialStatus, nextClasses: [], nextStatus: '' };
        }
        
        if (currentDayName === 'শুক্রবার' || currentDayName === 'শনিবার') {
            isSpecialStatus = true;
            return { status: 'আজ সাপ্তাহিক ছুটি।', runningClasses: [], isSpecialStatus, nextClasses: [], nextStatus: '' };
        }

        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        let periodIndex = -1;
        for(let i=0; i<periodTimes.length; i++) {
            const period = periodTimes[i];
            const startMinutes = period.start.h * 60 + period.start.m;
            const endMinutes = period.end.h * 60 + period.end.m;

            if(currentMinutes >= startMinutes && currentMinutes < endMinutes) {
                if (period.name === 'বিরতি') {
                    status = 'এখন টিফিনের বিরতি চলছে।';
                } else {
                    if (i < 3) periodIndex = i; 
                    if (i > 3) periodIndex = i - 1;
                }
                break;
            }
        }
        
        if (periodIndex !== -1) {
            runningClasses = fullRoutine
                .filter(r => r.day === currentDayName)
                .map(r => {
                    const periodContent = r.periods[periodIndex];
                    if (periodContent) {
                        const adjustedPeriodIndex = periodIndex + (periodIndex >= 3 ? 1 : 0);
                        const periodInfo = periodTimes[adjustedPeriodIndex];
                        const proxy = proxies.find(p => p.className === r.className && p.periodIndex === periodIndex);
                        return {
                            className: r.className,
                            displayClassName: classNamesMap[r.className] || r.className,
                            teacher: proxy ? proxy.proxyTeacher : parseTeacherName(periodContent),
                            isProxy: !!proxy,
                            period: periodInfo.name,
                            time: `${periodInfo.start.h.toString().padStart(2, '0')}:${periodInfo.start.m.toString().padStart(2, '0')} - ${periodInfo.end.h.toString().padStart(2, '0')}:${periodInfo.end.m.toString().padStart(2, '0')}`
                        };
                    }
                    return null;
                })
                .filter((c): c is NonNullable<typeof c> => c !== null)
                .sort((a, b) => parseInt(a.className) - parseInt(b.className));
            
            if (runningClasses.length === 0) status = 'এখন কোনো ক্লাস চলছে না।';
        } else if (status === 'ক্লাস চলছে') {
             status = 'এখন কোনো ক্লাস চলছে না।';
        }

        let nextRawPeriodIndex = -1;
        for(let i=0; i<periodTimes.length; i++) {
            const period = periodTimes[i];
            const startMinutes = period.start.h * 60 + period.start.m;
            if (startMinutes > currentMinutes) {
                nextRawPeriodIndex = i;
                break;
            }
        }

        if (nextRawPeriodIndex !== -1) {
            const nextPeriodInfo = periodTimes[nextRawPeriodIndex];
            if (nextPeriodInfo.name === 'বিরতি') {
                nextStatus = `পরবর্তী: টিফিনের বিরতি (${nextPeriodInfo.start.h > 12 ? nextPeriodInfo.start.h - 12 : nextPeriodInfo.start.h}:${nextPeriodInfo.start.m.toString().padStart(2, '0')})`;
            } else {
                let nextPeriodIndexCalc = -1;
                if (nextRawPeriodIndex < 3) nextPeriodIndexCalc = nextRawPeriodIndex;
                if (nextRawPeriodIndex > 3) nextPeriodIndexCalc = nextRawPeriodIndex - 1;

                if (nextPeriodIndexCalc !== -1) {
                    nextClasses = fullRoutine
                        .filter(r => r.day === currentDayName)
                        .map(r => {
                            const periodContent = r.periods[nextPeriodIndexCalc];
                            if (periodContent) {
                                const proxy = proxies.find(p => p.className === r.className && p.periodIndex === nextPeriodIndexCalc);
                                return {
                                    className: r.className,
                                    displayClassName: classNamesMap[r.className] || r.className,
                                    teacher: proxy ? proxy.proxyTeacher : parseTeacherName(periodContent),
                                    isProxy: !!proxy,
                                    period: nextPeriodInfo.name,
                                    time: `${nextPeriodInfo.start.h > 12 ? nextPeriodInfo.start.h - 12 : nextPeriodInfo.start.h}:${nextPeriodInfo.start.m.toString().padStart(2, '0')} - ${nextPeriodInfo.end.h > 12 ? nextPeriodInfo.end.h - 12 : nextPeriodInfo.end.h}:${nextPeriodInfo.end.m.toString().padStart(2, '0')}`
                                };
                            }
                            return null;
                        })
                        .filter((c): c is NonNullable<typeof c> => c !== null)
                        .sort((a, b) => parseInt(a.className) - parseInt(b.className));
                }
                
                nextStatus = `পরবর্তী ক্লাস শুরু হবে ${nextPeriodInfo.start.h > 12 ? nextPeriodInfo.start.h - 12 : nextPeriodInfo.start.h}:${nextPeriodInfo.start.m.toString().padStart(2, '0')} 에`;
            }
        } else {
             nextStatus = 'আজ আর কোনো ক্লাস বাকি নেই।';
        }

        return { status, runningClasses, isSpecialStatus, nextClasses, nextStatus };
    };

    const periodInfo = getCurrentPeriodInfo();

    return (
        <Card className="lg:col-span-2 shadow-md border-2 border-black">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex flex-col gap-1">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" /> লাইভ ক্লাস রুটিন
                    </CardTitle>
                    <div className="text-[10px] font-bold text-muted-foreground pl-6">
                        {currentTime ? format(currentTime, 'EEEE, d MMMM yyyy', { locale: bn }) : <Skeleton className="h-3 w-32" />}
                    </div>
                </div>
                 <Badge variant="outline" className="flex items-center gap-2 bg-white shadow-sm">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    {currentTime ? currentTime.toLocaleTimeString('bn-BD', { hour: 'numeric', minute: 'numeric' }) : <Skeleton className="h-4 w-12" />}
                </Badge>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-2 pt-4">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-6 w-full" />
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div>
                            {periodInfo.runningClasses && periodInfo.runningClasses.length > 0 ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 mb-2 text-emerald-600 font-semibold text-sm">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                        </span>
                                        এখন ক্লাস চলছে
                                    </div>
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead>সময়</TableHead>
                                                <TableHead>শিক্ষক</TableHead>
                                                <TableHead>শ্রেণি</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {periodInfo.runningClasses.map((rc, index) => (
                                                <TableRow key={index}>
                                                    <TableCell className="text-xs font-medium">{rc.time}</TableCell>
                                                    <TableCell className="font-semibold text-primary">
                                                        {rc.teacher} 
                                                        {rc.isProxy && <span className="ml-1 text-[10px] text-red-600 font-black animate-pulse">(বদলি)</span>}
                                                    </TableCell>
                                                    <TableCell>{rc.displayClassName}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-20 text-center bg-muted/20 rounded-md border border-dashed">
                                    <p className={cn(
                                        "text-muted-foreground transition-all duration-500",
                                        periodInfo.isSpecialStatus ? "text-red-600 font-bold" : "text-sm"
                                    )}>
                                        {periodInfo.status}
                                    </p>
                                </div>
                            )}
                        </div>

                        {!periodInfo.isSpecialStatus && (
                            <div>
                                {periodInfo.nextClasses && periodInfo.nextClasses.length > 0 ? (
                                    <div className="space-y-2">
                                        <div className="text-indigo-600 font-semibold text-sm mb-2 border-t pt-4">
                                            {periodInfo.nextStatus}
                                        </div>
                                        <Table>
                                            <TableHeader className="bg-indigo-50/50">
                                                <TableRow>
                                                    <TableHead>সময়</TableHead>
                                                    <TableHead>শিক্ষক</TableHead>
                                                    <TableHead>শ্রেণি</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {periodInfo.nextClasses.map((nc, index) => (
                                                    <TableRow key={index}>
                                                        <TableCell className="text-xs text-muted-foreground">{nc.time}</TableCell>
                                                        <TableCell className="font-medium text-indigo-900">
                                                            {nc.teacher}
                                                            {nc.isProxy && <span className="ml-1 text-[10px] text-red-600 font-black">(বদলি)</span>}
                                                        </TableCell>
                                                        <TableCell className="text-muted-foreground">{nc.displayClassName}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                ) : (
                                    <div className="text-center text-xs text-muted-foreground border-t pt-4">
                                        {periodInfo.nextStatus}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const IncomeExpenseChart = () => {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db) return;
        setLoading(true);
        getTransactions(db, selectedYear).then(data => {
            setTransactions(data);
            setLoading(false);
        });
    }, [db, selectedYear]);

    const chartData = useMemo(() => {
        let income = 0;
        let expense = 0;
        transactions.forEach(t => {
            if (t.type === 'income') income += t.amount;
            else expense += t.amount;
        });
        return [
            { name: 'আয়', value: income, color: '#10b981' },
            { name: 'ব্যয়', value: expense, color: '#ef4444' }
        ];
    }, [transactions]);

    if (loading) return <Skeleton className="h-64 w-full rounded-lg" />;

    return (
        <Card className="shadow-md border-2 border-black">
            <CardHeader className="bg-primary/5 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                    <PieChartIcon className="h-5 w-5 text-primary" /> আয়-ব্যয় চিত্র
                </CardTitle>
            </CardHeader>
            <CardContent className="h-64 pt-6">
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
                        <RechartsTooltip 
                            formatter={(value: number) => [`${value.toLocaleString('bn-BD')} ৳`, 'পরিমাণ']}
                        />
                        <Legend verticalAlign="bottom" align="center" />
                    </PieChart>
                </ResponsiveContainer>
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
      (error: FirestoreError) => {
        if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'students',
                operation: 'list',
            }));
        }
      });

      const staffQuery = query(collection(db, 'staff'), where('isActive', '==', true), where('staffType', '==', 'teacher'));
      const unsubscribeStaff = onSnapshot(staffQuery, (querySnapshot) => {
        setTotalTeachers(querySnapshot.size);
      },
      (error: FirestoreError) => {
        if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'staff',
                operation: 'list',
            }));
        }
      });

      return () => {
        unsubscribeStudents();
        unsubscribeStaff();
      };

  }, [selectedYear, db, user]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-sky-100 font-kalpurush">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="font-bold">লোড হচ্ছে...</p>
      </div>
    );
  }

  const presentPercentage = totalStudents > 0 ? ((totalPresent / totalStudents) * 100).toFixed(1) : "০";
  const absentPercentage = totalStudents > 0 ? ((totalAbsent / totalStudents) * 100).toFixed(1) : "০";

  return (
    <div className="flex min-h-screen w-full flex-col bg-sky-100 font-kalpurush">
      <Header />
      <NoticeTicker />
      <main className="p-4 md:p-8 pb-[600px]">
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-5 mb-8">
          {/* Gallery Card */}
          <GalleryCard />

          {/* Total Students Card */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-black shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
               <Users className="h-28 w-28 text-indigo-900" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-bold text-indigo-900">
                মোট শিক্ষার্থী
              </CardTitle>
              <div className="p-2 bg-white/60 rounded-full backdrop-blur-sm shadow-sm group-hover:bg-white transition-colors">
                <Users className="h-4 w-4 text-indigo-700" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-black text-indigo-950 mb-1">{totalStudents.toLocaleString('bn-BD')}</div>
              <p className="text-xs text-indigo-700 font-medium">
                শিক্ষাবর্ষ {selectedYear.toLocaleString('bn-BD')}
              </p>
            </CardContent>
          </Card>
          
          {/* Total Present Card */}
           <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-100 border-2 border-black shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
               <CheckCircle2 className="h-28 w-28 text-teal-900" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-bold text-teal-900">
                মোট উপস্থিত
              </CardTitle>
              <div className="p-2 bg-white/60 rounded-full backdrop-blur-sm shadow-sm group-hover:bg-white transition-colors">
                <Users className="h-4 w-4 text-teal-700" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black text-teal-950 mb-1">{totalPresent.toLocaleString('bn-BD')}</div>
                <div className="text-sm font-bold text-emerald-700 bg-white/80 px-2 py-0.5 rounded-full border border-emerald-100">
                  {toBengaliNumber(presentPercentage)}%
                </div>
              </div>
              <p className="text-xs text-teal-700 font-medium">
                আজকের মোট উপস্থিত শিক্ষার্থী
              </p>
            </CardContent>
          </Card>

          {/* Total Absent Card */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-rose-50 to-red-100 border-2 border-black shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
               <XCircle className="h-28 w-28 text-red-900" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-bold text-red-900">
                মোট অনুপস্থিত
              </CardTitle>
              <div className="p-2 bg-white/60 rounded-full backdrop-blur-sm shadow-sm group-hover:bg-white transition-colors">
                <Users className="h-4 w-4 text-red-700" />
              </div>
            </CardHeader>            <CardContent className="relative z-10">
              <div className="flex items-baseline gap-2">
                <div className="text-3xl font-black text-red-950 mb-1">{totalAbsent.toLocaleString('bn-BD')}</div>
                <div className="text-sm font-bold text-rose-700 bg-white/80 px-2 py-0.5 rounded-full border border-rose-100">
                  {toBengaliNumber(absentPercentage)}%
                </div>
              </div>
              <p className="text-xs text-red-700 font-medium">
                আজকের মোট অনুপস্থিত শিক্ষার্থী
              </p>
            </CardContent>
          </Card>

          {/* Total Teachers Card */}
          <Card className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100 border-2 border-black shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group">
             <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
               <GraduationCap className="h-28 w-28 text-orange-900" />
            </div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-bold text-orange-900">
                মোট শিক্ষক
              </CardTitle>
              <div className="p-2 bg-white/60 rounded-full backdrop-blur-sm shadow-sm group-hover:bg-white transition-colors">
                <GraduationCap className="h-4 w-4 text-orange-700" />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-black text-orange-950 mb-1">{totalTeachers.toLocaleString('bn-BD')}</div>
              <p className="text-xs text-orange-700 font-medium">
                সিস্টেমে নিবন্ধিত সক্রিয় শিক্ষক
              </p>
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
          <Card className="lg:col-span-1 shadow-md border-2 border-black">
            <CardHeader className="bg-primary/5 rounded-t-lg">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Info className="h-5 w-5 text-primary" /> আজকের হাজিরা
                </CardTitle>
                <CardDescription>
                    {attendanceTaken ? 'শ্রেণিভিত্তিক আজকের উপস্থিতির সারসংক্ষেপ' : 'আজ এখনো কোনো শ্রেণির হাজিরা নেওয়া হয়নি।'}
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
          <IncomeExpenseChart />
          <NoticeBoard />
          <TeachersOnLeaveCard />
        </div>
      </main>
    </div>
  );
}

function toBengaliNumber(str: string | number) {
  if (!str && str !== 0) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
}
