'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { useToast } from '@/hooks/use-toast';
import { 
    MessageSquare, Send, Users, History, Clock, Trash2, Phone, 
    Check, Search, Sparkles, MessageCircle, AlertCircle, MessageSquareDashed, ShieldAlert,
    User, UserMinus, LayoutGrid, ChevronRight, Loader2
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { logMessage, getMessageLogs, MessageLog, deleteMessageLog } from '@/lib/messaging-data';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const QUICK_TEMPLATES = [
    { title: '❌ অনুপস্থিতি', text: 'সম্মানিত অভিভাবক, আপনার সন্তান আজ বিদ্যালয়ে অনুপস্থিত রয়েছে। অনুপস্থিতির কারণ জানান। - প্রধান শিক্ষক, বীপৌউবি' },
    { title: '💰 বকেয়া ফি', text: 'সম্মানিত অভিভাবক, আপনার সন্তানের চলতি মাসের বেতন/ফি বকেয়া রয়েছে। অনুগ্রহ করে দ্রুত পরিশোধের অনুরোধ করা হলো। - বীপৌউবি' },
    { title: '📅 পরীক্ষা', text: 'সম্মানিত অভিভাবক, আগামী রবিবার হতে সাময়িক পরীক্ষা শুরু হবে। সন্তানকে পরীক্ষার প্রস্তুতিতে সহযোগিতা করুন। - বীপৌউবি' },
    { title: '🏫 সভা', text: 'সম্মানিত অভিভাবক, আগামী শনিবার সকাল ১০:০০ টায় বিদ্যালয়ে জরুরি অভিভাবক সভার আয়োজন করা হয়েছে।' },
];

export default function MessagingPage() {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const { toast } = useToast();
    const { user, hasPermission } = useAuth();

    const [isClient, setIsClient] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [messageLogs, setMessageLogs] = useState<MessageLog[]>([]);
    const [isLoadingLogs, setIsLoadingLogs] = useState(true);

    const [activeSection, setActiveSection] = useState('bulk');
    const [messageContent, setMessageContent] = useState('');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [logSearchQuery, setLogSearchQuery] = useState('');

    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

    const canSendMessages = hasPermission('send:messaging');
    // Only admins can delete message history
    const canManageMessages = user?.role === 'admin';

    const fetchLogs = useCallback(async () => {
        if (!db || !user) return;
        setIsLoadingLogs(true);
        const logs = await getMessageLogs(db);
        setMessageLogs(logs);
        setIsLoadingLogs(false);
    }, [db, user]);

    useEffect(() => {
        setIsClient(true);
        if (db && user) {
            fetchLogs();
            const q = query(collection(db, 'students'), where('academicYear', '==', selectedYear));
            const unsub = onSnapshot(q, (snap) => setAllStudents(snap.docs.map(studentFromDoc)));
            return () => unsub();
        }
    }, [db, user, fetchLogs, selectedYear]);

    const handleSectionChange = (val: string) => {
        setActiveSection(val);
        setSelectedStudentIds(new Set());
        setSelectedClass('');
        if (val === 'absent') setMessageContent('সম্মানিত অভিভাবক, আপনার সন্তান আজ বিদ্যালয়ে অনুপস্থিত আছে। বীপৌউবি');
        else setMessageContent('');
    };

    const studentsInClass = useMemo(() => {
        return allStudents.filter(s => s.className === selectedClass).sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
    }, [allStudents, selectedClass]);

    const handleSendDirectSMS = (mobiles: string | string[], content: string) => {
        if (!canSendMessages) return;
        const numbers = Array.isArray(mobiles) ? mobiles : [mobiles];
        const cleanNumbers = numbers.map(num => num.replace(/[^\d+]/g, '')).filter(num => num.length >= 10);
        if (cleanNumbers.length === 0 || !content.trim()) return;
        const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
        const smsUrl = isIOS ? `sms:${cleanNumbers.join(',')}&body=${encodeURIComponent(content)}` : `sms:${cleanNumbers.join(',')}?body=${encodeURIComponent(content)}`;
        window.location.href = smsUrl;
    };

    const handleSingleWhatsApp = (mobile: string, content: string) => {
        let cleanNum = mobile.replace(/[^\d]/g, '');
        if (cleanNum.startsWith('0')) cleanNum = '88' + cleanNum;
        if (!cleanNum.startsWith('88')) cleanNum = '880' + cleanNum;
        window.open(`https://wa.me/${cleanNum}?text=${encodeURIComponent(content || 'নমস্কার')}`, '_blank');
    };

    const handleLogAndSimulateMessage = async (type: any, recipientsCount: number) => {
        if (!db || !user || !messageContent.trim()) return;
        setIsLoading(true);
        try {
            await logMessage(db, {
                recipientsCount, type, className: selectedClass || undefined, content: messageContent,
                senderUid: user.uid, senderName: user.displayName || user.email || 'Admin'
            });
            toast({ title: 'মেসেজ রেকর্ড করা হয়েছে' });
            if ((type === 'individual' || type === 'absent') && selectedStudentIds.size > 0) {
                const mobiles = Array.from(selectedStudentIds).map(id => allStudents.find(s => s.id === id)?.guardianMobile || '').filter(Boolean);
                handleSendDirectSMS(mobiles, messageContent);
            } else if (type === 'class' && selectedClass) {
                const mobiles = studentsInClass.map(s => s.guardianMobile || '').filter(Boolean);
                handleSendDirectSMS(mobiles, messageContent);
            }
            if (type !== 'absent') setMessageContent('');
            setSelectedStudentIds(new Set());
            fetchLogs();
        } catch (e) {} finally { setIsLoading(false); }
    };

    const fetchAbsentStudents = async () => {
        if (!db || !selectedClass) return;
        setIsLoading(true);
        try {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const q = query(collection(db, 'attendance'), where('date', '==', todayStr), where('className', '==', selectedClass));
            const snap = await getDocs(q);
            if (snap.empty) { toast({ variant: 'destructive', title: 'হাজিরা নেওয়া হয়নি' }); }
            else {
                const absentIds = snap.docs[0].data().attendance.filter((a: any) => a.status === 'absent').map((a: any) => a.studentId);
                setSelectedStudentIds(new Set(absentIds));
                toast({ title: `${absentIds.length.toLocaleString('bn-BD')} জন অনুপস্থিত।` });
            }
        } catch (e) {} finally { setIsLoading(false); }
    };

    const sidebarItems = [
        { id: 'bulk', label: 'সকলকে', icon: Users, color: 'text-indigo-600 bg-indigo-50' },
        { id: 'class', label: 'শ্রেণিভিত্তিক', icon: LayoutGrid, color: 'text-emerald-600 bg-emerald-50' },
        { id: 'individual', label: 'একক', icon: User, color: 'text-blue-600 bg-blue-50' },
        { id: 'absent', label: 'অনুপস্থিত', icon: UserMinus, color: 'text-rose-600 bg-rose-50' },
    ];

    const filteredLogs = useMemo(() => {
        if (!logSearchQuery.trim()) return messageLogs;
        const q = logSearchQuery.toLowerCase();
        return messageLogs.filter(log => (log.content || '').toLowerCase().includes(q) || (log.senderName || '').toLowerCase().includes(q));
    }, [messageLogs, logSearchQuery]);

    if (!isClient) return null;

    return (
      <div className="flex min-h-screen w-full flex-col bg-[#F6F7F9] font-kalpurush">
        <Header />
        <main className="flex-1 flex flex-col md:flex-row h-full max-w-[1600px] mx-auto w-full md:p-6 lg:p-10 gap-8 pb-[500px]">
          
          {/* Sidebar Navigation - Fixed/Sticky */}
          <aside className="w-full md:w-60 shrink-0 space-y-1 no-print bg-white md:bg-transparent p-4 md:p-0 border-b md:border-0 sticky top-20 md:top-28 self-start">
            <h2 className="text-2xl font-black mb-6 px-4 hidden md:block text-slate-900 tracking-tight">মেসেজ সেন্টার</h2>
            <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-1 scrollbar-none">
                {sidebarItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => handleSectionChange(item.id)}
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

          <div className="flex-1 min-w-0 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            <div className="lg:col-span-2 bg-white md:rounded-[32px] shadow-2xl border-slate-200/50 overflow-hidden flex flex-col p-4 sm:p-8">
                {!canSendMessages ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50"><ShieldAlert className="h-16 w-16 text-red-500 mb-4" /><p className="font-black">অনুমতি নেই</p></div>
                ) : (
                    <div className="space-y-6">
                        <div className="p-4 bg-muted/20 rounded-xl space-y-3">
                            <Label className="text-xs font-black uppercase text-muted-foreground">দ্রুত টেমপ্লেট</Label>
                            <div className="flex flex-wrap gap-2">{QUICK_TEMPLATES.map((t, i) => <Button key={i} variant="outline" size="sm" className="text-[10px] h-7 bg-white font-bold" onClick={() => setMessageContent(t.text)}>{t.title}</Button>)}</div>
                        </div>

                        {activeSection === 'class' || activeSection === 'individual' || activeSection === 'absent' ? (
                             <div className="space-y-4">
                                <Label className="font-black text-primary">শ্রেণি নির্বাচন করুন</Label>
                                <div className="flex gap-2">
                                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                                        <SelectTrigger className="flex-1 h-11 bg-white border-2"><SelectValue placeholder="সিলেক্ট শ্রেণি" /></SelectTrigger>
                                        <SelectContent>{Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}</SelectContent>
                                    </Select>
                                    {activeSection === 'absent' && <Button onClick={fetchAbsentStudents} disabled={!selectedClass || isLoading} className="font-bold h-11">অনুপস্থিত খোজুন</Button>}
                                </div>
                             </div>
                        ) : null}

                        <div className="space-y-2">
                            <div className="flex justify-between items-center"><Label className="font-black">বার্তার বিষয়বস্তু</Label><span className="text-[10px] font-bold text-muted-foreground">অক্ষর: {messageContent.length.toLocaleString('bn-BD')}</span></div>
                            <Textarea value={messageContent} onChange={e => setMessageContent(e.target.value)} placeholder="বার্তা লিখুন..." className="min-h-[150px] text-base font-medium border-2 focus:ring-primary" />
                        </div>

                        {(activeSection === 'individual' || activeSection === 'class' || activeSection === 'absent') && selectedClass && (
                            <div className="border-2 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto bg-slate-50/30">
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead className="w-12">
                                                <Checkbox onCheckedChange={c => setSelectedStudentIds(c ? new Set(studentsInClass.map(s => s.id)) : new Set())} />
                                            </TableHead>
                                            <TableHead className="text-xs font-black">রোল ও নাম</TableHead>
                                            <TableHead className="text-right text-xs font-black">মোবাইল ও কার্যক্রম</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {studentsInClass.map(s => (
                                            <TableRow key={s.id} className="h-12 cursor-pointer hover:bg-white transition-colors" onClick={() => { const n = new Set(selectedStudentIds); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); setSelectedStudentIds(n); }}>
                                                <TableCell><Checkbox checked={selectedStudentIds.has(s.id)} /></TableCell>
                                                <TableCell>
                                                    <p className="text-[11px] font-black text-slate-800">{s.roll.toLocaleString('bn-BD')} - {s.studentNameBn}</p>
                                                    <p className="text-[9px] font-bold text-muted-foreground italic">{s.guardianMobile || '-'}</p>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end items-center gap-1.5 no-print" onClick={e => e.stopPropagation()}>
                                                        <a href={`tel:${s.guardianMobile || s.studentMobile}`} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-sm">
                                                            <Phone className="h-3.5 w-3.5" />
                                                        </a>
                                                        <button 
                                                            onClick={() => handleSendDirectSMS(s.guardianMobile || '', messageContent)} 
                                                            className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                                                        >
                                                            <MessageSquareDashed className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleSingleWhatsApp(s.guardianMobile || '', messageContent)} 
                                                            className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
                                                        >
                                                            <MessageCircle className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}

                        <Button className="w-full h-14 text-lg font-black shadow-xl" disabled={isLoading || !messageContent.trim() || (activeSection !== 'bulk' && !selectedClass)} onClick={() => handleLogAndSimulateMessage(activeSection, activeSection === 'bulk' ? allStudents.length : activeSection === 'class' ? studentsInClass.length : selectedStudentIds.size)}>
                            <Send className="mr-2 h-6 w-6" /> {isLoading ? 'প্রসেস হচ্ছে...' : 'মেসেজ রেকর্ড ও একযোগে প্রেরণ করুন'}
                        </Button>
                    </div>
                )}
            </div>

            <div className="bg-white md:rounded-[32px] shadow-2xl border-slate-200/50 overflow-hidden flex flex-col p-4">
                <div className="flex items-center gap-2 mb-4 border-b pb-4"><History className="h-5 w-5 text-primary" /><h3 className="font-black">মেসেজ ইতিহাস</h3></div>
                <div className="relative mb-4"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="ইতিহাস খুঁজুন..." value={logSearchQuery} onChange={e => setLogSearchQuery(e.target.value)} className="pl-9 h-9 text-xs" /></div>
                <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2">
                    {isLoadingLogs ? <div className="space-y-2"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : filteredLogs.length === 0 ? <p className="text-center py-10 text-xs italic text-muted-foreground">কোনো লগ পাওয়া যায়নি।</p> : filteredLogs.map(log => (
                        <div key={log.id} className="p-3 border rounded-xl bg-slate-50/50 space-y-2 group">
                            <div className="flex justify-between items-start">
                                <Badge variant="secondary" className="text-[9px] font-black">{log.type === 'bulk' || log.type === 'all' ? 'সকলকে' : log.type === 'class' ? 'শ্রেণি' : 'একক'}</Badge>
                                <span className="text-[8px] font-bold text-muted-foreground">{format(log.sentAt, 'dd MMM p', { locale: bn })}</span>
                            </div>
                            <p className="text-[11px] font-bold text-slate-800 leading-relaxed line-clamp-2">{log.content}</p>
                            <div className="flex justify-between items-center pt-1 border-t border-dashed">
                                <span className="text-[9px] text-muted-foreground">প্রেরক: {log.senderName}</span>
                                {canManageMessages && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="font-kalpurush">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>ইতিহাস মুছুন</AlertDialogTitle>
                                                <AlertDialogDescription>আপনি কি নিশ্চিতভাবে এই রেকর্ডটি মুছে ফেলতে চান?</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => deleteMessageLog(db!, log.id).then(fetchLogs)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">মুছে ফেলুন</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
          </div>
        </main>
      </div>
    );
}