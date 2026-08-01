'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
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
  IdCard,
  UserCheck,
  ChevronRight,
  Loader2
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
import { Student, studentFromDoc, getStudentPlaceholderImage, sanitizePhotoUrl } from '@/lib/student-data';
import { StudentFeeDialog } from './StudentFeeDialog';
import { cn } from '@/lib/utils';
import { getExams, Exam } from '@/lib/exam-data';
import { ScrollArea } from './ui/scroll-area';

const classNamesMap: { [key: string]: string } = {
    '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

// All 13 Menu Items
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
    if (!user || !db) return;

    let unsubscribe: (() => void) | undefined;
    
    if (user.role === 'teacher' && user.email) {
      const staffQuery = query(collection(db, 'staff'), where('email', '==', user.email.toLowerCase().trim()), limit(1));
      unsubscribe = onSnapshot(staffQuery, (snapshot) => {
        if (!snapshot.empty) {
          const staffData = snapshot.docs[0].data();
          setDisplayPhoto(staffData.photoUrl);
          setDisplayName(staffData.nameBn);
          setDisplayDesignation(staffData.designation);
        } else {
          setDisplayPhoto(user.photoUrl || null);
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
      if (unsubscribe) unsubscribe();
    };
  }, [user, db]);

  useEffect(() => {
    if (db && selectedYear && user) {
        getExams(db, selectedYear).then(data => {
            setExams(data);
            if (data.length > 0) {
                const annual = data.find(e => e.name.includes('বার্ষিক'));
                setSelectedExamForMarksheet(annual ? annual.name : data[0].name);
            }
        });
    }
  }, [db, selectedYear, user]);

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/login';
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
            console.error(e);
        }
        setIsSearching(false);
    }
  };

  const filteredResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const bnToEn = (str: string) => str.replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)].toString());
    const q = searchQuery.toLowerCase();
    const qEn = bnToEn(q);
    return allStudents.filter(s => {
        const nameBn = (s.studentNameBn || '').toLowerCase();
        const nameEn = (s.studentNameEn || '').toLowerCase();
        const rollEn = parseInt(qEn, 10);
        return nameBn.includes(q) || nameEn.includes(q) || (!isNaN(rollEn) && rollEn === s.roll) || (s.generatedId?.toLowerCase() === qEn);
    }).slice(0, 10);
  }, [searchQuery, allStudents]);

  const handleStudentClick = (student: Student) => {
    setSelectedStudent(student);
    setSearchOpen(false);
    setSearchQuery('');
    setActionsDialogOpen(true);
  };

  const permittedMenuItems = useMemo(() => {
    if (!user) return [];
    return mainMenuItems.filter(item => {
      if (user.role === 'admin') return true;
      if (Array.isArray(item.permission)) return item.permission.some(p => hasPermission(p));
      return hasPermission(item.permission);
    });
  }, [user, hasPermission]);

  const permittedBottomNavItems = useMemo(() => {
    if (!user) return [];
    const bottomNavItems = [
      { label: 'হোম', icon: LayoutDashboard, href: '/', permission: 'view:dashboard' },
      { label: 'শিক্ষার্থী', icon: Users, href: '/student-list', permission: 'view:students' },
      { label: 'হাজিরা', icon: CalendarCheck, href: '/attendance', permission: 'manage:attendance' },
      { label: '', icon: Search, type: 'search', permission: 'view:students' },
      { label: 'হিসাব', icon: Banknote, href: '/accounts', permission: 'view:accounts' },
      { label: 'মেসেজ', icon: MessageSquare, href: '/messaging', permission: ['send:messaging', 'manage:messaging'] },
      { label: 'রুটিন', icon: CalendarClock, href: '/routines', permission: 'view:routines' },
    ];
    return bottomNavItems.filter(item => {
        if (user.role === 'admin') return true;
        if (Array.isArray(item.permission)) return item.permission.some(p => hasPermission(p));
        return hasPermission(item.permission);
    });
  }, [user, hasPermission]);

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
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="flex flex-col p-0 font-kalpurush h-full">
                  <SheetHeader className="p-4 border-b bg-primary/5 shrink-0">
                      <SheetTitle className="sr-only">Main Menu</SheetTitle>
                      <SheetDescription className="sr-only">Navigation and settings</SheetDescription>
                    <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-foreground">
                      {isSchoolInfoLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : (schoolInfo.logoUrl && (
                        <div className="relative h-10 w-10">
                          <Image src={schoolInfo.logoUrl} alt="Logo" fill className="rounded-full object-contain" />
                        </div>
                      ))}
                      <span className="font-black text-slate-900 truncate">{isSchoolInfoLoading ? <Skeleton className="h-6 w-32" /> : schoolInfo.name}</span>
                    </Link>
                  </SheetHeader>
                  
                  <div className="p-4 border-b bg-slate-50 shrink-0">
                      <Label htmlFor="year-select" className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">শিক্ষাবর্ষ</Label>
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                          <SelectTrigger id="year-select" className="mt-1.5 h-10 bg-white border-2 border-primary/10 font-black text-primary">
                              <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                              {availableYears.map(year => (
                                  <SelectItem key={year} value={year} className="font-bold">{year.toLocaleString('bn-BD')}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full">
                        <nav className="grid gap-2 p-4">
                            {permittedMenuItems.map((item) => (
                                <SheetClose asChild key={item.id}>
                                    <Link
                                        href={item.href}
                                        className={cn(
                                            "flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 transition-all shadow-sm",
                                            pathname === item.href ? "border-primary bg-primary text-white shadow-md" : cn(item.color, "hover:shadow-md")
                                        )}
                                    >
                                        <item.icon className={cn("h-5 w-5 shrink-0", pathname === item.href ? "text-white" : "")} />
                                        <span className="font-black text-sm">{item.label}</span>
                                        <ChevronRight className={cn("ml-auto h-4 w-4 opacity-30", pathname === item.href ? "text-white opacity-100" : "")} />
                                    </Link>
                                </SheetClose>
                            ))}
                            {permittedMenuItems.length === 0 && (
                                <div className="flex flex-col items-center py-20 gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                                    <p className="text-xs font-bold text-muted-foreground">মেনু লোড হচ্ছে...</p>
                                </div>
                            )}
                        </nav>
                    </ScrollArea>
                  </div>
                  
                  <div className="p-4 border-t bg-white shrink-0 mt-auto">
                    <div className="flex items-center gap-3 mb-4 p-3 bg-muted/30 rounded-2xl border">
                        <Avatar className="h-12 w-12 border-2 border-white shadow-md">
                            <AvatarImage src={displayPhoto || undefined} />
                            <AvatarFallback className="font-black">{displayName?.charAt(0) || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 overflow-hidden">
                            <p className="text-sm font-black text-slate-900 truncate">{displayName || 'User'}</p>
                            <p className="text-[10px] font-bold text-primary italic truncate">
                                {displayDesignation || (user?.role === 'admin' ? 'এডমিন' : 'শিক্ষক')}
                            </p>
                        </div>
                    </div>
                    <Button variant="destructive" className="w-full font-black h-11 rounded-xl" onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" /> লগ আউট
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>

        <Link href="/" className="flex items-center gap-2 sm:gap-4 md:gap-6">
            {!isSchoolInfoLoading && schoolInfo.logoUrl && (
              <div className="relative h-10 w-10 md:h-[70px] md:w-[70px] shrink-0">
                <Image src={schoolInfo.logoUrl} alt="Logo" fill className="rounded-full object-contain" />
              </div>
            )}
            <h1 className="text-xl sm:text-2xl md:text-[45px] font-black whitespace-nowrap tracking-tight md:[text-shadow:1px_1px_0px_#000,-1px_-1px_0px_#000,1px_-1px_0px_#000,-1px_1px_0px_#000,2px_2px_4px_rgba(0,0,0,0.5)] leading-normal">
              {isSchoolInfoLoading ? <Skeleton className="h-8 w-40 md:h-12 md:w-80" /> : schoolInfo.name}
            </h1>
        </Link>
        
        <div className="flex items-center gap-2 sm:gap-4">
          {authLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-10 w-10 md:h-12 md:w-12 border-2 border-white cursor-pointer shadow-md">
                  <AvatarImage src={displayPhoto || undefined} />
                  <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 font-kalpurush">
                  <DropdownMenuLabel>
                    <p className="font-black">{displayName || 'ব্যবহারকারী'}</p>
                    <p className="text-xs font-normal text-muted-foreground truncate">{user.email}</p>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer font-bold">
                      <Settings className="mr-2 h-4 w-4" /> সেটিংস
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600 font-bold">
                      <LogOut className="mr-2 h-4 w-4" /> লগ আউট
                  </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login"><Button variant="secondary">লগইন</Button></Link>
          )}
        </div>
      </header>

      {user && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-primary no-print shadow-[0_-4px_10px_rgba(0,0,0,0.15)] flex items-center justify-around font-kalpurush">
          {permittedBottomNavItems.map((item, idx) => {
            const isActive = item.href ? pathname === item.href : false;
            if (item.type === 'search') {
                return (
                    <Dialog key="search" open={searchOpen} onOpenChange={handleSearchOpen}>
                        <DialogTrigger asChild>
                            <div className="relative -top-3">
                                <Button className="h-14 w-14 rounded-full bg-white border-4 border-primary shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95">
                                    <Search className="h-7 w-7 text-primary" />
                                </Button>
                            </div>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md font-kalpurush">
                            <DialogHeader><DialogTitle className="text-xl font-black">শিক্ষার্থী খুঁজুন</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-4">
                                <Input placeholder="নাম বা রোল লিখুন..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus className="h-11 font-bold" />
                                <ScrollArea className="max-h-[300px]">
                                    <div className="space-y-2 pr-2">
                                        {isSearching ? <div className="p-10 text-center"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></div> : filteredResults.map(s => (
                                            <div key={s.id} className="flex items-center justify-between p-3 border-2 rounded-xl hover:bg-muted/50 cursor-pointer" onClick={() => handleStudentClick(s)}>
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-10 w-10 border"><AvatarImage src={sanitizePhotoUrl(s.photoUrl, s.gender) || getStudentPlaceholderImage(s.gender)} /></Avatar>
                                                    <div>
                                                        <p className="text-sm font-black">{s.studentNameBn}</p>
                                                        <p className="text-[10px] font-bold text-muted-foreground">রোল: {s.roll.toLocaleString('bn-BD')} | {classNamesMap[s.className]} শ্রেণি</p>
                                                    </div>
                                                </div>
                                                <ChevronRight className="h-4 w-4 opacity-30" />
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>
                        </DialogContent>
                    </Dialog>
                )
            }
            return (
              <Link key={idx} href={item.href!} className={cn("flex flex-col items-center gap-1 transition-colors", isActive ? "text-white" : "text-primary-foreground/70")}>
                <item.icon className="h-5 w-5" />
                <span className="text-[9px] font-black uppercase">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}

      <Dialog open={actionsDialogOpen} onOpenChange={setActionsDialogOpen}>
          <DialogContent className="font-kalpurush max-w-md">
              <DialogHeader className="flex-row items-center gap-4">
                  <Avatar className="h-16 w-16 border-2"><AvatarImage src={sanitizePhotoUrl(selectedStudent?.photoUrl, selectedStudent?.gender) || (selectedStudent ? getStudentPlaceholderImage(selectedStudent.gender) : undefined)} /></Avatar>
                  <div>
                      <DialogTitle className="text-xl font-black">{selectedStudent?.studentNameBn}</DialogTitle>
                      <DialogDescription className="font-bold">রোল: {selectedStudent?.roll.toLocaleString('bn-BD')} | {classNamesMap[selectedStudent?.className || '']} শ্রেণি</DialogDescription>
                  </div>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-4">
                  <Button variant="outline" className="h-12 bg-rose-50" onClick={() => { setActionsDialogOpen(false); router.push(`/student-list?class=${selectedStudent?.className}&studentId=${selectedStudent?.id}`); }}>প্রোফাইল</Button>
                  <Button variant="outline" className="h-12 bg-teal-50" onClick={() => { setActionsDialogOpen(false); setFeeDialogOpen(true); }}>বেতন আদায়</Button>
                  <Button variant="outline" className="h-12 bg-blue-50" onClick={() => { setActionsDialogOpen(false); router.push(`/student-profile?roll=${selectedStudent?.roll}&class=${selectedStudent?.className}`); }}>হাজিরা রিপোর্ট</Button>
                  <Button variant="outline" className="h-12 bg-slate-50" onClick={() => { setActionsDialogOpen(false); window.open(`/marksheet/${selectedStudent?.id}?academicYear=${selectedYear}&examName=${encodeURIComponent(selectedExamForMarksheet)}`, '_blank'); }}>মার্কশিট</Button>
              </div>
          </DialogContent>
      </Dialog>

      {selectedStudent && <StudentFeeDialog student={selectedStudent} open={feeDialogOpen} onOpenChange={setFeeDialogOpen} onFeeCollected={() => {}} />}
    </>
  );
}
