'use client';

import Image from 'next/image';
import { FeeCollection } from '@/lib/fees-data';
import { Student } from '@/lib/student-data';
import { SchoolInfo } from '@/lib/school-info';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';

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

    return (
        <div className="money-receipt font-kalpurush w-[148mm] h-[210mm] p-6 bg-white text-black border-2 border-slate-300 border-l-[10px] border-l-primary relative overflow-hidden flex flex-col mx-auto my-4 shadow-sm print:m-0 print:border-slate-400 print:border-l-[10px] print:border-l-primary print:shadow-none box-border">
            {/* Watermark */}
            {schoolInfo.logoUrl && (
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none z-0">
                    <Image src={schoolInfo.logoUrl} alt="Watermark" width={300} height={300} />
                </div>
            )}

            <header className="relative z-10 flex items-center justify-between border-b-2 border-black pb-3 mb-4">
                <div className="flex items-center gap-3">
                    {schoolInfo.logoUrl && (
                        <div className="relative w-14 h-14 bg-white p-0.5 rounded-full shadow-sm">
                            <Image src={schoolInfo.logoUrl} alt="Logo" width={56} height={56} className="object-contain rounded-full" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-xl font-black text-emerald-900 leading-none mb-1">{schoolInfo.name}</h1>
                        <p className="text-[10px] font-bold text-slate-600">{schoolInfo.address} | EIIN: {toBengaliNumber(schoolInfo.eiin)}</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="inline-block bg-slate-100 border border-black rounded px-3 py-1 mb-1 font-black uppercase text-xs">টাকা আদায়ের রসিদ</div>
                    <p className="text-[10px] font-bold">রসিদ নং: <span className="uppercase">{collection.id.slice(-6)}</span></p>
                </div>
            </header>

            <main className="relative z-10 space-y-4 flex-grow">
                <div className="grid grid-cols-2 gap-y-2 text-sm font-bold bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <div className="flex gap-2"><span className="text-slate-500">শিক্ষার্থীর নাম:</span> <span className="font-black">{student.studentNameBn}</span></div>
                    <div className="flex gap-2"><span className="text-slate-500">আইডি:</span> <span>{toBengaliNumber(student.generatedId || '-')}</span></div>
                    <div className="flex gap-2"><span className="text-slate-500">শ্রেণি:</span> <span>{classNamesMap[student.className] || student.className} শ্রেণি</span></div>
                    <div className="flex gap-2"><span className="text-slate-500">রোল:</span> <span>{toBengaliNumber(student.roll)}</span></div>
                </div>

                <div className="space-y-1">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest border-l-4 border-primary pl-2 mb-2">পেমেন্ট বিবরণ</p>
                    <div className="border border-black rounded overflow-hidden">
                        <table className="w-full text-xs text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-100 border-b border-black">
                                    <th className="p-2 border-r border-black font-black w-10 text-center">নং</th>
                                    <th className="p-2 border-r border-black font-black">বিবরণ</th>
                                    <th className="p-2 font-black text-right pr-4">পরিমাণ (৳)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeFees.map(([key, amount], i) => (
                                    <tr key={key} className="border-b border-black last:border-b-0">
                                        <td className="p-2 border-r border-black text-center">{toBengaliNumber(i + 1)}</td>
                                        <td className="p-2 border-r border-black font-bold">{feeLabels[key] || key}</td>
                                        <td className="p-2 text-right font-black pr-4">{toBengaliNumber(amount as number)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-emerald-50 font-black border-t border-black">
                                    <td colSpan={2} className="p-2 text-right border-r border-black">সর্বমোট আদায়:</td>
                                    <td className="p-2 text-right text-lg pr-4 text-emerald-900">{toBengaliNumber(collection.totalAmount)} ৳</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                <div className="text-xs italic bg-slate-50 p-2 rounded border border-dashed border-slate-300">
                    <p><strong>কথায়:</strong> {collection.description || 'বিবিধ ফি আদায়'}</p>
                </div>
            </main>

            <footer className="relative z-10 pt-10 mt-auto">
                <div className="flex justify-between items-end">
                    <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-500 mb-1">তারিখ: {format(collection.collectionDate, 'dd/MM/yyyy', { locale: bn })}</p>
                        <div className="w-32 border-t border-black pt-1 font-black text-[10px]">অভিভাবকের স্বাক্ষর</div>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-bold text-slate-500 mb-1">আদায়কারী: {collection.collectorName || 'অফিস সহকারী'}</p>
                        <div className="w-32 border-t border-black pt-1 font-black text-[10px]">হিসাবরক্ষকের স্বাক্ষর</div>
                    </div>
                </div>
                <div className="mt-6 text-center text-[8px] text-slate-400 font-bold border-t pt-2">
                    এটি একটি কম্পিউটার জেনারেটেড ডিজিটাল রসিদ। বীরগঞ্জ পৌর উচ্চ বিদ্যালয়।
                </div>
            </footer>
        </div>
    );
};
