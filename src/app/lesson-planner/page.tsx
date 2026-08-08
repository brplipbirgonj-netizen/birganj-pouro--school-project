'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { 
    BookOpen, CheckCircle2, LayoutGrid, ListTodo, Plus, Save, 
    TrendingUp, Loader2, Calendar, User, ChevronRight, BarChart3, Info,
    AlertCircle, FileText, Printer, Check, ListChecks, FilePen, Book
} from 'lucide-react';
import { LessonPlan, saveLessonPlan, getLessonPlansForTeacher, getAllLessonPlans } from '@/lib/lesson-plan-data';
import { getSyllabus, saveSyllabus, Syllabus } from '@/lib/syllabus-data';
import { getChapters } from '@/lib/subject-chapters';
import { getSubjects } from '@/lib/subjects';
import { getExams, Exam } from '@/lib/exam-data';
import { format, startOfWeek, endOfWeek, addWeeks, getWeek } from 'date-fns';
import { bn } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import Image from 'next/image';
import { collection, query, where, getDocs } from 'firebase/firestore';

const classNamesMap: Record<string, string> = {
    '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': 'দশম'
};

const toBengaliNumber = (str: string | number) => {
    if (!str && str !== 0) return '';
    const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => digits[parseInt(w, 10)]);
};

// --- Syllabus Module Components ---

