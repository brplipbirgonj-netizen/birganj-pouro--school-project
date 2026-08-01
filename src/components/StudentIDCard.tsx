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

const groupMapBn: Record<string, string> = {
    'science': 'বিজ্ঞান', 'arts': 'মানবিক', 'commerce': 'ব্যবসায় শিক্ষা'
};

export const StudentIDCard = ({ student, schoolInfo, isPrint = false }: StudentIDCardProps) => {
    const isHigherClass = parseInt(student.className) >= 9;
    const sanitizedUrl = sanitizePhotoUrl(student.photoUrl, student.gender);
    
    return (
        <div className={cn(
            "student-id-card font-kalpurush flex flex-col border-[2px] border-primary overflow-hidden bg-white relative box-border",
            isPrint ? "w-[54mm] h-[86mm]" : "w-[260px] h-[410px] shadow-2xl rounded-xl"
        )}>
            {/* Design Header Background */}
            <div className={cn(
                "absolute top-0 left-0 right-0 bg-primary clip-header-path",
                isPrint ? "h-[35mm]" : "h-32"
            )}></div>
            
            <header className="relative z-10 flex flex-col items-center pt-3 pb-1 text-white">
                {schoolInfo.logoUrl && (
                    <div className={cn(
                        "bg-white rounded-full p-0.5 shadow-md mb-1",
                        isPrint ? "w-9 h-9" : "w-12 h-12"
                    )}>
                        <Image 
                            src={schoolInfo.logoUrl} 
                            alt="Logo" 
                            width={48} 
                            height={48} 
                            className="object-contain w-full h-full rounded-full"
                            unoptimized
                        />
                    </div>
                )}
                <div className="flex flex-col items-center px-1 text-center">
                    <h1 className={cn(
                        "font-black leading-tight drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]",
                        isPrint ? "text-[11px]" : "text-[16px]"
                    )}>
                        {schoolInfo.name}
                    </h1>
                    <p className={cn(
                        "font-bold opacity-100 text-white/90",
                        isPrint ? "text-[7px]" : "text-[9px]"
                    )}>
                        {schoolInfo.address}
                    </p>
                </div>
            </header>

            <main className="relative z-10 flex-1 flex flex-col items-center pt-1.5 px-3">
                {/* Photo Section */}
                <div className="relative mb-2">
                    <div className={cn(
                        "relative border-[2px] border-primary bg-white overflow-hidden rounded-md shadow-md",
                        isPrint ? "w-20 h-28" : "w-28 h-36"
                    )}>
                        <Image 
                            src={sanitizedUrl || getStudentPlaceholderImage(student.gender)} 
                            alt={student.studentNameBn} 
                            fill
                            className="object-cover" 
                            unoptimized
                            data-ai-hint={isFemale(student.gender) ? "girl face" : "boy face"}
                        />
                    </div>
                </div>

                {/* Identity Title */}
                <div className="bg-primary text-white px-5 py-0.5 rounded-full mb-2 shadow-sm border border-white/20">
                    <span className={cn("font-black uppercase tracking-widest", isPrint ? "text-[9px]" : "text-[12px]")}>পরিচয়পত্র</span>
                </div>

                {/* Name Section */}
                <div className="flex flex-col items-center mb-2 w-full">
                    <h2 className={cn("font-black text-primary leading-tight text-center", isPrint ? "text-[13px]" : "text-xl")}>
                        {student.studentNameBn}
                    </h2>
                    <p className={cn("font-bold text-slate-500 uppercase tracking-tighter text-center mt-0.5", isPrint ? "text-[7px]" : "text-[10px]")}>
                        {student.studentNameEn || '-'}
                    </p>
                </div>

                {/* Details Grid */}
                <div className="w-full border-t border-slate-200 pt-2 space-y-0.5">
                    <div className={cn(
                        "grid grid-cols-[1.8fr_3fr] gap-x-1 font-bold leading-tight items-baseline",
                        isPrint ? "text-[10px]" : "text-[13px]"
                    )}>
                        <span className="text-slate-500">শ্রেণি</span>
                        <span className="text-slate-900">: {classNamesMap[student.className] || student.className}</span>
                        
                        {isHigherClass && student.group && (
                            <>
                                <span className="text-slate-500">বিভাগ</span>
                                <span className="text-slate-900">: {groupMapBn[student.group.toLowerCase()] || student.group}</span>
                            </>
                        )}

                        <span className="text-slate-500">রোল</span>
                        <span className="text-slate-900 font-black">: {toBengaliNumber(student.roll)}</span>
                        
                        <span className="text-slate-500">আইডি</span>
                        <span className="text-slate-900 font-black text-primary">: {student.generatedId ? toBengaliNumber(student.generatedId) : '-'}</span>
                        
                        <span className="text-slate-500">শিক্ষাবর্ষ</span>
                        <span className="text-slate-900">: {toBengaliNumber(student.academicYear)}</span>

                        <span className="text-slate-500">মোবাইল নং</span>
                        <span className="text-slate-900">: {toBengaliNumber(student.guardianMobile || '')}</span>
                    </div>
                </div>
            </main>

            {/* Footer / Signature */}
            <footer className="relative z-10 pt-4 pb-2 flex flex-col items-center mt-auto">
                <div className={cn("border-t-[1.5px] border-black mb-0.5", isPrint ? "w-20" : "w-32")}></div>
                <p className={cn("font-black text-slate-800", isPrint ? "text-[8px]" : "text-[11px]")}>প্রধান শিক্ষকের স্বাক্ষর</p>
                
                {/* Bottom colored bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-primary"></div>
            </footer>

            <style jsx>{`
                .clip-header-path {
                    clip-path: ellipse(120% 70% at 50% 0%);
                }
                .student-id-card {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            `}</style>
        </div>
    );
};