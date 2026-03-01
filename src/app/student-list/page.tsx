'use client';

import Image from 'next/image';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { deleteStudent, Student, studentFromDoc } from '@/lib/student-data';
import { Eye, FilePen, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Suspense, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Separator } from '@/components/ui/separator';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, orderBy, FirestoreError } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

function StudentListContent() {
  const searchParams = useSearchParams();
  const targetClass = searchParams.get('class');
  const targetStudentId = searchParams.get('studentId');

  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedYear } = useAcademicYear();
  const [studentToView, setStudentToView] = useState<Student | null>(null);
  const [activeTab, setActiveTab] = useState('6');
  const db = useFirestore();
  const { user, hasPermission } = useAuth();
  const canManageStudents = hasPermission('manage:students');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (targetClass) {
        setActiveTab(targetClass);
    }
  }, [targetClass]);

  useEffect(() => {
    if (!db || !user) return;
    setIsLoading(true);

    const studentsQuery = query(
      collection(db, "students"), 
      orderBy("roll")
    );

    const unsubscribe = onSnapshot(studentsQuery, (querySnapshot) => {
      const studentsData = querySnapshot.docs.map(studentFromDoc);
      setAllStudents(studentsData);
      setIsLoading(false);
    }, async (error: FirestoreError) => {
      const permissionError = new FirestorePermissionError({
        path: 'students',
        operation: 'list',
      });
      errorEmitter.emit('permission-error', permissionError);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, user]);

  // Scroll to targeted student
  useEffect(() => {
    if (targetStudentId && !isLoading && isMounted) {
        const timer = setTimeout(() => {
            const element = document.getElementById(`student-row-${targetStudentId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 500);
        return () => clearTimeout(timer);
    }
  }, [targetStudentId, isLoading, isMounted]);

  const studentsForYear = useMemo(() => {
    return allStudents.filter(student => student.academicYear === selectedYear);
  }, [allStudents, selectedYear]);

  const handleDeleteStudent = (studentId: string) => {
    if (!db) return;
    deleteStudent(db, studentId).then(() => {
        toast({
            title: "শিক্ষার্থী ডিলিট হয়েছে",
        });
    }).catch(() => {
        // Error is handled by the global error handler
    });
  };

  const classes = ['6', '7', '8', '9', '10'];
  const classNamesMap: { [key: string]: string } = {
    '6': '৬ষ্ঠ',
    '7': '৭ম',
    '8': '৮ম',
    '9': '৯ম',
    '10': '১০ম',
  };
  const genderMap: { [key: string]: string } = { 'male': 'পুরুষ', 'female': 'মহিলা', 'other': 'অন্যান্য' };
  const religionMap: { [key: string]: string } = { 'islam': 'ইসলাম', 'hinduism': 'হিন্দু', 'buddhism': 'বৌদ্ধ', 'christianity': 'খ্রিস্টান', 'other': 'অন্যান্য' };
  const groupMap: { [key: string]: string } = { 'science': 'বিজ্ঞান', 'arts': 'মানবিক', 'commerce': 'ব্যবসায় শিক্ষা' };


  const getStudentsByClass = (className: string): Student[] => {
    return studentsForYear.filter((student) => student.className === className);
  };

  if (!isMounted) return <Header />;

  return (
    <>
    <div className="flex min-h-screen w-full flex-col bg-rose-100">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <CardTitle>শিক্ষার্থীদের তালিকা</CardTitle>
                <p className="text-sm text-muted-foreground">শিক্ষাবর্ষ: {selectedYear.toLocaleString('bn-BD')}</p>
              </div>
              {canManageStudents && (
                <Link href="/add-student">
                    <Button>নতুন শিক্ষার্থী যোগ করুন</Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-5">
                    {classes.map((className) => (
                      <TabsTrigger key={className} value={className}>
                        {classNamesMap[className]} শ্রেণি
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {classes.map((className) => (
                    <TabsContent key={className} value={className}>
                      <Card>
                        <CardContent className="p-0">
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>ক্রমিক নং</TableHead>
                                  <TableHead>ছবি</TableHead>
                                  <TableHead>রোল</TableHead>
                                  <TableHead>আইডি</TableHead>
                                  <TableHead>শিক্ষার্থীর নাম</TableHead>
                                  <TableHead>পিতার নাম</TableHead>
                                  <TableHead>মোবাইল নম্বর</TableHead>
                                  <TableHead className="text-right">কার্যক্রম</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {isLoading ? (
                                   <TableRow>
                                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                          লোড হচ্ছে...
                                      </TableCell>
                                   </TableRow>
                                ) : getStudentsByClass(className).length === 0 ? (
                                   <TableRow>
                                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                          এই শ্রেণিতে কোনো শিক্ষার্থী নেই।
                                      </TableCell>
                                   </TableRow>
                                ) : (
                                  getStudentsByClass(className).map((student, index) => (
                                  <TableRow 
                                    key={student.id} 
                                    id={`student-row-${student.id}`}
                                    className={cn(
                                        "transition-colors duration-1000",
                                        student.id === targetStudentId && "bg-yellow-100 ring-2 ring-yellow-400 z-10"
                                    )}
                                  >
                                    <TableCell>{(index + 1).toLocaleString('bn-BD')}</TableCell>
                                    <TableCell>
                                      <Image
                                        src={student.photoUrl}
                                        alt={student.studentNameBn}
                                        width={40}
                                        height={40}
                                        className="rounded-full object-cover"
                                      />
                                    </TableCell>
                                    <TableCell>{student.roll.toLocaleString('bn-BD')}</TableCell>
                                    <TableCell>{student.generatedId || '-'}</TableCell>
                                    <TableCell className="whitespace-nowrap font-bold">{student.studentNameBn}</TableCell>
                                    <TableCell className="whitespace-nowrap">{student.fatherNameBn}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-col whitespace-nowrap">
                                        {student.guardianMobile && <span>{student.guardianMobile}</span>}
                                        {student.studentMobile && <span>{student.studentMobile}</span>}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-2">
                                        <Button variant="outline" size="icon" onClick={() => setStudentToView(student)}>
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        {canManageStudents && (
                                            <>
                                                <Link href={`/edit-student/${student.id}`}>
                                                <Button variant="outline" size="icon" asChild>
                                                    <span className="cursor-pointer">
                                                    <FilePen className="h-4 w-4" />
                                                    </span>
                                                </Button>
                                                </Link>
                                                <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="icon">
                                                    <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                    <AlertDialogTitle>আপনি কি নিশ্চিত?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        এই কাজটি ফিরিয়ে আনা যাবে না। এটি তালিকা থেকে স্থায়ীভাবে শিক্ষার্থীকে মুছে ফেলবে।
                                                    </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                    <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteStudent(student.id)}>
                                                        ডিলিট করুন
                                                    </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                                </AlertDialog>
                                            </>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                 ))
                                )}
                              </TableBody>
                            </Table>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  ))}
                </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
    <Dialog open={!!studentToView} onOpenChange={(isOpen) => !isOpen && setStudentToView(null)}>
        <DialogContent className="max-w-3xl">
             {studentToView && (
                <>
                    <DialogHeader className="flex-row items-center gap-4">
                        <Image src={studentToView.photoUrl} alt={studentToView.studentNameBn} width={80} height={80} className="rounded-lg object-cover" />
                        <div>
                            <DialogTitle className="text-2xl mb-1">{studentToView.studentNameBn}</DialogTitle>
                            <DialogDescription>
                                রোল: {studentToView.roll.toLocaleString('bn-BD')} | শ্রেণি: {classNamesMap[studentToView.className] || studentToView.className} | শিক্ষাবর্ষ: {studentToView.academicYear.toLocaleString('bn-BD')}
                            </DialogDescription>
                        </div>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto pr-4">
                        <div className="space-y-4 py-4">
                            
                            <div>
                                <h3 className="font-semibold text-lg mb-2 border-b pb-1">ব্যক্তিগত তথ্য</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm">
                                    <p><span className="font-medium text-muted-foreground">শিক্ষার্থী আইডি:</span> {studentToView.generatedId || 'N/A'}</p>
                                    <p><span className="font-medium text-muted-foreground">নাম (ইংরেজি):</span> {studentToView.studentNameEn || 'N/A'}</p>
                                    <p><span className="font-medium text-muted-foreground">জন্ম তারিখ:</span> {studentToView.dob ? new Date(studentToView.dob).toLocaleDateString('bn-BD') : 'N/A'}</p>
                                    <p><span className="font-medium text-muted-foreground">জন্ম নিবন্ধন:</span> {studentToView.birthRegNo || 'N/A'}</p>
                                    <p><span className="font-medium text-muted-foreground">লিঙ্গ:</span> {studentToView.gender ? genderMap[studentToView.gender] : 'N/A'}</p>
                                    <p><span className="font-medium text-muted-foreground">ধর্ম:</span> {studentToView.religion ? religionMap[studentToView.religion] : 'N/A'}</p>
                                    <p><span className="font-medium text-muted-foreground">গ্রুপ:</span> {studentToView.group ? groupMap[studentToView.group] : 'N/A'}</p>
                                </div>
                            </div>
                            
                            <Separator />

                            <div>
                                <h3 className="font-semibold text-lg mb-2 border-b pb-1">অভিভাগকের তথ্য</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    <p><span className="font-medium text-muted-foreground">পিতার নাম (বাংলা):</span> {studentToView.fatherNameBn}</p>
                                    <p><span className="font-medium text-muted-foreground">পিতার নাম (ইংরেজি):</span> {studentToView.fatherNameEn || 'N/A'}</p>
                                    <p><span className="font-medium text-muted-foreground">পিতার NID:</span> {studentToView.fatherNid || 'N/A'}</p>
                                    <p><span className="font-medium text-muted-foreground">মাতার নাম (বাংলা):</span> {studentToView.motherNameBn}</p>
                                    <p><span className="font-medium text-muted-foreground">মাতার নাম (ইংরেজি):</span> {studentToView.motherNameEn || 'N/A'}</p>
                                    <p><span className="font-medium text-muted-foreground">মাতার NID:</span> {studentToView.motherNid || 'N/A'}</p>
                                </div>
                            </div>
                            
                            <Separator />

                            <div>
                                <h3 className="font-semibold text-lg mb-2 border-b pb-1">যোগাযোগ</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                    <p><span className="font-medium text-muted-foreground">অভিভাবকের মোবাইল:</span> {studentToView.guardianMobile || 'N/A'}</p>
                                    <p><span className="font-medium text-muted-foreground">শিক্ষার্থীর মোবাইল:</span> {studentToView.studentMobile || 'N/A'}</p>
                                </div>
                            </div>
                            
                             <Separator />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h3 className="font-semibold text-lg mb-2 border-b pb-1">বর্তমান ঠিকানা</h3>
                                    <div className="space-y-1 text-sm">
                                      <p><span className="font-medium text-muted-foreground">গ্রাম:</span> {studentToView.presentVillage || 'N/A'}</p>
                                      <p><span className="font-medium text-muted-foreground">ইউনিয়ন:</span> {studentToView.presentUnion || 'N/A'}</p>
                                      <p><span className="font-medium text-muted-foreground">ডাকঘর:</span> {studentToView.presentPostOffice || 'N/A'}</p>
                                      <p><span className="font-medium text-muted-foreground">উপজেলা:</span> {studentToView.presentUpazila || 'N/A'}</p>
                                      <p><span className="font-medium text-muted-foreground">জেলা:</span> {studentToView.presentDistrict || 'N/A'}</p>
                                    </div>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg mb-2 border-b pb-1">স্থায়ী ঠিকানা</h3>
                                    <div className="space-y-1 text-sm">
                                        <p><span className="font-medium text-muted-foreground">গ্রাম:</span> {studentToView.permanentVillage || 'N/A'}</p>
                                        <p><span className="font-medium text-muted-foreground">ইউনিয়ন:</span> {studentToView.permanentUnion || 'N/A'}</p>
                                        <p><span className="font-medium text-muted-foreground">ডাকঘর:</span> {studentToView.permanentPostOffice || 'N/A'}</p>
                                        <p><span className="font-medium text-muted-foreground">উপজেলা:</span> {studentToView.permanentUpazila || 'N/A'}</p>
                                        <p><span className="font-medium text-muted-foreground">জেলা:</span> {studentToView.permanentDistrict || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                     <DialogFooter className="pt-4 border-t">
                        <Link href={`/documents/testimonial/${studentToView.id}`} target="_blank" rel="noopener noreferrer">
                          <Button type="button">প্রত্যয়ন পত্র</Button>
                        </Link>
                    </DialogFooter>
                </>
             )}
        </DialogContent>
    </Dialog>
    </>
  );
}

export default function StudentListPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen w-full flex-col bg-rose-100 items-center justify-center">
        <p>লোড হচ্ছে...</p>
      </div>
    }>
      <StudentListContent />
    </Suspense>
  );
}
