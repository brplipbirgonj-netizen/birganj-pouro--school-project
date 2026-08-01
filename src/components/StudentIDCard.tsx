'use client';

import { QRCodeSVG } from 'qrcode.react'; 
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
    const sanitizedUrl = sanitizePhotoUrl(student.photoUrl, student.gender) || getStudentPlaceholderImage(student.gender);
    
    // Updated QR data format to include mobile number and clear labels for accuracy
    const qrData = `Student ID: ${student.generatedId || '-'}
Name: ${student.studentNameBn}
Class: ${classNamesMap[student.className] || student.className}
Roll: ${student.roll}
Mobile: ${student.guardianMobile || student.studentMobile || '-'}`;

    return (
        <div className={cn(
            "student-id-card font-kalpurush flex flex-col border-[2px] border-[#2418ff] overflow-hidden bg-white relative box-border shadow-md",
            isPrint ? "w-[54mm] h-[86mm]" : "w-[280px] h-[440px] rounded-sm"
        )}>
            {/* Header Section */}
            <div className={cn(
                "relative z-10 bg-[#2418ff] flex flex-col items-center pt-2 pb-6 text-white shrink-0",
                isPrint ? "h-[22mm]" : "h-[115px]"
            )}>
                {schoolInfo.logoUrl && (
                    <div className={cn(
                        "bg-white rounded-full p-0.5 mb-1 shadow-sm",
                        isPrint ? "w-6 h-6" : "w-10 h-10"
                    )}>
                        <img 
                            src={schoolInfo.logoUrl} 
                            alt="Logo" 
                            className="object-contain w-full h-full rounded-full"
                        />
                    </div>
                )}
                <h1 className={cn(
                    "font-black text-center leading-none text-yellow-300 drop-shadow-md px-1",
                    isPrint ? "text-[9.5px]" : "text-[16px]"
                )}>
                    {schoolInfo.name}
                </h1>
                <p className={cn(
                    "font-black text-white text-center uppercase tracking-tighter mt-1 px-1 z-30 opacity-90",
                    isPrint ? "text-[5px]" : "text-[8px]"
                )}>
                    UPAZILA: BIRGANJ, POST: BIRGANJ, ZILA: DINAJPUR
                </p>
                
                {/* Wave effect */}
                <div className="absolute -bottom-0.5 left-0 right-0 w-full overflow-hidden leading-none z-10">
                    <svg viewBox="0 0 500 150" preserveAspectRatio="none" className="w-full h-8">
                        <path d="M0.00,49.98 C149.99,150.00 349.20,-49.98 500.00,49.98 L500.00,150.00 L0.00,150.00 Z" style={{ stroke: 'none', fill: 'white' }}></path>
                    </svg>
                </div>
            </div>

            <main className="relative z-20 flex-1 flex flex-col items-center pt-0 px-3">
                {/* Photo & QR Section */}
                <div className="flex items-center justify-between gap-2 w-full mb-1">
                    {/* Student Photo */}
                    <div className={cn(
                        "relative border-2 border-[#2418ff] bg-white overflow-hidden shadow-sm flex items-center justify-center rounded-sm",
                        isPrint ? "w-[20mm] h-[24mm]" : "w-28 h-34"
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
                        "flex flex-col items-center justify-center border-2 border-slate-100 p-1 bg-white shadow-sm rounded-sm",
                        isPrint ? "w-[20mm] h-[24mm]" : "w-28 h-34"
                    )}>
                        <QRCodeSVG 
                            value={qrData}
                            size={isPrint ? 68 : 100}
                            level={"M"}
                            includeMargin={true}
                        />
                    </div>
                </div>

                {/* Name Section - Spacing reduced to lift data up */}
                <div className="flex flex-col items-center mb-1 w-full mt-1">
                    <h2 className={cn("font-black text-[#2418ff] leading-none text-center", isPrint ? "text-[12px]" : "text-[19px]")}>
                        {student.studentNameBn}
                    </h2>
                    <p className={cn("font-bold text-slate-500 uppercase tracking-tighter text-center mt-0.5", isPrint ? "text-[6.5px]" : "text-[10px]")}>
                        {student.studentNameEn || 'STUDENT NAME'}
                    </p>
                </div>

                {/* Data Grid - Compact and pushed higher */}
                <div className="w-full border-t border-slate-100 pt-1 flex flex-col gap-0.5 font-black">
                    <div className={cn("flex items-center", isPrint ? "text-[9.5px]" : "text-[15px]")}>
                        <span className="w-18 text-slate-600">শ্রেণি ও রোল</span>
                        <span className="flex-1">: {classNamesMap[student.className] || student.className}, {toBengaliNumber(student.roll)}</span>
                    </div>
                    <div className={cn("flex items-center", isPrint ? "text-[9.5px]" : "text-[15px]")}>
                        <span className="w-18 text-slate-600">আইডি নং</span>
                        <span className="flex-1">: {student.generatedId ? toBengaliNumber(student.generatedId) : '-'}</span>
                    </div>
                    <div className={cn("flex items-center", isPrint ? "text-[9.5px]" : "text-[15px]")}>
                        <span className="w-18 text-slate-600">মোবাইল নং</span>
                        <span className="flex-1">: {toBengaliNumber(student.guardianMobile || '')}</span>
                    </div>
                    <div className={cn("flex items-center", isPrint ? "text-[9.5px]" : "text-[15px]")}>
                        <span className="w-18 text-slate-600">শিক্ষাবর্ষ</span>
                        <span className="flex-1">: {toBengaliNumber(student.academicYear)}</span>
                    </div>
                </div>
            </main>

            {/* Footer Signature - Standard right aligned */}
            <footer className="relative z-10 pb-3 flex flex-col items-end pr-5 mt-auto">
                <p className={cn("font-black text-slate-800", isPrint ? "text-[8px]" : "text-[13px]")}>প্রধান শিক্ষকের স্বাক্ষর</p>
            </footer>

            <style jsx>{`
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