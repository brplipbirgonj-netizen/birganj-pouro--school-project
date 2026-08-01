'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  Menu,
  LayoutDashboard,
  UserPlus,
  Users,
  CalendarCheck,
  BookMarked,
  Banknote,
  Users2,
  Settings,
  FileText,
  CalendarClock,
  LogOut,
  UserSearch,
  MessageSquare,
  Search,
  BookOpen,
  FileBadge,
  PieChart,
  IdCard,
  UserCheck,
  ChevronRight
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useEffect, useState, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { Label } from "@/components/ui/label";
import { Skeleton } from './ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { signOut } from '@/lib/auth';
import { useFirestore } from '@/firebase';
import { collection, query, where, limit, onSnapshot, getDocs } from 'firebase/firestore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Student, studentFromDoc, isFemale, getStudentPlaceholderImage, sanitizePhotoUrl } from '@/lib/student-data';
import { StudentFeeDialog } from './StudentFeeDialog';
import { cn } from '@/lib/utils';
import { getExams, Exam } from '@/lib/exam-data';

const classNamesMap: { [key: string]: string } = {
    '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

// Global Menu Structure
const mainMenuItems = [
  { id: 'dashboard', label: 'ড্যাসবোর্ড', icon: LayoutDashboard, href: '/', permission: 'view:dashboard', color: 'bg-sky-50 text-sky-700 border-sky-100' },
  { id: 'admissions', label: 'ভর্তি আবেদনসমূহ', icon: UserCheck, href: '/admissions-management', permission: 'manage:admissions', color: 'bg-indigo-50 text-indigo-700 border-indigo-100' },
  { id: 'profile-search', label: 'শিক্ষার্থী প্রোফাইল', icon: UserSearch, href: '/student-profile', permission: 'view:student-profile', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  { id: 'add-student', label: 'নতুন শিক্ষার্থী যোগ', icon: UserPlus, href: '/add-student', permission: 'manage:students', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
  { id: 'student-list', label: 'শিক্ষার্থী তালিকা', icon: Users, href: '/student-list', permission: 'view:students', color: 'bg-rose-50 text-rose-700 border-rose-100' },
  { id: 'attendance', label: 'হাজিরা', icon: CalendarCheck, href: '/attendance', permission: 'manage:attendance', color: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: 'results', label: 'ফলাফল', icon: BookMarked, href: '/results', permission: ['manage:results', 'input:results'], color: 'bg-violet-50 text-violet-700 border-violet-100' },
  { id: 'messaging', label: 'মেসেজ', icon: MessageSquare, href: '/messaging', permission: ['send:messaging', 'manage:messaging'], color: 'bg-lime-50 text-lime-700 border-lime-100' },
  { id: 'accounts', label: 'হিসাব শাখা', icon: Banknote, href: '/accounts', permission: 'view:accounts', color: 'bg-teal-50 text-teal-700 border-teal-100' },
  { id: 'staff', label: 'শিক্ষক ও কর্মচারী', icon: Users2, href: '/staff', permission: 'view:staff', color: 'bg-orange-50 text-orange-700 border-orange-100' },
  { id: 'documents', label: 'ডকুমেন্ট', icon: FileText, href: '/documents', permission: 'manage:documents', color: 'bg-slate-50 text-slate-700 border-slate-100' },
  { id: 'routines', label: 'রুটিন', icon: CalendarClock, href: '/routines', permission: 'view:routines', color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100' },
  { id: 'settings', label: 'সেটিং', icon: Settings, href: '/settings', permission: 'manage:settings', color: 'bg-gray-50 text-gray-700 border-gray-100' },
];

export function Header() {
  const [isClient, setIsClient] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { selectedYear, setSelectedYear, availableYears } = useAcademicYear();
  const { schoolInfo, isLoading: isSchoolInfoLoading } = useSchoolInfo();
  const { user, loading: authLoading, hasPermission } = useAuth();
  const db = useFirestore();
  
  const [displayPhoto, setDisplayPhoto] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [displayDesignation, setDisplayDesignation] = useState<string | null>(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastFetchedYear, setLastFetchedYear] = useState('');

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [actionsDialogOpen, setActionsDialogOpen] = useState(false);
  const [feeDialogOpen, setFeeDialogOpen] = useState(false);
  
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamForMarksheet, setSelectedExamForMarksheet] = useState<string>('বার্ষিক পরীক্ষা');

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!user || !db) {
        setDisplayPhoto(null);
        setDisplayName(null);
        setDisplayDesignation(null);
        return;
    }

    let unsubscribe: (() => void) | undefined;
    
    if (user.role === 'teacher' && user.email) {
      const staffQuery = query(collection(db, 'staff'), where('email', '==', user.email.toLowerCase()), limit(1));
      unsubscribe = onSnapshot(staffQuery, (snapshot) => {
        if (!snapshot.empty) {
          const staffData = snapshot.docs[0].data();
          setDisplayPhoto(staffData.photoUrl);
          setDisplayName(staffData.nameBn);
          setDisplayDesignation(staffData.designation);
        } else {
          setDisplayPhoto(null);
          setDisplayName(user.displayName || null);
          setDisplayDesignation('শিক্ষক');
        }
      }, (error) => {
          if (error.code === 'permission-denied') return;
      });
    } else {
      setDisplayPhoto(user.photoUrl || null);
      setDisplayName(user.displayName || 'Admin');
      setDisplayDesignation('সিস্টেম এডমিনিস্ট্রেটর');
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, db]);

  // Fetch exams for marksheet selection
  useEffect(() => {
    if (db && selectedYear && user) {
        getExams(db, selectedYear).then(data => {
            setExams(data);
            if (data.length > 0) {
                const annual = data.find(e => e.name.includes('বার্ষিক'));
                if (annual) setSelectedExamForMarksheet(annual.name);
                else setSelectedExamForMarksheet(data[0].name);
            }
        });
    }
  }, [db, selectedYear, user]);

  const handleLogout = async () => {
    try {
      await signOut();
      window.location.href = '/login';
    } catch (error) {
      console.error("Logout error:", error);
      window.location.href = '/login';
    }
  };

  const handleSearchOpen = async (open: boolean) => {
    setSearchOpen(open);
    if (open && db && user && (allStudents.length === 0 || lastFetchedYear !== selectedYear)) {
        setIsSearching(true);
        try {
            const q = query(collection(db, 'students'), where('academicYear', '==', selectedYear));
            const snap = await getDocs(q);
            setAllStudents(snap.docs.map(studentFromDoc));
            setLastFetchedYear(selectedYear);
        } catch (e) {
            console.error("Search fetch error:", e);
        }
        setIsSearching(false);
    }
  };

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const bnToEn = (str: string) => str.replace(/[০-৯]/g, d => "০১২৩৪৫৬৭৮৯".indexOf(d).toString());
    const q = searchQuery.toLowerCase();
    const qEn = bnToEn(q);

    return allStudents.filter(s => {
        const nameBn = (s.studentNameBn || '').toLowerCase();
        const nameEn = (s.studentNameEn || '').toLowerCase();
        const rollStr = (s.roll || '').toString();
        const idStr = (s.generatedId || '').toLowerCase();
        
        const matchesName = nameBn.includes(q) || nameEn.includes(q);
        const rollEn = parseInt(qEn, 10);
        const matchesRoll = !isNaN(rollEn) && rollEn === s.roll;
        const matchesId = idStr === qEn;
        
        return matchesName || matchesRoll || matchesId;
    }).slice(0, 10);
  }, [searchQuery, allStudents]);

  const handleStudentClick = (student: Student) => {
    setSelectedStudent(student);
    setSearchOpen(false);
    setSearchQuery('');
    setActionsDialogOpen(true);
  };

  const permittedMenuItems = useMemo(() => {
    return mainMenuItems.filter(item => {
      if (Array.isArray(item.permission)) {
        return item.permission.some(p => hasPermission(p));
      }
      return hasPermission(item.permission);
    });
  }, [user, hasPermission]);

  const bottomNavItems = [
    { label: 'হোম', icon: LayoutDashboard, href: '/', permission: 'view:dashboard' },
    { label: 'ফেরত', icon: ArrowLeft, type: 'back', permission: 'view:dashboard' },
    { label: 'শিক্ষার্থী', icon: Users, href: '/student-list', permission: 'view:students' },
    { label: 'হাজিরা', icon: CalendarCheck, href: '/attendance', permission: 'manage:attendance' },
    { label: '', icon: Search, type: 'search', permission: 'view:students' },
    { label: 'ফলাফল', icon: BookMarked, href: '/results', permission: ['manage:results', 'input:results'] },
    { label: 'হিসাব', icon: Banknote, href: '/accounts', permission: 'view:accounts' },
    { label: 'মেসেজ', icon: MessageSquare, href: '/messaging', permission: ['send:messaging', 'manage:messaging'] },
    { label: 'রুটিন', icon: CalendarClock, href: '/routines', permission: 'view:routines' },
  ];

  const permittedBottomNavItems = useMemo(() => 
    bottomNavItems.filter(item => {
        if (Array.isArray(item.permission)) {
            return item.permission.some(p => hasPermission(p));
        }
        return hasPermission(item.permission);
    }), 
    [user, hasPermission]
  );

  if (!isClient) return <header className="h-16 bg-primary" />;

  return (
    <>
      <header className="sticky top-0 z-50 flex h-16 md:h-24 items-center justify-between border-b bg-primary px-4 text-primary-foreground shadow-sm sm:px-6 md:px-8">
        <div className="flex items-center gap-2">
          {user && (
            <>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0 rounded-lg bg-white text-primary hover:bg-gray-100">
                    <Menu className="h-6 w-6" />
                    <span className="sr-only">Toggle navigation menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col p-0 font-kalpurush">
                  <SheetHeader className="p-4 border-b bg-red-50">
                      <SheetTitle className="sr-only">Main Menu</SheetTitle>
                      <SheetDescription className="sr-only">Navigation and settings</SheetDescription>
                    <Link
                      href="/"
                      className="flex items-center gap-2 text-lg font-semibold text-foreground"
                    >
                      {isSchoolInfoLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : (schoolInfo.logoUrl && (
                        <div className="relative h-10 w-10">
                          <Image src={schoolInfo.logoUrl} alt="School Logo" fill className="rounded-full object-contain" />
                        </div>
                      ))}
                      <span className="font-black text-slate-900">{isSchoolInfoLoading ? <Skeleton className="h-6 w-32" /> : schoolInfo.name}</span>
                    </Link>
                  </SheetHeader>
                  <div className="p-4 border-b bg-blue-50/50">
                      <Label htmlFor="academic-year-select" className="text-xs font-black uppercase text-muted-foreground tracking-widest">শিক্ষাবর্ষ নির্বাচন</Label>
                      {availableYears.length > 0 ? (
                          <Select value={selectedYear} onValueChange={setSelectedYear}>
                              <SelectTrigger id="academic-year-select" className="mt-1.5 h-11 bg-white border-2 border-primary/10 font-black text-primary">
                                  <SelectValue placeholder="" />
                              </SelectTrigger>
                              <SelectContent>
                                  {availableYears.map(year => (
                                      <SelectItem key={year} value={year} className="font-bold">{year.toLocaleString('bn-BD')}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      ) : (
                          <div className="mt-1.5 h-11 w-full animate-pulse rounded-md bg-muted" />
                      )}
                  </div>
                  <nav className="flex-1 overflow-y-auto bg-slate-50/50">
                    <div className="grid gap-2 p-4">
                      {permittedMenuItems.map((item) => (
                        <SheetClose asChild key={item.id}>
                          <Link
                            href={item.href}
                            className={cn(
                              "flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-all group hover:scale-[1.02] shadow-sm",
                              pathname === item.href ? "border-primary bg-primary text-white shadow-md ring-2 ring-primary/20" : cn(item.color, "hover:shadow-md")
                            )}
                          >
                            <item.icon className={cn("h-5 w-5 shrink-0", pathname === item.href ? "text-white" : "")} />
                            <span className="font-black text-sm">{item.label}</span>
                            <ChevronRight className={cn("ml-auto h-4 w-4 opacity-30 group-hover:opacity-100", pathname === item.href ? "text-white opacity-100" : "")} />
                          </Link>
                        </SheetClose>
                      ))}
                    </div>
                  </nav>
                  
                  {/* Sidebar User Profile Section */}
                  <div className="p-4 border-t bg-white mt-auto">
                    <div className="flex items-center gap-3 mb-4 p-3 bg-muted/30 rounded-2xl border border-primary/5">
                        <Avatar className="h-12 w-12 border-2 border-white shadow-md">
                            <AvatarImage src={displayPhoto || undefined} />
                            <AvatarFallback className="font-black">{displayName?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 overflow-hidden text-left">
                            <p className="text-sm font-black text-slate-900 truncate">{displayName || 'ব্যবহারকারী'}</p>
                            <p className="text-[10px] font-bold text-primary italic truncate">
                                {displayDesignation || (user.role === 'admin' ? 'সিস্টেম এডমিন' : 'শিক্ষক')}
                            </p>
                        </div>
                    </div>
                    <Button 
                      variant="destructive" 
                      className="w-full font-black shadow-lg h-12 rounded-xl text-md" 
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 h-5 w-5" />
                      লগ আউট
                    </Button>
                  </div>

                  <div className="p-3 border-t bg-muted/10 text-center text-[10px] text-muted-foreground font-bold">
                    <p>© ২০২৬ {schoolInfo.name}।</p>
                    <p>কেন্দ্রীয় শিক্ষা ব্যবস্থাপনা পোর্টাল</p>
                  </div>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>

        <Link href="/" className="flex items-center gap-2 sm:gap-3 md:gap-6 max-w-[80vw]">
            {isSchoolInfoLoading ? (
              <Skeleton className="h-11 w-11 md:h-[75px] md:w-[75px] rounded-full" />
            ) : (
              schoolInfo.logoUrl && (
                <div className="relative h-11 w-11 md:h-[75px] md:w-[75px] shrink-0">
                  <Image 
                    src={schoolInfo.logoUrl} 
                    alt="School Logo" 
                    fill
                    className="rounded-full object-contain" 
                  />
                </div>
              )
            )}
            <h1 className="text-xl sm:text-2xl md:text-[50px] font-black whitespace-nowrap tracking-tight md:[text-shadow:2px_2px_0px_#000,-2px_-2px_0px_#000,2px_-2px_0px_#000,-2px_2px_0px_#000,4px_4px_10px_rgba(0,0,0,0.5)] [text-shadow:1px_1px_0px_#000,-1px_-1px_0px_#000,1px_-1px_0px_#000,-1px_1px_0px_#000,2px_2px_4px_rgba(0,0,0,0.5)] md:py-4 leading-normal">
              {isSchoolInfoLoading ? <Skeleton className="h-7 w-48 md:h-12 md:w-80" /> : schoolInfo.name}
            </h1>
        </Link>
        
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Main Top Bar User Info */}
          {user && (
            <div className="hidden lg:flex flex-col items-end text-right mr-1 leading-tight select-none">
              <span className="text-[13px] font-black text-white drop-shadow-sm">{displayName || 'User'}</span>
              <span className="text-[10px] font-bold text-white/80 italic">{displayDesignation || 'শিক্ষক'}</span>
            </div>
          )}

          <Dialog open={actionsDialogOpen} onOpenChange={setActionsDialogOpen}>
              <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto font-kalpurush">
                  <DialogHeader>
                      <div className="flex items-center gap-4 mb-4">
                          <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-sm">
                              <AvatarImage src={sanitizePhotoUrl(selectedStudent?.photoUrl, selectedStudent?.gender) || (selectedStudent ? getStudentPlaceholderImage(selectedStudent.gender) : undefined)} />
                              <AvatarFallback>{selectedStudent?.studentNameBn?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                              <DialogTitle className="text-xl font-black">{selectedStudent?.studentNameBn}</DialogTitle>
                              <DialogDescription className="font-bold">
                                  রোল: {selectedStudent?.roll.toLocaleString('bn-BD')} | {classNamesMap[selectedStudent?.className || ''] || selectedStudent?.className} শ্রেণি | শিক্ষাবর্ষ: {selectedYear.toLocaleString('bn-BD')}
                              </DialogDescription>
                          </div>
                      </div>
                  </DialogHeader>
                  <div className="grid grid-cols-1 gap-3 py-2">
                      <div className="p-4 bg-muted/30 rounded-lg space-y-3 mb-2 border-2 border-dashed border-primary/20">
                          <Label className="font-black text-primary text-xs uppercase tracking-wider flex items-center gap-1">
                              <BookMarked className="h-3 w-3" /> মার্কশিট এর জন্য পরীক্ষা নির্বাচন করুন:
                          </Label>
                          <Select value={selectedExamForMarksheet} onValueChange={setSelectedExamForMarksheet}>
                              <SelectTrigger className="bg-white font-black"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                  {exams.map(e => <SelectItem key={e.id} value={e.name} className="font-bold">{e.name}</SelectItem>)}
                              </SelectContent>
                          </Select>
                          <Button 
                              variant="default" 
                              className="w-full h-11 text-md font-black shadow-lg bg-violet-600 hover:bg-violet-700"
                              onClick={() => {
                                  window.open(`/marksheet/${selectedStudent?.id}?academicYear=${selectedYear}&examName=${encodeURIComponent(selectedExamForMarksheet)}`, '_blank');
                              }}
                          >
                              <BookOpen className="mr-3 h-5 w-5" /> ফলাফল (মার্কশিট) দেখুন
                          </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                          <Button 
                              variant="outline" 
                              className="justify-start h-12 text-xs font-bold bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-900"
                              onClick={() => {
                                  setActionsDialogOpen(false);
                                  router.push(`/student-list?class=${selectedStudent?.className}&studentId=${selectedStudent?.id}`);
                              }}
                          >
                              <Users className="mr-2 h-4 w-4 text-rose-600" /> প্রোফাইল দেখুন
                          </Button>
                          <Button 
                              variant="outline" 
                              className="justify-start h-12 text-xs font-bold bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-900"
                              onClick={() => {
                                  setActionsDialogOpen(false);
                                  setFeeDialogOpen(true);
                              }}
                          >
                              <Banknote className="mr-2 h-4 w-4 text-teal-600" /> বেতন আদায়
                          </Button>
                          <Button 
                              variant="outline" 
                              className="justify-start h-12 text-xs font-bold bg-fuchsia-50 hover:bg-fuchsia-100 border-fuchsia-200 text-fuchsia-900"
                              onClick={() => {
                                  setActionsDialogOpen(false);
                                  router.push(`/documents/admit-card/${selectedStudent?.id}`);
                              }}
                          >
                              <IdCard className="mr-2 h-4 w-4 text-fuchsia-600" /> প্রবেশ পত্র
                          </Button>
                          <Button 
                              variant="outline" 
                              className="justify-start h-12 text-xs font-bold bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900"
                              onClick={() => {
                                  setActionsDialogOpen(false);
                                  window.open(`/documents/testimonial/${selectedStudent?.id}`, '_blank');
                              }}
                          >
                              <FileBadge className="mr-2 h-4 w-4 text-slate-600" /> প্রত্যয়ন পত্র
                          </Button>
                          <Button 
                              variant="outline" 
                              className="justify-start h-12 text-xs font-bold bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900"
                              onClick={() => {
                                  setActionsDialogOpen(false);
                                  router.push(`/documents/tc/${selectedStudent?.id}`);
                              }}
                          >
                              <FileText className="mr-2 h-4 w-4 text-amber-600" /> ছাড়পত্র (TC)
                          </Button>
                          <Button 
                              variant="outline" 
                              className="justify-start h-12 text-xs font-bold bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-900"
                              onClick={() => {
                                  setActionsDialogOpen(false);
                                  router.push(`/student-profile?roll=${selectedStudent?.roll}&class=${selectedStudent?.className}`);
                              }}
                          >
                              <PieChart className="mr-2 h-4 w-4 text-indigo-600" /> হাজিরা রিপোর্ট
                          </Button>
                      </div>
                  </div>
              </DialogContent>
          </Dialog>

          {selectedStudent && (
              <StudentFeeDialog 
                  student={selectedStudent} 
                  open={feeDialogOpen} 
                  onOpenChange={setFeeDialogOpen} 
                  onFeeCollected={() => {}} 
              />
          )}

          {authLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-white cursor-pointer shadow-md">
                  <AvatarImage src={displayPhoto || undefined} alt={user.email || 'user'} />
                  <AvatarFallback>{user.email ? user.email.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-kalpurush">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span className="font-black">{displayName || 'ব্যবহারকারী'}</span>
                      <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer font-bold">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>প্রোফাইল সেটিংস</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-700 font-bold">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>লগ আউট</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <div className="px-2 py-1.5 text-center bg-muted/20 rounded-b-md">
                    <p className="text-[10px] font-black text-slate-800 leading-tight">{displayName}</p>
                    <p className="text-[9px] font-bold text-primary italic opacity-70">
                      {displayDesignation || (user.role === 'admin' ? 'সিস্টেম এডমিন' : 'শিক্ষক')}
                    </p>
                  </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button variant="secondary">লগইন করুন</Button>
            </Link>
          )}
        </div>
      </header>

      {user && (
        <nav 
          className="fixed bottom-0 left-0 right-0 z-50 h-16 md:h-14 bg-primary no-print shadow-[0_-4px_10px_rgba(0,0,0,0.15)] w-full max-w-full overflow-visible box-border font-kalpurush"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${permittedBottomNavItems.length}, 1fr)`,
            alignItems: 'center'
          }}
        >
          {permittedBottomNavItems.map((item, index) => {
            const isActive = item.href ? pathname === item.href : false;
            
            if (item.type === 'search') {
                return (
                    <Dialog key="search-dialog" open={searchOpen} onOpenChange={handleSearchOpen}>
                        <DialogTrigger asChild>
                            <div className="flex justify-center items-center h-full relative">
                                <button className="absolute -top-3 flex items-center justify-center shrink-0 z-10 outline-none focus:outline-none">
                                    <div className="h-14 w-14 sm:h-16 sm:w-16 bg-white rounded-full border-4 border-primary shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95">
                                        <Search className="h-7 w-7 sm:h-8 sm:w-8 text-primary" />
                                    </div>
                                </button>
                            </div>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] font-kalpurush">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black">শিক্ষার্থী খুঁজুন</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <Input 
                                    placeholder="নাম বা রোল লিখে খুঁজুন..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    autoFocus
                                    className="h-11 font-bold bg-muted/10 border-2"
                                />
                                <div className="space-y-2">
                                    {isSearching ? (
                                        <div className="flex flex-col items-center py-8 gap-2">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            <p className="text-sm text-muted-foreground font-bold">ডাটা লোড হচ্ছে...</p>
                                        </div>
                                    ) : filteredResults.length > 0 ? (
                                        <div className="max-h-[350px] overflow-y-auto pr-2 space-y-2">
                                            {filteredResults.map(s => (
                                                <div 
                                                    key={s.id} 
                                                    className="flex items-center justify-between p-3 border-2 rounded-xl hover:bg-muted/50 cursor-pointer transition-all active:scale-95"
                                                    onClick={() => handleStudentClick(s)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-10 w-10 border shadow-sm">
                                                            <AvatarImage src={sanitizePhotoUrl(s.photoUrl, s.gender) || getStudentPlaceholderImage(s.gender)} />
                                                            <AvatarFallback>{s.studentNameBn?.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-sm font-black text-slate-800">{s.studentNameBn}</p>
                                                            <p className="text-[10px] font-bold text-muted-foreground">রোল: {s.roll.toLocaleString('bn-BD')} | {classNamesMap[s.className] || s.className} শ্রেণি</p>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary"><ChevronRight className="h-5 w-5" /></Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : searchQuery.trim() ? (
                                        <p className="text-center text-sm text-muted-foreground py-8 font-bold italic">কোনো শিক্ষার্থী পাওয়া যায়নি।</p>
                                    ) : (
                                        <p className="text-center text-[10px] text-muted-foreground font-bold italic py-4 uppercase tracking-widest">ফলাফল এখানে প্রদর্শিত হবে</p>
                                    )}
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )
            }

            if (item.type === 'back') {
                return (
                    <button 
                        key="back-item" 
                        onClick={() => router.back()} 
                        className="flex flex-col items-center justify-center gap-0.5 transition-colors text-primary-foreground/70 hover:text-white min-w-0 h-full w-full px-0 select-none"
                    >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="text-[8px] sm:text-[10px] font-black uppercase truncate w-full text-center px-0.5">{item.label}</span>
                    </button>
                )
            }

            return (
              <Link key={item.href || index} href={item.href!} className="h-full w-full px-0 select-none">
                <div className={cn(
                  "flex flex-col items-center justify-center gap-0.5 transition-colors h-full w-full",
                  isActive ? "text-white" : "text-primary-foreground/70 hover:text-white"
                )}>
                  <item.icon className={cn("h-5 w-5 shrink-0", isActive && "scale-110 shadow-lg")} />
                  <span className={cn(
                      "text-[8px] sm:text-[10px] font-black uppercase truncate w-full text-center px-0.5",
                      isActive && "underline decoration-white decoration-2 underline-offset-2"
                  )}>
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}
