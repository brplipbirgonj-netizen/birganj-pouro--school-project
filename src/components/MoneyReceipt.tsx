
'use client';

import Image from 'next/image';
import { FeeCollection } from '@/lib/fees-data';
import { Student } from '@/lib/student-data';
import { SchoolInfo } from '@/lib/school-info';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { QRCodeSVG } from 'qrcode.react';

interface MoneyReceiptProps {
    collection: FeeCollection;
    student: Student;
    schoolInfo: SchoolInfo;
}

const toBengaliNumber = (str: string | number) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

const numberToBengaliWords = (n: number): string => {
    const words: Record<number, string> = {
        0: 'শূন্য', 1: 'এক', 2: 'দুই', 3: 'তিন', 4: 'চার', 5: 'পাঁচ', 6: 'ছয়', 7: 'সাত', 8: 'আট', 9: 'নয়', 10: 'দশ',
        11: 'এগারো', 12: 'বারো', 13: 'তেরো', 14: 'চৌদ্দ', 15: 'পনেরো', 16: 'ষোলো', 17: 'সতেরো', 18: 'আঠারো', 19: 'উনিশ', 20: 'বিশ',
        21: 'একুশ', 22: 'বাইশ', 23: 'তেইশ', 24: 'চব্বিশ', 25: 'পঁচিশ', 26: 'ছাব্বিশ', 27: 'সাতাশ', 28: 'আটাশ', 29: 'উনত্রিশ', 30: 'ত্রিশ',
        31: 'একত্রিশ', 32: 'বত্রিশ', 33: 'তেত্রিশ', 34: 'চৌত্রিশ', 35: 'পঁয়ত্রিশ', 36: 'ছত্রিশ', 37: 'সাঁইত্রিশ', 38: 'আটত্রিশ', 39: 'উনচল্লিশ', 40: 'চল্লিশ',
        41: 'একচল্লিশ', 42: 'বিয়াল্লিশ', 43: 'তেতাল্লিশ', 44: 'চুয়াল্লিশ', 45: 'পঁয়তাল্লিশ', 46: 'ছেচল্লিশ', 47: 'সাতচল্লিশ', 48: 'আটচল্লিশ', 49: 'উনপঞ্চাশ', 50: 'পঞ্চাশ',
        51: 'একান্ন', 52: 'বায়ান্ন', 53: 'তিপ্পান্ন', 54: 'চুয়ান্ন', 55: 'পঞ্চান্ন', 56: 'ছাপ্পান্ন', 57: 'সাতান্ন', 58: 'আটান্ন', 59: 'উনষাট', 60: 'ষাট',
        61: 'একষট্টি', 62: 'বাষট্টি', 63: 'তেষট্টি', 64: 'চৌ্বরষট্টি', 65: 'পঁয়চল্লিশ', 66: 'ছেষট্টি', 67: 'সাতষট্টি', 68: 'আটষট্টি', 69: 'উনসত্তর', 70: 'সত্তর',
        71: 'একাত্তর', 72: 'বাহাত্তর', 73: 'তিয়াত্তর', 74: 'চুয়াত্তর', 75: 'পঁচাত্তর', 76: 'ছিয়াত্তর', 77: 'সাতাত্তর', 78: 'আটাত্তর', 79: 'উনআশি', 80: 'আশি',
        81: 'একাশি', 82: 'বিরাশি', 83: 'তিরাশি', 84: 'চুরাশি', 85: 'পঁচাশী', 86: 'ছিয়াশি', 87: 'সাতাশি', 88: 'অষ্টাশি', 89: 'উননব্বই', 90: 'নব্বই',
        91: 'একানব্বই', 92: 'বিরানব্বই', 93: 'তিরানব্বই', 94: 'চুরানব্বই', 95: 'পঁচানব্বই', 96: 'ছেয়ানব্বই', 97: 'সাতানব্বই', 98: 'আটানব্বই', 99: 'নিরানব্বই'
    };

    if (n === 0) return 'শূন্য';

    let res = '';
    if (n >= 10000000) {
        res += numberToBengaliWords(Math.floor(n / 10000000)) + ' কোটি ';
        n %= 10000000;
    }
    if (n >= 100000) {
        res += numberToBengaliWords(Math.floor(n / 100000)) + ' লক্ষ ';
        n %= 100000;
    }
    if (n >= 1000) {
        res += numberToBengaliWords(Math.floor(n / 1000)) + ' হাজার ';
        n %= 1000;
    }
    if (n >= 100) {
        const hundreds = Math.floor(n / 100);
        res += (hundreds > 1 ? words[hundreds] : '') + ' শত ';
        n %= 100;
    }
    if (n > 0) {
        res += words[n];
    }

    return res.trim();
};

