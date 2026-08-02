'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deleteStaff, Staff, staffFromDoc } from '@/lib/staff-data';
import { Eye, FilePen, Trash2, Clock, Calendar, Briefcase, Check, X, Search, Loader2, List, ClipboardCheck, FileBarChart, ChevronRight } from 'lucide-react';
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
import { format, startOfMonth, endOfMonth } from 'date-fns';
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
  
  const canManageStaff = hasPermission('manage:staff');
  const canManageAttendance = hasPermission('manage:staff-attendance');
  const canViewAttendanceReport = hasPermission('view:staff-attendance-report');

  const [activeSection, setActiveSection] = useState('list');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dailyAttendance, setDailyAttendance] = useState<StaffDailyAttendance | null>(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);

  const [reportMonth, setReportMonth] = useState(new Date().getMonth().toString());
  const [reportYear, setReportYear] = useState(new Date().getFullYear().toString());
  const [reportStaffId, setReportStaffId] = useState('all');
  const [rangeRecords, setRangeRecords] = useState<StaffDailyAttendance[]>([]);
  const [isReportLoading, setIsReportLoading] = useState(false);

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

  const handleStatusChange = (staffId: string, status: 'present' | 'leave') => {
    setDailyAttendance(prev => {
        if (!prev) return null;
        const nextAtt = [...prev.attendance];
        const idx = nextAtt.findIndex(a => a.staffId === staffId);
        if (idx > -1) {
            nextAtt[idx] = { ...nextAtt[idx], status, leaveType: status === 'leave' ? 'CL' : undefined };
        } else {
            nextAtt.push({ staffId, status, leaveType: status === 'leave' ? 'CL' : undefined });
        }
        return { ...prev, attendance: nextAtt };
    });
  };

  const handleAttendanceDetailChange = (staffId: string, field: keyof StaffMemberAttendance, value: string) => {
    setDailyAttendance(prev => {
        if (!prev) return null;
        const nextAtt = [...prev.attendance];
        const idx = nextAtt.findIndex(a => a.staffId === staffId);
        if (idx > -1) {
            nextAtt[idx] = { ...nextAtt[idx], [field]: value };
        } else {
            nextAtt.push({ staffId, status: 'present', [field]: value } as any);
        }
        return { ...prev, attendance: nextAtt };
    });
  };

  const handleSaveDailyAttendance = () => {
    if (!db || !dailyAttendance) return;
    saveStaffAttendance(db, dailyAttendance);
    toast({ title: 'দৈনিক হাজিরা ও ছুটি সংরক্ষিত হয়েছে' });
  };

  const fetchReport = useCallback(async () => {
    if (!db) return;
    setIsReportLoading(true);
    const start = format(startOfMonth(new Date(parseInt(reportYear), parseInt(reportMonth))), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date(parseInt(reportYear), parseInt(reportMonth))), 'yyyy-MM-dd');
    const records = await getStaffAttendanceForRange(db, start, end);
    setRangeRecords(records);
    setIsReportLoading(false);
  }, [db, reportMonth, reportYear]);

  const handleDeleteLeave = async (record: StaffDailyAttendance, staffId: string) => {
    if (!db) return;
    const updatedAttendance = record.attendance.map(a => {
        if (a.staffId === staffId) {
            return { ...a, status: 'present' as const, leaveType: undefined };
        }
        return a;
    });
    const updatedRecord = { ...record, attendance: updatedAttendance };
    try {
        await saveStaffAttendance(db, updatedRecord as StaffDailyAttendance);
        toast({ title: 'ছুটি বাতিল করা হয়েছে এবং উপস্থিত হিসেবে গণ্য করা হয়েছে।' });
        fetchReport(); 
    } catch (e) {
        toast({ variant: 'destructive', title: 'ছুটি বাতিল করা যায়নি।' });
    }
  };

  const handleDeleteStaff = (staffId: string) => {
    if (!db) return;
    deleteStaff(db, staffId).then(() => {
        toast({ title: "রেকর্ড ডিলিট হয়েছে" });
    }).catch(() => {});
  };

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
                    <TableCell className="whitespace-nowrap font-black text-primary">{staff.nameBn}</TableCell>
                    <TableCell className="whitespace-nowrap font-bold text-xs">{staff.designation}</TableCell>
                    <TableCell className="text-xs font-bold">{toBengaliNumber(staff.mobile)}</TableCell>
                    <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setStaffToView(staff)}><Eye className="h-4 w-4" /></Button>
                            {canManageStaff && (
                                <>
                                    <Link href={`/edit-staff/${staff.id}`}><Button variant="outline" size="icon" className="h-8 w-8 text-blue-600"><FilePen className="h-4 w-4" /></Button></Link>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle><AlertDialogDescription>এটি স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteStaff(staff.id)}>মুছে ফেলুন</AlertDialogAction>
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

  if (!isClient) return null;

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#F6F7F9] font-kalpurush">
      <Header />
      <main className="flex-1 flex flex-col md:flex-row h-full max-w-[1600px] mx-auto w-full md:p-6 lg:p-10 gap-8 pb-[500px]">
        
        {/* Sidebar Navigation - Fixed/Sticky */}
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

        {/* Content Area */}
        <div className="flex-1 min-w-0 bg-white md:rounded-[32px] shadow-2xl md:border-[1px] border-slate-200/50 overflow-hidden min-h-[700px] flex flex-col transition-all duration-500 animate-in fade-in slide-in-from-right-4">
            <div className="p-4 sm:p-6 lg:p-8 flex-1">
                <div className="mb-6 border-b pb-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">{sidebarItems.find(i => i.id === activeSection)?.label}</h2>
                        <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">বীরগঞ্জ পৌর উচ্চ বিদ্যালয়</p>
                    </div>
                    {activeSection === 'list' && canManageStaff && (
                        <Link href="/add-staff">
                            <Button className="font-black h-10 px-6 shadow-md"><Briefcase className="mr-2 h-4 w-4" /> নতুন স্টাফ</Button>
                        </Link>
                    )}
                </div>

                {isLoading ? (
                    <div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>
                ) : (
                    <>
                        {activeSection === 'list' && (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                <section>
                                    <div className="flex items-center gap-2 mb-4 px-2">
                                        <div className="h-6 w-1 bg-orange-500 rounded-full" />
                                        <h3 className="text-lg font-black text-orange-950">শিক্ষকবৃন্দের তালিকা ({toBengaliNumber(sortedTeachers.length)} জন)</h3>
                                    </div>
                                    {sortedTeachers.length === 0 ? (
                                        <p className="text-center py-12 bg-white/50 rounded-lg border-2 border-dashed italic">কোনো শিক্ষকের তথ্য নেই।</p>
                                    ) : (
                                        <StaffTable data={sortedTeachers} />
                                    )}
                                </section>

                                <section>
                                    <div className="flex items-center gap-2 mb-4 px-2">
                                        <div className="h-6 w-1 bg-blue-500 rounded-full" />
                                        <h3 className="text-lg font-black text-blue-950">কর্মচারীবৃন্দের তালিকা ({toBengaliNumber(sortedEmployees.length)} জন)</h3>
                                    </div>
                                    {sortedEmployees.length === 0 ? (
                                        <p className="text-center py-12 bg-white/50 rounded-lg border-2 border-dashed italic">কোনো কর্মচারীর তথ্য নেই।</p>
                                    ) : (
                                        <StaffTable data={sortedEmployees} />
                                    )}
                                </section>
                            </div>
                        )}

                        {activeSection === 'attendance' && (
                            <div className="space-y-6 animate-in fade-in duration-500">
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

                                <div className="table-container border-2 border-orange-50">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="font-black">নাম ও পদবি</TableHead>
                                                <TableHead className="text-center font-black">অবস্থা</TableHead>
                                                <TableHead className="text-center font-black">ছুটির ধরন</TableHead>
                                                <TableHead className="text-center font-black">আসার সময়</TableHead>
                                                <TableHead className="text-center font-black">যাওয়ার সময়</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {[...sortedTeachers, ...sortedEmployees].filter(s => s.isActive).map(staff => {
                                                const att = dailyAttendance?.attendance.find(a => a.staffId === staff.id) || { status: 'present' };
                                                return (
                                                    <TableRow key={staff.id} className="h-16 hover:bg-muted/5">
                                                        <TableCell>
                                                            <div className="font-black text-sm text-slate-800">{staff.nameBn}</div>
                                                            <div className="text-[10px] font-bold text-muted-foreground italic">{staff.designation}</div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex justify-center gap-1">
                                                                <Button 
                                                                    size="sm" 
                                                                    variant={att.status === 'present' ? 'default' : 'outline'}
                                                                    className={cn("h-8 text-[10px] font-black px-4", att.status === 'present' ? "bg-emerald-600 hover:bg-emerald-700 shadow-md" : "text-emerald-600 border-emerald-200")}
                                                                    onClick={() => handleStatusChange(staff.id, 'present')}
                                                                >
                                                                    <Check className="h-3 w-3 mr-1" /> উপস্থিত
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant={att.status === 'leave' ? 'default' : 'outline'}
                                                                    className={cn("h-8 text-[10px] font-black px-4", att.status === 'leave' ? "bg-rose-600 hover:bg-rose-700 shadow-md" : "text-rose-600 border-rose-200")}
                                                                    onClick={() => handleStatusChange(staff.id, 'leave')}
                                                                >
                                                                    <X className="h-3 w-3 mr-1" /> ছুটি
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Select 
                                                                disabled={att.status !== 'leave'}
                                                                value={att.leaveType || ""}
                                                                onValueChange={val => handleAttendanceDetailChange(staff.id, 'leaveType', val)}
                                                            >
                                                                <SelectTrigger className="h-8 text-[10px] font-bold w-32 mx-auto bg-white border-muted-foreground/20"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                                                                <SelectContent>
                                                                    {LEAVE_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                                                                </SelectContent>
                                                            </Select>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Input 
                                                                type="time" 
                                                                className="h-8 text-[10px] font-bold w-24 mx-auto bg-white" 
                                                                disabled={att.status !== 'present'}
                                                                value={att.checkIn || ""}
                                                                onChange={e => handleAttendanceDetailChange(staff.id, 'checkIn', e.target.value)}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Input 
                                                                type="time" 
                                                                className="h-8 text-[10px] font-bold w-24 mx-auto bg-white" 
                                                                disabled={att.status !== 'present'}
                                                                value={att.checkOut || ""}
                                                                onChange={e => handleAttendanceDetailChange(staff.id, 'checkOut', e.target.value)}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="flex justify-end p-4 border-t">
                                    <Button onClick={handleSaveDailyAttendance} className="font-black shadow-xl h-12 px-10" size="lg">
                                        <Clock className="mr-2 h-5 w-5" /> হাজিরা সেভ করুন
                                    </Button>
                                </div>
                            </div>
                        )}

                        {activeSection === 'report' && (
                            <div className="space-y-6 animate-in fade-in duration-500">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-2 border-orange-100 rounded-xl bg-white shadow-sm items-end">
                                    <div className="space-y-2">
                                        <Label className="font-black text-primary">মাস</Label>
                                        <Select value={reportMonth} onValueChange={setReportMonth}>
                                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {BENGALI_MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-black text-primary">স্টাফ নির্বাচন</Label>
                                        <Select value={reportStaffId} onValueChange={setReportStaffId}>
                                            <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">সকল স্টাফ</SelectItem>
                                                {[...sortedTeachers, ...sortedEmployees].map(s => <SelectItem key={s.id} value={s.id}>{s.nameBn}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button className="font-black h-10 shadow-sm" onClick={fetchReport} disabled={isReportLoading}>
                                        {isReportLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                        রিপোর্ট দেখুন
                                    </Button>
                                </div>

                                {rangeRecords.length > 0 && (
                                    <div className="space-y-6">
                                        {[...sortedTeachers, ...sortedEmployees].filter(s => reportStaffId === 'all' || s.id === reportStaffId).map(staff => {
                                            const staffLeaves = rangeRecords.filter(r => 
                                                r.attendance.some(a => a.staffId === staff.id && a.status === 'leave')
                                            );
                                            
                                            if (staffLeaves.length === 0) return null;

                                            return (
                                                <Card key={staff.id} className="border-2 border-primary/10 overflow-hidden shadow-lg">
                                                    <CardHeader className="bg-primary/5 pb-2 border-b">
                                                        <div className="flex justify-between items-center">
                                                            <CardTitle className="text-xl font-black text-slate-800">{staff.nameBn}</CardTitle>
                                                            <Badge variant="outline" className="bg-white font-black text-lg px-4 py-1 text-rose-700 border-rose-200">
                                                                মোট ছুটি: {toBengaliNumber(staffLeaves.length)} দিন
                                                            </Badge>
                                                        </div>
                                                    </CardHeader>
                                                    <CardContent className="p-0">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-muted/20">
                                                                    <TableHead className="font-black">তারিখ</TableHead>
                                                                    <TableHead className="font-black">বার</TableHead>
                                                                    <TableHead className="text-center font-black">ছুটির ধরণ</TableHead>
                                                                    <TableHead className="text-right font-black">কার্যক্রম</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {staffLeaves.sort((a,b) => a.date.localeCompare(b.date)).map(record => {
                                                                    const att = record.attendance.find(a => a.staffId === staff.id);
                                                                    const leaveType = LEAVE_TYPES.find(t => t.id === att?.leaveType);
                                                                    return (
                                                                        <TableRow key={record.date} className="h-10 text-xs hover:bg-slate-50">
                                                                            <TableCell className="font-bold">{format(new Date(record.date), 'dd MMM yyyy', { locale: bn })}</TableCell>
                                                                            <TableCell className="font-bold text-muted-foreground">{format(new Date(record.date), 'EEEE', { locale: bn })}</TableCell>
                                                                            <TableCell className="text-center">
                                                                                <Badge variant="outline" className={cn("text-[10px] font-black px-4 py-1", leaveType?.color)}>
                                                                                    {leaveType?.label || att?.leaveType || 'অন্যান্য'}
                                                                                </Badge>
                                                                            </TableCell>
                                                                            <TableCell className="text-right">
                                                                                <AlertDialog>
                                                                                    <AlertDialogTrigger asChild>
                                                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50">
                                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                                        </Button>
                                                                                    </AlertDialogTrigger>
                                                                                    <AlertDialogContent>
                                                                                        <AlertDialogHeader>
                                                                                            <AlertDialogTitle>ছুটি বাতিল করতে চান?</AlertDialogTitle>
                                                                                            <AlertDialogDescription>
                                                                                                এটি এই তারিখের ছুটির রেকর্ড মুছে ফেলে শিক্ষককে "উপস্থিত" হিসেবে গণ্য করবে।
                                                                                            </AlertDialogDescription>
                                                                                        </AlertDialogHeader>
                                                                                        <AlertDialogFooter>
                                                                                            <AlertDialogCancel>না</AlertDialogCancel>
                                                                                            <AlertDialogAction onClick={() => handleDeleteLeave(record, staff.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">হ্যাঁ, বাতিল করুন</AlertDialogAction>
                                                                                        </AlertDialogFooter>
                                                                                    </AlertDialogContent>
                                                                                </AlertDialog>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    );
                                                                })}
                                                            </TableBody>
                                                        </Table>
                                                    </CardContent>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
      </main>

      <Dialog open={!!staffToView} onOpenChange={(isOpen) => !isOpen && setStaffToView(null)}>
        <DialogContent className="max-w-xl font-kalpurush">
             {staffToView && (
                <>
                    <DialogHeader className="flex-row items-center gap-4">
                        <Image src={staffToView.photoUrl || 'https://picsum.photos/seed/staff/96/96'} alt={staffToView.nameBn} width={80} height={80} className="rounded-lg object-cover border shadow-sm" />
                        <div>
                            <DialogTitle className="text-2xl mb-1 font-black">{staffToView.nameBn}</DialogTitle>
                            <DialogDescription className="font-black text-primary">
                                {staffToView.designation}
                            </DialogDescription>
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
