
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deleteStaff, Staff, staffFromDoc } from '@/lib/staff-data';
import { 
    Eye, FilePen, Trash2, Clock, Calendar, Briefcase, Check, X, Search, 
    Loader2, List, ClipboardCheck, FileBarChart, ChevronRight, Plus, 
    Printer, Save, RotateCcw, Edit2, CheckCircle2, UserX 
} from 'lucide-react';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy, FirestoreError, getDocs, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isAfter } from 'date-fns';
import { bn } from 'date-fns/locale';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StaffDailyAttendance, StaffMemberAttendance, getStaffAttendanceByDate, saveStaffAttendance, getStaffAttendanceForRange, LeaveType } from '@/lib/staff-attendance-data';
import { cn } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { getHolidays } from '@/lib/holiday-data';

const LEAVE_TYPES: { id: LeaveType; label: string; color: string }[] = [
    { id: 'CL', label: 'নৈমিত্তিক (CL)', color: 'bg-blue-100 text-blue-700' },
    { id: 'SL', label: 'অসুস্থতা (SL)', color: 'bg-rose-100 text-rose-700' },
    { id: 'EL', label: 'অর্জিত (EL)', color: 'bg-emerald-100 text-emerald-700' },
    { id: 'DL', label: 'দায়িত্বকালীন (DL)', color: 'bg-amber-100 text-amber-700' },
    { id: 'Other', label: 'অন্যান্য', color: 'bg-slate-100 text-slate-700' },
];

const BENGALI_MONTHS = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const TEACHER_ORDER = [
    'আনিছুর রহমান',
    'নীলা রায়',
    'জান্নাতুন',
    'যুধিষ্ঠির চন্দ্র রায়',
    'ধনঞ্জয় কুমার রায়',
    'মো: আরিফুর রহমান',
    'মোছা: ওবায়দা আক্তার',
    'সারমিন আক্তার',
    'মোছা: শান্তি আরা',
    'মো :মাহাবুর রহমান'
];

const STAFF_ORDER = [
    'মো: আবুল কালাম',
    'মো: রাকিবুল ইসলাম',
    'মোছা: নুর নেহার বেগম'
];

function toBengaliNumber(str: string | number) {
  if (!str && str !== 0) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
}

