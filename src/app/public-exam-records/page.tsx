
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { 
    Award, Plus, Search, Trash2, Printer, Loader2, Save, X, 
    FileText, GraduationCap, School, Info, CheckCircle2, History, User, Users, ChevronRight, Calendar, FilePen, Check
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

const examTypes: { id: PublicExamType; label: string }[] = [
    { id: 'SSC', label: 'এসএসসি পরীক্ষা' },
    { id: 'JSC', label: 'জেএসসি পরীক্ষা' },
    { id: 'Scholarship', label: 'অষ্টম শ্রেণির বৃত্তি' },
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
            <main className="flex-1 p-4 md:p-8 lg:p-12 max-w-[1600px] mx-auto w-full pb-40">
                <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 no-print">
                    <div className="space-y-1">
                        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                            <Award className="h-10 w-10 text-primary" /> পাবলিক পরীক্ষার রেকর্ড
                        </h2>
                        <p className="text-muted-foreground font-bold">অংশগ্রহণকারী শিক্ষার্থীর তথ্য সংরক্ষণাগার</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border-2 border-primary/10 shadow-sm">
                            <Label className="font-black text-primary text-xs uppercase whitespace-nowrap">পরীক্ষার সাল:</Label>
                            <Select value={viewYear} onValueChange={setViewYear}>
                                <SelectTrigger className="w-32 h-8 border-none font-black text-primary focus:ring-0">
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
                                    <Button className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 shadow-xl font-black gap-2 transition-all active:scale-95 text-lg">
                                        <Plus className="h-6 w-6" /> নতুন রেকর্ড যোগ
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-3xl font-kalpurush p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                                    <DialogHeader className="p-6 bg-primary text-white">
                                        <DialogTitle className="text-2xl font-black">{editingId ? 'রেকর্ড সংশোধন করুন' : 'অংশগ্রহণকারী শিক্ষার্থী নির্বাচন'} (সাল: {toBengaliNumber(viewYear)})</DialogTitle>
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
                                                
                                                <div className="p-4 bg-amber-50 rounded-xl border-2 border-dashed border-amber-200 flex items-start gap-3">
                                                    <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                                                    <p className="text-xs font-bold text-amber-900 leading-relaxed">
                                                        শিক্ষার্থীদের টিক দিয়ে সেভ করুন। পরবর্তীতে মূল টেবিলের **এডিট** বাটন ব্যবহার করে প্রত্যেকের পরীক্ষার রোল, জিপিএ ও নম্বর সংশোধন করা যাবে।
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                                                <div className="space-y-2">
                                                    <Label className="font-bold">পরীক্ষার ধরন</Label>
                                                    <Select value={formData.examType} onValueChange={(v: any) => setFormData({...formData, examType: v})}>
                                                        <SelectTrigger className="bg-slate-50 border-2 font-bold"><SelectValue /></SelectTrigger>
                                                        <SelectContent>
                                                            {examTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
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
                                                    <Label className="font-bold">শ্রেণির রোল নং * (অটো)</Label>
                                                    <Input value={formData.rollNo} onChange={e => setFormData({...formData, rollNo: e.target.value})} placeholder="শ্রেণির রোল" className="border-2 font-bold bg-slate-50" />
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
                                            className="px-12 font-black h-12 shadow-xl min-w-[160px]"
                                        >
                                            {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
                                            {editingId ? 'আপডেট করুন' : (selectedStudentIdsInDialog.size > 0 ? `নির্বাচিত ${toBengaliNumber(selectedStudentIdsInDialog.size)} জনকে যুক্ত করুন` : 'রেকর্ড সেভ করুন')}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                        <Button variant="outline" className="h-12 border-2 border-primary text-primary font-black px-6 rounded-2xl" onClick={() => window.print()}>
                            <Printer className="mr-2 h-5 w-5" /> প্রিন্ট করুন
                        </Button>
                    </div>
                </div>

                <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
                    <TabsList className="grid w-full grid-cols-3 h-16 bg-muted/50 p-1.5 rounded-3xl mb-8 no-print shadow-inner">
                        {examTypes.map(t => (
                            <TabsTrigger key={t.id} value={t.id} className="font-black text-lg rounded-2xl data-[state=active]:bg-white data-[state=active]:shadow-lg transition-all">
                                {t.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>

                    {examTypes.map(type => (
                        <TabsContent key={type.id} value={type.id} className="animate-in fade-in duration-500 outline-none">
                            <Card className="border-[4px] border-black rounded-[32px] overflow-hidden shadow-2xl bg-white">
                                <CardHeader className="bg-primary/5 p-8 border-b-[3px] border-black text-center print:hidden">
                                    <div className="flex flex-col items-center gap-3">
                                        <h3 className="text-2xl font-black text-primary underline underline-offset-8">অংশগ্রহণকারী শিক্ষার্থীর তথ্য</h3>
                                        <p className="font-black text-slate-600 bg-white px-6 py-1 rounded-full border-2 border-primary/20 shadow-sm mt-2">
                                            {type.label} - {toBengaliNumber(viewYear)} সাল
                                        </p>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="printable-area bg-white p-0 sm:p-4">
                                        <div className="hidden print:block text-center mb-10 border-b-4 border-black pb-4">
                                            <h1 className="text-3xl font-black uppercase mb-1">{schoolInfo?.name}</h1>
                                            <p className="text-lg font-bold text-slate-700">{schoolInfo?.address}</p>
                                            <div className="inline-block border-2 border-black px-10 py-1.5 rounded-full font-black text-xl uppercase bg-slate-50">
                                                {type.label} - অংশগ্রহণকারী শিক্ষার্থীর তথ্য ({toBengaliNumber(viewYear)})
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <Table className="border-collapse border-spacing-0 w-full min-w-[1200px] border-black">
                                                <TableHeader className="bg-slate-100">
                                                    <TableRow className="h-14 border-b-[3px] border-black">
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-sm w-14">ছবি</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-sm w-28">বোর্ড</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-sm w-32">রেজিস্ট্রেশন নং</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-sm w-24">পরীক্ষার রোল</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-sm w-24">শ্রেণির রোল</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-left pl-4 font-black text-black text-sm">নাম</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-sm w-24">বিভাগ</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-sm">কেন্দ্র নাম</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-sm w-24">প্রাপ্ত মোট নম্বর</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-sm w-20">প্রাপ্ত গ্রেড</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-sm w-20">প্রাপ্ত জিপিএ</TableHead>
                                                        <TableHead className="text-right pr-6 font-black text-black text-sm no-print">কার্যক্রম</TableHead>
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
                                                                    <Avatar className="h-10 w-10 border shadow-sm mx-auto">
                                                                        <AvatarImage src={record.photoUrl || getStudentPlaceholderImage()} className="object-cover" />
                                                                        <AvatarFallback className="font-black text-xs">S</AvatarFallback>
                                                                    </Avatar>
                                                                </TableCell>
                                                                <TableCell className="border-r-2 border-black text-center font-bold text-xs text-slate-700">{record.boardName || '-'}</TableCell>
                                                                <TableCell className="border-r-2 border-black text-center font-black text-sm text-slate-800">{toBengaliNumber(record.registrationNo)}</TableCell>
                                                                <TableCell className="border-r-2 border-black text-center font-black text-sm text-rose-700">{toBengaliNumber(record.examRoll || '-')}</TableCell>
                                                                <TableCell className="border-r-2 border-black text-center font-black text-sm text-slate-800">{toBengaliNumber(record.rollNo)}</TableCell>
                                                                <TableCell className="border-r-2 border-black font-black text-sm pl-4 text-slate-900">{record.studentName}</TableCell>
                                                                <TableCell className="border-r-2 border-black text-center font-bold text-xs uppercase">
                                                                    {groups.find(g => g.id === record.group)?.label || record.group}
                                                                </TableCell>
                                                                <TableCell className="border-r-2 border-black text-center font-medium text-xs text-slate-600">{record.centerName || '-'}</TableCell>
                                                                <TableCell className="border-r-2 border-black text-center font-black text-base text-primary">{toBengaliNumber(record.totalMarks)}</TableCell>
                                                                <TableCell className={cn("border-r-2 border-black text-center font-black text-base", record.grade === 'F' ? "text-rose-600" : "text-emerald-700")}>{record.grade}</TableCell>
                                                                <TableCell className="border-r-2 border-black text-center font-black text-base text-blue-900">{toBengaliNumber(record.gpa.toFixed(2))}</TableCell>
                                                                <TableCell className="text-right pr-6 no-print">
                                                                    <div className="flex justify-end gap-2">
                                                                        <Button 
                                                                            variant="outline" 
                                                                            size="icon" 
                                                                            className="h-9 w-9 text-blue-600 border-blue-100 hover:bg-blue-50"
                                                                            onClick={() => handleEdit(record)}
                                                                        >
                                                                            <FilePen className="h-5 w-5" />
                                                                        </Button>
                                                                        {canManage && (
                                                                            <AlertDialog>
                                                                                <AlertDialogTrigger asChild>
                                                                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-500 hover:text-rose-700 hover:bg-rose-50">
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

                                        <div className="hidden print:flex justify-between items-end mt-32 px-10">
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
                        </TabsContent>
                    ))}
                </Tabs>
            </main>
        </div>
    );
}
