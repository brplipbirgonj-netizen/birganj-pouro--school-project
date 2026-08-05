
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    AlertCircle
} from 'lucide-react';
import { LessonPlan, saveLessonPlan, getLessonPlansForTeacher, getAllLessonPlans } from '@/lib/lesson-plan-data';
import { getSubjects } from '@/lib/subjects';
import { format, startOfWeek, endOfWeek, addWeeks, getWeek } from 'date-fns';
import { bn } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const classNamesMap: Record<string, string> = {
    '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

const toBengaliNumber = (str: string | number) => {
    if (!str && str !== 0) return '';
    const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => digits[parseInt(w, 10)]);
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
                                                <Select value={className} onValueChange={setClassName}>
                                                    <SelectTrigger className="bg-white"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                                                    <SelectContent>
                                                        {Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="font-bold">বিষয় নির্বাচন</Label>
                                                <Select value={subject} onValueChange={setSubject} disabled={!className}>
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
                                                <Label className="font-bold">এই সপ্তাহের প্রধান টপিক</Label>
                                                <Input 
                                                    placeholder="উদা: পাটিগণিত - অধ্যায় ৩" 
                                                    value={topic} 
                                                    onChange={e => setTopic(e.target.value)} 
                                                    className="font-bold"
                                                />
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
                                                disabled={isLoading || !topic}
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

                    </div>
                </div>
            </main>
        </div>
    );
}
