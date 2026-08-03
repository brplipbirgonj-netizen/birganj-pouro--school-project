
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deleteStaff, Staff, staffFromDoc } from '@/lib/staff-data';
import { Eye, FilePen, Trash2, Clock, Calendar, Briefcase, Check, X, Search, Loader2, List, ClipboardCheck, FileBarChart, ChevronRight, Plus, Printer, Save, RotateCcw, Edit2 } from 'lucide-react';
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
import { collection, onSnapshot, query, orderBy, FirestoreError, getDocs, where, limit } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
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
  
  // Steps for attendance input: 0=Initial, 1=Status Selected, 2=Time/Leave Set
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

  const handleFinalSave = async (staffId: string) => {
    if (!db || !dailyAttendance) return;
    try {
        await saveStaffAttendance(db, dailyAttendance);
        toast({ title: 'সংরক্ষিত হয়েছে' });
        setAttendanceSteps(prev => ({ ...prev, [staffId]: 3 }));
        setEditStates(prev => ({ ...prev, [staffId]: false }));
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

  const StaffTable = ({ data, startIdx = 0 }: { data: Staff[], startIdx?: number }) => (
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
                    <TableCell className="whitespace-nowrap font-black text-primary text-base">{staff.nameBn}</TableCell>
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
      const teachers = [...sortedTeachers, ...sortedEmployees].filter(s => s.isActive);
      const chunks = [];
      for (let i = 0; i < teachers.length; i += 3) {
          chunks.push(teachers.slice(i, i + 3));
      }
      
      const monthStart = startOfMonth(new Date(parseInt(reportYear), parseInt(reportMonth)));
      const monthEnd = endOfMonth(monthStart);
      const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
      
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
                                <div className="h-6 w-1 bg-orange-500 rounded-full" />
                                <h3 className="text-lg font-black text-orange-950">শিক্ষকবৃন্দের তালিকা ({toBengaliNumber(sortedTeachers.length)} জন)</h3>
                            </div>
                            <StaffTable data={sortedTeachers} />
                        </section>
                        <section>
                            <div className="flex items-center gap-2 mb-4 px-2">
                                <div className="h-6 w-1 bg-blue-500 rounded-full" />
                                <h3 className="text-lg font-black text-blue-950">কর্মচারীবৃন্দের তালিকা ({toBengaliNumber(sortedEmployees.length)} জন)</h3>
                            </div>
                            <StaffTable data={sortedEmployees} />
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
                                            <TableRow key={staff.id} className="h-20">
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
                                                                <Badge className={cn("px-4 py-1 font-black", att?.status === 'present' ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700")}>
                                                                    {att?.status === 'present' ? 'উপস্থিতি সিলেক্টেড' : 'ছুটি সিলেক্টেড'}
                                                                </Badge>
                                                                <Button size="sm" variant="outline" className="h-9 px-8 font-black border-2 border-primary text-primary" onClick={() => handleSaveStatus(staff.id)}>পরবর্তী ধাপ</Button>
                                                            </div>
                                                        )}
                                                        {currentStep === 2 && (
                                                            <div className="flex flex-col gap-3 w-full max-w-[250px] bg-slate-50 p-3 rounded-lg border-2 border-dashed border-primary/20">
                                                                {att?.status === 'present' ? (
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black text-primary">আগমনের সময় (Manual + AM/PM)</Label>
                                                                        <div className="flex gap-1">
                                                                            <Input type="text" placeholder="উদা: ১০:৩০" className="h-8 text-xs font-bold text-center" value={att?.checkIn || ''} onChange={e => handleAttendanceDetailChange(staff.id, 'checkIn', e.target.value)} />
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
                                                                    <div className="space-y-2">
                                                                        <Label className="text-[10px] font-black text-rose-700">ছুটির ধরন</Label>
                                                                        <Select value={att?.leaveType || ""} onValueChange={val => handleAttendanceDetailChange(staff.id, 'leaveType', val as LeaveType)}>
                                                                            <SelectTrigger className="h-8 text-[10px] font-bold"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                                                                            <SelectContent>{LEAVE_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                                                                        </Select>
                                                                    </div>
                                                                )}
                                                                <Button size="sm" className="w-full h-8 font-black shadow-md" onClick={() => handleFinalSave(staff.id)}>সংরক্ষণ করুন</Button>
                                                            </div>
                                                        )}
                                                        {currentStep === 3 && (
                                                            <div className="flex flex-col gap-2 w-full max-w-[200px]">
                                                                {att?.status === 'present' && (
                                                                    <div className="space-y-1">
                                                                         <Label className="text-[10px] font-black text-slate-500">প্রস্থানের সময়</Label>
                                                                         <div className="flex gap-1">
                                                                            <Input type="text" placeholder="০৪:০০ PM" className="h-8 text-[10px] font-bold" value={att?.checkOut || ''} onChange={e => handleAttendanceDetailChange(staff.id, 'checkOut', e.target.value)} />
                                                                            <Button variant="outline" size="sm" className="h-8 w-8 p-0 border-emerald-200" onClick={() => handleFinalSave(staff.id)}><Save className="h-3 w-3 text-emerald-600" /></Button>
                                                                         </div>
                                                                    </div>
                                                                )}
                                                                <div className="flex justify-center gap-2">
                                                                    <Button variant="ghost" size="sm" className="h-7 text-[10px] font-bold text-blue-600" onClick={() => { setAttendanceSteps(prev => ({ ...prev, [staff.id]: 0 })); setEditStates(prev => ({ ...prev, [staff.id]: true })); }}><Edit2 className="h-3 w-3 mr-1" /> এডিট</Button>
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
                                                            {att.checkIn && <span className="text-[9px] font-bold text-muted-foreground italic">প্রবেশ: {att.checkIn}</span>}
                                                            {att.checkOut && <span className="text-[9px] font-bold text-muted-foreground italic">প্রস্থান: {att.checkOut}</span>}
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

                        {rangeRecords.length > 0 ? (
                            <div className="p-8 bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl text-center">
                                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                                <h3 className="text-xl font-black text-blue-900">রিপোর্ট প্রস্তুত হয়েছে!</h3>
                                <p className="font-bold text-blue-700">উপরে 'প্রিন্ট' বাটনে ক্লিক করে সব পাতা প্রিন্ট করুন।</p>
                            </div>
                        ) : (
                            <div className="py-20 text-center opacity-30 italic"><FileBarChart className="h-16 w-16 mx-auto mb-4" /><p>মাস ও বছর সিলেক্ট করে রিপোর্ট জেনারেট করুন।</p></div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </main>

      {/* --- Full Report Printing Area --- */}
      <div className="hidden print:block printable-area bg-white text-black font-kalpurush">
          <style jsx global>{`
              @media print {
                  @page { size: A4 landscape; margin: 10mm; }
                  .report-page { page-break-after: always; min-height: 100vh; position: relative; }
                  .report-header { border-bottom: 3px solid black; padding-bottom: 10px; margin-bottom: 15px; }
                  .report-table th, .report-table td { border: 1px solid black !important; padding: 4px !important; text-align: center; font-size: 11px; }
                  .holiday-text { color: red !important; font-weight: bold; }
              }
          `}</style>
          
          {reportPages.map((page, pageIdx) => (
              <div key={pageIdx} className="report-page p-4">
                  <div className="report-header flex items-center justify-between">
                      <div className="flex items-center gap-4">
                          {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" width={60} height={60} className="object-contain" />}
                          <div className="text-left">
                              <h1 className="text-2xl font-black uppercase text-emerald-950">{schoolInfo.name}</h1>
                              <p className="text-xs font-bold text-slate-700">{schoolInfo.address}</p>
                          </div>
                      </div>
                      <div className="text-right">
                          <h2 className="text-lg font-black underline">হাজিরা রিপোর্ট: {BENGALI_MONTHS[parseInt(reportMonth)]} {toBengaliNumber(reportYear)}</h2>
                          <p className="text-[10px] font-bold">পৃষ্ঠা: {toBengaliNumber(pageIdx + 1)} / {toBengaliNumber(reportPages.length)}</p>
                      </div>
                  </div>

                  <table className="w-full report-table border-collapse">
                      <thead>
                          <tr className="bg-slate-100">
                              <th className="w-[180px]">তারিখ ও বার</th>
                              {page.teachers.map(teacher => (
                                  <th key={teacher.id} className="min-w-[150px]">
                                      <p className="font-black text-[12px]">{teacher.nameBn}</p>
                                      <p className="text-[9px] italic font-bold">{teacher.designation}</p>
                                  </th>
                              ))}
                          </tr>
                      </thead>
                      <tbody>
                          {page.days.map(day => {
                              const dateStr = format(day, 'yyyy-MM-dd');
                              const dayOfWeek = day.getDay();
                              const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
                              const isHolidayDay = holidays.includes(dateStr);
                              const isOffDay = isWeekend || isHolidayDay;
                              
                              const displayDate = format(day, "dd-MM-yyyy EEEE", { locale: bn });

                              return (
                                  <tr key={dateStr} className={cn(isOffDay && "bg-rose-50")}>
                                      <td className={cn("text-left pl-2 font-bold", isOffDay && "holiday-text")}>{toBengaliNumber(displayDate)}</td>
                                      {page.teachers.map(teacher => {
                                          const record = rangeRecords.find(r => r.date === dateStr);
                                          const att = record?.attendance.find(a => a.staffId === teacher.id);
                                          
                                          let cellText = "";
                                          if (att) {
                                              cellText = att.status === 'present' ? 'উপস্থিত' : (att.leaveType || 'ছুটি');
                                          } else if (isHolidayDay) {
                                              cellText = "সরকারি ছুটি";
                                          } else if (isWeekend) {
                                              cellText = "সাপ্তাহিক ছুটি";
                                          } else {
                                              cellText = "অনুপস্থিত";
                                          }

                                          return (
                                              <td key={teacher.id} className={cn(cellText === "অনুপস্থিত" && "text-rose-600 font-bold")}>
                                                  {cellText}
                                              </td>
                                          );
                                      })}
                                  </tr>
                              );
                          })}
                      </tbody>
                      <tfoot>
                          <tr className="bg-slate-50 font-black">
                              <td className="text-right pr-4">উপস্থিত (মোট দিন)</td>
                              {page.teachers.map(teacher => {
                                  const count = rangeRecords.filter(r => r.attendance.some(a => a.staffId === teacher.id && a.status === 'present')).length;
                                  return <td key={teacher.id}>{toBengaliNumber(count)}</td>;
                              })}
                          </tr>
                          <tr className="bg-slate-50 font-black">
                              <td className="text-right pr-4">অনুপস্থিত (মোট দিন)</td>
                              {page.teachers.map(teacher => {
                                  const count = page.days.filter(d => {
                                      const ds = format(d, 'yyyy-MM-dd');
                                      const isOff = holidays.includes(ds) || d.getDay() === 5 || d.getDay() === 6;
                                      if (isOff) return false;
                                      const r = rangeRecords.find(rec => rec.date === ds);
                                      const a = r?.attendance.find(at => at.staffId === teacher.id);
                                      return !a || (a.status !== 'present' && a.status !== 'leave');
                                  }).length;
                                  return <td key={teacher.id}>{toBengaliNumber(count)}</td>;
                              })}
                          </tr>
                          <tr className="bg-slate-50 font-black">
                              <td className="text-right pr-4">ছুটি (মোট দিন)</td>
                              {page.teachers.map(teacher => {
                                  const count = rangeRecords.filter(r => r.attendance.some(a => a.staffId === teacher.id && a.status === 'leave')).length;
                                  return <td key={teacher.id}>{toBengaliNumber(count)}</td>;
                              })}
                          </tr>
                      </tfoot>
                  </table>
                  
                  <div className="mt-20 flex justify-between px-20 font-black text-sm">
                      <div className="w-48 border-t-2 border-black pt-1 text-center">হিসাবরক্ষকের স্বাক্ষর</div>
                      <div className="w-48 border-t-2 border-black pt-1 text-center">প্রধান শিক্ষকের স্বাক্ষর</div>
                  </div>
              </div>
          ))}
      </div>

      {/* View Staff Dialog (Existing from f6678b4) */}
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
                            <p className="flex justify-between border-b pb-1.5"><span className="text-muted-foreground font-medium">জন্ম তারিখ:</span> <span>{staffToView.dob ? format(new Date(staffToView.dob), "d MMMM yyyy", { locale: bn }) : 'N/A'}</span></p>
                            <p className="flex justify-between border-b pb-1.5"><span className="text-muted-foreground font-medium">বিষয়:</span> <span>{staffToView.subject || 'N/A'}</span></p>
                            <p className="flex justify-between border-b pb-1.5"><span className="text-muted-foreground font-medium">মোবাইল:</span> <span>{toBengaliNumber(staffToView.mobile)}</span></p>
                            <p className="flex justify-between border-b pb-1.5"><span className="text-muted-foreground font-medium">যোগদানের তারিখ:</span> <span>{staffToView.joinDate ? format(new Date(staffToView.joinDate), "d MMMM yyyy", { locale: bn }) : 'N/A'}</span></p>
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

function toBengaliNumber(str: string | number) {
  if (!str && str !== 0) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
}
