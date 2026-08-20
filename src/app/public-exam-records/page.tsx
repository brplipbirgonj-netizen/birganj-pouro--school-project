
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { 
    Award, Plus, Search, Trash2, Printer, Loader2, Save, X, 
    FileText, GraduationCap, School, Info, CheckCircle2, History, User, Users, ChevronRight, Calendar, FilePen, Check, Target, BookOpen, AlertCircle
} from 'lucide-react';
import { PublicExamRecord, PublicExamType, getPublicExamRecords, savePublicExamRecord, deletePublicExamRecord, NewPublicExamData } from '@/lib/public-exam-data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
    AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Student, studentFromDoc, sanitizePhotoUrl, getStudentPlaceholderImage } from '@/lib/student-data';
import { collection, query, where, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

const examTypes: { id: PublicExamType; label: string; icon: any; color: string }[] = [
    { id: 'SSC', label: 'এসএসসি পরীক্ষা', icon: GraduationCap, color: 'text-indigo-600 bg-indigo-50' },
    { id: 'JSC', label: 'জেএসসি পরীক্ষা', icon: Target, color: 'text-rose-600 bg-rose-50' },
    { id: 'Scholarship', label: 'অষ্টম শ্রেণির বৃত্তি', icon: Award, color: 'text-amber-600 bg-amber-50' },
];

const educationBoards = [
    'Dinajpur', 'Dhaka', 'Rajshahi', 'Cumilla', 'Jashore', 'Chattogram', 'Barishal', 'Sylhet', 'Mymensingh', 'Madrasah', 'Technical'
];

const birganjCenters = [
    'Birganj Govt. Pilot High School',
    'Birganj Govt. Girls\' High School',
    'Gopalganj High School',
    'Jharbari High School',
    'Paltapur Adarsha High School',
    'Mohamadpur High School',
    'Kholshichandra High School',
    'Birganj Mohila College',
    'Birganj Degree College'
];

const groups = [
    { id: 'general', label: 'সাধারণ' },
    { id: 'science', label: 'বিজ্ঞান' },
    { id: 'arts', label: 'মানবিক' },
    { id: 'commerce', label: 'ব্যবসায় শিক্ষা' },
];

const toBengaliNumber = (str: string | number | undefined | null) => {
    if (!str && str !== 0) return '';
    const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => digits[parseInt(w, 10)]);
};

