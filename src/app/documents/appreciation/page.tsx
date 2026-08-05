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
import { getAllResults } from '@/lib/results-data';
import { getSubjects } from '@/lib/subjects';
import { processStudentResults } from '@/lib/results-calculation';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { Printer, ArrowLeft, Award, Info, Loader2, Settings2, Type } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

const classNamesMap: { [key: string]: string } = {
  '6': 'ষষ্ঠ', '7': 'সপ্তম', '8': 'অষ্টম', '9': 'নবম', '10': 'দশম',
};

const toBengaliNumber = (str: string | number) => {
  if (!str && str !== 0) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

export default function AppreciationGeneratorPage() {
  const db = useFirestore();
  const { selectedYear } = useAcademicYear();
  const { schoolInfo } = useSchoolInfo();

  const [isClient, setIsClient] = useState(false);
  const [className, setClassName] = useState<string>('10');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isFetchingResults, setIsFetchingResults] = useState(false);

  // Customization Settings
  const [customSettings, setCustomSettings] = useState({
    watermarkOpacity: 0.05,
    borderStyle: 'border-double',
    fontSize: 20,
    borderWidth: 'border-[10px]'
  });

  const [formData, setFormData] = useState({
    smarak: `বিপৌউবি/প্রসংসা/${new Date().getFullYear()}/`,
    passingYear: selectedYear,
    gpa: '৫.০০',
    meritPosition: '',
    conduct: 'অত্যন্ত প্রশংসনীয় ও সন্তোষজনক',
    extraContent: 'সে বিদ্যালয়ের যাবতীয় সহ-শিক্ষা কার্যক্রমে সক্রিয় ও স্বতঃস্ফূর্তভাবে অংশগ্রহণ করেছে।',
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

  useEffect(() => {
    if (!db || !selectedStudent || !isClient) return;

    const fetchResults = async () => {
        setIsFetchingResults(true);
        try {
            const allRes = await getAllResults(db, selectedYear);
            const classRes = allRes.filter(r => r.className === selectedStudent.className);
            const subs = getSubjects(selectedStudent.className, selectedStudent.group).filter(s => s.isExamSubject !== false);
            
            const q = query(
                collection(db, 'students'),
                where('className', '==', selectedStudent.className),
                where('academicYear', '==', selectedYear)
            );
            const studentSnap = await getDocs(q);
            const classStudents = studentSnap.docs.map(studentFromDoc);
            
            const processed = processStudentResults(classStudents, classRes, subs);
            const studentResult = processed.find(r => r.student.id === selectedStudent.id);

            if (studentResult) {
                setFormData(prev => ({
                    ...prev,
                    gpa: studentResult.gpa.toFixed(2),
                    meritPosition: studentResult.meritPosition ? String(studentResult.meritPosition) : ''
                }));
            } else {
                setFormData(prev => ({ ...prev, gpa: '৫.০০', meritPosition: '' }));
            }
        } catch (e) {
            console.error("Result fetch error:", e);
        } finally {
            setIsFetchingResults(false);
        }
    };

    fetchResults();
  }, [db, selectedStudent, selectedYear, isClient]);

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
                    <h1 className="text-2xl font-black text-primary">প্রশংসাপত্র (Appreciation) জেনারেটর</h1>
                    <p className="text-sm text-muted-foreground">লাইভ প্রিভিউ দেখে প্রফেশনাল প্রশংসাপত্র তৈরি করুন</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <Card className="shadow-lg border-2">
                        <CardHeader className="bg-blue-50 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Award className="h-5 w-5 text-blue-700" /> প্রশংসাপত্রের বিবরণ
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                    <Label className="font-bold">শিক্ষার্থী নির্বাচন</Label>
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
                                    <div className="space-y-2">
                                        <Label className="font-bold">পাসের বছর</Label>
                                        <Input value={formData.passingYear} onChange={(e) => handleFieldChange('passingYear', e.target.value)} />
                                    </div>
                                    <div className="space-y-2 relative">
                                        <Label className="font-bold">GPA / ফলাফল</Label>
                                        <Input value={formData.gpa} onChange={(e) => handleFieldChange('gpa', e.target.value)} />
                                        {isFetchingResults && <Loader2 className="h-4 w-4 animate-spin absolute right-2 bottom-3 text-primary" />}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold">মেধাক্রম (ঐচ্ছিক)</Label>
                                        <Input value={formData.meritPosition} onChange={(e) => handleFieldChange('meritPosition', e.target.value)} placeholder="উদা: ১" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">আচরণ ও চরিত্র</Label>
                                    <Input value={formData.conduct} onChange={(e) => handleFieldChange('conduct', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">অতিরিক্ত তথ্য (ঐচ্ছিক)</Label>
                                    <textarea 
                                        className="w-full min-h-[80px] p-3 text-sm border rounded-md focus:ring-2 focus:ring-primary/20 outline-none"
                                        value={formData.extraContent}
                                        onChange={(e) => handleFieldChange('extraContent', e.target.value)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Live Customization Card */}
                    <Card className="shadow-lg border-2 border-emerald-100">
                        <CardHeader className="bg-emerald-50 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Settings2 className="h-5 w-5 text-emerald-700" /> টেমপ্লেট কাস্টমাইজেশন (লাইভ)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500" /> স্কুল লোগো জলছাপ (Opacity)
                                        </Label>
                                        <Select 
                                            value={customSettings.watermarkOpacity.toString()} 
                                            onValueChange={(v) => setCustomSettings(prev => ({ ...prev, watermarkOpacity: parseFloat(v) }))}
                                        >
                                            <SelectTrigger className="bg-white h-9"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="0.05">৫% (হালকা)</SelectItem>
                                                <SelectItem value="0.10">১০% (স্পষ্ট)</SelectItem>
                                                <SelectItem value="0.15">১৫% (গাঢ়)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500" /> বর্ডার ডিজাইন
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
                                                <SelectItem value="border-[4px]">৪px (চিকন)</SelectItem>
                                                <SelectItem value="border-[10px]">১০px (মাঝারি)</SelectItem>
                                                <SelectItem value="border-[16px]">১৬px (মোটা)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Button onClick={() => window.print()} size="lg" className="w-full font-black h-14 text-xl shadow-xl bg-blue-700 hover:bg-blue-800" disabled={!selectedStudent}>
                        <Printer className="mr-2 h-6 w-6" /> প্রশংসাপত্র প্রিন্ট করুন
                    </Button>
                </div>

                <div className="sticky top-24">
                    <h3 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-2">
                        <Info className="h-4 w-4" /> লাইভ প্রিভিউ (A4 সাইজ)
                    </h3>
                    <div className="bg-white border-4 border-black/10 rounded-xl overflow-hidden shadow-2xl origin-top scale-[0.55] sm:scale-[0.65] lg:scale-[0.7] xl:scale-[0.85]">
                        {selectedStudent ? (
                            <AppreciationTemplate 
                                student={selectedStudent} 
                                schoolInfo={schoolInfo} 
                                formData={formData}
                                settings={customSettings}
                            />
                        ) : (
                            <div className="w-[210mm] h-[297mm] flex flex-col items-center justify-center bg-white text-muted-foreground gap-4">
                                <Award className="h-16 w-16 opacity-10" />
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
            <AppreciationTemplate 
                student={selectedStudent} 
                schoolInfo={schoolInfo} 
                formData={formData} 
                settings={customSettings}
            />
        )}
      </div>
    </div>
  );
}

function AppreciationTemplate({ student, schoolInfo, formData, settings }: any) {
    const studentDob = student?.dob ? toBengaliNumber(format(new Date(student.dob), "d MMMM, yyyy", { locale: bn })) : 'প্রযোজ্য নয়';

    return (
        <div className={cn(
            "w-[210mm] h-[297mm] bg-white mx-auto relative text-black flex flex-col p-12 box-border overflow-hidden font-kalpurush",
            settings?.borderWidth || 'border-[10px]',
            settings?.borderStyle || 'border-double',
            "border-blue-900"
        )}>
            <div className="absolute top-4 left-4 w-20 h-20 border-t-4 border-l-4 border-blue-900 rounded-tl-xl opacity-20"></div>
            <div className="absolute top-4 right-4 w-20 h-20 border-t-4 border-r-4 border-blue-900 rounded-tr-xl opacity-20"></div>
            <div className="absolute bottom-4 left-4 w-20 h-20 border-b-4 border-l-4 border-blue-900 rounded-bl-xl opacity-20"></div>
            <div className="absolute bottom-4 right-4 w-20 h-20 border-b-4 border-r-4 border-blue-900 rounded-br-xl opacity-20"></div>

            <div className="text-center border-b-4 border-blue-900 pb-4 mb-6 relative z-10 flex justify-between items-center px-4">
                <div className="w-24 h-24 relative">
                    {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" fill className="object-contain" />}
                </div>
                <div className="flex-grow text-center">
                    <h1 className="text-4xl font-black text-blue-950 mb-1">{schoolInfo.name}</h1>
                    <p className="text-lg font-bold text-gray-700">{schoolInfo.address}</p>
                    <p className="text-sm font-bold text-gray-600 mt-1">
                        EIIN: {toBengaliNumber(schoolInfo.eiin)} | স্থাপিত: ২০১৯ ইং
                    </p>
                </div>
                <div className="w-24 h-24 border-2 border-black p-0.5 rounded overflow-hidden shadow-sm">
                    {student.photoUrl ? (
                        <Image src={student.photoUrl} alt="Student" width={96} height={96} className="object-cover w-full h-full" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">ছবি নেই</div>
                    )}
                </div>
            </div>

            <div className="flex justify-between font-bold text-sm mb-8 relative z-10 px-4">
                <span>স্মারক নং: {formData.smarak}</span>
                <span>তারিখ: {toBengaliNumber(formData.issueDate)} ইং</span>
            </div>

            {schoolInfo.logoUrl && (
                <div 
                    className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none"
                    style={{ opacity: settings?.watermarkOpacity || 0.05 }}
                >
                    <Image src={schoolInfo.logoUrl} alt="Watermark" width={600} height={600} />
                </div>
            )}

            <div className="relative z-10 text-center mb-10">
                <h2 className="inline-block text-4xl font-black border-b-4 border-blue-900 pb-2 px-16 uppercase tracking-widest text-blue-950">প্রশংসাপত্র</h2>
            </div>

            {/* Main Body */}
            <div 
                className="relative z-10 text-justify leading-[2.2] font-semibold space-y-6 px-6 text-slate-900 pb-[220px]"
                style={{ fontSize: `${settings?.fontSize || 20}px` }}
            >
                <p className="indent-20">
                    এতদ্বারা প্রত্যয়ন করা যাচ্ছে যে, <span className="text-2xl font-black border-b-2 border-black border-dotted px-2 text-blue-950">{student.studentNameBn}</span>, 
                    পিতা: <span className="border-b-2 border-black border-dotted px-2">{student.fatherNameBn}</span>, 
                    মাতা: <span className="border-b-2 border-black border-dotted px-2">{student.motherNameBn}</span>, 
                    গ্রাম: <span className="border-b-2 border-black border-dotted px-2">{student.presentVillage || student.permanentVillage || 'বিবিধ'}</span>, 
                    ডাকঘর: <span className="border-b-2 border-black border-dotted px-2">{student.presentPostOffice || student.permanentPostOffice || 'বিবিধ'}</span>, 
                    উপজেলা: <span className="border-b-2 border-black border-dotted px-2">{student.presentUpazila || 'বীরগঞ্জ'}</span>, 
                    জেলা: <span className="border-b-2 border-black border-dotted px-2">{student.presentDistrict || 'দিনাজপুর'}</span>।
                </p>

                <p>
                    সে অত্র বিদ্যালয়ে <span className="text-2xl font-black px-2">{toBengaliNumber(formData.passingYear)}</span> শিক্ষাবর্ষে <span className="text-2xl font-black px-2">{classNamesMap[student.className] || student.className}</span> শ্রেণিতে (রোল নম্বর: <span className="font-black px-2">{toBengaliNumber(student.roll)}</span>) নিয়মিত শিক্ষার্থী হিসেবে সফলতার সাথে অধ্যয়ন সম্পন্ন করেছে। বিদ্যালয়ের রেকর্ড অনুযায়ী তার জন্ম তারিখ: <span className="font-black px-2">{studentDob}</span>।
                </p>

                <p>
                    অত্র বিদ্যালয়ে অধ্যয়নকালীন মেধা তালিকায় {formData.meritPosition && <>(মেধাক্রম: <span className="font-black px-1">{toBengaliNumber(formData.meritPosition)}</span>)</>} তার অর্জিত GPA: <span className="font-black px-2 border-b-2 border-black border-dotted text-blue-950">{toBengaliNumber(formData.gpa)}</span>। আমার জানামতে সে কোনো প্রকার রাষ্ট্রবিরোধী বা প্রতিষ্ঠানিক শৃঙ্খলা-পরিপন্থী কাজের সাথে জড়িত ছিল না। তার চরিত্র <span className="text-2xl font-black px-2 border-b-2 border-black border-dotted">{formData.conduct}</span>। {formData.extraContent}
                </p>
            </div>

            {/* Footer */}
            <footer className="absolute bottom-16 left-0 right-0 z-10 px-16 bg-white">
                <div className="text-center mb-10">
                    <p className="italic text-blue-950 text-2xl font-black leading-relaxed">
                        আমি তার উজ্জ্বল ভবিষ্যৎ ও জীবনের সর্বাঙ্গীণ সাফল্য কামনা করি।
                    </p>
                </div>
                <div className="flex justify-between items-end pt-12">
                    <div className="text-center">
                        <div className="w-56 border-t-2 border-black pt-2 font-black text-lg text-gray-800">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                    </div>
                    <div className="text-center">
                        <div className="w-64 border-t-2 border-black pt-2 font-black text-lg text-gray-800">
                            প্রধান শিক্ষকের স্বাক্ষর ও সিল
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