const SyllabusManagementTab = () => {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const { user, hasPermission } = useAuth();
    const { schoolInfo } = useSchoolInfo();
    const { toast } = useToast();

    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedExam, setSelectedExam] = useState('');
    const [className, setClassName] = useState('');
    const [subject, setSubject] = useState('');
    const [availableChapters, setAvailableChapters] = useState<string[]>([]);
    const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
    const [chapterComments, setChapterComments] = useState<Record<string, string>>({});
    const [existingSyllabus, setExistingSyllabus] = useState<Syllabus | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    const isAdmin = user?.role === 'admin';
    const canManageSyllabus = hasPermission('manage:lesson-plans');

    useEffect(() => {
        if (db && selectedYear) {
            getExams(db, selectedYear).then(setExams);
        }
    }, [db, selectedYear]);

    useEffect(() => {
        if (className && subject) {
            const chapters = getChapters(className, subject);
            setAvailableChapters(chapters);
        } else {
            setAvailableChapters([]);
        }
    }, [className, subject]);

    const handleLoadSyllabus = useCallback(async () => {
        if (!db || !selectedExam || !className || !subject) return;
        setIsLoading(true);
        try {
            const data = await getSyllabus(db, selectedYear, selectedExam, className, subject);
            if (data) {
                setExistingSyllabus(data);
                setSelectedChapters(new Set(data.chapters));
                setChapterComments(data.chapterComments || {});
                setIsEditMode(false);
            } else {
                setExistingSyllabus(null);
                setSelectedChapters(new Set());
                setChapterComments({});
                setIsEditMode(true);
            }
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    }, [db, selectedYear, selectedExam, className, subject]);

    useEffect(() => {
        if (selectedExam && className && subject) {
            handleLoadSyllabus();
        }
    }, [handleLoadSyllabus, selectedExam, className, subject]);

    const handleSave = async () => {
        if (!db || !selectedExam || !className || !subject) return;
        if (selectedChapters.size === 0) {
            toast({ variant: 'destructive', title: 'অধ্যায় নির্বাচন করুন', description: 'অন্তত একটি অধ্যায় টিক দিয়ে সিলেক্ট করুন।' });
            return;
        }

        setIsLoading(true);
        try {
            await saveSyllabus(db, {
                academicYear: selectedYear,
                examName: selectedExam,
                className,
                subjectName: subject,
                chapters: Array.from(selectedChapters),
                chapterComments: chapterComments
            });
            toast({ title: 'সিলেবাস সংরক্ষিত হয়েছে' });
            setIsEditMode(false);
            handleLoadSyllabus();
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleChapter = (chapter: string) => {
        const next = new Set(selectedChapters);
        if (next.has(chapter)) {
            next.delete(chapter);
            // Also clean up comment if unselected
            const nextComments = { ...chapterComments };
            delete nextComments[chapter];
            setChapterComments(nextComments);
        } else {
            next.add(chapter);
        }
        setSelectedChapters(next);
    };

    const handleCommentChange = (chapter: string, comment: string) => {
        setChapterComments(prev => ({
            ...prev,
            [chapter]: comment
        }));
    };

    const availableSubjects = useMemo(() => {
        if (!className) return [];
        const base = getSubjects(className);
        // Split religion into Islam and Hindu for syllabus only
        return base.flatMap(s => {
            if (s.name === 'ধর্ম ও নৈতিক শিক্ষা') {
                return [
                    { ...s, name: 'ইসলাম ধর্ম ও নৈতিক শিক্ষা', englishName: 'Islam Religion & Moral Education' },
                    { ...s, name: 'হিন্দু ধর্ম ও নৈতিক শিক্ষা', englishName: 'Hindu Religion & Moral Education' }
                ];
            }
            return s;
        });
    }, [className]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Filter Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border-2 border-primary/10 rounded-2xl bg-white shadow-sm no-print">
                <div className="space-y-2">
                    <Label className="font-bold text-primary">পরীক্ষা নির্বাচন</Label>
                    <Select value={selectedExam} onValueChange={setSelectedExam}>
                        <SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue placeholder="পরীক্ষা" /></SelectTrigger>
                        <SelectContent>
                            {exams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="font-bold text-primary">শ্রেণি</Label>
                    <Select value={className} onValueChange={(v) => { setClassName(v); setSubject(''); }}>
                        <SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger>
                        <SelectContent>
                            {Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="font-bold text-primary">বিষয়</Label>
                    <Select value={subject} onValueChange={setSubject} disabled={!className}>
                        <SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue placeholder="বিষয় নির্বাচন" /></SelectTrigger>
                        <SelectContent>
                            {availableSubjects.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="font-bold text-muted-foreground">সিলেবাস লোড হচ্ছে...</p>
                </div>
            ) : selectedExam && className && subject ? (
                <div className="space-y-6">
                    {!isEditMode && existingSyllabus ? (
                        <div className="animate-in zoom-in-95 duration-500">
                            <Card className="border-[4px] border-black rounded-3xl bg-white shadow-[12px_12px_0px_rgba(0,0,0,0.1)] overflow-hidden">
                                <CardHeader className="bg-primary/5 border-b-[3px] border-black flex flex-row justify-between items-center no-print">
                                    <div className="space-y-1">
                                        <CardTitle className="text-2xl font-black text-primary flex items-center gap-2">
                                            <FileText className="h-7 w-7" /> সিলেবাস প্রিভিউ
                                        </CardTitle>
                                        <CardDescription className="font-bold">পরীক্ষা: {selectedExam} | শ্রেণি: {classNamesMap[className]} | বিষয়: {subject}</CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" className="font-black border-2 border-primary text-primary hover:bg-primary/5" onClick={() => window.print()}>
                                            <Printer className="mr-2 h-4 w-4" /> প্রিন্ট করুন
                                        </Button>
                                        {canManageSyllabus && (
                                            <Button className="font-black shadow-lg" onClick={() => setIsEditMode(true)}>
                                                <FilePen className="mr-2 h-4 w-4" /> এডিট করুন
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="p-10 bg-white">
                                    <div className="printable-area p-8 border-[2px] border-slate-200 rounded-2xl bg-white text-black font-kalpurush">
                                        <header className="text-center border-b-4 border-emerald-800 pb-4 mb-8">
                                            <h1 className="text-4xl font-black text-emerald-950 leading-none mb-1">{schoolInfo.name}</h1>
                                            <p className="text-lg font-bold text-slate-700">{schoolInfo.address}</p>
                                            <div className="mt-4 inline-block bg-emerald-50 px-8 py-1 rounded-full border-2 border-emerald-800">
                                                <h2 className="text-2xl font-black uppercase tracking-widest">{selectedExam} - সিলেবাস</h2>
                                            </div>
                                        </header>

                                        <div className="grid grid-cols-2 gap-4 mb-8 text-xl font-bold border-b-2 border-dashed border-slate-200 pb-4">
                                            <p>শ্রেণি: <span className="font-black text-emerald-800">{classNamesMap[className]} শ্রেণি</span></p>
                                            <p className="text-right">বিষয়: <span className="font-black text-emerald-800">{subject}</span></p>
                                        </div>

                                        <div className="space-y-6">
                                            <h3 className="text-2xl font-black text-slate-800 border-l-8 border-emerald-600 pl-4 mb-6">পরীক্ষায় অন্তর্ভুক্ত অধ্যায়সমূহ:</h3>
                                            <div className="grid grid-cols-1 gap-6">
                                                {existingSyllabus.chapters.map((chapter, idx) => (
                                                    <div key={idx} className="flex flex-col p-4 border-2 border-slate-100 rounded-2xl bg-slate-50/50 shadow-sm">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-black shrink-0">
                                                                {toBengaliNumber(idx + 1)}
                                                            </div>
                                                            <span className="text-xl font-black text-slate-800">{chapter}</span>
                                                        </div>
                                                        {existingSyllabus.chapterComments?.[chapter] && (
                                                            <p className="mt-2 ml-12 text-sm font-bold text-slate-600 italic border-l-4 border-emerald-200 pl-3">
                                                                {existingSyllabus.chapterComments[chapter]}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <footer className="mt-20 flex justify-between px-10 no-screen">
                                            <div className="text-center w-56 border-t-2 border-black pt-1 font-black text-lg">বিষয় শিক্ষক</div>
                                            <div className="text-center w-56 border-t-2 border-black pt-1 font-black text-lg">প্রধান শিক্ষক</div>
                                        </footer>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <Card className="border-[4px] border-black rounded-3xl bg-white shadow-[12px_12px_0px_rgba(0,0,0,0.1)] overflow-hidden animate-in fade-in duration-500">
                            <CardHeader className="bg-amber-50 border-b-[3px] border-black flex flex-row justify-between items-center">
                                <div>
                                    <CardTitle className="text-2xl font-black text-amber-900 flex items-center gap-2">
                                        <ListChecks className="h-7 w-7" /> সিলেবাস সেট করুন
                                    </CardTitle>
                                    <CardDescription className="font-bold text-amber-800">পরীক্ষার জন্য অধ্যায় নির্বাচন ও মন্তব্য লিখুন</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge className="bg-amber-600 text-white font-black h-10 px-6 text-base shadow-md">
                                        নির্বাচিত: {toBengaliNumber(selectedChapters.size)} টি
                                    </Badge>
                                    {existingSyllabus && (
                                        <Button variant="ghost" onClick={() => setIsEditMode(false)} className="text-amber-800 font-bold">বাতিল</Button>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-8 space-y-8">
                                {availableChapters.length === 0 ? (
                                    <div className="p-16 border-2 border-dashed border-amber-200 rounded-2xl flex flex-col items-center justify-center text-center bg-amber-50/20">
                                        <AlertCircle className="h-12 w-12 text-amber-500 mb-4 opacity-40" />
                                        <h4 className="text-xl font-black text-amber-900">অধ্যায় তালিকা পাওয়া যায়নি</h4>
                                        <p className="font-bold text-amber-700 max-w-sm">দুঃখিত, এই বিষয়ের জন্য অধ্যায় তালিকা এখনো সিস্টেমে যুক্ত করা হয়নি।</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {availableChapters.map((chapter) => (
                                            <div 
                                                key={chapter} 
                                                className={cn(
                                                    "group flex flex-col p-4 border-2 rounded-2xl transition-all",
                                                    selectedChapters.has(chapter) 
                                                        ? "bg-primary/5 border-primary shadow-sm" 
                                                        : "bg-white border-slate-100 hover:border-primary/20"
                                                )}
                                            >
                                                <div className="flex items-center gap-4 cursor-pointer mb-3" onClick={() => toggleChapter(chapter)}>
                                                    <div className={cn(
                                                        "h-7 w-7 rounded-lg border-2 flex items-center justify-center transition-colors shrink-0",
                                                        selectedChapters.has(chapter) ? "bg-primary border-primary text-white" : "border-slate-300 bg-white"
                                                    )}>
                                                        {selectedChapters.has(chapter) && <Check className="h-5 w-5 stroke-[4px]" />}
                                                    </div>
                                                    <span className="font-black text-lg text-slate-800">{chapter}</span>
                                                </div>
                                                
                                                {selectedChapters.has(chapter) && (
                                                    <div className="animate-in slide-in-from-top-1 duration-300">
                                                        <Label className="text-[10px] font-black text-primary uppercase mb-1 block">অধ্যায় ভিত্তিক বিশেষ মন্তব্য</Label>
                                                        <Input 
                                                            placeholder="উদা: সম্পূর্ণ গদ্য অংশ পড়বে..." 
                                                            value={chapterComments[chapter] || ''} 
                                                            onChange={(e) => handleCommentChange(chapter, e.target.value)}
                                                            className="h-9 text-xs font-bold border-primary/20 bg-white"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                            <CardFooter className="p-8 bg-slate-50 border-t-[3px] border-black flex justify-end">
                                <Button 
                                    onClick={handleSave} 
                                    disabled={isLoading || availableChapters.length === 0}
                                    className="h-16 px-16 text-xl font-black shadow-2xl shadow-primary/30"
                                >
                                    {isLoading ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <Save className="mr-2 h-6 w-6" />}
                                    সিলেবাস সেভ করুন
                                </Button>
                            </CardFooter>
                        </Card>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/10 rounded-3xl border-4 border-dashed opacity-40">
                    <ListTodo className="h-20 w-20 mb-4" />
                    <p className="text-xl font-black">উপরে তথ্য সিলেক্ট করুন</p>
                    <p className="font-bold">পরীক্ষা, শ্রেণি ও বিষয় নির্বাচন করলে সিলেবাস দেখা যাবে।</p>
                </div>
            )}
        </div>
    );
};

export default function LessonPlannerPage() {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const { user, hasPermission } = useAuth();
    const { toast } = useToast();

    const [isClient, setIsClient] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('input');
    
    const [myPlans, setMyPlans] = useState<LessonPlan[]>([]);
    const [allPlans, setAllPlans] = useState<LessonPlan[]>([]);
    
    // Form States
    const [className, setClassName] = useState('');
    const [subject, setSubject] = useState('');
    const [topic, setTopic] = useState('');
    const [objectives, setObjectives] = useState('');
    const [progress, setProgress] = useState(0);
    const [selectedWeek, setSelectedWeek] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-W${String(getWeek(now)).padStart(2, '0')}`;
    });

    // Syllabus Linked States
    const [syllabusChapters, setSyllabusChapters] = useState<string[]>([]);
    const [isSyllabusLoading, setIsSyllabusLoading] = useState(false);

    const isAdmin = user?.role === 'admin';
    const canManagePlans = hasPermission('manage:lesson-plans');
    const canViewTracker = hasPermission('view:syllabus-tracker');

    const availableSubjects = useMemo(() => {
        if (!className) return [];
        return getSubjects(className);
    }, [className]);

    const fetchData = useCallback(async () => {
        if (!db || !user) return;
        setIsLoading(true);
        try {
            const [myRes, allRes] = await Promise.all([
                getLessonPlansForTeacher(db, user.uid, selectedYear),
                isAdmin ? getAllLessonPlans(db, selectedYear) : Promise.resolve([])
            ]);
            setMyPlans(myRes);
            setAllPlans(allRes);
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    }, [db, user, selectedYear, isAdmin]);

    useEffect(() => {
        setIsClient(true);
        fetchData();
    }, [fetchData]);

    // Fetch Syllabus Chapters when class/subject changes
    useEffect(() => {
        if (!db || !className || !subject) {
            setSyllabusChapters([]);
            return;
        }

        const fetchSyllabusForPlanning = async () => {
            setIsSyllabusLoading(true);
            try {
                // Fetch syllabi for all exams for this class/subject in this year
                const q = query(
                    collection(db, 'syllabi'),
                    where('academicYear', '==', selectedYear),
                    where('className', '==', className),
                    where('subjectName', '==', subject)
                );
                const snap = await getDocs(q);
                const uniqueChapters = new Set<string>();
                snap.docs.forEach(doc => {
                    const data = doc.data() as Syllabus;
                    data.chapters.forEach(ch => uniqueChapters.add(ch));
                });
                setSyllabusChapters(Array.from(uniqueChapters).sort());
            } catch (e) {
                console.error("Syllabus fetch error:", e);
            } finally {
                setIsSyllabusLoading(false);
            }
        };

        fetchSyllabusForPlanning();
    }, [db, className, subject, selectedYear]);

    const handleSave = async () => {
        if (!db || !user || !className || !subject || !topic) {
            toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ', description: 'শ্রেণি, বিষয় ও টপিক অবশ্যই দিতে হবে।' });
            return;
        }

        setIsLoading(true);
        try {
            await saveLessonPlan(db, {
                teacherUid: user.uid,
                teacherName: user.displayName || user.email || 'শিক্ষক',
                className,
                subject,
                academicYear: selectedYear,
                week: selectedWeek,
                topic,
                objectives,
                progress
            });
            toast({ title: 'লেসন প্ল্যান ও প্রগ্রেস সেভ হয়েছে' });
            fetchData();
            // Reset some form fields
            setTopic('');
            setObjectives('');
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const syllabusTrackerData = useMemo(() => {
        const tracker: Record<string, Record<string, LessonPlan>> = {};
        // Find the latest progress for each subject in each class
        allPlans.forEach(plan => {
            if (!tracker[plan.className]) tracker[plan.className] = {};
            const existing = tracker[plan.className][plan.subject];
            if (!existing || plan.updatedAt > existing.updatedAt) {
                tracker[plan.className][plan.subject] = plan;
            }
        });
        return tracker;
    }, [allPlans]);

    if (!isClient) return null;

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#F6F7F9] font-kalpurush">
            <Header />
            <main className="flex-1 flex flex-col md:flex-row h-full max-w-[1600px] mx-auto w-full md:p-6 lg:p-10 gap-8 pb-40">
                
                <aside className="w-full md:w-64 shrink-0 space-y-1 no-print bg-white md:bg-transparent p-4 md:p-0 border-b md:border-0 sticky top-20 md:top-28 self-start">
                    <h2 className="text-2xl font-black mb-6 px-4 hidden md:block text-slate-900 tracking-tight">লেসন প্ল্যান ও সিলেবাস</h2>
                    <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-1 scrollbar-none">
                        <button
                            onClick={() => setActiveTab('input')}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold whitespace-nowrap min-w-fit",
                                activeTab === 'input' ? "bg-white shadow-md text-primary scale-105" : "text-muted-foreground hover:bg-slate-200/50"
                            )}
                        >
                            <div className={cn("p-1.5 rounded-lg shrink-0", activeTab === 'input' ? "bg-primary/10 text-primary" : "bg-muted")}>
                                <ListTodo className="h-4 w-4" />
                            </div>
                            <span className="text-sm">আমার লেসন প্ল্যান</span>
                        </button>
                        <button
                            onClick={() => setActiveTab('syllabus')}
                            className={cn(
                                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold whitespace-nowrap min-w-fit",
                                activeTab === 'syllabus' ? "bg-white shadow-md text-blue-600 scale-105" : "text-muted-foreground hover:bg-slate-200/50"
                            )}
                        >
                            <div className={cn("p-1.5 rounded-lg shrink-0", activeTab === 'syllabus' ? "bg-blue-50 text-blue-600" : "bg-muted")}>
                                <FileText className="h-4 w-4" />
                            </div>
                            <span className="text-sm">সিলেবাস ব্যবস্থাপনা</span>
                        </button>
                        {(isAdmin || canViewTracker) && (
                            <button
                                onClick={() => setActiveTab('tracker')}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold whitespace-nowrap min-w-fit",
                                    activeTab === 'tracker' ? "bg-white shadow-md text-emerald-600 scale-105" : "text-muted-foreground hover:bg-slate-200/50"
                                )}
                            >
                                <div className={cn("p-1.5 rounded-lg shrink-0", activeTab === 'tracker' ? "bg-emerald-50 text-emerald-600" : "bg-muted")}>
                                    <TrendingUp className="h-4 w-4" />
                                </div>
                                <span className="text-sm">সিলেবাস ট্র্যাকার</span>
                            </button>
                        )}
                    </div>
                </aside>

                <div className="flex-1 min-w-0 bg-white md:rounded-[32px] shadow-2xl md:border-[1px] border-slate-200/50 overflow-hidden min-h-[700px] flex flex-col transition-all duration-500 animate-in fade-in slide-in-from-right-4">
                    <div className="p-4 sm:p-6 lg:p-8 flex-1">
                        
                        {activeTab === 'input' && (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                <Card className="border-2 border-primary/10 shadow-lg">
                                    <CardHeader className="bg-primary/5 border-b pb-6">
                                        <CardTitle className="text-xl flex items-center gap-2">
                                            <BookOpen className="h-5 w-5 text-primary" /> সাপ্তাহিক প্ল্যান ও প্রগ্রেস আপডেট
                                        </CardTitle>
                                        <CardDescription className="font-bold">আপনার বিষয়ের অগ্রগতির চিত্র তুলে ধরুন</CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-6 space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            <div className="space-y-2">
                                                <Label className="font-bold">শ্রেণি নির্বাচন</Label>
                                                <Select value={className} onValueChange={(v) => { setClassName(v); setSubject(''); setTopic(''); }}>
                                                    <SelectTrigger className="bg-white"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                                                    <SelectContent>
                                                        {Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="font-bold">বিষয় নির্বাচন</Label>
                                                <Select value={subject} onValueChange={(v) => { setSubject(v); setTopic(''); }} disabled={!className}>
                                                    <SelectTrigger className="bg-white"><SelectValue placeholder="বিষয় সিলেক্ট করুন" /></SelectTrigger>
                                                    <SelectContent>
                                                        {availableSubjects.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="font-bold">সপ্তাহ (Week)</Label>
                                                <Input type="week" value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} className="h-10" />
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-4 border-t border-dashed">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <Label className="font-bold">এই সপ্তাহের প্রধান টপিক / অধ্যায়</Label>
                                                    {isSyllabusLoading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                                                </div>
                                                
                                                {syllabusChapters.length > 0 ? (
                                                    <Select value={topic} onValueChange={setTopic}>
                                                        <SelectTrigger className="bg-white border-2 font-bold h-11 border-primary/20">
                                                            <SelectValue placeholder="সিলেবাস থেকে অধ্যায় নির্বাচন করুন" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {syllabusChapters.map(ch => (
                                                                <SelectItem key={ch} value={ch} className="font-bold">{ch}</SelectItem>
                                                            ))}
                                                            <SelectItem value="manual-input" className="text-primary italic">ম্যানুয়ালি টপিক লিখতে চাই...</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                ) : (
                                                    <div className="relative">
                                                        <Input 
                                                            placeholder="উদা: পাটিগণিত - অধ্যায় ৩" 
                                                            value={topic} 
                                                            onChange={e => setTopic(e.target.value)} 
                                                            className="font-bold h-11"
                                                        />
                                                        {className && subject && !isSyllabusLoading && (
                                                            <p className="text-[10px] text-amber-600 mt-1 font-bold flex items-center gap-1">
                                                                <AlertCircle className="h-3 w-3" /> সিলেবাসে কোনো অধ্যায় পাওয়া যায়নি। ম্যানুয়ালি লিখুন।
                                                            </p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* If user chooses manual input when syllabus exists */}
                                                {topic === 'manual-input' && (
                                                    <div className="mt-3 animate-in slide-in-from-top-1">
                                                        <Input 
                                                            placeholder="টপিক বা অধ্যায়ের নাম লিখুন..." 
                                                            onChange={e => setTopic(e.target.value)} 
                                                            autoFocus
                                                            className="font-bold border-dashed border-2 border-primary"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="font-bold">শিখনফল ও উদ্দেশ্য (ঐচ্ছিক)</Label>
                                                <Textarea 
                                                    placeholder="শিক্ষার্থীরা কী শিখবে..." 
                                                    value={objectives} 
                                                    onChange={e => setObjectives(e.target.value)}
                                                    className="min-h-[80px]"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-4 pt-4 bg-muted/20 p-6 rounded-2xl border-2 border-dashed border-primary/20">
                                            <div className="flex justify-between items-center mb-4">
                                                <Label className="font-black text-primary text-lg">সিলেবাসের অগ্রগতি (Syllabus Progress)</Label>
                                                <Badge variant="secondary" className="text-xl font-black px-4 py-1 bg-primary text-white shadow-md">
                                                    {toBengaliNumber(progress)}%
                                                </Badge>
                                            </div>
                                            <Slider 
                                                value={[progress]} 
                                                onValueChange={([val]) => setProgress(val)} 
                                                max={100} 
                                                step={1} 
                                                className="py-4"
                                            />
                                            <p className="text-xs text-muted-foreground italic font-medium">
                                                * আপনার বিষয়ের পুরো সিলেবাসের কত শতাংশ এখন পর্যন্ত শেষ হয়েছে তা স্লাইডার সরিয়ে সেট করুন।
                                            </p>
                                        </div>

                                        <div className="flex justify-end pt-4">
                                            <Button 
                                                onClick={handleSave} 
                                                disabled={isLoading || !topic || topic === 'manual-input'}
                                                className="px-12 h-14 text-lg font-black shadow-xl"
                                            >
                                                {isLoading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                                                প্ল্যান ও প্রগ্রেস সেভ করুন
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="space-y-4">
                                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                                        <Calendar className="h-5 w-5 text-primary" /> আমার পূর্ববর্তী আপডেটসমূহ
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {myPlans.length === 0 ? (
                                            <div className="col-span-full py-20 border-2 border-dashed rounded-3xl text-center text-muted-foreground italic">
                                                এখনো কোনো লেসন প্ল্যান যোগ করা হয়নি।
                                            </div>
                                        ) : (
                                            myPlans.map(plan => (
                                                <Card key={plan.id} className="border-2 border-black/5 hover:border-primary/20 transition-all shadow-sm">
                                                    <CardHeader className="pb-2 flex flex-row justify-between items-start space-y-0">
                                                        <div>
                                                            <CardTitle className="text-base font-black text-slate-900">{plan.topic}</CardTitle>
                                                            <CardDescription className="font-bold text-xs">
                                                                {classNamesMap[plan.className]} শ্রেণি • {plan.subject}
                                                            </CardDescription>
                                                        </div>
                                                        <Badge variant="outline" className="text-[10px] font-black">{plan.week}</Badge>
                                                    </CardHeader>
                                                    <CardContent className="pb-4">
                                                        <div className="space-y-3">
                                                            <div className="flex items-center justify-between text-xs mb-1">
                                                                <span className="font-bold">সিলেবাস সম্পন্ন:</span>
                                                                <span className="font-black text-primary">{toBengaliNumber(plan.progress)}%</span>
                                                            </div>
                                                            <Progress value={plan.progress} className="h-1.5" />
                                                            {plan.objectives && (
                                                                <p className="text-[10px] text-muted-foreground line-clamp-2 italic mt-2 bg-slate-50 p-2 rounded">
                                                                    "{plan.objectives}"
                                                                </p>
                                                            )}
                                                            <p className="text-[9px] text-muted-foreground text-right mt-2">
                                                                আপডেট: {format(plan.updatedAt, 'PPp', { locale: bn })}
                                                            </p>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'tracker' && (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                <div className="p-4 bg-emerald-50 border-2 border-emerald-100 rounded-2xl flex items-center gap-4">
                                    <div className="p-3 bg-white rounded-xl shadow-sm"><BarChart3 className="h-8 w-8 text-emerald-600" /></div>
                                    <div>
                                        <h3 className="text-xl font-black text-emerald-900">সিলেবাস মনিটরিং বোর্ড</h3>
                                        <p className="text-sm font-bold text-emerald-700">পুরো বিদ্যালয়ের শিক্ষা কার্যক্রমের অগ্রগতির চিত্র</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-8">
                                    {Object.entries(classNamesMap).map(([clsId, clsName]) => {
                                        const classSubjects = syllabusTrackerData[clsId] || {};
                                        return (
                                            <div key={clsId} className="space-y-4">
                                                <h4 className="text-lg font-black text-slate-800 border-l-4 border-emerald-500 pl-3 flex items-center gap-2">
                                                    {clsName} শ্রেণি <Badge variant="outline" className="font-bold">{toBengaliNumber(Object.keys(classSubjects).length)} টি বিষয়</Badge>
                                                </h4>
                                                
                                                {Object.keys(classSubjects).length === 0 ? (
                                                    <div className="p-6 bg-slate-50 rounded-xl border border-dashed text-center text-xs font-bold text-muted-foreground italic">
                                                        এই শ্রেণির অগ্রগতির কোনো তথ্য নেই।
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {Object.entries(classSubjects).map(([subName, plan]) => (
                                                            <Card key={subName} className="border-2 border-black/5 shadow-sm hover:shadow-md transition-all">
                                                                <CardContent className="p-5 space-y-4">
                                                                    <div className="flex justify-between items-start">
                                                                        <div className="space-y-1">
                                                                            <p className="text-sm font-black text-slate-900">{subName}</p>
                                                                            <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                                                                <User className="h-2.5 w-2.5" /> {plan.teacherName}
                                                                            </p>
                                                                        </div>
                                                                        <Badge className={cn(
                                                                            "font-black text-[10px]",
                                                                            plan.progress >= 80 ? "bg-emerald-600" : plan.progress >= 50 ? "bg-amber-600" : "bg-rose-600"
                                                                        )}>
                                                                            {toBengaliNumber(plan.progress)}%
                                                                        </Badge>
                                                                    </div>
                                                                    
                                                                    <div className="space-y-2">
                                                                        <Progress value={plan.progress} className={cn(
                                                                            "h-2",
                                                                            plan.progress >= 80 ? "[&>div]:bg-emerald-500" : plan.progress >= 50 ? "[&>div]:bg-amber-500" : "[&>div]:bg-rose-500"
                                                                        )} />
                                                                        <div className="flex justify-between items-center text-[9px] font-bold text-muted-foreground">
                                                                            <span>সবশেষ সপ্তাহ: {plan.week}</span>
                                                                            <span>আপডেট: {format(plan.updatedAt, 'dd MMM', { locale: bn })}</span>
                                                                        </div>
                                                                    </div>

                                                                    <div className="pt-2 border-t border-dashed">
                                                                        <p className="text-[10px] font-black text-slate-700">বর্তমান টপিক:</p>
                                                                        <p className="text-[10px] font-bold text-muted-foreground line-clamp-1">{plan.topic}</p>
                                                                    </div>
                                                                </CardContent>
                                                            </Card>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {activeTab === 'syllabus' && (
                            <SyllabusManagementTab />
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
}
