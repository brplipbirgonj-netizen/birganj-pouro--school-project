'use client';

import Image from 'next/image';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { deleteStudent, Student, studentFromDoc } from '@/lib/student-data';
import { Eye, FilePen, Trash2, LayoutGrid, List, Filter, UserRound, Droplets, MapPin, Search } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { Suspense, useEffect, useState, useMemo, useCallback } from 'react';
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
  
  // New States for Redesign
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [filterGender, setFilterGender] = useState<string>('all');
  const [filterStipend, setFilterStipend] = useState<string>('all');
  const [filterReligion, setFilterReligion] = useState<string>('all');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const bnToEn = (str: string) => str.replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d).toString());
  const isMale = (g: string | undefined | null) => {
      if (!g) return false;
      const gl = g.trim().toLowerCase();
      return gl === 'male' || gl === 'পুরুষ' || gl === 'ছাত্র' || gl === 'boy' || gl === 'm';
  };
  const isFemale = (g: string | undefined | null) => {
      if (!g) return false;
      const gl = g.trim().toLowerCase();
      return gl === 'female' || gl === 'মহিলা' || gl === 'ছাত্রী' || gl === 'girl' || gl === 'f';
  };

  // Calculate religion, gender and group counts for the current selected class
  const classStats = useMemo(() => {
    const relCounts: Record<string, number> = { all: 0, islam: 0, hinduism: 0, buddhism: 0, christianity: 0, other: 0 };
    const genCounts: Record<string, number> = { all: 0, male: 0, female: 0, other: 0 };
    const grpCounts: Record<string, number> = { all: 0, science: 0, arts: 0, commerce: 0, other: 0 };
    
    const studentsInClass = allStudents.filter(s => s.academicYear === selectedYear && s.className === activeTab);
    
    relCounts.all = studentsInClass.length;
    genCounts.all = studentsInClass.length;
    grpCounts.all = studentsInClass.length;

    studentsInClass.forEach(s => {
      // Religion
      const r = (s.religion || '').toLowerCase();
      if (r === 'islam') relCounts.islam++;
      else if (r === 'hinduism') relCounts.hinduism++;
      else if (r === 'buddhism') relCounts.buddhism++;
      else if (r === 'christianity') relCounts.christianity++;
      else if (r) relCounts.other++;

      // Gender
      if (isMale(s.gender)) genCounts.male++;
      else if (isFemale(s.gender)) genCounts.female++;
      else if (s.gender) genCounts.other++;

      // Group
      const g = (s.group || '').toLowerCase();
      if (g === 'science') grpCounts.science++;
      else if (g === 'arts') grpCounts.arts++;
      else if (g === 'commerce') grpCounts.commerce++;
      else if (g) grpCounts.other++;
    });

    return { religion: relCounts, gender: genCounts, group: grpCounts };
  }, [allStudents, selectedYear, activeTab]);

  const filteredStudents = useMemo(() => {
    // Always filter by selected academic year first
    let filtered = allStudents.filter(s => s.academicYear === selectedYear);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => {
        const nameBn = (s.studentNameBn || '').toLowerCase();
        const nameEn = (s.studentNameEn || '').toLowerCase();
        const rollStr = (s.roll || '').toString();
        const idStr = (s.generatedId || '').toLowerCase();
        return nameBn.includes(q) || nameEn.includes(q) || rollStr.includes(bnToEn(q)) || idStr.includes(q);
      });
    }

    if (filterGender !== 'all') {
      filtered = filtered.filter(s => filterGender === 'male' ? isMale(s.gender) : isFemale(s.gender));
    }
    if (filterStipend !== 'all') {
      filtered = filtered.filter(s => filterStipend === 'yes' ? s.isStipendReceiver === true : s.isStipendReceiver !== true);
    }
    if (filterReligion !== 'all') {
      filtered = filtered.filter(s => (s.religion || '').toLowerCase() === filterReligion);
    }
    if (filterGroup !== 'all') {
        filtered = filtered.filter(s => (s.group || '').toLowerCase() === filterGroup);
    }

    return filtered;
  }, [allStudents, selectedYear, searchQuery, filterGender, filterStipend, filterReligion, filterGroup]);

  const getStudentsByClass = useCallback((className: string) => {
    return filteredStudents.filter(student => student.className === className);
  }, [filteredStudents]);

  const classes = ['6', '7', '8', '9', '10'];

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
    }, (error: FirestoreError) => {
      if (error.code === 'permission-denied') return;
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

  if (!isMounted) {
    return (
      <div className="flex min-h-screen w-full flex-col bg-rose-100 items-center justify-center">
        <p>লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <>
    <div className="flex min-h-screen w-full flex-col bg-rose-100">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-80">
        <Card className="shadow-lg border-primary/10 overflow-hidden">
          <CardHeader className="bg-muted/30 border-b pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                    <UserRound className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <CardTitle className="text-xl">শিক্ষার্থীদের তালিকা</CardTitle>
                    <p className="text-sm text-muted-foreground">শিক্ষাবর্ষ: {selectedYear ? selectedYear.toLocaleString('bn-BD') : ''}</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Search Bar */}
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="নাম, রোল বা আইডি দিয়ে খুঁজুন..."
                        className="pl-9 h-10 bg-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                {/* Class-based Gender Filter */}
                <select
                  value={filterGender}
                  onChange={(e) => setFilterGender(e.target.value)}
                  className="h-10 px-3 rounded-md border border-input bg-white text-sm font-bold focus:outline-none focus:ring-1 focus:ring-ring text-blue-700"
                >
                  <option value="all">ছাত্র-ছাত্রী ({classStats.gender.all.toLocaleString('bn-BD')})</option>
                  <option value="male">ছাত্র ({classStats.gender.male.toLocaleString('bn-BD')})</option>
                  <option value="female">ছাত্রী ({classStats.gender.female.toLocaleString('bn-BD')})</option>
                </select>

                {/* Class-based Religion Filter */}
                <select
                  value={filterReligion}
                  onChange={(e) => setFilterReligion(e.target.value)}
                  className="h-10 px-3 rounded-md border border-input bg-white text-sm font-bold focus:outline-none focus:ring-1 focus:ring-ring text-primary"
                >
                  <option value="all">সকল ধর্ম ({classStats.religion.all.toLocaleString('bn-BD')})</option>
                  <option value="islam">ইসলাম ({classStats.religion.islam.toLocaleString('bn-BD')})</option>
                  <option value="hinduism">হিন্দু ({classStats.religion.hinduism.toLocaleString('bn-BD')})</option>
                  <option value="buddhism">বৌদ্ধ ({classStats.religion.buddhism.toLocaleString('bn-BD')})</option>
                  <option value="christianity">খ্রিস্টান ({classStats.religion.christianity.toLocaleString('bn-BD')})</option>
                  <option value="other">অন্যান্য ({classStats.religion.other.toLocaleString('bn-BD')})</option>
                </select>

                {/* Class-based Group Filter */}
                <select
                  value={filterGroup}
                  onChange={(e) => setFilterGroup(e.target.value)}
                  className="h-10 px-3 rounded-md border border-input bg-white text-sm font-bold focus:outline-none focus:ring-1 focus:ring-ring text-emerald-700"
                >
                  <option value="all">সকল বিভাগ ({classStats.group.all.toLocaleString('bn-BD')})</option>
                  <option value="science">বিজ্ঞান ({classStats.group.science.toLocaleString('bn-BD')})</option>
                  <option value="arts">মানবিক ({classStats.group.arts.toLocaleString('bn-BD')})</option>
                  <option value="commerce">ব্যবসায় শিক্ষা ({classStats.group.commerce.toLocaleString('bn-BD')})</option>
                </select>

                <select
                  value={filterStipend}
                  onChange={(e) => setFilterStipend(e.target.value)}
                  className="h-10 px-3 rounded-md border border-input bg-white text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">সকল (উপবৃত্তি)</option>
                  <option value="yes">উপবৃত্তি প্রাপ্ত</option>
                  <option value="no">উপবৃত্তি বিহীন</option>
                </select>

                {/* View Mode Toggle */}
                <div className="flex bg-muted p-1 rounded-md">
                    <Button
                        variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-8 px-2 shadow-none"
                        onClick={() => setViewMode('table')}
                    >
                        <List className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-8 px-2 shadow-none"
                        onClick={() => setViewMode('grid')}
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                </div>

                {canManageStudents && (
                  <Link href="/add-student" className="no-print">
                      <Button className="h-10">নতুন শিক্ষার্থী</Button>
                  </Link>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 pt-4">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="grid w-full grid-cols-5 no-print">
                    {classes.map((className) => (
                      <TabsTrigger key={className} value={className}>
                        {classNamesMap[className]} শ্রেণি
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {classes.map((className) => (
                    <TabsContent key={className} value={className}>
                      <Card className="border-none shadow-none">
                        <CardContent className="p-0">
                          {isLoading ? (
                            <div className="flex justify-center items-center py-12">
                                <span className="text-muted-foreground">লোড হচ্ছে...</span>
                            </div>
                          ) : getStudentsByClass(className).length === 0 ? (
                            <div className="flex justify-center items-center py-12">
                                <span className="text-muted-foreground">এই শ্রেণিতে কোনো শিক্ষার্থী নেই অথবা ফিল্টারের সাথে মিলে না।</span>
                            </div>
                          ) : viewMode === 'grid' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-2">
                                {getStudentsByClass(className).map((student) => (
                                    <Card key={student.id} className={cn(
                                        "overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-1 group relative",
                                        student.id === targetStudentId && "ring-2 ring-yellow-400"
                                    )}>
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="secondary" size="icon" className="h-7 w-7 bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white" onClick={() => setStudentToView(student)}>
                                                <Eye className="h-3 w-3" />
                                            </Button>
                                            {canManageStudents && (
                                                <Link href={`/edit-student/${student.id}`}>
                                                    <Button variant="secondary" size="icon" className="h-7 w-7 bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white">
                                                        <FilePen className="h-3 w-3" />
                                                    </Button>
                                                </Link>
                                            )}
                                        </div>
                                        <div className="p-4 flex flex-col items-center text-center">
                                            <div className="relative mb-3">
                                                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-primary/30 to-transparent blur-sm"></div>
                                                <Image
                                                    src={student.photoUrl || '/placeholder.png'}
                                                    alt={student.studentNameBn}
                                                    width={80}
                                                    height={80}
                                                    className="rounded-full object-cover relative ring-2 ring-background border"
                                                />
                                            </div>
                                            <h3 className="font-bold text-base line-clamp-1">{student.studentNameBn}</h3>
                                            <p className="text-xs text-muted-foreground mb-2">রোল: {student.roll} • আইডি: {student.generatedId || '-'}</p>
                                            
                                            <div className="flex flex-wrap justify-center gap-1 mt-1">
                                                {student.gender && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{
                                                        isMale(student.gender) ? 'ছাত্র' :
                                                        isFemale(student.gender) ? 'ছাত্রী' : 'অন্যান্য'
                                                    }</span>
                                                )}
                                                {student.isStipendReceiver && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">উপবৃত্তি</span>
                                                )}
                                                {student.religion && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full">{
                                                        student.religion === 'Islam' || student.religion === 'islam' ? 'ইসলাম' :
                                                        student.religion === 'Hinduism' || student.religion === 'hinduism' ? 'হিন্দু' : student.religion
                                                    }</span>
                                                )}
                                                {student.group && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full">{
                                                        student.group === 'science' ? 'বিজ্ঞান' :
                                                        student.group === 'arts' ? 'মানবিক' :
                                                        student.group === 'commerce' ? 'ব্যবসায় শিক্ষা' : student.group
                                                    }</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="bg-muted/30 px-4 py-2 flex justify-between items-center text-xs text-muted-foreground border-t">
                                            <span>পিতা: {student.fatherNameBn}</span>
                                            <span>{student.guardianMobile || student.studentMobile}</span>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                          ) : (
                          <div className="table-container">
                            <Table>
                              <TableHeader className="bg-muted/50 sticky top-0 z-20">
                                <TableRow>
                                  <TableHead>ক্রমিক নং</TableHead>
                                  <TableHead>ছবি</TableHead>
                                  <TableHead>রোল</TableHead>
                                  <TableHead>আইডি</TableHead>
                                  <TableHead>শিক্ষার্থীর নাম</TableHead>
                                  <TableHead>পিতার নাম</TableHead>
                                  <TableHead>মোবাইল নম্বর</TableHead>
                                  <TableHead className="text-right no-print">কার্যক্রম</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                  {getStudentsByClass(className).map((student, index) => (
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
                                        src={student.photoUrl || '/placeholder.png'}
                                        alt={student.studentNameBn}
                                        width={40}
                                        height={40}
                                        className="rounded-full object-cover"
                                      />
                                    </TableCell>
                                    <TableCell>{student.roll != null ? student.roll.toLocaleString('bn-BD') : '-'}</TableCell>
                                    <TableCell>{student.generatedId || '-'}</TableCell>
                                    <TableCell className="whitespace-nowrap font-bold">{student.studentNameBn}</TableCell>
                                    <TableCell className="whitespace-nowrap">{student.fatherNameBn}</TableCell>
                                    <TableCell>
                                      <div className="flex flex-col whitespace-nowrap">
                                        {student.guardianMobile && <span>{student.guardianMobile}</span>}
                                        {student.studentMobile && <span>{student.studentMobile}</span>}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right no-print">
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
                                  ))}
                              </TableBody>
                            </Table>
                          </div>
                          )}
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
                        <Image src={studentToView.photoUrl || '/placeholder.png'} alt={studentToView.studentNameBn} width={80} height={80} className="rounded-lg object-cover" />
                        <div>
                            <DialogTitle className="text-2xl mb-1">{studentToView.studentNameBn}</DialogTitle>
                            <DialogDescription>
                                রোল: {studentToView.roll != null ? studentToView.roll.toLocaleString('bn-BD') : '-'} | শ্রেণি: {classNamesMap[studentToView.className] || studentToView.className} | শিক্ষাবর্ষ: {studentToView.academicYear ? studentToView.academicYear.toLocaleString('bn-BD') : '-'}
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
