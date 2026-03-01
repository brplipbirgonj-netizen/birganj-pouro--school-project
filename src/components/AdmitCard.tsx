'use client';

import Image from 'next/image';
import { Student } from '@/lib/student-data';
import { SchoolInfo } from '@/lib/school-info';

interface AdmitCardProps {
    student: Student;
    schoolInfo: SchoolInfo;
    examName: string;
}

const toBengaliNumber = (str: string | number) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

const classNamesMap: { [key: string]: string } = {
    '6': 'ষষ্ঠ', '7': 'সপ্তম', '8': 'অষ্টম', '9': 'নবম', '10': 'দশম',
};

export const AdmitCard = ({ student, schoolInfo, examName }: AdmitCardProps) => {
    return (
        <div className="admit-card font-kalpurush flex flex-col justify-between p-4 border-2 border-black rounded-sm w-[100mm] h-[135mm] text-black bg-white relative overflow-hidden box-border">
            <header className="text-center border-b-2 border-black pb-2 mb-2 printable-header">
                 <div className="flex justify-between items-center w-full px-1">
                    <div className="w-12 h-12 flex items-center justify-center">
                        {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="School Logo" width={48} height={48} className="object-contain" />}
                    </div>
                    <div className="text-center flex-1 mx-2">
                        <h1 className="text-[14px] font-bold text-green-800 leading-tight">{schoolInfo.name}</h1>
                        <p className="text-[8px] leading-tight opacity-80">{schoolInfo.address}</p>
                    </div>
                    <div className="w-12 h-12"></div>
                </div>
                <div className="mt-1 inline-block px-4 py-0.5 border border-black rounded-full font-bold text-[12px] bg-gray-100 tracking-widest">
                    প্রবেশ পত্র
                </div>
            </header>

            <main className="flex-grow my-2 relative">
                <div className="grid grid-cols-[1.2fr,2.5fr] gap-x-2 gap-y-1.5 text-[12px] pr-24">
                    <div className="font-bold">পরীক্ষার নাম</div>
                    <div className="font-bold">: {examName}</div>

                    <div className="font-bold">শিক্ষার্থীর নাম</div>
                    <div className="font-bold">: {student.studentNameBn}</div>

                    <div className="font-bold">পিতার নাম</div>
                    <div>: {student.fatherNameBn}</div>
                    
                    <div className="font-bold">মাতার নাম</div>
                    <div>: {student.motherNameBn}</div>

                    <div className="font-bold">শ্রেণি</div>
                    <div>: {classNamesMap[student.className] || student.className}</div>
                    
                    <div className="font-bold">রোল</div>
                    <div className="font-bold">: {toBengaliNumber(student.roll)}</div>

                    <div className="font-bold">আইডি</div>
                    <div className="font-bold">: {student.generatedId ? toBengaliNumber(student.generatedId) : '-'}</div>
                </div>

                <div className="absolute right-0 top-0 border-2 border-black p-0.5 bg-white shadow-sm">
                    {student.photoUrl ? (
                        <Image src={student.photoUrl} alt="Student Photo" width={75} height={90} className="object-cover" />
                    ) : (
                        <div className="w-[75px] h-[90px] flex items-center justify-center text-[10px] text-gray-400 bg-gray-50">ছবি নেই</div>
                    )}
                </div>
            </main>
            
            <footer className="mt-auto pt-2 flex justify-between items-end">
                <div className="text-[9px] max-w-[65%] leading-tight">
                    <p className="font-bold underline mb-1">পরীক্ষার্থীদের নিয়মাবলী:</p>
                    <ul className="list-decimal list-inside text-gray-800 space-y-0.5">
                        <li>পরীক্ষা শুরুর ৩০ মিনিট পূর্বে আসনে বসতে হবে।</li>
                        <li>অবৈধ কিছু বা মোবাইল ফোন আনা নিষেধ।</li>
                        <li>প্রবেশপত্র অবশ্যই সাথে আনতে হবে।</li>
                    </ul>
                </div>
                <div className="text-center">
                    <div className="w-28 border-t-2 border-black pt-1">
                        <p className="font-bold text-[10px]">প্রধান শিক্ষকের স্বাক্ষর</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};