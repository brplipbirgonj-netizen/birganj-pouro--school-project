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
    Printer, Save, RotateCcw, Edit2, CheckCircle2, UserX, UserCheck, Users, LogIn, LogOut 
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const LEAVE_TYPES: { id: LeaveType; label: string; color: string }[] = [
    { id: 'CL', label: 'নৈমিত্তিক (CL)', color: 'bg-blue-100 text-blue-700' },
    { id: 'SL', label: 'অসুস্থতা (SL)', color: 'bg-rose-100 text-rose-700' },
    { id: 'EL', label: 'অর্জিত (EL)', color: 'bg-emerald-100 text-emerald-700' },
    { id: 'DL', label: 'দায়িত্বকালীন (DL)', color: 'bg-amber-100 text-amber-700' },
    { id: 'Other', label: 'অন্যান্য', color: 'bg-slate-100 text-slate-700' },
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
  
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [attendanceMode, setAttendanceMode] = useState<'arrival' | 'departure'>('arrival');
  const [tempEntry, setTempEntry] = useState<StaffMemberAttendance | null>(null);

  const [reportStartDate, setReportStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [reportEndDate, setReportEndDate] = useState<Date | undefined>(new Date());
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
    setSelectedStaffId('');
    setTempEntry(null);
    setIsAttendanceLoading(false);
  }, [db, selectedDate]);

  useEffect(() => {
    if (canManageAttendance && activeSection === 'attendance') {
        fetchAttendance();
    }
  }, [fetchAttendance, canManageAttendance, activeSection]);

  const handleStaffSelect = (id: string) => {
      setSelectedStaffId(id);
      const existing = dailyAttendance?.attendance.find(a => a.staffId === id);
      if (existing) {
          setTempEntry({ ...existing });
      } else {
          // Defaults for new entry
          if (attendanceMode === 'arrival') {
              setTempEntry({ staffId: id, status: 'present', checkIn: '১০:৩০ AM' });
          } else {
              setTempEntry({ staffId: id, status: 'present', checkOut: '০৪:০০ PM' });
          }
      }
  };

  const handleTempStatusChange = (status: 'present' | 'leave') => {
      if (!tempEntry) return;
      if (status === 'present') {
          setTempEntry({ ...tempEntry, status, leaveType: undefined, checkIn: tempEntry.checkIn || '১০:৩০ AM' });
      } else {
          setTempEntry({ ...tempEntry, status, checkIn: undefined, checkOut: undefined, leaveType: 'CL' });
      }
  };

  const handleSaveIndividualAttendance = async () => {
      if (!db || !dailyAttendance || !tempEntry || !selectedStaffId) return;
      
      setIsAttendanceLoading(true);
      try {
          const nowTime = new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' });
          const nextAtt = [...dailyAttendance.attendance];
          const idx = nextAtt.findIndex(a => a.staffId === selectedStaffId);
          
          let updatedEntry: StaffMemberAttendance;
          
          if (idx > -1) {
              const prev = nextAtt[idx];
              if (attendanceMode === 'arrival') {
                  updatedEntry = {
                      ...tempEntry,
                      entryTime: prev.entryTime || nowTime,
                      checkOut: prev.checkOut,
                      exitTime: prev.exitTime
                  };
              } else {
                  // Departure mode updates checkOut and exitTime
                  updatedEntry = {
                      ...prev,
                      status: 'present', // Force present if departing
                      checkOut: tempEntry.checkOut || '০৪:০০ PM',
                      exitTime: nowTime
                  };
              }
              nextAtt[idx] = updatedEntry;
          } else {
              // New record
              updatedEntry = { ...tempEntry };
              if (attendanceMode === 'arrival') {
                  updatedEntry.entryTime = nowTime;
              } else {
                  updatedEntry.status = 'present';
                  updatedEntry.exitTime = nowTime;
              }
              nextAtt.push(updatedEntry);
          }
          
          const updatedRecord = { ...dailyAttendance, attendance: nextAtt };
          await saveStaffAttendance(db, updatedRecord);
          
          setDailyAttendance(updatedRecord);
          setSelectedStaffId('');
          setTempEntry(null);
          toast({ title: attendanceMode === 'arrival' ? 'আগমনের হাজিরা সংরক্ষিত হয়েছে' : 'প্রস্থানের হাজিরা সংরক্ষিত হয়েছে' });
      } catch (e) {
          console.error(e);
      } finally {
          setIsAttendanceLoading(false);
      }
  };

  const handleDeleteEntry = async (staffId: string) => {
    if (!db || !dailyAttendance) return;
    setIsAttendanceLoading(true);
    try {
        const nextAtt = dailyAttendance.attendance.filter(a => a.staffId !== staffId);
        const updatedRecord = { ...dailyAttendance, attendance: nextAtt };
        await saveStaffAttendance(db, updatedRecord);
        setDailyAttendance(updatedRecord);
        toast({ title: 'হাজিরা মুছে ফেলা হয়েছে' });
    } catch (e) {}
    setIsAttendanceLoading(false);
  };

  const fetchReport = useCallback(async () => {
    if (!db || !reportStartDate || !reportEndDate) {
        toast({ variant: 'destructive', title: 'তারিখ নির্বাচন করুন' });
        return;
    }
    setIsReportLoading(true);
    try {
        const start = format(reportStartDate, 'yyyy-MM-dd');
        const end = format(reportEndDate, 'yyyy-MM-dd');
        const [records, holidayList] = await Promise.all([
            getStaffAttendanceForRange(db, start, end),
            getHolidays(db)
        ]);
        setRangeRecords(records);
        setHolidays(holidayList.map(h => h.date));
        toast({ title: 'রিপোর্ট প্রস্তুত হয়েছে' });
    } catch (e) {}
    setIsReportLoading(false);
  }, [db, reportStartDate, reportEndDate, toast]);

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

  const activeStaffList = useMemo(() => [...sortedTeachers, ...sortedEmployees].filter(s => s.isActive), [sortedTeachers, sortedEmployees]);

  const sidebarItems = useMemo(() => {
      const items = [
          { id: 'list', label: 'স্টাফ তালিকা', icon: List, color: 'text-orange-600 bg-orange-50' }
      ];
      if (canManageAttendance) {
          items.push({ id: 'attendance', label: 'দৈনিক হাজিরা ও ছুটি', icon: ClipboardCheck, color: 'text-emerald-600 bg-emerald-50' });
      }
      if (canViewAttendanceReport) {
          items.push({ id: 'report', label: 'হাজিরা ও ছুটির রিপোর্ট', icon: FileBarChart, color: 'text-blue-600 bg-blue-50' });
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
                        <Image src={staff.photoUrl || 'https://picsum.photos/seed/staff/40/40'} alt={staff.nameBn} width={40} height={40} className="rounded-full object-cover border shadow-sm" />
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
      if (!reportStartDate || !reportEndDate) return [];
      const activeTeachers = activeStaffList;
      const chunks = [];
      for (let i = 0; i < activeTeachers.length; i += 3) {
          chunks.push(activeTeachers.slice(i, i + 3));
      }
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const allDaysInRange = eachDayOfInterval({ start: reportStartDate, end: reportEndDate });
      const days = allDaysInRange.filter(day => !isAfter(day, today));
      return chunks.map(chunk => ({ teachers: chunk, days }));
  }, [activeStaffList, reportStartDate, reportEndDate]);

  const renderReportPage = (page: any, pageIdx: number) => {
      const displayRange = reportStartDate && reportEndDate ? 
          `${toBengaliNumber(format(reportStartDate, "dd-MM-yyyy", { locale: bn }))} হতে ${toBengaliNumber(format(reportEndDate, "dd-MM-yyyy", { locale: bn }))}` : "";

      return (
          <div key={pageIdx} className="report-page bg-white flex flex-col h-full border border-black/5 p-2">
              <div className="report-header text-center flex flex-col items-center border-b-2 border-black pb-2 mb-4">
                  {schoolInfo.logoUrl && <img src={schoolInfo.logoUrl} alt="লোগো" width={55} height={55} className="object-contain mb-1" />}
                  <h1 className="text-2xl font-black uppercase text-emerald-950 leading-tight">{schoolInfo.name}</h1>
                  <p className="text-xs font-bold text-slate-700">{schoolInfo.address}</p>
                  <div className="mt-2 inline-block border-[1.5px] border-black px-6 py-0.5 rounded-full bg-slate-50">
                      <h2 className="text-[11px] font-black uppercase tracking-tight">হাজিরা ও ছুটির রিপোর্ট: {displayRange}</h2>
                  </div>
              </div>

              <table className="report-table w-full border-collapse border border-black">
                  <thead>
                      <tr className="bg-slate-100">
                          <th className="w-[110px] font-black py-2 border border-black text-[9px]">তারিখ ও বার</th>
                          {page.teachers.map((teacher: any) => (
                              <th key={teacher.id} className="py-2 border border-black">
                                  <p className="font-black text-[9px] text-blue-900">{teacher.nameBn}</p>
                                  <p className="text-[7px] italic font-bold text-slate-600">{teacher.designation}</p>
                              </th>
                          ))}
                      </tr>
                  </thead>
                  <tbody>
                      {page.days.map((day: any) => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const isWeekendDay = day.getDay() === 5 || day.getDay() === 6;
                          const isHolidayDay = holidays.includes(dateStr);
                          const isOffDay = isWeekendDay || isHolidayDay;
                          const displayDate = toBengaliNumber(format(day, "dd-MM-yyyy", { locale: bn })) + " " + format(day, "EEEE", { locale: bn });

                          return (
                              <tr key={dateStr} className={cn("h-8 border border-black", isOffDay && "bg-rose-50/50")}>
                                  <td className="text-left pl-3 font-bold text-[8.5px] border border-black">{displayDate}</td>
                                  {page.teachers.map((teacher: any) => {
                                      const record = rangeRecords.find(r => r.date === dateStr);
                                      const att = record?.attendance.find(a => a.staffId === teacher.id);
                                      let cellText = "";
                                      if (att) {
                                          if (att.status === 'present') {
                                              cellText = att.checkIn ? `${att.checkIn}${att.checkOut ? ` - ${att.checkOut}` : ''}` : 'উপস্থিত';
                                          } else {
                                              cellText = att.leaveType || 'ছুটি';
                                          }
                                      } else if (isHolidayDay) { cellText = "সরকারি ছুটি"; }
                                      else if (isWeekendDay) { cellText = "সাপ্তাহিক ছুটি"; }
                                      else { cellText = "অনুপস্থিত"; }

                                      return (
                                          <td key={teacher.id} className={cn(
                                              "font-medium border border-black text-center text-[8.5px]",
                                              cellText === "অনুপস্থিত" && "text-rose-600 font-black",
                                              (cellText === "সাপ্তাহিক ছুটি" || cellText === "সরকারি ছুটি") && "text-slate-400 font-normal"
                                          )}>
                                              {toBengaliNumber(cellText)}
                                          </td>
                                      );
                                  })}
                              </tr>
                          );
                      })}
                      
                      <tr className="summary-row font-black bg-slate-50 border-t-2 border-black h-9">
                          <td className="text-right pr-4 border border-black text-[9px]">মোট কর্মদিবস</td>
                          {page.teachers.map((teacher: any) => {
                              const totalWorkDays = page.days.filter((d: any) => {
                                  const ds = format(d, 'yyyy-MM-dd');
                                  return !((d.getDay() === 5 || d.getDay() === 6) || holidays.includes(ds));
                              }).length;
                              return <td key={teacher.id} className="text-blue-900 border border-black text-center text-[9px]">{toBengaliNumber(totalWorkDays)} দিন</td>;
                          })}
                      </tr>
                      <tr className="summary-row font-black h-9">
                          <td className="text-right pr-4 border border-black text-[9px]">উপস্থিত (মোট)</td>
                          {page.teachers.map((teacher: any) => {
                              const count = rangeRecords.filter(r => r.attendance.some(a => a.staffId === teacher.id && a.status === 'present')).length;
                              return <td key={teacher.id} className="text-emerald-700 border border-black text-center text-[9px]">{toBengaliNumber(count)} দিন</td>;
                          })}
                      </tr>
                      <tr className="summary-row font-black h-9">
                          <td className="text-right pr-4 border border-black text-[9px]">অনুপস্থিত (মোট)</td>
                          {page.teachers.map((teacher: any) => {
                              const count = page.days.filter((d: any) => {
                                  const ds = format(d, 'yyyy-MM-dd');
                                  if (holidays.includes(ds) || (d.getDay() === 5 || d.getDay() === 6)) return false;
                                  const r = rangeRecords.find(rec => rec.date === ds);
                                  const a = r?.attendance.find(at => at.staffId === teacher.id);
                                  return !a || (a.status !== 'present' && a.status !== 'leave');
                              }).length;
                              return <td key={teacher.id} className="text-rose-700 border border-black text-center text-[9px]">{toBengaliNumber(count)} দিন</td>;
                          })}
                      </tr>
                  </tbody>
              </table>
              
              <div className="report-footer flex justify-between items-end mt-auto pt-10 px-8 pb-4">
                  <div className="sign-box w-44 border-t border-black text-center pt-1 font-black text-[9px]">হিসাবরক্ষকের স্বাক্ষর</div>
                  <div className="sign-box w-44 border-t border-black text-center pt-1 font-black text-[9px]">প্রধান শিক্ষকের স্বাক্ষর ও সিল</div>
              </div>
          </div>
      );
  };

  const currentSelectedStaff = useMemo(() => {
    return activeStaffList.find(s => s.id === selectedStaffId);
  }, [activeStaffList, selectedStaffId]);

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
                        <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">{schoolInfo.name}</p>
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
                    <div className="space-y-8 animate-in fade-in duration-500 no-print">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border-2 border-orange-100 rounded-xl bg-white shadow-sm items-end">
                            <div className="space-y-2">
                                <Label className="font-black text-primary flex items-center gap-2"><Calendar className="h-4 w-4" /> তারিখ নির্বাচন</Label>
                                <DatePicker value={selectedDate} onChange={setSelectedDate} />
                                <p className="text-[10px] font-black text-muted-foreground mt-1 italic">
                                    {selectedDate ? format(selectedDate, 'EEEE, d MMMM yyyy', { locale: bn }) : ''}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-black text-primary flex items-center gap-2">হাজিরা ধাপ নির্বাচন</Label>
                                <RadioGroup 
                                    value={attendanceMode} 
                                    onValueChange={(v) => {
                                        setAttendanceMode(v as 'arrival' | 'departure');
                                        setSelectedStaffId('');
                                        setTempEntry(null);
                                    }}
                                    className="flex h-10 items-center gap-4 bg-slate-50 border-2 border-primary/10 rounded-md px-4"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="arrival" id="mode-arrival" />
                                        <Label htmlFor="mode-arrival" className="font-black text-xs cursor-pointer flex items-center gap-1"><LogIn className="h-3 w-3 text-emerald-600" /> আগমণ</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="departure" id="mode-departure" />
                                        <Label htmlFor="mode-departure" className="font-black text-xs cursor-pointer flex items-center gap-1"><LogOut className="h-3 w-3 text-rose-600" /> প্রস্থান</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-black text-primary flex items-center gap-2"><Users className="h-4 w-4" /> শিক্ষক বা কর্মচারী নির্বাচন</Label>
                                <Select value={selectedStaffId} onValueChange={handleStaffSelect}>
                                    <SelectTrigger className="h-10 bg-slate-50 border-2 border-primary/10 font-bold">
                                        <SelectValue placeholder="নাম সিলেক্ট করুন" />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[300px]">
                                        {activeStaffList.map(s => (
                                            <SelectItem key={s.id} value={s.id} className="font-bold">{s.nameBn} ({s.designation})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {selectedStaffId && tempEntry && currentSelectedStaff && (
                            <Card className="border-4 border-primary rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                                <CardHeader className="bg-primary/5 border-b-2 border-primary/10">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-16 w-16 border-4 border-white shadow-md">
                                            <AvatarImage src={currentSelectedStaff.photoUrl} />
                                            <AvatarFallback className="font-black text-xl bg-muted text-muted-foreground">
                                                {currentSelectedStaff.nameBn?.charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <CardTitle className="text-2xl font-black text-slate-900">{currentSelectedStaff.nameBn}</CardTitle>
                                            <CardDescription className="text-primary font-bold text-base">
                                                {currentSelectedStaff.designation}
                                            </CardDescription>
                                        </div>
                                        <Badge className={cn("ml-auto font-black px-4 h-8 text-sm uppercase", attendanceMode === 'arrival' ? "bg-emerald-600" : "bg-rose-600")}>
                                            {attendanceMode === 'arrival' ? 'আগমণ ধাপ' : 'প্রস্থান ধাপ'}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-8 space-y-6">
                                    {attendanceMode === 'arrival' ? (
                                        <>
                                            <div className="flex justify-center gap-4 mb-6">
                                                <Button 
                                                    size="lg" 
                                                    className={cn("flex-1 h-14 text-lg font-black transition-all", tempEntry.status === 'present' ? "bg-emerald-600 shadow-lg ring-4 ring-emerald-100" : "bg-white text-emerald-600 border-2 border-emerald-600 hover:bg-emerald-50")}
                                                    onClick={() => handleTempStatusChange('present')}
                                                >
                                                    <CheckCircle2 className="mr-2" /> উপস্থিত
                                                </Button>
                                                <Button 
                                                    size="lg" 
                                                    className={cn("flex-1 h-14 text-lg font-black transition-all", tempEntry.status === 'leave' ? "bg-rose-600 shadow-lg ring-4 ring-rose-100" : "bg-white text-rose-600 border-2 border-rose-600 hover:bg-rose-50")}
                                                    onClick={() => handleTempStatusChange('leave')}
                                                >
                                                    <UserX className="mr-2" /> ছুটি
                                                </Button>
                                            </div>

                                            {tempEntry.status === 'present' ? (
                                                <div className="bg-emerald-50/50 p-6 rounded-2xl border-2 border-dashed border-emerald-200">
                                                    <div className="space-y-2 max-w-xs mx-auto">
                                                        <Label className="font-black text-emerald-800 flex items-center justify-center gap-1"><Clock className="h-3.5 w-3.5" /> আগমনের সময়</Label>
                                                        <Input 
                                                            value={tempEntry.checkIn || ''} 
                                                            onChange={e => setTempEntry({...tempEntry, checkIn: e.target.value})} 
                                                            onKeyDown={(e) => e.key === 'Enter' && handleSaveIndividualAttendance()}
                                                            className="h-11 font-black text-center bg-white text-xl border-2 border-emerald-300" 
                                                            placeholder="উদা: ১০:৩০ AM" 
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-rose-50/50 p-6 rounded-2xl border-2 border-dashed border-rose-200 space-y-4">
                                                    <Label className="font-black text-rose-800">ছুটির ধরন নির্বাচন করুন</Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {LEAVE_TYPES.map(t => (
                                                            <Button 
                                                                key={t.id} 
                                                                variant={tempEntry.leaveType === t.id ? "default" : "outline"}
                                                                size="sm" 
                                                                className={cn("h-9 px-4 font-black shadow-sm", tempEntry.leaveType === t.id ? "bg-rose-600" : "bg-white")}
                                                                onClick={() => setTempEntry({...tempEntry, leaveType: t.id})}
                                                            >
                                                                {t.label}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="bg-rose-50/50 p-6 rounded-2xl border-2 border-dashed border-rose-200">
                                            <div className="space-y-2 max-w-xs mx-auto">
                                                <Label className="font-black text-rose-800 flex items-center justify-center gap-1"><Clock className="h-3.5 w-3.5" /> প্রস্থানের সময়</Label>
                                                <Input 
                                                    value={tempEntry.checkOut || ''} 
                                                    onChange={e => setTempEntry({...tempEntry, checkOut: e.target.value})} 
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveIndividualAttendance()}
                                                    className="h-11 font-black text-center bg-white text-xl border-2 border-rose-300" 
                                                    placeholder="উদা: ০৪:০০ PM" 
                                                />
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                                <CardFooter className="bg-slate-50 p-6 border-t flex justify-between gap-4">
                                    <Button variant="ghost" onClick={() => { setSelectedStaffId(''); setTempEntry(null); }} className="font-bold h-12 px-8">বাতিল</Button>
                                    <Button 
                                        onClick={handleSaveIndividualAttendance} 
                                        disabled={isAttendanceLoading}
                                        className="h-12 px-12 text-lg font-black shadow-xl"
                                    >
                                        {isAttendanceLoading ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                                        হাজিরা নিশ্চিত করুন
                                    </Button>
                                </CardFooter>
                            </Card>
                        )}

                        <div className="space-y-4">
                            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2 border-b-4 border-emerald-600 pb-2 max-w-fit px-2">
                                <UserCheck className="h-6 w-6 text-emerald-600" /> আজকের গৃহীত হাজিরা তালিকা
                            </h3>
                            <div className="table-container shadow-xl border-2">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="w-16 font-black">ক্রমিক</TableHead>
                                            <TableHead className="font-black">নাম ও পদবি</TableHead>
                                            <TableHead className="text-center font-black">অবস্থা</TableHead>
                                            <TableHead className="text-center font-black">সময় / ছুটির ধরন</TableHead>
                                            <TableHead className="text-center font-black">রেকর্ড সময়</TableHead>
                                            <TableHead className="text-right font-black">কার্যক্রম</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dailyAttendance?.attendance.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-16 italic font-bold text-muted-foreground">
                                                    আজকের কোনো হাজিরা এখনো নেওয়া হয়নি।
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            dailyAttendance?.attendance.map((att, index) => {
                                                const staff = activeStaffList.find(s => s.id === att.staffId);
                                                return (
                                                    <TableRow key={att.staffId} className="h-16 hover:bg-slate-50 transition-colors">
                                                        <TableCell className="font-bold">{toBengaliNumber(index + 1)}</TableCell>
                                                        <TableCell>
                                                            <div className="font-black text-sm text-slate-800">{staff?.nameBn}</div>
                                                            <div className="text-[10px] font-bold text-muted-foreground">{staff?.designation}</div>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Badge className={cn("font-black px-4", att.status === 'present' ? "bg-emerald-600" : "bg-rose-600")}>
                                                                {att.status === 'present' ? 'উপস্থিত' : 'ছুটি'}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {att.status === 'present' ? (
                                                                <div className="flex flex-col items-center">
                                                                    <span className="text-[11px] font-black text-blue-900">{att.checkIn || '-'}{att.checkOut ? ` - ${att.checkOut}` : ''}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-xs font-black text-rose-700">{LEAVE_TYPES.find(t => t.id === att.leaveType)?.label}</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <span className="text-[9px] font-bold text-muted-foreground whitespace-nowrap">আগমণ: {toBengaliNumber(att.entryTime || '-')}</span>
                                                                <span className="text-[9px] font-bold text-muted-foreground whitespace-nowrap">প্রস্থান: {toBengaliNumber(att.exitTime || '-')}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" onClick={() => handleStaffSelect(att.staffId)}><Edit2 className="h-4 w-4" /></Button>
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => handleDeleteEntry(att.staffId)}><Trash2 className="h-4 w-4" /></Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                {activeSection === 'report' && (
                    <div className="space-y-8 animate-in fade-in duration-500 no-print">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-2 border-blue-100 rounded-xl bg-white shadow-sm items-end">
                            <div className="space-y-2">
                                <Label className="font-black text-primary">হতে (শুরুর তারিখ)</Label>
                                <DatePicker value={reportStartDate} onChange={setReportStartDate} />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-black text-primary">পর্যন্ত (শেষের তারিখ)</Label>
                                <DatePicker value={reportEndDate} onChange={setReportEndDate} />
                            </div>
                            <Button className="font-black h-10 shadow-sm" onClick={fetchReport} disabled={isReportLoading || !reportStartDate || !reportEndDate}>
                                {isReportLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                                রিপোর্ট তৈরি করুন
                            </Button>
                            <Button variant="outline" className="font-black h-10 border-primary text-primary" onClick={() => window.print()} disabled={rangeRecords.length === 0}>
                                <Printer className="mr-2 h-4 w-4" /> রিপোর্ট প্রিন্ট
                            </Button>
                        </div>

                        {rangeRecords.length > 0 && (
                            <div className="space-y-8">
                                <div className="p-4 bg-blue-50 border-2 border-dashed border-blue-200 rounded-xl text-center no-print">
                                    <Badge className="bg-emerald-600 px-6 py-1 text-sm font-black shadow-lg mb-2">রিপোর্ট প্রস্তুত হয়েছে!</Badge>
                                    <p className="font-bold text-blue-700">নিচে প্রফেশনাল প্রিভিউ দেখা যাচ্ছে। আপনি চাইলে সরাসরি প্রিন্ট করতে পারেন।</p>
                                </div>
                                <div className="flex flex-col gap-12 items-center bg-slate-100 p-4 sm:p-10 rounded-3xl border-2 border-slate-200 shadow-inner overflow-x-auto">
                                    {reportPages.map((page, pageIdx) => (
                                        <div key={pageIdx} className="bg-white shadow-2xl shrink-0 overflow-hidden transform scale-95 sm:scale-100 origin-top">
                                            <div style={{ width: '210mm', minHeight: '297mm', padding: '10mm' }} className="box-border">
                                                {renderReportPage(page, pageIdx)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
      </main>

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
                  .report-table { border: 1.2px solid black !important; width: 100%; border-collapse: collapse; }
                  .report-table th, .report-table td { 
                      border: 1px solid black !important; 
                      padding: 4.5px 1px !important; 
                      text-align: center; 
                      font-size: 8.5px; 
                      line-height: 1.2; 
                  }
                  .report-table th { font-weight: 900 !important; background-color: #f1f5f9 !important; }
                  .summary-row td { background-color: #f8fafc !important; font-weight: 900 !important; font-size: 9px !important; border-top: 1.5px solid black !important; }
                  .report-footer { margin-top: auto; padding-top: 15px; width: 100%; display: flex; justify-content: space-between; padding-left: 20px; padding-right: 20px; padding-bottom: 10px; }
                  .sign-box { border-top: 1.5px solid black; width: 50mm; text-align: center; font-size: 9px; font-weight: 900; padding-top: 3px; }
              }
          `}</style>
          {reportPages.map((page, pageIdx) => (
              <div key={pageIdx} className="report-page">
                  {renderReportPage(page, pageIdx)}
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
