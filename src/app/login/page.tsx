'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { signIn, signUp } from '@/lib/auth';
import type { UserRole } from '@/lib/user';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Loader2, Search, BookOpen, Printer, Star, User, Info, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Student, studentFromDoc, getStudentPlaceholderImage, sanitizePhotoUrl } from '@/lib/student-data';
import { getExams, Exam } from '@/lib/exam-data';
import { getAllResults } from '@/lib/results-data';
import { getSubjects } from '@/lib/subjects';
import { processStudentResults, StudentProcessedResult } from '@/lib/results-calculation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';

const toBengaliNumber = (str: string | number | undefined | null) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

const classNamesMap: Record<string, string> = {
    '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': 'দশম'
};

function AuthFormFields({ email, password, setEmail, setPassword }: {
    email: string;
    password: string;
    setEmail: (value: string) => void;
    setPassword: (value: string) => void;
}) {
    return (
        <>
            <div className="space-y-1.5">
                <Label htmlFor="email" className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">ইমেইল</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-9" />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="password" className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">পাসওয়ার্ড</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-9" />
            </div>
        </>
    );
}

export default function LoginPage() {
    const { toast } = useToast();
    const router = useRouter();
    const { user, loading } = useAuth();
    const { schoolInfo, isLoading: isSchoolInfoLoading } = useSchoolInfo();
    const { availableYears, selectedYear: globalYear } = useAcademicYear();
    const db = useFirestore();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Search Logic States
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchYear, setSearchYear] = useState<string>(globalYear);
    const [searchClass, setSearchClass] = useState<string>('');
    const [searchExam, setSearchExam] = useState<string>('');
    const [searchRoll, setSearchRoll] = useState<string>('');
    const [searchStudentId, setSearchStudentId] = useState<string>('');
    const [searchExams, setSearchExams] = useState<Exam[]>([]);
    const [searchResult, setSearchResult] = useState<StudentProcessedResult | null>(null);

    useEffect(() => {
        if (!loading && user) {
            router.push('/');
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (db && searchYear) {
            getExams(db, searchYear).then(setSearchExams);
        }
    }, [db, searchYear]);

    const handleAuthAction = async (action: 'signIn' | 'signUp', role: UserRole) => {
        setIsLoading(true);
        try {
            if (action === 'signIn') {
                const result = await signIn(email, password, role);
                if (result.success) {
                    toast({ title: 'লগইন সফল হয়েছে' });
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'লগইন ব্যর্থ হয়েছে',
                        description: result.error || 'ইমেইল বা পাসওয়ার্ড ভুল।',
                    });
                }
            } else {
                const result = await signUp(email, password);
                 if (result.success) {
                    toast({ title: 'সাইন আপ সফল হয়েছে', description: `আপনাকে একজন ${result.role} হিসেবে নিবন্ধন করা হয়েছে।` });
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'সাইন আপ ব্যর্থ হয়েছে',
                        description: result.error || 'অনুগ্রহ করে পুনরায় চেষ্টা করুন।',
                    });
                }
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'একটি অপ্রত্যাশিত ত্রুটি ঘটেছে',
                description: error.message || 'সার্ভারে সংযোগ করা যাচ্ছে না।',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleResultSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Helper to convert Bengali numbers to English
        const bnToEn = (str: string) => str.toString().replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)].toString());

        if (!db || !searchYear || !searchClass || !searchExam || !searchRoll || !searchStudentId) {
            toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ', description: 'সবগুলো ঘর পূরণ করুন।' });
            return;
        }

        setIsSearching(true);
        try {
            const cleanRoll = parseInt(bnToEn(searchRoll).trim(), 10);
            const cleanStudentId = bnToEn(searchStudentId).trim().toUpperCase();

            // SENSITIVE FIX: Search by class and roll instead of generatedId
            // Some records might not have generatedId persisted as a field yet
            const studentQuery = query(
                collection(db, 'students'),
                where('academicYear', '==', searchYear),
                where('className', '==', searchClass),
                where('roll', '==', cleanRoll),
                limit(1)
            );
            
            const studentSnap = await getDocs(studentQuery);

            if (studentSnap.empty) {
                toast({ variant: 'destructive', title: 'শিক্ষার্থী পাওয়া যায়নি', description: 'প্রদানকৃত রোল বা শ্রেণি অনুযায়ী শিক্ষার্থী খুঁজে পাওয়া যায়নি।' });
                setIsSearching(false);
                return;
            }

            const foundStudent = studentFromDoc(studentSnap.docs[0]);
            
            // Verification step: Check if the provided ID matches the found student
            if (foundStudent.generatedId?.toUpperCase() !== cleanStudentId) {
                 toast({ variant: 'destructive', title: 'আইডি মেলেনি', description: 'প্রদানকৃত শিক্ষার্থী আইডি সঠিক নয়।' });
                 setIsSearching(false);
                 return;
            }
            
            // Fetch results for the entire class for rank calculation
            const allResults = await getAllResults(db, searchYear, searchExam);
            const classRes = allResults.filter(r => r.className === searchClass);
            
            if (classRes.length === 0) {
                toast({ variant: 'destructive', title: 'ফলাফল প্রকাশিত হয়নি', description: 'এই পরীক্ষার কোনো নম্বর এখনো এন্ট্রি করা হয়নি।' });
                setIsSearching(false);
                return;
            }

            const classStudentsQuery = query(
                collection(db, 'students'),
                where('academicYear', '==', searchYear),
                where('className', '==', searchClass)
            );
            const classStudentsSnap = await getDocs(classStudentsQuery);
            const classStudents = classStudentsSnap.docs.map(studentFromDoc);

            const subs = getSubjects(searchClass, foundStudent.group).filter(s => s.isExamSubject !== false);
            const processedResultsList = processStudentResults(classStudents, classRes, subs);
            const studentProcessed = processedResultsList.find(r => r.student.id === foundStudent.id);

            if (studentProcessed) {
                setSearchResult(studentProcessed);
            } else {
                toast({ variant: 'destructive', title: 'ফলাফল পাওয়া যায়নি', description: 'আপনার জন্য এই পরীক্ষার কোনো নম্বর পাওয়া যায়নি।' });
            }
        } catch (error: any) {
            console.error("Result Search Error:", error);
            toast({ variant: 'destructive', title: 'সার্ভার ত্রুটি', description: 'ফলাফল খুঁজতে সমস্যা হচ্ছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।' });
        } finally {
            setIsSearching(false);
        }
    };

    if(loading || user) {
        return <div className="flex min-h-screen items-center justify-center">লোড হচ্ছে...</div>
    }

    const SubmitButton = ({ action }: { action: 'signIn' | 'signUp' }) => (
        <Button 
            type="submit" 
            className="w-full h-11 mt-4 font-black text-base shadow-lg bg-primary hover:bg-primary/90" 
            disabled={isLoading}
        >
            {isLoading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
            {isLoading ? 'প্রসেস হচ্ছে...' : (action === 'signIn' ? 'প্রবেশ করুন' : 'নিবন্ধন সম্পন্ন করুন')}
        </Button>
    );

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-indigo-50 p-2 sm:p-4 font-kalpurush text-black overflow-hidden relative">
            <div className="absolute top-4 left-4 z-50">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full bg-white/20 text-primary hover:bg-white/40 shadow-sm border border-primary/10"
                    onClick={() => router.back()}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
            </div>

            <div className="mb-2 flex flex-col items-center gap-0 text-center scale-90 sm:scale-100">
                {isSchoolInfoLoading ? (
                    <>
                        <Skeleton className="h-16 w-16 rounded-full" />
                        <Skeleton className="h-6 w-56 mt-2" />
                    </>
                ) : (
                    <>
                        {schoolInfo.logoUrl && (
                            <div className="relative z-10 -mb-2">
                                <Image
                                    src={schoolInfo.logoUrl}
                                    alt="School Logo"
                                    width={90}
                                    height={90}
                                    className="rounded-full object-contain bg-white p-1 shadow-lg border-2 border-primary/20"
                                />
                            </div>
                        )}
                        
                        <div className="bg-[#2418ff] border-[5px] border-red-600 rounded-[2rem] px-8 py-4 flex flex-col items-center gap-0 shadow-[0_12px_25px_-5px_rgba(36,24,255,0.4)] animate-in zoom-in duration-500 transform hover:scale-[1.01] transition-transform relative z-0">
                            <h1 className="text-xl sm:text-[40px] font-black text-white leading-tight tracking-tighter mb-0.5 [text-shadow:2px_2px_4px_rgba(0,0,0,0.5)]">
                                {schoolInfo.name}
                            </h1>
                            <p className="text-white font-bold italic text-xs sm:text-lg leading-none opacity-95">
                                ডিজিটাল ম্যানেজমেন্ট পোর্টাল
                            </p>
                        </div>
                    </>
                )}
            </div>
            
            <div className="w-full max-w-md space-y-4 scale-95 sm:scale-100">
                <Card className="shadow-2xl border-2 border-primary/30 overflow-hidden bg-white/95 backdrop-blur-sm">
                    <CardHeader className="bg-primary/5 border-b-2 border-primary/10 text-center py-3">
                        <div className="flex flex-row gap-1.5 justify-center mb-2">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-4 text-[9px] sm:text-xs font-black border-primary/20 hover:bg-primary/5 bg-white shadow-sm"
                                onClick={() => setIsSearchOpen(true)}
                            >
                                ফলাফল দেখুন
                            </Button>
                            <Button variant="default" size="sm" className="h-8 px-4 text-[9px] sm:text-xs font-black shadow-sm cursor-default bg-primary">প্রবেশ করুন</Button>
                            <Link href="/admission">
                                <Button variant="outline" size="sm" className="h-8 px-2.5 text-[9px] sm:text-xs font-bold border-primary/20 hover:bg-primary/5 bg-white">অনলাইন ভর্তি</Button>
                            </Link>
                        </div>
                        <CardDescription className="font-bold text-[10px] text-muted-foreground uppercase tracking-tight">সিস্টেম ব্যবহারের জন্য আপনার ইমেইল ও পাসওয়ার্ড দিন</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4 pb-5">
                        <Tabs defaultValue="teacher-login">
                            <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 mb-4 h-9">
                                <TabsTrigger value="teacher-login" className="font-black text-[10px] sm:text-xs h-7 data-[state=active]:bg-white data-[state=active]:shadow-sm">শিক্ষক</TabsTrigger>
                                <TabsTrigger value="admin-login" className="font-black text-[10px] sm:text-xs h-7 data-[state=active]:bg-white data-[state=active]:shadow-sm">এডমিন</TabsTrigger>
                                <TabsTrigger value="signup" className="font-black text-[10px] sm:text-xs h-7 data-[state=active]:bg-white data-[state=active]:shadow-sm">নিবন্ধন</TabsTrigger>
                            </TabsList>

                            <TabsContent value="teacher-login" className="mt-0 outline-none">
                                <form onSubmit={(e) => { e.preventDefault(); handleAuthAction('signIn', 'teacher'); }} className="space-y-3">
                                    <AuthFormFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                                    <SubmitButton action="signIn" />
                                </form>
                            </TabsContent>
                            
                            <TabsContent value="admin-login" className="mt-0 outline-none">
                                <form onSubmit={(e) => { e.preventDefault(); handleAuthAction('signIn', 'admin'); }} className="space-y-3">
                                    <AuthFormFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                                    <SubmitButton action="signIn" />
                                </form>
                            </TabsContent>
                            
                            <TabsContent value="signup" className="mt-0 outline-none">
                                <form onSubmit={(e) => { e.preventDefault(); handleAuthAction('signUp', 'teacher'); }} className="space-y-3">
                                    <AuthFormFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                                    <SubmitButton action="signUp" />
                                </form>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                <div className="text-center">
                    <p className="text-[10px] font-bold text-muted-foreground opacity-60">© ২০২৬ {schoolInfo.name}। সর্বস্বত্ব সংরক্ষিত।</p>
                </div>
            </div>

            {/* Public Result Search Dialog */}
            <Dialog open={isSearchOpen} onOpenChange={(o) => { setIsSearchOpen(o); if(!o) { setSearchResult(null); setSearchRoll(''); setSearchStudentId(''); }}}>
                <DialogContent className="sm:max-w-xl p-0 font-kalpurush overflow-hidden border-none shadow-2xl rounded-2xl">
                    {!searchResult ? (
                        <>
                            <DialogHeader className="p-6 bg-primary text-white">
                                <DialogTitle className="text-2xl font-black flex items-center gap-2"><BookOpen className="h-6 w-6" /> পরীক্ষার ফলাফল অনুসন্ধান</DialogTitle>
                                <DialogDescription className="text-white/80 font-bold">সঠিক তথ্য দিয়ে রেজাল্ট সামারি দেখুন</DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleResultSearch} className="p-6 space-y-5 bg-white">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs">শিক্ষাবর্ষ</Label>
                                        <Select value={searchYear} onValueChange={setSearchYear}>
                                            <SelectTrigger className="bg-slate-50"><SelectValue /></SelectTrigger>
                                            <SelectContent>{availableYears.map(y => <SelectItem key={y} value={y}>{toBengaliNumber(y)}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs">শ্রেণি</Label>
                                        <Select value={searchClass} onValueChange={setSearchClass}>
                                            <SelectTrigger className="bg-slate-50"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                                            <SelectContent>{Object.entries(classNamesMap).map(([id, label]) => <SelectItem key={id} value={id}>{label} শ্রেণি</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold text-xs">পরীক্ষার নাম</Label>
                                    <Select value={searchExam} onValueChange={setSearchExam}>
                                        <SelectTrigger className="bg-slate-50"><SelectValue placeholder="পরীক্ষা নির্বাচন করুন" /></SelectTrigger>
                                        <SelectContent>
                                            {searchExams.length > 0 ? searchExams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>) : <SelectItem value="none" disabled>কোনো পরীক্ষা নেই</SelectItem>}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs">রোল নম্বর</Label>
                                        <Input value={searchRoll} onChange={e => setSearchRoll(e.target.value)} placeholder="উদা: ১" className="font-black text-lg h-11" required />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs">শিক্ষার্থী আইডি (ID)</Label>
                                        <Input value={searchStudentId} onChange={e => setSearchStudentId(e.target.value)} placeholder="ID লিখুন" className="font-black text-lg h-11 uppercase" required />
                                    </div>
                                </div>
                                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2">
                                    <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                                    <p className="text-[10px] font-bold text-amber-800 leading-tight">সতর্কতা: রোল এবং আইডি সঠিক হতে হবে। মার্কশিট প্রিন্ট করতে অফিস বা শ্রেণি শিক্ষকের সাথে যোগাযোগ করুন।</p>
                                </div>
                                <Button type="submit" className="w-full h-12 text-lg font-black shadow-lg" disabled={isSearching}>
                                    {isSearching ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Search className="mr-2 h-5 w-5" />}
                                    ফলাফল দেখুন
                                </Button>
                            </form>
                        </>
                    ) : (
                        <div className="flex flex-col bg-white animate-in zoom-in duration-300">
                            <DialogHeader className="p-6 bg-primary text-white flex flex-row items-center gap-5">
                                <Avatar className="h-20 w-20 border-4 border-white/30 shadow-xl overflow-hidden shrink-0">
                                    <AvatarImage src={sanitizePhotoUrl(searchResult.student.photoUrl, searchResult.student.gender) || getStudentPlaceholderImage(searchResult.student.gender)} className="object-cover h-full w-full" />
                                    <AvatarFallback className="text-2xl font-black bg-white/20">S</AvatarFallback>
                                </Avatar>
                                <div className="overflow-hidden">
                                    <DialogTitle className="text-2xl font-black truncate">{searchResult.student.studentNameBn}</DialogTitle>
                                    <DialogDescription className="text-white/80 font-bold text-sm">
                                        রোল: {toBengaliNumber(searchResult.student.roll)} | {classNamesMap[searchResult.student.className]} শ্রেণি | {searchExam}
                                    </DialogDescription>
                                </div>
                            </DialogHeader>

                            <div className="p-6 space-y-6 bg-slate-50 overflow-y-auto max-h-[60vh] scrollbar-thin">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    <Card className="p-3 text-center border-2 border-black/5 bg-white shadow-sm">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">মোট নম্বর</p>
                                        <p className="text-lg font-black text-primary">{toBengaliNumber(searchResult.totalMarks)}</p>
                                    </Card>
                                    <Card className="p-3 text-center border-2 border-black/5 bg-white shadow-sm">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">জি.পি.এ</p>
                                        <p className="text-lg font-black text-primary">{toBengaliNumber(searchResult.gpa.toFixed(2))}</p>
                                    </Card>
                                    <Card className="p-3 text-center border-2 border-black/5 bg-white shadow-sm">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">গ্রেড</p>
                                        <p className={cn("text-lg font-black", searchResult.isPass ? "text-emerald-600" : "text-rose-600")}>
                                            {searchResult.isPass ? searchResult.finalGrade : `F${searchResult.failedSubjectsCount}`}
                                        </p>
                                    </Card>
                                    <Card className="p-3 text-center border-2 border-black/5 bg-white shadow-sm">
                                        <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">মেধাক্রম</p>
                                        <p className="text-lg font-black text-amber-600">{searchResult.isPass ? toBengaliNumber(searchResult.meritPosition || '-') : 'ফেল'}</p>
                                    </Card>
                                </div>

                                <div className="border-2 border-black/10 rounded-xl overflow-hidden bg-white shadow-inner">
                                    <Table>
                                        <TableHeader className="bg-muted/50">
                                            <TableRow>
                                                <TableHead className="font-black text-[11px] text-black">বিষয়</TableHead>
                                                <TableHead className="text-center font-black text-[11px] text-black">প্রাপ্ত নম্বর</TableHead>
                                                <TableHead className="text-center font-black text-[11px] text-black">গ্রেড</TableHead>
                                                <TableHead className="text-right pr-4 font-black text-[11px] text-black">পয়েন্ট</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {Array.from(searchResult.subjectResults.entries()).map(([name, res]) => (
                                                <TableRow key={name} className="h-9">
                                                    <TableCell className="font-bold text-xs text-slate-700">{name}</TableCell>
                                                    <TableCell className="text-center font-black text-blue-900 text-sm">{toBengaliNumber(res.marks)}</TableCell>
                                                    <TableCell className={cn("text-center font-black text-xs", res.isPass ? "text-slate-700" : "text-rose-600")}>{res.grade}</TableCell>
                                                    <TableCell className="text-right pr-4 font-bold text-xs">{toBengaliNumber(res.point.toFixed(2))}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>

                            <DialogFooter className="p-4 bg-white border-t flex flex-col sm:flex-row gap-3">
                                <Button variant="outline" className="font-black flex-1 h-11" onClick={() => setSearchResult(null)}>অন্য ফলাফল খুঁজুন</Button>
                                <Button 
                                    className="font-black flex-1 h-11 shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => window.print()}
                                >
                                    <Printer className="mr-2 h-4 w-4" /> ফলাফল প্রিন্ট করুন
                                </Button>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Hidden Printable Result Summary (Popup Format) */}
            {searchResult && (
                <div className="hidden print:block printable-area bg-white text-black p-8 font-kalpurush border-[8px] border-double border-primary/40 rounded-sm w-[148mm] h-[210mm] mx-auto overflow-hidden">
                    <header className="text-center border-b-2 border-primary pb-3 mb-6 flex flex-col items-center">
                        {schoolInfo.logoUrl && <img src={schoolInfo.logoUrl} alt="Logo" className="w-16 h-16 object-contain mb-2" />}
                        <h1 className="text-2xl font-black text-primary leading-tight uppercase">{schoolInfo.name}</h1>
                        <p className="text-xs font-bold text-slate-700">{schoolInfo.address}</p>
                        <div className="mt-3 inline-block bg-primary text-white px-6 py-1 rounded-full font-black text-sm shadow-sm">ফলাফল বিবরণী (সামারি)</div>
                    </header>

                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 mb-6 text-sm font-bold bg-slate-50 p-4 border rounded-xl">
                        <div className="flex gap-2 border-b border-dashed pb-1"><span className="text-slate-500 w-24">শিক্ষার্থীর নাম:</span> <span className="font-black">{searchResult.student.studentNameBn}</span></div>
                        <div className="flex gap-2 border-b border-dashed pb-1"><span className="text-slate-500 w-24">আইডি:</span> <span className="font-black">{toBengaliNumber(searchResult.student.generatedId || '-')}</span></div>
                        <div className="flex gap-2 border-b border-dashed pb-1"><span className="text-slate-500 w-24">শ্রেণি ও রোল:</span> <span className="font-black">{classNamesMap[searchResult.student.className]} শ্রেণি, রোল- {toBengaliNumber(searchResult.student.roll)}</span></div>
                        <div className="flex gap-2 border-b border-dashed pb-1"><span className="text-slate-500 w-24">পরীক্ষা:</span> <span className="font-black">{searchExam}</span></div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mb-6">
                        <div className="p-2 border-2 border-black rounded-lg text-center"><p className="text-[10px] font-black uppercase text-muted-foreground">মোট নম্বর</p><p className="text-xl font-black text-primary">{toBengaliNumber(searchResult.totalMarks)}</p></div>
                        <div className="p-2 border-2 border-black rounded-lg text-center"><p className="text-[10px] font-black uppercase text-muted-foreground">GPA</p><p className="text-xl font-black text-primary">{toBengaliNumber(searchResult.gpa.toFixed(2))}</p></div>
                        <div className="p-2 border-2 border-black rounded-lg text-center"><p className="text-[10px] font-black uppercase text-muted-foreground">গ্রেড</p><p className="text-xl font-black">{searchResult.isPass ? searchResult.finalGrade : 'F'}</p></div>
                        <div className="p-2 border-2 border-black rounded-lg text-center"><p className="text-[10px] font-black uppercase text-muted-foreground">মেধাক্রম</p><p className="text-xl font-black text-amber-600">{searchResult.isPass ? toBengaliNumber(searchResult.meritPosition || '-') : '-'}</p></div>
                    </div>

                    <div className="border-2 border-black rounded-xl overflow-hidden mb-8">
                        <table className="w-full text-xs text-center border-collapse">
                            <thead className="bg-slate-100 border-b-2 border-black">
                                <tr className="h-8">
                                    <th className="border-r border-black font-black p-1">বিষয়</th>
                                    <th className="border-r border-black font-black p-1">প্রাপ্ত নম্বর</th>
                                    <th className="border-r border-black font-black p-1">গ্রেড</th>
                                    <th className="font-black p-1">পয়েন্ট</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from(searchResult.subjectResults.entries()).map(([name, res]) => (
                                    <tr key={name} className="h-7 border-b border-slate-300 last:border-0">
                                        <td className="border-r border-slate-300 text-left pl-3 font-bold">{name}</td>
                                        <td className="border-r border-slate-300 font-black">{toBengaliNumber(res.marks)}</td>
                                        <td className="border-r border-slate-300 font-black">{res.grade}</td>
                                        <td className="font-bold">{toBengaliNumber(res.point.toFixed(2))}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-auto flex justify-between px-8 pt-10">
                        <div className="text-center w-36 border-t border-black pt-1 font-black text-[10px]">অফিসের স্বাক্ষর</div>
                        <div className="text-center w-36 border-t border-black pt-1 font-black text-[10px]">প্রধান শিক্ষকের স্বাক্ষর</div>
                    </div>
                    <div className="mt-8 text-center text-[8px] text-slate-300 italic">
                        Digital Management Portal | {format(new Date(), 'PPpp', { locale: bn })}
                    </div>
                </div>
            )}
        </div>
    );
}

function Avatar({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}>{children}</div>;
}
function AvatarImage({ src, className }: { src?: string, className?: string }) {
    return src ? <img src={src} className={cn("aspect-square h-full w-full", className)} alt="avatar" /> : null;
}
function AvatarFallback({ children, className }: { children: React.ReactNode, className?: string }) {
    return <div className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted", className)}>{children}</div>;
}