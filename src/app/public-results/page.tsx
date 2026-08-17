'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { getExams, Exam } from '@/lib/exam-data';
import { Loader2, Search, BookOpen, ArrowLeft, GraduationCap, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const classNamesMap: Record<string, string> = {
  '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

export default function PublicResultPortalPage() {
  const db = useFirestore();
  const { schoolInfo } = useSchoolInfo();
  const { availableYears } = useAcademicYear();
  const { toast } = useToast();
  const router = useRouter();

  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [academicYear, setAcademicYear] = useState<string>(new Date().getFullYear().toString());
  const [className, setClassName] = useState<string>('');
  const [examName, setExamName] = useState<string>('');
  const [roll, setRoll] = useState<string>('');
  const [studentId, setStudentId] = useState<string>('');
  
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (db && academicYear && isMounted) {
      getExams(db, academicYear).then(setExams);
    }
  }, [db, academicYear, isMounted]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !academicYear || !className || !examName || !roll || !studentId) {
      toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ', description: 'সবগুলো ঘর পূরণ করুন।' });
      return;
    }

    setIsLoading(true);
    try {
      const bnToEn = (str: string) => str.replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]);
      const rollNum = parseInt(bnToEn(roll), 10);
      const cleanStudentId = bnToEn(studentId).trim();

      const q = query(
        collection(db, 'students'),
        where('academicYear', '==', academicYear),
        where('className', '==', className),
        where('roll', '==', rollNum),
        where('generatedId', '==', cleanStudentId),
        limit(1)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        toast({ variant: 'destructive', title: 'শিক্ষার্থী পাওয়া যায়নি', description: 'রোল বা আইডি সঠিক নয়।' });
      } else {
        const student = studentFromDoc(snap.docs[0]);
        // Open marksheet in new tab
        const url = `/marksheet/${student.id}?academicYear=${academicYear}&examName=${encodeURIComponent(examName)}`;
        window.open(url, '_blank');
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'সার্ভার ত্রুটি', description: 'অনুগ্রহ করে পুনরায় চেষ্টা করুন।' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-100 to-white font-kalpurush flex flex-col items-center p-4">
      <header className="w-full max-w-4xl flex flex-col items-center gap-4 py-8 text-center relative">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute left-4 top-8 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {schoolInfo.logoUrl && (
          <Image src={schoolInfo.logoUrl} alt="Logo" width={100} height={100} className="rounded-full bg-white p-1 shadow-xl" />
        )}
        <div>
          <h1 className="text-3xl sm:text-4xl font-black text-primary drop-shadow-sm">{schoolInfo.name}</h1>
          <p className="text-muted-foreground font-bold text-lg mt-1 italic">পাবলিক রেজাল্ট পোর্টাল</p>
        </div>
      </header>

      <main className="w-full max-w-lg">
        <Card className="shadow-2xl border-t-4 border-t-primary rounded-2xl">
          <CardHeader className="bg-primary/5 pb-6">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-white p-2 rounded-lg">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">পরীক্ষার ফলাফল অনুসন্ধান</CardTitle>
                <CardDescription className="font-bold">সঠিক তথ্য দিয়ে রেজাল্ট ও মার্কশিট দেখুন</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8">
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-black text-slate-700">শিক্ষাবর্ষ</Label>
                  <Select value={academicYear} onValueChange={setAcademicYear}>
                    <SelectTrigger className="h-12 bg-slate-50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {availableYears.map(y => <SelectItem key={y} value={y}>{Number(y).toLocaleString('bn-BD')}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-slate-700">শ্রেণি</Label>
                  <Select value={className} onValueChange={setClassName}>
                    <SelectTrigger className="h-12 bg-slate-50"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(classNamesMap).map(([id, label]) => <SelectItem key={id} value={id}>{label} শ্রেণি</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-black text-slate-700">পরীক্ষার নাম</Label>
                <Select value={examName} onValueChange={setExamName} disabled={!academicYear}>
                  <SelectTrigger className="h-12 bg-slate-50"><SelectValue placeholder="পরীক্ষা নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>
                    {exams.length > 0 ? exams.map(e => (
                      <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                    )) : (
                      <SelectItem value="none" disabled>কোনো পরীক্ষা পাওয়া যায়নি</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-black text-slate-700">রোল নম্বর</Label>
                  <Input 
                    placeholder="উদা: ১" 
                    value={roll} 
                    onChange={e => setRoll(e.target.value)} 
                    className="h-12 text-lg font-black border-slate-300 focus:ring-primary"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-black text-slate-700">শিক্ষার্থী আইডি (ID)</Label>
                  <Input 
                    placeholder="উদা: ২৬০৬০০০১" 
                    value={studentId} 
                    onChange={e => setStudentId(e.target.value)} 
                    className="h-12 text-lg font-black border-slate-300 focus:ring-primary uppercase"
                    required
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-3">
                <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] font-bold text-amber-800 leading-relaxed">
                  সতর্কতা: রোল এবং আইডি উভয়ই সঠিক হতে হবে। যদি আপনার কাছে আইডি না থাকে, তবে বিদ্যালয়ের অফিস বা শ্রেণি শিক্ষকের সাথে যোগাযোগ করুন।
                </p>
              </div>

              <Button type="submit" className="w-full h-14 text-xl font-black shadow-xl" disabled={isLoading}>
                {isLoading ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <Search className="mr-2 h-6 w-6" />}
                ফলাফল দেখুন
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-8 flex justify-center">
          <Link href="/login">
            <Button variant="ghost" className="font-black text-primary hover:bg-primary/5">
              <ArrowLeft className="mr-2 h-4 w-4" /> প্রশাসনিক লগইন (Teachers Only)
            </Button>
          </Link>
        </div>
      </main>

      <footer className="mt-auto py-8 text-center text-muted-foreground text-sm font-bold">
        <p>© ২০২৬ {schoolInfo.name}। সর্বস্বত্ব সংরক্ষিত।</p>
      </footer>
    </div>
  );
}