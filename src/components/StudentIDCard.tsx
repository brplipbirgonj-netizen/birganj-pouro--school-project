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
            {/* Premium Header with Curved Path */}
            <div className={cn(
                "absolute top-0 left-0 right-0 bg-primary clip-header-path-deep",
                isPrint ? "h-[36mm]" : "h-40"
            )}></div>
            
            <header className="relative z-10 flex flex-col items-center pt-3 pb-2 text-white">
                {schoolInfo.logoUrl && (
                    <div className={cn(
                        "bg-white rounded-full p-0.5 shadow-xl mb-1 border-2 border-white",
                        isPrint ? "w-10 h-10" : "w-16 h-16"
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
                        "font-black leading-tight drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]",
                        isPrint ? "text-[11px]" : "text-[18px]"
                    )}>
                        {schoolInfo.name}
                    </h1>
                    <p className={cn(
                        "font-bold text-white/95 tracking-tight",
                        isPrint ? "text-[6.5px]" : "text-[10px]"
                    )}>
                        {schoolInfo.address}
                    </p>
                </div>
            </header>

            <main className="relative z-10 flex-1 flex flex-col items-center pt-2 px-4">
                {/* Photo & QR Section - QR now matches Photo scale better */}
                <div className="flex items-center justify-between gap-3 w-full mb-3">
                    {/* Student Photo Container */}
                    <div className={cn(
                        "relative border-[2.5px] border-primary bg-white overflow-hidden rounded-lg shadow-lg flex items-center justify-center",
                        isPrint ? "w-[22mm] h-[28mm]" : "w-28 h-36"
                    )}>
                        <img 
                            src={sanitizedUrl} 
                            alt={student.studentNameBn} 
                            className="object-cover w-full h-full"
                            style={{ display: 'block' }}
                        />
                    </div>

                    {/* QR Code Container - Matches visual weight of photo */}
                    <div className={cn(
                        "flex flex-col items-center justify-center border-[2.5px] border-primary/30 p-1.5 rounded-lg bg-white shadow-md",
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

                {/* Identity Badge Title */}
                <div className="bg-primary text-white px-8 py-1 rounded-full mb-3 shadow-md border-b-2 border-primary-foreground/30">
                    <span className={cn("font-black uppercase tracking-widest", isPrint ? "text-[10px]" : "text-[14px]")}>পরিচয়পত্র</span>
                </div>

                {/* Student Name Display - Larger & Bolder */}
                <div className="flex flex-col items-center mb-2 w-full">
                    <h2 className={cn("font-black text-primary leading-tight text-center drop-shadow-sm", isPrint ? "text-[14px]" : "text-2xl")}>
                        {student.studentNameBn}
                    </h2>
                    <p className={cn("font-bold text-slate-500 uppercase tracking-tighter text-center", isPrint ? "text-[8px]" : "text-[12px]")}>
                        {student.studentNameEn || '-'}
                    </p>
                </div>

                {/* Information Grid - Clean & Spaced */}
                <div className="w-full border-t-[2.5px] border-primary/20 pt-2 flex flex-col gap-1.5">
                    <div className={cn("flex justify-between items-baseline font-black", isPrint ? "text-[10px]" : "text-[15px]")}>
                        <span className="text-slate-500 font-bold">শ্রেণি</span>
                        <span className="text-slate-900">: {classNamesMap[student.className] || student.className}</span>
                    </div>

                    {isHigherClass && student.group && (
                        <div className={cn("flex justify-between items-baseline font-black", isPrint ? "text-[10px]" : "text-[15px]")}>
                            <span className="text-slate-500 font-bold">বিভাগ</span>
                            <span className="text-slate-900">: {groupMapBn[student.group.toLowerCase()] || student.group}</span>
                        </div>
                    )}

                    <div className={cn("flex justify-between items-baseline font-black", isPrint ? "text-[10px]" : "text-[15px]")}>
                        <span className="text-slate-500 font-bold">রোল</span>
                        <span className="text-primary font-black">: {toBengaliNumber(student.roll)}</span>
                    </div>

                    <div className={cn("flex justify-between items-baseline font-black", isPrint ? "text-[10px]" : "text-[15px]")}>
                        <span className="text-slate-500 font-bold">আইডি</span>
                        <span className="text-primary font-black">: {student.generatedId ? toBengaliNumber(student.generatedId) : '-'}</span>
                    </div>

                    <div className={cn("flex justify-between items-baseline font-black", isPrint ? "text-[10px]" : "text-[15px]")}>
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
            <footer className="relative z-10 pt-3 pb-2 flex flex-col items-center mt-auto">
                <div className={cn("border-t-2 border-black mb-1 shadow-sm", isPrint ? "w-20" : "w-40")}></div>
                <p className={cn("font-black text-slate-800", isPrint ? "text-[9px]" : "text-[14px]")}>প্রধান শিক্ষকের স্বাক্ষর</p>
                
                {/* Distinctive Bottom Accent Bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-primary"></div>
            </footer>

            <style jsx>{`
                .clip-header-path-deep {
                    clip-path: ellipse(130% 75% at 50% 0%);
                }
                @media print {
                    .student-id-card {
                        print-color-adjust: exact !important;
                        -webkit-print-color-adjust: exact !important;
                        -webkit-filter: contrast(1.1) saturate(1.1);
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