export default function StaffListPage() {
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [staffToView, setStaffToView] = useState<Staff | null>(null);
  const db = useFirestore();
  const [isClient, setIsClient] = useState(false);
  const { user, hasPermission } = useAuth();
  const { schoolInfo } = useSchoolInfo();
  
  const canManageStaff = hasPermission('manage:staff');
  const canManageAttendance = hasPermission('manage:staff-attendance');
  const canViewAttendanceReport = hasPermission('view:staff-attendance-report');

  const [activeSection, setActiveSection] = useState('list');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dailyAttendance, setDailyAttendance] = useState<StaffDailyAttendance | null>(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);
  
  const [staffSteps, setAttendanceSteps] = useState<Record<string, number>>({});
  const [editStates, setEditStates] = useState<Record<string, boolean>>({});

  const [reportMonth, setReportMonth] = useState(new Date().getMonth().toString());
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());
  const [rangeRecords, setRangeRecords] = useState<StaffDailyAttendance[]>([]);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [holidays, setHolidays] = useState<string[]>([]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!db || !user) return;
    setIsLoading(true);

    const staffQuery = query(collection(db, "staff"), orderBy("nameBn", "asc"));

    const unsubscribe = onSnapshot(staffQuery, (querySnapshot) => {
      const staffData = querySnapshot.docs.map(staffFromDoc);
      setAllStaff(staffData);
      setIsLoading(false);
    }, (error: FirestoreError) => {
      if (error.code === 'permission-denied') return;
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'staff', operation: 'list' }));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, user]);

  const fetchAttendance = useCallback(async () => {
    if (!db || !selectedDate) return;
    setIsAttendanceLoading(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const record = await getStaffAttendanceByDate(db, dateStr);
    setDailyAttendance(record || { date: dateStr, attendance: [] });
    setAttendanceSteps({});
    setEditStates({});
    setIsAttendanceLoading(false);
  }, [db, selectedDate]);

  useEffect(() => {
    if (canManageAttendance && activeSection === 'attendance') {
        fetchAttendance();
    }
  }, [fetchAttendance, canManageAttendance, activeSection]);

  const handleStatusSelect = (staffId: string, status: 'present' | 'leave') => {
    setDailyAttendance(prev => {
        if (!prev) return null;
        const nextAtt = [...prev.attendance];
        const idx = nextAtt.findIndex(a => a.staffId === staffId);
        if (idx > -1) {
            nextAtt[idx] = { ...nextAtt[idx], status };
        } else {
            nextAtt.push({ staffId, status });
        }
        return { ...prev, attendance: nextAtt };
    });
    setAttendanceSteps(prev => ({ ...prev, [staffId]: 1 }));
  };

  const handleSaveStatus = (staffId: string) => {
    setAttendanceSteps(prev => ({ ...prev, [staffId]: 2 }));
  };

  const handleAttendanceDetailChange = (staffId: string, field: keyof StaffMemberAttendance, value: string) => {
    setDailyAttendance(prev => {
        if (!prev) return null;
        const nextAtt = [...prev.attendance];
        const idx = nextAtt.findIndex(a => a.staffId === staffId);
        if (idx > -1) {
            nextAtt[idx] = { ...nextAtt[idx], [field]: value };
        }
        return { ...prev, attendance: nextAtt };
    });
  };

  const handleLocalEntrySave = (staffId: string) => {
      setAttendanceSteps(prev => ({ ...prev, [staffId]: 3 }));
      setEditStates(prev => ({ ...prev, [staffId]: false }));
      toast({ title: 'এন্ট্রি গ্রহণ করা হয়েছে', description: 'নিচ থেকে ফাইনাল সেভ করুন।' });
  };

  const handleGlobalFinalSave = async () => {
    if (!db || !dailyAttendance) return;
    setIsAttendanceLoading(true);
    try {
        await saveStaffAttendance(db, dailyAttendance);
        toast({ title: 'পুরো দিনের হাজিরা সফলভাবে সংরক্ষিত হয়েছে' });
        fetchAttendance();
    } catch (e) {}
    setIsAttendanceLoading(false);
  };

  const handleDeleteAttendance = async (staffId: string) => {
      if (!db || !dailyAttendance) return;
      try {
          const nextAtt = dailyAttendance.attendance.filter(a => a.staffId !== staffId);
          const updatedRecord = { ...dailyAttendance, attendance: nextAtt };
          setDailyAttendance(updatedRecord);
          setAttendanceSteps(prev => ({ ...prev, [staffId]: 0 }));
          setEditStates(prev => ({ ...prev, [staffId]: false }));
          toast({ title: 'হাজিরা বাটন থেকে সরানো হয়েছে', description: 'ফাইনাল সেভ দিতে ভুলবেন না।' });
      } catch (e) {}
  };

  const fetchReport = useCallback(async () => {
    if (!db) return;
    setIsReportLoading(true);
    try {
        const start = format(startOfMonth(new Date(parseInt(reportYear), parseInt(reportMonth))), 'yyyy-MM-dd');
        const end = format(endOfMonth(new Date(parseInt(reportYear), parseInt(reportMonth))), 'yyyy-MM-dd');
        const [records, holidayList] = await Promise.all([
            getStaffAttendanceForRange(db, start, end),
            getHolidays(db)
        ]);
        setRangeRecords(records);
        setHolidays(holidayList.map(h => h.date));
    } catch (e) {}
    setIsReportLoading(false);
  }, [db, reportMonth, reportYear]);

  const sortedTeachers = useMemo(() => {
      return allStaff
        .filter(s => s.staffType === 'teacher')
        .sort((a, b) => {
            const indexA = TEACHER_ORDER.findIndex(name => a.nameBn.trim().includes(name.trim()) || name.trim().includes(a.nameBn.trim()));
            const indexB = TEACHER_ORDER.findIndex(name => b.nameBn.trim().includes(name.trim()) || name.trim().includes(b.nameBn.trim()));
            if (indexA === -1 && indexB === -1) return a.nameBn.localeCompare(b.nameBn, 'bn');
            if (indexA === -1) return 1;
            if (indexB === -1) return -1;
            return indexA - indexB;
        });
  }, [allStaff]);

  const sortedEmployees = useMemo(() => {
    return allStaff
      .filter(s => s.staffType === 'staff')
      .sort((a, b) => {
          const indexA = STAFF_ORDER.findIndex(name => a.nameBn.trim().includes(name.trim()) || name.trim().includes(a.nameBn.trim()));
          const indexB = STAFF_ORDER.findIndex(name => b.nameBn.trim().includes(name.trim()) || name.trim().includes(b.nameBn.trim()));
          if (indexA === -1 && indexB === -1) return a.nameBn.localeCompare(b.nameBn, 'bn');
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
      });
  }, [allStaff]);

  const sidebarItems = useMemo(() => {
      const items = [
          { id: 'list', label: 'স্টাফ তালিকা', icon: List, color: 'text-orange-600 bg-orange-50' }
      ];
      if (canManageAttendance) {
          items.push({ id: 'attendance', label: 'দৈনিক হাজিরা ও ছুটি', icon: ClipboardCheck, color: 'text-emerald-600 bg-emerald-50' });
      }
      if (canViewAttendanceReport) {
          items.push({ id: 'report', label: 'ছুটির রিপোর্ট', icon: FileBarChart, color: 'text-blue-600 bg-blue-50' });
      }
      return items;
  }, [canManageAttendance, canViewAttendanceReport]);

  const StaffTable = ({ data, startIdx = 0, colorClass }: { data: Staff[], startIdx?: number, colorClass: string }) => (
    <div className="table-container mb-8">
        <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-20">
            <TableRow>
                <TableHead className="w-16">ক্রমিক</TableHead>
                <TableHead className="w-16">ছবি</TableHead>
                <TableHead>নাম</TableHead>
                <TableHead>পদবি</TableHead>
                <TableHead>মোবাইল</TableHead>
                <TableHead className="text-right">কার্যক্রম</TableHead>
            </TableRow>
            </TableHeader>
            <TableBody>
            {data.map((staff, index) => (
                <TableRow key={staff.id} className="hover:bg-muted/10 h-14">
                    <TableCell className="font-bold">{toBengaliNumber(startIdx + index + 1)}</TableCell>
                    <TableCell>
                        <Image src={staff.photoUrl || 'https://picsum.photos/seed/staff/40/40'} alt={staff.nameBn} width={40} height={40} className="rounded-full object-cover border" />
                    </TableCell>
                    <TableCell className={cn("whitespace-nowrap font-black text-base", colorClass)}>{staff.nameBn}</TableCell>
                    <TableCell className="whitespace-nowrap font-bold text-xs">{staff.designation}</TableCell>
                    <TableCell className="text-xs font-bold">{toBengaliNumber(staff.mobile)}</TableCell>
                    <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setStaffToView(staff)} title="দেখুন"><Eye className="h-4 w-4" /></Button>
                            {canManageStaff && (
                                <>
                                    <Link href={`/edit-staff/${staff.id}`}><Button variant="outline" size="icon" className="h-8 w-8 text-blue-600" title="এডিট"><FilePen className="h-4 w-4" /></Button></Link>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" title="মুছুন"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                        <AlertDialogContent className="font-kalpurush">
                                            <AlertDialogHeader><AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle><AlertDialogDescription>এটি স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel className="font-bold">বাতিল</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => deleteStaff(db!, staff.id)} className="bg-destructive hover:bg-destructive/90 font-black">মুছে ফেলুন</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </>
                            )}
                        </div>
                    </TableCell>
                </TableRow>
            ))}
            </TableBody>
        </Table>
    </div>
  );

  const reportPages = useMemo(() => {
      const activeTeachers = [...sortedTeachers, ...sortedEmployees].filter(s => s.isActive);
      const chunks = [];
      for (let i = 0; i < activeTeachers.length; i += 3) {
          chunks.push(activeTeachers.slice(i, i + 3));
      }
      
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      const monthStart = startOfMonth(new Date(parseInt(reportYear), parseInt(reportMonth)));
      const monthEnd = endOfMonth(monthStart);
      const allDaysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
      
      const days = allDaysInMonth.filter(day => !isAfter(day, today));
      
      return chunks.map(chunk => ({ teachers: chunk, days }));
  }, [sortedTeachers, sortedEmployees, reportMonth, reportYear]);

  if (!isClient) return null;

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F6F7F9] font-kalpurush">
      <Header />
      <main className="flex-1 flex flex-col md:flex-row h-full max-w-[1600px] mx-auto w-full md:p-6 lg:p-10 gap-8 pb-[500px]">
        
        <aside className="w-full md:w-60 shrink-0 space-y-1 no-print bg-white md:bg-transparent p-4 md:p-0 border-b md:border-0 sticky top-20 md:top-28 self-start">
            <h2 className="text-2xl font-black mb-6 px-4 hidden md:block text-slate-900 tracking-tight">স্টাফ পোর্টাল</h2>
            <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-1 scrollbar-none">
                {sidebarItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
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

        <div className="flex-1 min-w-0 bg-white md:rounded-[32px] shadow-2xl md:border-[1px] border-slate-200/50 overflow-hidden min-h-[700px] flex flex-col transition-all duration-500 animate-in fade-in slide-in-from-right-4">
            <div className="p-4 sm:p-6 lg:p-8 flex-1">
                <div className="mb-6 border-b pb-4 flex justify-between items-center no-print">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">{sidebarItems.find(i => i.id === activeSection)?.label}</h2>
                        <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">বীরগঞ্জ পৌর উচ্চ বিদ্যালয়</p>
                    </div>
                    {activeSection === 'list' && canManageStaff && (
                        <Link href="/add-staff">
                            <Button className="font-black h-10 px-6 shadow-md"><Plus className="mr-2 h-4 w-4" /> নতুন স্টাফ</Button>
                        </Link>
                    )}
                </div>

                {activeSection === 'list' && (
                    <div className="space-y-8 animate-in fade-in duration-500 no-print">
                        <section>
                            <div className="flex items-center gap-2 mb-4 px-2">
                                <div className="h-6 w-1.5 bg-orange-500 rounded-full" />
                                <h3 className="text-lg font-black text-orange-950">| শিক্ষকবৃন্দের তালিকা ({toBengaliNumber(sortedTeachers.length)} জন)</h3>
                            </div>
                            <StaffTable data={sortedTeachers} colorClass="text-blue-700" />
                        </section>
                        <section>
                            <div className="flex items-center gap-2 mb-4 px-2">
                                <div className="h-6 w-1.5 bg-blue-500 rounded-full" />
                                <h3 className="text-lg font-black text-blue-950">| কর্মচারীবৃন্দের তালিকা ({toBengaliNumber(sortedEmployees.length)} জন)</h3>
                            </div>
                            <StaffTable data={sortedEmployees} colorClass="text-primary" />
                        </section>
                    </div>
                )}

                {activeSection === 'attendance' && (
                    <div className="space-y-6 animate-in fade-in duration-500 no-print">
                        <div className="flex flex-col sm:flex-row gap-4 p-6 border-2 border-orange-100 rounded-xl bg-white shadow-sm items-center">
                            <div className="space-y-2 flex-1 w-full">
                                <Label className="font-black text-primary flex items-center gap-2"><Calendar className="h-4 w-4" /> তারিখ নির্বাচন</Label>
                                <DatePicker value={selectedDate} onChange={setSelectedDate} />
                            </div>
                            <div className="flex-1 text-center sm:text-left">
                                <p className="text-lg font-black text-muted-foreground italic">
                                    {selectedDate ? format(selectedDate, 'EEEE, d MMMM yyyy', { locale: bn }) : ''}
                                </p>
                            </div>
                        </div>

                        <div className="table-container">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead className="font-black">নাম ও পদবি</TableHead>
                                        <TableHead className="text-center font-black">হাজিরা কার্যক্রম</TableHead>
                                        <TableHead className="text-right font-black">অবস্থা</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[...sortedTeachers, ...sortedEmployees].filter(s => s.isActive).map(staff => {
                                        const att = dailyAttendance?.attendance.find(a => a.staffId === staff.id);
                                        const step = staffSteps[staff.id] || (att ? 3 : 0);
                                        const isEditing = editStates[staff.id];
                                        const currentStep = isEditing ? 0 : step;

                                        return (
                                            <TableRow key={staff.id} className="h-28">
                                                <TableCell>
                                                    <div className="font-black text-sm text-slate-800">{staff.nameBn}</div>
                                                    <div className="text-[10px] font-bold text-muted-foreground italic">{staff.designation}</div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex flex-col gap-3 items-center justify-center">
                                                        {currentStep === 0 && (
                                                            <div className="flex gap-2">
                                                                <Button size="sm" className="h-10 px-6 font-black bg-emerald-600 hover:bg-emerald-700" onClick={() => handleStatusSelect(staff.id, 'present')}>উপস্থিত</Button>
                                                                <Button size="sm" className="h-10 px-6 font-black bg-rose-600 hover:bg-rose-700" onClick={() => handleStatusSelect(staff.id, 'leave')}>ছুটি</Button>
                                                            </div>
                                                        )}
                                                        {currentStep === 1 && (
                                                            <div className="flex flex-col items-center gap-2">
                                                                <Badge className={cn("px-4 py-1 font-black shadow-sm", att?.status === 'present' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                                                                    {att?.status === 'present' ? 'উপস্থিতি সিলেক্টেড' : 'ছুটি সিলেক্টেড'}
                                                                </Badge>
                                                                <Button size="sm" variant="outline" className="h-9 px-8 font-black border-2 border-primary text-primary" onClick={() => handleSaveStatus(staff.id)}>সেভ করুন</Button>
                                                            </div>
                                                        )}
                                                        {currentStep === 2 && (
                                                            <div className="flex flex-col gap-3 w-full max-w-[250px] bg-slate-50 p-3 rounded-lg border-2 border-dashed border-primary/20">
                                                                {att?.status === 'present' ? (
                                                                    <div className="space-y-2 text-left">
                                                                        <Label className="text-[10px] font-black text-primary block">আগমনের সময় (উদা: ১০:৩০ AM)</Label>
                                                                        <div className="flex gap-1">
                                                                            <Input 
                                                                                type="text" 
                                                                                placeholder="১০:৩০" 
                                                                                className="h-8 text-xs font-bold text-center" 
                                                                                value={att?.checkIn?.replace(/\s?(AM|PM)/i, '') || ''} 
                                                                                onChange={e => handleAttendanceDetailChange(staff.id, 'checkIn', `${e.target.value} ${att?.checkIn?.slice(-2) || 'AM'}`)} 
                                                                                onKeyDown={e => e.key === 'Enter' && handleLocalEntrySave(staff.id)}
                                                                            />
                                                                            <Select value={att?.checkIn?.slice(-2) === 'PM' ? 'PM' : 'AM'} onValueChange={v => {
                                                                                const current = att?.checkIn?.replace(/\s?(AM|PM)/i, '') || '';
                                                                                handleAttendanceDetailChange(staff.id, 'checkIn', `${current} ${v}`);
                                                                            }}>
                                                                                <SelectTrigger className="h-8 w-16 text-[10px] font-black"><SelectValue /></SelectTrigger>
                                                                                <SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-2 text-left">
                                                                        <Label className="text-[10px] font-black text-rose-700 block">ছুটির ধরন</Label>
                                                                        <Select value={att?.leaveType || ""} onValueChange={val => handleAttendanceDetailChange(staff.id, 'leaveType', val as LeaveType)}>
                                                                            <SelectTrigger className="h-8 text-[10px] font-bold"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                                                                            <SelectContent>{LEAVE_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                )}
                                                                <Button size="sm" className="w-full h-8 font-black shadow-md bg-primary text-white" onClick={() => handleLocalEntrySave(staff.id)}>নিশ্চিত করুন</Button>
                                                            </div>
                                                        )}
                                                        {currentStep === 3 && (
                                                            <div className="flex flex-col gap-2 w-full max-w-[250px] bg-slate-50 p-3 rounded-lg border-2 border-dashed border-primary/20">
                                                                {att?.status === 'present' && (
                                                                    <div className="space-y-2 text-left">
                                                                         <Label className="text-[10px] font-black text-emerald-700 block">প্রস্থানের সময় (উদা: ০৪:০০ PM)</Label>
                                                                         <div className="flex gap-1">
                                                                            <Input 
                                                                                type="text" 
                                                                                placeholder="০৪:০০" 
                                                                                className="h-8 text-xs font-bold text-center" 
                                                                                value={att?.checkOut?.replace(/\s?(AM|PM)/i, '') || ''} 
                                                                                onChange={e => handleAttendanceDetailChange(staff.id, 'checkOut', `${e.target.value} ${att?.checkOut?.slice(-2) || 'PM'}`)} 
                                                                                onKeyDown={e => e.key === 'Enter' && handleLocalEntrySave(staff.id)}
                                                                            />
                                                                            <Select value={att?.checkOut?.slice(-2) === 'AM' ? 'AM' : 'PM'} onValueChange={v => {
                                                                                const current = att?.checkOut?.replace(/\s?(AM|PM)/i, '') || '';
                                                                                handleAttendanceDetailChange(staff.id, 'checkOut', `${current} ${v}`);
                                                                            }}>
                                                                                <SelectTrigger className="h-8 w-16 text-[10px] font-black"><SelectValue /></SelectTrigger>
                                                                                <SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent>
                                                                            </Select>
                                                                            <Button size="sm" className="h-8 w-8 p-0 bg-emerald-600 shrink-0" onClick={() => handleLocalEntrySave(staff.id)} title="প্রস্থান সেভ"><Save className="h-3.5 w-3.5 text-white" /></Button>
                                                                         </div>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-center gap-2 mt-1 border-t pt-2 border-slate-200">
                                                                    <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold text-blue-600 border-blue-200" onClick={() => { setAttendanceSteps(prev => ({ ...prev, [staff.id]: 0 })); setEditStates(prev => ({ ...prev, [staff.id]: true })); }}><Edit2 className="h-3 w-3 mr-1" /> এডিট</Button>
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild>
                                                                            <Button variant="outline" size="sm" className="h-7 text-[9px] font-bold text-rose-600 border-rose-200"><Trash2 className="h-3 w-3 mr-1" /> ডিলিট</Button>
                                                                        </AlertDialogTrigger>
                                                                        <AlertDialogContent className="font-kalpurush">
                                                                            <AlertDialogHeader><AlertDialogTitle>হাজিরা মুছুন</AlertDialogTitle><AlertDialogDescription>আপনি কি নিশ্চিতভাবে এই শিক্ষকের আজকের হাজিরা সরাতে চান? (ফাইনাল সেভ দিতে হবে)</AlertDialogDescription></AlertDialogHeader>
                                                                            <AlertDialogFooter>
                                                                                <AlertDialogCancel>না</AlertDialogCancel>
                                                                                <AlertDialogAction onClick={() => handleDeleteAttendance(staff.id)} className="bg-destructive text-destructive-foreground">হ্যাঁ, মুছুন</AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {att ? (
                                                        <div className="flex flex-col items-end gap-1">
                                                            <Badge className={cn("font-black text-[10px] px-3", att.status === 'present' ? "bg-emerald-600" : "bg-rose-600")}>
                                                                {att.status === 'present' ? 'উপস্থিত' : 'ছুটি'}
                                                            </Badge>
                                                            {att.checkIn && <span className="text-[9px] font-bold text-slate-700 italic">প্রবেশ: {att.checkIn}</span>}
                                                            {att.checkOut && <span className="text-[9px] font-bold text-emerald-700 italic">প্রস্থান: {att.checkOut}</span>}
                                                            {att.leaveType && <span className="text-[9px] font-black text-rose-700">ধরন: {LEAVE_TYPES.find(t => t.id === att.leaveType)?.label}</span>}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-300 italic">অপেক্ষমান</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        
                        <div className="flex justify-center pt-8 border-t">
                            <Button 
                                onClick={handleGlobalFinalSave} 
                                size="lg" 
                                disabled={isAttendanceLoading}
                                className="px-12 h-14 text-xl font-black shadow-2xl bg-primary hover:bg-primary/90"
                            >
                                {isAttendanceLoading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                                পুরো দিনের হাজিরা ফাইনাল সেভ করুন
                            </Button>
                        </div>
                    </div>
                )}

                {activeSection === 'report' && (
                    <div className="space-y-6 animate-in fade-in duration-500 no-print">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-2 border-blue-100 rounded-xl bg-white shadow-sm items-end">
                            <div className="space-y-2">
                                <Label className="font-black text-primary">মাস</Label>
                                <Select value={reportMonth} onValueChange={setReportMonth}>
                                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                    <SelectContent>{BENGALI_MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-black text-primary">বছর</Label>
                                <Input type="number" value={reportYear} onChange={e => setReportYear(e.target.value)} className="bg-white" />
                            </div>
                            <Button className="font-black h-10 shadow-sm" onClick={fetchReport} disabled={isReportLoading}>
                                {isReportLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                রিপোর্ট জেনারেট করুন
                            </Button>
                            <Button variant="outline" className="font-black h-10 border-primary text-primary" onClick={() => window.print()} disabled={rangeRecords.length === 0}>
                                <Printer className="mr-2 h-4 w-4" /> রিপোর্ট প্রিন্ট
                            </Button>
                        </div>

                        {rangeRecords.length > 0 && (
                            <div className="space-y-4">
                                <div className="p-8 bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl text-center">
                                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                                    <h3 className="text-xl font-black text-blue-900">রিপোর্ট প্রস্তুত হয়েছে!</h3>
                                    <p className="font-bold text-blue-700">উপরে 'রিপোর্ট প্রিন্ট' বাটনে ক্লিক করে সব পাতা প্রিন্ট করুন।</p>
                                </div>
                                <div className="bg-white border rounded-xl overflow-hidden shadow-md">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="font-black">নাম ও পদবি</TableHead>
                                                <TableHead className="text-center font-black">মোট উপস্থিতি</TableHead>
                                                <TableHead className="text-center font-black">অনুপস্থিতি</TableHead>
                                                <TableHead className="text-center font-black">ছুটি</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {[...sortedTeachers, ...sortedEmployees].filter(s => s.isActive).map(s => {
                                                const presentCount = rangeRecords.filter(r => r.attendance.some(a => a.staffId === s.id && a.status === 'present')).length;
                                                const leaveCount = rangeRecords.filter(r => r.attendance.some(a => a.staffId === s.id && a.status === 'leave')).length;
                                                const daysInMonth = eachDayOfInterval({ 
                                                    start: startOfMonth(new Date(parseInt(reportYear), parseInt(reportMonth))), 
                                                    end: endOfMonth(new Date(parseInt(reportYear), parseInt(reportMonth))) 
                                                }).length;
                                                const offDays = eachDayOfInterval({ 
                                                    start: startOfMonth(new Date(parseInt(reportYear), parseInt(reportMonth))), 
                                                    end: endOfMonth(new Date(parseInt(reportYear), parseInt(reportMonth))) 
                                                }).filter(d => (d.getDay() === 5 || d.getDay() === 6) || holidays.includes(format(d, 'yyyy-MM-dd'))).length;
                                                const workDays = daysInMonth - offDays;
                                                const absentCount = workDays - presentCount - leaveCount;

                                                return (
                                                    <TableRow key={s.id}>
                                                        <TableCell>
                                                            <p className="font-bold text-xs">{s.nameBn}</p>
                                                            <p className="text-[9px] text-muted-foreground">{s.designation}</p>
                                                        </TableCell>
                                                        <TableCell className="text-center text-xs font-black text-emerald-600">{toBengaliNumber(presentCount)} দিন</TableCell>
                                                        <TableCell className="text-center text-xs font-black text-rose-600">{toBengaliNumber(Math.max(0, absentCount))} দিন</TableCell>
                                                        <TableCell className="text-center text-xs font-black text-blue-600">{toBengaliNumber(leaveCount)} দিন</TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </main>

      {/* --- Full Report Printing Area (Portrait Mode) --- */}
      <div className="hidden print:block printable-area bg-white text-black font-kalpurush">
          <style jsx global>{`
              @media print {
                  @page { size: A4 portrait; margin: 3mm; }
                  html, body { height: auto; overflow: visible; background: white !important; }
                  .report-page { 
                      page-break-after: always; 
                      width: 204mm; 
                      min-height: 290mm; 
                      padding: 2mm; 
                      box-sizing: border-box;
                      display: flex;
                      flex-direction: column;
                      background: white !important;
                      margin: 0 auto;
                  }
                  .report-header { 
                      border-bottom: 2px solid black; 
                      padding-bottom: 4px; 
                      margin-bottom: 8px; 
                      text-align: center;
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      width: 100%;
                  }
                  .report-table { border: 1.5px solid black !important; width: 100%; border-collapse: collapse; }
                  .report-table th, .report-table td { 
                      border: 1px solid black !important; 
                      padding: 4.5px 1px !important; 
                      text-align: center; 
                      font-size: 8.5px; 
                      line-height: 1.2; 
                  }
                  .report-table th { font-weight: 900 !important; background-color: #f1f5f9 !important; }
                  .holiday-text { color: #dc2626 !important; font-weight: bold; background-color: #fef2f2 !important; }
                  .summary-row td { background-color: #f8fafc !important; font-weight: 900 !important; font-size: 9px !important; border-top: 1.5px solid black !important; }
                  .report-footer { margin-top: auto; padding-top: 15px; width: 100%; display: flex; justify-content: space-between; padding-left: 20px; padding-right: 20px; padding-bottom: 10px; }
                  .sign-box { border-top: 1.5px solid black; width: 50mm; text-align: center; font-size: 9px; font-weight: 900; padding-top: 3px; }
              }
          `}</style>
          
          {reportPages.map((page, pageIdx) => (
              <div key={pageIdx} className="report-page">
                  <div className="report-header">
                      {schoolInfo.logoUrl && <img src={schoolInfo.logoUrl} alt="লোগো" width={55} height={55} className="object-contain mb-1" />}
                      <h1 className="text-2xl font-black uppercase text-emerald-950 leading-tight">{schoolInfo.name}</h1>
                      <p className="text-sm font-bold text-slate-700">{schoolInfo.address}</p>
                      <div className="mt-2 inline-block border-[1.5px] border-black px-6 py-0.5 rounded-full bg-slate-50">
                          <h2 className="text-sm font-black uppercase tracking-tight">হাজিরা ও ছুটির রিপোর্ট: {BENGALI_MONTHS[parseInt(reportMonth)]} {toBengaliNumber(reportYear)}</h2>
                      </div>
                      <p className="text-[8px] font-bold mt-1 text-slate-400 italic">পাতা: {toBengaliNumber(pageIdx + 1)} / {toBengaliNumber(reportPages.length)}</p>
                  </div>

                  <table className="report-table">
                      <thead>
                          <tr className="bg-slate-100">
                              <th className="w-[110px] font-black py-2">তারিখ ও বার</th>
                              {page.teachers.map(teacher => (
                                  <th key={teacher.id} className="py-2">
                                      <p className="font-black text-[9px] text-blue-900">{teacher.nameBn}</p>
                                      <p className="text-[7px] italic font-bold text-slate-600">{teacher.designation}</p>
                                  </th>
                              ))}
                          </tr>
                      </thead>
                      <tbody>
                          {page.days.map(day => {
                              const dateStr = format(day, 'yyyy-MM-dd');
                              const isWeekendDay = day.getDay() === 5 || day.getDay() === 6;
                              const isHolidayDay = holidays.includes(dateStr);
                              const isOffDay = isWeekendDay || isHolidayDay;
                              
                              const displayDate = toBengaliNumber(format(day, "dd-MM-yyyy", { locale: bn })) + " " + format(day, "EEEE", { locale: bn });

                              return (
                                  <tr key={dateStr} className={cn(isOffDay && "holiday-text")}>
                                      <td className="text-left pl-3 font-bold text-[8.5px]">{displayDate}</td>
                                      {page.teachers.map(teacher => {
                                          const record = rangeRecords.find(r => r.date === dateStr);
                                          const att = record?.attendance.find(a => a.staffId === teacher.id);
                                          
                                          let cellText = "";
                                          if (att) {
                                              if (att.status === 'present') {
                                                  cellText = att.checkIn ? `${att.checkIn}${att.checkOut ? ` - ${att.checkOut}` : ''}` : 'উপস্থিত';
                                              } else {
                                                  cellText = att.leaveType || 'ছুটি';
                                              }
                                          } else if (isHolidayDay) {
                                              cellText = "সরকারি ছুটি";
                                          } else if (isWeekendDay) {
                                              cellText = "সাপ্তাহিক ছুটি";
                                          } else {
                                              cellText = "অনুপস্থিত";
                                          }

                                          return (
                                              <td key={teacher.id} className={cn(
                                                  "font-medium",
                                                  cellText === "অনুপস্থিত" && "text-rose-600 font-bold",
                                                  (cellText === "সাপ্তাহিক ছুটি" || cellText === "সরকারি ছুটি") && "text-slate-400 font-normal"
                                              )}>
                                                  {toBengaliNumber(cellText)}
                                              </td>
                                          );
                                      })}
                                  </tr>
                              );
                          })}
                          
                          {/* Summary Footer Rows */}
                          <tr className="summary-row">
                              <td className="text-right pr-4 font-black">মোট কর্মদিবস</td>
                              {page.teachers.map(teacher => {
                                  const totalWorkDays = page.days.filter(d => {
                                      const ds = format(d, 'yyyy-MM-dd');
                                      return !((d.getDay() === 5 || d.getDay() === 6) || holidays.includes(ds));
                                  }).length;
                                  return <td key={teacher.id} className="text-blue-900 font-black">{toBengaliNumber(totalWorkDays)} দিন</td>;
                              })}
                          </tr>
                          <tr className="summary-row">
                              <td className="text-right pr-4 font-black">উপস্থিত (মোট)</td>
                              {page.teachers.map(teacher => {
                                  const count = rangeRecords.filter(r => r.attendance.some(a => a.staffId === teacher.id && a.status === 'present')).length;
                                  return <td key={teacher.id} className="text-emerald-700 font-black">{toBengaliNumber(count)} দিন</td>;
                              })}
                          </tr>
                          <tr className="summary-row">
                              <td className="text-right pr-4 font-black">অনুপস্থিত (মোট)</td>
                              {page.teachers.map(teacher => {
                                  const count = page.days.filter(d => {
                                      const ds = format(d, 'yyyy-MM-dd');
                                      if (holidays.includes(ds) || (d.getDay() === 5 || d.getDay() === 6)) return false;
                                      const r = rangeRecords.find(rec => rec.date === ds);
                                      const a = r?.attendance.find(at => at.staffId === teacher.id);
                                      return !a || (a.status !== 'present' && a.status !== 'leave');
                                  }).length;
                                  return <td key={teacher.id} className="text-rose-700 font-black">{toBengaliNumber(count)} দিন</td>;
                              })}
                          </tr>
                          <tr className="summary-row">
                              <td className="text-right pr-4 font-black">ছুটি (মোট)</td>
                              {page.teachers.map(teacher => {
                                  const count = rangeRecords.filter(r => r.attendance.some(a => a.staffId === teacher.id && a.status === 'leave')).length;
                                  return <td key={teacher.id} className="text-blue-700 font-black">{toBengaliNumber(count)} দিন</td>;
                              })}
                          </tr>
                      </tbody>
                  </table>
                  
                  <div className="report-footer">
                      <div className="sign-box">হিসাবরক্ষকের স্বাক্ষর</div>
                      <div className="sign-box">প্রধান শিক্ষকের স্বাক্ষর ও সিল</div>
                  </div>
                  
                  <div className="text-center text-[8px] text-slate-300 italic mt-auto pt-2 border-t border-dashed">
                      রিপোর্ট তৈরির তারিখ: {toBengaliNumber(format(new Date(), 'dd-MM-yyyy p', { locale: bn }))} | বীরগঞ্জ পৌর উচ্চ বিদ্যালয় পোর্টাল
                  </div>
              </div>
          ))}
      </div>

      <Dialog open={!!staffToView} onOpenChange={(isOpen) => !isOpen && setStaffToView(null)}>
        <DialogContent className="max-w-xl font-kalpurush">
             {staffToView && (
                <>
                    <DialogHeader className="flex-row items-center gap-4">
                        <Image src={staffToView.photoUrl || 'https://picsum.photos/seed/staff/96/96'} alt={staffToView.nameBn} width={80} height={80} className="rounded-lg object-cover border shadow-sm" />
                        <div>
                            <DialogTitle className="text-2xl mb-1 font-black">{staffToView.nameBn}</DialogTitle>
                            <DialogDescription className="font-black text-primary">{staffToView.designation}</DialogDescription>
                        </div>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto pr-4 scrollbar-thin">
                        <div className="space-y-4 py-4 text-sm font-bold text-slate-700">
                            <p className="flex justify-between border-b pb-1.5"><span className="text-muted-foreground font-medium">নাম (ইংরেজি):</span> <span>{staffToView.nameEn || 'N/A'}</span></p>
                            <p className="flex justify-between border-b pb-1.5"><span className="text-muted-foreground font-medium">জন্ম তারিখ:</span> <span>{staffToView.dob ? toBengaliNumber(format(new Date(staffToView.dob), "dd-MM-yyyy", { locale: bn })) : 'N/A'}</span></p>
                            <p className="flex justify-between border-b pb-1.5"><span className="text-muted-foreground font-medium">বিষয়:</span> <span>{staffToView.subject || 'N/A'}</span></p>
                            <p className="flex justify-between border-b pb-1.5"><span className="text-muted-foreground font-medium">মোবাইল:</span> <span>{toBengaliNumber(staffToView.mobile)}</span></p>
                            <p className="flex justify-between border-b pb-1.5"><span className="text-muted-foreground font-medium">যোগদানের তারিখ:</span> <span>{staffToView.joinDate ? toBengaliNumber(format(new Date(staffToView.joinDate), "dd-MM-yyyy", { locale: bn })) : 'N/A'}</span></p>
                            <p className="flex justify-between border-b pb-1.5"><span className="text-muted-foreground font-medium">শিক্ষাগত যোগ্যতা:</span> <span>{staffToView.education || 'N/A'}</span></p>
                            <p className="flex flex-col border-b pb-1.5"><span className="text-muted-foreground mb-1 font-medium">ঠিকানা:</span> <span>{staffToView.address || 'N/A'}</span></p>
                        </div>
                    </div>
                </>
             )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
