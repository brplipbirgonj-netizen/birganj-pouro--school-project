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
        <div className="admit-card font-kalpurush flex flex-col p-4 border-2 border-black rounded-sm w-[98mm] h-[138mm] text-black bg-white relative overflow-hidden box-border">
            <header className="flex justify-between items-start mb-2 pb-2 border-b-2 border-black printable-header">
                <div className="flex items-center gap-2">
                    <div className="w-12 h-12 relative flex items-center justify-center">
                        {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" width={48} height={48} className="object-contain" />}
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-[16px] font-black text-[#2d572c] leading-none mb-1">{schoolInfo.name}</h1>
                        <p className="text-[8px] font-bold text-gray-600 leading-tight">{schoolInfo.address}</p>
                    </div>
                </div>
                <div className="border-2 border-black rounded-full px-3 py-1 flex items-center justify-center">
                    <span className="text-[14px] font-black tracking-widest">প্রবেশ পত্র</span>
                </div>
            </header>

            <main className="flex-grow flex flex-col py-2">
                <div className="flex justify-between items-start">
                    <div className="space-y-2 text-[13px] flex-1">
                        <div className="flex">
                            <span className="w-24 font-black">পরীক্ষার নাম</span>
                            <span className="font-black">: {examName}</span>
                        </div>
                        <div className="flex">
                            <span className="w-24 font-black">শিক্ষার্থীর নাম</span>
                            <span className="font-black">: {student.studentNameBn}</span>
                        </div>
                        <div className="flex">
                            <span className="w-24 font-bold">পিতার নাম</span>
                            <span>: {student.fatherNameBn}</span>
                        </div>
                        <div className="flex">
                            <span className="w-24 font-bold">মাতার নাম</span>
                            <span>: {student.motherNameBn}</span>
                        </div>
                        <div className="flex">
                            <span className="w-24 font-bold">শ্রেণি</span>
                            <span>: {classNamesMap[student.className] || student.className}</span>
                        </div>
                        <div className="flex">
                            <span className="w-24 font-bold">রোল</span>
                            <span className="font-black">: {toBengaliNumber(student.roll)}</span>
                        </div>
                        <div className="flex">
                            <span className="w-24 font-bold">আইডি</span>
                            <span className="font-black">: {student.generatedId ? toBengaliNumber(student.generatedId) : '-'}</span>
                        </div>
                    </div>
                    <div className="w-[85px] h-[100px] border-2 border-black p-0.5 bg-white shrink-0 ml-2">
                        {student.photoUrl ? (
                            <Image src={student.photoUrl} alt="Photo" width={85} height={100} className="object-cover w-full h-full" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100 text-[10px] text-gray-400">ছবি নেই</div>
                        )}
                    </div>
                </div>
            </main>

            <footer className="mt-auto">
                <div className="flex justify-between items-end gap-4">
                    <div className="text-[9px] leading-tight flex-1">
                        <p className="font-black underline mb-1">পরীক্ষার্থীদের নিয়মাবলী:</p>
                        <ul className="list-decimal list-inside space-y-0.5 text-gray-800 font-medium">
                            <li>পরীক্ষা শুরুর ৩০ মিনিট পূর্বে আসনে বসতে হবে।</li>
                            <li>অবৈধ কিছু বা মোবাইল ফোন আনা নিষেধ।</li>
                            <li>প্রবেশপত্র অবশ্যই সাথে আনতে হবে।</li>
                        </ul>
                    </div>
                    <div className="text-center w-32 border-t-2 border-black pt-1">
                        <p className="font-black text-[10px]">প্রধান শিক্ষকের স্বাক্ষর</p>
                    </div>
                </div>
            </footer>
        </div>
    );
};