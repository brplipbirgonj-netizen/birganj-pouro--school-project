'use client';

import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Student } from '@/lib/student-data';
import { getAttendanceFromStorage, DailyAttendance, saveDailyAttendance, getAttendanceForClassAndDate, StudentAttendance, AttendanceStatus } from '@/lib/attendance-data';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, orderBy, FirestoreError } from 'firebase/firestore';
import { useToast } from "@/hooks/use-toast";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { isHoliday, Holiday } from '@/lib/holiday-data';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { DatePicker } from '@/components/ui/date-picker';
import { useAuth } from '@/hooks/useAuth';
import { Edit2, RotateCcw } from 'lucide-react';

// Digital Attendance sheet
const AttendanceSheet = ({ classId, students }: { classId: string, students: Student[] }) => {
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user } = useAuth();
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const dayOfWeek = today.getDay(); // 0 for Sunday, 5 for Friday, 6 for Saturday

    const [attendance, setAttendance] = useState<Map<string, AttendanceStatus>>(new Map());
    const [savedAttendance, setSavedAttendance] = useState<DailyAttendance | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [activeHoliday, setActiveHoliday] = useState<Holiday | undefined>(undefined);
    const [isEditing, setIsEditing] = useState(false);

    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday & Saturday are weekend
    const isAdmin = user?.role === 'admin';

    const now = new Date();
    const schoolStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 30, 0); // 10:30 AM
    const schoolEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 10, 0); // 4:10 PM
    const isSchoolHours = now >= schoolStart && now <= schoolEnd;

    useEffect(() => {
        if (!db || !user) return;
        
        const initialAttendance = new Map<string, AttendanceStatus>();
        students.forEach(student => {
            initialAttendance.set(student.id, 'present');
        });
        setAttendance(initialAttendance);

        const checkExistingData = async () => {
            const existingAttendance = await getAttendanceForClassAndDate(db, todayStr, classId, selectedYear);
            setSavedAttendance(existingAttendance);
            
            if (existingAttendance) {
                const savedMap = new Map<string, AttendanceStatus>();
                existingAttendance.attendance.forEach(item => {
                    savedMap.set(item.studentId, item.status);
                });
                setAttendance(savedMap);
            }

            const holidayToday = await isHoliday(db, todayStr);
            setActiveHoliday(holidayToday);
            
            setIsLoading(false);
        }

        checkExistingData();

    }, [students, todayStr, classId, selectedYear, db, user]);

    const handleStatusChange = (studentId: string, status: AttendanceStatus) => {
        setAttendance(prev => new Map(prev).set(studentId, status));
    };

    const handleSaveAttendance = () => {
        if (!db || !user) return;
        
        const rightNow = new Date();
        const schoolStartNow = new Date(rightNow.getFullYear(), rightNow.getMonth(), rightNow.getDate(), 10, 30, 0);
        const schoolEndNow = new Date(rightNow.getFullYear(), rightNow.getMonth(), rightNow.getDate(), 16, 10, 0);
        const currentIsSchoolHours = rightNow >= schoolStartNow && rightNow <= schoolEndNow;

        // Restriction check for non-admin users
        if (!isAdmin) {
            if (isWeekend) {
                toast({ variant: "destructive", title: "আজ সাপ্তাহিক ছুটি।" });
                return;
            }
            if (activeHoliday) {
                toast({ variant: "destructive", title: `আজ ${activeHoliday.description}।` });
                return;
            }
            if (!currentIsSchoolHours) {
                toast({ variant: "destructive", title: "স্কুলের সময় শেষ", description: "স্কুল চলাকালীন সময়েই কেবল হাজিরা নেওয়া যাবে।" });
                return;
            }
        }

        const attendanceData: StudentAttendance[] = Array.from(attendance.entries()).map(([studentId, status]) => ({
            studentId,
            status,
        }));

        const dailyAttendance: DailyAttendance = {
            date: todayStr,
            academicYear: selectedYear,
            className: classId,
            attendance: attendanceData,
        };

        saveDailyAttendance(db, dailyAttendance).then(() => {
            setSavedAttendance(dailyAttendance);
            setIsEditing(false);
            toast({ title: isEditing ? "হাজিরা আপডেট হয়েছে" : "হাজিরা সেভ হয়েছে" });
        }).catch(() => {
            // Error is handled by FirebaseErrorListener
        });
    };

    if (isLoading) {
        return <p className="text-center p-8">লোড হচ্ছে...</p>
    }

    if (isWeekend && !isAdmin) {
        return <p className="text-center text-muted-foreground p-8">আজ সাপ্তাহিক ছুটি, তাই হাজিরা বন্ধ আছে।</p>
    }

    if (activeHoliday && !isAdmin) {
        return <p className="text-center text-muted-foreground p-8">আজ {activeHoliday.description}, তাই হাজিরা বন্ধ আছে।</p>;
    }
    
    if (savedAttendance && !isEditing) {
        const savedMap = new Map(savedAttendance.attendance.map(item => [item.studentId, item.status]));
        const presentCount = savedAttendance.attendance.filter(a => a.status === 'present').length;
        const absentCount = savedAttendance.attendance.length - presentCount;

        return (
            <div className="p-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <div>
                        <h3 className="font-bold text-lg text-primary">আজকের হাজিরা ইতিমধ্যে নেওয়া হয়েছে</h3>
                        <div className="mt-1 flex gap-4 text-sm font-medium">
                            <p>মোট: {(presentCount + absentCount).toLocaleString('bn-BD')}</p>
                            <p className="text-green-600">উপস্থিত: {presentCount.toLocaleString('bn-BD')}</p>
                            <p className="text-red-600">অনুপস্থিত: {absentCount.toLocaleString('bn-BD')}</p>
                        </div>
                    </div>
                    {isAdmin && (
                        <Button variant="outline" onClick={() => setIsEditing(true)} className="flex items-center gap-2 border-primary text-primary hover:bg-primary/5">
                            <Edit2 className="h-4 w-4" /> হাজিরা এডিট করুন
                        </Button>
                    )}
                </div>
                 <div className="overflow-x-auto border rounded-lg shadow-sm">
                    <Table>
                        <TableHeader className="bg-muted/50">
                            <TableRow>
                                <TableHead className="w-20 text-center">রোল</TableHead>
                                <TableHead>শিক্ষার্থীর নাম</TableHead>
                                <TableHead className="text-right">অবস্থা</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {students.map(student => (
                                <TableRow key={student.id} className="hover:bg-muted/20">
                                    <TableCell className="text-center font-bold">{student.roll.toLocaleString('bn-BD')}</TableCell>
                                    <TableCell className="font-medium">{student.studentNameBn}</TableCell>
                                    <TableCell className="text-right">
                                         <span className={cn(
                                             "px-3 py-1 rounded-full text-xs font-bold",
                                             savedMap.get(student.id) === 'present' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                         )}>
                                            {savedMap.get(student.id) === 'present' ? 'উপস্থিত' : 'অনুপস্থিত'}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                 </div>
            </div>
        );
    }
    
    if (!isSchoolHours && !isAdmin) {
        return <p className="text-center text-muted-foreground p-8">স্কুল চলাকালীন সময়েই (সকাল ১০:৩০ - বিকাল ৪:১০) কেবল হাজিরা নেওয়া যাবে।</p>;
    }
    
    return (
        <div className="animate-in fade-in duration-500">
            <div className="p-4 bg-muted/30 border-b flex justify-between items-center">
                <span className="text-sm font-bold text-muted-foreground">
                    {isEditing ? 'হাজিরা সংশোধন করা হচ্ছে' : 'নতুন হাজিরা নিন'}
                </span>
                {isEditing && (
                    <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="h-8 text-xs">
                        <RotateCcw className="h-3 w-3 mr-1" /> বাতিল
                    </Button>
                )}
            </div>
            <div className="table-container">
                <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="w-20 text-center">রোল</TableHead>
                            <TableHead>নাম</TableHead>
                            <TableHead className="text-right">হাজিরা</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {students.map(student => (
                            <TableRow key={student.id} className="hover:bg-accent/5">
                                <TableCell className="text-center font-bold">{student.roll.toLocaleString('bn-BD')}</TableCell>
                                <TableCell className="font-medium">{student.studentNameBn}</TableCell>
                                <TableCell className="text-right">
                                    <RadioGroup
                                        value={attendance.get(student.id) || 'present'}
                                        onValueChange={(value) => handleStatusChange(student.id, value as AttendanceStatus)}
                                        className="flex justify-end gap-4"
                                    >
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="present" id={`present-${classId}-${student.id}`} className="text-green-600 border-green-600" />
                                            <Label htmlFor={`present-${classId}-${student.id}`} className="cursor-pointer">উপস্থিত</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="absent" id={`absent-${classId}-${student.id}`} className="text-red-600 border-red-600" />
                                            <Label htmlFor={`absent-${classId}-${student.id}`} className="cursor-pointer">অনুপস্থিত</Label>
                                        </div>
                                    </RadioGroup>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <div className="flex justify-end p-4 mt-4 border-t gap-2">
                {isEditing && <Button variant="outline" onClick={() => setIsEditing(false)}>বাতিল</Button>}
                <Button onClick={handleSaveAttendance} className="shadow-lg min-w-[120px]">
                    {isEditing ? 'পরিবর্তন সেভ করুন' : 'হাজিরা সেভ করুন'}
                </Button>
            </div>
        </div>
    );
};

const DigitalAttendanceTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { selectedYear } = useAcademicYear();
    const studentsForYear = useMemo(() => {
        return allStudents.filter(student => student.academicYear === selectedYear);
    }, [allStudents, selectedYear]);

    const classes = ['6', '7', '8', '9', '10'];
    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

    const getStudentsByClass = (className: string): Student[] => {
        return studentsForYear.filter((student) => student.className === className);
    };

    const today = new Date();
    const formattedDate = format(today, "EEEE, d MMMM yyyy", { locale: bn });

    return (
        <>
            <p className="text-sm font-bold text-muted-foreground mt-1 mb-4 flex items-center gap-2">
                আজকের তারিখ: <span className="text-primary">{formattedDate}</span>
            </p>
            <Tabs defaultValue="6">
                <TabsList className="grid w-full grid-cols-5 h-auto flex-wrap bg-muted p-1">
                    {classes.map((className) => (
                        <TabsTrigger key={className} value={className} className="py-2 text-xs sm:text-sm font-bold">
                            {classNamesMap[className]} শ্রেণি
                        </TabsTrigger>
                    ))}
                </TabsList>
                {classes.map((className) => (
                    <TabsContent key={className} value={className}>
                        <Card className="border-2 border-primary/5">
                            <CardContent className="p-0">
                                {getStudentsByClass(className).length === 0 ? (
                                    <p className="text-center text-muted-foreground py-12 italic">এই শ্রেণিতে কোনো শিক্ষার্থী নেই।</p>
                                ) : (
                                    <AttendanceSheet classId={className} students={getStudentsByClass(className)} />
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>
        </>
    );
};


// Attendance Report sheet
interface StudentReport {
    student: Student;
    presentDays: number;
    absentDays: number;
    totalDays: number;
}
const ReportSheet = ({ classId, students, startDate, endDate }: { classId: string, students: Student[], startDate?: Date, endDate?: Date }) => {
    const { selectedYear } = useAcademicYear();
    const db = useFirestore();
    const { user } = useAuth();
    const [reportData, setReportData] = useState<StudentReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !user) return;

        const fetchAttendance = async () => {
            setIsLoading(true);
            const allAttendanceFromDb = await getAttendanceFromStorage(db);
            const allAttendanceForClass = allAttendanceFromDb.filter(
                att => att.academicYear === selectedYear && att.className === classId
            );

            const allAttendance = allAttendanceForClass.filter(att => {
                 if (!startDate || !endDate) {
                    return true;
                }
                try {
                    const attDate = new Date(att.date);
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);

                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);

                    return attDate >= start && attDate <= end;
                } catch(e) {
                    return false;
                }
            });
            
            const studentReports = students.map(student => {
                let presentDays = 0;
                let absentDays = 0;

                allAttendance.forEach(dailyRecord => {
                    const studentAttendance = dailyRecord.attendance.find(a => a.studentId === student.id);
                    if (studentAttendance) {
                        if (studentAttendance.status === 'present') {
                            presentDays++;
                        } else {
                            absentDays++;
                        }
                    }
                });

                return {
                    student: student,
                    presentDays,
                    absentDays,
                    totalDays: allAttendance.length,
                };
            });

            setReportData(studentReports);
            setIsLoading(false);
        }

        fetchAttendance();

    }, [classId, students, selectedYear, db, user, startDate, endDate]);

     if (isLoading) {
        return <p className="text-center p-8">লোড হচ্ছে...</p>
    }

    if (students.length === 0) {
        return <p className="text-center text-muted-foreground p-8">এই শ্রেণিতে কোনো শিক্ষার্থী নেই।</p>
    }

    if (reportData.length === 0 || reportData[0].totalDays === 0) {
        return <p className="text-center text-muted-foreground p-8 italic">এই শ্রেণির জন্য কোনো হাজিরা রেকর্ড পাওয়া যায়নি।</p>
    }


    return (
        <div className="table-container">
            <Table>
                <TableHeader className="bg-muted/50 sticky top-0 z-10">
                    <TableRow>
                        <TableHead className="w-20 text-center">রোল</TableHead>
                        <TableHead>শিক্ষার্থীর নাম</TableHead>
                        <TableHead className="text-center">মোট কার্যদিবস</TableHead>
                        <TableHead className="text-center">উপস্থিত</TableHead>
                        <TableHead className="text-center">অনুপস্থিত</TableHead>
                        <TableHead className="text-right">উপস্থিতির হার (%)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {reportData.map(report => (
                        <TableRow key={report.student.id} className="hover:bg-accent/5">
                            <TableCell className="text-center font-bold">{report.student.roll.toLocaleString('bn-BD')}</TableCell>
                            <TableCell className="font-medium">{report.student.studentNameBn}</TableCell>
                            <TableCell className="text-center">{report.totalDays.toLocaleString('bn-BD')}</TableCell>
                            <TableCell className="text-center text-green-600 font-bold">{report.presentDays.toLocaleString('bn-BD')}</TableCell>
                            <TableCell className="text-center text-red-600 font-bold">{report.absentDays.toLocaleString('bn-BD')}</TableCell>
                            <TableCell className="text-right font-black text-primary">
                                {report.totalDays > 0 ? 
                                    ((report.presentDays / report.totalDays) * 100).toFixed(2).toLocaleString('bn-BD') + '%' 
                                    : 'N/A'
                                }
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

const AttendanceReportTab = ({ allStudents }: { allStudents: Student[] }) => {
    const { selectedYear } = useAcademicYear();
    const [startDate, setStartDate] = useState<Date | undefined>(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const [endDate, setEndDate] = useState<Date | undefined>(new Date());
    
    const studentsForYear = useMemo(() => {
        return allStudents.filter(student => student.academicYear === selectedYear);
    }, [allStudents, selectedYear]);
    const classes = ['6', '7', '8', '9', '10'];
    const classNamesMap: { [key: string]: string } = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

    const getStudentsByClass = (className: string): Student[] => {
        return studentsForYear.filter((student) => student.className === className);
    };

    return (
        <div className="mt-4 space-y-6">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border-2 border-dashed rounded-lg items-end bg-white/50">
                <div className="w-full space-y-2">
                    <Label className="font-bold text-primary">শুরুর তারিখ</Label>
                    <DatePicker value={startDate} onChange={setStartDate} placeholder="শুরুর তারিখ" />
                </div>
                <div className="w-full space-y-2">
                    <Label className="font-bold text-primary">শেষের তারিখ</Label>
                    <DatePicker value={endDate} onChange={setEndDate} placeholder="শেষের তারিখ" />
                </div>
            </div>
            <Tabs defaultValue="6">
                <TabsList className="grid w-full grid-cols-5 h-auto flex-wrap bg-muted p-1">
                    {classes.map((className) => (
                        <TabsTrigger key={className} value={className} className="py-2 text-xs sm:text-sm font-bold">
                            {classNamesMap[className]} শ্রেণি
                        </TabsTrigger>
                    ))}
                </TabsList>
                {classes.map((className) => (
                    <TabsContent key={className} value={className}>
                        <Card className="border-2 border-primary/5">
                            <CardContent className="p-0">
                                <ReportSheet classId={className} students={getStudentsByClass(className)} startDate={startDate} endDate={endDate} />
                            </CardContent>
                        </Card>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
};


// Main Page Component
export default function AttendancePage() {
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const db = useFirestore();
    const { user } = useAuth();
    const { selectedYear } = useAcademicYear();
    const { toast } = useToast();
     const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!db || !user) return;
        setIsLoading(true);
        const studentsQuery = query(collection(db, "students"), orderBy("roll"));

        const unsubscribe = onSnapshot(studentsQuery, (querySnapshot) => {
            const studentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), dob: doc.data().dob?.toDate(), })) as Student[];
            setAllStudents(studentsData);
            setIsLoading(false);
        }, (error: FirestoreError) => {
            if (error.code === 'permission-denied') return;
            const permissionError = new FirestorePermissionError({ path: 'students', operation: 'list' });
            errorEmitter.emit('permission-error', permissionError);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, user]);
    
    return (
        <div className="flex min-h-screen w-full flex-col bg-amber-50">
            <Header />
            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-80">
                <Card className="border-2 border-primary/10 shadow-xl overflow-hidden">
                    <CardHeader className="bg-white/50 border-b">
                        <CardTitle className="text-3xl font-black text-primary">হাজিরা ব্যবস্থাপনা</CardTitle>
                        {isClient && <p className="text-sm font-bold text-muted-foreground">শিক্ষাবর্ষ: {selectedYear.toLocaleString('bn-BD')}</p>}
                    </CardHeader>
                    <CardContent className="pt-6">
                        {isLoading ? (
                            <div className="space-y-4">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-64 w-full" />
                            </div>
                        ) : (
                            <Tabs defaultValue="digital-attendance">
                                <TabsList className="grid w-full grid-cols-2 h-12 mb-6">
                                    <TabsTrigger value="digital-attendance" className="font-bold text-base">ডিজিটাল হাজিরা</TabsTrigger>
                                    <TabsTrigger value="report" className="font-bold text-base">হাজিরা রিপোর্ট</TabsTrigger>
                                </TabsList>
                                <TabsContent value="digital-attendance" className="mt-4">
                                    <DigitalAttendanceTab allStudents={allStudents} />
                                </TabsContent>
                                <TabsContent value="report" className="mt-4">
                                    <AttendanceReportTab allStudents={allStudents} />
                                </TabsContent>
                            </Tabs>
                        )}
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