const classNamesMap: Record<string, string> = {
    '6': 'ষষ্ঠ', '7': 'সপ্তম', '8': 'অষ্টম', '9': 'নবম', '10': 'দশম',
};

const feeLabels: Record<string, string> = {
    tuitionCurrent: 'চলতি মাসিক বেতন',
    tuitionAdvance: 'অগ্রিম মাসিক বেতন',
    tuitionDue: 'বকেয়া মাসিক বেতন',
    tuitionFine: 'জরিমানা',
    examFeeHalfYearly: 'অর্ধ-বার্ষিক পরীক্ষা ফি',
    examFeeAnnual: 'বার্ষিক পরীক্ষা ফি',
    examFeePreNirbachoni: 'প্রাক-নির্বাচনী পরীক্ষা ফি',
    examFeeNirbachoni: 'নির্বাচনী পরীক্ষা ফি',
    sessionFee: 'সেশন ফি',
    admissionFee: 'ভর্তি ফি',
    scoutFee: 'স্কাউট ফি',
    developmentFee: 'উন্নয়ন ফি',
    libraryFee: 'লাইব্রেরি ফি',
    tiffinFee: 'টিফিন ফি',
};

export const MoneyReceipt = ({ collection, student, schoolInfo }: MoneyReceiptProps) => {
    const activeFees = Object.entries(collection.breakdown || {})
        .filter(([_, amount]) => amount && amount > 0);

    const qrValue = `রসিদ নং: ${collection.id.slice(-6).toUpperCase()}
শিক্ষার্থী: ${student.studentNameBn}
আইডি: ${student.generatedId || '-'}
শ্রেণি: ${classNamesMap[student.className] || student.className}
রোল: ${student.roll}
মোট টাকা: ${collection.totalAmount} ৳
তারিখ: ${format(collection.collectionDate, 'dd/MM/yyyy')}`;

    return (
        <div className="money-receipt font-kalpurush w-[148mm] h-[210mm] p-8 bg-white text-black border-[6px] border-double border-emerald-900 relative overflow-hidden flex flex-col mx-auto my-4 shadow-2xl print:m-0 print:border-[6px] print:border-double print:border-emerald-900 print:shadow-none box-border">
            {/* Background Watermark Pattern */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(#064e3b 0.5px, transparent 0.5px)', backgroundSize: '10px 10px' }} />
            
            {/* Logo Watermark */}
            {schoolInfo.logoUrl && (
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.04] pointer-events-none z-0">
                    <Image src={schoolInfo.logoUrl} alt="Watermark" width={320} height={320} />
                </div>
            )}

            <header className="relative z-10 flex items-center justify-between border-b-2 border-emerald-900 pb-4 mb-6">
                <div className="flex items-center gap-4">
                    {schoolInfo.logoUrl && (
                        <div className="relative w-16 h-16 bg-white p-1 rounded-full shadow-md border-2 border-emerald-100">
                            <Image src={schoolInfo.logoUrl} alt="Logo" width={64} height={64} className="object-contain rounded-full" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-black text-emerald-950 tracking-tight leading-none mb-1">{schoolInfo.name}</h1>
                        <p className="text-[11px] font-bold text-slate-600 leading-tight">{schoolInfo.address} | EIIN: {toBengaliNumber(schoolInfo.eiin)}</p>
                        <p className="text-[9px] font-black text-emerald-700 uppercase tracking-widest mt-1">Digital Accounts Division</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="inline-block bg-emerald-900 text-white border-2 border-emerald-950 rounded-full px-5 py-1.5 mb-1.5 font-black uppercase text-[12px] shadow-sm">টাকা আদায়ের রসিদ</div>
                    <p className="text-[11px] font-black text-slate-800">রসিদ নং: <span className="uppercase text-emerald-700">{collection.id.slice(-6)}</span></p>
                </div>
            </header>

            <main className="relative z-10 space-y-6 flex-grow">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm font-bold bg-slate-50/80 backdrop-blur-sm p-4 rounded-xl border-2 border-emerald-900/10 shadow-inner">
                    <div className="flex gap-2 border-b border-dashed border-emerald-200 pb-1"><span className="text-slate-500 w-24">শিক্ষার্থীর নাম:</span> <span className="font-black text-emerald-950">{student.studentNameBn}</span></div>
                    <div className="flex gap-2 border-b border-dashed border-emerald-200 pb-1"><span className="text-slate-500 w-24">আইডি:</span> <span className="text-primary font-black">{toBengaliNumber(student.generatedId || '-')}</span></div>
                    <div className="flex gap-2 border-b border-dashed border-emerald-200 pb-1"><span className="text-slate-500 w-24">শ্রেণি ও রোল:</span> <span className="font-black">{classNamesMap[student.className] || student.className} শ্রেণি, রোল- {toBengaliNumber(student.roll)}</span></div>
                    <div className="flex gap-2 border-b border-dashed border-emerald-200 pb-1"><span className="text-slate-500 w-24">শিক্ষাবর্ষ:</span> <span className="font-black">{toBengaliNumber(student.academicYear)}</span></div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-black text-emerald-900 uppercase tracking-widest border-l-4 border-emerald-700 pl-3 mb-3">পেমেন্ট বিবরণ (Payment Details)</p>
                    <div className="border-2 border-emerald-900 rounded-xl overflow-hidden shadow-md bg-white">
                        <table className="w-full text-[13px] text-left border-collapse">
                            <thead>
                                <tr className="bg-emerald-900 text-white border-b-2 border-emerald-950">
                                    <th className="p-2.5 border-r border-emerald-800 font-black w-12 text-center">নং</th>
                                    <th className="p-2.5 border-r border-emerald-800 font-black">আদায়ের খাত (Heads)</th>
                                    <th className="p-2.5 font-black text-right pr-6">পরিমাণ (৳)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeFees.map(([key, amount], i) => (
                                    <tr key={key} className="border-b border-slate-200 last:border-0 hover:bg-slate-50">
                                        <td className="p-2 border-r border-slate-200 text-center font-bold">{toBengaliNumber(i + 1)}</td>
                                        <td className="p-2 border-r border-slate-200 font-black text-slate-800">{feeLabels[key] || key}</td>
                                        <td className="p-2 text-right font-black pr-6">{toBengaliNumber(amount as number)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-emerald-50 font-black border-t-2 border-emerald-900">
                                    <td colSpan={2} className="p-3 text-right border-r border-emerald-200 font-black text-lg">সর্বমোট আদায় (Total Amount):</td>
                                    <td className="p-3 text-right text-2xl pr-6 text-emerald-950 font-black">{toBengaliNumber(collection.totalAmount)} ৳</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="text-sm font-bold bg-emerald-50/50 p-4 rounded-xl border-2 border-dashed border-emerald-900/20">
                        <p className="text-xl leading-relaxed flex flex-wrap gap-2 items-end">
                            <span className="text-slate-600 font-black shrink-0">কথায়:</span> 
                            <span className="font-black text-emerald-950 border-b border-dotted border-black/40 flex-grow min-w-[200px] px-2 italic">
                                {numberToBengaliWords(collection.totalAmount)} টাকা মাত্র।
                            </span>
                        </p>
                        <p className="mt-4 text-[11px] text-slate-700"><strong>আদায়ের বিবরণ:</strong> {collection.description || 'বিবিধ ফি আদায়'}</p>
                    </div>

                    <div className="flex justify-between items-center py-4 bg-white p-4 rounded-2xl border-2 border-black/5 shadow-inner">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Transaction Security</p>
                            <p className="text-[11px] font-bold text-emerald-800">এটি একটি কম্পিউটার জেনারেটেড ডিজিটাল রসিদ।<br/>সিস্টেমে এই লেনদেনের সকল তথ্য সংরক্ষিত আছে।</p>
                        </div>
                        <div className="p-2 border-2 border-emerald-950 bg-white rounded-xl shadow-lg">
                            <QRCodeSVG 
                                value={qrValue}
                                size={100}
                                level="H"
                                includeMargin={false}
                            />
                        </div>
                    </div>
                </div>
            </main>

            <footer className="relative z-10 pt-16 mt-auto">
                <div className="flex justify-between items-end px-4">
                    <div className="text-center">
                        <p className="text-[11px] font-black text-slate-500 mb-2">তারিখ: {format(collection.collectionDate, 'dd/MM/yyyy', { locale: bn })}</p>
                        <div className="w-36 border-t border-black pt-1.5 font-black text-[12px] text-emerald-950">অভিভাবকের স্বাক্ষর</div>
                    </div>
                    <div className="text-center">
                        <div className="h-12 flex flex-col items-center justify-end mb-2">
                             <span className="text-[10px] font-bold text-slate-400 italic mb-1">{collection.collectorName || 'অফিস সহকারী'}</span>
                        </div>
                        <div className="w-36 border-t border-black pt-1.5 font-black text-[12px] text-emerald-950">হিসাবরক্ষকের স্বাক্ষর</div>
                    </div>
                    <div className="text-center">
                        <div className="h-12 mb-2"></div>
                        <div className="w-36 border-t border-black pt-1.5 font-black text-[12px] text-emerald-950">প্রধান শিক্ষকের স্বাক্ষর</div>
                    </div>
                </div>
                <div className="mt-8 text-center text-[9px] text-slate-400 font-black border-t-2 border-dashed pt-3 uppercase tracking-[0.2em]">
                    BIRGANJ POURO HIGH SCHOOL PORTAL | DIGITAL RECEIPT
                </div>
            </footer>
        </div>
    );
};
