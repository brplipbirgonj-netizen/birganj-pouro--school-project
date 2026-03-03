'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, FileUp, Download } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { addStudent, updateStudent, NewStudentData } from '@/lib/student-data';
import { getSubjects, Subject } from '@/lib/subjects';
import { Checkbox } from '@/components/ui/checkbox';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePicker } from '@/components/ui/date-picker';

const initialStudentState: NewStudentData = {
  roll: undefined,
  className: '',
  academicYear: '',
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

export default function AddStudentPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { selectedYear, availableYears } = useAcademicYear();
    const db = useFirestore();
    
    const [student, setStudent] = useState<NewStudentData>(initialStudentState);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [optionalSubjects, setOptionalSubjects] = useState<Subject[]>([]);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (selectedYear) {
            setStudent(prev => ({...prev, academicYear: selectedYear}));
        }
    }, [selectedYear]);

    useEffect(() => {
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
    }, [student.className, student.group]);


    const handleInputChange = (field: keyof NewStudentData, value: string | number | Date | undefined) => {
        setStudent(prev => ({...prev, [field]: value}));
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

        if (!student.photoUrl) {
            toast({
                variant: "destructive",
                title: "ছবি আবশ্যক",
            });
            return;
        }

        if (!student.academicYear) {
            toast({
                variant: "destructive",
                title: "শিক্ষাবর্ষ আবশ্যক",
            });
            return;
        }

        if (!student.className) {
            toast({
                variant: "destructive",
                title: "শ্রেণি আবশ্যক",
            });
            return;
        }
        
        addStudent(db, student).then(() => {
            toast({
                title: "শিক্ষার্থী যোগ হয়েছে",
            });
            router.push('/student-list');
        }).catch(() => {
            // FirebaseErrorListener will handle the toast.
        });
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
                permanentUpazila: '',
                permanentDistrict: '',
            }));
        }
    }

    const handleDownloadSample = () => {
        const baseHeaders = [
            'রোল', 'শ্রেণি', 'নাম (বাংলা)', 'নাম (ইংরেজি)', 'জন্ম তারিখ', 'জন্ম নিবন্ধন নম্বর', 'লিঙ্গ', 'ধর্ম', 'পিতার নাম (বাংলা)', 'পিতার নাম (ইংরেজি)', 'পিতার nid', 'মাতার নাম (বাংলা)', 'মাতার নাম (ইংরেজি)', 'মাতার nid', 'অভিভাবকের মোবাইল নম্বর', 'শিক্ষার্থীর মোবাইল নম্বর', 'বর্তমান গ্রাম', 'বর্তমান ইউনিয়ন', 'বর্তমান ডাকঘর', 'বর্তমান উপজেলা', 'বর্তমান জেলা', 'স্থায়ী গ্রাম', 'স্থায়ী ইউনিয়ন', 'স্থায়ী ডাকঘর', 'স্থায়ী উপজেলা', 'স্থায়ী জেলা'
        ];
        
        if (student.className === '9' || student.className === '10') {
            baseHeaders.splice(2, 0, 'গ্রুপ', 'ঐচ্ছিক বিষয়');
        }

        const headers = [baseHeaders];
        const ws = XLSX.utils.aoa_to_sheet(headers);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'student_sample.xlsx');
        XLSX.writeFile(wb, 'student_sample.xlsx');
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!db) return;
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                if (json.length === 0) {
                    toast({
                        variant: "destructive",
                        title: "ফাইল খালি",
                    });
                    return;
                }

                const headerMapping: { [key: string]: keyof NewStudentData } = {
                    'রোল': 'roll',
                    'roll': 'roll',
                    'শ্রেণি': 'className',
                    'শ্রেণী': 'className',
                    'class': 'className',
                    'গ্রুপ': 'group',
                    'group': 'group',
                    'শাখা': 'group',
                    'বিভাগ': 'group',
                    'ঐচ্ছিক বিষয়': 'optionalSubject',
                    'optional subject': 'optionalSubject',
                    'নাম (বাংলা)': 'studentNameBn',
                    'student name (bangla)': 'studentNameBn',
                    'name (bangla)': 'studentNameBn',
                    'নাম (ইংরেজি)': 'studentNameEn',
                    'student name (english)': 'studentNameEn',
                    'name (english)': 'studentNameEn',
                    'জন্ম তারিখ': 'dob',
                    'date of birth': 'dob',
                    'জন্ম নিবন্ধন নম্বর': 'birthRegNo',
                    'birth registration no': 'birthRegNo',
                    'লিঙ্গ': 'gender',
                    'gender': 'gender',
                    'ধর্ম': 'religion',
                    'religion': 'religion',
                    'পিতার নাম (বাংলা)': 'fatherNameBn',
                    "father's name (bangla)": 'fatherNameBn',
                    'পিতার নাম (ইংরেজি)': 'fatherNameEn',
                    "father's name (english)": 'fatherNameEn',
                    'পিতার nid': 'fatherNid',
                    'father nid': 'fatherNid',
                    'মাতার নাম (বাংলা)': 'motherNameBn',
                    "mother's name (bangla)": 'motherNameBn',
                    'মাতার নাম (ইংরেজি)': 'motherNameEn',
                    "mother's name (english)": 'motherNameEn',
                    'মাতার nid': 'motherNid',
                    'mother nid': 'motherNid',
                    'মোবাইল': 'guardianMobile',
                    'guardian mobile': 'guardianMobile',
                    'অভিভাবকের মোবাইল নম্বর': 'guardianMobile',
                    'শিক্ষার্থীর মোবাইল নম্বর': 'studentMobile',
                    'student mobile': 'studentMobile',
                    'বর্তমান গ্রাম': 'presentVillage',
                    'present village': 'presentVillage',
                    'বর্তমান ইউনিয়ন': 'presentUnion',
                    'present union': 'presentUnion',
                    'বর্তমান ডাকঘর': 'presentPostOffice',
                    'present post office': 'presentPostOffice',
                    'বর্তমান উপজেলা': 'presentUpazila',
                    'present upazila': 'presentUpazila',
                    'বর্তমান জেলা': 'presentDistrict',
                    'present district': 'presentDistrict',
                    'স্থায়ী গ্রাম': 'permanentVillage',
                    'permanent village': 'permanentVillage',
                    'স্থায়ী ইউনিয়ন': 'permanentUnion',
                    'permanent union': 'permanentUnion',
                    'স্থায়ী ডাকঘর': 'permanentPostOffice',
                    'permanent post office': 'permanentPostOffice',
                    'স্থায়ী উপজেলা': 'permanentUpazila',
                    'permanent upazila': 'permanentUpazila',
                    'স্থায়ী জেলা': 'permanentDistrict',
                    'permanent district': 'permanentDistrict',
                };
                
                const genderMap: { [key: string]: string } = { 'পুরুষ': 'male', 'male': 'male', 'মহিলা': 'female', 'female': 'female', 'অন্যান্য': 'other', 'other': 'other' };
                const religionMap: { [key: string]: string } = { 'ইসলাম': 'islam', 'islam': 'islam', 'হিন্দু': 'hinduism', 'hinduism': 'hinduism', 'বৌদ্ধ': 'buddhism', 'buddhism': 'buddhism', 'খ্রিস্টান': 'christianity', 'christianity': 'christianity', 'অন্যান্য': 'other', 'other': 'other' };
                const groupMap: { [key:string]: string } = { 
                    'বিজ্ঞান': 'science', 'science': 'science', 
                    'মানবিক': 'arts', 'arts': 'arts', 'humanities': 'arts',
                    'ব্যবসায় শিক্ষা': 'commerce', 'commerce': 'commerce', 'business studies': 'commerce', 'business': 'commerce'
                };
                const optionalSubjectMap: { [key: string]: string } = {
                    'উচ্চতর গণিত': 'উচ্চতর গণিত', 'higher math': 'উচ্চতর গণিত',
                    'কৃষি শিক্ষা': 'কৃষি শিক্ষা', 'agriculture': 'কৃষি শিক্ষা'
                };
                const bengaliToEnglishDigit: { [key: string]: string } = { '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4', '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9' };

                const convertToNumber = (value: any): number | undefined => {
                    if (value === undefined || value === null || String(value).trim() === '') return undefined;
                    let strValue = String(value).trim();
                    strValue = strValue.replace(/[০-৯]/g, d => bengaliToEnglishDigit[d]);
                    const num = parseInt(strValue, 10);
                    return isNaN(num) ? undefined : num;
                };
                
                const processRow = (row: any) => {
                    const newStudentData: any = {};
                    for (const excelHeader of Object.keys(row)) {
                        const studentKey = headerMapping[excelHeader.trim().toLowerCase()];
                        if (studentKey) {
                            let value = row[excelHeader];
                            if (value && typeof value === 'string') value = value.trim();

                            if (value === undefined || value === null || value === '') {
                                newStudentData[studentKey] = undefined;
                                continue;
                            }

                            const valueStr = String(value);
                            const valueStrLower = valueStr.toLowerCase();

                            if (studentKey === 'gender') newStudentData[studentKey] = genderMap[valueStr] || genderMap[valueStrLower] || 'other';
                            else if (studentKey === 'religion') newStudentData[studentKey] = religionMap[valueStr] || religionMap[valueStrLower] || 'other';
                            else if (studentKey === 'group') newStudentData[studentKey] = groupMap[valueStr] || groupMap[valueStrLower] || undefined;
                            else if (studentKey === 'optionalSubject') newStudentData[studentKey] = optionalSubjectMap[valueStr] || optionalSubjectMap[valueStrLower] || undefined;
                            else if (studentKey === 'dob') {
                                 let parsedDate: Date | undefined;
                                if (value instanceof Date && !isNaN(value.getTime())) parsedDate = value;
                                else if (typeof value === 'number' && value > 1) parsedDate = new Date((value - 25569) * 86400 * 1000);
                                else if (typeof value === 'string') {
                                     const date = new Date(value);
                                    if (date && !isNaN(date.getTime())) parsedDate = date;
                                }
                                newStudentData.dob = parsedDate;
                            } else if (studentKey === 'roll') newStudentData.roll = convertToNumber(value);
                            else if (studentKey === 'className') newStudentData.className = String(value).replace(/[০-৯]/g, d => bengaliToEnglishDigit[d]);
                            else newStudentData[studentKey] = value;
                        }
                    }
                    return newStudentData;
                }

                const studentsQuery = query(collection(db, "students"), where("academicYear", "==", selectedYear));
                const querySnapshot = await getDocs(studentsQuery);
                const allStudents = querySnapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));

                let addedCount = 0;
                let updatedCount = 0;
                const processingErrors: string[] = [];
                const promises: Promise<any>[] = [];

                for (const [index, row] of json.entries()) {
                    try {
                        const newStudentData = processRow(row);
                        newStudentData.academicYear = selectedYear;

                        const requiredFields: (keyof NewStudentData)[] = ['roll', 'className', 'studentNameBn', 'fatherNameBn', 'motherNameBn', 'academicYear'];
                        const missingFields = requiredFields.filter(field => newStudentData[field] === undefined || newStudentData[field] === null || newStudentData[field] === '');

                        if (missingFields.length > 0) {
                            throw new Error(`সারি ${index + 2}: আবশ্যকীয় তথ্য অনুপস্থিত: ${missingFields.join(', ')}`);
                        }
                        
                        const existingStudent = allStudents.find(
                            s => s.roll === newStudentData.roll &&
                                 s.className === newStudentData.className &&
                                 s.academicYear === newStudentData.academicYear
                        );

                        if (existingStudent) {
                            promises.push(updateStudent(db, existingStudent.id, newStudentData));
                            updatedCount++;
                        } else {
                            newStudentData.photoUrl = `https://picsum.photos/seed/${newStudentData.roll || Math.random()}/96/96`;
                            promises.push(addStudent(db, newStudentData as NewStudentData));
                            addedCount++;
                        }
                    } catch (rowError: any) {
                        processingErrors.push(rowError.message);
                    }
                }

                if (processingErrors.length > 0) throw new Error(processingErrors.join('\n'));
                
                await Promise.all(promises);

                toast({
                    title: "প্রসেসিং সম্পন্ন",
                    description: `${addedCount} জন নতুন শিক্ষার্থী যোগ হয়েছে এবং ${updatedCount} জনের তথ্য আপডেট হয়েছে।`,
                });

                router.push('/student-list');

            } catch (error: any) {
                if (!error.source || error.source !== 'firestore') {
                    console.error("File upload error:", error);
                    toast({
                        variant: "destructive",
                        title: "ফাইল আপলোড ব্যর্থ হয়েছে",
                        description: error.message || "দয়া করে ফাইলের ফরম্যাট এবং আবশ্যকীয় তথ্য ঠিক আছে কিনা তা পরীক্ষা করুন।",
                        duration: 10000,
                    });
                }
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

  return (
    <div className="flex min-h-screen w-full flex-col bg-emerald-100">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-24">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
                <div>
                    <CardTitle>নতুন শিক্ষার্থী যোগ করুন</CardTitle>
                </div>
                <div className="flex items-center flex-wrap gap-2 justify-start sm:justify-end">
                    <Button variant="outline" onClick={handleDownloadSample}>
                        <Download className="mr-2 h-4 w-4" />
                        নমুনা ফাইল
                    </Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                        <FileUp className="mr-2 h-4 w-4" />
                        Excel ফাইল আপলোড
                    </Button>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
                </div>
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
                          <Input id="roll" name="roll" type="number" required value={student.roll || ''} onChange={e => handleInputChange('roll', e.target.value === '' ? undefined : parseInt(e.target.value, 10))} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="academic-year">শিক্ষাবর্ষ</Label>
                          <Select required value={student.academicYear || ''} onValueChange={value => handleInputChange('academicYear', value)}>
                              <SelectTrigger id="academic-year" name="academic-year">
                                  <SelectValue />
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
                                  <SelectValue />
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
                      {(student.className === '9' || student.className === '10') && (
                        <>
                          <div className="space-y-2">
                              <Label htmlFor="group">গ্রুপ</Label>
                              <Select value={student.group || ''} onValueChange={value => handleInputChange('group', value)}>
                                  <SelectTrigger id="group" name="group">
                                      <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="science">বিজ্ঞান</SelectItem>
                                      <SelectItem value="arts">মানবিক</SelectItem>
                                      <SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                          <div className="space-y-2">
                              <Label htmlFor="optional-subject">ঐচ্ছিক বিষয়</Label>
                              <Select value={student.optionalSubject || ''} onValueChange={value => handleInputChange('optionalSubject', value)} disabled={optionalSubjects.length === 0}>
                                  <SelectTrigger id="optional-subject" name="optional-subject">
                                      <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                      {optionalSubjects.map(sub => (
                                          <SelectItem key={sub.name} value={sub.name}>{sub.name}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                          </div>
                        </>
                      )}
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">শিক্ষার্থীর তথ্য</h3>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      <div className="space-y-2">
                          <Label htmlFor="student-name-bn">নাম (বাংলা)</Label>
                          <Input id="student-name-bn" name="student-name-bn" required value={student.studentNameBn} onChange={e => handleInputChange('studentNameBn', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="student-name-en">নাম (ইংরেজি)</Label>
                          <Input id="student-name-en" name="student-name-en" value={student.studentNameEn} onChange={e => handleInputChange('studentNameEn', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="dob">জন্ম তারিখ</Label>
                          <DatePicker value={student.dob} onChange={date => handleInputChange('dob', date)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="birth-reg-no">জন্ম নিবন্ধন নম্বর</Label>
                          <Input id="birth-reg-no" name="birth-reg-no" value={student.birthRegNo} onChange={e => handleInputChange('birthRegNo', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="gender">লিঙ্গ</Label>
                          <Select value={student.gender || ''} onValueChange={value => handleInputChange('gender', value)}>
                              <SelectTrigger id="gender" name="gender"><SelectValue /></SelectTrigger>
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
                              <SelectTrigger id="religion" name="religion"><SelectValue /></SelectTrigger>
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
                                  ছবি আপলোড করুন
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
                          <Input id="father-name-bn" name="father-name-bn" required value={student.fatherNameBn} onChange={e => handleInputChange('fatherNameBn', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="father-name-en">পিতার নাম (ইংরেজি)</Label>
                          <Input id="father-name-en" name="father-name-en" value={student.fatherNameEn} onChange={e => handleInputChange('fatherNameEn', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="father-nid">পিতার NID</Label>
                            <Input id="father-nid" name="father-nid" value={student.fatherNid} onChange={e => handleInputChange('fatherNid', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mother-name-bn">মাতার নাম (বাংলা)</Label>
                          <Input id="mother-name-bn" name="mother-name-bn" required value={student.motherNameBn} onChange={e => handleInputChange('motherNameBn', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mother-name-en">মাতার নাম (ইংরেজি)</Label>
                          <Input id="mother-name-en" name="mother-name-en" value={student.motherNameEn} onChange={e => handleInputChange('motherNameEn', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="mother-nid">মাতার NID</Label>
                            <Input id="mother-nid" name="mother-nid" value={student.motherNid} onChange={e => handleInputChange('motherNid', e.target.value)} />
                        </div>
                   </div>
              </div>

               <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">যোগাযোগের তথ্য</h3>
                   <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                          <Label htmlFor="guardian-mobile">অভিভাবকের মোবাইল নম্বর</Label>
                          <Input id="guardian-mobile" name="guardian-mobile" value={student.guardianMobile} onChange={e => handleInputChange('guardianMobile', e.target.value)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="student-mobile">শিক্ষার্থীর মোবাইল নম্বর</Label>
                          <Input id="student-mobile" name="student-mobile" value={student.studentMobile} onChange={e => handleInputChange('studentMobile', e.target.value)} />
                      </div>
                   </div>
               </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">বর্তমান ঠিকানা</h3>
                   <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="present-village">গ্রাম/মহল্লা</Label>
                            <Input id="present-village" name="present-village" value={student.presentVillage} onChange={e => handleInputChange('presentVillage', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="present-union">ইউনিয়ন/ওয়ার্ড</Label>
                            <Input id="present-union" name="present-union" value={student.presentUnion} onChange={e => handleInputChange('presentUnion', e.target.value)} />
                        </div>
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="present-post-office">ডাকঘর</Label>
                                <Input id="present-post-office" name="present-post-office" value={student.presentPostOffice} onChange={e => handleInputChange('presentPostOffice', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="present-upazila">উপজেলা/থানা</Label>
                                <Input id="present-upazila" name="present-upazila" value={student.presentUpazila} onChange={e => handleInputChange('presentUpazila', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="present-district">জেলা</Label>
                                <Input id="present-district" name="present-district" value={student.presentDistrict} onChange={e => handleInputChange('presentDistrict', e.target.value)} />
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
                            <Input id="permanent-village" name="permanent-village" value={student.permanentVillage} onChange={e => handleInputChange('permanentVillage', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="permanent-union">ইউনিয়ন/ওয়ার্ড</Label>
                            <Input id="permanent-union" name="permanent-union" value={student.permanentUnion} onChange={e => handleInputChange('permanentUnion', e.target.value)} />
                        </div>
                         <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="permanent-post-office">ডাকঘর</Label>
                                <Input id="permanent-post-office" name="permanent-post-office" value={student.permanentPostOffice} onChange={e => handleInputChange('permanentPostOffice', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="permanent-upazila">উপজেলা/থানা</Label>
                                <Input id="permanent-upazila" name="permanent-upazila" value={student.permanentUpazila} onChange={e => handleInputChange('permanentUpazila', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="permanent-district">জেলা</Label>
                                <Input id="permanent-district" name="permanent-district" value={student.permanentDistrict} onChange={e => handleInputChange('permanentDistrict', e.target.value)} />
                            </div>
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
                            <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10" /></div>
                            <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10" /></div>
                            <div className="space-y-2"><Skeleton className="h-5 w-20" /><Skeleton className="h-10" /></div>
                        </div>
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
