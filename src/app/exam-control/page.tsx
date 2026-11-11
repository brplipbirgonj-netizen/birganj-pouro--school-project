'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { 
    Printer, Save, Loader2, List, ShieldCheck, Plus, Trash2, Info, CheckCircle2, ChevronRight, GraduationCap, Target, Award, Users, BookOpen, UserCheck, Search, Settings, AlertTriangle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { Staff } from '@/lib/staff-data';
import { getExams, Exam } from '@/lib/exam-data';
import { doc, getDoc, setDoc, serverTimestamp, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { getSubjects } from '@/lib/subjects';
import { studentFromDoc, Student } from '@/lib/student-data';

const classNamesMap: Record<string, string> = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': 'দশম' };
const dayMap = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];

function toBengaliNumber(str: string | number | undefined | null) {
  if (!str && str !== 0) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
}

const getExamSlug = (name: string) => {
    return (name || '').trim().replace(/[^a-zA-Z0-9\u0980-\u09FF]+/g, '_');
};

export default function ExamControlPage() {
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user } = useAuth();
    const [allStaff, setAllStaff] = useState<Staff[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeSection, setActiveSection] = useState('exam-routine');

    useEffect(() => {
        if (!db || !user) return;
        setIsLoading(true);
        const staffQuery = query(collection(db, "staff"), where("isActive", "==", true));
        const unsubscribe = onSnapshot(staffQuery, (snap) => {
            const data = snap.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    ...d,
                    joinDate: d.joinDate?.toDate ? d.joinDate.toDate() : d.joinDate,
                    dob: d.dob?.toDate ? d.dob.toDate() : d.dob
                } as Staff;
            });
            setAllStaff(data);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [db, user]);

    const sidebarItems = [
        { id: 'exam-routine', label: 'পরীক্ষার রুটিন', icon: List, color: 'text-blue-600 bg-blue-50' },
        { id: 'invigilator-roster', label: 'কক্ষ পরিদর্শকের তালিকা', icon: ShieldCheck, color: 'text-rose-600 bg-rose-50' },
        { id: 'exam-attendance-sheet', label: 'শিক্ষার্থী হাজিরা', icon: UserCheck, color: 'text-emerald-600 bg-emerald-50' },
    ];

    if (isLoading && allStaff.length === 0) {
        return (
            <div className="flex min-h-screen w-full flex-col bg-[#F6F7F9] font-kalpurush">
                <Header />
                <main className="flex-1 p-10 flex items-center justify-center">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#F6F7F9] font-kalpurush">
            <Header />
            <main className="flex-1 p-4 md:p-10 pb-40">
                <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-8">
                    <aside className="w-full md:w-64 shrink-0 space-y-1 no-print bg-white md:bg-transparent p-4 md:p-0 border-b md:border-0 sticky top-20 md:top-28 self-start">
                        <h2 className="text-2xl font-black mb-6 px-4 hidden md:block text-slate-900 tracking-tight">পরীক্ষা নিয়ন্ত্রণ</h2>
                        <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-1 scrollbar-none">
                            {sidebarItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveSection(item.id)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold whitespace-nowrap min-w-fit",
                                        activeSection === item.id ? "bg-white shadow-md text-primary scale-105" : "text-muted-foreground hover:bg-slate-200/50"
                                    )}
                                >
                                    <div className={cn("p-1.5 rounded-lg shrink-0", activeSection === item.id ? item.color : "bg-muted")}>
                                        <item.icon className="h-3.5 w-3.5" />
                                    </div>
                                    <span className="text-sm font-black">{item.label}</span>
                                    {activeSection === item.id && <ChevronRight className="ml-auto h-3.5 w-3.5 hidden md:block" />}
                                </button>
                            ))}
                        </div>
                    </aside>

                    <div className="flex-1 min-w-0 bg-white md:rounded-[32px] shadow-2xl md:border-[1px] border-slate-200/50 overflow-hidden min-h-[700px] flex flex-col transition-all duration-500 animate-in fade-in slide-in-from-right-4">
                        <div className="p-4 sm:p-6 lg:p-8 flex-1">
                            <div className="mb-6 border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800">{sidebarItems.find(i => i.id === activeSection)?.label}</h2>
                                    <p className="text-xs font-bold text-muted-foreground mt-1">শিক্ষাবর্ষ: {toBengaliNumber(selectedYear)}</p>
                                </div>
                            </div>

                            <div className="animate-in fade-in duration-500">
                                {activeSection === 'exam-routine' && <ExamRoutineTab />}
                                {activeSection === 'invigilator-roster' && <InvigilatorRosterTab staffList={allStaff} academicYear={selectedYear} />}
                                {activeSection === 'exam-attendance-sheet' && <ExamAttendanceSheetTab academicYear={selectedYear} />}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}

