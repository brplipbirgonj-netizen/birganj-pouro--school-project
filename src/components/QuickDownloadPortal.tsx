'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Users, 
  Trophy, 
  Banknote, 
  Users2, 
  Loader2, 
  ChevronRight, 
  Search,
  Sparkles,
  FileUp,
  LayoutGrid,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight
} from 'lucide-react';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/useAuth';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { getExams, Exam } from '@/lib/exam-data';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

const classNamesMap: Record<string, string> = {
    '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

const toBengaliNumber = (str: string | number | undefined | null) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

export function QuickDownloadPortal() {
  const db = useFirestore();
  const { selectedYear } = useAcademicYear();
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>('6');
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (db && selectedYear && isOpen) {
      getExams(db, selectedYear).then(data => {
        setExams(data);
        if (data.length > 0) setSelectedExam(data[0].name);
      });
    }
  }, [db, selectedYear, isOpen]);

  const handleDownloadStudentExcel = async () => {
    if (!db) return;
    setIsProcessing(true);
    try {
      const q = query(
        collection(db, 'students'), 
        where('academicYear', '==', selectedYear),
        where('className', '==', selectedClass)
      );
      const snap = await getDocs(q);
      const students = snap.docs.map(d => {
        const s = d.data();
        return {
          'রোল': s.roll,
          'আইডি': s.generatedId || '-',
          'নাম (বাংলা)': s.studentNameBn,
          'পিতার নাম': s.fatherNameBn,
          'মাতার নাম': s.motherNameBn,
          'মোবাইল': s.guardianMobile || s.studentMobile || '-',
          'লিঙ্গ': s.gender === 'male' ? 'ছাত্র' : 'ছাত্রী',
          'ধর্ম': s.religion || '-',
          'গ্রাম': s.presentVillage || '-',
          'ইউনিয়ন': s.presentUnion || '-'
        };
      }).sort((a, b) => (a['রোল'] || 0) - (b['রোল'] || 0));

      if (students.length === 0) {
        toast({ variant: 'destructive', title: 'কোনো ডাটা পাওয়া যায়নি' });
        setIsProcessing(false);
        return;
      }

      const ws = XLSX.utils.json_to_sheet(students);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Student List");
      XLSX.writeFile(wb, `StudentList_${classNamesMap[selectedClass]}_${selectedYear}.xlsx`);
      toast({ title: 'Excel ডাউনলোড সম্পন্ন হয়েছে' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'ডাউনলোড ব্যর্থ হয়েছে' });
    }
    setIsProcessing(false);
  };

  const handleDownloadStaffExcel = async () => {
    if (!db) return;
    setIsProcessing(true);
    try {
      const snap = await getDocs(collection(db, 'staff'));
      const staff = snap.docs.map(d => {
        const s = d.data();
        return {
          'আইডি': s.employeeId,
          'নাম': s.nameBn,
          'পদবি': s.designation,
          'বিষয়': s.subject || '-',
          'মোবাইল': s.mobile,
          'যোগদান': s.joinDate ? format(new Date(s.joinDate.toDate()), 'dd-MM-yyyy') : '-'
        };
      });

      const ws = XLSX.utils.json_to_sheet(staff);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Staff List");
      XLSX.writeFile(wb, `StaffList_BPHS.xlsx`);
      toast({ title: 'স্টাফ তালিকা ডাউনলোড হয়েছে' });
    } catch (e) {
      console.error(e);
    }
    setIsProcessing(false);
  };

  const openPrintable = (path: string) => {
    window.open(path, '_blank');
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          className="h-10 px-4 rounded-xl bg-white/20 text-white hover:bg-white/30 shadow-sm border border-white/20 font-black gap-2 transition-all active:scale-95"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">কুইক ডাউনলোড</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 font-kalpurush border-none shadow-2xl rounded-2xl overflow-hidden z-[200]">
        <div className="bg-primary p-4 text-white">
            <h3 className="font-black flex items-center gap-2">
                <Download className="h-5 w-5" /> সেন্ট্রাল ডাউনলোড পোর্টাল
            </h3>
            <p className="text-[10px] font-bold text-white/70 mt-0.5">সব সেকশনের ফাইল এক জায়গা থেকে ডাউনলোড করুন</p>
        </div>
        
        <div className="p-4 bg-slate-50 border-b space-y-3">
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">শ্রেণি নির্বাচন</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger className="h-8 bg-white border-2 text-[11px] font-black"><SelectValue /></SelectTrigger>
                        <SelectContent className="font-kalpurush">
                            {Object.entries(classNamesMap).map(([id, label]) => (
                                <SelectItem key={id} value={id}>{label} শ্রেণি</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">পরীক্ষা নির্বাচন</Label>
                    <Select value={selectedExam} onValueChange={setSelectedExam}>
                        <SelectTrigger className="h-8 bg-white border-2 text-[11px] font-black"><SelectValue placeholder="পরীক্ষা" /></SelectTrigger>
                        <SelectContent className="font-kalpurush">
                            {exams.map(e => <SelectItem key={e.id} value={e.name} className="text-[11px] font-bold">{e.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>

        <div className="max-h-[350px] overflow-y-auto p-2 space-y-1 bg-white">
            {/* Student Section */}
            <div className="p-2 space-y-1">
                <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1 px-1">শিক্ষার্থী ও ভর্তি</p>
                <button 
                  onClick={handleDownloadStudentExcel}
                  disabled={isProcessing}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-emerald-50 text-emerald-700 transition-all group"
                >
                    <div className="p-1.5 bg-emerald-100 rounded-md group-hover:scale-110 transition-transform">
                        <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-black">শিক্ষার্থী তালিকা (Excel)</p>
                        <p className="text-[9px] font-bold opacity-70">শ্রেণি: {classNamesMap[selectedClass]}</p>
                    </div>
                    {isProcessing ? <Loader2 className="ml-auto h-3 w-3 animate-spin" /> : <ChevronRight className="ml-auto h-3 w-3 opacity-30" />}
                </button>
                <button 
                  onClick={() => openPrintable(`/student-list?class=${selectedClass}&section=esif`)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 text-blue-700 transition-all group"
                >
                    <div className="p-1.5 bg-blue-100 rounded-md group-hover:scale-110 transition-transform">
                        <FileText className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-black">ESIF রেজিষ্ট্রেশন ফরম</p>
                        <p className="text-[9px] font-bold opacity-70">বোর্ড রেজিষ্ট্রেশনের জন্য</p>
                    </div>
                    <Printer className="ml-auto h-3 w-3 opacity-30" />
                </button>
            </div>

            <Separator />

            {/* Academic Section */}
            <div className="p-2 space-y-1">
                <p className="text-[9px] font-black text-violet-600 uppercase tracking-widest mb-1 px-1">পরীক্ষা ও ফলাফল</p>
                <button 
                  onClick={() => openPrintable(`/results/merit-list?academicYear=${selectedYear}&examName=${encodeURIComponent(selectedExam)}&className=${selectedClass}&group=all`)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-violet-50 text-violet-700 transition-all group"
                >
                    <div className="p-1.5 bg-violet-100 rounded-md group-hover:scale-110 transition-transform">
                        <Trophy className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-black">মেধা তালিকা (PDF)</p>
                        <p className="text-[9px] font-bold opacity-70">{selectedExam}</p>
                    </div>
                    <Printer className="ml-auto h-3 w-3 opacity-30" />
                </button>
            </div>

            <Separator />

            {/* Staff Section */}
            <div className="p-2 space-y-1">
                <p className="text-[9px] font-black text-orange-600 uppercase tracking-widest mb-1 px-1">স্টাফ ও প্রশাসন</p>
                <button 
                  onClick={handleDownloadStaffExcel}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-orange-50 text-orange-700 transition-all group"
                >
                    <div className="p-1.5 bg-orange-100 rounded-md group-hover:scale-110 transition-transform">
                        <Users2 className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-black">সকল স্টাফ তালিকা (Excel)</p>
                        <p className="text-[9px] font-bold opacity-70">শিক্ষক ও কর্মচারী</p>
                    </div>
                    <ChevronRight className="ml-auto h-3 w-3 opacity-30" />
                </button>
                <button 
                  onClick={() => openPrintable('/staff?section=report')}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-100 text-slate-700 transition-all group"
                >
                    <div className="p-1.5 bg-slate-200 rounded-md group-hover:scale-110 transition-transform">
                        <LayoutGrid className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-black">হাজিরা ও ছুটির রিপোর্ট</p>
                        <p className="text-[9px] font-bold opacity-70">মাসিক ও বার্ষিক সারাংশ</p>
                    </div>
                    <ChevronRight className="ml-auto h-3 w-3 opacity-30" />
                </button>
            </div>
        </div>
        
        <div className="p-3 bg-slate-50 border-t flex items-center justify-center">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck className="h-2 w-2" /> Digital Management Portal | BPHS
            </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}