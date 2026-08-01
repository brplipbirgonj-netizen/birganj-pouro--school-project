'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, ArrowRight, ArrowLeft, CheckCircle2, User, Users, Home, GraduationCap, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { saveAdmissionApplication, NewAdmissionData } from '@/lib/admission-data';
import { useFirestore } from '@/firebase';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { DatePicker } from '@/components/ui/date-picker';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

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
  presentVillage: '',
  presentUnion: '',
  presentPostOffice: '',
  presentUpazila: '',
  presentDistrict: '',
  permanentVillage: '',
  permanentUnion: '',
  permanentPostOffice: '',
  permanentUpazila: '',
  permanentDistrict: '',
};

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

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const handleInputChange = (field: keyof NewAdmissionData, value: string | Date | undefined) => {
        setStudent(prev => ({...prev, [field]: value}));
    };

    const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            setPhotoPreview(dataUrl);
            handleInputChange('photoUrl', dataUrl);
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!db) return;

        if (!student.photoUrl) {
            toast({ variant: "destructive", title: "ছবি আবশ্যক" });
            setCurrentStep(2);
            return;
        }

        setIsLoading(true);
        try {
            await saveAdmissionApplication(db, student);
            setIsSuccess(true);
            toast({ title: "আবেদন জমা হয়েছে", description: "আমরা শীঘ্রই আপনার সাথে যোগাযোগ করব।" });
        } catch (error) {
            toast({ variant: "destructive", title: "ত্রুটি", description: "আবেদন জমা দেওয়া যায়নি।" });
        } finally {
            setIsLoading(false);
        }
    };

    if (!isMounted) {
        return (
            <div className="min-h-screen bg-indigo-50 flex items-center justify-center font-kalpurush">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-kalpurush">
                <Card className="max-w-md w-full text-center p-8 border-2 border-emerald-500 shadow-2xl">
                    <div className="flex justify-center mb-6">
                        <div className="bg-emerald-100 p-4 rounded-full">
                            <CheckCircle2 className="h-16 w-16 text-emerald-600 animate-bounce" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-black text-emerald-900 mb-2">সফল হয়েছে!</CardTitle>
                    <CardDescription className="text-lg font-bold">আপনার অনলাইন ভর্তির আবেদনটি আমাদের কাছে পৌঁছেছে।</CardDescription>
                    <div className="mt-8 space-y-4">
                        <p className="text-sm text-muted-foreground">বিদ্যালয় কর্তৃপক্ষ আপনার তথ্য যাচাই করে দ্রুত মোবাইল নম্বরে যোগাযোগ করবে।</p>
                        <Button className="w-full h-12 text-lg font-black" onClick={() => router.push('/')}>হোমে ফিরে যান</Button>
                    </div>
                </Card>
            </div>
        );
    }

    const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, 4));
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  return (
    <div className="min-h-screen bg-indigo-50 font-kalpurush pb-20">
      <header className="bg-primary p-6 text-white text-center shadow-lg border-b-4 border-black/10">
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
              {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" width={60} height={60} className="rounded-full bg-white p-1" />}
              <h1 className="text-2xl sm:text-3xl font-black">{schoolInfo.name}</h1>
              <p className="text-sm font-bold opacity-90">অনলাইন ভর্তি আবেদন পোর্টাল</p>
          </div>
      </header>

      <main className="max-w-4xl mx-auto mt-8 p-4">
        <Card className="shadow-2xl border-none overflow-hidden rounded-2xl">
            <div className="bg-primary/5 p-6 border-b">
                <Progress value={(currentStep / 4) * 100} className="h-2" />
                <div className="flex justify-between mt-4">
                    {[1, 2, 3, 4].map(step => (
                        <div key={step} className={cn(
                            "h-10 w-10 rounded-full flex items-center justify-center border-2 font-black transition-all",
                            currentStep >= step ? "bg-primary border-primary text-white scale-110" : "bg-white border-muted text-muted-foreground"
                        )}>
                            {step}
                        </div>
                    ))}
                </div>
            </div>

            <CardContent className="p-6 sm:p-10">
                <form onSubmit={handleSubmit} className="space-y-8">
                    {currentStep === 1 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-xl font-black flex items-center gap-2 text-primary border-b pb-2"><GraduationCap className="h-6 w-6" /> ১. প্রাতিষ্ঠানিক তথ্য</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="font-bold">ভর্তির শ্রেণি</Label>
                                    <Select value={student.className} onValueChange={v => handleInputChange('className', v)}>
                                        <SelectTrigger className="h-12"><SelectValue placeholder="শ্রেণি নির্বাচন করুন" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="6">৬ষ্ঠ</SelectItem>
                                            <SelectItem value="7">৭ম</SelectItem>
                                            <SelectItem value="8">৮ম</SelectItem>
                                            <SelectItem value="9">৯ম</SelectItem>
                                            <SelectItem value="10">১০ম</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">শিক্ষাবর্ষ</Label>
                                    <Input value={student.academicYear} disabled className="h-12 bg-muted font-bold" />
                                </div>
                                {(student.className === '9' || student.className === '10') && (
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
                                )}
                            </div>
                            <Button type="button" onClick={nextStep} className="w-full h-12 text-lg font-black mt-6">পরবর্তী ধাপ <ArrowRight className="ml-2 h-5 w-5" /></Button>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-xl font-black flex items-center gap-2 text-primary border-b pb-2"><User className="h-6 w-6" /> ২. শিক্ষার্থীর ব্যক্তিগত তথ্য</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="font-bold">নাম (বাংলা)</Label>
                                    <Input className="h-12" value={student.studentNameBn} onChange={e => handleInputChange('studentNameBn', e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">নাম (ইংরেজি)</Label>
                                    <Input className="h-12" value={student.studentNameEn} onChange={e => handleInputChange('studentNameEn', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">জন্ম তারিখ</Label>
                                    <DatePicker value={student.dob} onChange={d => handleInputChange('dob', d)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">লিঙ্গ</Label>
                                    <Select value={student.gender} onValueChange={v => handleInputChange('gender', v)}>
                                        <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="male">পুরুষ</SelectItem>
                                            <SelectItem value="female">মহিলা</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="sm:col-span-2 space-y-2">
                                    <Label className="font-bold">ছবি</Label>
                                    <div className="flex items-center gap-4 border p-4 rounded-lg bg-slate-50">
                                        <div className="h-20 w-20 rounded border bg-white flex items-center justify-center overflow-hidden">
                                            {photoPreview ? <Image src={photoPreview} alt="Preview" width={80} height={80} className="object-cover h-full" /> : <Upload className="text-muted-foreground" />}
                                        </div>
                                        <Input type="file" accept="image/*" onChange={handlePhotoChange} className="cursor-pointer" />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4 mt-6">
                                <Button type="button" variant="outline" onClick={prevStep} className="h-12 flex-1 font-black"><ArrowLeft className="mr-2 h-5 w-5" /> ব্যাকে যান</Button>
                                <Button type="button" onClick={nextStep} className="h-12 flex-1 font-black">পরবর্তী ধাপ <ArrowRight className="ml-2 h-5 w-5" /></Button>
                            </div>
                        </div>
                    )}

                    {currentStep === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-xl font-black flex items-center gap-2 text-primary border-b pb-2"><Users className="h-6 w-6" /> ৩. অভিভাবকের তথ্য</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="font-bold">পিতার নাম (বাংলা)</Label>
                                    <Input className="h-12" value={student.fatherNameBn} onChange={e => handleInputChange('fatherNameBn', e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">মাতার নাম (বাংলা)</Label>
                                    <Input className="h-12" value={student.motherNameBn} onChange={e => handleInputChange('motherNameBn', e.target.value)} required />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">অভিভাবকের মোবাইল নম্বর</Label>
                                    <Input className="h-12" type="tel" value={student.guardianMobile} onChange={e => handleInputChange('guardianMobile', e.target.value)} required />
                                </div>
                            </div>
                            <div className="flex gap-4 mt-6">
                                <Button type="button" variant="outline" onClick={prevStep} className="h-12 flex-1 font-black"><ArrowLeft className="mr-2 h-5 w-5" /> ব্যাকে যান</Button>
                                <Button type="button" onClick={nextStep} className="h-12 flex-1 font-black">পরবর্তী ধাপ <ArrowRight className="ml-2 h-5 w-5" /></Button>
                            </div>
                        </div>
                    )}

                    {currentStep === 4 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h3 className="text-xl font-black flex items-center gap-2 text-primary border-b pb-2"><Home className="h-6 w-6" /> ৪. ঠিকানা ও নিশ্চিতকরণ</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="font-bold">গ্রাম/মহল্লা</Label>
                                    <Input className="h-12" value={student.presentVillage} onChange={e => handleInputChange('presentVillage', e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">উপজেলা</Label>
                                    <Input className="h-12" value={student.presentUpazila} onChange={e => handleInputChange('presentUpazila', e.target.value)} />
                                </div>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-100 flex items-start gap-3 mt-6">
                                <Checkbox id="confirm" required className="mt-1" />
                                <Label htmlFor="confirm" className="text-sm font-bold leading-relaxed">আমি ঘোষণা করছি যে, উপরে দেওয়া সকল তথ্য সঠিক। কোনো তথ্য ভুল প্রমাণিত হলে আমার আবেদন বাতিল করার ক্ষমতা কর্তৃপক্ষের থাকবে।</Label>
                            </div>
                            <div className="flex gap-4 mt-8">
                                <Button type="button" variant="outline" onClick={prevStep} className="h-12 flex-1 font-black"><ArrowLeft className="mr-2 h-5 w-5" /> ব্যাকে যান</Button>
                                <Button type="submit" disabled={isLoading} className="h-12 flex-1 font-black shadow-xl">
                                    {isLoading ? <Loader2 className="animate-spin" /> : 'আবেদন জমা দিন'}
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
