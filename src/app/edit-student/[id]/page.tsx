'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileUp } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { getStudentById, updateStudent, deleteStudent, Student } from '@/lib/student-data';
import { getSubjects, Subject } from '@/lib/subjects';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';

export default function EditStudentPage() {
    const router = useRouter();
    const params = useParams();
    const { toast } = useToast();
    const { availableYears } = useAcademicYear();
    const db = useFirestore();
    
    const studentId = params.id as string;

    const [student, setStudent] = useState<Student | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [optionalSubjects, setOptionalSubjects] = useState<Subject[]>([]);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!studentId || !db) return;

        const fetchStudent = async () => {
            setIsLoading(true);
            const studentData = await getStudentById(db, studentId);
            if (studentData) {
                setStudent(studentData);
                setPhotoPreview(studentData.photoUrl);
            } else {
                toast({
                    variant: "destructive",
                    title: "ছাত্র পাওয়া যায়নি",
                });
                router.push('/student-list');
            }
            setIsLoading(false);
        }
        fetchStudent();
    }, [studentId, router, toast, db]);

     useEffect(() => {
        if (!student) return;

        const studentClassName = student.className;
        const studentGroup = student.group;

        if (studentClassName === '9' || studentClassName === '10') {
            const allSubjects = getSubjects(studentClassName, studentGroup);
            const opts = allSubjects.filter(s => 
                (studentGroup === 'science' && (s.name === 'উচ্চতর গণিত' || s.name === 'কৃষি শিক্ষা')) ||
                (studentGroup === 'arts' && s.name === 'কৃষি শিক্ষা') ||
                (studentGroup === 'commerce' && s.name === 'কৃষি শিক্ষা')
            );
            setOptionalSubjects(opts);
        } else {
            setOptionalSubjects([]);
            handleInputChange('optionalSubject', '');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [student?.className, student?.group]);

    const handleInputChange = (field: keyof Student, value: any) => {
        if (!student) return;

        let processedValue = value;
        if (field === 'roll' && value !== '') {
            processedValue = parseInt(value, 10) || 0;
        }
        
        setStudent({ ...student, [field]: processedValue });
    };

    const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast({
                variant: "destructive",
                title: "ফাইল ತುಂಬಾ বড়",
                description: "অনুগ্রহ করে ৫ মেগাবাইটের কম আকারের ছবি আপলোড করুন।",
            });
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new window.Image();
            img.src = e.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 512;
                const MAX_HEIGHT = 512;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height = Math.round(height * (MAX_WIDTH / width));
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width = Math.round(width * (MAX_HEIGHT / height));
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                    setPhotoPreview(dataUrl);
                    handleInputChange('photoUrl', dataUrl);
                } else {
                    setPhotoPreview(e.target?.result as string);
                    handleInputChange('photoUrl', e.target?.result as string);
                }
            };
            img.onerror = () => {
                toast({
                    variant: "destructive",
                    title: "ছবি প্রসেস করা যায়নি",
                });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        
        if (!student || !db) {
            toast({
                variant: "destructive",
                title: "ত্রুটি",
            });
            return;
        }

        if (!student.photoUrl) {
            toast({
                variant: "destructive",
                title: "ছবি আবশ্যক",
            });
            return;
        }

        const { id, ...updatedData } = student;
        
        updateStudent(db, studentId, updatedData).then(() => {
            toast({
                title: "তথ্য আপডেট হয়েছে",
            });
            router.push('/student-list');
        }).catch(() => {
            // Error handled by FirebaseErrorListener
        });
    };

    const handleDelete = () => {
        if (!db) return;
        deleteStudent(db, studentId).then(() => {
            toast({
                title: "ছাত্র ডিলিট করা হয়েছে",
            });
            router.push('/student-list');
        }).catch(() => {
            // Error handled by FirebaseErrorListener
        });
    }
    
    const handleSameAddress = (checked: boolean | string) => {
        if (!student) return;
        if (checked) {
            setStudent(prev => ({
                ...prev!,
                permanentVillage: prev!.presentVillage,
                permanentUnion: prev!.presentUnion,
                permanentPostOffice: prev!.presentPostOffice,
                permanentUpazila: prev!.presentUpazila,
                permanentDistrict: prev!.presentDistrict,
            }));
        } else {
             setStudent(prev => ({
                ...prev!,
                permanentVillage: '',
                permanentUnion: '',
                permanentPostOffice: '',
                permanentUpazila: '',
                permanentDistrict: '',
            }));
        }
    }

  if (isLoading || !student) {
    return (
        <div className="flex min-h-screen w-full flex-col bg-rose-100 items-center justify-center">
            <p>লোড হচ্ছে...</p>
        </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-rose-100">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-24">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
                <div>
                    <CardTitle>শিক্ষার্থীর তথ্য এডিট করুন</CardTitle>
                </div>
                 <Button variant="outline" disabled>
                    <FileUp className="mr-2 h-4 w-4" />
                    Excel ফাইল আপলোড
                </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isClient ? (
            <form className="space-y-8" onSubmit={handleSubmit}>
              
              <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">প্রাতিষ্ঠানিক তথ্য</h3>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                      <div className="space-y-2">
                          <Label htmlFor="roll">রোল</Label>
                          <Input id="roll" name="roll" type="number" required value={student.roll || ''} onChange={e => handleInputChange('roll', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="generatedId">শিক্ষার্থী আইডি</Label>
                          <Input id="generatedId" name="generatedId" value={student.generatedId || 'সংরক্ষণ করার পর তৈরি হবে'} disabled />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="academic-year">শিক্ষাবর্ষ</Label>
                          <Select required value={student.academicYear || ''} onValueChange={value => handleInputChange('academicYear', value)}>
                              <SelectTrigger id="academic-year" name="academic-year">
                                  <SelectValue placeholder="শিক্ষাবর্ষ" />
                              </SelectTrigger>
                              <SelectContent>
                                  {availableYears.map(year => (
                                      <SelectItem key={year} value={String(year)}>{String(year).toLocaleString('bn-BD')}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="class">শ্রেণি</Label>
                          <Select required value={student.className} onValueChange={value => handleInputChange('className', value)}>
                              <SelectTrigger id="class" name="class">
                                  <SelectValue placeholder="শ্রেণি" />
                              </SelectTrigger>
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
                          <Label htmlFor="group">গ্রুপ</Label>
                          <Select value={student.group || ''} onValueChange={value => handleInputChange('group', value)}>
                              <SelectTrigger id="group" name="group">
                                  <SelectValue placeholder="গ্রুপ" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="science">বিজ্ঞান</SelectItem>
                                  <SelectItem value="arts">মানবিক</SelectItem>
                                  <SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      {(student.className === '9' || student.className === '10') && (
                          <div className="space-y-2">
                              <Label htmlFor="optional-subject">ঐচ্ছিক বিষয়</Label>
                              <Select value={student.optionalSubject || ''} onValueChange={value => handleInputChange('optionalSubject', value)} disabled={optionalSubjects.length === 0}>
                                  <SelectTrigger id="optional-subject" name="optional-subject">
                                      <SelectValue placeholder="ঐচ্ছিক বিষয়" />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {optionalSubjects.map(sub => (
                                          <SelectItem key={sub.name} value={sub.name}>{sub.name}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                          </div>
                      )}
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">শিক্ষার্থীর তথ্য</h3>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      <div className="space-y-2">
                          <Label htmlFor="student-name-bn">নাম (বাংলা)</Label>
                          <Input id="student-name-bn" name="student-name-bn" required value={student.studentNameBn || ''} onChange={e => handleInputChange('studentNameBn', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="student-name-en">নাম (ইংরেজি)</Label>
                          <Input id="student-name-en" name="student-name-en" value={student.studentNameEn || ''} onChange={e => handleInputChange('studentNameEn', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="dob">জন্ম তারিখ</Label>
                          <DatePicker value={student.dob ? new Date(student.dob) : undefined} onChange={date => handleInputChange('dob', date)} placeholder="জন্ম তারিখ" />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="birth-reg-no">জন্ম নিবন্ধন নম্বর</Label>
                          <Input id="birth-reg-no" name="birth-reg-no" value={student.birthRegNo || ''} onChange={e => handleInputChange('birthRegNo', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="gender">লিঙ্গ</Label>
                          <Select value={student.gender || ''} onValueChange={value => handleInputChange('gender', value)}>
                              <SelectTrigger id="gender" name="gender"><SelectValue placeholder="লিঙ্গ" /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="male">পুরুষ</SelectItem>
                                  <SelectItem value="female">মহিলা</SelectItem>
                                  <SelectItem value="other">অন্যান্য</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="religion">ধর্ম</Label>
                          <Select value={student.religion || ''} onValueChange={value => handleInputChange('religion', value)}>
                              <SelectTrigger id="religion" name="religion"><SelectValue placeholder="ধর্ম" /></SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="islam">ইসলাম</SelectItem>
                                  <SelectItem value="hinduism">হিন্দু</SelectItem>
                                  <SelectItem value="buddhism">বৌদ্ধ</SelectItem>
                                  <SelectItem value="christianity">খ্রিস্টান</SelectItem>
                                  <SelectItem value="other">অন্যান্য</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                       <div className="space-y-2 md:col-span-3">
                          <Label>ছবি</Label>
                          <div className="flex items-center gap-4">
                              <div className="w-24 h-24 rounded-md border flex items-center justify-center bg-muted overflow-hidden">
                                  {photoPreview ? (
                                      <Image src={photoPreview} alt="Student photo" width={96} height={96} className="object-cover w-full h-full" />
                                  ) : (
                                      <div className="flex flex-col items-center gap-1 text-center text-muted-foreground">
                                          <Upload className="h-8 w-8" />
                                          <span>ছবি</span>
                                      </div>
                                  )}
                              </div>
                              <Input id="photo" name="photo" type="file" className="hidden" onChange={handlePhotoChange} accept="image/*" />
                              <Button type="button" variant="outline" onClick={() => document.getElementById('photo')?.click()}>
                                  ছবি পরিবর্তন করুন
                              </Button>
                          </div>
                      </div>
                  </div>
              </div>
              
              <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">অভিভাবকের তথ্য</h3>
                   <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="father-name-bn">পিতার নাম (বাংলা)</Label>
                          <Input id="father-name-bn" name="father-name-bn" required value={student.fatherNameBn || ''} onChange={e => handleInputChange('fatherNameBn', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="father-name-en">পিতার নাম (ইংরেজি)</Label>
                          <Input id="father-name-en" name="father-name-en" value={student.fatherNameEn || ''} onChange={e => handleInputChange('fatherNameEn', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="father-nid">পিতার NID</Label>
                            <Input id="father-nid" name="father-nid" value={student.fatherNid || ''} onChange={e => handleInputChange('fatherNid', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mother-name-bn">মাতার নাম (বাংলা)</Label>
                          <Input id="mother-name-bn" name="mother-name-bn" required value={student.motherNameBn || ''} onChange={e => handleInputChange('motherNameBn', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mother-name-en">মাতার নাম (ইংরেজি)</Label>
                          <Input id="mother-name-en" name="mother-name-en" value={student.motherNameEn || ''} onChange={e => handleInputChange('motherNameEn', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mother-nid">মাতার NID</Label>
                            <Input id="mother-nid" name="mother-nid" value={student.motherNameNid || ''} onChange={e => handleInputChange('motherNid', e.target.value)} />
                        </div>
                   </div>
              </div>

               <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">যোগাযোগের তথ্য</h3>
                   <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                          <Label htmlFor="guardian-mobile">অভিভাবকের মোবাইল নম্বর</Label>
                          <Input id="guardian-mobile" name="guardian-mobile" value={student.guardianMobile || ''} onChange={e => handleInputChange('guardianMobile', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="student-mobile">শিক্ষার্থীর মোবাইল নম্বর</Label>
                          <Input id="student-mobile" name="student-mobile" value={student.studentMobile || ''} onChange={e => handleInputChange('studentMobile', e.target.value)} />
                      </div>
                   </div>
               </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">বর্তমান ঠিকানা</h3>
                   <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="present-village">গ্রাম/মহল্লা</Label>
                            <Input id="present-village" name="present-village" value={student.presentVillage || ''} onChange={e => handleInputChange('presentVillage', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="present-union">ইউনিয়ন/ওয়ার্ড</Label>
                            <Input id="present-union" name="present-union" value={student.presentUnion || ''} onChange={e => handleInputChange('presentUnion', e.target.value)} />
                        </div>
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="present-post-office">ডাকঘর</Label>
                                <Input id="present-post-office" name="present-post-office" value={student.presentPostOffice || ''} onChange={e => handleInputChange('presentPostOffice', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="present-upazila">উপজেলা/থানা</Label>
                                <Input id="present-upazila" name="present-upazila" value={student.presentUpazila || ''} onChange={e => handleInputChange('presentUpazila', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="present-district">জেলা</Label>
                                <Input id="present-district" name="present-district" value={student.presentDistrict || ''} onChange={e => handleInputChange('presentDistrict', e.target.value)} />
                            </div>
                        </div>
                   </div>
               </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                        <h3 className="font-semibold text-lg">স্থায়ী ঠিকানা</h3>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="same-as-present" onCheckedChange={handleSameAddress} />
                            <label
                                htmlFor="same-as-present"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                বর্তমান ঠিকানার অনুরূপ
                            </label>
                        </div>
                    </div>
                   <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="permanent-village">গ্রাম/মহল্লা</Label>
                            <Input id="permanent-village" name="permanent-village" value={student.permanentVillage || ''} onChange={e => handleInputChange('permanentVillage', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="permanent-union">ইউনিয়ন/ওয়ার্ড</Label>
                            <Input id="permanent-union" name="permanent-union" value={student.permanentUnion || ''} onChange={e => handleInputChange('permanentUnion', e.target.value)} />
                        </div>
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="permanent-post-office">ডাকঘর</Label>
                                <Input id="permanent-post-office" name="permanent-post-office" value={student.permanentPostOffice || ''} onChange={e => handleInputChange('permanentPostOffice', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="permanent-upazila">উপজেলা/থানা</Label>
                                <Input id="permanent-upazila" name="permanent-upazila" value={student.permanentUpazila || ''} onChange={e => handleInputChange('permanentUpazila', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="permanent-district">জেলা</Label>
                                <Input id="permanent-district" name="permanent-district" value={student.permanentDistrict || ''} onChange={e => handleInputChange('permanentDistrict', e.target.value)} />
                            </div>
                        </div>
                   </div>
               </div>


              <div className="md:col-span-2 flex justify-between items-center pt-4 border-t mt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button type="button" variant="destructive">ডিলিট</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                      <AlertDialogDescription>
                        এই কাজটি ফিরিয়ে আনা যাবে না। এটি তালিকা থেকে স্থায়ীভাবে শিক্ষার্থীকে মুছে ফেলবে।
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>বাতিল</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>ডিলিট করুন</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button type="submit">আপডেট করুন</Button>
              </div>
            </form>
            ) : (
             <div className="space-y-8">
                <div className="space-y-4">
                    <Skeleton className="h-7 w-48" />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                    </div>
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-7 w-48" />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2 md:col-span-3"><Skeleton className="h-5 w-20" /><div className="flex items-center gap-4"><Skeleton className="h-24 w-24 rounded-md" /><Skeleton className="h-10 w-32" /></div></div>
                    </div>
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-7 w-48" />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                    </div>
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-7 w-48" />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                    </div>
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-7 w-48" />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                            <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                            <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        </div>
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex justify-between items-center border-b pb-2">
                        <Skeleton className="h-7 w-48" />
                        <div className="flex items-center space-x-2">
                            <Skeleton className="h-4 w-4" />
                            <Skeleton className="h-4 w-32" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                            <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                            <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                        </div>
                    </div>
                </div>
                <div className="md:col-span-2 flex justify-between items-center pt-4 border-t mt-4">
                    <Skeleton className="h-10 w-24" />
                    <Skeleton className="h-10 w-28" />
                </div>
             </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
