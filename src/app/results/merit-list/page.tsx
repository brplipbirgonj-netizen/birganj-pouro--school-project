

'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { getAllResults, ClassResult } from '@/lib/results-data';
import { getSubjects } from '@/lib/subjects';
import { processStudentResults, StudentProcessedResult } from '@/lib/results-calculation';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

const classNamesMap: { [key: string]: string } = {
  '6': 'ষষ্ঠ', '7': 'সপ্তম', '8': 'অষ্টম', '9': 'নবম', '10': 'দশম',
};

const toBengaliNumber = (str: string | number) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

const STUDENTS_PER_PAGE = 20;

function MeritListPrintContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const db = useFirestore();
    const { schoolInfo, isLoading: isSchoolLoading } = useSchoolInfo();
    const { user, hasPermission, loading: authLoading } = useAuth();

    const academicYear = searchParams.get('academicYear') || '';
    const examName = searchParams.get('examName') || '';
    const className = searchParams.get('className') || '';
    const groupFilter = searchParams.get('group') || 'all';

    const [results, setResults] = useState<StudentProcessedResult[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const canViewMeritList = hasPermission('view:merit-list');

    useEffect(() => {
        if (authLoading) return;
        if (!user || !canViewMeritList) {
            return;
        }

        if (!db || !academicYear || !examName || !className) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch all students for the class
                const studentQuery = query(
                    collection(db, 'students'),
                    where('academicYear', '==', academicYear),
                    where('className', '==', className)
                );
                const studentSnap = await getDocs(studentQuery);
                
                const groupComparisonMap: Record<string, string> = { 'science': 'science', 'বিজ্ঞান': 'science', 'arts': 'arts', 'মানবিক': 'arts', 'humanities': 'arts', 'commerce': 'commerce', 'ব্যবসায় শিক্ষা': 'commerce', 'business': 'commerce' };
                
                const students = studentSnap.docs.map(studentFromDoc).filter(s => {
                    const classNum = parseInt(className);
                    if (classNum < 9 || groupFilter === 'all') return true;
                    
                    const sGroup = groupComparisonMap[(s.group || '').toLowerCase().trim()] || (s.group || '').toLowerCase().trim();
                    const fGroup = groupComparisonMap[groupFilter.toLowerCase().trim()] || groupFilter.toLowerCase().trim();
                    return sGroup === fGroup;
                });

                if (students.length === 0) {
                    setIsLoading(false);
                    return;
                }

                // Important: Use getAllResults to fetch all marks for this class at once.
                const allResults = await getAllResults(db, academicYear, examName);
                const resultsBySubject = allResults.filter(r => r.className === className);

                // If "all" group, getSubjects returns the union of all subjects for 9/10.
                const subjects = getSubjects(className, groupFilter === 'all' ? undefined : groupFilter).filter(s => s.isExamSubject !== false);
                
                // Process results
                const finalResults = processStudentResults(students, resultsBySubject, subjects);
                
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
    }, [db, academicYear, examName, className, groupFilter, user, canViewMeritList, authLoading]);

    const paginatedResults = useMemo(() => {
        const pages: StudentProcessedResult[][] = [];
        for (let i = 0; i < results.length; i += STUDENTS_PER_PAGE) {
            pages.push(results.slice(i, i + STUDENTS_PER_PAGE));
        }
        return pages;
    }, [results]);

    if (authLoading || isSchoolLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4 font-kalpurush">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium">লোড হচ্ছে...</p>
            </div>
        );
    }

    if (!user || !canViewMeritList) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4 text-center font-kalpurush">
                <AlertCircle className="h-16 w-16 text-destructive mb-4" />
                <h1 className="text-2xl font-bold mb-2">প্রবেশাধিকার সংরক্ষিত</h1>
                <p className="text-muted-foreground mb-6">আপনার এই পৃষ্ঠাটি দেখার অনুমতি নেই।</p>
                <Button onClick={() => router.push('/')}>হোম পেজে ফিরে যান</Button>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4 font-kalpurush">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium">মেধা তালিকা তৈরি হচ্ছে...</p>
            </div>
        );
    }

    const groupNamesMap: { [key: string]: string } = { 'science': 'বিজ্ঞান', 'arts': 'মানবিক', 'commerce': 'ব্যবসায় শিক্ষা', 'all': 'সকল শাখা' };

    return (
        <div className="bg-slate-200 min-h-screen p-4 sm:p-8 font-kalpurush print:p-0 print:bg-white flex flex-col items-center">
            <style jsx global>{`
                @media print {
                    .merit-print-page {
                        padding: 12.7mm !important;
                        box-sizing: border-box !important;
                        display: flex !important;
                        flex-direction: column !important;
                        height: 297mm !important;
                        width: 210mm !important;
                        position: relative !important;
                        page-break-after: always !important;
                    }
                    .merit-main-content {
                        flex-grow: 1 !important;
                        display: block !important;
                        overflow: hidden !important;
                    }
                }
            `}</style>

            <div className="w-full max-w-[210mm] flex justify-between items-center mb-6 no-print bg-white p-4 rounded-lg shadow-md border">
                <div className="flex items-center gap-4">
                    <Button variant="outline" size="icon" onClick={() => window.history.back()}><ArrowLeft className="h-4 w-4" /></Button>
                    <div>
                        <h1 className="text-xl font-bold text-primary">মেধা তালিকা প্রিভিউ (A4)</h1>
                        <p className="text-sm text-muted-foreground">{classNamesMap[className]} শ্রেণি | {examName} | মোট {toBengaliNumber(results.length)} জন</p>
                    </div>
                </div>
                <Button onClick={() => window.print()} size="lg" className="shadow-lg bg-emerald-600 hover:bg-emerald-700">
                    <Printer className="mr-2 h-5 w-5" />
                    প্রিন্ট করুন
                </Button>
            </div>

            <div className="flex flex-col gap-8 print:gap-0">
                {paginatedResults.length === 0 ? (
                    <div className="printable-area merit-print-page w-[210mm] h-[297mm] bg-white p-[12.7mm] border-[6px] border-double border-primary/40 flex items-center justify-center">
                        কোনো ফলাফল পাওয়া যায়নি।
                    </div>
                ) : (
                    paginatedResults.map((pageData, pageIdx) => (
                        <div key={pageIdx} className="printable-area merit-print-page w-[210mm] h-[297mm] bg-white mx-auto shadow-2xl relative text-black flex flex-col print:shadow-none print:m-0 p-[12.7mm] box-border border-[6px] border-double border-primary/40 overflow-hidden">
                            
                            {schoolInfo.logoUrl && (
                                <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none opacity-5">
                                    <Image src={schoolInfo.logoUrl} alt="Watermark" width={450} height={450} />
                                </div>
                            )}

                            <header className="relative z-10 flex items-center gap-6 border-b-2 border-primary/50 pb-3 mb-3 printable-header">
                                {schoolInfo.logoUrl && (
                                    <div className="relative w-16 h-16 shrink-0">
                                        <Image src={schoolInfo.logoUrl} alt="Logo" fill className="object-contain" />
                                    </div>
                                )}
                                <div className="text-center flex-grow">
                                    <h1 className="text-2xl font-black text-primary leading-tight">{schoolInfo.name}</h1>
                                    <p className="text-xs font-bold text-slate-700">{schoolInfo.address}</p>
                                    <p className="text-[10px] font-bold text-slate-600 mt-0.5">
                                        EIIN: {toBengaliNumber(schoolInfo.eiin)} | কোড: {toBengaliNumber(schoolInfo.code)} | শিক্ষাবর্ষ: {toBengaliNumber(academicYear)}
                                    </p>
                                </div>
                                <div className="w-16 h-16 shrink-0 flex flex-col justify-center items-end text-[10px] font-bold text-muted-foreground">
                                    <span>পৃষ্ঠা: {toBengaliNumber(pageIdx + 1)}/{toBengaliNumber(paginatedResults.length)}</span>
                                </div>
                            </header>

                            <div className="relative z-10 text-center mb-4">
                                <h2 className="inline-block bg-primary text-white text-lg font-black px-8 py-1 rounded-full shadow-md">
                                    {examName} - মেধা তালিকা
                                </h2>
                                <p className="mt-2 font-bold text-slate-700 text-sm">
                                    শ্রেণি: {classNamesMap[className]} {groupFilter !== 'all' && `(${groupNamesMap[groupFilter] || groupFilter})`}
                                </p>
                            </div>

                            <main className="relative z-10 merit-main-content">
                                <div className="border-2 border-slate-800 rounded-sm overflow-hidden">
                                    <Table className="border-collapse">
                                        <TableHeader>
                                            <TableRow className="bg-slate-100 border-b-2 border-slate-800 h-9">
                                                <TableHead className="text-center font-black text-slate-900 border-r border-slate-800 w-16 text-xs">মেধা</TableHead>
                                                <TableHead className="text-center font-black text-slate-900 border-r border-slate-800 w-16 text-xs">রোল</TableHead>
                                                <TableHead className="font-black text-slate-900 border-r border-slate-800 text-xs">শিক্ষার্থীর নাম</TableHead>
                                                <TableHead className="text-center font-black text-slate-900 border-r border-slate-800 text-xs">মোট নম্বর</TableHead>
                                                <TableHead className="text-center font-black text-slate-900 border-r border-slate-800 text-xs">জি.পি.এ</TableHead>
                                                <TableHead className="text-center font-black text-slate-900 border-r border-slate-800 text-xs">গ্রেড</TableHead>
                                                <TableHead className="text-center font-black text-slate-900 text-xs">ফলাফল</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pageData.map((res, pageInternalIdx) => {
                                                const globalIdx = (pageIdx * STUDENTS_PER_PAGE) + pageInternalIdx;
                                                return (
                                                    <TableRow key={res.student.id} className={cn(
                                                        "h-10 border-b border-slate-300 last:border-b-0",
                                                        !res.isPass && "bg-rose-50/50"
                                                    )}>
                                                        <TableCell className="text-center font-black border-r border-slate-300 text-[12px]">
                                                            {res.isPass ? toBengaliNumber(globalIdx + 1) : '-'}
                                                        </TableCell>
                                                        <TableCell className="text-center font-bold border-r border-slate-300 text-[12px]">
                                                            {toBengaliNumber(res.student.roll)}
                                                        </TableCell>
                                                        <TableCell className="font-bold border-r border-slate-300 pl-3 text-[12px]">
                                                            {res.student.studentNameBn}
                                                        </TableCell>
                                                        <TableCell className="text-center font-black border-r border-slate-300 text-primary text-[12px]">
                                                            {toBengaliNumber(res.totalMarks)}
                                                        </TableCell>
                                                        <TableCell className="text-center font-black border-r border-slate-300 text-[12px]">
                                                            {toBengaliNumber(res.gpa.toFixed(2))}
                                                        </TableCell>
                                                        <TableCell className={cn("text-center font-bold border-r border-slate-300 text-[12px]", !res.isPass && "text-rose-600")}>
                                                            {res.isPass ? res.finalGrade : `F${res.failedSubjectsCount}`}
                                                        </TableCell>
                                                        <TableCell className={cn(
                                                            "text-center font-black text-[11px]",
                                                            res.isPass ? "text-emerald-700" : "text-rose-700"
                                                        )}>
                                                            {res.isPass ? 'কৃতকার্য' : 'অকৃতকার্য'}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </main>

                            {/* Ensure footer is always pushed towards the bottom, but above the 12.7mm margin */}
                            {pageIdx === paginatedResults.length - 1 ? (
                                <footer className="relative z-10 pt-10 flex justify-around items-end print-footer mt-auto pb-4">
                                    <div className="text-center">
                                        <div className="w-48 border-t border-black pt-1 font-bold text-sm">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="w-48 border-t border-black pt-1 font-bold text-sm">প্রধান শিক্ষকের স্বাক্ষর</div>
                                    </div>
                                </footer>
                            ) : (
                                <footer className="relative z-10 pt-4 text-center mt-auto pb-4">
                                    <p className="text-[9px] text-slate-400 italic">তালিকা পরবর্তী পৃষ্ঠায় চলমান...</p>
                                </footer>
                            )}
                            
                            <div className="text-[8px] text-slate-400 italic text-center relative z-10 mt-1">
                                রিপোর্ট জেনারেট করার তারিখ: {format(new Date(), 'PPpp', { locale: bn })} | Birganj Pouro High School Management System
                            </div>
                        </div>
                    ))
                )}
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

