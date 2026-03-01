'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Student } from '@/lib/student-data';
import { getSubjects, Subject } from '@/lib/subjects';
import { getResultsForClass, ClassResult } from '@/lib/results-data';
import { processStudentResults, StudentProcessedResult } from '@/lib/results-calculation';
import { Button } from '@/components/ui/button';
import { Printer, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, FirestoreError } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const classMap: { [key: string]: string } = { '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten' };
const groupMap: { [key: string]: string } = { 'science': 'Science', 'arts': 'Arts', 'commerce': 'Commerce' };
const religionMap: { [key: string]: string } = { 'islam': 'Islam', 'hinduism': 'Hinduism', 'buddhism': 'Buddhism', 'christianity': 'Christianity', 'other': 'Other' };

function MarksheetContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const studentId = params.id as string;
    const db = useFirestore();
    const { user } = useAuth();
    const { schoolInfo } = useSchoolInfo();

    const [student, setStudent] = useState<Student | null>(null);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [processedResult, setProcessedResult] = useState<StudentProcessedResult | null>(null);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const academicYear = searchParams.get('academicYear') || new Date().getFullYear().toString();

    useEffect(() => {
      if (!db || !user) return;
      const studentsQuery = query(collection(db, "students"));
      const unsubscribe = onSnapshot(studentsQuery, (querySnapshot) => {
        const studentsData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          dob: doc.data().dob?.toDate(),
        })) as Student[];
        setAllStudents(studentsData);
      }, async (error: FirestoreError) => {
          const permissionError = new FirestorePermissionError({
            path: 'students',
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
      });
      return () => unsubscribe();
    }, [db, user]);


    useEffect(() => {
        const processMarks = async () => {
            if (!studentId || !academicYear || !db || !user || allStudents.length === 0) {
                return;
            }

            const studentData = allStudents.find(s => s.id === studentId);
            if (!studentData) {
                setIsLoading(false);
                return;
            }
            setStudent(studentData);

            const allStudentsInClass = allStudents.filter(s => 
                s.academicYear === academicYear && 
                s.className === studentData.className &&
                (studentData.className < '9' || !studentData.group || s.group === studentData.group)
            );

            if (allStudentsInClass.length === 0) {
                setIsLoading(false);
                return;
            }
            
            const allSubjectsForGroup = getSubjects(studentData.className, studentData.group || undefined).filter(s => s.isExamSubject !== false);
            
            const resultsPromises = allSubjectsForGroup
                .map(subject => getResultsForClass(db, academicYear, studentData.className, subject.name, studentData.group || undefined));
            
            const resultsBySubject = (await Promise.all(resultsPromises)).filter((result): result is ClassResult => !!result);
            
            const allFinalResults = processStudentResults(allStudentsInClass, resultsBySubject, allSubjectsForGroup);

            const finalResultForThisStudent = allFinalResults.find(res => res.student.id === studentId);

            if (!finalResultForThisStudent) {
                setIsLoading(false);
                setProcessedResult(null);
                return;
            }

            const subjectsForThisStudent = allSubjectsForGroup.filter(subjectInfo => {
                if (studentData.group === 'science' || studentData.group === 'arts' || studentData.group === 'commerce') {
                     if (studentData.optionalSubject === 'উচ্চতর গণিত' && subjectInfo.name === 'কৃষি শিক্ষা') return false;
                     if (studentData.optionalSubject === 'কৃষি শিক্ষা' && subjectInfo.name === 'উচ্চতর গণিত') return false;
                }
                return true;
            });
            
            setSubjects(subjectsForThisStudent);
            setProcessedResult(finalResultForThisStudent);
            setIsLoading(false);
        }

        setIsLoading(true);
        processMarks();

    }, [studentId, academicYear, db, user, allStudents]);

    
    const renderMeritPosition = (position?: number) => {
        if (!position) return '-';
        if (position % 10 === 1 && position % 100 !== 11) return `${position}st`;
        if (position % 10 === 2 && position % 100 !== 12) return `${position}nd`;
        if (position % 10 === 3 && position % 100 !== 13) return `${position}rd`;
        return `${position}th`;
    }

    const gradingScale = [
        { interval: '80-100', point: '5.00', grade: 'A+' },
        { interval: '70-79', point: '4.00', grade: 'A' },
        { interval: '60-69', point: '3.50', grade: 'A-' },
        { interval: '50-59', point: '3.00', grade: 'B' },
        { interval: '40-49', point: '2.00', grade: 'C' },
        { interval: '33-39', point: '1.00', grade: 'D' },
        { interval: '0-32', point: '0.00', grade: 'F' },
    ];


    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium">মার্কশিট তৈরি হচ্ছে, দয়া করে অপেক্ষা করুন...</p>
            </div>
        );
    }

    if (!student || !processedResult) {
        return <div className="flex items-center justify-center min-h-screen p-4 text-center">মার্কশিটের তথ্য পাওয়া যায়নি। অনুগ্রহ করে সকল বিষয়ের নম্বর ইনপুট করা হয়েছে কি না নিশ্চিত করুন।</div>;
    }

    const sortedSubjects = [...subjects].sort((a,b) => parseInt(a.code) - parseInt(b.code));
    const studentOptionalSubject = student.optionalSubject;

    return (
        <div className="bg-slate-100 min-h-screen p-4 sm:p-8 font-sans print:p-0 print:bg-white flex flex-col items-center">
            {/* Action Bar */}
            <div className="w-full max-w-[210mm] flex justify-between items-center mb-6 no-print bg-white p-4 rounded-lg shadow-sm border">
                <div>
                    <h1 className="text-xl font-bold text-primary">মার্কশিট প্রিভিউ</h1>
                    <p className="text-sm text-muted-foreground">শিক্ষার্থীর নাম: {student.studentNameBn}</p>
                </div>
                <Button onClick={() => window.print()} size="lg" className="shadow-md hover:shadow-lg transition-all">
                    <Printer className="mr-2 h-5 w-5" />
                    প্রিন্ট করুন (A4)
                </Button>
            </div>
            
            {/* Printable Marksheet Card */}
            <div className="w-[210mm] min-h-[297mm] bg-white p-6 relative flex flex-col box-border shadow-2xl print:shadow-none print:m-0 print:p-0">
                {schoolInfo.logoUrl && (
                    <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
                        <Image src={schoolInfo.logoUrl} alt="School Logo Watermark" width={300} height={300} className="opacity-10" />
                    </div>
                )}
                
                <div className="relative z-10 border-[1.5px] border-black p-4 h-full flex flex-col flex-grow">
                    {/* Header */}
                    <header className="mb-4">
                         <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                {schoolInfo.logoUrl && (
                                    <div className="w-16 h-16 relative">
                                        <Image src={schoolInfo.logoUrl} alt="School Logo" fill className="object-contain" />
                                    </div>
                                )}
                                <div className="text-left">
                                    <h1 className="text-xl font-black uppercase text-blue-900 tracking-tight leading-none mb-1">{schoolInfo.nameEn || schoolInfo.name}</h1>
                                    <p className="text-[10px] font-medium text-gray-700">{schoolInfo.address}</p>
                                    <div className="mt-2 inline-block bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                        <p className="text-[11px] text-blue-800 font-bold">Academic Session: {academicYear}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="text-[7.5px] w-auto">
                                <table className="border-collapse border border-black text-center w-full">
                                    <thead className="bg-gray-100">
                                        <tr className="border-b border-black">
                                            <th className="p-1 px-2 border-r border-black font-bold">Range</th>
                                            <th className="p-1 px-2 border-r border-black font-bold">GP</th>
                                            <th className="p-1 px-2 font-bold">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gradingScale.map(g => (
                                            <tr key={g.grade} className="border-b border-black last:border-b-0">
                                                <td className="p-0.5 border-r border-black">{g.interval}</td>
                                                <td className="p-0.5 border-r border-black">{g.point}</td>
                                                <td className="p-0.5 font-bold">{g.grade}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="text-center mt-2">
                            <h2 className="text-sm font-black underline underline-offset-4 uppercase tracking-wider text-blue-950">Annual Exam Progress Report</h2>
                        </div>
                    </header>

                    {/* Student Info */}
                    <section className="mb-4 text-[11px] leading-relaxed bg-slate-50/50 p-3 border border-dashed border-gray-300 rounded">
                        <div className="grid grid-cols-[1.2fr_4fr_1fr_2fr] gap-x-4 border-b border-black/10 pb-1">
                            <div className="font-bold text-gray-600">Student's Name</div><div className="font-bold">: {student.studentNameEn || student.studentNameBn}</div>
                            <div className="font-bold text-gray-600 text-right">Class</div><div className="font-bold">: {classMap[student.className] || student.className}</div>
                        </div>
                        <div className="grid grid-cols-[1.2fr_4fr_1fr_2fr] gap-x-4 mt-1 border-b border-black/10 pb-1">
                            <div className="font-bold text-gray-600">Father's Name</div><div>: {student.fatherNameEn || student.fatherNameBn}</div>
                            <div className="font-bold text-gray-600 text-right">Roll No.</div><div className="font-bold">: {student.roll}</div>
                        </div>
                        <div className="grid grid-cols-[1.2fr_4fr_1fr_2fr] gap-x-4 mt-1 border-b border-black/10 pb-1">
                            <div className="font-bold text-gray-600">Mother's Name</div><div>: {student.motherNameEn || student.motherNameBn}</div>
                            <div className="font-bold text-gray-600 text-right">Group</div><div>: {student.group ? groupMap[student.group] : 'General'}</div>
                        </div>
                        <div className="grid grid-cols-[1.2fr_4fr_1fr_2fr] gap-x-4 mt-1">
                            <div className="font-bold text-gray-600">Date of Birth</div><div>: {student.dob ? new Date(student.dob).toLocaleDateString('en-GB') : 'N/A'}</div>
                            <div className="font-bold text-gray-600 text-right">Religion</div><div>: {student.religion ? religionMap[student.religion] : 'N/A'}</div>
                        </div>
                    </section>

                    {/* Summary Bar */}
                    <section className="mb-4">
                        <div className="grid grid-cols-4 border-2 border-black divide-x-2 divide-black text-center text-[11px] bg-blue-900 text-white rounded-sm">
                            <div className="py-1">Status: <span className={cn("font-black", processedResult.isPass ? "text-green-400" : "text-red-400")}>{processedResult.isPass ? 'PASSED' : 'FAILED'}</span></div>
                            <div className="py-1">GPA: <span className="font-black text-amber-300">{processedResult.gpa.toFixed(2)}</span></div>
                            <div className="py-1">Final Grade: <span className="font-black text-amber-300">{processedResult.finalGrade}</span></div>
                            <div className="py-1">Merit Rank: <span className="font-black">{processedResult.isPass ? renderMeritPosition(processedResult.meritPosition) : 'N/A'}</span></div>
                        </div>
                    </section>

                    {/* Table */}
                    <section className="flex-grow">
                        <table className="w-full border-collapse border-[1.5px] border-black text-[10px]">
                            <thead>
                                <tr className="border-b-[1.5px] border-black bg-gray-100 font-bold">
                                    <th className="border-r border-black p-1 w-8 text-center">SL</th>
                                    <th className="border-r border-black p-1 text-left pl-3">Subject Name</th>
                                    <th className="border-r border-black p-1 w-12 text-center">Code</th>
                                    <th className="border-r border-black p-1 w-16 text-center">Full Marks</th>
                                    <th className="border-r border-black p-1 w-16 text-center">Obtained</th>
                                    <th className="border-r border-black p-1 w-12 text-center">Grade</th>
                                    <th className="p-1 w-12 text-center">Point</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedSubjects.map((subject, index) => {
                                    const result = processedResult.subjectResults.get(subject.name);
                                    const isFail = result?.isPass === false;
                                    return (
                                        <tr key={subject.code} className={cn("border-b border-black last:border-b-0", isFail ? "bg-red-50/30" : "")}>
                                            <td className="border-r border-black p-1 text-center font-medium text-gray-500">{index + 1}</td>
                                            <td className="border-r border-black p-1 px-3 font-semibold">
                                                {subject.englishName}
                                                {studentOptionalSubject === subject.name && <span className="text-[8px] text-blue-600 font-bold italic ml-1">(Optional)</span>}
                                            </td>
                                            <td className="border-r border-black p-1 text-center text-gray-600">{subject.code}</td>
                                            <td className="border-r border-black p-1 text-center font-medium">{subject.fullMarks}</td>
                                            <td className={cn("border-r border-black p-1 text-center font-bold text-base", isFail ? "text-red-600" : "text-blue-900")}>{result?.marks ?? '-'}</td>
                                            <td className={cn("border-r border-black p-1 text-center font-black text-sm", isFail ? "text-red-600" : "")}>{result?.grade ?? '-'}</td>
                                            <td className={cn("p-1 text-center font-bold", isFail ? "text-red-600" : "")}>{result?.point !== undefined ? result.point.toFixed(2) : '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-[1.5px] border-black font-black bg-blue-50 text-[11px]">
                                    <td colSpan={4} className="p-2 pr-6 text-right border-r border-black uppercase text-blue-900">Total Marks & Final Results</td>
                                    <td className="p-2 text-center border-r border-black text-lg text-blue-950">{processedResult.totalMarks}</td>
                                    <td className="p-2 text-center border-r border-black text-lg text-blue-950">{processedResult.finalGrade}</td>
                                    <td className="p-2 text-center text-lg text-blue-950">{processedResult.gpa.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>

                    {/* Footer */}
                    <footer className="mt-auto pt-8 pb-4 text-[10px] print-footer">
                        <div className="flex justify-between px-12">
                            <div className="text-center">
                                <div className="w-28 border-t border-black pt-1 font-bold text-gray-700 uppercase">Class Teacher</div>
                            </div>
                            <div className="text-center">
                                <div className="w-28 border-t border-black pt-1 font-bold text-gray-700 uppercase">Headmaster</div>
                            </div>
                        </div>
                        <div className="mt-8 flex justify-between items-center text-[8px] text-muted-foreground italic border-t pt-2">
                            <span>Issue Date: {new Date().toLocaleDateString('en-GB')}</span>
                            <span>Powered by: Birganj Pouro High School Management System</span>
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
}

export default function MarksheetPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen bg-slate-50">লোড হচ্ছে...</div>}>
            <MarksheetContent />
        </Suspense>
    );
}
