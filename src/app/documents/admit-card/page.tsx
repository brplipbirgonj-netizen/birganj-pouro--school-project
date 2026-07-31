'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { Exam, getExams } from '@/lib/exam-data';
import { AdmitCard } from '@/components/AdmitCard';
import { Printer, Loader2, ArrowLeft, User, Users, Info, IdCard } from 'lucide-react';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';

const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

const AdmitCardGeneratorPage = () => {
    const db = useFirestore();
    const { schoolInfo } = useSchoolInfo();
    const { selectedYear } = useAcademicYear();

    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [mode, setMode] = useState<'bulk' | 'single'>('bulk');
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [isFetchingExams, setIsFetchingExams] = useState(true);

    useEffect(() => {
        if (!db) return;
        setIsFetchingExams(true);
        getExams(db, selectedYear).then(data => {
            setExams(data);
            if (data.length > 0) setSelectedExam(data[0]);
            setIsFetchingExams(false);
        }).catch(() => setIsFetchingExams(false));
    }, [db, selectedYear]);

    useEffect(() => {
        if (!db) return;
        const studentsQuery = query(collection(db, "students"), where("academicYear", "==", selectedYear));
        const unsubscribe = onSnapshot(studentsQuery, (querySnapshot) => {
            setAllStudents(querySnapshot.docs.map(studentFromDoc));
        }, (error) => {
            if (error.code !== 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'students', operation: 'list' }));
            }
        });
        return () => unsubscribe();
    }, [db, selectedYear]);

    const availableStudents = useMemo(() => {
        if (!selectedClass) return [];
        return allStudents
            .filter(s => s.className === selectedClass)
            .sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
    }, [allStudents, selectedClass]);

    const previewStudent = useMemo(() => {
        if (mode === 'single' && selectedStudentId) {
            return availableStudents.find(s => s.id === selectedStudentId) || null;
        }
        return availableStudents.length > 0 ? availableStudents[0] : null;
    }, [mode, selectedStudentId, availableStudents]);

    const bulkStudentsGrouped = useMemo(() => {
        const groups: Student[][] = [];
        for (let i = 0; i < availableStudents.length; i += 4) {
            groups.push(availableStudents.slice(i, i + 4));
        }
        return groups;
    }, [availableStudents]);

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
                            <h1 className="text-2xl font-black text-primary">প্রবেশ পত্র (Admit Card) জেনারেটর</h1>
                            <p className="text-sm text-muted-foreground">লাইভ প্রিভিউ দেখে প্রবেশপত্র তৈরি ও প্রিন্ট করুন</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        {/* Form Column */}
                        <Card className="shadow-lg border-2">
                            <CardHeader className="bg-primary/5 border-b">
                                <CardTitle className="text-lg">প্যারামিটার ও সিলেকশন</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="font-bold">১. পরীক্ষা নির্বাচন করুন</Label>
                                        <Select 
                                            disabled={isFetchingExams}
                                            value={selectedExam?.id || ""}
                                            onValueChange={(examId) => setSelectedExam(exams.find(e => e.id === examId) || null)}
                                        >
                                            <SelectTrigger className="bg-white"><SelectValue placeholder="পরীক্ষা নির্বাচন করুন" /></SelectTrigger>
                                            <SelectContent>
                                                {exams.map(exam => <SelectItem key={exam.id} value={exam.id}>{exam.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="font-bold">২. শ্রেণি নির্বাচন করুন</Label>
                                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                                            <SelectTrigger className="bg-white"><SelectValue placeholder="শ্রেণি নির্বাচন করুন" /></SelectTrigger>
                                            <SelectContent>
                                                {['6', '7', '8', '9', '10'].map(cls => <SelectItem key={cls} value={cls}>{classNamesMap[cls]} শ্রেণি</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="font-bold">৩. প্রিন্ট মোড</Label>
                                        <Tabs value={mode} onValueChange={(v: any) => setMode(v)}>
                                            <TabsList className="grid grid-cols-2 w-full">
                                                <TabsTrigger value="bulk" className="gap-2 font-bold"><Users className="h-4 w-4" /> শ্রেণিভিত্তিক</TabsTrigger>
                                                <TabsTrigger value="single" className="gap-2 font-bold"><User className="h-4 w-4" /> একক</TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>

                                    {mode === 'single' && (
                                        <div className="space-y-2 animate-in slide-in-from-top-2 duration-300">
                                            <Label className="font-bold">৪. নির্দিষ্ট শিক্ষার্থী</Label>
                                            <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={availableStudents.length === 0}>
                                                <SelectTrigger className="bg-white"><SelectValue placeholder="শিক্ষার্থী সিলেক্ট করুন" /></SelectTrigger>
                                                <SelectContent>
                                                    {availableStudents.map(s => <SelectItem key={s.id} value={s.id}>রোল {s.roll} - {s.studentNameBn}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6 border-t">
                                    <Button onClick={() => window.print()} className="w-full h-12 text-lg font-black shadow-lg" disabled={!selectedExam || !selectedClass || (mode === 'single' && !selectedStudentId)}>
                                        <Printer className="mr-2 h-5 w-5" /> প্রিন্ট করুন (A4)
                                    </Button>
                                    <p className="text-[10px] text-muted-foreground mt-4 italic text-center">
                                        * এক পাতায় ৪টি প্রবেশপত্র আসবে। ব্রাউজার থেকে 'Background Graphics' অন রাখুন।
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Preview Column */}
                        <div className="sticky top-24">
                            <h3 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-2">
                                <Info className="h-4 w-4" /> লাইভ প্রিভিউ (একটি নমুনা)
                            </h3>
                            <div className="flex justify-center bg-white p-8 border-4 border-black/10 rounded-xl shadow-2xl overflow-hidden min-h-[500px]">
                                {previewStudent && selectedExam ? (
                                    <div className="origin-top scale-[0.9] sm:scale-100 lg:scale-[1.1] xl:scale-125">
                                        <AdmitCard student={previewStudent} schoolInfo={schoolInfo} examName={selectedExam.name} />
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-muted-foreground gap-4">
                                        <IdCard className="h-16 w-16 opacity-10" />
                                        <p className="font-bold">শ্রেণি ও শিক্ষার্থী সিলেক্ট করলে এখানে প্রিভিউ দেখা যাবে</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Printable Area */}
            <div className="hidden print:block printable-area">
                {mode === 'single' && previewStudent && selectedExam && (
                    <div className="flex justify-center items-center h-screen">
                        <AdmitCard student={previewStudent} schoolInfo={schoolInfo} examName={selectedExam.name} />
                    </div>
                )}
                {mode === 'bulk' && selectedExam && bulkStudentsGrouped.map((group, groupIdx) => (
                    <div key={groupIdx} className="h-screen w-screen p-0 m-0 overflow-hidden relative" style={{ pageBreakAfter: 'always' }}>
                        <div className="grid grid-cols-2 grid-rows-2 h-full w-full">
                            {group.map(student => (
                                <div key={student.id} className="flex items-center justify-center border border-dashed border-gray-300">
                                    <AdmitCard student={student} schoolInfo={schoolInfo} examName={selectedExam.name} />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdmitCardGeneratorPage;