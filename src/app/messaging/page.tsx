'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { useToast } from '@/hooks/use-toast';
import { 
    MessageSquare, Send, Users, History, Clock, Trash2, Phone, 
    FileText, Check, Search, Sparkles, MessageCircle, AlertCircle, MessageSquareDashed, ShieldAlert
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { logMessage, getMessageLogs, MessageLog, deleteMessageLog, updateMessageNote } from '@/lib/messaging-data';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';

const QUICK_TEMPLATES = [
    {
        title: '❌ অনুপস্থিতি বার্তা',
        text: 'সম্মানিত অভিভাবক, আপনার সন্তান আজ বিদ্যালয়ে অনুপস্থিত রয়েছে। অনুপস্থিতির কারণ জানান। - প্রধান শিক্ষক, বীরগঞ্জ পৌর উচ্চ বিদ্যালয়'
    },
    {
        title: '💰 বকেয়া ফি তাগাদা',
        text: 'সম্মানিত অভিভাবক, আপনার সন্তানের চলতি মাসের বেতন/ফি বকেয়া রয়েছে। অনুগ্রহ করে দ্রুত পরিশোধের অনুরোধ করা হলো। - বীপৌউবি'
    },
    {
        title: '📅 পরীক্ষার নোটিশ',
        text: 'সম্মানিত অভিভাবক, আগামী রবিবার হতে সাময়িক পরীক্ষা শুরু হবে। সন্তানকে নিয়মিত ক্লাসে ও পরীক্ষার প্রস্তুতিতে সহযোগিতা করুন। - বীপৌউবি'
    },
    {
        title: '🏫 অভিভাবক সভা',
        text: 'সম্মানিত অভিভাবক, আগামী শনিবার সকাল ১০:০০ টায় বিদ্যালয়ে জরুরি অভিভাবক সভার আয়োজন করা হয়েছে। আপনার উপস্থিতি একান্ত কাম্য।'
    },
    {
        title: '📢 জরুরি বন্ধের নোটিশ',
        text: 'সম্মানিত অভিভাবক, সরকারি নির্দেশনা অনুযায়ী আগামী কাল বিদ্যালয় বন্ধ থাকবে। - প্রধান শিক্ষক, বীরগঞ্জ পৌর উচ্চ বিদ্যালয়'
    }
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

    const [messageContent, setMessageContent] = useState('');
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

    const [logSearchQuery, setLogSearchQuery] = useState('');

    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

    const canSendMessages = hasPermission('send:messaging');
    const canManageMessages = hasPermission('manage:messaging');

    const fetchLogs = useCallback(async () => {
        if (!db || !user) return;
        setIsLoadingLogs(true);
        const logs = await getMessageLogs(db);
        setMessageLogs(logs);
        setIsLoadingLogs(false);
    }, [db, user]);

    const fetchStudents = useCallback(async () => {
        if (!db || !user) return;
        const q = query(collection(db, 'students'), where('academicYear', '==', selectedYear));
        const snap = await getDocs(q);
        setAllStudents(snap.docs.map(studentFromDoc));
    }, [db, user, selectedYear]);

    useEffect(() => {
        setIsClient(true);
        if (db && user) {
            fetchLogs();
            fetchStudents();
        }
    }, [db, user, fetchLogs, fetchStudents]);

    const studentsInClass = useMemo(() => {
        return allStudents.filter(s => s.className === selectedClass).sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
    }, [allStudents, selectedClass]);

    const handleToggleStudent = (id: string) => {
        const next = new Set(selectedStudentIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedStudentIds(next);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedStudentIds(new Set(studentsInClass.map(s => s.id)));
        } else {
            setSelectedStudentIds(new Set());
        }
    };

    // Calculate SMS character & part stats
    const smsStats = useMemo(() => {
        const len = messageContent.length;
        if (len === 0) return { chars: 0, parts: 0 };
        const isUnicode = /[^\x00-\x7F]/.test(messageContent);
        if (isUnicode) {
            if (len <= 70) return { chars: len, parts: 1 };
            return { chars: len, parts: Math.ceil(len / 67) };
        } else {
            if (len <= 160) return { chars: len, parts: 1 };
            return { chars: len, parts: Math.ceil(len / 153) };
        }
    }, [messageContent]);

    // Send direct mobile SMS via device protocol
    const handleSendDirectSMS = (mobiles: string | string[], content: string) => {
        if (!canSendMessages) {
            toast({ variant: 'destructive', title: 'পারমিশন নেই', description: 'আপনার মেসেজ পাঠানোর অনুমতি নেই।' });
            return;
        }
        const numbers = Array.isArray(mobiles) ? mobiles : [mobiles];
        const cleanNumbers = numbers
            .map(num => num.replace(/[^\d+]/g, ''))
            .filter(num => num.length >= 10);

        if (cleanNumbers.length === 0) {
            toast({ variant: 'destructive', title: 'মোবাইল নম্বর সঠিক নয়' });
            return;
        }
        if (!content.trim()) {
            toast({ variant: 'destructive', title: 'মেসেজ লিখুন' });
            return;
        }

        const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
        const recipients = cleanNumbers.join(',');
        const encodedContent = encodeURIComponent(content);
        const smsUrl = isIOS ? `sms:${recipients}&body=${encodedContent}` : `sms:${recipients}?body=${encodedContent}`;

        try {
            window.location.href = smsUrl;
        } catch (e) {
            window.open(smsUrl, '_blank');
        }
    };

    // Send WhatsApp Direct Message
    const handleSendWhatsApp = (mobile: string, content: string) => {
        if (!canSendMessages) return;
        if (!mobile) {
            toast({ variant: 'destructive', title: 'মোবাইল নম্বর নেই' });
            return;
        }
        let cleanNum = mobile.replace(/[^\d]/g, '');
        if (cleanNum.startsWith('0')) cleanNum = '88' + cleanNum;
        if (!cleanNum.startsWith('88')) cleanNum = '880' + cleanNum;

        const encodedContent = encodeURIComponent(content || messageContent || 'সম্মানিত অভিভাবক, বীরগঞ্জ পৌর উচ্চ বিদ্যালয় হতে জরুরি বার্তা।');
        const url = `https://wa.me/${cleanNum}?text=${encodedContent}`;
        window.open(url, '_blank');
    };

    const handleMakeCall = async (student: Student) => {
        if (!canSendMessages) return;
        const mobile = student.guardianMobile || student.studentMobile || '';
        const cleanNumber = mobile.replace(/[^\d+]/g, '');
        if (!cleanNumber) {
            toast({ variant: 'destructive', title: 'মোবাইল নম্বর নেই' });
            return;
        }

        window.location.href = `tel:${cleanNumber}`;

        if (db && user) {
            try {
                await logMessage(db, {
                    recipientsCount: 1,
                    type: 'call',
                    content: `${student.studentNameBn} (রোল: ${student.roll.toLocaleString('bn-BD')}) - মোবাইল: ${mobile}`,
                    senderUid: user.uid,
                    senderName: user.displayName || user.email || 'Admin'
                });
                fetchLogs();
            } catch (e) {
                console.error("Failed to log call:", e);
            }
        }
    };

    const handleLogAndSimulateMessage = async (type: 'all' | 'class' | 'individual' | 'absent', recipientsCount: number) => {
        if (!db || !user) return;
        if (!canSendMessages) {
            toast({ variant: 'destructive', title: 'পারমিশন নেই' });
            return;
        }
        if (!messageContent.trim()) {
            toast({ variant: 'destructive', title: 'মেসেজ লিখুন' });
            return;
        }

        setIsLoading(true);
        try {
            await logMessage(db, {
                recipientsCount,
                type,
                className: selectedClass || undefined,
                content: messageContent,
                senderUid: user.uid,
                senderName: user.displayName || user.email || 'Admin'
            });

            toast({ title: 'মেসেজ রেকর্ড করা হয়েছে', description: `মোট ${recipientsCount.toLocaleString('bn-BD')} জন শিক্ষার্থীর জন্য লগ তৈরি করা হয়েছে।` });

            if ((type === 'individual' || type === 'absent') && selectedStudentIds.size > 0) {
                const mobiles = Array.from(selectedStudentIds).map(id => {
                    const student = allStudents.find(s => s.id === id);
                    return student?.guardianMobile || student?.studentMobile || '';
                }).filter(Boolean);

                if (mobiles.length > 0) {
                    handleSendDirectSMS(mobiles, messageContent);
                }
            } else if (type === 'class' && selectedClass) {
                const mobiles = studentsInClass.map(s => s.guardianMobile || s.studentMobile || '').filter(Boolean);
                if (mobiles.length > 0) {
                    handleSendDirectSMS(mobiles, messageContent);
                }
            }

            if (type !== 'absent') setMessageContent('');
            setSelectedStudentIds(new Set());
            fetchLogs();
        } catch (e: any) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAbsentStudents = async () => {
        if (!db || !user || !selectedClass) {
            toast({ variant: 'destructive', title: 'শ্রেণি নির্বাচন করুন' });
            return;
        }
        setIsLoading(true);
        try {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const q = query(
                collection(db, 'attendance'),
                where('date', '==', todayStr),
                where('className', '==', selectedClass),
                where('academicYear', '==', selectedYear)
            );
            const snap = await getDocs(q);
            if (snap.empty) {
                toast({ variant: 'destructive', title: 'আজকের হাজিরা এখনও নেওয়া হয়নি।' });
                setIsLoading(false);
                return;
            }
            const attData = snap.docs[0].data();
            const absentIds = attData.attendance.filter((a: any) => a.status === 'absent').map((a: any) => a.studentId);
            setSelectedStudentIds(new Set(absentIds));

            if (absentIds.length === 0) {
                toast({ title: 'সবাই উপস্থিত আছে!' });
            } else {
                toast({ title: `${absentIds.length.toLocaleString('bn-BD')} জন অনুপস্থিত পাওয়া গেছে।` });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'তথ্য আনা সম্ভব হয়নি' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteLog = async (id: string) => {
        if (!db || !user) return;
        if (!canManageMessages) {
            toast({ variant: 'destructive', title: 'পারমিশন নেই' });
            return;
        }
        try {
            await deleteMessageLog(db, id);
            toast({ title: 'লগ মুছে ফেলা হয়েছে' });
            fetchLogs();
        } catch (e) {}
    };

    const handleTabChange = (val: string) => {
        setSelectedStudentIds(new Set());
        setSelectedClass('');
        if (val === 'absent') {
            setMessageContent('সম্মানিত অভিভাবক, আপনার সন্তান আজ বিদ্যালয়ে অনুপস্থিত আছে। বিপৌউবি');
        } else {
            setMessageContent('');
        }
    };

    const filteredLogs = useMemo(() => {
        if (!logSearchQuery.trim()) return messageLogs;
        const q = logSearchQuery.toLowerCase();
        return messageLogs.filter(log =>
            (log.content || '').toLowerCase().includes(q) ||
            (log.senderName || '').toLowerCase().includes(q) ||
            (log.note || '').toLowerCase().includes(q)
        );
    }, [messageLogs, logSearchQuery]);

    if (!isClient) return null;

    return (
      <div className="flex min-h-screen w-full flex-col bg-lime-50 font-kalpurush">
        <Header />
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-[500px]">
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
            <Card className="md:col-span-2 lg:col-span-3 shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                  <MessageSquare className="h-6 w-6 text-primary" /> মেসেজ সেন্টার
                </CardTitle>
                <CardDescription>শিক্ষার্থী ও অভিভাবকদের কাছে সরাসরি মেসেজ পাঠান, WhatsApp করুন বা কল দিন</CardDescription>
              </CardHeader>
              <CardContent>
                {canSendMessages ? (
                  <Tabs defaultValue="bulk" onValueChange={handleTabChange}>
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="bulk" className="font-bold">সকলকে</TabsTrigger>
                    <TabsTrigger value="class" className="font-bold">শ্রেণিভিত্তিক</TabsTrigger>
                    <TabsTrigger value="individual" className="font-bold">একক</TabsTrigger>
                    <TabsTrigger value="absent" className="font-bold text-red-700">অনুপস্থিত</TabsTrigger>
                  </TabsList>

                  {/* Pre-defined SMS Templates Bar */}
                  <div className="mt-4 p-3 bg-white border rounded-lg shadow-sm">
                    <Label className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" /> দ্রুত মেসেজ টেমপ্লেট (এক ক্লিকে লিখুন):
                    </Label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {QUICK_TEMPLATES.map((tmpl, idx) => (
                        <Button
                          key={idx}
                          variant="outline"
                          size="sm"
                          className="text-xs bg-slate-50 hover:bg-primary/10 border-slate-200"
                          onClick={() => setMessageContent(tmpl.text)}
                        >
                          {tmpl.title}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 space-y-6">
                    {/* Bulk Tab */}
                    <TabsContent value="bulk" className="space-y-4">
                      <div className="p-4 bg-lime-100 border border-lime-200 rounded-lg flex items-center gap-4">
                        <Users className="h-10 w-10 text-lime-700" />
                        <div>
                          <p className="font-bold text-lime-900">সকল শিক্ষার্থী</p>
                          <p className="text-sm text-lime-700">পুরো স্কুলের {allStudents.length.toLocaleString('bn-BD')} জন শিক্ষার্থীর জন্য লগ তৈরি হবে।</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="font-bold">বার্তার বিষয়বস্তু</Label>
                          <div className="text-xs text-muted-foreground font-semibold">
                            অক্ষর: <span className="font-bold text-primary">{smsStats.chars.toLocaleString('bn-BD')}</span> | 
                            SMS: <span className="font-bold text-primary">{smsStats.parts.toLocaleString('bn-BD')}</span> টি
                          </div>
                        </div>
                        <Textarea 
                          placeholder="আপনার বার্তা এখানে লিখুন..." 
                          className="min-h-[150px]"
                          value={messageContent}
                          onChange={e => setMessageContent(e.target.value)}
                        />
                      </div>
                      <Button 
                        className="w-full h-12 text-lg font-bold" 
                        disabled={isLoading || allStudents.length === 0}
                        onClick={() => handleLogAndSimulateMessage('all', allStudents.length)}
                      >
                        <Send className="mr-2 h-5 w-5" /> রেকর্ড করুন
                      </Button>
                    </TabsContent>

                    {/* Class-wise Tab */}
                    <TabsContent value="class" className="space-y-4">
                      <div className="space-y-2">
                        <Label className="font-bold">শ্রেণি নির্বাচন করুন</Label>
                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                          <SelectTrigger><SelectValue placeholder="শ্রেণি নির্বাচন করুন" /></SelectTrigger>
                          <SelectContent>
                            {['6', '7', '8', '9', '10'].map(c => (
                              <SelectItem key={c} value={c}>{classNamesMap[c]} শ্রেণি</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="font-bold">বার্তার বিষয়বস্তু</Label>
                          <div className="text-xs text-muted-foreground font-semibold">
                            অক্ষর: <span className="font-bold text-primary">{smsStats.chars.toLocaleString('bn-BD')}</span> | 
                            SMS: <span className="font-bold text-primary">{smsStats.parts.toLocaleString('bn-BD')}</span> টি
                          </div>
                        </div>
                        <Textarea 
                          placeholder="শ্রেণির জন্য বার্তা লিখুন..." 
                          className="min-h-[150px]"
                          value={messageContent}
                          onChange={e => setMessageContent(e.target.value)}
                        />
                      </div>
                      <Button 
                        className="w-full h-12 text-lg font-bold" 
                        disabled={isLoading || !selectedClass || studentsInClass.length === 0}
                        onClick={() => handleLogAndSimulateMessage('class', studentsInClass.length)}
                      >
                        <Send className="mr-2 h-5 w-5" /> রেকর্ড করুন ও মোবাইল থেকে পাঠান
                      </Button>
                    </TabsContent>

                    {/* Individual Student Tab */}
                    <TabsContent value="individual" className="space-y-4">
                      <div className="space-y-2">
                        <Label className="font-bold">শ্রেণি নির্বাচন করুন</Label>
                        <Select value={selectedClass} onValueChange={c => { setSelectedClass(c); setSelectedStudentIds(new Set()); }}>
                          <SelectTrigger><SelectValue placeholder="শ্রেণি নির্বাচন করুন" /></SelectTrigger>
                          <SelectContent>
                            {['6', '7', '8', '9', '10'].map(c => (
                              <SelectItem key={c} value={c}>{classNamesMap[c]} শ্রেণি</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {selectedClass && (
                        <>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <Label className="font-bold">বার্তার বিষয়বস্তু</Label>
                              <div className="text-xs text-muted-foreground font-semibold">
                                অক্ষর: <span className="font-bold text-primary">{smsStats.chars.toLocaleString('bn-BD')}</span> | 
                                SMS: <span className="font-bold text-primary">{smsStats.parts.toLocaleString('bn-BD')}</span> টি
                              </div>
                            </div>
                            <Textarea 
                              placeholder="নির্বাচিত শিক্ষার্থীদের বার্তা লিখুন..." 
                              className="min-h-[100px]"
                              value={messageContent}
                              onChange={e => setMessageContent(e.target.value)}
                            />
                          </div>

                          <div className="border rounded-md max-h-[350px] overflow-y-auto bg-white">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12">
                                    <Checkbox 
                                      checked={selectedStudentIds.size === studentsInClass.length && studentsInClass.length > 0}
                                      onCheckedChange={handleSelectAll}
                                    />
                                  </TableHead>
                                  <TableHead>রোল</TableHead>
                                  <TableHead>নাম</TableHead>
                                  <TableHead>মোবাইল</TableHead>
                                  <TableHead className="text-right">সরাসরি যোগাযোগ</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {studentsInClass.map(s => (
                                  <TableRow key={s.id} className="cursor-pointer hover:bg-slate-50" onClick={() => handleToggleStudent(s.id)}>
                                    <TableCell onClick={e => e.stopPropagation()}>
                                      <Checkbox 
                                        checked={selectedStudentIds.has(s.id)}
                                        onCheckedChange={() => handleToggleStudent(s.id)}
                                      />
                                    </TableCell>
                                    <TableCell className="font-bold">{s.roll.toLocaleString('bn-BD')}</TableCell>
                                    <TableCell className="font-bold">{s.studentNameBn}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground">{s.guardianMobile || '-'}</TableCell>
                                    <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                      <div className="flex justify-end gap-1">
                                        <Button 
                                          variant="ghost" 
                                          size="icon"
                                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                          onClick={() => handleSendDirectSMS(s.guardianMobile || s.studentMobile || '', messageContent)}
                                          disabled={!s.guardianMobile && !s.studentMobile}
                                          title="SMS পাঠান"
                                        >
                                          <MessageSquareDashed className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="icon"
                                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                          onClick={() => handleSendWhatsApp(s.guardianMobile || s.studentMobile || '', messageContent)}
                                          disabled={!s.guardianMobile && !s.studentMobile}
                                          title="WhatsApp-এ পাঠান"
                                        >
                                          <MessageCircle className="h-4 w-4" />
                                        </Button>
                                        <Button 
                                          variant="ghost" 
                                          size="icon" 
                                          onClick={() => handleMakeCall(s)}
                                          disabled={!s.guardianMobile && !s.studentMobile}
                                          title="কল করুন"
                                        >
                                          <Phone className="h-4 w-4 text-blue-600" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          <Button 
                            className="w-full h-12 text-lg font-bold" 
                            disabled={isLoading || selectedStudentIds.size === 0}
                            onClick={() => handleLogAndSimulateMessage('individual', selectedStudentIds.size)}
                          >
                            <Send className="mr-2 h-5 w-5" /> ({selectedStudentIds.size.toLocaleString('bn-BD')}) জনকে মেসেজ পাঠান
                          </Button>
                        </>
                      )}
                    </TabsContent>

                    {/* Absent Tab */}
                    <TabsContent value="absent" className="space-y-4">
                      <div className="space-y-2">
                        <Label className="font-bold">শ্রেণি নির্বাচন করুন</Label>
                        <div className="flex gap-2">
                          <Select value={selectedClass} onValueChange={setSelectedClass}>
                            <SelectTrigger className="flex-1"><SelectValue placeholder="শ্রেণি নির্বাচন করুন" /></SelectTrigger>
                            <SelectContent>
                              {['6', '7', '8', '9', '10'].map(c => (
                                <SelectItem key={c} value={c}>{classNamesMap[c]} শ্রেণি</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button onClick={fetchAbsentStudents} disabled={!selectedClass || isLoading} className="font-bold">
                            আজকের অনুপস্থিত খোজুন
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label className="font-bold">বার্তার বিষয়বস্তু</Label>
                          <div className="text-xs text-muted-foreground font-semibold">
                            অক্ষর: <span className="font-bold text-primary">{smsStats.chars.toLocaleString('bn-BD')}</span> | 
                            SMS: <span className="font-bold text-primary">{smsStats.parts.toLocaleString('bn-BD')}</span> টি
                          </div>
                        </div>
                        <Textarea 
                          placeholder="অনুপস্থিতির বার্তা লিখুন..." 
                          className="min-h-[100px]"
                          value={messageContent}
                          onChange={e => setMessageContent(e.target.value)}
                        />
                      </div>

                      {selectedStudentIds.size > 0 && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                          <div className="flex items-center gap-2 text-red-900 font-bold">
                            <AlertCircle className="h-5 w-5 text-red-600" />
                            {selectedStudentIds.size.toLocaleString('bn-BD')} জন অনুপস্থিত শিক্ষার্থী পাওয়া গেছে।
                          </div>
                          <Button 
                            variant="destructive"
                            onClick={() => handleLogAndSimulateMessage('absent', selectedStudentIds.size)}
                          >
                            অভিভাবকদের SMS পাঠান
                          </Button>
                        </div>
                      )}
                    </TabsContent>
                  </div>
                </Tabs>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-xl border-2 border-dashed border-red-200">
                      <ShieldAlert className="h-12 w-12 text-red-500 mb-4 opacity-30" />
                      <p className="text-lg font-bold text-red-700">মেসেজ পাঠানোর অনুমতি নেই</p>
                      <p className="text-sm text-muted-foreground mt-2">আপনার অ্যাকাউন্টে 'মেসেজ পাঠানো' পারমিশনটি নেই।</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Message Log History Column */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                  <History className="h-5 w-5 text-primary" /> সাম্প্রতিক মেসেজ লগ
                </CardTitle>
                <CardDescription>প্রেরিত সকল বার্তা ও কলের ইতিহাস</CardDescription>
                
                {/* Search Bar for History */}
                <div className="relative pt-2">
                  <Search className="absolute left-2.5 top-5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="ইতিহাস খুঁজুন..." 
                    className="pl-8 text-xs h-9"
                    value={logSearchQuery}
                    onChange={e => setLogSearchQuery(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[600px] overflow-y-auto">
                {isLoadingLogs ? (
                  <p className="text-center text-sm text-muted-foreground py-8">লোড হচ্ছে...</p>
                ) : filteredLogs.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-8">কোনো মেসেজ লগ পাওয়া যায়নি।</p>
                ) : (
                  filteredLogs.map(log => (
                    <div key={log.id} className="p-3 border rounded-lg bg-white space-y-2 text-xs shadow-sm">
                      <div className="flex justify-between items-start">
                        <Badge variant={log.type === 'call' ? 'outline' : 'secondary'} className="text-[10px]">
                          {log.type === 'call' ? '📞 ফোন কল' : log.type === 'all' ? '📢 সকলকে' : log.type === 'class' ? `🏫 ${classNamesMap[log.className || ''] || ''} শ্রেণি` : '✉️ নির্দিষ্ট'}
                        </Badge>
                        <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
                          <Clock className="h-3 w-3" />
                          {log.sentAt ? format(log.sentAt, 'dd MMM, hh:mm a', { locale: bn }) : '-'}
                        </div>
                      </div>

                      <p className="text-slate-800 font-semibold leading-relaxed line-clamp-3">{log.content}</p>

                      <div className="flex justify-between items-center border-t pt-2 text-[10px] text-muted-foreground">
                        <span>প্রেরক: {log.senderName || 'Admin'}</span>
                        {canManageMessages && (
                          <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500 hover:text-red-700">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>লগ মুছে ফেলতে চান?</AlertDialogTitle>
                              <AlertDialogDescription>এই রেকর্ডটি মুছে ফেলা হবে।</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>বাতিল</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteLog(log.id)}>মুছে ফেলুন</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
}