const classNamesMap: Record<string, string> = {
    '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

export default function PublicExamRecordsPage() {
    const db = useFirestore();
    const { selectedYear, availableYears } = useAcademicYear();
    const { user, hasPermission, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const { schoolInfo } = useSchoolInfo();

    const [isClient, setIsClient] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<PublicExamType>('SSC');
    const [records, setRecords] = useState<PublicExamRecord[]>([]);
    
    const [viewYear, setViewYear] = useState<string>(selectedYear);
    
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [isFetchingStudents, setIsFetchingStudents] = useState(false);
    
    const [selectedStudentIdsInDialog, setSelectedStudentIdsInDialog] = useState<Set<string>>(new Set());
    const [dialogSearchQuery, setDialogSearchQuery] = useState('');

    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState<NewPublicExamData>({
        registrationNo: '',
        rollNo: '',
        examRoll: '',
        studentName: '',
        photoUrl: '',
        group: 'general',
        boardName: 'Dinajpur',
        centerName: '',
        totalMarks: 0,
        grade: '',
        gpa: 0,
        examType: 'SSC',
        academicYear: selectedYear
    });

    const canManage = hasPermission('manage:results') || user?.role === 'admin';

    const fetchRecords = useCallback(async () => {
        if (!db || !user) return;
        setIsLoading(true);
        try {
            const data = await getPublicExamRecords(db, viewYear, activeTab);
            setRecords(data.sort((a, b) => {
                const bnToEn = (str: string) => str.toString().replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)].toString());
                const rollA = parseInt(bnToEn(a.rollNo), 10) || 0;
                const rollB = parseInt(bnToEn(b.rollNo), 10) || 0;
                return rollA - rollB;
            }));
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    }, [db, user, viewYear, activeTab]);

    useEffect(() => {
        setIsClient(true);
        fetchRecords();
    }, [fetchRecords]);

    useEffect(() => {
        if (!db || !user || !isClient) return;
        
        // Year Logic: SSC 2026 participants are 2025 Class 10 students
        const targetYear = activeTab === 'SSC' 
            ? (parseInt(viewYear) - 1).toString() 
            : viewYear;

        setIsFetchingStudents(true);
        
        const q = query(
            collection(db, 'students'), 
            where('academicYear', '==', targetYear)
        );
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAllStudents(snapshot.docs.map(studentFromDoc));
            setIsFetchingStudents(false);
        }, (error) => {
            console.error("Student fetch error:", error);
            setIsFetchingStudents(false);
        });
        
        return () => unsubscribe();
    }, [db, user, isClient, viewYear, activeTab]);

    useEffect(() => {
        if (!editingId) {
            setFormData(prev => ({ ...prev, examType: activeTab, academicYear: viewYear }));
        }
    }, [activeTab, viewYear, editingId]);

    const candidateStudents = useMemo(() => {
        const targetClass = activeTab === 'SSC' ? '10' : '8';
        let filtered = allStudents.filter(s => s.className === targetClass);
        
        if (dialogSearchQuery.trim()) {
            const q = dialogSearchQuery.toLowerCase();
            filtered = filtered.filter(s => 
                s.studentNameBn.toLowerCase().includes(q) || 
                String(s.roll).includes(q) || 
                (s.generatedId || '').toLowerCase().includes(q)
            );
        }

        return filtered.sort((a, b) => (a.roll || 0) - (b.roll || 0));
    }, [allStudents, activeTab, dialogSearchQuery]);

    const toggleStudentSelection = (id: string) => {
        const next = new Set(selectedStudentIdsInDialog);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedStudentIdsInDialog(next);
    };

    const handleSave = async () => {
        if (!db) return;
        
        if (!editingId && selectedStudentIdsInDialog.size > 0) {
            setIsSaving(true);
            try {
                let successCount = 0;
                for (const studentId of Array.from(selectedStudentIdsInDialog)) {
                    const student = allStudents.find(s => s.id === studentId);
                    if (student) {
                        const data: NewPublicExamData = {
                            registrationNo: student.prevRegNo || '',
                            rollNo: String(student.roll || ''), 
                            examRoll: '',
                            studentName: student.studentNameBn,
                            photoUrl: student.photoUrl || '',
                            group: (student.group || 'general').toLowerCase(),
                            boardName: 'Dinajpur',
                            centerName: '',
                            totalMarks: 0,
                            grade: '',
                            gpa: 0,
                            examType: activeTab,
                            academicYear: viewYear
                        };
                        await savePublicExamRecord(db, data);
                        successCount++;
                    }
                }
                toast({ title: 'সফল', description: `${toBengaliNumber(successCount)} জন শিক্ষার্থীর রেকর্ড সংরক্ষিত হয়েছে।` });
                setIsAddOpen(false);
                setSelectedStudentIdsInDialog(new Set());
                fetchRecords();
            } catch (e) {
                console.error(e);
                toast({ variant: 'destructive', title: 'ত্রুটি', description: 'রেকর্ড সংরক্ষণ করা যায়নি।' });
            } finally {
                setIsSaving(false);
            }
            return;
        }

        if (!formData.registrationNo && !formData.rollNo && !formData.studentName) {
            toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ', description: 'অন্তত একটি শিক্ষার্থী নির্বাচন করুন অথবা তথ্য পূরণ করুন।' });
            return;
        }

        setIsSaving(true);
        try {
            await savePublicExamRecord(db, formData, editingId || undefined);
            toast({ title: editingId ? 'রেকর্ড আপডেট হয়েছে' : 'রেকর্ড সংরক্ষিত হয়েছে' });
            setIsAddOpen(false);
            setEditingId(null);
            setFormData({
                registrationNo: '', rollNo: '', examRoll: '', studentName: '', photoUrl: '', group: 'general', boardName: 'Dinajpur',
                centerName: '', totalMarks: 0, grade: '', gpa: 0,
                examType: activeTab, academicYear: viewYear
            });
            fetchRecords();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (record: PublicExamRecord) => {
        setFormData({
            registrationNo: record.registrationNo,
            rollNo: record.rollNo,
            examRoll: record.examRoll || '',
            studentName: record.studentName,
            photoUrl: record.photoUrl || '',
            group: record.group,
            boardName: record.boardName || 'Dinajpur',
            centerName: record.centerName || '',
            totalMarks: record.totalMarks || 0,
            grade: record.grade || '',
            gpa: record.gpa || 0,
            examType: record.examType,
            academicYear: record.academicYear
        });
        setEditingId(record.id);
        setIsAddOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!db) return;
        try {
            await deletePublicExamRecord(db, id);
            toast({ title: 'রেকর্ড মুছে ফেলা হয়েছে' });
            fetchRecords();
        } catch (e) {}
    };

    if (!isClient) return null;

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#F6F7F9] font-kalpurush">
            <Header />
            <style jsx global>{`
                @media print {
                    @page { size: A4 landscape; margin: 10mm !important; }
                    html, body { height: auto !important; background: white !important; }
                    .printable-area { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; padding: 0 !important; margin: 0 !important; display: block !important; }
                    .printable-area table { border-collapse: collapse !important; width: 100% !important; table-layout: auto !important; }
                    .printable-area th, .printable-area td { border: 1.5px solid black !important; padding: 4px 2px !important; font-size: 10px !important; line-height: 1.2 !important; color: black !important; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <main className="flex-1 flex flex-col md:flex-row h-full max-w-[1600px] mx-auto w-full p-4 md:p-6 lg:p-10 gap-8 pb-40">
                
                {/* Sidebar Navigation */}
                <aside className="w-full md:w-64 shrink-0 space-y-1 no-print bg-white md:bg-transparent p-4 md:p-0 border-b md:border-0 sticky top-20 md:top-28 self-start">
                    <h2 className="text-2xl font-black mb-6 px-4 hidden md:block text-slate-900 tracking-tight">রেকর্ড শাখা</h2>
                    <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-1 scrollbar-none">
                        {examTypes.map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold whitespace-nowrap min-w-fit",
                                    activeTab === item.id ? "bg-white shadow-md text-primary scale-105" : "text-muted-foreground hover:bg-slate-200/50"
                                )}
                            >
                                <div className={cn("p-1.5 rounded-lg shrink-0", activeTab === item.id ? item.color : "bg-muted")}>
                                    <item.icon className="h-4 w-4" />
                                </div>
                                <span className="text-sm font-black">{item.label}</span>
                                {activeTab === item.id && <ChevronRight className="ml-auto h-4 w-4 hidden md:block" />}
                            </button>
                        ))}
                    </div>
                </aside>

                {/* Main Content Area */}
                <div className="flex-1 min-w-0 flex flex-col gap-6 transition-all duration-500 animate-in fade-in slide-in-from-right-4">
                    
                    {/* Header Toolbar */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print">
                        <div className="space-y-1">
                            <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-lg px-4 py-1">
                                    {examTypes.find(t => t.id === activeTab)?.label}
                                </Badge>
                            </h2>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border-2 border-primary/10 shadow-sm">
                                <Label className="font-black text-primary text-[10px] uppercase whitespace-nowrap">সাল:</Label>
                                <Select value={viewYear} onValueChange={setViewYear}>
                                    <SelectTrigger className="w-24 h-7 border-none font-black text-primary focus:ring-0">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableYears.map(y => (
                                            <SelectItem key={y} value={y} className="font-bold">{toBengaliNumber(y)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {canManage && (
                                <Dialog open={isAddOpen} onOpenChange={(open) => {
                                    setIsAddOpen(open);
                                    if (!open) {
                                        setEditingId(null);
                                        setSelectedStudentIdsInDialog(new Set());
                                        setDialogSearchQuery('');
                                        setFormData({
                                            registrationNo: '', rollNo: '', examRoll: '', studentName: '', photoUrl: '', group: 'general', boardName: 'Dinajpur',
                                            centerName: '', totalMarks: 0, grade: '', gpa: 0,
                                            examType: activeTab, academicYear: viewYear
                                        });
                                    }
                                }}>
                                    <DialogTrigger asChild>
                                        <Button className="h-10 px-6 rounded-xl bg-primary hover:bg-primary/90 shadow-lg font-black gap-2 transition-all active:scale-95">
                                            <Plus className="h-5 w-5" /> নতুন রেকর্ড
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-3xl font-kalpurush p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                                        <DialogHeader className="p-6 bg-primary text-white">
                                            <DialogTitle className="text-2xl font-black">{editingId ? 'রেকর্ড সংশোধন করুন' : 'অংশগ্রহণকারী শিক্ষার্থী নির্বাচন'} ({toBengaliNumber(viewYear)})</DialogTitle>
                                            <DialogDescription className="text-white/80 font-bold">
                                                {activeTab === 'SSC' 
                                                    ? `${toBengaliNumber(parseInt(viewYear) - 1)} সালের ১০ম শ্রেণির শিক্ষার্থীদের তালিকা`
                                                    : `${toBengaliNumber(viewYear)} সালের ৮ম শ্রেণির শিক্ষার্থীদের তালিকা`}
                                            </DialogDescription>
                                        </DialogHeader>
                                        
                                        <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto bg-white">
                                            {!editingId ? (
                                                <div className="space-y-4">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                        <div className="relative flex-1">
                                                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                            <Input 
                                                                placeholder="শিক্ষার্থী খুঁজুন (নাম বা রোল)..." 
                                                                value={dialogSearchQuery}
                                                                onChange={e => setDialogSearchQuery(e.target.value)}
                                                                className="pl-9 h-10 border-2"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg border">
                                                            <Checkbox 
                                                                id="select-all" 
                                                                checked={selectedStudentIdsInDialog.size === candidateStudents.length && candidateStudents.length > 0}
                                                                onCheckedChange={(checked) => {
                                                                    if (checked) setSelectedStudentIdsInDialog(new Set(candidateStudents.map(s => s.id)));
                                                                    else setSelectedStudentIdsInDialog(new Set());
                                                                }}
                                                            />
                                                            <Label htmlFor="select-all" className="text-xs font-black cursor-pointer">সবাইকে টিক দিন</Label>
                                                        </div>
                                                    </div>

                                                    <ScrollArea className="h-[400px] border-2 rounded-xl p-2 bg-slate-50/30">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {candidateStudents.length === 0 ? (
                                                                <div className="col-span-full py-20 text-center text-muted-foreground italic font-bold">
                                                                    কোনো শিক্ষার্থী পাওয়া যায়নি।
                                                                </div>
                                                            ) : (
                                                                candidateStudents.map(s => (
                                                                    <div 
                                                                        key={s.id} 
                                                                        className={cn(
                                                                            "flex items-center gap-3 p-3 border-2 rounded-xl transition-all cursor-pointer",
                                                                            selectedStudentIdsInDialog.has(s.id) ? "bg-primary/5 border-primary shadow-sm" : "bg-white border-slate-100 hover:border-primary/20"
                                                                        )}
                                                                        onClick={() => toggleStudentSelection(s.id)}
                                                                    >
                                                                        <Checkbox 
                                                                            checked={selectedStudentIdsInDialog.has(s.id)}
                                                                            onCheckedChange={() => toggleStudentSelection(s.id)}
                                                                            onClick={e => e.stopPropagation()}
                                                                        />
                                                                        <Avatar className="h-10 w-10 border shadow-sm shrink-0">
                                                                            <AvatarImage src={s.photoUrl || getStudentPlaceholderImage(s.gender)} className="object-cover" />
                                                                            <AvatarFallback className="font-black text-xs">S</AvatarFallback>
                                                                        </Avatar>
                                                                        <div className="flex-1 overflow-hidden">
                                                                            <p className="font-black text-slate-800 truncate text-sm">{s.studentNameBn}</p>
                                                                            <p className="text-[10px] font-bold text-muted-foreground">শ্রেণির রোল: {toBengaliNumber(s.roll)} | আইডি: {toBengaliNumber(s.generatedId || '')}</p>
                                                                        </div>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </ScrollArea>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                                                    <div className="space-y-2">
                                                        <Label className="font-bold">শিক্ষার্থীর নাম *</Label>
                                                        <Input value={formData.studentName} onChange={e => setFormData({...formData, studentName: e.target.value})} placeholder="নাম লিখুন" className="border-2 font-black" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="font-bold">বোর্ডের নাম</Label>
                                                        <Select value={formData.boardName} onValueChange={(v) => setFormData({...formData, boardName: v})}>
                                                            <SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue placeholder="বোর্ড নির্বাচন" /></SelectTrigger>
                                                            <SelectContent>
                                                                {educationBoards.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="font-bold">পরীক্ষা কেন্দ্রের নাম</Label>
                                                        <Select value={formData.centerName} onValueChange={(v) => setFormData({...formData, centerName: v})}>
                                                            <SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue placeholder="কেন্দ্র নির্বাচন করুন" /></SelectTrigger>
                                                            <SelectContent>
                                                                {birganjCenters.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="font-bold">রেজিস্ট্রেশন নং (ESIF অনুযায়ী)</Label>
                                                        <Input value={formData.registrationNo} onChange={e => setFormData({...formData, registrationNo: e.target.value})} placeholder="রেজিস্ট্রেশন নম্বর" className="border-2 font-black text-blue-900" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="font-bold">পাবলিক পরীক্ষার রোল নং *</Label>
                                                        <Input value={formData.examRoll} onChange={e => setFormData({...formData, examRoll: e.target.value})} placeholder="বোর্ড রোল লিখুন" className="border-2 font-black text-rose-700" />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="font-bold">বিভাগ/গ্রুপ</Label>
                                                        <Select value={formData.group} onValueChange={(v) => setFormData({...formData, group: v})}>
                                                            <SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue /></SelectTrigger>
                                                            <SelectContent>
                                                                {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label className="font-bold">প্রাপ্ত মোট নম্বর</Label>
                                                        <Input type="number" value={formData.totalMarks || ''} onChange={e => setFormData({...formData, totalMarks: parseInt(e.target.value) || 0})} className="border-2 font-black" />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <Label className="font-bold">প্রাপ্ত গ্রেড</Label>
                                                            <Input value={formData.grade} onChange={e => setFormData({...formData, grade: e.target.value})} placeholder="A+" className="border-2 font-black text-center" />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="font-bold">প্রাপ্ত জিপিএ</Label>
                                                            <Input type="number" step="0.01" value={formData.gpa || ''} onChange={e => setFormData({...formData, gpa: parseFloat(e.target.value) || 0})} placeholder="৫.০০" className="border-2 font-black text-center" />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <DialogFooter className="p-6 bg-slate-50 border-t">
                                            <DialogClose asChild><Button variant="ghost" className="font-bold h-12 px-6">বাতিল</Button></DialogClose>
                                            <Button 
                                                onClick={handleSave} 
                                                disabled={isSaving || (!editingId && selectedStudentIdsInDialog.size === 0 && !formData.studentName)} 
                                                className="px-12 font-black h-12 shadow-xl"
                                            >
                                                {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
                                                {editingId ? 'আপডেট করুন' : 'রেকর্ড সংরক্ষণ'}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                            <Button variant="outline" className="h-10 border-2 border-primary text-primary font-black px-6 rounded-xl" onClick={() => window.print()}>
                                <Printer className="mr-2 h-4 w-4" /> প্রিন্ট করুন
                            </Button>
                        </div>
                    </div>

                    {/* Data Table Card */}
                    <Card className="border-[4px] border-black rounded-[32px] overflow-hidden shadow-2xl bg-white">
                        <CardHeader className="bg-primary/5 p-6 border-b-[3px] border-black flex flex-row justify-between items-center no-print">
                            <CardTitle className="text-xl font-black text-primary flex items-center gap-2">
                                <BookOpen className="h-6 w-6" /> অংশগ্রহণকারী শিক্ষার্থীর তালিকা
                            </CardTitle>
                            <Badge variant="outline" className="font-black bg-white border-primary text-primary px-4">
                                মোট: {toBengaliNumber(records.length)} জন
                            </Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="printable-area bg-white p-0 sm:p-4">
                                <div className="hidden print:block text-center mb-6 border-b-4 border-black pb-4">
                                    <h1 className="text-3xl font-black uppercase mb-1">{schoolInfo?.name}</h1>
                                    <p className="text-lg font-bold text-slate-700">{schoolInfo?.address}</p>
                                    <div className="inline-block border-2 border-black px-10 py-1.5 rounded-full font-black text-xl uppercase bg-slate-50 mt-2">
                                        {examTypes.find(t => t.id === activeTab)?.label} - রেকর্ড ({toBengaliNumber(viewYear)})
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <Table className="border-collapse border-spacing-0 w-full min-w-full border-black">
                                        <TableHeader className="bg-slate-100">
                                            <TableRow className="h-14 border-b-[3px] border-black">
                                                <TableHead className="border-r-[2px] border-black text-center font-black text-black text-xs w-12">ছবি</TableHead>
                                                <TableHead className="border-r-[2px] border-black text-center font-black text-black text-xs w-20">বোর্ড</TableHead>
                                                <TableHead className="border-r-[2px] border-black text-center font-black text-black text-xs w-24">রেজিস্ট্রেশন নং</TableHead>
                                                <TableHead className="border-r-[2px] border-black text-center font-black text-black text-xs w-20">বোর্ড রোল</TableHead>
                                                <TableHead className="border-r-[2px] border-black text-center font-black text-black text-xs w-16">শ্রেণি রোল</TableHead>
                                                <TableHead className="border-r-[2px] border-black text-left pl-3 font-black text-black text-xs min-w-[150px]">শিক্ষার্থীর নাম</TableHead>
                                                <TableHead className="border-r-[2px] border-black text-center font-black text-black text-xs w-16">বিভাগ</TableHead>
                                                <TableHead className="border-r-[2px] border-black text-center font-black text-black text-xs">কেন্দ্র</TableHead>
                                                <TableHead className="border-r-[2px] border-black text-center font-black text-black text-xs w-14">নম্বর</TableHead>
                                                <TableHead className="border-r-[2px] border-black text-center font-black text-black text-xs w-12">গ্রেড</TableHead>
                                                <TableHead className="border-r-[2px] border-black text-center font-black text-black text-xs w-12">GPA</TableHead>
                                                <TableHead className="text-right pr-6 font-black text-black text-xs no-print">কার্যক্রম</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {isLoading ? (
                                                <TableRow><TableCell colSpan={12} className="text-center py-20 italic font-bold text-muted-foreground"><Loader2 className="animate-spin h-8 w-8 mx-auto mb-2" /> লোড হচ্ছে...</TableCell></TableRow>
                                            ) : records.length === 0 ? (
                                                <TableRow><TableCell colSpan={12} className="text-center py-24 text-xl font-black text-slate-300 italic border-b-2 border-black">কোনো রেকর্ড পাওয়া যায়নি।</TableCell></TableRow>
                                            ) : (
                                                records.map((record) => (
                                                    <TableRow key={record.id} className="h-12 border-b-2 border-black hover:bg-slate-50 transition-colors">
                                                        <TableCell className="border-r-2 border-black text-center p-1">
                                                            <Avatar className="h-9 w-9 border shadow-sm mx-auto">
                                                                <AvatarImage src={record.photoUrl || getStudentPlaceholderImage()} className="object-cover" />
                                                                <AvatarFallback className="font-black text-xs">S</AvatarFallback>
                                                            </Avatar>
                                                        </TableCell>
                                                        <TableCell className="border-r-2 border-black text-center font-bold text-[10px] text-slate-700">{record.boardName || '-'}</TableCell>
                                                        <TableCell className="border-r-2 border-black text-center font-black text-[11px] text-slate-800">{toBengaliNumber(record.registrationNo)}</TableCell>
                                                        <TableCell className="border-r-2 border-black text-center font-black text-[11px] text-rose-700">{toBengaliNumber(record.examRoll || '-')}</TableCell>
                                                        <TableCell className="border-r-2 border-black text-center font-black text-[11px] text-slate-800">{toBengaliNumber(record.rollNo)}</TableCell>
                                                        <TableCell className="border-r-2 border-black font-black text-xs pl-3 text-slate-900">{record.studentName}</TableCell>
                                                        <TableCell className="border-r-2 border-black text-center font-bold text-[10px] uppercase">
                                                            {groups.find(g => g.id === record.group)?.label || record.group}
                                                        </TableCell>
                                                        <TableCell className="border-r-2 border-black text-center font-medium text-[10px] text-slate-600 px-1">{record.centerName || '-'}</TableCell>
                                                        <TableCell className="border-r-2 border-black text-center font-black text-sm text-primary">{toBengaliNumber(record.totalMarks)}</TableCell>
                                                        <TableCell className={cn("border-r-2 border-black text-center font-black text-sm", record.grade?.startsWith('F') ? "text-rose-600" : "text-emerald-700")}>{record.grade}</TableCell>
                                                        <TableCell className="border-r-2 border-black text-center font-black text-sm text-blue-900">{toBengaliNumber(record.gpa.toFixed(2))}</TableCell>
                                                        <TableCell className="text-right pr-6 no-print">
                                                            <div className="flex justify-end gap-2">
                                                                <Button 
                                                                    variant="outline" 
                                                                    size="icon" 
                                                                    className="h-8 w-8 text-blue-600 border-blue-100 hover:bg-blue-50"
                                                                    onClick={() => handleEdit(record)}
                                                                >
                                                                    <FilePen className="h-4 w-4" />
                                                                </Button>
                                                                {canManage && (
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50">
                                                                                <Trash2 className="h-4 w-4" />
                                                                            </Button>
                                                                        </AlertDialogTrigger>
                                                                        <AlertDialogContent className="font-kalpurush">
                                                                            <AlertDialogHeader>
                                                                                <AlertDialogTitle className="text-rose-700 font-black flex items-center gap-2">আপনি কি নিশ্চিত?</AlertDialogTitle>
                                                                                <AlertDialogDescription className="font-bold text-base">এই রেকর্ডটি স্থায়ীভাবে মুছে ফেলা হবে।</AlertDialogDescription>
                                                                            </AlertDialogHeader>
                                                                            <AlertDialogFooter>
                                                                                <AlertDialogCancel className="font-bold">বাতিল</AlertDialogCancel>
                                                                                <AlertDialogAction onClick={() => handleDelete(record.id)} className="bg-destructive text-white font-black">হ্যাঁ, মুছুন</AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>

                                <div className="hidden print:flex justify-between items-end mt-16 px-10">
                                    <div className="text-center w-56 border-t-2 border-black pt-2 font-black text-lg">অফিস সহকারী</div>
                                    <div className="text-center w-56 border-t-2 border-black pt-2 font-black text-lg">প্রধান শিক্ষক</div>
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="p-6 bg-slate-50 border-t-[3px] border-black flex justify-between items-center no-print">
                            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                                <Info className="h-4 w-4" /> সর্বশেষ তথ্য অনুযায়ী মোট রেকর্ড: {toBengaliNumber(records.length)} টি
                            </div>
                            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                Digital Management Portal | {schoolInfo?.name}
                            </div>
                        </CardFooter>
                    </Card>
                </div>
            </main>
        </div>
    );
}
