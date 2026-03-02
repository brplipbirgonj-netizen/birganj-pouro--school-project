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
import { Student, studentFromDoc } from '@/lib/student-data';
import { StudentFeeDialog } from './StudentFeeDialog';
import { cn } from '@/lib/utils';

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

  // Global Search State
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastFetchedYear, setLastFetchedYear] = useState('');

  // Action Popup State
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [actionsDialogOpen, setActionsDialogOpen] = useState(false);
  const [feeDialogOpen, setFeeDialogOpen] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!user || !db) {
        setDisplayPhoto(null);
        setDisplayName(null);
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
        } else {
          setDisplayPhoto(null);
          setDisplayName(user.displayName || null);
        }
      }, (error) => {
          if (error.code === 'permission-denied') return;
      });
    } else {
      setDisplayPhoto(user.photoUrl || null);
      setDisplayName(user.displayName || 'Admin');
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user, db]);

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  // Search Logic
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
        const matchesRoll = rollEn === s.roll;
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

  // Bottom Navigation configuration
  const bottomNavItems = [
    { label: 'হোম', icon: LayoutDashboard, href: '/', permission: 'view:dashboard' },
    { label: 'ফেরত', icon: ArrowLeft, type: 'back', permission: 'view:dashboard' },
    { label: 'শিক্ষার্থী', icon: Users, href: '/student-list', permission: 'view:students' },
    { label: 'হাজিরা', icon: CalendarCheck, href: '/attendance', permission: 'manage:attendance' },
    { label: '', icon: Search, type: 'search', permission: 'view:students' }, // Center item
    { label: 'ফলাফল', icon: BookMarked, href: '/results', permission: 'manage:results' },
    { label: 'হিসাব', icon: Banknote, href: '/accounts', permission: 'view:accounts' },
    { label: 'মেসেজ', icon: MessageSquare, href: '/messaging', permission: 'manage:messaging' },
    { label: 'রুটিন', icon: CalendarClock, href: '/routines', permission: 'view:routines' },
  ];

  if (!isClient) return <header className="h-16 bg-primary" />;

  return (
    <>
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b bg-primary px-4 text-primary-foreground shadow-sm sm:px-6 md:px-8">
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
                <SheetContent side="left" className="flex flex-col p-0">
                  <SheetHeader className="p-4 border-b bg-red-100">
                      <SheetTitle className="sr-only">Main Menu</SheetTitle>
                      <SheetDescription className="sr-only">Navigation and settings</SheetDescription>
                    <Link
                      href="/"
                      className="flex items-center gap-2 text-lg font-semibold text-foreground"
                    >
                      {isSchoolInfoLoading ? <Skeleton className="h-8 w-8 rounded-full" /> : (schoolInfo.logoUrl && (
                        <Image src={schoolInfo.logoUrl} alt="School Logo" width={32} height={32} className="rounded-full" />
                      ))}
                      <span className="">{isSchoolInfoLoading ? <Skeleton className="h-6 w-32" /> : schoolInfo.name}</span>
                    </Link>
                  </SheetHeader>
                  <div className="p-4 border-b bg-blue-100">
                      <Label htmlFor="academic-year-select" className="text-sm font-medium text-muted-foreground">শিক্ষাবর্ষ</Label>
                      {availableYears.length > 0 ? (
                          <Select value={selectedYear} onValueChange={setSelectedYear}>
                              <SelectTrigger id="academic-year-select" className="mt-1">
                                  <SelectValue placeholder="" />
                              </SelectTrigger>
                              <SelectContent>
                                  {availableYears.map(year => (
                                      <SelectItem key={year} value={year}>{year.toLocaleString('bn-BD')}</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      ) : (
                          <div className="mt-1 h-10 w-full animate-pulse rounded-md bg-muted" />
                      )}
                  </div>
                  <nav className="flex-1 overflow-y-auto">
                    <div className="grid gap-1 p-2 text-base font-medium">
                      {hasPermission('view:dashboard') && (
                        <Link
                          href="/"
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-all bg-sky-100 text-sky-800 hover:bg-sky-200"
                        >
                          <LayoutDashboard className="h-5 w-5" />
                          ড্যাসবোর্ড
                        </Link>
                      )}
                      {hasPermission('view:student-profile') && (
                        <Link
                          href="/student-profile"
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-all bg-indigo-100 text-indigo-800 hover:bg-indigo-200"
                        >
                          <UserSearch className="h-5 w-5" />
                          শিক্ষার্থী প্রোফাইল
                        </Link>
                      )}
                      {hasPermission('manage:students') && (
                        <Link
                          href="/add-student"
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-all bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                        >
                          <UserPlus className="h-5 w-5" />
                          নতুন শিক্ষার্থী যোগ
                        </Link>
                      )}
                      {hasPermission('view:students') && (
                        <Link
                          href="/student-list"
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-all bg-rose-100 text-rose-800 hover:bg-rose-200"
                        >
                          <Users className="h-5 w-5" />
                          শিক্ষার্থী তালিকা
                        </Link>
                      )}
                      {hasPermission('manage:attendance') && (
                        <Link
                          href="/attendance"
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-all bg-amber-100 text-amber-800 hover:bg-amber-200"
                        >
                          <CalendarCheck className="h-5 w-5" />
                          হাজিরা
                        </Link>
                      )}
                      {hasPermission('manage:results') && (
                        <Link
                          href="/results"
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-all bg-violet-100 text-violet-800 hover:bg-violet-200"
                        >
                          < BookMarked className="h-5 w-5" />
                          ফলাফল
                        </Link>
                      )}
                      {hasPermission('manage:messaging') && (
                        <Link
                          href="/messaging"
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-all bg-lime-100 text-lime-800 hover:bg-lime-200"
                        >
                          <MessageSquare className="h-5 w-5" />
                          মেসেজ
                        </Link>
                      )}
                      {hasPermission('view:accounts') && (
                        <Link
                          href="/accounts"
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-all bg-teal-100 text-teal-800 hover:bg-teal-200"
                        >
                          <Banknote className="h-5 w-5" />
                          হিসাব শাখা
                        </Link>
                      )}
                      {hasPermission('view:staff') && (
                        <Link
                          href="/staff"
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-all bg-orange-100 text-orange-800 hover:bg-orange-200"
                        >
                          <Users2 className="h-5 w-5" />
                          শিক্ষক ও কর্মচারী
                        </Link>
                      )}
                      {hasPermission('manage:documents') && (
                        <Link
                          href="/documents"
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-all bg-slate-100 text-slate-800 hover:bg-slate-200"
                        >
                          <FileText className="h-5 w-5" />
                          ডকুমেন্ট
                        </Link>
                      )}
                      {hasPermission('view:routines') && (
                        <Link
                          href="/routines"
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-all bg-fuchsia-100 text-fuchsia-800 hover:bg-fuchsia-200"
                        >
                          <CalendarClock className="h-5 w-5" />
                          রুটিন
                        </Link>
                      )}
                      {hasPermission('manage:settings') && (
                        <Link
                          href="/settings"
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 transition-all bg-gray-100 text-gray-800 hover:bg-gray-200"
                        >
                          <Settings className="h-5 w-5" />
                          সেটিং
                        </Link>
                      )}
                    </div>
                  </nav>
                  <div className="p-4 border-t bg-muted/20 text-center text-[10px] text-muted-foreground">
                    <p>© ২০২৬ {schoolInfo.name}।</p>
                    <p>সর্বস্বত্ব সংরক্ষিত।</p>
                  </div>
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>

        <Link href="/" className="flex items-center gap-2">
            {isSchoolInfoLoading ? <Skeleton className="h-10 w-10 rounded-full" /> : (schoolInfo.logoUrl && (
              <Image src={schoolInfo.logoUrl} alt="School Logo" width={40} height={40} className="rounded-full" />
            ))}
            <h1 className="text-[23px] font-black whitespace-nowrap drop-shadow-md">
              {isSchoolInfoLoading ? <Skeleton className="h-7 w-48" /> : schoolInfo.name}
            </h1>
        </Link>
        
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Action Popup for Search Result */}
          <Dialog open={actionsDialogOpen} onOpenChange={setActionsDialogOpen}>
              <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                      <div className="flex items-center gap-4 mb-4">
                          <Avatar className="h-16 w-16 border-2 border-primary/20">
                              <AvatarImage src={selectedStudent?.photoUrl} />
                              <AvatarFallback>{selectedStudent?.studentNameBn?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                              <DialogTitle className="text-xl">{selectedStudent?.studentNameBn}</DialogTitle>
                              <DialogDescription>
                                  রোল: {selectedStudent?.roll.toLocaleString('bn-BD')} | শ্রেণি: {selectedStudent?.className} | শিক্ষাবর্ষ: {selectedYear.toLocaleString('bn-BD')}
                              </DialogDescription>
                          </div>
                      </div>
                  </DialogHeader>
                  <div className="grid grid-cols-1 gap-3 py-4">
                      <Button 
                          variant="outline" 
                          className="justify-start h-12 text-md font-medium bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-900"
                          onClick={() => {
                              setActionsDialogOpen(false);
                              router.push(`/student-list?class=${selectedStudent?.className}&studentId=${selectedStudent?.id}`);
                          }}
                      >
                          <Users className="mr-3 h-5 w-5 text-rose-600" /> বিস্তারিত প্রোফাইল
                      </Button>
                      <Button 
                          variant="outline" 
                          className="justify-start h-12 text-md font-medium bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-900"
                          onClick={() => {
                              setActionsDialogOpen(false);
                              setFeeDialogOpen(true);
                          }}
                      >
                          <Banknote className="mr-3 h-5 w-5 text-teal-600" /> বেতন আদায় করুন
                      </Button>
                      <Button 
                          variant="outline" 
                          className="justify-start h-12 text-md font-medium bg-fuchsia-50 hover:bg-fuchsia-100 border-fuchsia-200 text-fuchsia-900"
                          onClick={() => {
                              setActionsDialogOpen(false);
                              router.push(`/documents/admit-card/${selectedStudent?.id}`);
                          }}
                      >
                          <IdCard className="mr-3 h-5 w-5 text-fuchsia-600" /> প্রবেশ পত্র (একক)
                      </Button>
                      <Button 
                          variant="outline" 
                          className="justify-start h-12 text-md font-medium bg-violet-50 hover:bg-violet-100 border-violet-200 text-violet-900"
                          onClick={() => {
                              setActionsDialogOpen(false);
                              window.open(`/marksheet/${selectedStudent?.id}?academicYear=${selectedYear}`, '_blank');
                          }}
                      >
                          <BookOpen className="mr-3 h-5 w-5 text-violet-600" /> ফলাফল (মার্কশিট)
                      </Button>
                      <Button 
                          variant="outline" 
                          className="justify-start h-12 text-md font-medium bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-900"
                          onClick={() => {
                              setActionsDialogOpen(false);
                              window.open(`/documents/testimonial/${selectedStudent?.id}`, '_blank');
                          }}
                      >
                          <FileBadge className="mr-3 h-5 w-5 text-slate-600" /> প্রত্যয়ন পত্র
                      </Button>
                      <Button 
                          variant="outline" 
                          className="justify-start h-12 text-md font-medium bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-900"
                          onClick={() => {
                              setActionsDialogOpen(false);
                              router.push(`/student-profile?roll=${selectedStudent?.roll}&class=${selectedStudent?.className}`);
                          }}
                      >
                          <PieChart className="mr-3 h-5 w-5 text-indigo-600" /> হাজিরা ও পরিসংখ্যান
                      </Button>
                  </div>
              </DialogContent>
          </Dialog>

          {/* Global Fee Dialog */}
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
                <Avatar className="h-10 w-10 border-2 border-white cursor-pointer">
                  <AvatarImage src={displayPhoto || undefined} alt={user.email || 'user'} />
                  <AvatarFallback>{user.email ? user.email.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{displayName || 'Admin'}</span>
                      <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>প্রোফাইল সেটিংস</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>লগ আউট</span>
                  </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button variant="secondary">লগইন করুন</Button>
            </Link>
          )}
        </div>
      </header>

      {/* Fixed Bottom Navigation Bar */}
      {user && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 h-16 bg-primary flex items-center justify-between px-4 no-print shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
          {bottomNavItems.map((item, index) => {
            const isActive = item.href ? pathname === item.href : false;
            if (!hasPermission(item.permission)) return <div key={index} className="flex-1" />;
            
            // Special rendering for center search button
            if (item.type === 'search') {
                return (
                    <Dialog key="search-dialog" open={searchOpen} onOpenChange={handleSearchOpen}>
                        <DialogTrigger asChild>
                            <button className="relative -mt-4 mb-auto flex items-center justify-center">
                                <div className="h-16 w-16 bg-white rounded-full border-4 border-primary shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95">
                                    <Search className="h-8 w-8 text-primary" />
                                </div>
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>শিক্ষার্থী খুঁজুন</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <input 
                                    placeholder="নাম বা রোল লিখে খুঁজুন..." 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    autoFocus
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                                />
                                <div className="space-y-2">
                                    {isSearching ? (
                                        <p className="text-center text-sm text-muted-foreground py-4">ডাটা লোড হচ্ছে...</p>
                                    ) : filteredResults.length > 0 ? (
                                        <div className="max-h-[300px] overflow-y-auto pr-2">
                                            {filteredResults.map(s => (
                                                <div 
                                                    key={s.id} 
                                                    className="flex items-center justify-between p-3 border rounded-md hover:bg-muted cursor-pointer transition-colors mb-2 last:mb-0"
                                                    onClick={() => handleStudentClick(s)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={s.photoUrl} />
                                                            <AvatarFallback>{s.studentNameBn?.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-sm font-bold">{s.studentNameBn}</p>
                                                            <p className="text-[10px] text-muted-foreground">রোল: {s.roll.toLocaleString('bn-BD')} | শ্রেণি: {s.className}</p>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4 rotate-180" /></Button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : searchQuery.trim() ? (
                                        <p className="text-center text-sm text-muted-foreground py-4">কোনো তথ্য পাওয়া যায়নি।</p>
                                    ) : null}
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
                        className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors text-primary-foreground/70 hover:text-white"
                    >
                        <item.icon className="h-5 w-5" />
                        <span className="text-[10px] font-bold uppercase">{item.label}</span>
                    </button>
                )
            }

            return (
              <Link key={item.href || index} href={item.href!} className="flex-1">
                <div className={cn(
                  "flex flex-col items-center justify-center gap-1 transition-colors py-1",
                  isActive ? "text-white" : "text-primary-foreground/70 hover:text-white"
                )}>
                  <item.icon className={cn("h-5 w-5", isActive && "scale-110")} />
                  <span className="text-[10px] font-bold uppercase">
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
