'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Printer, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Staff } from '@/lib/staff-data';
import Link from 'next/link';

const toBengaliNumber = (str: string | number) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

export default function CustomPadPage() {
    const db = useFirestore();
    const { schoolInfo, isLoading: isSchoolInfoLoading } = useSchoolInfo();

    const [headmaster, setHeadmaster] = useState<Staff | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db) return;

        const fetchHeadmaster = async () => {
            setIsLoading(true);
            try {
                const staffSnapshot = await getDocs(query(
                    collection(db, 'staff'),
                    where('isActive', '==', true),
                    where('designation', 'in', ['প্রধান শিক্ষক', 'প্রধান শিক্ষক (ভারপ্রাপ্ত)'])
                ));
                
                if (!staffSnapshot.empty) {
                    const hmDoc = staffSnapshot.docs[0];
                    setHeadmaster({ id: hmDoc.id, ...hmDoc.data() } as Staff);
                }
            } catch (e) {
                console.error(e);
            }
            setIsLoading(false);
        };
        fetchHeadmaster();
    }, [db]);

    if (isLoading || isSchoolInfoLoading) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-100">লোড হচ্ছে...</div>;
    }
    
    const issueDate = toBengaliNumber(format(new Date(), "d MMMM, yyyy", { locale: bn }));

    return (
        <div className="bg-gray-100 p-4 sm:p-8 font-kalpurush print:p-0 print:bg-white min-h-screen flex flex-col items-center">
            {/* Action Bar */}
            <div className="w-full max-w-[210mm] flex justify-between items-center mb-6 no-print bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center gap-4">
                    <Link href="/documents">
                        <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold text-primary">প্রতিষ্ঠানের প্যাড</h1>
                        <p className="text-sm text-muted-foreground">ডকুমেন্ট লিখে প্রিন্ট করুন</p>
                    </div>
                </div>
                <Button onClick={() => window.print()} size="lg" className="shadow-lg">
                    <Printer className="mr-2 h-5 w-5" />
                    প্রিন্ট করুন
                </Button>
            </div>

            {/* Letterhead Page */}
            <div className="w-[210mm] h-[297mm] bg-white mx-auto shadow-2xl relative text-black flex flex-col print:shadow-none print:m-0 print:border-none p-10 box-border overflow-hidden">
                
                {/* Header Section (Same as Testimonial) */}
                <div 
                    className="printable-header w-full p-2 relative text-center bg-white border-b-4 border-gray-300 mb-4 min-h-[140px] flex items-center justify-center"
                    style={{
                        backgroundImage: `
                            linear-gradient(to right, rgba(45, 87, 44, 0.08) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(45, 87, 44, 0.08) 1px, transparent 1px)
                        `,
                        backgroundSize: '12px 12px'
                    }}
                >
                    <div className="flex justify-between items-center w-full relative z-10">
                        <div className="w-20 h-20 flex items-center justify-center">
                            {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="School Logo" width={80} height={80} className="object-contain" />}
                        </div>
                        <div className="text-center flex-grow px-2">
                            <p className="text-lg font-bold text-[#2d572c] mb-0.5">প্রধান শিক্ষকের কার্যালয়</p>
                            <h1 className="text-3xl sm:text-4xl font-black mb-1 tracking-tight whitespace-nowrap overflow-hidden text-ellipsis" style={{color: '#2d572c'}}>
                                {schoolInfo.name}
                            </h1>
                            <p className="text-md font-bold text-[#2d572c] mb-0.5">স্থাপিতঃ ২০১৯ খ্রিঃ</p>
                            <p className="text-[11px] font-bold text-[#2d572c] tracking-wide">
                                Upazila: Birganj, Post: Birganj, Zila: Dinajpur | মোবাইলঃ ০১৭১৭৫৭৬০৩০
                            </p>
                            <p className="text-[11px] text-red-600 font-bold">
                                ই-মেইল: birganjpourohsch2019@gmail.com
                            </p>
                        </div>
                        <div className="w-20 h-20"></div>
                    </div>
                </div>

                <div className="pt-2 pb-1 flex justify-between text-md font-bold">
                    <span contentEditable={true} suppressContentEditableWarning={true} className="outline-none focus:bg-blue-50 px-1">স্মারক নং- বিপৌউবি/......................</span>
                    <span contentEditable={true} suppressContentEditableWarning={true} className="outline-none focus:bg-blue-50 px-1">তারিখঃ {issueDate}</span>
                </div>

                {/* Watermark */}
                {schoolInfo.logoUrl && (
                    <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
                        <Image src={schoolInfo.logoUrl} alt="School Logo Watermark" width={400} height={400} className="opacity-10" />
                    </div>
                )}
                
                {/* Body Section */}
                <main 
                    className="py-10 z-10 relative text-justify flex-grow leading-relaxed text-xl outline-none focus:ring-1 focus:ring-blue-400 no-print-outline"
                    contentEditable={true}
                    suppressContentEditableWarning={true}
                >
                    <p>আপনার ডকুমেন্ট এখানে লিখুন...</p>
                </main>
                
                {/* Footer Section */}
                <div className="print-footer pb-8 z-10 text-right mt-auto">
                    <div className="inline-block text-center">
                        <div className="w-72 border-t-2 border-black pt-1">
                            <p className="font-black text-lg mb-0.5">{headmaster?.nameBn || '[প্রধান শিক্ষকের নাম]'}</p>
                            <p className="font-bold text-gray-700 text-md">{headmaster?.designation || 'প্রধান শিক্ষক'}</p>
                            <p className="font-bold text-gray-700 text-md">{schoolInfo.name}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}