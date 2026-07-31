'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { Printer, ArrowLeft, FileText, Info } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

const classNamesMap: { [key: string]: string } = {
  '6': 'ষষ্ঠ', '7': 'সপ্তম', '8': 'অষ্টম', '9': 'নবম', '10': 'দশম',
};

const toBengaliNumber = (str: string | number) => {
  if (!str && str !== 0) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

export default function TCGeneratorPage() {
  const db = useFirestore();
  const { selectedYear } = useAcademicYear();
  const { schoolInfo } = useSchoolInfo();

  const [isClient, setIsClient] = useState(false);
  const [className, setClassName] = useState<string>('10');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  const [formData, setFormData] = useState({
    smarakNo: `বিপৌউবি/ছাড়পত্র/${new Date().getFullYear()}/`,
    reason: 'অভিভাবকের স্থানান্তর / পারিবারিক কারণ',
    conduct: 'অত্যন্ত প্রশংসনীয় ও সন্তোষজনক',
    status: 'উত্তীর্ণ হয়ে পরবর্তী শ্রেণিতে ভর্তির যোগ্য',
    dues: 'বিদ্যালয়ের সকল দেনা-পাওনা পরিশোধিত',
    issueDate: format(new Date(), "d MMMM, yyyy", { locale: bn })
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!db || !className || !isClient) return;

    const fetchStudents = async () => {
      setIsLoadingStudents(true);
      try {
        const q = query(
          collection(db, 'students'),
          where('className', '==', className),
          where('academicYear', '==', selectedYear)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(studentFromDoc);
        list.sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
        setStudents(list);
        if (list.length > 0) setSelectedStudent(list[0]);
        else setSelectedStudent(null);
      } catch (e) { console.error(e); }
      setIsLoadingStudents(false);
    };
    fetchStudents();
  }, [db, className, selectedYear, isClient]);

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!isClient) {
    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-100">
            <Header />
            <main className="p-8">
                <Skeleton className="h-64 w-full rounded-xl" />
            </main>
        </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 font-kalpurush">
      <Header />
      <main className="flex-1 p-4 md:p-8 no-print">
        <div className="max-w-[1400px] mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/documents">
                    <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-black text-primary">ছাড়পত্র (TC) জেনারেটর</h1>
                    <p className="text-sm text-muted-foreground">লাইভ প্রিভিউ দেখে ডকুমেন্ট তৈরি করুন</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <Card className="shadow-lg border-2">
                    <CardHeader className="bg-amber-50 border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="h-5 w-5 text-amber-700" /> ছাড়পত্রের বিবরণ
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="font-bold">শ্রেণি</Label>
                                <Select value={className} onValueChange={setClassName}>
                                    <SelectTrigger className="bg-white"><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold">শিক্ষার্থী</Label>
                                <Select value={selectedStudent?.id || ''} onValueChange={(v) => setSelectedStudent(students.find(s => s.id === v) || null)}>
                                    <SelectTrigger className="bg-white"><SelectValue placeholder="সিলেক্ট করুন" /></SelectTrigger>
                                    <SelectContent>
                                        {students.map(s => <SelectItem key={s.id} value={s.id}>রোল {s.roll} - {s.studentNameBn}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-4 border-t pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label className="font-bold">স্মারক নং</Label><Input value={formData.smarakNo} onChange={e => handleFieldChange('smarakNo', e.target.value)} /></div>
                                <div className="space-y-2"><Label className="font-bold">ইস্যুর তারিখ</Label><Input value={formData.issueDate} onChange={e => handleFieldChange('issueDate', e.target.value)} /></div>
                            </div>
                            <div className="space-y-2"><Label className="font-bold">ত্যাগের কারণ</Label><Input value={formData.reason} onChange={e => handleFieldChange('reason', e.target.value)} /></div>
                            <div className="space-y-2"><Label className="font-bold">আচরণ</Label><Input value={formData.conduct} onChange={e => handleFieldChange('conduct', e.target.value)} /></div>
                            <div className="space-y-2"><Label className="font-bold">অ্যাকাডেমিক অবস্থা</Label><Input value={formData.status} onChange={e => handleFieldChange('status', e.target.value)} /></div>
                            <div className="space-y-2"><Label className="font-bold">দেনা-পাওনা</Label><Input value={formData.dues} onChange={e => handleFieldChange('dues', e.target.value)} /></div>
                        </div>

                        <Button onClick={() => window.print()} size="lg" className="w-full font-black shadow-lg bg-amber-700 hover:bg-amber-800" disabled={!selectedStudent}>
                            <Printer className="mr-2 h-5 w-5" /> ছাড়পত্র প্রিন্ট করুন
                        </Button>
                    </CardContent>
                </Card>

                <div className="sticky top-24">
                    <h3 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-2">
                        <Info className="h-4 w-4" /> লাইভ প্রিভিউ (A4)
                    </h3>
                    <div className="bg-white border-4 border-black/10 rounded-xl overflow-hidden shadow-2xl origin-top scale-[0.65] sm:scale-[0.75] lg:scale-[0.8] xl:scale-100">
                        {selectedStudent ? (
                            <TCTemplate student={selectedStudent} schoolInfo={schoolInfo} formData={formData} />
                        ) : (
                            <div className="w-[210mm] h-[297mm] bg-white flex flex-col items-center justify-center text-muted-foreground italic"><Info className="h-12 w-12 mb-4 opacity-10" /><p>শিক্ষার্থী নির্বাচন করুন</p></div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </main>

      <div className="hidden print:block printable-area">
        {selectedStudent && <TCTemplate student={selectedStudent} schoolInfo={schoolInfo} formData={formData} />}
      </div>
    </div>
  );
}

function TCTemplate({ student, schoolInfo, formData }: any) {
    const studentDob = student?.dob ? toBengaliNumber(format(new Date(student.dob), "d MMMM, yyyy", { locale: bn })) : 'প্রযোজ্য নয়';

    return (
        <div className="w-[210mm] h-[297mm] bg-white mx-auto relative text-black flex flex-col p-10 box-border border-8 border-double border-emerald-800 font-kalpurush">
            <div className="text-center border-b-2 border-emerald-800 pb-3 mb-6 flex justify-between items-center px-4">
                <div className="w-20 h-20 relative">{schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" fill className="object-contain" />}</div>
                <div className="flex-grow">
                    <h1 className="text-3xl font-black text-emerald-900 mb-0.5">{schoolInfo.name}</h1>
                    <p className="text-sm font-bold text-gray-700">{schoolInfo.address} | EIIN: {toBengaliNumber(schoolInfo.eiin)}</p>
                </div>
                <div className="w-20 h-20 border border-gray-300 p-0.5">{student.photoUrl && <Image src={student.photoUrl} alt="Student" width={80} height={80} className="object-cover w-full h-full" />}</div>
            </div>

            <div className="text-center mb-8"><span className="inline-block bg-emerald-800 text-white text-xl font-bold px-10 py-1.5 rounded-full border-2 border-emerald-900 shadow-sm">ছাড়পত্র (TC)</span></div>

            <div className="flex justify-between font-bold text-sm mb-10 px-4"><span>স্মারক নং: {formData.smarakNo}</span><span>তারিখ: {toBengaliNumber(formData.issueDate)} ইং</span></div>

            <div className="flex-grow space-y-6 text-xl font-semibold leading-relaxed px-4 text-justify">
                <p className="indent-16">
                    এতদ্বারা প্রত্যয়ন করা যাচ্ছে যে, <span className="font-black border-b-2 border-black border-dotted px-2">{student.studentNameBn}</span>, 
                    পিতা: <span className="border-b-2 border-black border-dotted px-2">{student.fatherNameBn}</span>, 
                    মাতা: <span className="border-b-2 border-black border-dotted px-2">{student.motherNameBn}</span>, 
                    গ্রাম: <span className="border-b-2 border-black border-dotted px-2">{student.permanentVillage || student.presentVillage || 'বিবিধ'}</span>।
                </p>
                <p>
                    সে অত্র বিদ্যালয়ে <span className="font-black px-2">{toBengaliNumber(student.academicYear)}</span> শিক্ষাবর্ষে <span className="font-black px-2">{classNamesMap[student.className] || student.className}</span> শ্রেণিতে (রোল নম্বর: <span className="font-black px-2">{toBengaliNumber(student.roll)}</span>) নিয়মিত শিক্ষার্থী হিসেবে অধ্যয়ন সম্পন্ন করেছে। বিদ্যালয়ের রেকর্ড অনুযায়ী তার জন্ম তারিখ: <span className="font-black px-2">{studentDob}</span>।
                </p>
                <p>
                    আমার জানামতে সে কোনো প্রকার রাষ্ট্রবিরোধী বা প্রতিষ্ঠানিক শৃঙ্খলা-পরিপন্থী কাজের সাথে জড়িত ছিল না। তার চরিত্র <span className="font-black border-b-2 border-black border-dotted px-2">{formData.conduct}</span>। পড়াশোনার অগ্রগতি ও ফলাফল <span className="font-black border-b-2 border-black border-dotted px-2">{formData.status}</span>।
                </p>
                <p>বিদ্যালয় ত্যাগের কারণ: <span className="font-black border-b-2 border-black border-dotted px-2">{formData.reason}</span>। বিদ্যালয়ের পাওনা সংক্রান্ত অবস্থা: <span className="font-black border-b-2 border-black border-dotted px-2">{formData.dues}</span>।</p>
            </div>

            <footer className="absolute bottom-16 left-0 right-0 z-10 px-10">
                <div className="text-center mb-16">
                    <p className="italic text-emerald-950 text-2xl font-black">
                        আমি তার উজ্জ্বল ভবিষ্যৎ ও জীবনের সর্বাঙ্গীণ সাফল্য কামনা করি।
                    </p>
                </div>
                <div className="flex justify-around items-end">
                    <div className="text-center">
                        <div className="w-48 border-t border-black pt-1 font-bold text-sm">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                    </div>
                    <div className="text-center">
                        <div className="w-48 border-t border-black pt-1 font-bold">
                            <p className="text-sm">প্রধান শিক্ষকের স্বাক্ষর ও সিল</p>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
