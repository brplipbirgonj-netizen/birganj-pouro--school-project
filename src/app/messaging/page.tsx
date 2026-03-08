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
import { MessageSquare, Send, Users, Smartphone, History, Clock, Trash2, Phone, FileText, Check, UserCheck, UserMinus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { logMessage, getMessageLogs, MessageLog, deleteMessageLog, updateMessageNote } from '@/lib/messaging-data';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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
    
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [tempNote, setTempNote] = useState('');

    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

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
        return allStudents.filter(s => s.className === selectedClass).sort((a,b) => a.roll - b.roll);
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

    const handleSendDirectSMS = (mobiles: string | string[], content: string) => {
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
        
        // Android standard is comma, iOS standard is also comma for many apps
        const recipients = cleanNumbers.join(',');
        const encodedContent = encodeURIComponent(content);
        
        // SMS URL scheme varies slightly between Android and iOS for pre-filling body
        const smsUrl = isIOS 
            ? `sms:${recipients}&body=${encodedContent}`
            : `sms:${recipients}?body=${encodedContent}`;

        try {
            window.location.href = smsUrl;
        } catch (e) {
            window.open(smsUrl, '_blank');
        }
    };

    const handleMakeCall = async (student: Student) => {
        const mobile = student.guardianMobile || student.studentMobile || '';
        const cleanNumber = mobile.replace(/[^\d+]/g, '');
        if (!cleanNumber) {
            toast({ variant: 'destructive', title: 'মোবাইল নম্বর নেই' });
            return;
        }

        // Open dialer
        window.location.href = `tel:${cleanNumber}`;

        // Then log the call record in history
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
        if (!messageContent.trim()) {
            toast({ variant: 'destructive', title: 'মেসেজ লিখুন' });
            return;
        }

        setIsLoading(true);
        try {
            // Log to Firestore first
            await logMessage(db, {
                recipientsCount,
                type,
                className: selectedClass || undefined,
                content: messageContent,
                senderUid: user.uid,
                senderName: user.displayName || user.email || 'Admin'
            });

            toast({ title: 'মেসেজ রেকর্ড করা হয়েছে', description: `মোট ${recipientsCount.toLocaleString('bn-BD')} জন শিক্ষার্থীর জন্য লগ তৈরি করা হয়েছে।` });
            
            // If it's targeted, fire the SMS intent
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
            // Error is handled by global listener or shown here
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
        try {
            await deleteMessageLog(db, id);
            toast({ title: 'লগ মুছে ফেলা হয়েছে' });
            fetchLogs();
        } catch (e) {
            // Error handled by FirebaseErrorListener
        }
    };

    const handleSaveNote = async (id: string, customNote?: string) => {
        if (!db || !user) return;
        const noteToSave = customNote !== undefined ? customNote : tempNote;
        try {
            await updateMessageNote(db, id, noteToSave);
            toast({ title: 'তথ্য সংরক্ষিত হয়েছে' });
            setEditingNoteId(null);
            fetchLogs();
        } catch (e) {
            toast({ variant: 'destructive', title: 'তথ্য সেভ করা যায়নি' });
        }
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

    if (!isClient) return null;

    return (
        <div className="flex min-h-screen w-full flex-col bg-lime-50">
            <Header />
            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-80">
                <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                    <Card className="md:col-span-2 lg:col-span-3">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                                <MessageSquare className="h-6 w-6 text-primary" /> মেসেজ সেন্টার
                            </CardTitle>
                            <CardDescription>শিক্ষার্থী ও অভিভাবকদের কাছে সরাসরি মেসেজ পাঠান বা কল করুন</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="bulk" onValueChange={handleTabChange}>
                                <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="bulk">সকলকে</TabsTrigger>
                                    <TabsTrigger value="class">শ্রেণিভিত্তিক</TabsTrigger>
                                    <TabsTrigger value="individual">একক</TabsTrigger>
                                    <TabsTrigger value="absent">অনুপস্থিত</TabsTrigger>
                                </TabsList>

                                <div className="mt-6 space-y-6">
                                    <TabsContent value="bulk" className="space-y-4">
                                        <div className="p-4 bg-lime-100 border border-lime-200 rounded-lg flex items-center gap-4">
                                            <Users className="h-10 w-10 text-lime-700" />
                                            <div>
                                                <p className="font-bold text-lime-900">সকল শিক্ষার্থী</p>
                                                <p className="text-sm text-lime-700">পুরো স্কুলের {allStudents.length.toLocaleString('bn-BD')} জন শিক্ষার্থীর জন্য লগ তৈরি হবে।</p>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>বার্তার বিষয়বস্তু</Label>
                                            <Textarea 
                                                placeholder="আপনার বার্তা এখানে লিখুন..." 
                                                className="min-h-[150px]"
                                                value={messageContent}
                                                onChange={e => setMessageContent(e.target.value)}
                                            />
                                        </div>
                                        <Button 
                                            className="w-full h-12 text-lg" 
                                            disabled={isLoading || allStudents.length === 0}
                                            onClick={() => handleLogAndSimulateMessage('all', allStudents.length)}
                                        >
                                            <Send className="mr-2 h-5 w-5" /> রেকর্ড করুন
                                        </Button>
                                    </TabsContent>

                                    <TabsContent value="class" className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>শ্রেণি নির্বাচন করুন</Label>
                                            <Select value={selectedClass} onValueChange={setSelectedClass}>
                                                <SelectTrigger><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
                                                <SelectContent>
                                                    {['6', '7', '8', '9', '10'].map(c => (
                                                        <SelectItem key={c} value={c}>{classNamesMap[c]} শ্রেণি</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>বার্তার বিষয়বস্তু</Label>
                                            <Textarea 
                                                placeholder="শ্রেণির জন্য বার্তা লিখুন..." 
                                                className="min-h-[150px]"
                                                value={messageContent}
                                                onChange={e => setMessageContent(e.target.value)}
                                            />
                                        </div>
                                        <Button 
                                            className="w-full h-12 text-lg" 
                                            disabled={isLoading || !selectedClass || studentsInClass.length === 0}
                                            onClick={() => handleLogAndSimulateMessage('class', studentsInClass.length)}
                                        >
                                            <Send className="mr-2 h-5 w-5" /> রেকর্ড করুন ও মোবাইল থেকে পাঠান
                                        </Button>
                                    </TabsContent>

                                    <TabsContent value="individual" className="space-y-4">
                                        <div className="space-y-2">
                                            <Label>শ্রেণি নির্বাচন করুন</Label>
                                            <Select value={selectedClass} onValueChange={c => { setSelectedClass(c); setSelectedStudentIds(new Set()); }}>
                                                <SelectTrigger><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
                                                <SelectContent>
                                                    {['6', '7', '8', '9', '10'].map(c => (
                                                        <SelectItem key={c} value={c}>{classNamesMap[c]} শ্রেণি</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {selectedClass && (
                                            <div className="border rounded-md max-h-[300px] overflow-y-auto">
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
                                                            <TableHead className="text-right">একশন</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {studentsInClass.map(s => (
                                                            <TableRow key={s.id} className="cursor-pointer" onClick={() => handleToggleStudent(s.id)}>
                                                                <TableCell onClick={e => e.stopPropagation()}>
                                                                    <Checkbox 
                                                                        checked={selectedStudentIds.has(s.id)}
                                                                        onCheckedChange={() => handleToggleStudent(s.id)}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>{s.roll.toLocaleString('bn-BD')}</TableCell>
                                                                <TableCell>{s.studentNameBn}</TableCell>
                                                                <TableCell className="text-xs text-muted-foreground">{s.guardianMobile || '-'}</TableCell>
                                                                <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                                                    <div className="flex justify-end gap-2">
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            onClick={() => handleMakeCall(s)}
                                                                            disabled={!s.guardianMobile && !s.studentMobile}
                                                                            title="কল করুন"
                                                                        >
                                                                            <Phone className="h-4 w-4 text-green-600" />
                                                                        </Button>
                                                                        <Button 
                                                                            variant="ghost" 
                                                                            size="icon" 
                                                                            onClick={() => handleSendDirectSMS(s.guardianMobile || s.studentMobile || '', messageContent)}
                                                                            disabled={!messageContent.trim() || (!s.guardianMobile && !s.studentMobile)}
                                                                            title="মেসেজ পাঠান"
                                                                        >
                                                                            <Smartphone className="h-4 w-4 text-blue-600" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <Label>বার্তার বিষয়বস্তু</Label>
                                            <Textarea 
                                                placeholder="ব্যক্তিগত বার্তা লিখুন..." 
                                                value={messageContent}
                                                onChange={e => setMessageContent(e.target.value)}
                                            />
                                        </div>
                                        <Button 
                                            className="w-full h-12 text-lg" 
                                            disabled={isLoading || selectedStudentIds.size === 0}
                                            onClick={() => handleLogAndSimulateMessage('individual', selectedStudentIds.size)}
                                        >
                                            <Send className="mr-2 h-5 w-5" /> মোবাইল থেকে পাঠান {selectedStudentIds.size > 0 && `(${selectedStudentIds.size.toLocaleString('bn-BD')} জন)`}
                                        </Button>
                                    </TabsContent>

                                    <TabsContent value="absent" className="space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                                            <div className="space-y-2">
                                                <Label>শ্রেণি</Label>
                                                <Select value={selectedClass} onValueChange={setSelectedClass}>
                                                    <SelectTrigger><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger>
                                                    <SelectContent>
                                                        {['6', '7', '8', '9', '10'].map(c => (
                                                            <SelectItem key={c} value={c}>{classNamesMap[c]} শ্রেণি</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button variant="outline" onClick={fetchAbsentStudents} disabled={!selectedClass || isLoading} className="h-10">
                                                আজকের অনুপস্থিত শিক্ষার্থী খুঁজুন
                                            </Button>
                                        </div>
                                        {selectedStudentIds.size > 0 && (
                                            <div className="border rounded-md max-h-[250px] overflow-y-auto">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>রোল</TableHead>
                                                            <TableHead>নাম</TableHead>
                                                            <TableHead>মোবাইল</TableHead>
                                                            <TableHead className="text-right">একশন</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {studentsInClass.filter(s => selectedStudentIds.has(s.id)).map(s => (
                                                            <TableRow key={s.id}>
                                                                <TableCell>{s.roll.toLocaleString('bn-BD')}</TableCell>
                                                                <TableCell>{s.studentNameBn}</TableCell>
                                                                <TableCell className="text-xs">{s.guardianMobile || '-'}</TableCell>
                                                                <TableCell className="text-right">
                                                                    <div className="flex justify-end gap-2">
                                                                        <Button 
                                                                            variant="outline" 
                                                                            size="sm" 
                                                                            className="h-7 px-2 text-[10px]"
                                                                            onClick={() => handleMakeCall(s)}
                                                                            disabled={!s.guardianMobile && !s.studentMobile}
                                                                        >
                                                                            <Phone className="h-3 w-3 mr-1" /> কল করুন
                                                                        </Button>
                                                                        <Button 
                                                                            variant="outline" 
                                                                            size="sm" 
                                                                            className="h-7 px-2 text-[10px]"
                                                                            onClick={() => handleSendDirectSMS(s.guardianMobile || s.studentMobile || '', messageContent)}
                                                                            disabled={!messageContent.trim() || (!s.guardianMobile && !s.studentMobile)}
                                                                        >
                                                                            <Smartphone className="h-3 w-3 mr-1" /> এসএমএস
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <Label>সতর্কবার্তা</Label>
                                            <Textarea 
                                                placeholder="সম্মানিত অভিভাবক, আপনার সন্তান আজ বিদ্যালয়ে অনুপস্থিত আছে। বিপৌউবি" 
                                                value={messageContent}
                                                onChange={e => setMessageContent(e.target.value)}
                                            />
                                        </div>
                                        <Button 
                                            className="w-full h-12 text-lg" 
                                            variant="destructive"
                                            disabled={isLoading || selectedStudentIds.size === 0}
                                            onClick={() => handleLogAndSimulateMessage('absent', selectedStudentIds.size)}
                                        >
                                            <Send className="mr-2 h-5 w-5" /> মোবাইল থেকে পাঠান (অনুপস্থিত {selectedStudentIds.size.toLocaleString('bn-BD')} জন)
                                        </Button>
                                    </TabsContent>
                                </div>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <Card className="md:col-span-1 lg:col-span-1 border-primary/20 shadow-lg">
                        <CardHeader className="bg-primary/5 rounded-t-lg">
                            <CardTitle className="flex items-center gap-2 text-lg font-bold">
                                <History className="h-5 w-5 text-primary" /> মেসেজ ও কল হিস্ট্রি
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="max-h-[650px] overflow-y-auto">
                                {isLoadingLogs ? (
                                    <div className="p-4 space-y-4">
                                        <Skeleton className="h-20 w-full" />
                                        <Skeleton className="h-20 w-full" />
                                        <Skeleton className="h-20 w-full" />
                                    </div>
                                ) : messageLogs.length === 0 ? (
                                    <p className="p-8 text-center text-sm text-muted-foreground italic">এখনও কোনো রেকর্ড নেই।</p>
                                ) : (
                                    <div className="divide-y">
                                        {messageLogs.map(log => (
                                            <div key={log.id} className="p-4 hover:bg-primary/5 transition-colors relative group">
                                                <div className="flex justify-between items-start mb-2">
                                                    <Badge 
                                                        variant={log.type === 'call' ? 'outline' : 'secondary'} 
                                                        className={cn(
                                                            "text-[10px] py-0 px-2 h-5",
                                                            log.type === 'call' && "border-green-500 text-green-700 bg-green-50"
                                                        )}
                                                    >
                                                        {log.type === 'all' ? 'সকল' : log.type === 'class' ? 'শ্রেণি' : log.type === 'individual' ? 'একক' : log.type === 'absent' ? 'অনুপস্থিত' : 'কল'}
                                                    </Badge>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-muted-foreground flex items-center bg-muted px-1.5 py-0.5 rounded">
                                                            <Clock className="h-3 w-3 mr-1" />
                                                            {format(log.sentAt, 'PPp', { locale: bn })}
                                                        </span>
                                                        {user?.role === 'admin' && (
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Trash2 className="h-3.5 w-3.5" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            এই রেকর্ডটি স্থায়ীভাবে মুছে ফেলা হবে।
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteLog(log.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">মুছে ফেলুন</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-sm font-medium line-clamp-3 mb-2 text-foreground">{log.content}</p>
                                                
                                                {/* Display and Edit Notes (For Manual Duration/Outcome) */}
                                                <div className="bg-muted/50 rounded-md p-2 mb-2 text-[11px] border border-dashed">
                                                    {editingNoteId === log.id ? (
                                                        <div className="space-y-2">
                                                            <div className="flex gap-1">
                                                                <Input 
                                                                    value={tempNote} 
                                                                    onChange={e => setTempNote(e.target.value)} 
                                                                    className="h-7 text-[11px] py-0"
                                                                    placeholder="কথোপকথনের তথ্য (উদা: ২ মিনিট)"
                                                                    autoFocus
                                                                />
                                                                <Button size="icon" className="h-7 w-7" onClick={() => handleSaveNote(log.id)}><Check className="h-3 w-3" /></Button>
                                                            </div>
                                                            {log.type === 'call' && (
                                                                <div className="flex gap-2">
                                                                    <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1 bg-green-50 hover:bg-green-100 border-green-200" onClick={() => handleSaveNote(log.id, 'কথা হয়েছে')}>
                                                                        <UserCheck className="h-3 w-3 mr-1 text-green-600" /> কথা হয়েছে
                                                                    </Button>
                                                                    <Button variant="outline" size="sm" className="h-6 text-[10px] flex-1 bg-red-50 hover:bg-red-100 border-red-200" onClick={() => handleSaveNote(log.id, 'কথা হয় নাই')}>
                                                                        <UserMinus className="h-3 w-3 mr-1 text-red-600" /> কথা হয় নাই
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-between items-center group/note">
                                                            <div className="flex items-center gap-2">
                                                                {log.notes === 'কথা হয়েছে' ? (
                                                                    <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 py-0 h-5 text-[10px]"><UserCheck className="h-2.5 w-2.5 mr-1" /> কথা হয়েছে</Badge>
                                                                ) : log.notes === 'কথা হয় নাই' ? (
                                                                    <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 py-0 h-5 text-[10px]"><UserMinus className="h-2.5 w-2.5 mr-1" /> কথা হয় নাই</Badge>
                                                                ) : (
                                                                    <span className="italic">{log.notes || 'কোনো নোট নেই'}</span>
                                                                )}
                                                            </div>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-5 w-5 opacity-0 group-hover/note:opacity-100" 
                                                                onClick={() => { setEditingNoteId(log.id); setTempNote(log.notes || ''); }}
                                                            >
                                                                <FileText className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex justify-between text-[10px] font-semibold text-muted-foreground pt-2 border-t border-dashed">
                                                    <span>{log.type === 'call' ? 'কল রেকর্ড' : `প্রাপক: ${log.recipientsCount.toLocaleString('bn-BD')} জন`}</span>
                                                    <span>প্রেরক: {log.senderName}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
