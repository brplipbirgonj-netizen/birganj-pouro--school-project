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
    'science': 'বিজ্ঞান', 'arts': 'মানবিক', 'commerce': 'ব্যবসায় শিক্ষা'
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
            "student-id-card font-kalpurush flex flex-col border-[2px] border-primary overflow-hidden bg-white relative box-border",
            isPrint ? "w-[54mm] h-[86mm]" : "w-[260px] h-[410px] shadow-2xl rounded-xl"
        )}>
            {/* Design Header Background */}
            <div className={cn(
                "absolute top-0 left-0 right-0 bg-primary clip-header-path",
                isPrint ? "h-[32mm]" : "h-32"
            )}></div>
            
            <header className="relative z-10 flex flex-col items-center pt-2 pb-1 text-white">
                {schoolInfo.logoUrl && (
                    <div className={cn(
                        "bg-white rounded-full p-0.5 shadow-md mb-0.5",
                        isPrint ? "w-8 h-8" : "w-12 h-12"
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
                        "font-black leading-tight drop-shadow-md",
                        isPrint ? "text-[10px]" : "text-[16px]"
                    )}>
                        {schoolInfo.name}
                    </h1>
                    <p className={cn(
                        "font-bold text-white/90",
                        isPrint ? "text-[6px]" : "text-[9px]"
                    )}>
                        {schoolInfo.address}
                    </p>
                </div>
            </header>

            <main className="relative z-10 flex-1 flex flex-col items-center pt-1 px-3">
                {/* Photo & QR Section */}
                <div className="flex items-start justify-center gap-3 w-full mb-1">
                    {/* Student Photo */}
                    <div className={cn(
                        "relative border-[2px] border-primary bg-white overflow-hidden rounded-md shadow-md flex items-center justify-center",
                        isPrint ? "w-[20mm] h-[25mm]" : "w-24 h-32"
                    )}>
                        <img 
                            src={sanitizedUrl} 
                            alt={student.studentNameBn} 
                            className="object-cover w-full h-full"
                            style={{ display: 'block' }}
                        />
                    </div>

                    {/* QR Code Section */}
                    <div className={cn(
                        "flex flex-col items-center justify-center border-2 border-slate-100 p-1 rounded bg-slate-50 shadow-inner",
                        isPrint ? "w-[12mm] h-[12mm]" : "w-[60px] h-[60px]"
                    )}>
                        <QRCodeCanvas 
                            value={qrData}
                            size={isPrint ? 40 : 52}
                            level={"H"}
                            includeMargin={false}
                        />
                    </div>
                </div>

                {/* Identity Title */}
                <div className="bg-primary text-white px-4 py-0.5 rounded-full mb-1 shadow-sm border border-white/20">
                    <span className={cn("font-black uppercase tracking-widest", isPrint ? "text-[8px]" : "text-[12px]")}>পরিচয়পত্র</span>
                </div>

                {/* Name Section */}
                <div className="flex flex-col items-center mb-1 w-full">
                    <h2 className={cn("font-black text-primary leading-tight text-center", isPrint ? "text-[11px]" : "text-lg")}>
                        {student.studentNameBn}
                    </h2>
                    <p className={cn("font-bold text-slate-500 uppercase tracking-tighter text-center", isPrint ? "text-[6px]" : "text-[10px]")}>
                        {student.studentNameEn || '-'}
                    </p>
                </div>

                {/* Details Grid */}
                <div className="w-full border-t border-slate-200 pt-1 flex flex-col gap-0.5">
                    <div className={cn("flex justify-between items-baseline font-bold", isPrint ? "text-[8.5px]" : "text-[12px]")}>
                        <span className="text-slate-500">শ্রেণি</span>
                        <span className="text-slate-900">: {classNamesMap[student.className] || student.className}</span>
                    </div>

                    {isHigherClass && student.group && (
                        <div className={cn("flex justify-between items-baseline font-bold", isPrint ? "text-[8.5px]" : "text-[12px]")}>
                            <span className="text-slate-500">বিভাগ</span>
                            <span className="text-slate-900">: {groupMapBn[student.group.toLowerCase()] || student.group}</span>
                        </div>
                    )}

                    <div className={cn("flex justify-between items-baseline font-bold", isPrint ? "text-[8.5px]" : "text-[12px]")}>
                        <span className="text-slate-500">রোল</span>
                        <span className="text-slate-900 font-black">: {toBengaliNumber(student.roll)}</span>
                    </div>

                    <div className={cn("flex justify-between items-baseline font-bold", isPrint ? "text-[8.5px]" : "text-[12px]")}>
                        <span className="text-slate-500 text-primary">আইডি</span>
                        <span className="text-primary font-black">: {student.generatedId ? toBengaliNumber(student.generatedId) : '-'}</span>
                    </div>

                    <div className={cn("flex justify-between items-baseline font-bold", isPrint ? "text-[8.5px]" : "text-[12px]")}>
                        <span className="text-slate-500">শিক্ষাবর্ষ</span>
                        <span className="text-slate-900">: {toBengaliNumber(student.academicYear)}</span>
                    </div>

                    <div className={cn("flex justify-between items-baseline font-bold", isPrint ? "text-[8.5px]" : "text-[12px]")}>
                        <span className="text-slate-500">মোবাইল নং</span>
                        <span className="text-slate-900">: {toBengaliNumber(student.guardianMobile || '')}</span>
                    </div>
                </div>
            </main>

            {/* Footer / Signature */}
            <footer className="relative z-10 pt-2 pb-1 flex flex-col items-center mt-auto">
                <div className={cn("border-t-[1.5px] border-black mb-0.5", isPrint ? "w-16" : "w-32")}></div>
                <p className={cn("font-black text-slate-800", isPrint ? "text-[7px]" : "text-[11px]")}>প্রধান শিক্ষকের স্বাক্ষর</p>
                
                {/* Bottom colored bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary"></div>
            </footer>

            <style jsx>{`
                .clip-header-path {
                    clip-path: ellipse(120% 70% at 50% 0%);
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
