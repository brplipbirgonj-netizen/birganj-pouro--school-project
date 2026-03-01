'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { getStudentById, Student } from '@/lib/student-data';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Staff } from '@/lib/staff-data';
import Link from 'next/link';

const classNamesMap: { [key: string]: string } = {
    '6': 'ষষ্ঠ', '7': 'সপ্তম', '8': 'অষ্টম', '9': 'নবম', '10': 'দশম',
};

const toBengaliNumber = (str: string | number) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};


export default function TestimonialPage() {
    const params = useParams();
    const studentId = params.id as string;
    const db = useFirestore();
    const { schoolInfo, isLoading: isSchoolInfoLoading } = useSchoolInfo();

    const [student, setStudent] = useState<Student | null>(null);
    const [headmaster, setHeadmaster] = useState<Staff | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!studentId || !db) return;

        const fetchData = async () => {
            setIsLoading(true);
            
            try {
                const [studentData, staffSnapshot] = await Promise.all([
                    getStudentById(db, studentId),
                    getDocs(query(
                        collection(db, 'staff'),
                        where('isActive', '==', true),
                        where('designation', 'in', ['প্রধান শিক্ষক', 'প্রধান শিক্ষক (ভারপ্রাপ্ত)'])
                    ))
                ]);
                
                setStudent(studentData || null);

                if (!staffSnapshot.empty) {
                    const hmDoc = staffSnapshot.docs[0];
                    setHeadmaster({ id: hmDoc.id, ...hmDoc.data() } as Staff);
                }
            } catch (e) {
                console.error(e);
            }

            setIsLoading(false);
        };
        fetchData();
    }, [studentId, db]);

    if (isLoading || isSchoolInfoLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground font-medium">ডকুমেন্ট তৈরি হচ্ছে...</p>
            </div>
        );
    }

    if (!student) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-100 font-kalpurush text-xl">শিক্ষার্থী পাওয়া যায়নি।</div>;
    }
    
    const issueDate = toBengaliNumber(format(new Date(), "d MMMM, yyyy", { locale: bn }));
    const studentDob = student.dob ? toBengaliNumber(format(new Date(student.dob), "d MMMM, yyyy", { locale: bn })) : 'প্রযোজ্য নয়';

    return (
        <div className="bg-gray-100 p-4 sm:p-8 font-kalpurush print:p-0 print:bg-white min-h-screen flex flex-col items-center">
            {/* Action Bar */}
            <div className="w-full max-w-[210mm] flex justify-between items-center mb-6 no-print bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center gap-4">
                    <Link href="/student-list">
                        <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-primary">প্রত্যয়ন পত্র প্রিভিউ</h1>
                        <p className="text-sm text-muted-foreground">{student.studentNameBn}</p>
                    </div>
                </div>
                <Button onClick={() => window.print()} size="lg" className="shadow-lg">
                    <Printer className="mr-2 h-5 w-5" />
                    প্রিন্ট করুন
                </Button>
            </div>

            {/* Testimonial Page */}
            <div className="w-[210mm] min-h-[297mm] bg-white mx-auto shadow-2xl relative text-black flex flex-col print:shadow-none print:m-0 print:border-none p-10 box-border">
                
                {/* Header Section - Uses div with printable-header to avoid being hidden */}
                <div 
                    className="printable-header w-full p-4 relative text-center bg-white border-b-4 border-gray-300 mb-6 min-h-[150px] flex items-center justify-center"
                    style={{
                        backgroundImage: `
                            linear-gradient(to right, rgba(45, 87, 44, 0.08) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(45, 87, 44, 0.08) 1px, transparent 1px)
                        `,
                        backgroundSize: '12px 12px'
                    }}
                >
                    <div className="flex justify-between items-center w-full relative z-10">
                        <div className="w-24 h-24 flex items-center justify-center">
                            {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="School Logo" width={90} height={90} className="object-contain" />}
                        </div>
                        <div className="text-center flex-grow px-2">
                            <p className="text-xl font-bold text-[#2d572c] mb-1">প্রধান শিক্ষকের কার্যালয়</p>
                            <h1 className="text-4xl sm:text-5xl font-black mb-2 tracking-tight whitespace-nowrap" style={{color: '#2d572c'}}>
                                {schoolInfo.name || 'বীরগঞ্জ পৌর উচ্চ বিদ্যালয়'}
                            </h1>
                            <p className="text-lg font-bold text-[#2d572c] mb-1">স্থাপিতঃ ২০১৯ খ্রিঃ</p>
                            <p className="text-sm font-bold text-[#2d572c] tracking-wide">
                                Upazila: Birganj, Post: Birganj, Zila: Dinajpur | মোবাইলঃ ০১৭১৭৫৭৬০৩০
                            </p>
                            <p className="text-sm text-red-600 font-bold mt-1">
                                ই-মেইল: birganjpourohsch2019@gmail.com
                            </p>
                        </div>
                        <div className="w-24 h-24"></div>
                    </div>
                </div>

                <div className="pt-4 pb-2 flex justify-between text-lg font-bold">
                    <span>স্মারক নং- বিপৌউবি/......................</span>
                    <span>তারিখঃ {issueDate}</span>
                </div>

                {/* Watermark */}
                {schoolInfo.logoUrl && (
                    <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
                        <Image src={schoolInfo.logoUrl} alt="School Logo Watermark" width={450} height={450} className="opacity-10" />
                    </div>
                )}
                
                {/* Body Section */}
                <main className="py-12 z-10 relative text-justify flex-grow">
                    <div className="text-center mb-12">
                        <h2 className="text-4xl font-black inline-block border-b-4 border-black pb-1 uppercase tracking-widest">প্রত্যয়ন পত্র</h2>
                    </div>

                    <p className="text-2xl leading-[2.4] indent-16">
                        এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, <span className="font-black text-3xl underline decoration-dotted">{student.studentNameBn}</span>, 
                        পিতা: <span className="font-bold">{student.fatherNameBn}</span>, 
                        মাতা: <span className="font-bold">{student.motherNameBn}</span>, 
                        গ্রাম: <span className="font-bold">{student.permanentVillage || student.presentVillage || 'বিবিধ'}</span>, 
                        ডাকঘর: <span className="font-bold">{student.permanentPostOffice || student.presentPostOffice || 'বিবিধ'}</span>, 
                        উপজেলা: <span className="font-bold">{student.permanentUpazila || student.presentUpazila || 'বীরগঞ্জ'}</span>, 
                        জেলা: <span className="font-bold">{student.permanentDistrict || student.presentDistrict || 'দিনাজপুর'}</span>। 
                        সে অত্র বিদ্যালয়ে <span className="font-black text-3xl">{classNamesMap[student.className] || student.className}</span> শ্রেণিতে অধ্যয়নরত আছে। 
                        তার শ্রেণি রোল নম্বর <span className="font-bold">{toBengaliNumber(student.roll)}</span> এবং জন্ম তারিখ <span className="font-bold">{studentDob}</span>।
                    </p>

                    <p className="text-2xl leading-[2.4] mt-12">
                        আমার জানামতে সে রাষ্ট্রবিরোধী বা আইন শৃঙ্খলা পরিপন্থী কোনো কাজের সাথে জড়িত নয়। তার স্বভাব এবং চরিত্র অত্যন্ত প্রশংসনীয়। সে বিদ্যালয়ের সকল নিয়ম-কানুন মেনে চলে।
                    </p>

                    <p className="text-2xl leading-[2.4] mt-12">
                        আমি তার উজ্জ্বল ভবিষ্যৎ ও জীবনের সর্বাঙ্গীণ উন্নতি কামনা করি।
                    </p>
                </main>
                
                {/* Footer Section - Uses div with print-footer to avoid being hidden */}
                <div className="print-footer pb-24 z-10 text-right mt-auto">
                    <div className="inline-block text-center">
                        <div className="w-80 border-t-2 border-black pt-2">
                            <p className="font-black text-xl mb-1">{headmaster?.nameBn || '[প্রধান শিক্ষকের নাম]'}</p>
                            <p className="font-bold text-gray-700 text-lg">{headmaster?.designation || 'প্রধান শিক্ষক'}</p>
                            <p className="font-bold text-gray-700 text-lg">{schoolInfo.name}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
