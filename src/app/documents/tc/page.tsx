'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { FileText, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const classNamesMap: { [key: string]: string } = {
  '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

export default function TCSelectionPage() {
  const db = useFirestore();
  const router = useRouter();
  const { selectedYear } = useAcademicYear();

  const [className, setClassName] = useState<string>('6');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);

  // Form parameters
  const [smarakNo, setSmarakNo] = useState<string>(`বিপৌউবি/ছাড়পত্র/${new Date().getFullYear()}/`);
  const [reason, setReason] = useState<string>('অভিভাবকের স্থানান্তর / পারিবারিক কারণ');
  const [conduct, setConduct] = useState<string>('উত্তম ও সন্তোষজনক');
  const [status, setStatus] = useState<string>('উত্তীর্ণ হয়ে পরবর্তী শ্রেণিতে ভর্তির যোগ্য');
  const [dues, setDues] = useState<string>('বিদ্যালয়ের সকল দেনা-পাওনা পরিশোধিত');

  useEffect(() => {
    if (!db || !className) return;

    const fetchStudents = async () => {
      setIsLoadingStudents(true);
      try {
        const q = query(
          collection(db, 'students'),
          where('className', '==', className),
          where('academicYear', '==', selectedYear)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(studentFromDoc);
        list.sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
        setStudents(list);
        if (list.length > 0) {
          setSelectedStudentId(list[0].id);
        } else {
          setSelectedStudentId('');
        }
      } catch (e) {
        console.error('Error fetching students:', e);
      } finally {
        setIsLoadingStudents(false);
      }
    };

    fetchStudents();
  }, [db, className, selectedYear]);

  const handleGenerateTC = () => {
    if (!selectedStudentId) return;

    const queryParams = new URLSearchParams({
      smarak: smarakNo,
      reason,
      conduct,
      status,
      dues
    });

    router.push(`/documents/tc/${selectedStudentId}?${queryParams.toString()}`);
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 font-kalpurush">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-32 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-4 mb-2">
          <Link href="/documents">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-primary">ছাড়পত্র (Transfer Certificate - TC) জেনারেটর</h1>
            <p className="text-sm text-muted-foreground">শিক্ষার্থী নির্বাচন করে ছাড়পত্র তৈরি করুন</p>
          </div>
        </div>

        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> শিক্ষার্থীর তথ্য ও ছাড়পত্রের বিবরণ
            </CardTitle>
            <CardDescription>নিচের ফরমটি পূরণ করে ছাড়পত্র তৈরি বাটনে ক্লিক করুন</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="classSelect" className="font-bold">১. শ্রেণি নির্বাচন করুন</Label>
                <Select value={className} onValueChange={setClassName}>
                  <SelectTrigger id="classSelect">
                    <SelectValue placeholder="শ্রেণি সিলেক্ট করুন" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(classNamesMap).map(([val, label]) => (
                      <SelectItem key={val} value={val}>{label} শ্রেণি</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="studentSelect" className="font-bold">২. শিক্ষার্থী নির্বাচন করুন</Label>
                {isLoadingStudents ? (
                  <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-sm text-muted-foreground bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" /> লোড হচ্ছে...
                  </div>
                ) : (
                  <Select value={selectedStudentId} onValueChange={setSelectedStudentId} disabled={students.length === 0}>
                    <SelectTrigger id="studentSelect">
                      <SelectValue placeholder={students.length === 0 ? "কোনো শিক্ষার্থী পাওয়া যায়নি" : "শিক্ষার্থী সিলেক্ট করুন"} />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((st) => (
                        <SelectItem key={st.id} value={st.id}>
                          রোল {st.roll} - {st.studentNameBn} ({st.fatherNameBn})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="smarak" className="font-bold">স্মারক নম্বর</Label>
                  <Input id="smarak" value={smarakNo} onChange={(e) => setSmarakNo(e.target.value)} placeholder="স্মারক নম্বর লিখুন" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason" className="font-bold">ছাড়পত্রের কারণ</Label>
                  <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="যেমন: অভিভাবকের স্থানাস্তর" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="conduct" className="font-bold">আচরণ ও চরিত্র</Label>
                  <Input id="conduct" value={conduct} onChange={(e) => setConduct(e.target.value)} placeholder="যেমন: উত্তম ও সন্তোষজনক" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status" className="font-bold">পড়াশোনার অগ্রগতি / ফলাফল</Label>
                  <Input id="status" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="যেমন: উত্তীর্ণ হয়ে পরবর্তী শ্রেণিতে ভর্তির যোগ্য" />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="dues" className="font-bold">বকেয়া হিসাবের অবস্থা</Label>
                  <Input id="dues" value={dues} onChange={(e) => setDues(e.target.value)} placeholder="যেমন: বিদ্যালয়ের সকল দেনা-পাওনা পরিশোধিত" />
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="border-t pt-4 flex justify-end">
            <Button onClick={handleGenerateTC} size="lg" disabled={!selectedStudentId} className="gap-2">
              ছাড়পত্র জেনারেট ও প্রিন্ট করুন
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
