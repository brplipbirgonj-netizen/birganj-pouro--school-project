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
import { Printer, ArrowLeft, GraduationCap, Info, FileBadge, Settings2, Type } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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
  const [className, setClassName] = useState<string>('10');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  // Customization Settings
  const [customSettings, setCustomSettings] = useState({
    watermarkOpacity: 0.05,
    borderStyle: 'border-double',
    fontSize: 20,
    borderWidth: 'border-8'
  });

  const [formData, setFormData] = useState({
    smarak: `বিপৌউবি/প্রত্যয়ন/${new Date().getFullYear()}/`,
    conduct: 'অত্যন্ত প্রশংসনীয় ও সন্তোষজনক',
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
                    <h1 className="text-2xl font-black text-primary">প্রত্যয়ন পত্র (Testimonial) জেনারেটর</h1>
                    <p className="text-sm text-muted-foreground">লাইভ প্রিভিউ দেখে ডকুমেন্ট তৈরি ও প্রিন্ট করুন</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <Card className="shadow-lg border-2">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileBadge className="h-5 w-5 text-primary" /> তথ্য ও বিবরণ
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
                                    <Input value={formData.conduct} onChange={(e) => handleFieldChange('conduct', e.target.value)} placeholder="উদা: অত্যন্ত প্রশংসনীয় ও সন্তোষজনক" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Live Customization Card */}
                    <Card className="shadow-lg border-2 border-primary/10">
                        <CardHeader className="bg-muted/30 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Settings2 className="h-5 w-5 text-primary" /> টেমপ্লেট কাস্টমাইজেশন (লাইভ)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs flex items-center gap-2">
                                            স্কুল লোগো জলছাপ (Opacity)
                                        </Label>
                                        <Select 
                                            value={customSettings.watermarkOpacity.toString()} 
                                            onValueChange={(v) => setCustomSettings(prev => ({ ...prev, watermarkOpacity: parseFloat(v) }))}
                                        >
                                            <SelectTrigger className="bg-white h-9"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0.05">৫% (হালকা)</SelectItem>
                                                <SelectItem value="0.1">১০% (স্পষ্ট)</SelectItem>
                                                <SelectItem value="0.15">১৫% (গাঢ়)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs flex items-center gap-2">
                                            বর্ডার ডিজাইন
                                        </Label>
                                        <Select 
                                            value={customSettings.borderStyle} 
                                            onValueChange={(v) => setCustomSettings(prev => ({ ...prev, borderStyle: v }))}
                                        >
                                            <SelectTrigger className="bg-white h-9"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="border-double">ডাবল (Double)</SelectItem>
                                                <SelectItem value="border-solid">সলিড (Solid)</SelectItem>
                                                <SelectItem value="border-dashed">ড্যাশ (Dashed)</SelectItem>
                                                <SelectItem value="border-none">বর্ডার নেই</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <Label className="font-bold text-xs flex items-center gap-2">
                                                <Type className="h-4 w-4" /> ফন্ট সাইজ (Font Size)
                                            </Label>
                                            <Badge variant="outline" className="font-black h-5">{toBengaliNumber(customSettings.fontSize)}px</Badge>
                                        </div>
                                        <Slider 
                                            value={[customSettings.fontSize]} 
                                            min={16} 
                                            max={28} 
                                            step={1} 
                                            onValueChange={([v]) => setCustomSettings(prev => ({ ...prev, fontSize: v }))} 
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs flex items-center gap-2">
                                            বর্ডার পুরুত্ব (Width)
                                        </Label>
                                        <Select 
                                            value={customSettings.borderWidth} 
                                            onValueChange={(v) => setCustomSettings(prev => ({ ...prev, borderWidth: v }))}
                                        >
                                            <SelectTrigger className="bg-white h-9"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="border-4">৪px (চিকন)</SelectItem>
                                                <SelectItem value="border-8">৮px (মাঝারি)</SelectItem>
                                                <SelectItem value="border-[12px]">১২px (মোটা)</SelectItem>
                                                <SelectItem value="border-[16px]">১৬px (খুব মোটা)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Button onClick={() => window.print()} size="lg" className="w-full font-black shadow-lg h-14 text-xl" disabled={!selectedStudent}>
                        <Printer className="mr-2 h-6 w-6" /> প্রত্যয়ন পত্র প্রিন্ট করুন
                    </Button>
                </div>

                <div className="sticky top-24">
                    <h3 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-2">
                        <Info className="h-4 w-4" /> লাইভ প্রিভিউ (A4 সাইজ)
                    </h3>
                    <div className="bg-white border-4 border-black/10 rounded-xl overflow-hidden shadow-2xl origin-top scale-[0.65] sm:scale-[0.75] lg:scale-[0.8] xl:scale-100">
                        {selectedStudent ? (
                            <TestimonialTemplate 
                                student={selectedStudent} 
                                schoolInfo={schoolInfo} 
                                formData={formData} 
                                selectedYear={selectedYear}
                                settings={customSettings}
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

      <div className="hidden print:block printable-area">
        {selectedStudent && (
            <TestimonialTemplate 
                student={selectedStudent} 
                schoolInfo={schoolInfo} 
                formData={formData} 
                selectedYear={selectedYear}
                settings={customSettings}
            />
        )}
      </div>
    </div>
  );
}

function TestimonialTemplate({ student, schoolInfo, formData, selectedYear, settings }: any) {
    const studentDob = student?.dob ? toBengaliNumber(format(new Date(student.dob), "d MMMM, yyyy", { locale: bn })) : 'প্রযোজ্য নয়';
    
    return (
        <div className={cn(
            "w-[210mm] h-[297mm] bg-white mx-auto relative text-black flex flex-col p-12 box-border border-emerald-900 overflow-hidden font-kalpurush",
            settings?.borderWidth || 'border-8',
            settings?.borderStyle || 'border-double'
        )}>
            <div className="text-center border-b-4 border-emerald-900 pb-4 mb-6 relative z-10 flex justify-between items-center px-4">
                <div className="w-24 h-24 relative">
                    {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" fill className="object-contain" />}
                </div>
                <div className="flex-grow text-center">
                    <h1 className="text-4xl font-black text-emerald-900 mb-1">{schoolInfo.name}</h1>
                    <p className="text-lg font-bold text-gray-700">{schoolInfo.address}</p>
                    <p className="text-sm font-bold text-gray-600 mt-1">
                        EIIN: {toBengaliNumber(schoolInfo.eiin)} | স্থাপিত: ২০১৯ ইং
                    </p>
                </div>
                <div className="w-24 h-24 border-2 border-black p-0.5 rounded overflow-hidden shadow-sm">
                    {student.photoUrl ? (
                        <Image src={student.photoUrl} alt="Student" width={96} height={96} className="object-cover w-full h-full" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">ছবি</div>
                    )}
                </div>
            </div>

            <div className="flex justify-between font-bold text-sm mb-10 relative z-10 px-4">
                <span>স্মারক নং: {formData.smarak}</span>
                <span>তারিখ: {toBengaliNumber(formData.issueDate)} ইং</span>
            </div>

            {schoolInfo.logoUrl && (
                <div 
                    className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none"
                    style={{ opacity: settings?.watermarkOpacity || 0.05 }}
                >
                    <Image src={schoolInfo.logoUrl} alt="Watermark" width={500} height={500} />
                </div>
            )}

            <div className="relative z-10 text-center mb-12">
                <h2 className="inline-block text-3xl font-black border-b-4 border-black pb-2 px-12 uppercase tracking-widest">প্রত্যয়ন পত্র</h2>
            </div>

            <div 
                className="relative z-10 flex-grow text-justify leading-[2.5] font-semibold space-y-8 px-4 text-slate-900"
                style={{ fontSize: `${settings?.fontSize || 20}px` }}
            >
                <p className="indent-16">
                    এতদ্বারা প্রত্যয়ন করা যাচ্ছে যে, <span className="text-2xl font-black border-b-2 border-black border-dotted px-2">{student.studentNameBn}</span>, 
                    পিতা: <span className="border-b-2 border-black border-dotted px-2">{student.fatherNameBn}</span>, 
                    মাতা: <span className="border-b-2 border-black border-dotted px-2">{student.motherNameBn}</span>, 
                    গ্রাম: <span className="border-b-2 border-black border-dotted px-2">{student.permanentVillage || student.presentVillage || 'বিবিধ'}</span>, 
                    ডাকঘর: <span className="border-b-2 border-black border-dotted px-2">{student.presentPostOffice || student.permanentPostOffice || 'বিবিধ'}</span>, 
                    উপজেলা: <span className="border-b-2 border-black border-dotted px-2">{student.permanentUpazila || student.presentUpazila || 'বীরগঞ্জ'}</span>, 
                    জেলা: <span className="border-b-2 border-black border-dotted px-2">{student.permanentDistrict || student.presentDistrict || 'দিনাজপুর'}</span>।
                </p>

                <p>
                    সে অত্র বিদ্যালয়ে <span className="text-2xl font-black px-2">{toBengaliNumber(selectedYear)}</span> শিক্ষাবর্ষে <span className="text-2xl font-black px-2">{classNamesMap[student.className] || student.className}</span> শ্রেণিতে (রোল নম্বর: <span className="font-black px-2">{toBengaliNumber(student.roll)}</span>) নিয়মিত শিক্ষার্থী হিসেবে অধ্যয়নরত আছে। বিদ্যালয়ের রেকর্ড অনুযায়ী তার জন্ম তারিখ: <span className="font-black px-2">{studentDob}</span>।
                </p>

                <p>
                    আমার জানামতে সে কোনো প্রকার রাষ্ট্রবিরোধী বা প্রতিষ্ঠানিক শৃঙ্খলা-পরিপন্থী কাজের সাথে জড়িত ছিল না। তার চরিত্র <span className="text-2xl font-black px-2 border-b-2 border-black border-dotted">{formData.conduct}</span>।
                </p>
            </div>

            <footer className="absolute bottom-16 left-0 right-0 z-10 px-12 bg-white">
                <div className="text-center mb-16">
                    <p className="italic text-emerald-950 text-2xl font-black leading-relaxed">
                        আমি তার উজ্জ্বল ভবিষ্যৎ ও জীবনের সর্বাঙ্গীণ সাফল্য কামনা করি।
                    </p>
                </div>
                <div className="flex justify-around items-end">
                    <div className="text-center">
                        <div className="w-56 border-t-2 border-black pt-2 font-black text-lg text-gray-800">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                    </div>
                    <div className="text-center">
                        <div className="w-56 border-t-2 border-black pt-2 font-black text-lg text-gray-800">প্রধান শিক্ষকের স্বাক্ষর ও সিল</div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
