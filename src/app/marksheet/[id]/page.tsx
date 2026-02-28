'use client';

import { useState, useEffect, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Student } from '@/lib/student-data';
import { getSubjects, Subject } from '@/lib/subjects';
import { getResultsForClass, ClassResult } from '@/lib/results-data';
import { processStudentResults, StudentProcessedResult } from '@/lib/results-calculation';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
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

    const academicYear = searchParams.get('academicYear');

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
        return <div className="flex items-center justify-center min-h-screen">লোড হচ্ছে...</div>;
    }

    if (!student || !processedResult) {
        return <div className="flex items-center justify-center min-h-screen p-4 text-center">মার্কশিটের তথ্য পাওয়া যায়নি। অনুগ্রহ করে সকল বিষয়ের নম্বর ইনপুট করা হয়েছে কি না নিশ্চিত করুন।</div>;
    }

    const sortedSubjects = [...subjects].sort((a,b) => parseInt(a.code) - parseInt(b.code));
    const studentOptionalSubject = student.optionalSubject;

    return (
        <div className="bg-slate-100 min-h-screen p-4 font-sans print:p-0 print:bg-white">
            <div className="fixed top-4 right-4 no-print z-50">
                <Button onClick={() => window.print()} size="lg" className="shadow-lg">
                    <Printer className="mr-2 h-5 w-5" />
                    প্রিন্ট করুন
                </Button>
            </div>
            
            {/* Main A4 Marksheet */}
            <div className="w-[210mm] h-[297mm] bg-white mx-auto p-6 relative flex flex-col box-border border border-gray-200 print:shadow-none print:border-none print:m-0">
                {schoolInfo.logoUrl && (
                    <div className="absolute inset-0 flex items-center justify-center z-0">
                        <Image src={schoolInfo.logoUrl} alt="School Logo Watermark" width={400} height={400} className="opacity-10" />
                    </div>
                )}
                
                <div className="relative z-10 border-4 border-black p-4 h-full flex flex-col">
                    <header className="mb-2">
                         <div className="flex justify-between items-start">
                            <div className="flex items-center gap-4">
                                {schoolInfo.logoUrl && (
                                    <div className="w-16 h-16 relative">
                                        <Image src={schoolInfo.logoUrl} alt="School Logo" fill className="object-contain" />
                                    </div>
                                )}
                                <div className="text-left">
                                    <h1 className="text-xl font-bold uppercase">{schoolInfo.nameEn || schoolInfo.name}</h1>
                                    <p className="text-[10px]">{schoolInfo.address}</p>
                                    <p className="mt-1 text-xs"><b>Academic Session:</b> {academicYear}</p>
                                </div>
                            </div>
                            <div className="text-[8px] w-auto">
                                <table className="border-collapse border border-black text-center">
                                    <thead className="bg-gray-100">
                                        <tr className="border-b border-black">
                                            <th className="p-0.5 px-1 border-r border-black">Interval</th>
                                            <th className="p-0.5 px-1 border-r border-black">Point</th>
                                            <th className="p-0.5 px-1">Grade</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gradingScale.map(g => (
                                            <tr key={g.grade} className="border-b border-black last:border-b-0">
                                                <td className="p-0 border-r border-black">{g.interval}</td>
                                                <td className="p-0 border-r border-black">{g.point}</td>
                                                <td className="p-0">{g.grade}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="text-center mt-1">
                            <h2 className="text-md font-bold underline uppercase">Annual Exam Progress Report</h2>
                        </div>
                    </header>

                    <section className="mb-3 text-[12px] leading-relaxed">
                        <div className="grid grid-cols-[1.5fr_4fr_1.5fr_2.5fr] gap-x-2 border-b border-black/10 pb-0.5">
                            <div className="font-bold">Student's Name</div><div className="border-b border-dotted border-black">: {student.studentNameEn || student.studentNameBn}</div>
                            <div className="font-bold text-right">Class</div><div className="border-b border-dotted border-black">: {classMap[student.className] || student.className}</div>
                        </div>
                        <div className="grid grid-cols-[1.5fr_4fr_1.5fr_2.5fr] gap-x-2 mt-0.5 border-b border-black/10 pb-0.5">
                            <div className="font-bold">Father's Name</div><div className="border-b border-dotted border-black">: {student.fatherNameEn || student.fatherNameBn}</div>
                            <div className="font-bold text-right">Roll No.</div><div className="border-b border-dotted border-black">: {student.roll}</div>
                        </div>
                        <div className="grid grid-cols-[1.5fr_4fr_1.5fr_2.5fr] gap-x-2 mt-0.5 border-b border-black/10 pb-0.5">
                            <div className="font-bold">Mother's Name</div><div className="border-b border-dotted border-black">: {student.motherNameEn || student.motherNameBn}</div>
                            <div className="font-bold text-right">Group</div><div className="border-b border-dotted border-black">: {student.group ? groupMap[student.group] : 'N/A'}</div>
                        </div>
                        <div className="grid grid-cols-[1.5fr_4fr_1.5fr_2.5fr] gap-x-2 mt-0.5">
                            <div className="font-bold">Date of Birth</div><div className="border-b border-dotted border-black">: {student.dob ? new Date(student.dob).toLocaleDateString('en-GB') : 'N/A'}</div>
                            <div className="font-bold text-right">Religion</div><div className="border-b border-dotted border-black">: {student.religion ? religionMap[student.religion] : 'N/A'}</div>
                        </div>
                    </section>

                    <section className="mb-3">
                        <div className="grid grid-cols-4 border-2 border-black divide-x-2 divide-black text-center text-[12px] bg-gray-50">
                            <div className="py-0.5">Result: <span className={processedResult.isPass ? "text-green-700 font-bold" : "text-red-700 font-bold"}>{processedResult.isPass ? 'PASSED' : 'FAILED'}</span></div>
                            <div className="py-0.5">Grade: <span className="font-bold">{processedResult.finalGrade}</span></div>
                            <div className="py-0.5">GPA: <span className="font-bold">{processedResult.gpa.toFixed(2)}</span></div>
                            <div className="py-0.5">Merit Rank: <span className="font-bold">{processedResult.isPass ? renderMeritPosition(processedResult.meritPosition) : 'N/A'}</span></div>
                        </div>
                    </section>

                    <section className="flex-grow">
                        <table className="w-full border-collapse border-2 border-black text-[11px]">
                            <thead>
                                <tr className="border-b-2 border-black bg-gray-100">
                                    <th className="border-r border-black p-1 w-8">SL</th>
                                    <th className="border-r border-black p-1 text-left">Subject Name</th>
                                    <th className="border-r border-black p-1 w-12">Code</th>
                                    <th className="border-r border-black p-1 w-12">Full Marks</th>
                                    <th className="border-r border-black p-1 w-12">Obtained</th>
                                    <th className="border-r border-black p-1 w-12">Grade</th>
                                    <th className="p-1 w-12">Point</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedSubjects.map((subject, index) => {
                                    const result = processedResult.subjectResults.get(subject.name);
                                    return (
                                        <tr key={subject.code} className="border-b border-black last:border-b-0">
                                            <td className="border-r border-black p-0.5 text-center">{index + 1}</td>
                                            <td className="border-r border-black p-0.5 px-2">
                                                {subject.englishName}
                                                {studentOptionalSubject === subject.name && <span className="font-bold italic"> (Optional)</span>}
                                            </td>
                                            <td className="border-r border-black p-0.5 text-center">{subject.code}</td>
                                            <td className="border-r border-black p-0.5 text-center">{subject.fullMarks}</td>
                                            <td className={cn("border-r border-black p-0.5 text-center font-semibold", result?.isPass === false ? "text-red-600" : "")}>{result?.marks ?? '-'}</td>
                                            <td className={cn("border-r border-black p-0.5 text-center font-bold", result?.isPass === false ? "text-red-600" : "")}>{result?.grade ?? '-'}</td>
                                            <td className="p-0.5 text-center">{result?.point !== undefined ? result.point.toFixed(2) : '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 border-black font-bold bg-gray-50">
                                    <td colSpan={4} className="p-1 pr-4 text-right border-r border-black">Total Marks Obtained & Final Grade</td>
                                    <td className="p-1 text-center border-r border-black">{processedResult.totalMarks}</td>
                                    <td className="p-1 text-center border-r border-black">{processedResult.finalGrade}</td>
                                    <td className="p-1 text-center">{processedResult.gpa.toFixed(2)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </section>

                    <footer className="mt-4 pt-10 pb-2 text-[12px]">
                        <div className="flex justify-between px-4">
                            <div className="text-center">
                                <div className="w-32 border-t border-black pt-1">Class Teacher</div>
                            </div>
                            <div className="text-center">
                                <div className="w-32 border-t border-black pt-1">Headmaster's Signature</div>
                            </div>
                        </div>
                        <div className="text-center mt-6 text-[9px] text-muted-foreground italic">
                            Report generated on: {new Date().toLocaleDateString('en-GB')}
                        </div>
                    </footer>
                </div>
            </div>
        </div>
    );
}

export default function MarksheetPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">লোড হচ্ছে...</div>}>
            <MarksheetContent />
        </Suspense>
    );
}
