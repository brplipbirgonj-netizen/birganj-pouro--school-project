'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Trash2, Plus, Loader2, Bell, Printer, FileText, ExternalLink, Sparkles, ChevronRight, AlertCircle, RefreshCw, CheckCircle2, XCircle
} from 'lucide-react';
import { format } from "date-fns";
import { bn } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getNotices, addNotice, deleteNotice, updateNoticeScrolling, Notice } from '@/lib/notice-data';
import { generateNotice } from '@/ai/flows/generate-notice-flow';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';

const toBengaliNumber = (str: string | number) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

export default function NoticeManagementPage() {
    const db = useFirestore();
    const { user, hasPermission, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const { schoolInfo } = useSchoolInfo();
    const router = useRouter();
    
    const [notices, setNotices] = useState<Notice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [isClient, setIsClient] = useState(false);

    const [newNotice, setNewNotice] = useState({ title: '', content: '', priority: 'normal' as Notice['priority'], pdfUrl: '', isScrolling: true });
    const [printingNotice, setPrintingNotice] = useState<Notice | null>(null);

    const canManageNotices = hasPermission('manage:notices');
    const canViewNotices = hasPermission('view:notices');

    useEffect(() => {
        setIsClient(true);
    }, []);

    const fetchNotices = useCallback(async () => {
        if (!db || !user) return;
        setIsLoading(true);
        try {
            const data = await getNotices(db, 50);
            setNotices(data);
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    }, [db, user]);

    useEffect(() => {
        if (isClient && !authLoading) {
            if (user && canViewNotices) {
                fetchNotices();
            }
        }
    }, [user, fetchNotices, isClient, authLoading, canViewNotices]);

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
        toast({ title: 'AI ড্রাফট তৈরি হয়েছে' });
        setAiTopic('');
      } catch (error) {
        toast({ variant: 'destructive', title: 'AI ত্রুটি' });
      } finally {
        setIsAiLoading(false);
      }
    };

    const handleAddNotice = async () => {
        if (!db || !user) return;
        if (!newNotice.title || !newNotice.content) {
            toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ' });
            return;
        }

        const senderName = user.role === 'admin' ? 'প্রধান শিক্ষক' : (user.displayName || user.email || 'শিক্ষক');

        try {
            await addNotice(db, {
                title: newNotice.title,
                content: newNotice.content,
                priority: newNotice.priority,
                senderName: senderName,
                pdfUrl: newNotice.pdfUrl || undefined,
                isScrolling: newNotice.isScrolling
            });
            toast({ title: 'নোটিশ প্রকাশিত হয়েছে' });
            setIsAddOpen(false);
            setNewNotice({ title: '', content: '', priority: 'normal', pdfUrl: '', isScrolling: true });
            fetchNotices();
        } catch (e) {}
    };

    const handleToggleScrolling = async (id: string, currentStatus: boolean) => {
        if (!db || !canManageNotices) return;
        try {
            await updateNoticeScrolling(db, id, !currentStatus);
            toast({ title: 'স্ক্রল স্ট্যাটাস পরিবর্তন হয়েছে' });
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

    const handlePrint = (notice: Notice) => {
        setPrintingNotice(notice);
        setTimeout(() => {
            window.print();
            setPrintingNotice(null);
        }, 300);
    };

    if (!isClient || authLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-indigo-50">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!user || !canViewNotices) {
        return (
            <div className="flex min-h-screen flex-col bg-indigo-50 font-kalpurush">
                <Header />
                <main className="flex-1 flex items-center justify-center p-4">
                    <Card className="max-w-md w-full border-2 border-rose-200 text-center p-10">
                        <AlertCircle className="h-16 w-16 text-rose-500 mx-auto mb-4" />
                        <CardTitle className="text-2xl font-black text-rose-950 mb-2">প্রবেশাধিকার নেই</CardTitle>
                        <CardDescription className="text-base font-bold">আপনার নোটিশ বোর্ড দেখার অনুমতি নেই।</CardDescription>
                        <Button className="mt-6" onClick={() => router.push('/')}>ড্যাশবোর্ডে ফিরে যান</Button>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#F6F7F9] font-kalpurush">
            <Header />
            <main className="flex-1 flex flex-col h-full max-w-[1400px] mx-auto w-full p-4 md:p-10 gap-8 pb-40">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800">নোটিশ বোর্ড</h2>
                        <p className="text-sm font-bold text-muted-foreground mt-1">বিদ্যালয়ের সকল গুরুত্বপূর্ণ ঘোষণা এখানে পাওয়া যাবে</p>
                    </div>
                    {canManageNotices && (
                        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                            <DialogTrigger asChild>
                                <Button className="font-black h-12 px-8 shadow-xl text-lg"><Plus className="mr-2 h-6 w-6" /> নতুন নোটিশ প্রকাশ</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto font-kalpurush p-0 border-none shadow-2xl rounded-2xl">
                                <DialogHeader className="p-6 bg-primary text-white">
                                    <DialogTitle className="text-2xl font-black">নতুন নোটিশ তৈরি করুন</DialogTitle>
                                    <DialogDescription className="text-white/80 font-bold">নিচে তথ্যগুলো পূরণ করে নোটিশ পাবলিশ করুন</DialogDescription>
                                </DialogHeader>
                                <div className="p-8 space-y-6">
                                    <div className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl space-y-3 shadow-inner">
                                        <div className="flex items-center gap-2 text-indigo-700 font-black text-xs uppercase tracking-wider">
                                            <Sparkles className="h-4 w-4" /> AI নোটিশ জেনারেটর
                                        </div>
                                        <div className="flex gap-2">
                                            <Input placeholder="টপিক লিখুন (উদা: বার্ষিক ক্রীড়া প্রতিযোগিতা)" value={aiTopic} onChange={e => setAiTopic(e.target.value)} className="bg-white h-11 border-2 focus:ring-primary" />
                                            <Button onClick={handleAiGenerate} disabled={isAiLoading} className="bg-indigo-600 h-11 px-4">
                                                {isAiLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label className="font-black text-sm">শিরোনাম (Title)</Label>
                                            <Input value={newNotice.title} onChange={e => setNewNotice({...newNotice, title: e.target.value})} className="font-bold h-11 border-2" placeholder="নোটিশের শিরোনাম" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="font-black text-sm">গুরুত্ব (Priority)</Label>
                                            <Select value={newNotice.priority} onValueChange={(v: any) => setNewNotice({...newNotice, priority: v})}>
                                                <SelectTrigger className="h-11 border-2 font-bold"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="normal">সাধারণ (Normal)</SelectItem>
                                                    <SelectItem value="important">গুরুত্বপূর্ণ (Important)</SelectItem>
                                                    <SelectItem value="urgent">জরুরি (Urgent)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label className="font-black text-sm">বিস্তারিত বিষয়বস্তু</Label>
                                            <Textarea value={newNotice.content} onChange={e => setNewNotice({...newNotice, content: e.target.value})} className="min-h-[200px] border-2 font-medium" placeholder="বিস্তারিত নোটিশ এখানে লিখুন..." />
                                        </div>
                                        <div className="space-y-2 md:col-span-2">
                                            <Label className="font-black text-sm">পিডিএফ বা ডকুমেন্ট লিংক (ঐচ্ছিক)</Label>
                                            <Input placeholder="https://..." value={newNotice.pdfUrl} onChange={e => setNewNotice({...newNotice, pdfUrl: e.target.value})} className="h-11 border-2" />
                                        </div>
                                        <div className="md:col-span-2 p-4 bg-primary/5 rounded-xl border-2 border-dashed border-primary/20 flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="font-black text-primary cursor-pointer" htmlFor="is-scrolling-toggle">টিকার/স্ক্রলিং নোটিশ</Label>
                                                <p className="text-[10px] font-bold text-muted-foreground">এটি অন থাকলে ড্যাশবোর্ডের উপরে স্ক্রল হবে।</p>
                                            </div>
                                            <Switch 
                                                id="is-scrolling-toggle"
                                                checked={newNotice.isScrolling} 
                                                onCheckedChange={v => setNewNotice({...newNotice, isScrolling: v})}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter className="p-6 bg-slate-50 border-t sticky bottom-0">
                                    <DialogClose asChild><Button variant="ghost" className="font-bold h-11 px-6">বাতিল</Button></DialogClose>
                                    <Button onClick={handleAddNotice} className="px-10 font-black h-11 shadow-lg">প্রকাশ করুন</Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>

                <div className="bg-white md:rounded-[32px] shadow-2xl md:border-[1px] border-slate-200/50 overflow-hidden min-h-[600px] flex flex-col no-print animate-in fade-in duration-500">
                    <div className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow className="h-16">
                                    <TableHead className="w-16 text-center font-black">ক্রমিক</TableHead>
                                    <TableHead className="font-black">শিরোনাম ও তারিখ</TableHead>
                                    <TableHead className="text-center font-black">স্ক্রলিং</TableHead>
                                    <TableHead className="font-black">ধরণ</TableHead>
                                    <TableHead className="font-black">সংযুক্তি</TableHead>
                                    <TableHead className="text-right font-black pr-10">কার্যক্রম</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-24 italic"><Loader2 className="h-10 w-10 animate-spin mx-auto mb-4 text-primary" /> নোটিশ লোড হচ্ছে...</TableCell></TableRow>
                                ) : notices.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-24 text-muted-foreground font-bold">কোনো নোটিশ পাওয়া যায়নি।</TableCell></TableRow>
                                ) : (
                                    notices.map((notice, idx) => (
                                        <TableRow key={notice.id} className="h-20 hover:bg-slate-50 transition-colors">
                                            <TableCell className="text-center font-black text-lg">{toBengaliNumber(idx + 1)}</TableCell>
                                            <TableCell>
                                                <p className="font-black text-base text-slate-800 line-clamp-1">{notice.title}</p>
                                                <p className="text-xs font-bold text-muted-foreground mt-1">{format(notice.date, 'PP p', { locale: bn })}</p>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <Switch 
                                                        checked={notice.isScrolling} 
                                                        onCheckedChange={() => handleToggleScrolling(notice.id, !!notice.isScrolling)}
                                                        disabled={!canManageNotices}
                                                    />
                                                    <span className={cn("text-[9px] font-black uppercase", notice.isScrolling ? "text-emerald-600" : "text-slate-400")}>
                                                        {notice.isScrolling ? 'অন' : 'অফ'}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={notice.priority === 'urgent' ? 'destructive' : notice.priority === 'important' ? 'secondary' : 'outline'} className="font-black px-4 py-0.5">
                                                    {notice.priority === 'urgent' ? 'জরুরি' : notice.priority === 'important' ? 'গুরুত্বপূর্ণ' : 'সাধারণ'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {notice.pdfUrl ? (
                                                    <a href={notice.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-blue-800 flex items-center gap-1.5 text-xs font-black bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                                                        <ExternalLink className="h-3.5 w-3.5" /> ফাইল দেখুন
                                                    </a>
                                                ) : <span className="text-muted-foreground/30 font-bold">নেই</span>}
                                            </TableCell>
                                            <TableCell className="text-right pr-10">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="outline" size="icon" className="h-10 w-10 text-blue-600 border-blue-200 bg-white hover:bg-blue-50" onClick={() => handlePrint(notice)} title="প্রিন্ট করুন"><Printer className="h-5 w-5" /></Button>
                                                    {canManageNotices && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-10 w-10 text-rose-500 hover:text-rose-700 hover:bg-rose-50" title="মুছে ফেলুন"><Trash2 className="h-5 w-5" /></Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="font-kalpurush">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle className="text-2xl font-black text-rose-700">নোটিশটি মুছতে চান?</AlertDialogTitle>
                                                                    <AlertDialogDescription className="text-lg font-bold">এই নোটিশটি স্থায়ীভাবে মুছে ফেলা হবে এবং ড্যাশবোর্ড থেকে চলে যাবে।</AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel className="font-bold">বাতিল</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDelete(notice.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 font-black">হ্যাঁ, মুছুন</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </main>

            {/* Hidden Printable Notice Layout */}
            {printingNotice && (
                <div className="hidden print:block printable-area bg-white text-black p-16 font-kalpurush">
                    <div className="text-center border-b-4 border-emerald-800 pb-4 mb-10">
                        <h1 className="text-4xl font-black text-emerald-950 mb-1">{schoolInfo.name}</h1>
                        <p className="text-lg font-bold text-slate-700">{schoolInfo.address}</p>
                    </div>
                    <div className="text-right mb-8 text-base font-bold">
                        তারিখ: {format(printingNotice.date, 'dd/MM/yyyy', { locale: bn })} ইং
                    </div>
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-black underline underline-offset-[12px] uppercase tracking-widest leading-relaxed">
                            {printingNotice.title}
                        </h2>
                    </div>
                    <div className="text-2xl leading-[2.2] text-justify font-medium whitespace-pre-wrap px-8">
                        {printingNotice.content}
                    </div>
                    <div className="mt-32 flex justify-end px-16">
                        <div className="text-center">
                            <div className="w-56 border-t-2 border-black pt-2 font-black text-xl">প্রধান শিক্ষক</div>
                            <p className="text-base font-bold mt-1">{schoolInfo.name}</p>
                        </div>
                    </div>
                    <div className="mt-auto pt-20 text-center text-[10px] text-slate-400 border-t border-dashed">
                        Digital Management Portal | {format(new Date(), 'PPpp', { locale: bn })}
                    </div>
                </div>
            )}
        </div>
    );
}
