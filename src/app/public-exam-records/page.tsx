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
    FileText, GraduationCap, School, Info, CheckCircle2, History, User, Users, ChevronRight
} from 'lucide-react';
import { PublicExamRecord, PublicExamType, getPublicExamRecords, savePublicExamRecord, deletePublicExamRecord, NewPublicExamData } from '@/lib/public-exam-data';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Student, studentFromDoc } from '@/lib/student-data';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';

const examTypes: { id: PublicExamType; label: string }[] = [
    { id: 'SSC', label: 'এসএসসি পরীক্ষা' },
    { id: 'JSC', label: 'জেএসসি পরীক্ষা' },
    { id: 'Scholarship', label: 'অষ্টম শ্রেণির বৃত্তি' },
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

export default function PublicExamRecordsPage() {
    const db = useFirestore();
    const { selectedYear, availableYears } = useAcademicYear();
    const { user, hasPermission } = useAuth();
    const { toast } = useToast();
    const { schoolInfo } = useSchoolInfo();

    const [isClient, setIsClient] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<PublicExamType>('SSC');
    const [records, setRecords] = useState<PublicExamRecord[]>([]);
    
    // Student Link States
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [isFetchingStudents, setIsFetchingStudents] = useState(false);
    
    // Form States
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState<NewPublicExamData>({
        registrationNo: '',
        rollNo: '',
        studentName: '',
        group: 'general',
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
            const data = await getPublicExamRecords(db, selectedYear, activeTab);
            setRecords(data.sort((a, b) => (parseFloat(b.gpa.toString()) || 0) - (parseFloat(a.gpa.toString()) || 0)));
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    }, [db, user, selectedYear, activeTab]);

    useEffect(() => {
        setIsClient(true);
        fetchRecords();
    }, [fetchRecords]);

    // Reactive listener for students to link
    useEffect(() => {
        if (!db || !user || !isClient) return;
        setIsFetchingStudents(true);
        const q = query(collection(db, 'students'), where('academicYear', '==', selectedYear));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setAllStudents(snapshot.docs.map(studentFromDoc));
            setIsFetchingStudents(false);
        });
        return () => unsubscribe();
    }, [db, user, isClient, selectedYear]);

    useEffect(() => {
        setFormData(prev => ({ ...prev, examType: activeTab, academicYear: selectedYear }));
    }, [activeTab, selectedYear]);

    const candidateStudents = useMemo(() => {
        // SSC usually for Class 10, JSC/Scholarship for Class 8
        const targetClass = activeTab === 'SSC' ? '10' : '8';
        return allStudents
            .filter(s => s.className === targetClass)
            .sort((a, b) => (a.roll || 0) - (b.roll || 0));
    }, [allStudents, activeTab]);

    const handleStudentLink = (studentId: string) => {
        const student = allStudents.find(s => s.id === studentId);
        if (student) {
            setFormData(prev => ({
                ...prev,
                studentName: student.studentNameBn,
                rollNo: String(student.roll || ''),
                registrationNo: student.prevRegNo || '',
                group: (student.group || 'general').toLowerCase()
            }));
            toast({ title: 'শিক্ষার্থীর তথ্য লোড হয়েছে', description: `${student.studentNameBn} এর তথ্য ফরমে যুক্ত হয়েছে।` });
        }
    };

    const handleSave = async () => {
        if (!db) return;
        if (!formData.registrationNo || !formData.rollNo || !formData.studentName) {
            toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ', description: 'রেজিস্ট্রেশন, রোল এবং নাম অবশ্যই দিতে হবে।' });
            return;
        }

        setIsSaving(true);
        try {
            await savePublicExamRecord(db, formData);
            toast({ title: 'রেকর্ড সফলভাবে সংরক্ষিত হয়েছে' });
            setIsAddOpen(false);
            setFormData({
                registrationNo: '', rollNo: '', studentName: '', group: 'general',
                centerName: '', totalMarks: 0, grade: '', gpa: 0,
                examType: activeTab, academicYear: selectedYear
            });
            fetchRecords();
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
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
                            <Award className="h-10 w-10 text-primary" /> পাবলিক পরীক্ষার অংশগ্রহণকারী শিক্ষার্থীর তথ্য
                        </h2>
                        <p className="text-muted-foreground font-bold">এসএসসি, জেএসসি এবং বৃত্তি পরীক্ষার রেকর্ড সংরক্ষণাগার</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {canManage && (
                            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                                <DialogTrigger asChild>
                                    <Button className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 shadow-xl font-black gap-2 transition-all active:scale-95 text-lg">
                                        <Plus className="h-6 w-6" /> নতুন রেকর্ড যোগ
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-3xl font-kalpurush p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
                                    <DialogHeader className="p-6 bg-primary text-white">
                                        <DialogTitle className="text-2xl font-black">শিক্ষার্থীর তথ্য এন্ট্রি করুন</DialogTitle>
                                        <DialogDescription className="text-white/80 font-bold">নিচে থেকে শিক্ষার্থী নির্বাচন করুন অথবা ম্যানুয়ালি লিখুন</DialogDescription>
                                    </DialogHeader>
                                    <div className="p-8 space-y-6 max-h-[75vh] overflow-y-auto bg-white">
                                        
                                        {/* Student Selection Link */}
                                        <div className="p-4 bg-primary/5 border-2 border-dashed border-primary/20 rounded-xl space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="font-black text-primary uppercase text-[10px] tracking-widest">ডাটাবেস থেকে শিক্ষার্থী খুঁজুন ({activeTab === 'SSC' ? '১০ম শ্রেণি' : '৮ম শ্রেণি'})</Label>
                                                {isFetchingStudents && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                                            </div>
                                            <Select onValueChange={handleStudentLink}>
                                                <SelectTrigger className="h-11 bg-white border-2">
                                                    <SelectValue placeholder="শিক্ষার্থী নির্বাচন করুন..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {candidateStudents.length === 0 ? (
                                                        <div className="p-4 text-center text-xs font-bold text-muted-foreground italic">এই শ্রেণির কোনো শিক্ষার্থী পাওয়া যায়নি।</div>
                                                    ) : (
                                                        candidateStudents.map(s => (
                                                            <SelectItem key={s.id} value={s.id} className="font-bold">
                                                                রোল: {toBengaliNumber(s.roll)} - {s.studentNameBn}
                                                            </SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                            <p className="text-[10px] font-bold text-muted-foreground italic">
                                                * শিক্ষার্থী নির্বাচন করলে তার নাম, রোল ও রেজিস্ট্রেশন স্বয়ংক্রিয়ভাবে ফরমে চলে আসবে।
                                            </p>
                                        </div>

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
                                                <Label className="font-bold">রেজিস্ট্রেশন নং (ESIF অনুযায়ী)</Label>
                                                <Input value={formData.registrationNo} onChange={e => setFormData({...formData, registrationNo: e.target.value})} placeholder="রেজিস্ট্রেশন নম্বর লিখুন" className="border-2 font-black text-blue-900" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="font-bold">পাবলিক পরীক্ষার রোল নং *</Label>
                                                <Input value={formData.rollNo} onChange={e => setFormData({...formData, rollNo: e.target.value})} placeholder="বোর্ড রোল লিখুন" className="border-2 font-black text-rose-700" />
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
                                                <Label className="font-bold">পরীক্ষা কেন্দ্রের নাম</Label>
                                                <Input value={formData.centerName} onChange={e => setFormData({...formData, centerName: e.target.value})} placeholder="কেন্দ্রের নাম" className="border-2" />
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
                                    </div>
                                    <DialogFooter className="p-6 bg-slate-50 border-t">
                                        <DialogClose asChild><Button variant="ghost" className="font-bold h-12 px-6">বাতিল</Button></DialogClose>
                                        <Button onClick={handleSave} disabled={isSaving} className="px-12 font-black h-12 shadow-xl min-w-[160px]">
                                            {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2 h-5 w-5" />}
                                            রেকর্ড সেভ করুন
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
                                            {type.label} - {toBengaliNumber(selectedYear)}
                                        </p>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="printable-area bg-white p-0 sm:p-4">
                                        {/* Print Only Title */}
                                        <div className="hidden print:block text-center mb-10 border-b-4 border-black pb-4">
                                            <h1 className="text-3xl font-black uppercase mb-1">{schoolInfo?.name}</h1>
                                            <p className="text-lg font-bold text-slate-700 mb-4">{schoolInfo?.address}</p>
                                            <div className="inline-block border-2 border-black px-10 py-1.5 rounded-full font-black text-xl uppercase bg-slate-50">
                                                {type.label} - অংশগ্রহণকারী শিক্ষার্থীর তথ্য ({toBengaliNumber(selectedYear)})
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <Table className="border-collapse border-spacing-0 w-full min-w-[1000px] border-black">
                                                <TableHeader className="bg-slate-100">
                                                    <TableRow className="h-14 border-b-[3px] border-black">
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-base w-40">রেজিস্ট্রেশন নং</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-base w-32">রোল নং</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-left pl-6 font-black text-black text-base">নাম</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-base w-32">বিভাগ</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-base">কেন্দ্র নাম</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-base w-32">প্রাপ্ত মোট নম্বর</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-base w-24">প্রাপ্ত গ্রেড</TableHead>
                                                        <TableHead className="border-r-[2px] border-black text-center font-black text-black text-base w-24">প্রাপ্ত জিপিএ</TableHead>
                                                        <TableHead className="text-right pr-6 font-black text-black text-base no-print">কার্যক্রম</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {isLoading ? (
                                                        <TableRow><TableCell colSpan={9} className="text-center py-20 italic font-bold text-muted-foreground"><Loader2 className="animate-spin h-8 w-8 mx-auto mb-2" /> লোড হচ্ছে...</TableCell></TableRow>
                                                    ) : records.length === 0 ? (
                                                        <TableRow><TableCell colSpan={9} className="text-center py-24 text-xl font-black text-slate-300 italic border-b-2 border-black">কোনো রেকর্ড পাওয়া যায়নি।</TableCell></TableRow>
                                                    ) : (
                                                        records.map((record) => (
                                                            <TableRow key={record.id} className="h-12 border-b-2 border-black hover:bg-slate-50 transition-colors">
                                                                <TableCell className="border-r-2 border-black text-center font-black text-base text-slate-800">{toBengaliNumber(record.registrationNo)}</TableCell>
                                                                <TableCell className="border-r-2 border-black text-center font-black text-base text-slate-800">{toBengaliNumber(record.rollNo)}</TableCell>
                                                                <TableCell className="border-r-2 border-black font-black text-base pl-6 text-slate-900">{record.studentName}</TableCell>
                                                                <TableCell className="border-r-2 border-black text-center font-bold text-sm uppercase">
                                                                    {groups.find(g => g.id === record.group)?.label || record.group}
                                                                </TableCell>
                                                                <TableCell className="border-r-2 border-black text-center font-medium text-sm text-slate-600">{record.centerName || '-'}</TableCell>
                                                                <TableCell className="border-r-2 border-black text-center font-black text-lg text-primary">{toBengaliNumber(record.totalMarks)}</TableCell>
                                                                <TableCell className="border-r-2 border-black text-center font-black text-lg text-emerald-700">{record.grade}</TableCell>
                                                                <TableCell className="border-r-2 border-black text-center font-black text-lg text-blue-900">{toBengaliNumber(record.gpa.toFixed(2))}</TableCell>
                                                                <TableCell className="text-right pr-6 no-print">
                                                                    {canManage && (
                                                                        <AlertDialog>
                                                                            <AlertDialogTrigger asChild>
                                                                                <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-500 hover:text-rose-700 hover:bg-rose-50">
                                                                                    <Trash2 className="h-5 w-5" />
                                                                                </Button>
                                                                            </AlertDialogTrigger>
                                                                            <AlertDialogContent className="font-kalpurush">
                                                                                <AlertDialogHeader>
                                                                                    <AlertDialogTitle className="text-rose-700 font-black flex items-center gap-2"><Info /> আপনি কি নিশ্চিত?</AlertDialogTitle>
                                                                                    <AlertDialogDescription className="font-bold text-base">এই রেকর্ডটি স্থায়ীভাবে মুছে ফেলা হবে।</AlertDialogDescription>
                                                                                </AlertDialogHeader>
                                                                                <AlertDialogFooter>
                                                                                    <AlertDialogCancel className="font-bold">বাতিল</AlertDialogCancel>
                                                                                    <AlertDialogAction onClick={() => handleDelete(record.id)} className="bg-destructive text-white font-black">হ্যাঁ, মুছুন</AlertDialogAction>
                                                                                </AlertDialogFooter>
                                                                            </AlertDialogContent>
                                                                        </AlertDialog>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>

                                        {/* Print Footer */}
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
