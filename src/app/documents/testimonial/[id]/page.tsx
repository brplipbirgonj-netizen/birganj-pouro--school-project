'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { getStudentById, Student } from '@/lib/student-data';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Staff } from '@/lib/staff-data';

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

            setIsLoading(false);
        };
        fetchData();
    }, [studentId, db]);

    if (isLoading || isSchoolInfoLoading) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-100">লোড হচ্ছে...</div>;
    }

    if (!student) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-100">শিক্ষার্থী পাওয়া যায়নি।</div>;
    }
    
    const issueDate = toBengaliNumber(format(new Date(), "d MMMM, yyyy", { locale: bn }));
    const studentDob = student.dob ? toBengaliNumber(format(new Date(student.dob), "d MMMM, yyyy", { locale: bn })) : 'প্রযোজ্য নয়';

    return (
        <div className="bg-gray-100 p-8 font-kalpurush print:p-0 print:bg-white min-h-screen">
            <div className="fixed top-8 right-8 z-50 no-print">
                <Button onClick={() => window.print()} size="lg" className="shadow-lg">
                    <Printer className="mr-2 h-5 w-5" />
                    প্রিন্ট করুন
                </Button>
            </div>

            <div className="w-[210mm] h-[297mm] bg-white mx-auto shadow-2xl relative text-black flex flex-col print:shadow-none print:m-0 print:border-none">
                {/* Header Section */}
                <header 
                    className="h-[100px] p-2 relative text-center bg-white border-b-2 border-gray-300"
                    style={{
                        backgroundImage: `
                            repeating-linear-gradient(to right, #eaf5e8, #eaf5e8 1px, transparent 1px, transparent 10px),
                            repeating-linear-gradient(to bottom, #eaf5e8, #eaf5e8 1px, transparent 1px, transparent 10px)
                        `,
                        backgroundSize: '10px 10px'
                    }}
                >
                    <div className="flex justify-between items-center h-full">
                        <div className="w-24 h-24 flex items-center justify-center">
                            {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="School Logo" width={80} height={80} className="object-contain" />}
                        </div>
                        <div className="text-center text-green-800">
                            <p className="text-lg">প্রধান শিক্ষকের কার্যালয়</p>
                            <h1 className="text-4xl font-bold" style={{color: '#2d572c'}}>{schoolInfo.name}</h1>
                            <p className="text-sm"> স্থাপিতঃ ২০১৯ খ্রিঃ</p>
                            <p className="text-xs mt-1">{schoolInfo.address} | মোবাইলঃ ০১৭১৭৫৭৬০৩০</p>
                            <p className="text-xs text-red-600 font-semibold">ই-মেইল: birganjpourohsch2019@gmail.com</p>
                        </div>
                        <div className="w-24 h-24"></div>
                    </div>
                </header>
                 <div className="px-10 pt-4 pb-2 flex justify-between text-sm font-medium">
                    <span>স্মারক নং- </span>
                    <span>তারিখঃ {issueDate}</span>
                </div>

                {/* Watermark */}
                {schoolInfo.logoUrl && (
                    <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
                        <Image src={schoolInfo.logoUrl} alt="School Logo Watermark" width={350} height={350} className="opacity-10" />
                    </div>
                )}
                
                {/* Body Section */}
                <main className="px-10 py-6 z-10 relative text-justify flex-grow leading-loose">
                    <h2 className="text-2xl font-bold text-center underline mb-6">প্রত্যয়ন পত্র</h2>

                    <p className="text-base">
                        এই মর্মে প্রত্যয়ন করা যাচ্ছে যে, <span className="font-semibold">{student.studentNameBn}</span>, 
                        পিতা: <span className="font-semibold">{student.fatherNameBn}</span>, 
                        মাতা: <span className="font-semibold">{student.motherNameBn}</span>, 
                        গ্রাম: <span className="font-semibold">{student.permanentVillage || student.presentVillage || ''}</span>, 
                        ডাকঘর: <span className="font-semibold">{student.permanentPostOffice || student.presentPostOffice || ''}</span>, 
                        উপজেলা: <span className="font-semibold">{student.permanentUpazila || student.presentUpazila || ''}</span>, 
                        জেলা: <span className="font-semibold">{student.permanentDistrict || student.presentDistrict || ''}</span>। 
                        সে এই বিদ্যালয়ে <span className="font-semibold">{classNamesMap[student.className] || student.className}</span> শ্রেণিতে অধ্যয়নরত আছে। 
                        তার শ্রেণি রোল নম্বর <span className="font-semibold">{toBengaliNumber(student.roll)}</span> এবং জন্ম তারিখ <span className="font-semibold">{studentDob}</span>।
                    </p>

                    <p className="text-base mt-6">
                        আমার জানামতে সে রাষ্ট্রবিরোধী বা আইন শৃঙ্খলা পরিপন্থী কোনো কাজের সাথে জড়িত নয়। তার স্বভাব এবং চরিত্র অত্যন্ত প্রশংসনীয়। সে বিদ্যালয়ের সকল নিয়ম-কানুন মেনে চলে।
                    </p>

                    <p className="text-base mt-6">
                        আমি তার উজ্জ্বল ভবিষ্যৎ ও জীবনের সর্বাঙ্গীণ উন্নতি কামনা করি।
                    </p>
                </main>
                
                {/* Footer Section */}
                <footer className="px-10 pb-16 z-10 text-right mt-auto">
                    <div className="inline-block text-center">
                        <div className="w-64 border-t-2 border-dotted border-black pt-2">
                            <p className="font-semibold">{headmaster?.nameBn || '[প্রধান শিক্ষকের নাম]'}</p>
                            <p>{headmaster?.designation || 'প্রধান শিক্ষক'}</p>
                            <p>{schoolInfo.name}</p>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