function ExamAttendanceSheetTab({ academicYear }: { academicYear: string }) {
    const db = useFirestore();
    const { toast } = useToast();
    const { schoolInfo } = useSchoolInfo();
    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedExam, setSelectedExam] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string>('6');
    const [students, setStudents] = useState<Student[]>([]);
    const [routineData, setRoutineData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const studentChunks = useMemo(() => {
        const chunks = [];
        // Changed to 8 students per page to ensure comfortable signature space on A4 Landscape
        for (let i = 0; i < students.length; i += 8) {
            chunks.push(students.slice(i, i + 8));
        }
        return chunks;
    }, [students]);

    useEffect(() => {
        if (!db) return;
        getExams(db, academicYear).then(setExams);
    }, [db, academicYear]);

    const cleanExamsList = useMemo(() => {
        return Array.from(new Set(exams.map(e => (typeof e?.name === 'string' ? e.name.trim() : '')).filter(Boolean)));
    }, [exams]);

    const fetchSheetData = async () => {
        if (!db || !selectedExam || !selectedClass) return;
        setIsLoading(true);
        try {
            const sQuery = query(collection(db, 'students'), where('academicYear', '==', academicYear), where('className', '==', selectedClass));
            const sSnap = await getDocs(sQuery);
            const studentList = sSnap.docs.map(studentFromDoc).sort((a, b) => a.roll - b.roll);
            setStudents(studentList);

            const examSlug = getExamSlug(selectedExam);
            const docId = `examRoutine_${academicYear}_${examSlug}`;
            const routineSnap = await getDoc(doc(db, 'classRoutines', docId));
            
            if (routineSnap.exists()) {
                const data = routineSnap.data();
                const columns = data.columns || [];
                const classCol = columns.find((c: any) => c.className === selectedClass);
                
                if (classCol && data.rows) {
                    const extracted = data.rows.map((row: any) => {
                        const cell = row.subjects?.[classCol.id];
                        let subjectsStr = '';
                        if (Array.isArray(cell)) {
                            subjectsStr = cell.map((s: any) => s?.subjectName).filter(Boolean).join(' / ');
                        } else if (cell?.subjectName) {
                            subjectsStr = cell.subjectName;
                        }
                        return { date: row.date, subject: subjectsStr };
                    }).filter((r: any) => !!r.subject);
                    setRoutineData(extracted);
                } else {
                    setRoutineData([]);
                    toast({ variant: 'destructive', title: 'রুটিন তথ্য পাওয়া যায়নি', description: 'এই শ্রেণির জন্য রুটিন সেট করা হয়নি।' });
                }
            } else {
                setRoutineData([]);
                toast({ variant: 'destructive', title: 'রুটিন পাওয়া যায়নি', description: 'আগে পরীক্ষার রুটিন সেকশনে গিয়ে রুটিন তৈরি করুন।' });
            }
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    };

    const handlePrint = () => { window.print(); };

    return (
        <div className="space-y-6">
            <style jsx global>{`
                @media print {
                    @page { size: A4 landscape; margin: 8mm !important; }
                    .printable-area.attendance-sheet-print { 
                        visibility: visible !important; 
                        display: block !important; 
                        position: absolute !important; 
                        top: 0 !important; 
                        left: 0 !important; 
                        width: 100% !important; 
                        padding: 0 !important; 
                        margin: 0 !important; 
                    }
                    .attendance-sheet-print table { border-collapse: collapse !important; width: 100% !important; border: 1.5px solid black !important; }
                    .attendance-sheet-print th, .attendance-sheet-print td { border: 1.5px solid black !important; padding: 2px 4px !important; font-size: 11px !important; text-align: center !important; }
                    .attendance-sheet-print th { background: #f8fafc !important; font-weight: 900 !important; height: 40px !important; }
                    /* Optimizing height for 8 rows to perfectly fit one A4 Landscape page including signatures */
                    .attendance-sheet-print tbody tr { height: 55px !important; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border-2 border-primary/10 rounded-2xl bg-white shadow-sm no-print">
                <div className="space-y-2">
                    <Label className="font-bold text-primary">পরীক্ষা নির্বাচন</Label>
                    <Select value={selectedExam} onValueChange={setSelectedExam}>
                        <SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue placeholder="পরীক্ষা" /></SelectTrigger>
                        <SelectContent className="font-kalpurush">
                            {cleanExamsList.map((name, idx) => <SelectItem key={`exam-att-${idx}`} value={name}>{name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="font-bold text-primary">শ্রেণি</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
                        <SelectContent className="font-kalpurush">
                            {Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex gap-2">
                    <Button onClick={fetchSheetData} disabled={isLoading || !selectedExam} className="flex-1 font-black h-11 shadow-md">
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />} তথ্য লোড করুন
                    </Button>
                    <Button variant="outline" onClick={handlePrint} disabled={students.length === 0} className="h-11 border-2 border-primary text-primary font-black shadow-sm">
                        <Printer className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {students.length > 0 && routineData.length > 0 && (
                <div className="space-y-6">
                    <div className="bg-white border-[4px] border-black rounded-[32px] overflow-hidden shadow-2xl no-print">
                        <CardHeader className="bg-primary/5 border-b-[3px] border-black flex flex-row justify-between items-center">
                            <div>
                                <CardTitle className="text-xl font-black text-primary">হাজিরা শিট প্রিভিউ</CardTitle>
                                <CardDescription className="font-bold">{selectedExam} | শ্রেণি: {classNamesMap[selectedClass]}</CardDescription>
                            </div>
                            <Button onClick={handlePrint} className="font-black shadow-lg"><Printer className="mr-2 h-4 w-4" /> ডাউনলোড ও প্রিন্ট</Button>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table className="min-w-max border-collapse">
                                <TableHeader className="bg-slate-100 sticky top-0">
                                    <TableRow className="border-b-2 border-black">
                                        <TableHead rowSpan={2} className="border-r-2 border-black text-center font-black w-14 text-black">রোল</TableHead>
                                        <TableHead rowSpan={2} className="border-r-2 border-black font-black w-48 text-black">শিক্ষার্থীর নাম</TableHead>
                                        {routineData.map((r, i) => (
                                            <TableHead key={i} className="border-r border-black text-center font-black py-1 bg-slate-50 text-[10px] text-black">
                                                {toBengaliNumber(r.date)}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                    <TableRow className="border-b-2 border-black">
                                        {routineData.map((r, i) => (
                                            <TableHead key={i} className="border-r border-black text-center font-bold py-1 bg-white text-[9px] leading-tight text-blue-900 w-24">
                                                {r.subject}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.map(s => (
                                        <TableRow key={s.id} className="border-b border-slate-300 h-10">
                                            <TableCell className="text-center font-black border-r-2 border-black">{toBengaliNumber(s.roll)}</TableCell>
                                            <TableCell className="font-bold border-r-2 border-black whitespace-nowrap">{s.studentNameBn}</TableCell>
                                            {routineData.map((_, i) => (
                                                <TableCell key={i} className="border-r border-slate-300"></TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </div>

                    <div className="hidden print:block printable-area attendance-sheet-print bg-white text-black font-kalpurush">
                        {studentChunks.map((chunk, chunkIdx) => (
                            <div key={chunkIdx} className="print-page-container" style={{ pageBreakAfter: 'always', height: '194mm', display: 'flex', flexDirection: 'column', padding: '0 5mm' }}>
                                <header className="text-center border-b-2 border-black pb-1 mb-2 flex flex-col items-center">
                                    {schoolInfo.logoUrl && <img src={schoolInfo.logoUrl} alt="Logo" className="w-12 h-12 object-contain mb-1" />}
                                    <h1 className="text-xl font-black leading-tight">{schoolInfo.name}</h1>
                                    <p className="text-[10px] font-bold">{schoolInfo.address}</p>
                                    <div className="mt-1 inline-block border-[1.5px] border-black px-6 py-0.5 rounded-full font-black text-sm uppercase bg-slate-50">
                                        শিক্ষার্থী হাজিরা শিট (স্বাক্ষর তালিকা)
                                    </div>
                                    <div className="flex gap-6 mt-1 font-black text-[10px]">
                                        <span>পরীক্ষা: {selectedExam}</span>
                                        <span>শ্রেণি: {classNamesMap[selectedClass]} শ্রেণি</span>
                                        <span>সেশন: {toBengaliNumber(academicYear)}</span>
                                        <span>পৃষ্ঠা: {toBengaliNumber(chunkIdx + 1)}/{toBengaliNumber(studentChunks.length)}</span>
                                    </div>
                                </header>

                                <table className="w-full border-collapse border-[1.5px] border-black flex-grow">
                                    <thead>
                                        <tr className="bg-slate-100 h-10">
                                            <th rowSpan={2} className="w-10">রোল</th>
                                            <th rowSpan={2} className="text-left pl-2 w-48">শিক্ষার্থীর নাম</th>
                                            {routineData.map((r, i) => (
                                                <th key={i} className="text-[9px] font-black">{toBengaliNumber(r.date)}</th>
                                            ))}
                                        </tr>
                                        <tr className="bg-white h-10">
                                            {routineData.map((r, i) => (
                                                <th key={i} className="text-[8px] font-bold leading-tight border-t border-black">{r.subject}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {chunk.map(s => (
                                            <tr key={s.id}>
                                                <td className="font-black text-center">{toBengaliNumber(s.roll)}</td>
                                                <td className="font-bold text-left pl-2 text-[10px]">{s.studentNameBn}</td>
                                                {routineData.map((_, i) => (
                                                    <td key={i}></td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <footer className="mt-2 flex justify-between px-10 border-t border-black pt-2 pb-2">
                                    <div className="text-center w-40 border-t border-black pt-0.5 font-black text-[10px]">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                                    <div className="text-center w-40 border-t border-black pt-0.5 font-black text-[10px]">প্রধান শিক্ষকের স্বাক্ষর</div>
                                </footer>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

interface ExamColumn {
    id: string;
    className: string;
}

interface ExamSubjectEntry {
    subjectName: string;
    subjectCode: string;
}

interface ExamRoutineRow {
    id: string;
    date: string;
    day: string;
    subjects: Record<string, ExamSubjectEntry[] | ExamSubjectEntry>;
}

function ExamRoutineTab() {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const { schoolInfo } = useSchoolInfo();
    const { toast } = useToast();
    const { user, hasPermission } = useAuth();
    const canManageRoutines = hasPermission('manage:routines') || user?.role === 'admin';

    const defaultExams = ['অর্ধ-বার্ষিক পরীক্ষা', 'বার্ষিক পরীক্ষা', 'প্রাক-নির্বাচনী পরীক্ষা', 'নির্বাচনী পরীক্ষা'];
    const [examsList, setExamsList] = useState<string[]>(defaultExams);
    const [selectedExam, setSelectedExam] = useState<string>('অর্ধ-বার্ষিক পরীক্ষা');
    const [startTime, setStartTime] = useState<string>('১০:০০ ঘটিকা');
    const [endTime, setEndTime] = useState<string>('০১:০০ ঘটিকা');

    const [columns, setColumns] = useState<ExamColumn[]>([
        { id: 'col-6', className: '6' },
        { id: 'col-7', className: '7' },
        { id: 'col-8', className: '8' },
        { id: 'col-9', className: '9' },
        { id: 'col-10', className: '10' },
    ]);

    const [rows, setRows] = useState<ExamRoutineRow[]>([
        { id: 'row-1', date: '', day: '', subjects: {} }
    ]);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);

    const getCellSubjects = (row: ExamRoutineRow, colId: string): ExamSubjectEntry[] => {
        const val = row.subjects?.[colId];
        if (!val) return [];
        if (Array.isArray(val)) {
            return val.filter(s => s && s.subjectName && s.subjectName !== 'none');
        }
        if (typeof val === 'object' && (val as any).subjectName && (val as any).subjectName !== 'none') {
            return [val as ExamSubjectEntry];
        }
        return [];
    };

    const getBengaliDayFromDate = (dateStr: string): string => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return '';
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (isNaN(d.getTime())) return '';
        const days = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
        return days[d.getDay()];
    };

    const formatBengaliDate = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${toBengaliNumber(parts[2])}/${toBengaliNumber(parts[1])}/${toBengaliNumber(parts[0])}`;
        }
        return toBengaliNumber(dateStr);
    };

    useEffect(() => {
        if (!db || !selectedYear) return;
        getExams(db, selectedYear).then(exams => {
            if (exams && exams.length > 0) {
                const names = exams.map(e => (typeof e?.name === 'string' ? e.name.trim() : '')).filter(Boolean);
                setExamsList(prev => Array.from(new Set([...prev.map(p => p.trim()), ...names])));
            }
        }).catch(() => {});
    }, [db, selectedYear]);

    const cleanExamsList = useMemo(() => {
        return Array.from(new Set(examsList.map(n => (typeof n === 'string' ? n.trim() : '')).filter(Boolean)));
    }, [examsList]);

    const loadRoutine = useCallback(async () => {
        if (!db || !selectedYear || !selectedExam) return;
        setIsLoading(true);
        try {
            const cleanExam = selectedExam.trim();
            const examSlug = getExamSlug(cleanExam);
            const classRoutineDocId = `examRoutine_${selectedYear}_${examSlug}`;
            const examDocId = `routine_${selectedYear}_${examSlug}`;

            let data: any = null;

            try {
                const snap1 = await getDoc(doc(db, 'classRoutines', classRoutineDocId));
                if (snap1.exists()) data = snap1.data();
            } catch (err) {}

            if (!data) {
                try {
                    const snap2 = await getDoc(doc(db, 'exams', examDocId));
                    if (snap2.exists()) data = snap2.data();
                } catch (err) {}
            }

            if (data) {
                if (data.startTime) setStartTime(data.startTime);
                if (data.endTime) setEndTime(data.endTime);
                if (Array.isArray(data.columns) && data.columns.length > 0) setColumns(data.columns);
                if (Array.isArray(data.rows) && data.rows.length > 0) setRows(data.rows);
            } else {
                setRows([{ id: 'row-1', date: '', day: '', subjects: {} }]);
            }
        } catch (e) {
            console.error('Error loading exam routine:', e);
        } finally {
            setIsLoading(false);
        }
    }, [db, selectedYear, selectedExam]);

    useEffect(() => {
        loadRoutine();
    }, [loadRoutine]);

    const handleSave = async () => {
        if (!db) return;
        setIsSaving(true);
        try {
            const cleanExam = (selectedExam || 'অর্ধ-বার্ষিক পরীক্ষা').trim();
            const examSlug = getExamSlug(cleanExam);
            const routineDataToSave = {
                type: 'exam_routine',
                academicYear: selectedYear,
                examName: cleanExam,
                startTime,
                endTime,
                columns,
                rows,
                updatedAt: serverTimestamp()
            };

            const classRoutineDocId = `examRoutine_${selectedYear}_${examSlug}`;
            const classRoutineRef = doc(db, 'classRoutines', classRoutineDocId);
            const examDocId = `routine_${selectedYear}_${examSlug}`;
            const examDocRef = doc(db, 'exams', examDocId);

            await Promise.allSettled([
                setDoc(classRoutineRef, routineDataToSave, { merge: true }),
                setDoc(examDocRef, routineDataToSave, { merge: true })
            ]);

            toast({ title: `'${cleanExam}' এর রুটিন সফলভাবে সার্ভারে সংরক্ষিত হয়েছে।` });
        } catch (e: any) {
            console.error('Error saving exam routine:', e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDateChange = (rowId: string, newDate: string) => {
        const computedDay = getBengaliDayFromDate(newDate);
        setRows(prev => prev.map(r => r.id === rowId ? { ...r, date: newDate, day: computedDay } : r));
    };

    const handleSubjectChange = (rowId: string, colId: string, className: string, index: number, subjectName: string) => {
        setRows(prev => prev.map(r => {
            if (r.id !== rowId) return r;
            const currentList = [...getCellSubjects(r, colId)];

            if (subjectName === 'none' || !subjectName) {
                currentList.splice(index, 1);
            } else {
                const subjects = getSubjects(className);
                const match = subjects.find(s => s.name === subjectName);
                const code = match ? match.code : '';
                if (index < currentList.length) {
                    currentList[index] = { subjectName, subjectCode: code };
                } else {
                    currentList.push({ subjectName, subjectCode: code });
                }
            }

            return {
                ...r,
                subjects: {
                    ...r.subjects,
                    [colId]: currentList
                }
            };
        }));
    };

    const handleAddSubjectSlot = (rowId: string, colId: string, className: string) => {
        const subList = getSubjects(className);
        setRows(prev => prev.map(r => {
            if (r.id !== rowId) return r;
            const currentList = [...getCellSubjects(r, colId)];
            const existingNames = currentList.map(s => s.subjectName);
            const availableSub = subList.find(s => !existingNames.includes(s.name)) || subList[0];
            if (availableSub) {
                currentList.push({ subjectName: availableSub.name, subjectCode: availableSub.code });
            }
            return {
                ...r,
                subjects: {
                    ...r.subjects,
                    [colId]: currentList
                }
            };
        }));
    };

    const handleRemoveSubjectSlot = (rowId: string, colId: string, index: number) => {
        setRows(prev => prev.map(r => {
            if (r.id !== rowId) return r;
            const currentList = [...getCellSubjects(r, colId)];
            currentList.splice(index, 1);
            return {
                ...r,
                subjects: {
                    ...r.subjects,
                    [colId]: currentList
                }
            };
        }));
    };

    const handleAddColumn = () => {
        const nextColId = `col-${Date.now()}`;
        const existingClasses = columns.map(c => c.className);
        const available = ['6', '7', '8', '9', '10'].find(c => !existingClasses.includes(c)) || '6';
        setColumns(prev => [...prev, { id: nextColId, className: available }]);
    };

    const handleRemoveColumn = (colId: string) => {
        if (columns.length <= 1) return;
        setColumns(prev => prev.filter(c => c.id !== colId));
    };

    const handleColumnClassChange = (colId: string, newClassName: string) => {
        setColumns(prev => prev.map(c => c.id === colId ? { ...c, className: newClassName } : c));
    };

    const handleAddRow = () => {
        const newRowId = `row-${Date.now()}`;
        setRows(prev => [...prev, { id: newRowId, date: '', day: '', subjects: {} }]);
    };

    const handleRemoveRow = (rowId: string) => {
        if (rows.length <= 1) return;
        setRows(prev => prev.filter(r => r.id !== rowId));
    };

    const handlePrint = () => { window.print(); };

    return (
        <div className="space-y-8">
            <Card className="border-2 shadow-xl rounded-3xl overflow-hidden bg-white no-print">
                <CardHeader className="bg-slate-50 border-b-2 p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-2xl font-black text-slate-800 flex items-center gap-2">
                                <List className="h-6 w-6 text-primary" /> পরীক্ষার রুটিন
                            </CardTitle>
                            <CardDescription className="font-bold text-slate-600 mt-1">
                                শিক্ষাবর্ষ: {toBengaliNumber(selectedYear)} | একই দিনে একাধিক বিষয়সহ পরীক্ষার সময়সূচি তৈরি করুন
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <Button onClick={handlePrint} variant="outline" className="font-black h-11 border-2 border-primary text-primary hover:bg-primary/5 shadow-sm">
                                <Printer className="mr-2 h-4 w-4" /> প্রিন্ট করুন
                            </Button>
                            {canManageRoutines && (
                                <Button onClick={handleSave} disabled={isSaving} className="font-black h-11 px-6 shadow-md">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    রুটিন সেভ করুন
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t-2 border-slate-200">
                        <div className="space-y-2">
                            <Label className="font-black text-xs text-primary">পরীক্ষা নির্বাচন</Label>
                            <Select value={selectedExam} onValueChange={setSelectedExam}>
                                <SelectTrigger className="h-11 bg-white border-2 font-black text-base shadow-sm">
                                    <SelectValue placeholder="পরীক্ষা নির্বাচন করুন" />
                                </SelectTrigger>
                                <SelectContent className="font-kalpurush">
                                    {cleanExamsList.map((name, idx) => (
                                        <SelectItem key={`exam-opt-${idx}-${name}`} value={name} className="font-bold text-sm">
                                            {name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="font-black text-xs text-primary">পরীক্ষা শুরুর সময়</Label>
                            <Input value={startTime} onChange={(e) => setStartTime(e.target.value)} placeholder="উদা: ১০:০০ ঘটিকা" className="h-11 bg-white border-2 font-black text-base shadow-sm" />
                        </div>

                        <div className="space-y-2">
                            <Label className="font-black text-xs text-primary">পরীক্ষা শেষের সময়</Label>
                            <Input value={endTime} onChange={(e) => setEndTime(e.target.value)} placeholder="উদা: ০১:০০ ঘটিকা" className="h-11 bg-white border-2 font-black text-base shadow-sm" />
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-2">
                        <div className="flex items-center gap-2">
                            <Button onClick={handleAddRow} size="sm" variant="outline" className="font-black h-9 border-2 border-slate-800 text-slate-800 hover:bg-slate-50">
                                <Plus className="mr-1.5 h-4 w-4" /> তারিখ যোগ করুন (+)
                            </Button>
                            <Button onClick={handleAddColumn} size="sm" variant="outline" className="font-black h-9 border-2 border-primary text-primary hover:bg-primary/5">
                                <Plus className="mr-1.5 h-4 w-4" /> শ্রেণি কলাম যোগ করুন (+)
                            </Button>
                        </div>
                        <span className="text-xs font-bold text-muted-foreground italic">* একই দিনে একই শ্রেণিতে একাধিক বিষয় যোগ করতে "+ বিষয় যোগ" চাপুন</span>
                    </div>

                    <div className="border-2 border-slate-800 rounded-2xl overflow-x-auto shadow-inner bg-white">
                        <Table className="w-full border-collapse">
                            <TableHeader className="bg-slate-100 border-b-2 border-slate-800">
                                <TableRow className="border-b-2 border-slate-800">
                                    <TableHead className="w-[190px] border-r-2 border-slate-800 text-center font-black text-slate-900 p-3">তারিখ যোগ করুন(+)</TableHead>
                                    <TableHead className="w-[130px] border-r-2 border-slate-800 text-center font-black text-slate-900 p-3">বার অটো আসবে</TableHead>
                                    {columns.map((col) => (
                                        <TableHead key={col.id} className="min-w-[210px] border-r-2 border-slate-800 last:border-r-0 text-center font-black text-slate-900 p-2 bg-slate-200/50">
                                            <div className="flex items-center justify-between gap-1 bg-white p-1 rounded-xl border border-slate-400 shadow-sm">
                                                <Select value={col.className} onValueChange={(val) => handleColumnClassChange(col.id, val)}>
                                                    <SelectTrigger className="h-8 font-black text-xs border-0 focus:ring-0"><SelectValue /></SelectTrigger>
                                                    <SelectContent className="font-kalpurush">
                                                        {Object.entries(classNamesMap).map(([cId, cName]) => (
                                                            <SelectItem key={cId} value={cId} className="font-bold text-xs">{cName} শ্রেণি</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {columns.length > 1 && (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg shrink-0" onClick={() => handleRemoveColumn(col.id)}><Trash2 className="h-3 w-3" /></Button>
                                                )}
                                            </div>
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>

                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={columns.length + 2} className="py-16 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" /><p className="font-bold text-slate-600">রুটিন তথ্য লোড হচ্ছে...</p></TableCell></TableRow>
                                ) : rows.map((row) => (
                                    <TableRow key={row.id} className="border-b border-slate-300 hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="border-r-2 border-slate-800 p-2 text-center align-top bg-slate-50/30">
                                            <div className="flex items-center justify-center gap-1 mt-1">
                                                <Input type="date" value={row.date} onChange={(e) => handleDateChange(row.id, e.target.value)} className="h-9 w-36 text-center font-bold text-xs bg-white border-2 border-slate-300" />
                                                {rows.length > 1 && (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-100 shrink-0" onClick={() => handleRemoveRow(row.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                )}
                                            </div>
                                        </TableCell>

                                        <TableCell className="border-r-2 border-slate-800 p-2 text-center align-top font-black text-slate-800 pt-3">
                                            {row.day ? <Badge variant="outline" className="font-black text-xs bg-blue-50 border-blue-300 text-blue-900 px-2 py-0.5 shadow-sm">{row.day}</Badge> : <span className="text-[11px] text-muted-foreground italic">তারিখ দিন</span>}
                                        </TableCell>

                                        {columns.map((col) => {
                                            const cellSubs = getCellSubjects(row, col.id);
                                            const subList = getSubjects(col.className);
                                            return (
                                                <TableCell key={col.id} className="border-r-2 border-slate-800 last:border-r-0 p-2 text-center align-top min-w-[210px]">
                                                    <div className="space-y-2">
                                                        {cellSubs.length === 0 ? (
                                                            <Select value="none" onValueChange={(val) => handleSubjectChange(row.id, col.id, col.className, 0, val)}>
                                                                <SelectTrigger className="h-9 text-xs font-bold bg-white border-2 border-slate-300 hover:border-primary transition-colors"><SelectValue placeholder="বিষয় সিলেক্ট করুন" /></SelectTrigger>
                                                                <SelectContent className="max-h-[300px] font-kalpurush">
                                                                    <SelectItem value="none" className="text-muted-foreground font-semibold text-xs">-- পরীক্ষা নেই / বন্ধ --</SelectItem>
                                                                    {subList.map((sub, sIdx) => (<SelectItem key={`sub-${sub.name}-${sub.code}-${sIdx}`} value={sub.name} className="font-bold text-xs">{sub.name} ({toBengaliNumber(sub.code)})</SelectItem>))}
                                                                </SelectContent>
                                                            </Select>
                                                        ) : (
                                                            <div className="space-y-2">
                                                                {cellSubs.map((entry, sIdx) => (
                                                                    <div key={sIdx} className="p-1.5 bg-slate-50 border border-slate-300 rounded-lg space-y-1 relative shadow-sm">
                                                                        <div className="flex items-center gap-1">
                                                                            <span className="text-[11px] font-black text-slate-500 w-4 text-center shrink-0">{toBengaliNumber(sIdx + 1)}.</span>
                                                                            <Select value={entry.subjectName} onValueChange={(val) => handleSubjectChange(row.id, col.id, col.className, sIdx, val)}>
                                                                                <SelectTrigger className="h-8 text-xs font-bold bg-white border border-slate-300 flex-1"><SelectValue placeholder="বিষয় সিলেক্ট করুন" /></SelectTrigger>
                                                                                <SelectContent className="max-h-[300px] font-kalpurush">
                                                                                    <SelectItem value="none" className="text-rose-500 font-semibold text-xs">-- এই বিষয়টি মুছুন --</SelectItem>
                                                                                    {subList.map((sub) => (<SelectItem key={sub.name} value={sub.name} className="font-bold text-xs">{sub.name} ({toBengaliNumber(sub.code)})</SelectItem>))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded shrink-0" onClick={() => handleRemoveSubjectSlot(row.id, col.id, sIdx)}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                                        </div>
                                                                        <div className="text-center"><span className="text-[10px] font-black text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full inline-block">কোড: {toBengaliNumber(entry.subjectCode) || '-'}</span></div>
                                                                    </div>
                                                                ))}
                                                                <Button variant="outline" size="sm" onClick={() => handleAddSubjectSlot(row.id, col.id, col.className)} className="w-full h-7 text-[11px] font-black border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:border-primary shadow-xs"><Plus className="h-3 w-3 mr-1" /> + বিষয় যোগ</Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Print Section (Doubled Copy per A4) */}
            {(() => {
                const renderRoutineCopy = (keyPrefix: string, isPrint: boolean = false) => (
                    <div key={keyPrefix} className={cn("flex flex-col justify-between print-copy-container", isPrint ? "py-1" : "py-2")}>
                        <header className={cn("text-center border-b border-black flex flex-col items-center", isPrint ? "pb-1 mb-1" : "pb-2 mb-2")}>
                            <div className="flex items-center justify-center gap-2">
                                {schoolInfo.logoUrl && (<img src={schoolInfo.logoUrl} alt="Logo" className={isPrint ? "w-7 h-7 object-contain" : "w-10 h-10 object-contain"} />)}
                                <div>
                                    <h1 className={cn("font-black text-slate-900 leading-tight", isPrint ? "text-sm" : "text-lg md:text-xl")}>{schoolInfo.name}</h1>
                                    <p className={cn("font-bold text-slate-700 leading-tight", isPrint ? "text-[9px]" : "text-[11px]")}>{schoolInfo.address}</p>
                                </div>
                            </div>
                            <div className={cn("flex flex-wrap items-center justify-center gap-2", isPrint ? "mt-0.5 text-[9px]" : "mt-1.5 text-xs")}>
                                <span className={cn("border border-black rounded-full font-black uppercase bg-slate-100", isPrint ? "px-2.5 py-0 text-[9px]" : "px-4 py-0.5 text-xs")}>{selectedExam} - {toBengaliNumber(selectedYear)}</span>
                                <span className={cn("font-black text-slate-800", isPrint ? "text-[9px]" : "text-xs")}>পরীক্ষার সময়: {toBengaliNumber(startTime)} হতে {toBengaliNumber(endTime)}</span>
                            </div>
                        </header>
                        <div className="overflow-x-auto my-0.5">
                            <table className={cn("w-full border-collapse border border-black", isPrint ? "text-[9px]" : "text-xs")}>
                                <thead>
                                    <tr className="bg-slate-100 font-black">
                                        <th className={cn("border border-black text-center", isPrint ? "p-0.5 w-20 text-[9px]" : "p-1.5 w-24 text-xs")}>তারিখ</th>
                                        <th className={cn("border border-black text-center", isPrint ? "p-0.5 w-16 text-[9px]" : "p-1.5 w-20 text-xs")}>বার</th>
                                        {columns.map(col => (<th key={`${keyPrefix}-${col.id}`} className={cn("border border-black text-center", isPrint ? "p-0.5 text-[9px]" : "p-1.5 text-xs")}>{classNamesMap[col.className] || col.className} শ্রেণি</th>))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map(row => (
                                        <tr key={`${keyPrefix}-${row.id}`} className="hover:bg-slate-50/50">
                                            <td className={cn("border border-black text-center font-bold", isPrint ? "p-0.5 text-[9px] leading-tight" : "p-1")}>{formatBengaliDate(row.date) || '-'}</td>
                                            <td className={cn("border border-black text-center font-black", isPrint ? "p-0.5 text-[9px] leading-tight" : "p-1")}>{row.day || '-'}</td>
                                            {columns.map(col => {
                                                const cellSubs = getCellSubjects(row, col.id);
                                                return (
                                                    <td key={`${keyPrefix}-${col.id}`} className={cn("border border-black text-center font-bold align-middle", isPrint ? "p-0.5 text-[9px] leading-tight" : "p-1")}>
                                                        {cellSubs.length > 0 ? (<div className={isPrint ? "space-y-0.5" : "space-y-1"}>{cellSubs.map((entry, sIdx) => (<div key={sIdx} className={cn(sIdx > 0 && "pt-0.5 border-t border-slate-300")}><div className={cn("text-slate-900 font-black leading-tight", isPrint ? "text-[9px]" : "text-xs")}>{entry.subjectName}</div>{entry.subjectCode && (<div className={cn("font-black text-slate-700 leading-none", isPrint ? "text-[7.5px] mt-0.5" : "text-[10px] mt-0.5")}>(কোড: {toBengaliNumber(entry.subjectCode)})</div>)}</div>))}</div>) : (<span className="text-slate-400 font-normal">-</span>)}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <footer className={cn("flex justify-between px-6", isPrint ? "mt-1.5 pt-1" : "mt-4 pt-2")}>
                            <div className={cn("border-t border-black text-center font-black", isPrint ? "w-28 text-[9px] pt-0.5" : "w-36 text-[11px] pt-1")}>পরীক্ষা নিয়ন্ত্রক</div>
                            <div className={cn("border-t border-black text-center font-black", isPrint ? "w-28 text-[9px] pt-0.5" : "w-36 text-[11px] pt-1")}>প্রধান শিক্ষক</div>
                        </footer>
                    </div>
                );

                return (
                    <>
                        <Card className="border-2 shadow-2xl rounded-3xl overflow-hidden bg-white no-print">
                            <CardHeader className="bg-slate-50 border-b-2 p-6 flex flex-row items-center justify-between">
                                <div><CardTitle className="text-xl font-black text-slate-800 flex items-center gap-2"><Printer className="h-5 w-5 text-primary" /> পরীক্ষার রুটিন - ডবল প্রিন্ট প্রিভিউ</CardTitle><CardDescription className="font-bold text-slate-600 mt-0.5">১টি এ-৪ পাতায় ২টি কপি প্রিন্ট হবে।</CardDescription></div>
                                <Button onClick={handlePrint} size="lg" className="font-black h-11 px-8 shadow-md"><Printer className="mr-2 h-4 w-4" /> প্রিন্ট করুন</Button>
                            </CardHeader>
                            <CardContent className="p-6 md:p-10 bg-slate-100 flex justify-center overflow-x-auto">
                                <div className="bg-white p-6 md:p-8 border-2 border-slate-300 rounded-xl shadow-2xl max-w-4xl w-full text-black font-kalpurush space-y-4">
                                    {renderRoutineCopy("preview-copy-1", false)}
                                    <div className="py-2 flex items-center justify-center"><div className="w-full border-b-2 border-dashed border-slate-400"></div></div>
                                    {renderRoutineCopy("preview-copy-2", false)}
                                </div>
                            </CardContent>
                        </Card>

                        <div className="printable-area exam-routine-print-area text-black bg-white font-kalpurush w-full box-border hidden print:flex flex-col justify-between">
                            <style jsx global>{`@media print { @page { size: A4 portrait; margin: 4mm 5mm !important; } html, body { margin: 0 !important; padding: 0 !important; } .printable-area.exam-routine-print-area { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; max-width: 100% !important; height: 100% !important; max-height: 288mm !important; padding: 0 !important; margin: 0 !important; display: flex !important; flex-direction: column !important; justify-content: space-between !important; box-sizing: border-box !important; overflow: hidden !important; } .print-copy-container { page-break-inside: avoid !important; } table { border-collapse: collapse !important; border: 1px solid black !important; width: 100% !important; } th, td { border: 1px solid black !important; padding: 1.5px 2px !important; text-align: center !important; line-height: 1.15 !important; } .no-print { display: none !important; } }`}</style>
                            {renderRoutineCopy("print-copy-1", true)}
                            <div className="my-1 flex items-center justify-center"><div className="w-full border-b border-dashed border-black"></div></div>
                            {renderRoutineCopy("print-copy-2", true)}
                        </div>
                    </>
                );
            })()}
        </div>
    );
}

function InvigilatorRosterTab({ staffList, academicYear }: { staffList: Staff[], academicYear: string }) {
    const db = useFirestore();
    const { toast } = useToast();
    const { schoolInfo } = useSchoolInfo();
    const { user } = useAuth();

    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedExam, setSelectedExam] = useState<string>('');
    const [examDates, setExamDates] = useState<string[]>([]);
    const [roomCount, setRoomCount] = useState<number>(5);
    const [perRoom, setPerRoom] = useState<number>(1);
    const [roster, setRoster] = useState<Record<string, string[][]>>({});
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const NAME_ARIFUL = "মো: আরিফুর রহমান";
    const NAME_NILA = "নীলা রায়";

    const teacherPool = useMemo(() => {
        return staffList
            .filter(s => s.staffType === 'teacher' && s.isActive && s.nameBn && s.nameBn !== 'No Data')
            .map(s => ({ id: s.id, name: s.nameBn }))
            .sort((a, b) => a.name.localeCompare(b.name, 'bn'));
    }, [staffList]);

    const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (teacherPool.length > 0 && selectedTeacherIds.size === 0) setSelectedTeacherIds(new Set(teacherPool.map(t => t.id)));
    }, [teacherPool, selectedTeacherIds]);

    useEffect(() => {
        if (!db || !user) return;
        getExams(db, academicYear).then(data => {
            setExams(data);
            if (data.length > 0) setSelectedExam(data[0].name);
        });
    }, [db, academicYear, user]);

    const loadDatesFromRoutine = useCallback(async () => {
        if (!db || !selectedExam || !academicYear) return;
        setIsLoading(true);
        try {
            const examSlug = getExamSlug(selectedExam);
            const examDocId = `routine_${academicYear}_${examSlug}`;
            const snap = await getDoc(doc(db, 'exams', examDocId));
            if (snap.exists()) {
                const data = snap.data();
                if (Array.isArray(data.rows)) {
                    const dates = data.rows.map((r: any) => r.date).filter(Boolean);
                    setExamDates(Array.from(new Set(dates)).sort() as string[]);
                }
            } else setExamDates([]);

            const rosterId = `roster_${academicYear}_${examSlug}`;
            const rosterSnap = await getDoc(doc(db, 'examRosters', rosterId));
            if (rosterSnap.exists()) {
                const rData = rosterSnap.data();
                setRoster(rData.roster || {});
                setRoomCount(rData.roomCount || 5);
                setPerRoom(rData.perRoom || 1);
            } else setRoster({});
        } catch (e) {}
        setIsLoading(false);
    }, [db, selectedExam, academicYear]);

    useEffect(() => { loadDatesFromRoutine(); }, [loadDatesFromRoutine]);

    const handleGenerate = () => {
        if (examDates.length === 0) return;
        const selectedTeachers = teacherPool.filter(t => selectedTeacherIds.has(t.id));
        if (selectedTeachers.length === 0) return;

        setIsGenerating(true);
        const localDutyCounts = new Map<string, number>();
        selectedTeachers.forEach(t => localDutyCounts.set(t.id, 0));
        const newRoster: Record<string, string[][]> = {};
        const prevAssignments = new Map<string, { roomIdx: number, dayIdx: number }>();
        const partnershipGap = new Map<string, number>();

        const getPairKey = (t1: string, t2: string) => [t1, t2].sort().join('|');
        
        examDates.forEach((date, dIdx) => {
            const daySlots: string[][] = [];
            const assignedToday = new Set<string>();
            for (let rIdx = 0; rIdx < roomCount; rIdx++) {
                const roomTeachers: string[] = [];
                for (let pIdx = 0; pIdx < perRoom; pIdx++) {
                    const validCandidates = selectedTeachers.filter(candidate => {
                        if (assignedToday.has(candidate.id)) return false;
                        const last = prevAssignments.get(candidate.id);
                        if (last && last.dayIdx === dIdx - 1 && last.roomIdx === rIdx) return false;
                        if (roomTeachers.length > 0) {
                           const isForbidden = roomTeachers.some(name => (candidate.name === NAME_ARIFUL && name === NAME_NILA) || (candidate.name === NAME_NILA && name === NAME_ARIFUL));
                           if (isForbidden) return false;
                           const isPartnershipRecently = roomTeachers.some(name => (partnershipGap.get(getPairKey(candidate.name, name)) || -99) >= dIdx - 2);
                           if (isPartnershipRecently) return false;
                        }
                        return true;
                    });

                    const sortedCandidates = validCandidates.sort((a, b) => {
                        const countA = localDutyCounts.get(a.id) || 0;
                        const countB = localDutyCounts.get(b.id) || 0;
                        if (countA !== countB) return countA - countB;
                        return Math.random() - 0.5;
                    });

                    let foundCandidate = sortedCandidates[0];
                    if (!foundCandidate) {
                        foundCandidate = selectedTeachers.filter(t => !assignedToday.has(t.id)).sort((a, b) => (localDutyCounts.get(a.id) || 0) - (localDutyCounts.get(b.id) || 0))[0];
                    }

                    if (foundCandidate) {
                        roomTeachers.push(foundCandidate.name);
                        assignedToday.add(foundCandidate.id); 
                        localDutyCounts.set(foundCandidate.id, (localDutyCounts.get(foundCandidate.id) || 0) + 1);
                        prevAssignments.set(foundCandidate.id, { roomIdx: rIdx, dayIdx: dIdx });
                        roomTeachers.forEach(otherName => {
                            if (otherName !== foundCandidate!.name) partnershipGap.set(getPairKey(foundCandidate!.name, otherName), dIdx);
                        });
                    } else roomTeachers.push("-");
                }
                daySlots.push(roomTeachers);
            }
            newRoster[date] = daySlots;
        });

        setRoster(newRoster);
        setIsGenerating(false);
        toast({ title: 'ডিউটি তালিকা তৈরি হয়েছে' });
    };

    const handleSaveRoster = async () => {
        if (!db || Object.keys(roster).length === 0) return;
        setIsLoading(true);
        try {
            const examSlug = getExamSlug(selectedExam);
            const rosterId = `roster_${academicYear}_${examSlug}`;
            await setDoc(doc(db, 'examRosters', rosterId), { examName: selectedExam, academicYear, roomCount, perRoom, roster, updatedAt: serverTimestamp() });
            toast({ title: 'তালিকা সংরক্ষিত হয়েছে' });
        } catch (e) {}
        setIsLoading(false);
    };

    const teacherDutyStats = useMemo(() => {
        const counts: Record<string, number> = {};
        Object.values(roster).forEach(dayRooms => dayRooms.forEach(roomTeachers => roomTeachers.forEach(name => { counts[name] = (counts[name] || 0) + 1; })));
        return counts;
    }, [roster]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <style jsx global>{` @media print { @page { size: A4 landscape; margin: 10mm !important; } .printable-area { visibility: visible !important; display: block !important; position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; } .roster-print th, .roster-print td { border: 1.5px solid black !important; padding: 4px !important; font-size: 11px !important; color: black !important; text-align: center !important; } .roster-print th { background: #f1f5f9 !important; font-weight: 900 !important; } .no-print { display: none !important; } } `}</style>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 no-print">
                <Card className="lg:col-span-1 border-2 border-primary/10 shadow-sm overflow-hidden flex flex-col h-full bg-white">
                    <CardHeader className="bg-primary/5 p-4 border-b"><CardTitle className="text-sm font-black flex items-center gap-2"><Users className="h-4 w-4" /> শিক্ষক নির্বাচন ({toBengaliNumber(selectedTeacherIds.size)})</CardTitle></CardHeader>
                    <CardContent className="p-0 flex-1 overflow-hidden">
                        <ScrollArea className="h-[400px]"><div className="p-2 space-y-1">{teacherPool.map(t => (<div key={t.id} className={cn("flex items-center gap-3 p-2 rounded-lg border-2 transition-all cursor-pointer", selectedTeacherIds.has(t.id) ? "border-primary bg-primary/5" : "border-transparent hover:bg-slate-50")} onClick={() => { const next = new Set(selectedTeacherIds); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); setSelectedTeacherIds(next); }}><Checkbox checked={selectedTeacherIds.has(t.id)} onCheckedChange={() => {}} /><div className="flex-1"><p className="text-[13px] font-black text-slate-800 leading-none">{t.name}</p>{teacherDutyStats[t.name] && <Badge className="bg-emerald-600 text-[9px] h-4 py-0 font-black mt-1">ডিউটি: {toBengaliNumber(teacherDutyStats[t.name])} দিন</Badge>}</div></div>))}</div></ScrollArea>
                    </CardContent>
                    <CardFooter className="p-3 border-t bg-slate-50"><Button variant="outline" size="sm" className="w-full font-bold h-8 text-[10px]" onClick={() => setSelectedTeacherIds(new Set(teacherPool.map(t => t.id)))}>সবাইকে নির্বাচন</Button></CardFooter>
                </Card>
                <div className="lg:col-span-3 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border-2 border-primary/10 rounded-2xl bg-white shadow-sm">
                        <div className="space-y-2"><Label className="font-black text-primary text-xs">পরীক্ষা নির্বাচন</Label><Select value={selectedExam} onValueChange={setSelectedExam}>
                            <SelectTrigger className="font-bold border-2"><SelectValue placeholder="পরীক্ষা" /></SelectTrigger>
                            <SelectContent className="font-kalpurush">
                                {exams.filter(e => Boolean(e?.name)).map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}
                            </SelectContent>
                        </Select></div>
                        <div className="space-y-2"><Label className="font-black text-primary text-xs">মোট কক্ষ</Label><Input type="number" min={1} value={roomCount} onChange={e => setRoomCount(parseInt(e.target.value) || 1)} className="font-black border-2" /></div>
                        <div className="space-y-2"><Label className="font-black text-primary text-xs">প্রতি কক্ষে শিক্ষক</Label><Select value={String(perRoom)} onValueChange={v => setPerRoom(parseInt(v))}><SelectTrigger className="font-bold border-2"><SelectValue /></SelectTrigger><SelectContent className="font-kalpurush"><SelectItem value="1">১ জন</SelectItem><SelectItem value="2">২ জন</SelectItem></SelectContent></Select></div>
                    </div>
                    <div className="flex gap-3"><Button onClick={handleGenerate} disabled={isGenerating || examDates.length === 0} size="lg" className="flex-1 font-black shadow-xl h-14">স্বয়ংক্রিয় ডিউটি তালিকা তৈরি</Button><Button variant="outline" size="lg" onClick={() => window.print()} className="h-14 w-14 border-2 border-primary text-primary font-black shadow-lg"><Printer className="h-6 w-6" /></Button></div>
                </div>
            </div>
            {Object.keys(roster).length > 0 && (
                <>
                    <div className="space-y-6">
                        <div className="flex justify-between items-center px-2 no-print">
                            <h3 className="font-black text-slate-800 flex items-center gap-2"><CheckCircle2 className="text-emerald-600" /> ডিউটি পরিসংখ্যান:</h3>
                            <Button onClick={handleSaveRoster} disabled={isLoading} className="bg-emerald-600 hover:bg-emerald-700 font-black h-10 px-8 shadow-md">সেভ করুন</Button>
                        </div>
                        <div className="no-print border-2 border-black rounded-xl overflow-hidden shadow-2xl bg-white">
                             <div className="table-container !max-h-[500px]">
                                <Table className="border-collapse w-full">
                                    <TableHeader className="bg-slate-100 border-b-2 border-black"><TableRow className="h-14"><TableHead className="font-black text-black border-r-2 border-black text-center w-36">তারিখ ও বার</TableHead>{[...Array(roomCount)].map((_, i) => (<TableHead key={i} className="font-black text-black border-r-2 border-black text-center">কক্ষ- {toBengaliNumber(i + 1)}</TableHead>))}</TableRow></TableHeader>
                                    <TableBody>{examDates.map(date => (<TableRow key={date} className="h-16 border-b border-slate-200"><TableCell className="border-r-2 border-black text-center bg-slate-50/50 p-2"><p className="font-black text-base">{toBengaliNumber(date)}</p></TableCell>{roster[date]?.map((teachersInRoom, rIdx) => (<TableCell key={rIdx} className="border-r border-slate-200 p-2 text-center align-middle"><div className="flex flex-col gap-1">{teachersInRoom.map((name, pIdx) => (<div key={pIdx} className="p-1 rounded-lg border font-black text-[11px] bg-slate-50">{name}</div>))}</div></TableCell>))}</TableRow>))}</TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>

                    <div className="hidden print:block printable-area bg-white text-black p-0">
                        <header className="text-center border-b-4 border-black pb-2 mb-4 flex flex-col items-center">
                            {schoolInfo.logoUrl && <img src={schoolInfo.logoUrl} alt="Logo" className="w-16 h-16 object-contain mb-1" />}
                            <h1 className="text-2xl font-black">{schoolInfo.name}</h1>
                            <p className="text-sm font-bold">{schoolInfo.address}</p>
                            <div className="mt-1 inline-block border-2 border-black px-10 py-1 rounded-full font-black text-lg uppercase bg-slate-50">
                                কক্ষ পরিদর্শকের তালিকা - {selectedExam} ({toBengaliNumber(academicYear)})
                            </div>
                        </header>

                        <table className="w-full border-collapse border-2 border-black roster-print">
                            <thead>
                                <tr className="bg-slate-100">
                                    <th className="border-r-2 border-b-2 border-black font-black text-center w-36">তারিখ ও বার</th>
                                    {[...Array(roomCount)].map((_, i) => (
                                        <th key={i} className="border-r-2 border-b-2 border-black font-black text-center">কক্ষ- {toBengaliNumber(i + 1)}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {examDates.map(date => {
                                    const dObj = new Date(date);
                                    const dayName = dayMap[dObj.getDay()] || '';
                                    return (
                                        <tr key={date} className="border-b border-black">
                                            <td className="border-r-2 border-black text-center p-2 bg-slate-50/50">
                                                <p className="font-black text-base">{toBengaliNumber(format(new Date(date), 'dd-MM-yyyy'))}</p>
                                                <p className="text-xs font-bold">({dayName})</p>
                                            </td>
                                            {roster[date]?.map((teachersInRoom, rIdx) => (
                                                <td key={rIdx} className="border-r-2 border-black p-2 text-center align-middle">
                                                    <div className="flex flex-col gap-1">
                                                        {teachersInRoom.map((name, pIdx) => (
                                                            <div key={pIdx} className="p-1 rounded-lg border font-black text-[11px] bg-slate-50">{name}</div>
                                                        ))}
                                                    </div>
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        <footer className="mt-10 flex justify-between px-10 pt-8 border-t-2 border-black">
                            <div className="text-center w-56 border-t border-black pt-1 font-black text-lg">পরীক্ষা নিয়ন্ত্রক</div>
                            <div className="text-center w-56 border-t border-black pt-1 font-black text-lg">প্রধান শিক্ষক</div>
                        </footer>
                    </div>
                </>
            )}
        </div>
    );
}
