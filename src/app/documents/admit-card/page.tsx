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
import { Printer, Loader2, ArrowLeft, User, Users } from 'lucide-react';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';

const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

const AdmitCardGeneratorPage = () => {
    const db = useFirestore();
    const { schoolInfo } = useSchoolInfo();
    const { selectedYear } = useAcademicYear();

    const [isMounted, setIsMounted] = useState(false);
    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [studentsInClass, setStudentsInClass] = useState<Student[]>([]);

    // Individual mode state
    const [mode, setMode] = useState<'bulk' | 'single'>('bulk');
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');
    const [singleStudent, setSingleStudent] = useState<Student | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingExams, setIsFetchingExams] = useState(true);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!db || !isMounted) return;
        setIsFetchingExams(true);
        getExams(db, selectedYear).then(data => {
            setExams(data);
            setIsFetchingExams(false);
        }).catch(() => {
            setIsFetchingExams(false);
        });
    }, [db, selectedYear, isMounted]);

    useEffect(() => {
        if (!db || !isMounted) return;
        const studentsQuery = query(
            collection(db, "students"),
            where("academicYear", "==", selectedYear)
        );
        const unsubscribe = onSnapshot(studentsQuery, (querySnapshot) => {
            setAllStudents(querySnapshot.docs.map(studentFromDoc));
        }, (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'students', operation: 'list' }));
        });
        return () => unsubscribe();
    }, [db, selectedYear, isMounted]);

    const availableStudents = useMemo(() => {
        if (!selectedClass) return [];
        return allStudents
            .filter(s => s.className === selectedClass)
            .sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
    }, [allStudents, selectedClass]);

    const handleGenerateBulk = () => {
        if (!selectedExam || !selectedClass) return;
        setIsLoading(true);
        setStudentsInClass(availableStudents);
        setSingleStudent(null);
        setIsLoading(false);
    };

    const handleGenerateSingle = () => {
        if (!selectedExam || !selectedStudentId) return;
        setIsLoading(true);
        const target = availableStudents.find(s => s.id === selectedStudentId);
        setSingleStudent(target || null);
        setStudentsInClass([]);
        setIsLoading(false);
    };

    const studentsGroupedByFour = useMemo(() => {
        const groups: Student[][] = [];
        for (let i = 0; i < studentsInClass.length; i += 4) {
            groups.push(studentsInClass.slice(i, i + 4));
        }
        return groups;
    }, [studentsInClass]);

    if (!isMounted) {
        return (
            <div className="flex min-h-screen w-full flex-col bg-slate-100 font-kalpurush">
                <Header />
                <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-24">
                    <Card>
                        <CardHeader>
                            <CardTitle>প্রবেশ পত্র জেনারেটর</CardTitle>
                        </CardHeader>
                        <CardContent className="py-8 text-center text-muted-foreground">লোড হচ্ছে...</CardContent>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <>
            <div className="flex min-h-screen w-full flex-col bg-slate-100 no-print font-kalpurush">
                <Header />
                <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-24">
                    <Card className="shadow-md">
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <Link href="/documents">
                                    <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                                </Link>
                                <div>
                                    <CardTitle className="text-xl">প্রবেশ পত্র জেনারেটর</CardTitle>
                                    <CardDescription>একক বা সকল শিক্ষার্থীর প্রবেশপত্র তৈরি ও প্রিন্ট করুন।</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            {/* Mode Selection Tabs */}
                            <Tabs value={mode} onValueChange={(val) => {
                                setMode(val as 'bulk' | 'single');
                                setStudentsInClass([]);
                                setSingleStudent(null);
                            }} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-4">
                                    <TabsTrigger value="bulk" className="gap-2 font-bold">
                                        <Users className="h-4 w-4" /> শ্রেণি অনুযায়ী (একত্রে)
                                    </TabsTrigger>
                                    <TabsTrigger value="single" className="gap-2 font-bold">
                                        <User className="h-4 w-4" /> একক শিক্ষার্থী
                                    </TabsTrigger>
                                </TabsList>

                                {/* Bulk Mode Tab */}
                                <TabsContent value="bulk" className="space-y-4">
                                    <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg items-end bg-white">
                                        <div className="space-y-2 flex-1">
                                            <Label htmlFor="exam-name-bulk" className="font-bold">১. পরীক্ষা নির্বাচন করুন</Label>
                                            <Select 
                                                disabled={isFetchingExams}
                                                value={selectedExam?.id || ""}
                                                onValueChange={(examId) => {
                                                    const exam = exams.find(e => e.id === examId);
                                                    setSelectedExam(exam || null);
                                                    setSelectedClass('');
                                                    setStudentsInClass([]);
                                                }}
                                            >
                                                <SelectTrigger id="exam-name-bulk">
                                                    <SelectValue placeholder={isFetchingExams ? "লোড হচ্ছে..." : "পরীক্ষা নির্বাচন করুন"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {exams.map(exam => <SelectItem key={exam.id} value={exam.id}>{exam.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2 flex-1">
                                            <Label htmlFor="class-name-bulk" className="font-bold">২. শ্রেণি নির্বাচন করুন</Label>
                                            <Select 
                                                value={selectedClass} 
                                                onValueChange={setSelectedClass}
                                                disabled={!selectedExam}
                                            >
                                                <SelectTrigger id="class-name-bulk">
                                                    <SelectValue placeholder="শ্রেণি নির্বাচন করুন" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {selectedExam?.classes.map(cls => (
                                                        <SelectItem key={cls} value={cls}>{classNamesMap[cls] || `${cls}ম শ্রেণি`}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <Button onClick={handleGenerateBulk} disabled={!selectedExam || !selectedClass || isLoading} className="min-w-[140px] font-bold">
                                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'সব প্রবেশপত্র দেখুন'}
                                        </Button>
                                    </div>

                                    {studentsInClass.length > 0 && (
                                        <div className="text-center p-6 bg-emerald-50 rounded-lg border-2 border-dashed border-emerald-300">
                                            <p className="mb-4 font-bold text-lg text-emerald-900">
                                                একত্রে মোট {studentsInClass.length.toLocaleString('bn-BD')} জন শিক্ষার্থীর প্রবেশপত্র তৈরি হয়েছে।
                                            </p>
                                            <Button onClick={() => window.print()} size="lg" className="shadow-lg hover:shadow-xl transition-all">
                                                <Printer className="mr-2 h-5 w-5" />
                                                প্রিন্ট করুন (এক পাতায় ৪টি)
                                            </Button>
                                        </div>
                                    )}
                                </TabsContent>

                                {/* Single Mode Tab */}
                                <TabsContent value="single" className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border rounded-lg items-end bg-white">
                                        <div className="space-y-2">
                                            <Label htmlFor="exam-name-single" className="font-bold">১. পরীক্ষা</Label>
                                            <Select 
                                                disabled={isFetchingExams}
                                                value={selectedExam?.id || ""}
                                                onValueChange={(examId) => {
                                                    const exam = exams.find(e => e.id === examId);
                                                    setSelectedExam(exam || null);
                                                    setSelectedClass('');
                                                    setSelectedStudentId('');
                                                    setSingleStudent(null);
                                                }}
                                            >
                                                <SelectTrigger id="exam-name-single">
                                                    <SelectValue placeholder={isFetchingExams ? "লোড হচ্ছে..." : "পরীক্ষা নির্বাচন করুন"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {exams.map(exam => <SelectItem key={exam.id} value={exam.id}>{exam.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="class-name-single" className="font-bold">২. শ্রেণি</Label>
                                            <Select 
                                                value={selectedClass} 
                                                onValueChange={(val) => {
                                                    setSelectedClass(val);
                                                    setSelectedStudentId('');
                                                    setSingleStudent(null);
                                                }}
                                                disabled={!selectedExam}
                                            >
                                                <SelectTrigger id="class-name-single">
                                                    <SelectValue placeholder="শ্রেণি নির্বাচন করুন" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {selectedExam?.classes.map(cls => (
                                                        <SelectItem key={cls} value={cls}>{classNamesMap[cls] || `${cls}ম শ্রেণি`}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="student-single" className="font-bold">৩. নির্দিষ্ট শিক্ষার্থী</Label>
                                            <Select 
                                                value={selectedStudentId} 
                                                onValueChange={setSelectedStudentId}
                                                disabled={!selectedClass || availableStudents.length === 0}
                                            >
                                                <SelectTrigger id="student-single">
                                                    <SelectValue placeholder={availableStudents.length === 0 ? "শিক্ষার্থী নেই" : "শিক্ষার্থী সিলেক্ট করুন"} />
                                                </SelectTrigger>
                                                <SelectContent position="item-aligned" className="max-h-[300px]">
                                                    {availableStudents.map(st => (
                                                        <SelectItem key={st.id} value={st.id}>
                                                            রোল {st.roll} - {st.studentNameBn}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="sm:col-span-3 flex justify-end">
                                            <Button onClick={handleGenerateSingle} disabled={!selectedExam || !selectedStudentId || isLoading} className="w-full sm:w-auto font-bold">
                                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'একক প্রবেশপত্র দেখুন ও প্রিন্ট করুন'}
                                            </Button>
                                        </div>
                                    </div>

                                    {singleStudent && selectedExam && (
                                        <div className="text-center p-6 bg-blue-50 rounded-lg border-2 border-dashed border-blue-300">
                                            <p className="mb-4 font-bold text-lg text-blue-900">
                                                শিক্ষার্থী: {singleStudent.studentNameBn} (রোল: {singleStudent.roll.toLocaleString('bn-BD')}) এর প্রবেশপত্র তৈরি হয়েছে।
                                            </p>
                                            <Button onClick={() => window.print()} size="lg" className="shadow-lg hover:shadow-xl transition-all">
                                                <Printer className="mr-2 h-5 w-5" />
                                                প্রবেশপত্র প্রিন্ট করুন
                                            </Button>
                                        </div>
                                    )}
                                </TabsContent>

                            </Tabs>

                        </CardContent>
                    </Card>
                </main>
            </div>

            {/* Printable Area for Bulk Mode */}
            {mode === 'bulk' && studentsInClass.length > 0 && selectedExam && (
                <div className="printable-area-container bg-white">
                    {studentsGroupedByFour.map((group, groupIndex) => (
                        <div key={groupIndex} className="printable-area">
                            <div className="admit-card-grid">
                                {group.map(student => (
                                    <AdmitCard key={student.id} student={student} schoolInfo={schoolInfo} examName={selectedExam.name} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Printable Area for Single Mode */}
            {mode === 'single' && singleStudent && selectedExam && (
                <div className="printable-area-container bg-white">
                    <div className="printable-area flex justify-center items-center py-8">
                        <div className="w-full max-w-md">
                            <AdmitCard student={singleStudent} schoolInfo={schoolInfo} examName={selectedExam.name} />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AdmitCardGeneratorPage;
