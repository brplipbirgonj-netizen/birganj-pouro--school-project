'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"
import { addStaff, NewStaffData } from '@/lib/staff-data';
import { useFirestore } from '@/firebase';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { Skeleton } from '@/components/ui/skeleton';

const initialStaffState: Omit<NewStaffData, 'employeeId'> = {
  nameBn: '',
  nameEn: '',
  fatherNameBn: '',
  motherNameBn: '',
  dob: undefined,
  designation: '',
  subject: '',
  mobile: '',
  email: '',
  joinDate: new Date(),
  education: '',
  address: '',
  photoUrl: '',
  isActive: true,
  staffType: 'teacher',
};

export default function AddStaffPage() {
    const router = useRouter();
    const { toast } = useToast();
    const db = useFirestore();
    
    const [staff, setStaff] = useState<NewStaffData>(initialStaffState);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const handleInputChange = (field: keyof NewStaffData, value: string | Date | boolean | undefined) => {
        setStaff(prev => ({...prev, [field]: value}));
    };

    const handleDesignationChange = (designation: string) => {
        const teacherDesignations = ['প্রধান শিক্ষক', 'প্রধান শিক্ষক (ভারপ্রাপ্ত)', 'সহকারী শিক্ষক'];
        const staffType = teacherDesignations.includes(designation) ? 'teacher' : 'staff';
        setStaff(prev => ({
            ...prev,
            designation: designation,
            staffType: staffType as 'teacher' | 'staff',
        }));
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
        if(!db) return;

        if (!staff.photoUrl) {
            toast({
                variant: "destructive",
                title: "ছবি আবশ্যক",
            });
            return;
        }
        
        addStaff(db, staff).then(() => {
            toast({
                title: "রেকর্ড যোগ হয়েছে",
            });
            router.push('/staff');
        }).catch(() => {
            // FirebaseErrorListener will handle the toast.
        });
    };

  return (
    <div className="flex min-h-screen w-full flex-col bg-orange-100">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-40">
        <Card>
          <CardHeader>
            <CardTitle>নতুন শিক্ষক/কর্মচারী যোগ করুন</CardTitle>
          </CardHeader>
          <CardContent>
            {isClient ? (
              <form className="space-y-8" onSubmit={handleSubmit}>
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2">সাধারণ তথ্য</h3>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        <div className="space-y-2">
                            <Label htmlFor="nameBn">নাম (বাংলা)</Label>
                            <Input id="nameBn" name="nameBn" required value={staff.nameBn} onChange={e => handleInputChange('nameBn', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nameEn">নাম (ইংরেজি)</Label>
                            <Input id="nameEn" name="nameEn" value={staff.nameEn || ''} onChange={e => handleInputChange('nameEn', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fatherNameBn">পিতার নাম</Label>
                            <Input id="fatherNameBn" name="fatherNameBn" value={staff.fatherNameBn || ''} onChange={e => handleInputChange('fatherNameBn', e.target.value)} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="motherNameBn">মাতার নাম</Label>
                            <Input id="motherNameBn" name="motherNameBn" value={staff.motherNameBn || ''} onChange={e => handleInputChange('motherNameBn', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="dob">জন্ম তারিখ</Label>
                            <DatePicker value={staff.dob} onChange={date => handleInputChange('dob', date)} placeholder="জন্ম তারিখ" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="designation">পদবি</Label>
                            <Select required value={staff.designation} onValueChange={handleDesignationChange}>
                                <SelectTrigger id="designation" name="designation"><SelectValue placeholder="পদবি নির্বাচন করুন" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="প্রধান শিক্ষক">প্রধান শিক্ষক</SelectItem>
                                    <SelectItem value="প্রধান শিক্ষক (ভারপ্রাপ্ত)">প্রধান শিক্ষক (ভারপ্রাপ্ত)</SelectItem>
                                    <SelectItem value="সহকারী শিক্ষক">সহকারী শিক্ষক</SelectItem>
                                    <SelectItem value="অফিস সহকারী">অফিস সহকারী</SelectItem>
                                    <SelectItem value="অফিস সহায়ক">অফিস সহায়ক</SelectItem>
                                    <SelectItem value="আয়া">আয়া</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="subject">বিষয়</Label>
                            <Input id="subject" name="subject" value={staff.subject} onChange={e => handleInputChange('subject', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="joinDate">যোগদানের তারিখ</Label>
                            <DatePicker value={staff.joinDate} onChange={date => handleInputChange('joinDate', date)} placeholder="যোগদানের তারিখ" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="education">শিক্ষাগত যোগ্যতা</Label>
                            <Input id="education" name="education" value={staff.education} onChange={e => handleInputChange('education', e.target.value)} />
                        </div>
                        <div className="flex items-center space-x-2">
                              <Switch id="isActive" checked={staff.isActive} onCheckedChange={checked => handleInputChange('isActive', checked)} />
                              <Label htmlFor="isActive">সক্রিয়</Label>
                          </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2">যোগাযোগ ও অন্যান্য</h3>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="mobile">মোবাইল</Label>
                            <Input id="mobile" name="mobile" required value={staff.mobile} onChange={e => handleInputChange('mobile', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">ইমেইল</Label>
                            <Input id="email" name="email" type="email" value={staff.email} onChange={e => handleInputChange('email', e.target.value)} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="address">ঠিকানা</Label>
                            <Textarea id="address" name="address" value={staff.address} onChange={e => handleInputChange('address', e.target.value)} />
                        </div>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <h3 className="font-semibold text-lg border-b pb-2">ছবি</h3>
                      <div className="space-y-2">
                          <div className="flex items-center gap-4">
                              <div className="w-24 h-24 rounded-md border flex items-center justify-center bg-muted overflow-hidden">
                                  {photoPreview ? (
                                      <Image src={photoPreview} alt="Staff photo" width={96} height={96} className="object-cover w-full h-full" />
                                  ) : (
                                      <div className="flex flex-col items-center gap-1 text-center text-muted-foreground">
                                          <Upload className="h-8 w-8" />
                                          <span>ছবি</span>
                                      </div>
                                  )}
                              </div>
                              <Input id="photo" name="photo" type="file" className="hidden" onChange={handlePhotoChange} accept="image/*" />
                              <Button type="button" variant="outline" onClick={() => document.getElementById('photo')?.click()}>
                                  ছবি আপলোড করুন
                              </Button>
                          </div>
                      </div>
                </div>

                <div className="flex justify-end pt-4 border-t mt-4">
                  <Button type="submit">সেভ করুন</Button>
                </div>
              </form>
            ) : (
              <div className="space-y-8">
                <div className="space-y-4">
                    <Skeleton className="h-7 w-48" />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        {[...Array(12)].map((_, i) => (
                          <div key={i} className="space-y-2">
                            <Skeleton className="h-5 w-20" />
                            <Skeleton className="h-10 w-full" />
                          </div>
                        ))}
                    </div>
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-7 w-48" />
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                          <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                          <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10 w-full" /></div>
                          <div className="space-y-2 md:col-span-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-20 w-full" /></div>
                    </div>
                </div>
                <div className="space-y-4">
                    <Skeleton className="h-7 w-24" />
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-24 w-24 rounded-md" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                </div>
                <div className="flex justify-end pt-4 border-t mt-4">
                    <Skeleton className="h-10 w-24" />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
