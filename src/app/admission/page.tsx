'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, ArrowRight, ArrowLeft, CheckCircle2, User, Users, Home, GraduationCap, Loader2, Printer, FileText, Check, AlertCircle, Phone } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { saveAdmissionApplication, NewAdmissionData } from '@/lib/admission-data';
import { useFirestore } from '@/firebase';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { DatePicker } from '@/components/ui/date-picker';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

const initialStudentState: NewAdmissionData = {
  className: '',
  academicYear: String(new Date().getFullYear()),
  group: '',
  optionalSubject: '',
  studentNameBn: '',
  studentNameEn: '',
  dob: undefined,
  birthRegNo: '',
  gender: '',
  religion: '',
  photoUrl: '',
  fatherNameBn: '',
  fatherNameEn: '',
  fatherNid: '',
  motherNameBn: '',
  motherNameEn: '',
  motherNid: '',
  guardianMobile: '',
  studentMobile: '',
  previousSchool: '',
  presentVillage: '',
  presentUnion: '',
  presentPostOffice: '',
  presentUpazila: 'বীরগঞ্জ',
  presentDistrict: 'দিনাজপুর',
  permanentVillage: '',
  permanentUnion: '',
  permanentPostOffice: '',
  permanentUpazila: 'বীরগঞ্জ',
  permanentDistrict: 'দিনাজপুর',
};

const inputFocusClasses = "transition-all duration-300 focus:ring-2 focus:ring-primary/20 focus:border-primary hover:border-primary/50";

