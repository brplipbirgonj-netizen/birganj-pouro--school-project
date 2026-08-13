'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { Student, getStudentById } from '@/lib/student-data';
import { Exam, getExams } from '@/lib/exam-data';
import { AdmitCard } from '@/components/AdmitCard';
import { Printer, Loader2, ArrowLeft } from 'lucide-react';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import Link from 'next/link';

export default function IndividualAdmitCardPage() {
    const params = useParams();
    const studentId = params.id as string;
    const db = useFirestore();
    const { schoolInfo } = useSchoolInfo();
    const { selectedYear } = useAcademicYear();
    
    const [isMounted, setIsMounted] = useState(false);
    const [student, setStudent] = useState<Student | null>(null);
    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (!db || !studentId || !isMounted) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [studentData, examData] = await Promise.all([
                    getStudentById(db, studentId),
                    getExams(db, selectedYear)
                ]);
                setStudent(studentData || null);
                setExams(examData);
            } catch (e) {
                console.error(e);
            }
            setIsLoading(false);
        };
        fetchData();
    }, [db, studentId, selectedYear, isMounted]);

    if (!isMounted || isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium">প্রবেশ পত্র লোড হচ্ছে...</p>
            </div>
        );
    }

    if (!student) {
        return <div className="flex items-center justify-center min-h-screen">শিক্ষার্থী পাওয়া যায়নি।</div>;
    }

    return (
        <>
            <div className="flex min-h-screen w-full flex-col bg-slate-100 no-print">
                <Header />
                <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-24">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-4">
                                <Button variant="outline" size="icon" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4" /></Button>
                                <div>
                                    <CardTitle>একক প্রবেশ পত্র প্রিন্ট</CardTitle>
                                    <CardDescription>{student.studentNameBn} - রোল: {student.roll.toLocaleString('bn-BD')}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg items-end">
                                <div className="space-y-2 flex-1">
                                    <Label htmlFor="exam-name">পরীক্ষা নির্বাচন করুন</Label>
                                    <Select 
                                        value={selectedExam?.id || ""}
                                        onValueChange={(examId) => {
                                            const exam = exams.find(e => e.id === examId);
                                            setSelectedExam(exam || null);
                                        }}
                                    >
                                        <SelectTrigger id="exam-name">
                                            <SelectValue placeholder="পরীক্ষা নির্বাচন করুন" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {exams.filter(e => e.classes.includes(student.className)).map(exam => (
                                                <SelectItem key={exam.id} value={exam.id}>{exam.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button 
                                    onClick={() => window.print()} 
                                    disabled={!selectedExam}
                                    className="min-w-[120px]"
                                >
                                    <Printer className="mr-2 h-4 w-4" /> প্রিন্ট করুন
                                </Button>
                            </div>

                            {selectedExam ? (
                                <div className="flex justify-center p-8 bg-white border rounded-lg shadow-inner overflow-auto">
                                    <div className="transform scale-90 sm:scale-100 origin-top">
                                        <AdmitCard student={student} schoolInfo={schoolInfo} examName={selectedExam.name} />
                                    </div>
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground py-12 bg-muted/30 rounded-lg">
                                    প্রিন্ট করার আগে একটি পরীক্ষা নির্বাচন করুন।
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </main>
            </div>
            
            {student && selectedExam && (
                <div className="printable-area flex items-center justify-center bg-white">
                    <AdmitCard student={student} schoolInfo={schoolInfo} examName={selectedExam.name} />
                </div>
            )}
        </>
    );
}
