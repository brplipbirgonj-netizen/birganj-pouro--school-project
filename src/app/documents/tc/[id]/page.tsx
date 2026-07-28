'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getStudentById, Student } from '@/lib/student-data';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Staff } from '@/lib/staff-data';
import Link from 'next/link';

const classNamesMap: { [key: string]: string } = {
  '6': 'ষষ্ঠ', '7': 'সপ্তম', '8': 'অষ্টম', '9': 'নবম', '10': 'দশম',
};

const toBengaliNumber = (str: string | number) => {
  if (!str && str !== 0) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

export default function TransferCertificatePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const studentId = params.id as string;
  const db = useFirestore();
  const { schoolInfo, isLoading: isSchoolInfoLoading } = useSchoolInfo();

  const [student, setStudent] = useState<Student | null>(null);
  const [headmaster, setHeadmaster] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form parameters from URL
  const smarakNo = searchParams.get('smarak') || `বিপৌউবি/ছাড়পত্র/${new Date().getFullYear()}/`;
  const reason = searchParams.get('reason') || 'অভিভাবকের স্থানান্তরের কারণে';
  const conduct = searchParams.get('conduct') || 'উত্তম ও সন্তোষজনক';
  const academicStatus = searchParams.get('status') || 'উত্তীর্ণ হয়ে পরবর্তী শ্রেণিতে ভর্তির যোগ্য';
  const duesStatus = searchParams.get('dues') || 'বিদ্যালয়ের সকল দেনা-পাওনা পরিশোধিত';

  useEffect(() => {
    if (!studentId || !db) return;

    const fetchData = async () => {
      setIsLoading(true);

      try {
        const [studentData, staffSnapshot] = await Promise.all([
          getStudentById(db, studentId),
          getDocs(query(
            collection(db, 'staff'),
            where('isActive', '==', true),
            where('designation', 'in', ['প্রধান শিক্ষক', 'প্রধান শিক্ষক (ভারপ্রাপ্ত)'])
          ))
        ]);

        setStudent(studentData || null);

        if (!staffSnapshot.empty) {
          const hmDoc = staffSnapshot.docs[0];
          setHeadmaster({ id: hmDoc.id, ...hmDoc.data() } as Staff);
        }
      } catch (e) {
        console.error(e);
      }

      setIsLoading(false);
    };
    fetchData();
  }, [studentId, db]);

  if (isLoading || isSchoolInfoLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 gap-4 font-kalpurush">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">ছাড়পত্র প্রস্তুত হচ্ছে...</p>
      </div>
    );
  }

  if (!student) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-100 font-kalpurush text-xl">শিক্ষার্থী পাওয়া যায়নি।</div>;
  }

  const issueDate = toBengaliNumber(format(new Date(), "d MMMM, yyyy", { locale: bn }));
  const studentDob = student.dob ? toBengaliNumber(format(new Date(student.dob), "d MMMM, yyyy", { locale: bn })) : 'প্রযোজ্য নয়';

  return (
    <div className="bg-gray-100 p-4 sm:p-8 font-kalpurush print:p-0 print:bg-white min-h-screen flex flex-col items-center">
      {/* Action Bar */}
      <div className="w-full max-w-[210mm] flex justify-between items-center mb-6 no-print bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center gap-4">
          <Link href="/documents/tc">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-primary">ছাড়পত্র (TC) প্রিভিউ</h1>
            <p className="text-sm text-muted-foreground">{student.studentNameBn} - রোল: {toBengaliNumber(student.roll)}</p>
          </div>
        </div>
        <Button onClick={() => window.print()} size="lg" className="shadow-lg">
          <Printer className="mr-2 h-5 w-5" />
          প্রিন্ট করুন
        </Button>
      </div>

      {/* Printable Transfer Certificate Page */}
      <div className="w-[210mm] h-[297mm] bg-white mx-auto shadow-2xl relative text-black flex flex-col print:shadow-none print:m-0 print:border-none p-10 box-border overflow-hidden border-8 border-double border-emerald-800">

        {/* Header Section */}
        <div
          className="printable-header w-full p-3 relative text-center bg-white border-b-2 border-emerald-800 mb-6 flex items-center justify-between"
        >
          <div className="w-20 h-20 flex items-center justify-center">
            {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="School Logo" width={80} height={80} className="object-contain" />}
          </div>
          <div className="text-center flex-grow px-2">
            <h1 className="text-2xl sm:text-3xl font-black mb-1 tracking-tight text-emerald-900">
              {schoolInfo.name || 'বীরগঞ্জ পৌর উচ্চ বিদ্যালয়'}
            </h1>
            <p className="text-sm font-bold text-gray-700">
              {schoolInfo.address || 'বীরগঞ্জ, দিনাজপুর'} | EIIN: {toBengaliNumber(schoolInfo.eiin || '138640')}
            </p>
            <p className="text-xs font-bold text-gray-600">
              কোডঃ {toBengaliNumber(schoolInfo.code || '7752')} | ই-মেইলঃ birganjpourohsch2019@gmail.com
            </p>
          </div>
          <div className="w-20 h-20 flex items-center justify-center border border-gray-300 rounded text-center text-[10px] text-muted-foreground">
            {student.photoUrl ? (
              <Image src={student.photoUrl} alt="Student" width={80} height={80} className="object-cover w-full h-full" />
            ) : (
              <span>শিক্ষার্থীর ছবি</span>
            )}
          </div>
        </div>

        {/* Certificate Title */}
        <div className="text-center mb-6">
          <span className="inline-block bg-emerald-800 text-white text-xl font-bold px-8 py-1.5 rounded-full border-2 border-emerald-900 shadow-sm">
            ছাড়পত্র / স্থানান্তরের সনদপত্র (TC)
          </span>
        </div>

        {/* Reference & Date */}
        <div className="flex justify-between text-sm font-bold mb-6 border-b pb-2">
          <span>স্মারক নং: {smarakNo}</span>
          <span>তারিখ: {issueDate} খ্রিঃ</span>
        </div>

        {/* Watermark */}
        {schoolInfo.logoUrl && (
          <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none opacity-5">
            <Image src={schoolInfo.logoUrl} alt="School Logo Watermark" width={450} height={450} />
          </div>
        )}

        {/* Body Content */}
        <div className="relative z-10 text-justify leading-loose text-base flex-grow space-y-4 font-semibold text-gray-900">
          <p>
            এই মর্মে ছাড়পত্র প্রদান করা যাইতেছে যে, <span className="font-bold border-b border-dotted border-black px-2 text-lg text-emerald-950">{student.studentNameBn}</span>, 
            পিতা: <span className="font-bold border-b border-dotted border-black px-2">{student.fatherNameBn}</span>, 
            মাতা: <span className="font-bold border-b border-dotted border-black px-2">{student.motherNameBn}</span>, 
            গ্রাম/ঠিকানা: <span className="font-bold border-b border-dotted border-black px-2">{student.village || student.address || 'বীরগঞ্জ, দিনাজপুর'}</span>।
          </p>

          <p>
            তিনি এই বিদ্যালয়ে <span className="font-bold border-b border-dotted border-black px-2">{toBengaliNumber(student.academicYear)}</span> শিক্ষাবর্ষে 
            <span className="font-bold border-b border-dotted border-black px-2">{classNamesMap[student.className] || student.className}</span> শ্রেণিতে 
            রোল নম্বর <span className="font-bold border-b border-dotted border-black px-2">{toBengaliNumber(student.roll)}</span> নিয়মানুগ শিক্ষার্থী হিসেবে অধ্যয়ন করিয়াছেন। 
            বিদ্যালয়ের ভর্তি রেজিস্টার অনুযায়ী তাহার জন্ম তারিখ: <span className="font-bold border-b border-dotted border-black px-2">{studentDob}</span>।
          </p>

          <p>
            আমার জানা মতে এই বিদ্যালয়ে অধ্যয়নকালে তিনি আইন শৃঙ্খলা পরিপন্থী বা অসামাজিক কোনো কর্মকাণ্ডে লিপ্ত ছিলেন না। তাহার চরিত্র এবং নৈতিক আচরণ <span className="font-bold border-b border-dotted border-black px-2">{conduct}</span>।
          </p>

          <p>
            পড়াশোনার অগ্রগতি ও ফলাফলের দিক থেকে তিনি <span className="font-bold border-b border-dotted border-black px-2">{academicStatus}</span>।
          </p>

          <p>
            বিদ্যালয় ত্যাগের কারণ: <span className="font-bold border-b border-dotted border-black px-2">{reason}</span>।
          </p>

          <p>
            বিদ্যালয়ের পাওনা সংক্রান্ত অবস্থা: <span className="font-bold border-b border-dotted border-black px-2">{duesStatus}</span>।
          </p>

          <p className="pt-2 italic text-emerald-900">
            আমি তাহার ভবিষ্যৎ জীবনে সর্বাঙ্গীন কল্যাণ ও সাফল্য কামনা করি।
          </p>
        </div>

        {/* Footer / Signature Section */}
        <div className="relative z-10 pt-12 flex justify-between items-end border-t mt-6">
          <div className="text-center">
            <div className="h-12"></div>
            <p className="border-t border-black font-bold text-sm px-8 pt-1">শ্রেণি শিক্ষকের স্বাক্ষর</p>
          </div>

          <div className="text-center">
            {headmaster?.signatureUrl ? (
              <div className="h-12 flex justify-center items-center">
                <Image src={headmaster.signatureUrl} alt="Headmaster Signature" width={100} height={40} className="object-contain" />
              </div>
            ) : (
              <div className="h-12"></div>
            )}
            <p className="border-t border-black font-bold text-sm px-8 pt-1">
              প্রধান শিক্ষকের স্বাক্ষর ও সিল
            </p>
            <p className="text-xs text-muted-foreground font-semibold">
              {headmaster ? headmaster.nameBn : 'বীরগঞ্জ পৌর উচ্চ বিদ্যালয়'}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
