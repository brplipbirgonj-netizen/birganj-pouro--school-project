'use client';

import Image from 'next/image';
import { Student, isFemale, getStudentPlaceholderImage, sanitizePhotoUrl } from '@/lib/student-data';
import { SchoolInfo } from '@/lib/school-info';
import { cn } from '@/lib/utils';

interface StudentIDCardProps {
    student: Student;
    schoolInfo: SchoolInfo;
    isPrint?: boolean;
}

const toBengaliNumber = (str: string | number) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

const classNamesMap: { [key: string]: string } = {
    '6': 'ষষ্ঠ', '7': 'সপ্তম', '8': 'অষ্টম', '9': 'নবম', '10': 'দশম',
};

export const StudentIDCard = ({ student, schoolInfo, isPrint = false }: StudentIDCardProps) => {
    return (
        <div className={cn(
            "student-id-card font-kalpurush flex flex-col border-2 border-primary overflow-hidden bg-white relative",
            isPrint ? "w-[54mm] h-[86mm]" : "w-[240px] h-[380px] shadow-2xl rounded-xl"
        )}>
            {/* Design Header Background - Increased height to avoid text clipping */}
            <div className="absolute top-0 left-0 right-0 h-32 bg-primary clip-header-path"></div>
            
            <header className="relative z-10 flex flex-col items-center pt-3 pb-1 text-white">
                {schoolInfo.logoUrl && (
                    <div className="w-10 h-10 bg-white rounded-full p-1 shadow-md mb-1.5">
                        <Image src={schoolInfo.logoUrl} alt="Logo" width={40} height={40} className="object-contain w-full h-full" />
                    </div>
                )}
                <div className="flex flex-col items-center px-2 text-center">
                    <h1 className={cn(
                        "font-black leading-tight drop-shadow-md",
                        isPrint ? "text-[10px]" : "text-[14px]"
                    )}>
                        {schoolInfo.name}
                    </h1>
                    <p className={cn(
                        "font-bold opacity-90",
                        isPrint ? "text-[6px]" : "text-[8px]"
                    )}>
                        {schoolInfo.address}
                    </p>
                </div>
            </header>

            <main className="relative z-10 flex-1 flex flex-col items-center pt-2 px-4">
                {/* Photo Section */}
                <div className="relative mb-3">
                    <div className="absolute -inset-1 bg-primary/20 rounded-lg blur-sm"></div>
                    <div className={cn(
                        "relative border-2 border-primary bg-white overflow-hidden rounded-lg shadow-inner",
                        isPrint ? "w-20 h-24" : "w-28 h-32"
                    )}>
                        <Image 
                            src={sanitizePhotoUrl(student.photoUrl, student.gender) || getStudentPlaceholderImage(student.gender)} 
                            alt="Photo" 
                            fill
                            className="object-cover" 
                            data-ai-hint={isFemale(student.gender) ? "girl face" : "boy face"}
                        />
                    </div>
                </div>

                {/* Identity Title */}
                <div className="bg-primary text-white px-4 py-0.5 rounded-full mb-3 shadow-md">
                    <span className="text-[10px] font-black uppercase tracking-widest">পরিচয়পত্র</span>
                </div>

                {/* Details Section */}
                <div className="w-full space-y-1 text-left">
                    <div className="flex flex-col items-center mb-2">
                        <h2 className={cn("font-black text-primary leading-tight text-center", isPrint ? "text-sm" : "text-lg")}>
                            {student.studentNameBn}
                        </h2>
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter text-center">
                            {student.studentNameEn || '-'}
                        </p>
                    </div>

                    <div className="grid grid-cols-[1.5fr_3fr] gap-x-1 text-[11px] font-bold border-t pt-2">
                        <span className="text-slate-500">শ্রেণি</span>
                        <span className="text-slate-900">: {classNamesMap[student.className] || student.className}</span>
                        
                        <span className="text-slate-500">রোল</span>
                        <span className="text-slate-900">: {toBengaliNumber(student.roll)}</span>
                        
                        <span className="text-slate-500">আইডি</span>
                        <span className="text-slate-900">: {student.generatedId ? toBengaliNumber(student.generatedId) : '-'}</span>
                        
                        <span className="text-slate-500">শিক্ষাবর্ষ</span>
                        <span className="text-slate-900">: {toBengaliNumber(student.academicYear)}</span>

                        <span className="text-slate-500">মোবাইল</span>
                        <span className="text-slate-900">: {toBengaliNumber(student.guardianMobile || '')}</span>
                    </div>
                </div>
            </main>

            {/* Footer / Signature */}
            <footer className="relative z-10 pt-4 pb-3 flex flex-col items-center mt-auto">
                <div className="w-24 border-t border-black mb-0.5"></div>
                <p className="text-[9px] font-black text-slate-800">প্রধান শিক্ষকের স্বাক্ষর</p>
                
                {/* Bottom colored bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary"></div>
            </footer>

            <style jsx>{`
                .clip-header-path {
                    clip-path: ellipse(100% 65% at 50% 0%);
                }
            `}</style>
        </div>
    );
};