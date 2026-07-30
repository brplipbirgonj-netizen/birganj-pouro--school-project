'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { getResultsForClass, ClassResult } from '@/lib/results-data';
import { getSubjects } from '@/lib/subjects';
import { processStudentResults, StudentProcessedResult } from '@/lib/results-calculation';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Loader2, ArrowLeft, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const classNamesMap: { [key: string]: string } = {
  '6': 'ষষ্ঠ', '7': 'সপ্তম', '8': 'অষ্টম', '9': 'নবম', '10': 'দশম',
};

const toBengaliNumber = (str: string | number) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

function MeritListPrintContent() {
    const searchParams = useSearchParams();
    const db = useFirestore();
    const { schoolInfo, isLoading: isSchoolLoading } = useSchoolInfo();

    const academicYear = searchParams.get('academicYear') || '';
    const examName = searchParams.get('examName') || '';
    const className = searchParams.get('className') || '';
    const groupFilter = searchParams.get('group') || 'all';

    const [results, setResults] = useState<StudentProcessedResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !academicYear || !examName || !className) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // 1. Fetch Students
                const studentQuery = query(
                    collection(db, 'students'),
                    where('academicYear', '==', academicYear),
                    where('className', '==', className)
                );
                const studentSnap = await getDocs(studentQuery);
                const students = studentSnap.docs.map(studentFromDoc).filter(s => 
                    groupFilter === 'all' || s.group === groupFilter
                );

                if (students.length === 0) {
                    setIsLoading(false);
                    return;
                }

                // 2. Fetch Results
                const subjects = getSubjects(className, groupFilter === 'all' ? undefined : groupFilter).filter(s => s.isExamSubject !== false);
                const resultsPromises = subjects.map(subject => 
                    getResultsForClass(db, academicYear, examName, className, subject.name, groupFilter === 'all' ? undefined : groupFilter)
                );
                const resultsBySubject = (await Promise.all(resultsPromises)).filter((res): res is ClassResult => !!res);

                // 3. Process
                const finalResults = processStudentResults(students, resultsBySubject, subjects);
                
                // Merit Sort
                const sortedResults = finalResults.sort((a, b) => {
                    if (a.isPass !== b.isPass) return a.isPass ? -1 : 1;
                    if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
                    return a.student.roll - b.student.roll;
                });

                setResults(sortedResults);
            } catch (e) {
                console.error(e);
            }
            setIsLoading(false);
        };

        fetchData();
    }, [db, academicYear, examName, className, groupFilter]);

    if (isLoading || isSchoolLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4 font-kalpurush">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium">মেধা তালিকা তৈরি হচ্ছে...</p>
            </div>
        );
    }

    return (
        <div className="bg-slate-200 min-h-screen p-4 sm:p-8 font-kalpurush print:p-0 print:bg-white flex flex-col items-center">
            {/* Action Bar */}
            <div className="w-full max-w-[210mm] flex justify-between items-center mb-6 no-print bg-white p-4 rounded-lg shadow-md border">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4" /></Button>
                    <div>
                        <h1 className="text-xl font-bold text-primary">মেধা তালিকা প্রিভিউ (A4)</h1>
                        <p className="text-sm text-muted-foreground">{classNamesMap[className]} শ্রেণি | {examName}</p>
                    </div>
                </div>
                <Button onClick={() => window.print()} size="lg" className="shadow-lg bg-emerald-600 hover:bg-emerald-700">
                    <Printer className="mr-2 h-5 w-5" />
                    প্রিন্ট করুন
                </Button>
            </div>

            {/* Printable Merit List */}
            <div className="printable-area w-[210mm] h-[297mm] bg-white mx-auto shadow-2xl relative text-black flex flex-col print:shadow-none print:m-0 p-10 box-border border-[6px] border-double border-primary/40 overflow-hidden">
                
                {/* Watermark */}
                {schoolInfo.logoUrl && (
                    <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none opacity-5">
                        <Image src={schoolInfo.logoUrl} alt="Watermark" width={450} height={450} />
                    </div>
                )}

                {/* Header */}
                <header className="relative z-10 flex items-center gap-6 border-b-2 border-primary/50 pb-4 mb-6 printable-header">
                    {schoolInfo.logoUrl && (
                        <div className="relative w-20 h-20 shrink-0">
                            <Image src={schoolInfo.logoUrl} alt="Logo" fill className="object-contain" />
                        </div>
                    )}
                    <div className="text-center flex-grow">
                        <h1 className="text-3xl font-black text-primary leading-tight">{schoolInfo.name}</h1>
                        <p className="text-sm font-bold text-slate-700">{schoolInfo.address}</p>
                        <p className="text-xs font-bold text-slate-600 mt-1">
                            EIIN: {toBengaliNumber(schoolInfo.eiin)} | কোড: {toBengaliNumber(schoolInfo.code)} | শিক্ষাবর্ষ: {toBengaliNumber(academicYear)}
                        </p>
                    </div>
                    <div className="w-20 h-20 shrink-0"></div>
                </header>

                <div className="relative z-10 text-center mb-8">
                    <h2 className="inline-block bg-primary text-white text-xl font-black px-10 py-1.5 rounded-full shadow-md">
                        {examName} - মেধা তালিকা
                    </h2>
                    <p className="mt-2 font-bold text-slate-700 text-lg">শ্রেণি: {classNamesMap[className]} {groupFilter !== 'all' && `(${groupFilter === 'science' ? 'বিজ্ঞান' : groupFilter === 'arts' ? 'মানবিক' : 'ব্যবসায় শিক্ষা'})`}</p>
                </div>

                {/* Merit Table */}
                <main className="relative z-10 flex-grow">
                    <div className="border-2 border-slate-800 rounded-sm">
                        <Table className="border-collapse">
                            <TableHeader>
                                <TableRow className="bg-slate-100 border-b-2 border-slate-800 h-10">
                                    <TableHead className="text-center font-black text-slate-900 border-r border-slate-800 w-16">মেধা</TableHead>
                                    <TableHead className="text-center font-black text-slate-900 border-r border-slate-800 w-20">রোল</TableHead>
                                    <TableHead className="font-black text-slate-900 border-r border-slate-800">শিক্ষার্থীর নাম</TableHead>
                                    <TableHead className="text-center font-black text-slate-900 border-r border-slate-800">মোট নম্বর</TableHead>
                                    <TableHead className="text-center font-black text-slate-900 border-r border-slate-800">জি.পি.এ</TableHead>
                                    <TableHead className="text-center font-black text-slate-900 border-r border-slate-800">গ্রেড</TableHead>
                                    <TableHead className="text-center font-black text-slate-900">ফলাফল</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results.map((res, idx) => (
                                    <TableRow key={res.student.id} className={cn(
                                        "h-10 border-b border-slate-300 last:border-b-0",
                                        !res.isPass && "bg-rose-50/50"
                                    )}>
                                        <TableCell className="text-center font-black border-r border-slate-300">
                                            {res.isPass ? toBengaliNumber(idx + 1) : '-'}
                                        </TableCell>
                                        <TableCell className="text-center font-bold border-r border-slate-300">
                                            {toBengaliNumber(res.student.roll)}
                                        </TableCell>
                                        <TableCell className="font-bold border-r border-slate-300 pl-3">
                                            {res.student.studentNameBn}
                                        </TableCell>
                                        <TableCell className="text-center font-black border-r border-slate-300 text-primary">
                                            {toBengaliNumber(res.totalMarks)}
                                        </TableCell>
                                        <TableCell className="text-center font-black border-r border-slate-300">
                                            {toBengaliNumber(res.gpa.toFixed(2))}
                                        </TableCell>
                                        <TableCell className="text-center font-bold border-r border-slate-300">
                                            {res.finalGrade}
                                        </TableCell>
                                        <TableCell className={cn(
                                            "text-center font-black text-[10px]",
                                            res.isPass ? "text-emerald-700" : "text-rose-700"
                                        )}>
                                            {res.isPass ? 'কৃতকার্য' : 'অকৃতকার্য'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </main>

                {/* Footer Signatures */}
                <footer className="relative z-10 pt-16 flex justify-between items-end print-footer">
                    <div className="text-center">
                        <div className="w-40 border-t-2 border-black pt-1 font-bold text-sm">রুটিন কমিটির স্বাক্ষর</div>
                    </div>
                    <div className="text-center">
                        <div className="w-40 border-t-2 border-black pt-1 font-bold text-sm">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                    </div>
                    <div className="text-center">
                        <div className="w-40 border-t-2 border-black pt-1 font-bold text-sm">প্রধান শিক্ষকের স্বাক্ষর</div>
                    </div>
                </footer>
                
                <div className="mt-8 text-[9px] text-slate-400 italic text-center relative z-10">
                    রিপোর্ট জেনারেট করার তারিখ: {format(new Date(), 'PPpp', { locale: bn })} | Birganj Pouro High School Management System
                </div>
            </div>
        </div>
    );
}

export default function MeritListPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">লোড হচ্ছে...</div>}>
            <MeritListPrintContent />
        </Suspense>
    );
}