const classNamesMap: Record<string, string> = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };
const toBengaliNumber = (str: string | number) => String(str).replace(/[0-9]/g, (w) => ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'][parseInt(w, 10)]);

export default function AdmissionPortalPage() {
    const router = useRouter();
    const { toast } = useToast();
    const db = useFirestore();
    const { schoolInfo } = useSchoolInfo();
    
    const [isMounted, setIsMounted] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [student, setStudent] = useState<NewAdmissionData>(initialStudentState);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [confirmReview, setConfirmReview] = useState(false);
    const [errors, setErrors] = useState<Set<string>>(new Set());

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleInputChange = (field: keyof NewAdmissionData, value: any) => {
        setStudent(prev => ({...prev, [field]: value}));
        if (value && errors.has(field)) {
            const nextErrors = new Set(errors);
            nextErrors.delete(field);
            setErrors(nextErrors);
        }
    };

    const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            toast({ variant: "destructive", title: "ছবি বড়", description: "২ মেগাবাইটের কম সাইজের ছবি দিন।" });
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            setPhotoPreview(dataUrl);
            handleInputChange('photoUrl', dataUrl);
        };
        reader.readAsDataURL(file);
    };

    const isStepValid = () => {
        const missingFields = new Set<string>();
        if (currentStep === 1) {
            if (!student.className) missingFields.add('className');
            if (!student.previousSchool) missingFields.add('previousSchool');
        } else if (currentStep === 2) {
            if (!student.studentNameBn) missingFields.add('studentNameBn');
            if (!student.dob) missingFields.add('dob');
            if (!student.gender) missingFields.add('gender');
            if (!student.religion) missingFields.add('religion');
            if (!student.photoUrl) missingFields.add('photoUrl');
        } else if (currentStep === 3) {
            if (!student.fatherNameBn) missingFields.add('fatherNameBn');
            if (!student.motherNameBn) missingFields.add('motherNameBn');
            if (!student.guardianMobile) missingFields.add('guardianMobile');
        } else if (currentStep === 4) {
            if (!student.presentVillage) missingFields.add('presentVillage');
            if (!student.presentUpazila) missingFields.add('presentUpazila');
            if (!student.presentDistrict) missingFields.add('presentDistrict');
        }

        if (missingFields.size > 0) {
            setErrors(missingFields);
            toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ', description: 'অনুগ্রহ করে লাল চিহ্নিত ঘরগুলো পূরণ করুন।' });
            return false;
        }
        return true;
    };

    const nextStep = () => {
        if (isStepValid()) {
            setCurrentStep(prev => Math.min(prev + 1, 5));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    
    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSameAddress = (checked: boolean | string) => {
        if (checked) {
            setStudent(prev => ({
                ...prev,
                permanentVillage: prev.presentVillage,
                permanentUnion: prev.presentUnion,
                permanentPostOffice: prev.presentPostOffice,
                permanentUpazila: prev.presentUpazila,
                permanentDistrict: prev.presentDistrict,
            }));
        } else {
            setStudent(prev => ({
                ...prev,
                permanentVillage: '',
                permanentUnion: '',
                permanentPostOffice: '',
                permanentUpazila: 'বীরগঞ্জ',
                permanentDistrict: 'দিনাজপুর',
            }));
        }
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!db) return;
        if (!confirmReview) {
            toast({ variant: "destructive", title: "নিশ্চিতকরণ আবশ্যক", description: "তথ্য যাচাই করে নিচের বক্সে টিক দিন।" });
            return;
        }
        setIsLoading(true);
        try {
            await saveAdmissionApplication(db, student);
            setIsSuccess(true);
            toast({ title: "আবেদন জমা হয়েছে", description: "আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।" });
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isMounted) return null;

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 font-kalpurush">
                <Card className="max-w-2xl w-full text-center p-8 border-2 border-emerald-500 shadow-2xl no-print">
                    <div className="flex justify-center mb-6">
                        <div className="bg-emerald-100 p-4 rounded-full">
                            <CheckCircle2 className="h-16 w-16 text-emerald-600 animate-bounce" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-black text-emerald-900 mb-2">সফল হয়েছে!</CardTitle>
                    <CardDescription className="text-lg font-bold">আপনার অনলাইন ভর্তির আবেদনটি আমাদের কাছে পৌঁছেছে।</CardDescription>
                    <div className="mt-8 space-y-6">
                        <p className="text-sm text-muted-foreground bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                            নিচের বাটনটি ক্লিক করে আবেদনপত্রটি প্রিন্ট বা ডাউনলোড করে সংরক্ষণ করুন। বিদ্যালয় কর্তৃপক্ষ আপনার তথ্য যাচাই করে দ্রুত যোগাযোগ করবে।
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4">
                            <Button className="flex-1 h-14 text-xl font-black shadow-xl" onClick={() => window.print()}>
                                <Printer className="mr-2 h-6 w-6" /> আবেদনপত্র প্রিন্ট করুন
                            </Button>
                            <Button variant="outline" className="flex-1 h-14 text-lg font-black" onClick={() => router.push('/')}>হোমে ফিরে যান</Button>
                        </div>
                    </div>
                </Card>
                <div className="hidden print:block printable-area w-full">
                   <PrintableApplication student={student} schoolInfo={schoolInfo} />
                </div>
            </div>
        );
    }

  return (
    <div className="min-h-screen bg-indigo-50 font-kalpurush pb-20 no-print">
      <header className="bg-primary p-6 text-white text-center shadow-lg border-b-4 border-black/10">
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
              {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" width={60} height={60} className="rounded-full bg-white p-1" />}
              <h1 className="text-2xl sm:text-3xl font-black">{schoolInfo.name}</h1>
              <p className="text-sm font-bold opacity-90">অনলাইন ভর্তি আবেদন পোর্টাল - {toBengaliNumber(student.academicYear)}</p>
          </div>
      </header>

      <main className="max-w-4xl mx-auto mt-8 p-4">
        <Card className="shadow-2xl border-none overflow-hidden rounded-2xl">
            <div className="bg-primary/5 p-6 border-b">
                <Progress value={(currentStep / 5) * 100} className="h-2" />
                <div className="flex justify-between mt-4">
                    {[1, 2, 3, 4, 5].map(step => (
                        <div key={step} className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center border-2 font-black transition-all",
                            currentStep >= step ? "bg-primary border-primary text-white scale-110 shadow-md" : "bg-white border-muted text-muted-foreground"
                        )}>
                            {step === 5 ? <Check className="h-5 w-5" /> : step}
                        </div>
                    ))}
                </div>
            </div>

            <CardContent className="p-6 sm:p-10">
                <form onSubmit={handleSubmit} className="space-y-8" autoComplete="on">
                    {/* Step 1: Institutional Info */}
                    {currentStep === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-xl font-black flex items-center gap-2 text-primary border-b pb-2"><GraduationCap className="h-6 w-6" /> ১. প্রাতিষ্ঠানিক তথ্য</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className={cn("font-bold", errors.has('className') && "text-red-600")}>ভর্তির শ্রেণি *</Label>
                                    <Select value={student.className} onValueChange={v => handleInputChange('className', v)}>
                                        <SelectTrigger className={cn("h-12", errors.has('className') && "border-red-500")}><SelectValue placeholder="শ্রেণি নির্বাচন করুন" /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(classNamesMap).map(([id, label]) => (
                                                <SelectItem key={id} value={id}>{label} শ্রেণি</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className={cn("font-bold", errors.has('previousSchool') && "text-red-600")}>পূর্ববর্তী বিদ্যালয়ের নাম *</Label>
                                    <Input 
                                        name="previous_school"
                                        autoComplete="organization"
                                        className={cn("h-12", errors.has('previousSchool') && "border-red-500")} 
                                        value={student.previousSchool} 
                                        onChange={e => handleInputChange('previousSchool', e.target.value)} 
                                        placeholder="আপনার আগের স্কুলের নাম দিন"
                                    />
                                </div>
                                {(student.className === '9' || student.className === '10') && (
                                    <>
                                    <div className="space-y-2">
                                        <Label className="font-bold">বিভাগ (গ্রুপ)</Label>
                                        <Select value={student.group} onValueChange={v => handleInputChange('group', v)}>
                                            <SelectTrigger className="h-12"><SelectValue placeholder="সিলেক্ট করুন" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="science">বিজ্ঞান</SelectItem>
                                                <SelectItem value="arts">মানবিক</SelectItem>
                                                <SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold">ঐচ্ছিক বিষয়</Label>
                                        <Select value={student.optionalSubject} onValueChange={v => handleInputChange('optionalSubject', v)}>
                                            <SelectTrigger className="h-12"><SelectValue placeholder="সিলেক্ট করুন" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="উচ্চতর গণিত">উচ্চতর গণিত</SelectItem>
                                                <SelectItem value="কৃষি শিক্ষা">কৃষি শিক্ষা</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    </>
                                )}
                            </div>
                            <Button type="button" onClick={nextStep} className="w-full h-12 text-lg font-black mt-6 shadow-lg">পরবর্তী ধাপ <ArrowRight className="ml-2 h-5 w-5" /></Button>
                        </div>
                    )}

                    {/* Step 2: Student Personal Info */}
                    {currentStep === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-xl font-black flex items-center gap-2 text-primary border-b pb-2"><User className="h-6 w-6" /> ২. শিক্ষার্থীর ব্যক্তিগত তথ্য</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className={cn("font-bold", errors.has('studentNameBn') && "text-red-600")}>নাম (বাংলা) *</Label>
                                    <Input name="student_name_bn" autoComplete="name" className={cn("h-12", errors.has('studentNameBn') && "border-red-500")} value={student.studentNameBn} onChange={e => handleInputChange('studentNameBn', e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">নাম (ইংরেজি)</Label>
                                    <Input name="student_name_en" autoComplete="name" className="h-12 uppercase" value={student.studentNameEn} onChange={e => handleInputChange('studentNameEn', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className={cn("font-bold", errors.has('dob') && "text-red-600")}>জন্ম তারিখ *</Label>
                                    <DatePicker value={student.dob} onChange={d => handleInputChange('dob', d)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">জন্ম নিবন্ধন নম্বর</Label>
                                    <Input name="birth_reg" autoComplete="off" className="h-12" value={student.birthRegNo} onChange={e => handleInputChange('birthRegNo', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className={cn("font-bold", errors.has('gender') && "text-red-600")}>লিঙ্গ *</Label>
                                    <Select value={student.gender} onValueChange={v => handleInputChange('gender', v)}>
                                        <SelectTrigger className={cn("h-12", errors.has('gender') && "border-red-500")}><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="male">পুরুষ</SelectItem>
                                            <SelectItem value="female">মহিলা</SelectItem>
                                            <SelectItem value="other">অন্যান্য</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className={cn("font-bold", errors.has('religion') && "text-red-600")}>ধর্ম *</Label>
                                    <Select value={student.religion} onValueChange={v => handleInputChange('religion', v)}>
                                        <SelectTrigger className={cn("h-12", errors.has('religion') && "border-red-500")}><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="islam">ইসলাম</SelectItem>
                                            <SelectItem value="hinduism">হিন্দু</SelectItem>
                                            <SelectItem value="buddhism">বৌদ্ধ</SelectItem>
                                            <SelectItem value="christianity">খ্রিস্টান</SelectItem>
                                            <SelectItem value="other">অন্যান্য</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="sm:col-span-2 space-y-2">
                                    <Label className={cn("font-bold", errors.has('photoUrl') && "text-red-600")}>ছবি *</Label>
                                    <div className={cn("flex items-center gap-4 border p-4 rounded-lg bg-slate-50 border-dashed", errors.has('photoUrl') ? "border-red-500 bg-red-50" : "border-primary/30")}>
                                        <div className="h-24 w-24 rounded border bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                            {photoPreview ? <Image src={photoPreview} alt="Preview" width={96} height={96} className="object-cover h-full" /> : <Upload className="text-muted-foreground" />}
                                        </div>
                                        <div className="space-y-2">
                                            <Input type="file" accept="image/*" onChange={handlePhotoChange} className="cursor-pointer h-10" />
                                            <p className="text-[10px] text-muted-foreground">পাসপোর্ট সাইজ ছবি, সর্বোচ্চ ২ মেগাবাইট।</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4 mt-6">
                                <Button type="button" variant="outline" onClick={prevStep} className="h-12 flex-1 font-black"><ArrowLeft className="mr-2 h-5 w-5" /> ব্যাকে যান</Button>
                                <Button type="button" onClick={nextStep} className="h-12 flex-1 font-black shadow-lg">পরবর্তী ধাপ <ArrowRight className="ml-2 h-5 w-5" /></Button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Guardian Info */}
                    {currentStep === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-xl font-black flex items-center gap-2 text-primary border-b pb-2"><Users className="h-6 w-6" /> ৩. অভিভাবকের তথ্য</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className={cn("font-bold", errors.has('fatherNameBn') && "text-red-600")}>পিতার নাম (বাংলা) *</Label>
                                    <Input name="father_name_bn" autoComplete="name" className={cn("h-12", errors.has('fatherNameBn') && "border-red-500")} value={student.fatherNameBn} onChange={e => handleInputChange('fatherNameBn', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">পিতার নাম (ইংরেজি)</Label>
                                    <Input name="father_name_en" autoComplete="name" className="h-12 uppercase" value={student.fatherNameEn} onChange={e => handleInputChange('fatherNameEn', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">পিতার NID নম্বর</Label>
                                    <Input name="father_nid" autoComplete="off" className="h-12" value={student.fatherNid} onChange={e => handleInputChange('fatherNid', e.target.value)} />
                                </div>
                                <div className="hidden sm:block"></div>
                                
                                <Separator className="sm:col-span-2 my-2" />

                                <div className="space-y-2">
                                    <Label className={cn("font-bold", errors.has('motherNameBn') && "text-red-600")}>মাতার নাম (বাংলা) *</Label>
                                    <Input name="mother_name_bn" autoComplete="name" className={cn("h-12", errors.has('motherNameBn') && "border-red-500")} value={student.motherNameBn} onChange={e => handleInputChange('motherNameBn', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">মাতার নাম (ইংরেজি)</Label>
                                    <Input name="mother_name_en" autoComplete="name" className="h-12 uppercase" value={student.motherNameEn} onChange={e => handleInputChange('motherNameEn', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">মাতার NID নম্বর</Label>
                                    <Input name="mother_nid" autoComplete="off" className="h-12" value={student.motherNid} onChange={e => handleInputChange('motherNid', e.target.value)} />
                                </div>
                                <div className="hidden sm:block"></div>

                                <Separator className="sm:col-span-2 my-2" />

                                <div className="space-y-2">
                                    <Label className={cn("font-bold text-red-600", errors.has('guardianMobile') && "text-red-700 underline")}>অভিভাবকের মোবাইল নম্বর *</Label>
                                    <Input name="guardian_mobile" autoComplete="tel" className={cn("h-12 border-red-200", errors.has('guardianMobile') && "border-red-500 bg-red-50")} type="tel" value={student.guardianMobile} onChange={e => handleInputChange('guardianMobile', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">শিক্ষার্থীর মোবাইল (যদি থাকে)</Label>
                                    <Input name="student_mobile" autoComplete="tel" className="h-12" type="tel" value={student.studentMobile} onChange={e => handleInputChange('studentMobile', e.target.value)} />
                                </div>
                            </div>
                            <div className="flex gap-4 mt-6">
                                <Button type="button" variant="outline" onClick={prevStep} className="h-12 flex-1 font-black"><ArrowLeft className="mr-2 h-5 w-5" /> ব্যাকে যান</Button>
                                <Button type="button" onClick={nextStep} className="h-12 flex-1 font-black shadow-lg">পরবর্তী ধাপ <ArrowRight className="ml-2 h-5 w-5" /></Button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Address Info */}
                    {currentStep === 4 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-xl font-black flex items-center gap-2 text-primary border-b pb-2"><Home className="h-6 w-6" /> ৪. ঠিকানা ও যোগাযোগ</h3>
                            
                            <div className="space-y-4">
                                <p className="font-black text-sm text-muted-foreground uppercase tracking-widest border-l-4 border-primary pl-2">বর্তমান ঠিকানা</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className={cn("font-bold", errors.has('presentVillage') && "text-red-600")}>গ্রাম/মহল্লা *</Label>
                                        <Input name="village" autoComplete="address-line1" className={cn("h-12", errors.has('presentVillage') && "border-red-500")} value={student.presentVillage} onChange={e => handleInputChange('presentVillage', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold">ইউনিয়ন/ওয়ার্ড</Label>
                                        <Input name="union" autoComplete="address-line2" className="h-12" value={student.presentUnion} onChange={e => handleInputChange('presentUnion', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold">ডাকঘর</Label>
                                        <Input name="post_office" autoComplete="off" className="h-12" value={student.presentPostOffice} onChange={e => handleInputChange('presentPostOffice', e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className={cn("font-bold", errors.has('presentUpazila') && "text-red-600")}>উপজেলা *</Label>
                                            <Input name="upazila" autoComplete="address-level2" className={cn("h-12", errors.has('presentUpazila') && "border-red-500")} value={student.presentUpazila} onChange={e => handleInputChange('presentUpazila', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className={cn("font-bold", errors.has('presentDistrict') && "text-red-600")}>জেলা *</Label>
                                            <Input name="district" autoComplete="address-level1" className={cn("h-12", errors.has('presentDistrict') && "border-red-500")} value={student.presentDistrict} onChange={e => handleInputChange('presentDistrict', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4">
                                <div className="flex justify-between items-center">
                                    <p className="font-black text-sm text-muted-foreground uppercase tracking-widest border-l-4 border-emerald-500 pl-2">স্থায়ী ঠিকানা</p>
                                    <div className="flex items-center space-x-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                                        <Checkbox id="same-as-present" onCheckedChange={handleSameAddress} />
                                        <label htmlFor="same-as-present" className="text-xs font-bold text-emerald-700 cursor-pointer">বর্তমান ঠিকানার অনুরূপ</label>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <Label className="font-bold">গ্রাম/মহল্লা</Label>
                                        <Input name="p_village" autoComplete="address-line1" className="h-12" value={student.permanentVillage} onChange={e => handleInputChange('permanentVillage', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold">ইউনিয়ন/ওয়ার্ড</Label>
                                        <Input name="p_union" autoComplete="address-line2" className="h-12" value={student.permanentUnion} onChange={e => handleInputChange('permanentUnion', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold">ডাকঘর</Label>
                                        <Input name="p_post_office" autoComplete="off" className="h-12" value={student.permanentPostOffice} onChange={e => handleInputChange('permanentPostOffice', e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="font-bold">উপজেলা</Label>
                                            <Input name="p_upazila" autoComplete="address-level2" className="h-12" value={student.permanentUpazila} onChange={e => handleInputChange('permanentUpazila', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="font-bold">জেলা</Label>
                                            <Input name="p_district" autoComplete="address-level1" className="h-12" value={student.permanentDistrict} onChange={e => handleInputChange('permanentDistrict', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 mt-6">
                                <Button type="button" variant="outline" onClick={prevStep} className="h-12 flex-1 font-black"><ArrowLeft className="mr-2 h-5 w-5" /> ব্যাকে যান</Button>
                                <Button type="button" onClick={nextStep} className="h-12 flex-1 font-black shadow-lg">প্রিভিউ দেখুন <ArrowRight className="ml-2 h-5 w-5" /></Button>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Review & Submit */}
                    {currentStep === 5 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            <div className="flex items-center justify-between border-b pb-4">
                                <h3 className="text-xl font-black flex items-center gap-2 text-primary"><FileText className="h-6 w-6" /> ৫. আবেদনপত্র প্রিভিউ ও নিশ্চিতকরণ</h3>
                                <Badge variant="secondary" className="font-bold bg-amber-100 text-amber-800">সাবমিট করার আগে তথ্য যাচাই করুন</Badge>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-2xl border-2 border-slate-200 space-y-8 shadow-inner overflow-hidden">
                                {/* Student Summary */}
                                <div className="flex flex-col sm:flex-row gap-6 items-start">
                                    <div className="h-32 w-32 rounded-lg border-2 border-primary/20 bg-white p-1 shadow-sm shrink-0">
                                        {photoPreview ? <Image src={photoPreview} alt="Student" width={128} height={128} className="object-cover h-full w-full rounded" /> : <div className="h-full w-full bg-muted flex items-center justify-center"><User className="text-muted-foreground h-10 w-10" /></div>}
                                    </div>
                                    <div className="space-y-2 w-full">
                                        <h4 className="text-2xl font-black text-slate-800">{student.studentNameBn || 'নাম নেই'}</h4>
                                        <p className="text-sm font-bold text-muted-foreground uppercase">{student.studentNameEn || 'English Name Missing'}</p>
                                        <p className="text-sm font-bold text-primary">{classNamesMap[student.className] || 'শ্রেণি'} শ্রেণিতে ভর্তির আবেদন - {toBengaliNumber(student.academicYear)}</p>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 mt-4 text-xs font-semibold">
                                            <p className="border-b pb-1"><span className="text-muted-foreground">পূর্ববর্তী স্কুল:</span> {student.previousSchool || '-'}</p>
                                            <p className="border-b pb-1"><span className="text-muted-foreground">জন্ম নিবন্ধন:</span> {student.birthRegNo || '-'}</p>
                                            <p className="border-b pb-1"><span className="text-muted-foreground">জন্ম তারিখ:</span> {student.dob ? format(student.dob, 'dd/MM/yyyy') : '-'}</p>
                                            <p className="border-b pb-1"><span className="text-muted-foreground">লিঙ্গ ও ধর্ম:</span> {student.gender === 'male' ? 'পুরুষ' : student.gender === 'female' ? 'মহিলা' : 'অন্যান্য'}, {student.religion || '-'}</p>
                                            <p className="border-b pb-1"><span className="text-muted-foreground">বিভাগ ও ঐচ্ছিক:</span> {student.group || 'সাধারণ'}, {student.optionalSubject || '-'}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Parents Summary */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest border-l-4 border-primary pl-2">পিতা ও মাতার তথ্য</p>
                                        <div className="space-y-3 text-xs bg-white p-4 rounded-xl border">
                                            <div className="space-y-1">
                                                <p className="text-muted-foreground">পিতার নাম (বাংলা ও ইংরেজি):</p>
                                                <p className="font-bold text-slate-800">{student.fatherNameBn}</p>
                                                <p className="font-bold text-slate-600 uppercase text-[10px]">{student.fatherNameEn || '-'}</p>
                                                <p className="text-[10px]">এনআইডি: <span className="font-bold">{student.fatherNid || '-'}</span></p>
                                            </div>
                                            <Separator />
                                            <div className="space-y-1">
                                                <p className="text-muted-foreground">মাতার নাম (বাংলা ও ইংরেজি):</p>
                                                <p className="font-bold text-slate-800">{student.motherNameBn}</p>
                                                <p className="font-bold text-slate-600 uppercase text-[10px]">{student.motherNameEn || '-'}</p>
                                                <p className="text-[10px]">এনআইডি: <span className="font-bold">{student.motherNid || '-'}</span></p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contact Summary */}
                                    <div className="space-y-4">
                                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest border-l-4 border-emerald-500 pl-2">যোগাযোগ ও ঠিকানা</p>
                                        <div className="space-y-3 text-xs bg-white p-4 rounded-xl border">
                                            <div className="flex items-center gap-2 text-emerald-700 font-bold mb-2">
                                                <Phone className="h-4 w-4" /> মোবাইল: {student.guardianMobile}
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-muted-foreground">বর্তমান ঠিকানা:</p>
                                                <p className="font-bold leading-relaxed">{student.presentVillage}, {student.presentUnion}, {student.presentPostOffice}, {student.presentUpazila}, {student.presentDistrict}</p>
                                            </div>
                                            <Separator />
                                            <div className="space-y-1">
                                                <p className="text-muted-foreground">স্থায়ী ঠিকানা:</p>
                                                <p className="font-bold leading-relaxed">{student.permanentVillage || student.presentVillage}, {student.permanentUnion || student.presentUnion}, {student.permanentPostOffice || student.presentPostOffice}, {student.permanentUpazila || student.presentUpazila}, {student.permanentDistrict || student.presentDistrict}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-5 bg-blue-50 rounded-xl border-2 border-blue-100 flex items-start gap-4">
                                <Checkbox id="confirm-all" checked={confirmReview} onCheckedChange={(v) => setConfirmReview(!!v)} className="mt-1 h-5 w-5" />
                                <Label htmlFor="confirm-all" className="text-sm font-bold leading-relaxed text-blue-900 cursor-pointer">
                                    আমি অঙ্গীকার করছি যে, উপরে দেওয়া সকল তথ্য সঠিক। যদি কোনো তথ্য ভুল বা অসত্য প্রমাণিত হয়, তবে বিদ্যালয় কর্তৃপক্ষ আমার আবেদন বাতিল করতে পারবে। আমি বিদ্যালয়ের সকল নিয়ম মেনে চলতে বাধ্য থাকব।
                                </Label>
                            </div>

                            <div className="flex gap-4 mt-8">
                                <Button type="button" variant="outline" onClick={prevStep} className="h-12 flex-1 font-black"><ArrowLeft className="mr-2 h-5 w-5" /> সংশোধন করুন</Button>
                                <Button type="submit" disabled={isLoading || !confirmReview} className="h-12 flex-1 font-black shadow-xl bg-primary hover:bg-primary/90 text-white text-lg">
                                    {isLoading ? <Loader2 className="animate-spin mr-2" /> : <CheckCircle2 className="mr-2" />} 
                                    আবেদন চূড়ান্ত করুন
                                </Button>
                            </div>
                        </div>
                    )}
                </form>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}

// --- Printable Component ---

function PrintableApplication({ student, schoolInfo }: { student: NewAdmissionData, schoolInfo: any }) {
    const today = format(new Date(), 'dd/MM/yyyy');
    const dob = student.dob ? format(student.dob, 'dd/MM/yyyy') : '-';

    return (
        <div className="p-10 font-kalpurush text-black bg-white min-h-screen">
            <header className="flex items-center gap-6 border-b-4 border-double border-black pb-4 mb-8">
                {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" width={80} height={80} className="object-contain" />}
                <div className="text-center flex-grow">
                    <h1 className="text-3xl font-black uppercase">{schoolInfo.name}</h1>
                    <p className="text-lg font-bold">{schoolInfo.address}</p>
                    <div className="mt-2 inline-block bg-slate-100 px-4 py-1 rounded-full border border-black font-black uppercase text-sm">ভর্তি আবেদনপত্র - {toBengaliNumber(student.academicYear)}</div>
                </div>
                <div className="h-32 w-28 border-2 border-black p-1 flex items-center justify-center overflow-hidden">
                    {student.photoUrl ? <Image src={student.photoUrl} alt="Photo" width={110} height={128} className="object-cover h-full w-full" /> : <span className="text-[10px] text-muted-foreground">Passport Photo</span>}
                </div>
            </header>

            <div className="space-y-8 text-lg">
                <section className="space-y-4">
                    <h3 className="text-xl font-black border-b-2 border-black pb-1 mb-4">১. প্রাতিষ্ঠানিক ও ব্যক্তিগত তথ্য</h3>
                    <div className="grid grid-cols-2 gap-y-3 font-semibold">
                        <div className="flex"><span className="w-44">ভর্তির শ্রেণি</span><span>: {classNamesMap[student.className]} শ্রেণি</span></div>
                        <div className="flex"><span className="w-44">বিভাগ/শাখা</span><span>: {student.group || 'প্রযোজ্য নয়'}</span></div>
                        <div className="flex"><span className="w-44">পূর্ববর্তী বিদ্যালয়</span><span>: {student.previousSchool || 'প্রযোজ্য নয়'}</span></div>
                        <div className="flex"><span className="w-44">শিক্ষার্থীর নাম (বাংলা)</span><span className="font-black">: {student.studentNameBn}</span></div>
                        <div className="flex"><span className="w-44">নাম (ইংরেজি)</span><span className="uppercase">: {student.studentNameEn || '-'}</span></div>
                        <div className="flex"><span className="w-44">জন্ম তারিখ</span><span>: {dob}</span></div>
                        <div className="flex"><span className="w-44">জন্ম নিবন্ধন নম্বর</span><span>: {toBengaliNumber(student.birthRegNo || '')}</span></div>
                        <div className="flex"><span className="w-44">লিঙ্গ</span><span>: {student.gender === 'male' ? 'পুরুষ' : student.gender === 'female' ? 'মহিলা' : 'অন্যান্য'}</span></div>
                        <div className="flex"><span className="w-44">ধর্ম</span><span>: {student.religion}</span></div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-xl font-black border-b-2 border-black pb-1 mb-4">২. পিতা ও মাতার তথ্য</h3>
                    <div className="grid grid-cols-2 gap-y-3 font-semibold">
                        <div className="flex"><span className="w-44">পিতার নাম (বাংলা)</span><span>: {student.fatherNameBn}</span></div>
                        <div className="flex"><span className="w-44">পিতার নাম (ইংরেজি)</span><span className="uppercase">: {student.fatherNameEn || '-'}</span></div>
                        <div className="flex"><span className="w-44">মাতার নাম (বাংলা)</span><span>: {student.motherNameBn}</span></div>
                        <div className="flex"><span className="w-44">মাতার নাম (ইংরেজি)</span><span className="uppercase">: {student.motherNameEn || '-'}</span></div>
                        <div className="flex"><span className="w-44">পিতার এনআইডি</span><span>: {toBengaliNumber(student.fatherNid || '')}</span></div>
                        <div className="flex"><span className="w-44">মাতার এনআইডি</span><span>: {toBengaliNumber(student.motherNid || '')}</span></div>
                    </div>
                </section>

                <section className="space-y-4">
                    <h3 className="text-xl font-black border-b-2 border-black pb-1 mb-4">৩. ঠিকানা ও যোগাযোগ</h3>
                    <div className="grid grid-cols-2 gap-8 font-semibold">
                        <div>
                            <p className="text-sm font-black underline mb-1 uppercase text-gray-600">বর্তমান ঠিকানা</p>
                            <p>গ্রাম: {student.presentVillage}, ইউনিয়ন: {student.presentUnion}</p>
                            <p>ডাকঘর: {student.presentPostOffice}, উপজেলা: {student.presentUpazila}</p>
                            <p>জেলা: {student.presentDistrict}</p>
                        </div>
                        <div>
                            <p className="text-sm font-black underline mb-1 uppercase text-gray-600">স্থায়ী ঠিকানা</p>
                            <p>গ্রাম: {student.permanentVillage || student.presentVillage}</p>
                            <p>ডাকঘর: {student.permanentPostOffice || student.presentPostOffice}</p>
                            <p>জেলা: {student.permanentDistrict || student.presentDistrict}</p>
                        </div>
                        <div className="col-span-2 flex items-center gap-2 text-xl font-black text-primary pt-4">
                            <span>মোবাইল নম্বর: {toBengaliNumber(student.guardianMobile)}</span>
                        </div>
                    </div>
                </section>
            </div>

            <footer className="mt-24 border-t-2 border-black pt-12 flex justify-between items-end">
                <div className="text-center w-64 border-t-2 border-black pt-1">
                    <p className="font-black text-sm">অভিভাবকের স্বাক্ষর ও তারিখ</p>
                </div>
                <div className="text-center italic text-[10px]">
                    <p>আবেদনের তারিখ: {today}</p>
                    <p>Birganj Pouro High School Portal</p>
                </div>
                <div className="text-center w-64 border-t-2 border-black pt-1">
                    <p className="font-black text-sm">অফিসের স্বাক্ষর ও সিল</p>
                </div>
            </footer>
        </div>
    );
}