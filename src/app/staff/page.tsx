
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { deleteStaff, Staff, staffFromDoc } from '@/lib/staff-data';
import { Eye, FilePen, Trash2, Clock, Calendar, Briefcase, Check, X, Info } from 'lucide-react';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, orderBy, FirestoreError } from 'firebase/firestore';
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

export default function StaffListPage() {
  const [allStaff, setAllStaff] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [staffToView, setStaffToView] = useState<Staff | null>(null);
  const db = useFirestore();
  const [isClient, setIsClient] = useState(false);
  const { user, hasPermission } = useAuth();
  const canManageStaff = hasPermission('manage:staff');

  // Attendance State
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dailyAttendance, setDailyAttendance] = useState<StaffDailyAttendance | null>(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState(false);

  // Leave Report State
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

    const staffQuery = query(collection(db, "staff"), orderBy("joinDate", "asc"));

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
    const record = await getStaffAttendanceByDate(db, selectedDate);
    setDailyAttendance(record || { date: selectedDate, attendance: [] });
    setIsAttendanceLoading(false);
  }, [db, selectedDate]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

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
            nextAtt.push({ staffId, [field]: value } as any);
        }
        return { ...prev, attendance: nextAtt };
    });
  };

  const handleSaveDailyAttendance = () => {
    if (!db || !dailyAttendance) return;
    saveStaffAttendance(db, dailyAttendance);
    toast({ title: 'দৈনিক হাজিরা ও ছুটি সংরক্ষিত হয়েছে' });
  };

  const fetchReport = async () => {
    if (!db) return;
    setIsReportLoading(true);
    const start = format(startOfMonth(new Date(parseInt(reportYear), parseInt(reportMonth))), 'yyyy-MM-dd');
    const end = format(endOfMonth(new Date(parseInt(reportYear), parseInt(reportMonth))), 'yyyy-MM-dd');
    const records = await getStaffAttendanceForRange(db, start, end);
    setRangeRecords(records);
    setIsReportLoading(false);
  };

  const staffTypeMap: { [key: string]: string } = { 'teacher': 'শিক্ষক', 'staff': 'কর্মচারী' };

  const handleDeleteStaff = (staffId: string) => {
    if (!db) return;
    deleteStaff(db, staffId).then(() => {
        toast({ title: "রেকর্ড ডিলিট হয়েছে" });
    }).catch(() => {});
  };

  return (
    <>
    <div className="flex min-h-screen w-full flex-col bg-orange-100 font-kalpurush">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-80">
        <Card className="border-2 border-orange-200">
          <CardHeader>
             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <CardTitle className="text-3xl font-black">শিক্ষক ও কর্মচারী ব্যবস্থাপনা</CardTitle>
                    <CardDescription>তালিকা, হাজিরা ও ছুটির বিবরণ পরিচালনা করুন</CardDescription>
                </div>
                {canManageStaff && (
                    <Link href="/add-staff">
                        <Button className="font-bold"><Briefcase className="mr-2 h-4 w-4" /> নতুন যোগ করুন</Button>
                    </Link>
                )}
            </div>
          </CardHeader>
          <CardContent>
             {isClient ? (
                <Tabs defaultValue="list" className="space-y-6">
                    <TabsList className="grid w-full grid-cols-3 bg-muted p-1">
                        <TabsTrigger value="list" className="font-bold">স্টাফ তালিকা</TabsTrigger>
                        <TabsTrigger value="attendance" className="font-bold">দৈনিক হাজিরা ও ছুটি</TabsTrigger>
                        <TabsTrigger value="report" className="font-bold">ছুটির রিপোর্ট</TabsTrigger>
                    </TabsList>

                    {/* Staff List Tab */}
                    <TabsContent value="list">
                        <div className="table-container">
                            <Table>
                                <TableHeader className="bg-muted/50 sticky top-0 z-20">
                                <TableRow>
                                    <TableHead>ক্রমিক</TableHead>
                                    <TableHead>ছবি</TableHead>
                                    <TableHead>আইডি</TableHead>
                                    <TableHead>নাম</TableHead>
                                    <TableHead>পদবি</TableHead>
                                    <TableHead>মোবাইল</TableHead>
                                    <TableHead>ধরণ</TableHead>
                                    <TableHead className="text-right">কার্যক্রম</TableHead>
                                </TableRow>
                                </TableHeader>
                                <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={8} className="text-center py-8 italic">লোড হচ্ছে...</TableCell></TableRow>
                                ) : allStaff.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground italic">কোনো তথ্য পাওয়া যায়নি।</TableCell></TableRow>
                                ) : (
                                    allStaff.map((staff, index) => (
                                    <TableRow key={staff.id} className="hover:bg-muted/10 h-14">
                                        <TableCell>{toBengaliNumber(index + 1)}</TableCell>
                                        <TableCell>
                                            <Image src={staff.photoUrl} alt={staff.nameBn} width={40} height={40} className="rounded-full object-cover border" />
                                        </TableCell>
                                        <TableCell>{toBengaliNumber(staff.employeeId || 'N/A')}</TableCell>
                                        <TableCell className="whitespace-nowrap font-bold text-primary">{staff.nameBn}</TableCell>
                                        <TableCell className="whitespace-nowrap font-medium text-xs">{staff.designation}</TableCell>
                                        <TableCell className="text-xs">{staff.mobile}</TableCell>
                                        <TableCell>
                                            <Badge variant={staff.staffType === 'teacher' ? 'default' : 'secondary'} className="text-[10px] font-bold">
                                                {staffTypeMap[staff.staffType]}
                                            </Badge>
                                        </TableCell>
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
                                    ))
                                )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    {/* Attendance Tab */}
                    <TabsContent value="attendance" className="space-y-6">
                        <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg bg-white/50 items-end">
                            <div className="space-y-2 flex-1">
                                <Label className="font-bold text-primary">তারিখ নির্বাচন</Label>
                                <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                            </div>
                            <div className="flex-1 text-[10px] text-muted-foreground italic pb-2">
                                {format(new Date(selectedDate), 'EEEE, d MMMM yyyy', { locale: bn })}
                            </div>
                        </div>

                        <div className="table-container">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow>
                                        <TableHead>নাম ও পদবি</TableHead>
                                        <TableHead className="text-center">অবস্থা</TableHead>
                                        <TableHead className="text-center">ছুটির ধরন</TableHead>
                                        <TableHead className="text-center">আসার সময়</TableHead>
                                        <TableHead className="text-center">যাওয়ার সময়</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allStaff.filter(s => s.isActive).map(staff => {
                                        const att = dailyAttendance?.attendance.find(a => a.staffId === staff.id) || { status: 'present' };
                                        return (
                                            <TableRow key={staff.id} className="h-16">
                                                <TableCell>
                                                    <div className="font-bold text-sm">{staff.nameBn}</div>
                                                    <div className="text-[10px] text-muted-foreground italic">{staff.designation}</div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex justify-center gap-1">
                                                        <Button 
                                                            size="sm" 
                                                            variant={att.status === 'present' ? 'default' : 'outline'}
                                                            className={cn("h-8 text-[10px] font-black", att.status === 'present' ? "bg-emerald-600 hover:bg-emerald-700" : "text-emerald-600 border-emerald-200")}
                                                            onClick={() => handleStatusChange(staff.id, 'present')}
                                                        >
                                                            <Check className="h-3 w-3 mr-1" /> উপস্থিত
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant={att.status === 'leave' ? 'default' : 'outline'}
                                                            className={cn("h-8 text-[10px] font-black", att.status === 'leave' ? "bg-rose-600 hover:bg-rose-700" : "text-rose-600 border-rose-200")}
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
                                                        <SelectTrigger className="h-8 text-[10px] w-32 mx-auto"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                                                        <SelectContent>
                                                            {LEAVE_TYPES.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Input 
                                                        type="time" 
                                                        className="h-8 text-[10px] w-24 mx-auto" 
                                                        disabled={att.status !== 'present'}
                                                        value={att.checkIn || ""}
                                                        onChange={e => handleAttendanceDetailChange(staff.id, 'checkIn', e.target.value)}
                                                    />
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Input 
                                                        type="time" 
                                                        className="h-8 text-[10px] w-24 mx-auto" 
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
                        <div className="flex justify-end p-4">
                            <Button onClick={handleSaveDailyAttendance} className="font-bold shadow-lg" size="lg">
                                <Clock className="mr-2 h-4 w-4" /> হাজিরা সেভ করুন
                            </Button>
                        </div>
                    </TabsContent>

                    {/* Report Tab */}
                    <TabsContent value="report" className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-lg bg-white/50 items-end">
                            <div className="space-y-2">
                                <Label className="font-bold text-primary">মাস</Label>
                                <Select value={reportMonth} onValueChange={setReportMonth}>
                                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {BENGALI_MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold text-primary">শিক্ষক/কর্মচারী</Label>
                                <Select value={reportStaffId} onValueChange={setReportStaffId}>
                                    <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">সকল স্টাফ</SelectItem>
                                        {allStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.nameBn}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button className="font-bold" onClick={fetchReport} disabled={isReportLoading}>
                                {isReportLoading ? 'তৈরি হচ্ছে...' : 'রিপোর্ট দেখুন'}
                            </Button>
                        </div>

                        {rangeRecords.length > 0 && (
                            <div className="space-y-8 animate-in fade-in duration-500">
                                {allStaff.filter(s => reportStaffId === 'all' || s.id === reportStaffId).map(staff => {
                                    const staffLeaves = rangeRecords.filter(r => 
                                        r.attendance.some(a => a.staffId === staff.id && a.status === 'leave')
                                    );
                                    
                                    if (staffLeaves.length === 0 && reportStaffId !== 'all') {
                                        return <p key={staff.id} className="text-center p-12 text-emerald-600 font-bold">এই মাসে এই স্টাফ কোনো ছুটি নেননি।</p>;
                                    }
                                    if (staffLeaves.length === 0) return null;

                                    return (
                                        <Card key={staff.id} className="border-2 border-primary/10 overflow-hidden shadow-sm">
                                            <CardHeader className="bg-primary/5 pb-2">
                                                <div className="flex justify-between items-center">
                                                    <CardTitle className="text-lg">{staff.nameBn} - ছুটির বিবরণ</CardTitle>
                                                    <Badge variant="outline" className="bg-white font-black text-rose-700 border-rose-200">
                                                        মোট ছুটি: {toBengaliNumber(staffLeaves.length)} দিন
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-0">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow className="bg-muted/20">
                                                            <TableHead>তারিখ</TableHead>
                                                            <TableHead>বার</TableHead>
                                                            <TableHead className="text-center">ছুটির ধরণ</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {staffLeaves.sort((a,b) => a.date.localeCompare(b.date)).map(record => {
                                                            const att = record.attendance.find(a => a.staffId === staff.id);
                                                            const leaveType = LEAVE_TYPES.find(t => t.id === att?.leaveType);
                                                            return (
                                                                <TableRow key={record.date} className="h-10 text-xs">
                                                                    <TableCell>{format(new Date(record.date), 'dd MMM yyyy', { locale: bn })}</TableCell>
                                                                    <TableCell>{format(new Date(record.date), 'EEEE', { locale: bn })}</TableCell>
                                                                    <TableCell className="text-center">
                                                                        <Badge variant="outline" className={cn("text-[10px] font-bold px-3", leaveType?.color)}>
                                                                            {leaveType?.label || att?.leaveType || 'অন্যান্য'}
                                                                        </Badge>
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
                    </TabsContent>
                </Tabs>
             ) : (
                <div className="space-y-4">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
             )}
          </CardContent>
        </Card>
      </main>
    </div>

    <Dialog open={!!staffToView} onOpenChange={(isOpen) => !isOpen && setStaffToView(null)}>
        <DialogContent className="max-w-xl">
             {staffToView && (
                <>
                    <DialogHeader className="flex-row items-center gap-4">
                        <Image src={staffToView.photoUrl || 'https://picsum.photos/seed/staff/96/96'} alt={staffToView.nameBn} width={80} height={80} className="rounded-lg object-cover border" />
                        <div>
                            <DialogTitle className="text-2xl mb-1">{staffToView.nameBn}</DialogTitle>
                            <DialogDescription className="font-bold text-primary">
                                {staffToView.designation}
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto pr-4">
                        <div className="space-y-4 py-4 text-sm font-medium">
                            <p className="flex justify-between border-b pb-1"><span className="text-muted-foreground">কর্মচারী আইডি:</span> <span>{toBengaliNumber(staffToView.employeeId || 'N/A')}</span></p>
                            <p className="flex justify-between border-b pb-1"><span className="text-muted-foreground">নাম (ইংরেজি):</span> <span>{staffToView.nameEn || 'N/A'}</span></p>
                            <p className="flex justify-between border-b pb-1"><span className="text-muted-foreground">জন্ম তারিখ:</span> <span>{staffToView.dob ? format(new Date(staffToView.dob), "d MMMM yyyy", { locale: bn }) : 'N/A'}</span></p>
                            <p className="flex justify-between border-b pb-1"><span className="text-muted-foreground">বিষয়:</span> <span>{staffToView.subject || 'N/A'}</span></p>
                            <p className="flex justify-between border-b pb-1"><span className="text-muted-foreground">মোবাইল:</span> <span>{toBengaliNumber(staffToView.mobile)}</span></p>
                            <p className="flex justify-between border-b pb-1"><span className="text-muted-foreground">যোগদানের তারিখ:</span> <span>{staffToView.joinDate ? format(new Date(staffToView.joinDate), "d MMMM yyyy", { locale: bn }) : 'N/A'}</span></p>
                            <p className="flex justify-between border-b pb-1"><span className="text-muted-foreground">শিক্ষাগত যোগ্যতা:</span> <span>{staffToView.education || 'N/A'}</span></p>
                            <p className="flex flex-col border-b pb-1"><span className="text-muted-foreground mb-1">ঠিকানা:</span> <span>{staffToView.address || 'N/A'}</span></p>
                        </div>
                    </div>
                </>
             )}
        </DialogContent>
    </Dialog>
    </>
  );
}

function toBengaliNumber(str: string | number) {
  if (!str && str !== 0) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
}
