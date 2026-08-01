'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { StudentIDCard } from '@/components/StudentIDCard';
import { Printer, ArrowLeft, User, Users, Info, IdCard, Loader2 } from 'lucide-react';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

const IDCardGeneratorPage = () => {
    const db = useFirestore();
    const { schoolInfo } = useSchoolInfo();
    const { selectedYear } = useAcademicYear();

    const [isClient, setIsClient] = useState(false);
    const [selectedClass, setSelectedClass] = useState<string>('6');
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [mode, setMode] = useState<'bulk' | 'single'>('bulk');
    const [selectedStudentId, setSelectedStudentId] = useState<string>('');

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!db || !isClient) return;
        setIsLoading(true);
        const studentsQuery = query(collection(db, "students"), where("academicYear", "==", selectedYear));
        const unsubscribe = onSnapshot(studentsQuery, (querySnapshot) => {
            setAllStudents(querySnapshot.docs.map(studentFromDoc));
            setIsLoading(false);
        }, (error) => {
            if (error.code !== 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'students', operation: 'list' }));
            }
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, [db, selectedYear, isClient]);

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
        for (let i = 0; i < availableStudents.length; i += 8) {
            groups.push(availableStudents.slice(i, i + 8));
        }
        return groups;
    }, [availableStudents]);

    if (!isClient) {
        return (
            <div className="flex min-h-screen w-full flex-col bg-slate-100">
                <Header />
                <main className="p-8"><Skeleton className="h-64 w-full rounded-xl" /></main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-100 font-kalpurush">
            <Header />
            <main className="flex-1 p-4 md:p-8 no-print pb-40">
                <div className="max-w-[1200px] mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <Link href="/documents">
                            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black text-primary">শিক্ষার্থী আইডি কার্ড জেনারেটর</h1>
                            <p className="text-sm text-muted-foreground">সব শিক্ষার্থীর জন্য প্রফেশনাল আইডি কার্ড তৈরি ও প্রিন্ট করুন</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        {/* Form Column */}
                        <Card className="shadow-lg border-2">
                            <CardHeader className="bg-primary/5 border-b">
                                <CardTitle className="text-lg">কনফিগারেশন</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="font-bold">১. শ্রেণি নির্বাচন করুন</Label>
                                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                                            <SelectTrigger className="bg-white"><SelectValue placeholder="শ্রেণি নির্বাচন করুন" /></SelectTrigger>
                                            <SelectContent>
                                                {['6', '7', '8', '9', '10'].map(cls => <SelectItem key={cls} value={cls}>{classNamesMap[cls]} শ্রেণি</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label className="font-bold">২. প্রিন্ট মোড</Label>
                                        <Tabs value={mode} onValueChange={(v: any) => setMode(v)}>
                                            <TabsList className="grid grid-cols-2 w-full">
                                                <TabsTrigger value="bulk" className="gap-2 font-bold"><Users className="h-4 w-4" /> শ্রেণিভিত্তিক</TabsTrigger>
                                                <TabsTrigger value="single" className="gap-2 font-bold"><User className="h-4 w-4" /> একক</TabsTrigger>
                                            </TabsList>
                                        </Tabs>
                                    </div>

                                    {mode === 'single' && (
                                        <div className="space-y-2 animate-in slide-in-from-top-2">
                                            <Label className="font-bold">৩. শিক্ষার্থী নির্বাচন</Label>
                                            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                                                <SelectTrigger className="bg-white">
                                                    <SelectValue placeholder="শিক্ষার্থী সিলেক্ট করুন" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {availableStudents.map(s => <SelectItem key={s.id} value={s.id}>রোল {s.roll} - {s.studentNameBn}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-6 border-t">
                                    <Button 
                                        onClick={() => window.print()} 
                                        className="w-full h-12 text-lg font-black shadow-lg"
                                        disabled={isLoading || availableStudents.length === 0 || (mode === 'single' && !selectedStudentId)}
                                    >
                                        <Printer className="mr-2 h-5 w-5" /> প্রিন্ট করুন (A4)
                                    </Button>
                                    <p className="text-[10px] text-muted-foreground mt-4 italic text-center">
                                        * এক পাতায় ৮টি আইডি কার্ড প্রিন্ট হবে। ব্রাউজার থেকে 'Background Graphics' অন রাখুন।
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Preview Column */}
                        <div className="sticky top-24">
                            <h3 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-2">
                                <Info className="h-4 w-4" /> লাইভ প্রিভিউ
                            </h3>
                            <div className="bg-white p-10 border-4 border-dashed rounded-2xl shadow-inner min-h-[500px] flex items-center justify-center">
                                {isLoading ? (
                                    <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                                ) : previewStudent ? (
                                    <div className="transform scale-110">
                                        <StudentIDCard student={previewStudent} schoolInfo={schoolInfo} />
                                    </div>
                                ) : (
                                    <div className="text-center text-muted-foreground italic">
                                        <IdCard className="h-16 w-16 mx-auto mb-4 opacity-10" />
                                        <p>তথ্য পাওয়া যায়নি</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Printable Area */}
            <div className="hidden print:block printable-area bg-white">
                {mode === 'single' && previewStudent && (
                    <div className="flex justify-center items-center h-screen">
                        <StudentIDCard student={previewStudent} schoolInfo={schoolInfo} isPrint />
                    </div>
                )}
                {mode === 'bulk' && bulkStudentsGrouped.map((group, pageIdx) => (
                    <div key={pageIdx} className="w-[210mm] h-[297mm] p-[10mm] grid grid-cols-2 grid-rows-4 gap-[5mm] box-border" style={{ pageBreakAfter: 'always' }}>
                        {group.map(student => (
                            <div key={student.id} className="flex items-center justify-center border border-dashed border-slate-300 rounded-lg">
                                <StudentIDCard student={student} schoolInfo={schoolInfo} isPrint />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default IDCardGeneratorPage;
