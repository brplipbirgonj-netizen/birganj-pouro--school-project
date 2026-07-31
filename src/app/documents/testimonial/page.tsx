'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { Printer, Loader2, ArrowLeft, GraduationCap, Info } from 'lucide-react';
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

export default function TestimonialGeneratorPage() {
  const db = useFirestore();
  const { selectedYear } = useAcademicYear();
  const { schoolInfo } = useSchoolInfo();

  const [isClient, setIsClient] = useState(false);
  const [className, setClassName] = useState<string>('6');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  // Editable Fields
  const [formData, setFormData] = useState({
    smarak: `বিপৌউবি/প্রত্যয়ন/${new Date().getFullYear()}/`,
    conduct: 'উত্তম ও সন্তোষজনক',
    extraActivity: 'অত্র বিদ্যালয়ে অধ্যয়নকালে সে কোনো রাষ্ট্রবিরোধী বা শৃঙ্খলা পরিপন্থী কাজের সাথে যুক্ত ছিল না।',
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
        if (list.length > 0) {
          setSelectedStudent(list[0]);
        } else {
          setSelectedStudent(null);
        }
      } catch (e) {
        console.error('Error fetching students:', e);
      } finally {
        setIsLoadingStudents(false);
      }
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

  const studentDob = selectedStudent?.dob ? toBengaliNumber(format(new Date(selectedStudent.dob), "d MMMM, yyyy", { locale: bn })) : 'প্রযোজ্য নয়';

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
                    <h1 className="text-2xl font-black text-primary">প্রশংসাপত্র (Testimonial) জেনারেটর</h1>
                    <p className="text-sm text-muted-foreground">লাইভ প্রিভিউ দেখে ডকুমেন্ট তৈরি করুন</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Form Section - Left */}
                <Card className="shadow-lg border-2">
                    <CardHeader className="bg-primary/5 border-b">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <GraduationCap className="h-5 w-5 text-primary" /> শিক্ষার্থীর তথ্য ও বিবরণ
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="font-bold">১. শ্রেণি নির্বাচন করুন</Label>
                                <Select value={className} onValueChange={setClassName}>
                                    <SelectTrigger className="bg-white"><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold">২. শিক্ষার্থী নির্বাচন করুন</Label>
                                <Select 
                                    value={selectedStudent?.id || ''} 
                                    onValueChange={(val) => setSelectedStudent(students.find(s => s.id === val) || null)}
                                    disabled={students.length === 0}
                                >
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder={isLoadingStudents ? "লোড হচ্ছে..." : (students.length === 0 ? "শিক্ষার্থী নেই" : "শিক্ষার্থী সিলেক্ট করুন")} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {students.map(s => <SelectItem key={s.id} value={s.id}>রোল {s.roll} - {s.studentNameBn}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-4 border-t pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-bold">স্মারক নম্বর</Label>
                                    <Input value={formData.smarak} onChange={(e) => handleFieldChange('smarak', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">ইস্যুর তারিখ</Label>
                                    <Input value={formData.issueDate} onChange={(e) => handleFieldChange('issueDate', e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold">আচরণ ও চরিত্র</Label>
                                <Input value={formData.conduct} onChange={(e) => handleFieldChange('conduct', e.target.value)} placeholder="উদা: উত্তম ও সন্তোষজনক" />
                            </div>
                            <div className="space-y-2">
                                <Label className="font-bold">অতিরিক্ত তথ্য (ঐচ্ছিক)</Label>
                                <textarea 
                                    className="w-full min-h-[100px] p-3 text-sm border rounded-md focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={formData.extraActivity}
                                    onChange={(e) => handleFieldChange('extraActivity', e.target.value)}
                                />
                            </div>
                        </div>

                        <Button onClick={() => window.print()} size="lg" className="w-full font-black shadow-lg" disabled={!selectedStudent}>
                            <Printer className="mr-2 h-5 w-5" /> প্রিন্ট করুন
                        </Button>
                    </CardContent>
                </Card>

                {/* Preview Section - Right */}
                <div className="sticky top-24">
                    <h3 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-2">
                        <Info className="h-4 w-4" /> লাইভ প্রিভিউ (A4 সাইজ)
                    </h3>
                    <div className="bg-white border-4 border-black/10 rounded-xl overflow-hidden shadow-2xl origin-top scale-[0.7] sm:scale-[0.8] lg:scale-[0.85] xl:scale-100">
                        {selectedStudent ? (
                            <TestimonialTemplate 
                                student={selectedStudent} 
                                schoolInfo={schoolInfo} 
                                formData={formData} 
                                studentDob={studentDob} 
                                selectedYear={selectedYear}
                            />
                        ) : (
                            <div className="w-[210mm] h-[297mm] flex flex-col items-center justify-center bg-white text-muted-foreground gap-4">
                                <GraduationCap className="h-16 w-16 opacity-10" />
                                <p className="font-bold">শিক্ষার্থী সিলেক্ট করলে এখানে প্রিভিউ দেখা যাবে</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </main>

      {/* Actual Printable Component */}
      <div className="hidden print:block printable-area">
        {selectedStudent && (
            <TestimonialTemplate 
                student={selectedStudent} 
                schoolInfo={schoolInfo} 
                formData={formData} 
                studentDob={studentDob} 
                selectedYear={selectedYear}
            />
        )}
      </div>
    </div>
  );
}

// Fixed Template Component for consistency between Preview and Print
function TestimonialTemplate({ student, schoolInfo, formData, studentDob, selectedYear }: any) {
    return (
        <div className="w-[210mm] h-[297mm] bg-white mx-auto relative text-black flex flex-col p-12 box-border border-8 border-double border-emerald-900 overflow-hidden font-kalpurush">
            {/* Header */}
            <div className="text-center border-b-4 border-emerald-900 pb-4 mb-6 relative z-10">
                <div className="flex justify-between items-center px-4">
                    <div className="w-24 h-24 relative">
                        {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" fill className="object-contain" />}
                    </div>
                    <div className="flex-grow">
                        <h1 className="text-4xl font-black text-emerald-900 mb-1">{schoolInfo.name}</h1>
                        <p className="text-lg font-bold text-gray-700">{schoolInfo.address}</p>
                        <p className="text-sm font-bold text-gray-600 mt-1">
                            EIIN: {toBengaliNumber(schoolInfo.eiin)} | স্থাপিত: ২০১৯ ইং
                        </p>
                    </div>
                    <div className="w-24 h-24 border-2 border-black p-0.5 rounded overflow-hidden">
                        {student.photoUrl ? (
                            <Image src={student.photoUrl} alt="Student" width={96} height={96} className="object-cover w-full h-full" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">ছবি</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex justify-between font-bold text-sm mb-12 relative z-10 px-4">
                <span>স্মারক নং: {formData.smarak}</span>
                <span>তারিখ: {toBengaliNumber(formData.issueDate)} ইং</span>
            </div>

            {/* Watermark */}
            {schoolInfo.logoUrl && (
                <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none opacity-5">
                    <Image src={schoolInfo.logoUrl} alt="Watermark" width={500} height={500} />
                </div>
            )}

            <div className="relative z-10 text-center mb-16">
                <h2 className="inline-block text-3xl font-black border-b-4 border-black pb-2 px-12 uppercase tracking-widest">প্রশংসাপত্র</h2>
            </div>

            <div className="relative z-10 flex-grow text-justify leading-[2.5] text-xl font-semibold space-y-8 px-4">
                <p className="indent-16">
                    এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, <span className="text-2xl font-black border-b-2 border-black border-dotted px-2">{student.studentNameBn}</span>, 
                    পিতা: <span className="border-b-2 border-black border-dotted px-2">{student.fatherNameBn}</span>, 
                    মাতা: <span className="border-b-2 border-black border-dotted px-2">{student.motherNameBn}</span>, 
                    গ্রাম: <span className="border-b-2 border-black border-dotted px-2">{student.presentVillage || student.permanentVillage || 'বিবিধ'}</span>, 
                    ডাকঘর: <span className="border-b-2 border-black border-dotted px-2">{student.presentPostOffice || student.permanentPostOffice || 'বিবিধ'}</span>, 
                    উপজেলা: <span className="border-b-2 border-black border-dotted px-2">{student.presentUpazila || student.permanentUpazila || 'বীরগঞ্জ'}</span>, 
                    জেলা: <span className="border-b-2 border-black border-dotted px-2">{student.presentDistrict || student.permanentDistrict || 'দিনাজপুর'}</span>।
                </p>

                <p>
                    সে অত্র বিদ্যালয়ে <span className="text-2xl font-black px-2">{toBengaliNumber(selectedYear)}</span> শিক্ষাবর্ষে <span className="text-2xl font-black px-2">{classNamesMap[student.className] || student.className}</span> শ্রেণিতে অধ্যয়নরত ছিল। 
                    বিদ্যালয়ের ভর্তি রেজিস্টার অনুযায়ী তাহার রোল নম্বর <span className="font-black px-2">{toBengaliNumber(student.roll)}</span> এবং জন্ম তারিখ <span className="font-black px-2">{studentDob}</span>।
                </p>

                <p>
                    আমার জানামতে সে এই বিদ্যালয়ে অধ্যয়নকালে তাহার স্বভাব এবং চরিত্র <span className="text-2xl font-black px-2 border-b-2 border-black border-dotted">{formData.conduct}</span> ছিল। 
                    {formData.extraActivity}
                </p>

                <p className="italic text-emerald-950 pt-4">
                    আমি তাহার ভবিষ্যৎ জীবনের সর্বাঙ্গীন উন্নতি ও উজ্জ্বল সাফল্য কামনা করি।
                </p>
            </div>

            <footer className="relative z-10 pt-16 flex justify-around items-end print-footer mt-auto pb-12">
                <div className="text-center">
                    <div className="w-56 border-t-2 border-black pt-2 font-black text-lg text-gray-800">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                </div>
                <div className="text-center">
                    <div className="w-56 border-t-2 border-black pt-2 font-black text-lg text-gray-800">প্রধান শিক্ষকের স্বাক্ষর</div>
                </div>
            </footer>
        </div>
    );
}
