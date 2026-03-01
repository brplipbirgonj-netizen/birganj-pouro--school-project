'use client';
import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { Exam, getExams } from '@/lib/exam-data';
import { AdmitCard } from '@/components/AdmitCard';
import { Printer, Loader2, ArrowLeft } from 'lucide-react';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';

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

    const handleGenerate = () => {
        if (!selectedExam || !selectedClass) return;
        setIsLoading(true);
        const filteredStudents = allStudents
            .filter(s => s.className === selectedClass)
            .sort((a, b) => a.roll - b.roll);
        setStudentsInClass(filteredStudents);
        setIsLoading(false);
    };

    const studentsGroupedByFour = useMemo(() => {
        const groups: Student[][] = [];
        for (let i = 0; i < studentsInClass.length; i += 4) {
            groups.push(studentsInClass.slice(i, i + 4));
        }
        return groups;
    }, [studentsInClass]);

    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

    if (!isMounted) {
        return (
            <div className="flex min-h-screen w-full flex-col bg-slate-100">
                <Header />
                <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
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
            <div className="flex min-h-screen w-full flex-col bg-slate-100 no-print">
                <Header />
                <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <Link href="/documents">
                                    <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                                </Link>
                                <div>
                                    <CardTitle>প্রবেশ পত্র জেনারেটর</CardTitle>
                                    <CardDescription>পরীক্ষা এবং শ্রেণি নির্বাচন করে প্রবেশপত্র তৈরি করুন।</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg items-end">
                                <div className="space-y-2 flex-1">
                                    <Label htmlFor="exam-name">পরীক্ষা</Label>
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
                                        <SelectTrigger id="exam-name">
                                            <SelectValue placeholder={isFetchingExams ? "লোড হচ্ছে..." : "পরীক্ষা নির্বাচন করুন"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {exams.map(exam => <SelectItem key={exam.id} value={exam.id}>{exam.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 flex-1">
                                    <Label htmlFor="class-name">শ্রেণি</Label>
                                    <Select 
                                        value={selectedClass} 
                                        onValueChange={setSelectedClass}
                                        disabled={!selectedExam}
                                    >
                                        <SelectTrigger id="class-name">
                                            <SelectValue placeholder="শ্রেণি নির্বাচন করুন" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {selectedExam?.classes.map(cls => (
                                                <SelectItem key={cls} value={cls}>{classNamesMap[cls] || `${cls}ম শ্রেণি`}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handleGenerate} disabled={!selectedExam || !selectedClass || isLoading} className="min-w-[120px]">
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            ...
                                        </>
                                    ) : 'প্রবেশপত্র দেখুন'}
                                </Button>
                            </div>
                            
                            {studentsInClass.length > 0 && (
                                <div className="text-center p-6 bg-primary/5 rounded-lg border-2 border-dashed border-primary/20">
                                    <p className="mb-4 font-bold text-lg text-primary">
                                        মোট {studentsInClass.length.toLocaleString('bn-BD')} জন শিক্ষার্থীর প্রবেশপত্র তৈরি হয়েছে।
                                    </p>
                                     <Button onClick={() => window.print()} size="lg" className="w-full sm:w-auto shadow-lg hover:shadow-xl transition-all">
                                        <Printer className="mr-2 h-5 w-5" />
                                        প্রিন্ট করুন (এক পাতায় ৪টি)
                                    </Button>
                                </div>
                            )}

                            {selectedClass && studentsInClass.length === 0 && !isLoading && (
                                <p className="text-center text-muted-foreground py-12 bg-muted/30 rounded-lg">
                                    এই শ্রেণিতে কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </main>
            </div>
            {studentsInClass.length > 0 && selectedExam && (
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
        </>
    );
};

export default AdmitCardGeneratorPage;