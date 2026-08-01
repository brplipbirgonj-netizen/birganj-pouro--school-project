'use client';

import { QRCodeCanvas } from 'qrcode.react';
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
    'science': 'বিজ্ঞান', 'arts': 'মানবিক', 'commerce': 'ব্যবসায় শিক্ষা', 'general': 'সাধারণ'
};

export const StudentIDCard = ({ student, schoolInfo, isPrint = false }: StudentIDCardProps) => {
    const isHigherClass = parseInt(student.className) >= 9;
    const sanitizedUrl = sanitizePhotoUrl(student.photoUrl, student.gender) || getStudentPlaceholderImage(student.gender);
    
    // Construct QR code data string
    const qrData = `Student ID: ${student.generatedId || 'N/A'}
Name: ${student.studentNameBn}
Class: ${classNamesMap[student.className] || student.className}
Roll: ${student.roll}
Group: ${student.group || 'General'}
Guardian: ${student.guardianMobile || 'N/A'}
School: ${schoolInfo.name}`;

    return (
        <div className={cn(
            "student-id-card font-kalpurush flex flex-col border-[3px] border-primary overflow-hidden bg-white relative box-border",
            isPrint ? "w-[54mm] h-[86mm]" : "w-[280px] h-[440px] shadow-2xl rounded-2xl"
        )}>
            {/* Reduced Header Area */}
            <div className={cn(
                "absolute top-0 left-0 right-0 bg-primary clip-header-path-shallow",
                isPrint ? "h-[28mm]" : "h-32"
            )}></div>
            
            <header className="relative z-10 flex flex-col items-center pt-2 pb-1 text-white">
                {schoolInfo.logoUrl && (
                    <div className={cn(
                        "bg-white rounded-full p-0.5 shadow-md mb-1 border border-white",
                        isPrint ? "w-8 h-8" : "w-14 h-14"
                    )}>
                        <img 
                            src={schoolInfo.logoUrl} 
                            alt="Logo" 
                            className="object-contain w-full h-full rounded-full"
                        />
                    </div>
                )}
                <div className="flex flex-col items-center px-1 text-center">
                    <h1 className={cn(
                        "font-black leading-none drop-shadow-md",
                        isPrint ? "text-[10px]" : "text-[16px]"
                    )}>
                        {schoolInfo.name}
                    </h1>
                    <p className={cn(
                        "font-bold text-white/90 tracking-tighter mt-0.5",
                        isPrint ? "text-[6px]" : "text-[9px]"
                    )}>
                        {schoolInfo.address}
                    </p>
                </div>
            </header>

            <main className="relative z-10 flex-1 flex flex-col items-center pt-1 px-3">
                {/* Photo & QR Section */}
                <div className="flex items-center justify-between gap-2 w-full mb-2">
                    {/* Student Photo */}
                    <div className={cn(
                        "relative border-2 border-primary bg-white overflow-hidden rounded shadow-md flex items-center justify-center",
                        isPrint ? "w-[22mm] h-[28mm]" : "w-28 h-34"
                    )}>
                        <img 
                            src={sanitizedUrl} 
                            alt={student.studentNameBn} 
                            className="object-cover w-full h-full"
                            style={{ display: 'block' }}
                        />
                    </div>

                    {/* QR Code */}
                    <div className={cn(
                        "flex flex-col items-center justify-center border-2 border-primary/20 p-1 rounded bg-white shadow-sm",
                        isPrint ? "w-[22mm] h-[22mm]" : "w-[90px] h-[90px]"
                    )}>
                        <QRCodeCanvas 
                            value={qrData}
                            size={isPrint ? 75 : 85}
                            level={"H"}
                            includeMargin={false}
                        />
                    </div>
                </div>

                {/* Identity Badge */}
                <div className="bg-primary text-white px-6 py-0.5 rounded-full mb-2 shadow border-b border-primary-foreground/20">
                    <span className={cn("font-black uppercase tracking-widest", isPrint ? "text-[9px]" : "text-[12px]")}>পরিচয়পত্র</span>
                </div>

                {/* Student Name */}
                <div className="flex flex-col items-center mb-1 w-full">
                    <h2 className={cn("font-black text-primary leading-tight text-center", isPrint ? "text-[13px]" : "text-[20px]")}>
                        {student.studentNameBn}
                    </h2>
                    <p className={cn("font-bold text-slate-400 uppercase tracking-tighter text-center", isPrint ? "text-[7px]" : "text-[10px]")}>
                        {student.studentNameEn || '-'}
                    </p>
                </div>

                {/* Consolidated Information Grid */}
                <div className="w-full border-t border-primary/10 pt-1.5 flex flex-col gap-1">
                    <div className={cn("flex justify-between items-baseline font-black border-b border-slate-50 pb-0.5", isPrint ? "text-[10px]" : "text-[15px]")}>
                        <span className="text-slate-500 font-bold">শ্রেণি ও রোল</span>
                        <span className="text-slate-900">: {classNamesMap[student.className] || student.className}, {toBengaliNumber(student.roll)}</span>
                    </div>

                    {isHigherClass && student.group && (
                        <div className={cn("flex justify-between items-baseline font-black border-b border-slate-50 pb-0.5", isPrint ? "text-[10px]" : "text-[15px]")}>
                            <span className="text-slate-500 font-bold">বিভাগ</span>
                            <span className="text-slate-900">: {groupMapBn[student.group.toLowerCase()] || student.group}</span>
                        </div>
                    )}

                    <div className={cn("flex justify-between items-baseline font-black border-b border-slate-50 pb-0.5", isPrint ? "text-[10px]" : "text-[15px]")}>
                        <span className="text-slate-500 font-bold">শিক্ষার্থী আইডি</span>
                        <span className="text-primary font-black">: {student.generatedId ? toBengaliNumber(student.generatedId) : '-'}</span>
                    </div>

                    <div className={cn("flex justify-between items-baseline font-black border-b border-slate-50 pb-0.5", isPrint ? "text-[10px]" : "text-[15px]")}>
                        <span className="text-slate-500 font-bold">শিক্ষাবর্ষ</span>
                        <span className="text-slate-900">: {toBengaliNumber(student.academicYear)}</span>
                    </div>

                    <div className={cn("flex justify-between items-baseline font-black", isPrint ? "text-[10px]" : "text-[15px]")}>
                        <span className="text-slate-500 font-bold">মোবাইল নং</span>
                        <span className="text-slate-900">: {toBengaliNumber(student.guardianMobile || '')}</span>
                    </div>
                </div>
            </main>

            {/* Footer Signature Section */}
            <footer className="relative z-10 pt-2 pb-1 flex flex-col items-center mt-auto">
                <div className={cn("border-t-2 border-black mb-0.5", isPrint ? "w-16" : "w-36")}></div>
                <p className={cn("font-black text-slate-800", isPrint ? "text-[8px]" : "text-[13px]")}>প্রধান শিক্ষকের স্বাক্ষর</p>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary"></div>
            </footer>

            <style jsx>{`
                .clip-header-path-shallow {
                    clip-path: ellipse(110% 80% at 50% 0%);
                }
                @media print {
                    .student-id-card {
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                    }
                    img {
                        display: block !important;
                        visibility: visible !important;
                    }
                }
            `}</style>
        </div>
    );
};
