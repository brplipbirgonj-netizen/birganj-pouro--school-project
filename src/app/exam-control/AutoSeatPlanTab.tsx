'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { Student, studentFromDoc } from '@/lib/student-data';
import { getExams, Exam } from '@/lib/exam-data';
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { 
    Grid3X3, Plus, Trash2, Printer, Save, Loader2, Sparkles, 
    Users, UserCheck, ShieldCheck, CheckCircle2, AlertCircle, 
    Layers, LayoutGrid, FileText, Tag, RefreshCw, Eye
} from 'lucide-react';

const classNamesMap: Record<string, string> = { 
    '6': '৬ষ্ঠ', 
    '7': '৭ম', 
    '8': '৮ম', 
    '9': '৯ম', 
    '10': '১০ম' 
};

function toBengaliNumber(str: string | number | undefined | null) {
    if (str === undefined || str === null || str === '') return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
}

const getExamSlug = (name: string) => {
    return (name || '').trim().replace(/[^a-zA-Z0-9\u0980-\u09FF]+/g, '_');
};

export interface RoomSetup {
    id: string;
    roomName: string;
    benchCount: number;
    seatsPerBench: number;
}

export interface SeatStudent {
    id: string;
    roll: number;
    className: string;
    name: string;
    gender: 'male' | 'female' | 'other';
}

export interface SeatSlot {
    seatNo: number;
    student?: SeatStudent;
}

export interface BenchSlot {
    benchNumber: number;
    seats: SeatSlot[];
}

export interface RoomSeating {
    roomId: string;
    roomName: string;
    benches: BenchSlot[];
    classSummaries: {
        className: string;
        minRoll: number;
        maxRoll: number;
        count: number;
        rollsStr: string;
    }[];
    totalStudents: number;
    capacity: number;
}

type GenderPattern = 'normal' | 'opposite_sides' | 'sandwich_girl_middle' | 'sandwich_boy_middle';
type ClassPattern = 'cross_class' | 'same_class';

export function AutoSeatPlanTab({ academicYear }: { academicYear: string }) {
    const db = useFirestore();
    const { schoolInfo } = useSchoolInfo();
    const { toast } = useToast();

    // Exam Selection
    const defaultExams = ['অর্ধ-বার্ষিক পরীক্ষা', 'বার্ষিক পরীক্ষা', 'প্রাক-নির্বাচনী পরীক্ষা', 'নির্বাচনী পরীক্ষা'];
    const [examsList, setExamsList] = useState<string[]>(defaultExams);
    const [selectedExam, setSelectedExam] = useState<string>('অর্ধ-বার্ষিক পরীক্ষা');

    // Participating Classes
    const [selectedClasses, setSelectedClasses] = useState<string[]>(['6', '7', '8', '9', '10']);

    // Room Configurations
    const [rooms, setRooms] = useState<RoomSetup[]>([
        { id: 'r-1', roomName: 'কক্ষ নং ১০১', benchCount: 15, seatsPerBench: 2 },
        { id: 'r-2', roomName: 'কক্ষ নং ১০২', benchCount: 15, seatsPerBench: 2 },
        { id: 'r-3', roomName: 'কক্ষ নং ১০৩', benchCount: 15, seatsPerBench: 2 },
    ]);

    // Seating Pattern
    const [genderPattern, setGenderPattern] = useState<GenderPattern>('opposite_sides');
    const [classPattern, setClassPattern] = useState<ClassPattern>('cross_class');

    // State for students, loading, and result
    const [studentsByClass, setStudentsByClass] = useState<Record<string, Student[]>>({});
    const [isFetchingStudents, setIsFetchingStudents] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [generatedRooms, setGeneratedRooms] = useState<RoomSeating[]>([]);
    const [activePrintTab, setActivePrintTab] = useState<'preview' | 'door_notice' | 'desk_slips' | 'master_chart'>('preview');

    // Load available exams
    useEffect(() => {
        if (!db || !academicYear) return;
        getExams(db, academicYear).then(exams => {
            if (exams && exams.length > 0) {
                const names = exams.map(e => (typeof e?.name === 'string' ? e.name.trim() : '')).filter(Boolean);
                setExamsList(prev => Array.from(new Set([...prev.map(p => p.trim()), ...names])));
            }
        }).catch(() => {});
    }, [db, academicYear]);

    // Fetch students for all selected classes
    const loadStudents = async () => {
        if (!db || !academicYear) return;
        setIsFetchingStudents(true);
        try {
            const data: Record<string, Student[]> = {};
            for (const cName of ['6', '7', '8', '9', '10']) {
                const q = query(
                    collection(db, 'students'),
                    where('academicYear', '==', academicYear),
                    where('className', '==', cName)
                );
                const snap = await getDocs(q);
                const list = snap.docs.map(doc => studentFromDoc(doc));
                list.sort((a, b) => (a.roll || 0) - (b.roll || 0));
                data[cName] = list;
            }
            setStudentsByClass(data);
        } catch (e) {
            console.error('Error fetching students for seat plan:', e);
            toast({ variant: 'destructive', title: 'শিক্ষার্থী তথ্য লোড করা যায়নি' });
        } finally {
            setIsFetchingStudents(false);
        }
    };

    useEffect(() => {
        loadStudents();
    }, [db, academicYear]);

    // Load saved seat plan from Firebase if available
    useEffect(() => {
        if (!db || !academicYear || !selectedExam) return;
        const examSlug = getExamSlug(selectedExam);
        const docRef = doc(db, 'seatPlans', `plan_${academicYear}_${examSlug}`);
        getDoc(docRef).then(snap => {
            if (snap.exists()) {
                const data = snap.data();
                if (Array.isArray(data.rooms)) {
                    setGeneratedRooms(data.rooms);
                }
                if (data.roomsSetup) setRooms(data.roomsSetup);
                if (data.genderPattern) setGenderPattern(data.genderPattern);
                if (data.classPattern) setClassPattern(data.classPattern);
                if (Array.isArray(data.selectedClasses)) setSelectedClasses(data.selectedClasses);
            }
        }).catch(err => console.error('Error loading saved seat plan:', err));
    }, [db, academicYear, selectedExam]);

    // Calculate totals
    const totalSelectedStudents = useMemo(() => {
        return selectedClasses.reduce((acc, cName) => {
            return acc + (studentsByClass[cName]?.length || 0);
        }, 0);
    }, [selectedClasses, studentsByClass]);

    const totalCapacity = useMemo(() => {
        return rooms.reduce((acc, r) => acc + (r.benchCount * r.seatsPerBench), 0);
    }, [rooms]);

    const totalBenches = useMemo(() => {
        return rooms.reduce((acc, r) => acc + r.benchCount, 0);
    }, [rooms]);

    // Class selection toggle
    const toggleClass = (cName: string) => {
        setSelectedClasses(prev => 
            prev.includes(cName) ? prev.filter(c => c !== cName) : [...prev, cName].sort()
        );
    };

    // Room setup handlers
    const handleAddRoom = () => {
        const nextNum = rooms.length + 101;
        setRooms(prev => [
            ...prev,
            { id: `r-${Date.now()}`, roomName: `কক্ষ নং ${nextNum}`, benchCount: 15, seatsPerBench: 2 }
        ]);
    };

    const handleRemoveRoom = (id: string) => {
        if (rooms.length <= 1) return;
        setRooms(prev => prev.filter(r => r.id !== id));
    };

    const updateRoom = (id: string, field: keyof RoomSetup, val: any) => {
        setRooms(prev => prev.map(r => r.id === id ? { ...r, [field]: val } : r));
    };

    // ==========================================
    // SEATING GENERATION ALGORITHM
    // ==========================================
    const handleGenerate = () => {
        if (selectedClasses.length === 0) {
            toast({ variant: 'destructive', title: 'কোনো শ্রেণি নির্বাচন করা হয়নি' });
            return;
        }

        if (totalSelectedStudents === 0) {
            toast({ variant: 'destructive', title: 'নির্বাচিত শ্রেণিসমূহে কোনো শিক্ষার্থী পাওয়া যায়নি' });
            return;
        }

        if (totalCapacity < totalSelectedStudents) {
            toast({ 
                variant: 'destructive', 
                title: 'আসন সংখ্যা অপ্রতুল!', 
                description: `মোট শিক্ষার্থী ${totalSelectedStudents} জন, কিন্তু রুমসমূহের মোট আসন ক্ষমতা ${totalCapacity} টি। অনুগ্রহ করে আরও রুম বা বেঞ্চ যোগ করুন।` 
            });
            return;
        }

        setIsGenerating(true);

        try {
            // 1. Prepare structured queues for each class
            // Split by gender: male and female
            const classQueues: Record<string, {
                male: SeatStudent[];
                female: SeatStudent[];
                all: SeatStudent[];
            }> = {};

            selectedClasses.forEach(cName => {
                const list = studentsByClass[cName] || [];
                const mapped: SeatStudent[] = list.map(s => ({
                    id: s.id,
                    roll: s.roll || 0,
                    className: s.className,
                    name: s.studentNameBn || s.studentNameEn || '',
                    gender: (s.gender === 'female' ? 'female' : 'male')
                }));

                classQueues[cName] = {
                    male: mapped.filter(s => s.gender === 'male'),
                    female: mapped.filter(s => s.gender === 'female'),
                    all: [...mapped]
                };
            });

            // Class pairing strategy for Cross-Class (Anti-cheating)
            // e.g. 10 + 6, 9 + 7, 8...
            const pairedClasses: [string, string | null][] = [];
            const sortedClasses = [...selectedClasses].sort((a, b) => parseInt(b) - parseInt(a)); // e.g. 10, 9, 8, 7, 6
            let leftIdx = 0;
            let rightIdx = sortedClasses.length - 1;
            while (leftIdx <= rightIdx) {
                if (leftIdx === rightIdx) {
                    pairedClasses.push([sortedClasses[leftIdx], null]);
                } else {
                    pairedClasses.push([sortedClasses[leftIdx], sortedClasses[rightIdx]]);
                }
                leftIdx++;
                rightIdx--;
            }

            // Function to pull a student from class queue
            const pullStudent = (cName: string, preferGender?: 'male' | 'female'): SeatStudent | undefined => {
                const q = classQueues[cName];
                if (!q) return undefined;

                if (preferGender === 'male' && q.male.length > 0) {
                    const st = q.male.shift()!;
                    // remove from all
                    const aIdx = q.all.findIndex(s => s.id === st.id);
                    if (aIdx !== -1) q.all.splice(aIdx, 1);
                    return st;
                }
                if (preferGender === 'female' && q.female.length > 0) {
                    const st = q.female.shift()!;
                    const aIdx = q.all.findIndex(s => s.id === st.id);
                    if (aIdx !== -1) q.all.splice(aIdx, 1);
                    return st;
                }

                // If preferred gender not available, take any from this class
                if (q.all.length > 0) {
                    const st = q.all.shift()!;
                    if (st.gender === 'male') {
                        const mIdx = q.male.findIndex(s => s.id === st.id);
                        if (mIdx !== -1) q.male.splice(mIdx, 1);
                    } else {
                        const fIdx = q.female.findIndex(s => s.id === st.id);
                        if (fIdx !== -1) q.female.splice(fIdx, 1);
                    }
                    return st;
                }

                return undefined;
            };

            // Global fallback: pull from ANY available class
            const pullAnyRemaining = (preferGender?: 'male' | 'female'): SeatStudent | undefined => {
                for (const cName of selectedClasses) {
                    const st = pullStudent(cName, preferGender);
                    if (st) return st;
                }
                // If preferGender failed, try again without gender preference
                if (preferGender) {
                    for (const cName of selectedClasses) {
                        const st = pullStudent(cName, undefined);
                        if (st) return st;
                    }
                }
                return undefined;
            };

            // 2. Allocate into each room and bench
            const newRoomPlans: RoomSeating[] = [];
            let currentPairIdx = 0;

            for (const rSetup of rooms) {
                const roomBenches: BenchSlot[] = [];
                const roomStudents: SeatStudent[] = [];

                for (let b = 1; b <= rSetup.benchCount; b++) {
                    const benchSeats: SeatSlot[] = [];
                    const spb = rSetup.seatsPerBench;

                    // Choose classes for this bench
                    let classA = selectedClasses[0];
                    let classB = selectedClasses[1] || selectedClasses[0];

                    if (classPattern === 'cross_class' && pairedClasses.length > 0) {
                        const pair = pairedClasses[currentPairIdx % pairedClasses.length];
                        classA = pair[0];
                        classB = pair[1] || pair[0];
                    }

                    // Fill seats on this bench
                    for (let sPos = 0; sPos < spb; sPos++) {
                        let targetClass = (sPos % 2 === 0) ? classA : classB;
                        let preferredGender: 'male' | 'female' | undefined = undefined;

                        if (genderPattern === 'opposite_sides') {
                            // Left side: Male, Right side: Female (or alternate)
                            preferredGender = (sPos === 0) ? 'male' : 'female';
                        } else if (genderPattern === 'sandwich_boy_middle') {
                            // 3-seat bench: Girl - Boy - Girl
                            preferredGender = (sPos === 1) ? 'male' : 'female';
                        } else if (genderPattern === 'sandwich_girl_middle') {
                            // 3-seat bench: Boy - Girl - Boy
                            preferredGender = (sPos === 1) ? 'female' : 'male';
                        }

                        // Try target class first
                        let st = pullStudent(targetClass, preferredGender);
                        // If target class empty, try the other paired class
                        if (!st) {
                            const altClass = (targetClass === classA) ? classB : classA;
                            st = pullStudent(altClass, preferredGender);
                        }
                        // If still empty, pull any remaining student
                        if (!st) {
                            st = pullAnyRemaining(preferredGender);
                        }

                        if (st) {
                            benchSeats.push({ seatNo: sPos + 1, student: st });
                            roomStudents.push(st);
                        } else {
                            benchSeats.push({ seatNo: sPos + 1, student: undefined });
                        }
                    }

                    roomBenches.push({
                        benchNumber: b,
                        seats: benchSeats
                    });

                    // Cycle class pairs smoothly every few benches
                    if (b % 2 === 0) {
                        currentPairIdx++;
                    }
                }

                // Calculate room summaries
                const classMap: Record<string, number[]> = {};
                roomStudents.forEach(st => {
                    if (!classMap[st.className]) classMap[st.className] = [];
                    classMap[st.className].push(st.roll);
                });

                const summaries = Object.keys(classMap).sort((a,b) => parseInt(a) - parseInt(b)).map(cName => {
                    const rolls = classMap[cName].sort((a,b) => a - b);
                    const minRoll = rolls[0] || 0;
                    const maxRoll = rolls[rolls.length - 1] || 0;
                    return {
                        className: cName,
                        minRoll,
                        maxRoll,
                        count: rolls.length,
                        rollsStr: `${toBengaliNumber(minRoll)} - ${toBengaliNumber(maxRoll)}`
                    };
                });

                newRoomPlans.push({
                    roomId: rSetup.id,
                    roomName: rSetup.roomName,
                    benches: roomBenches,
                    classSummaries: summaries,
                    totalStudents: roomStudents.length,
                    capacity: rSetup.benchCount * rSetup.seatsPerBench
                });
            }

            setGeneratedRooms(newRoomPlans);
            toast({
                title: 'স্মার্ট সিট প্ল্যান সফলভাবে তৈরি হয়েছে!',
                description: `মোট ${totalSelectedStudents} জন শিক্ষার্থীর জন্য ${rooms.length}টি কক্ষে স্বয়ংক্রিয় আসন বিন্যাস সম্পন্ন হয়েছে।`
            });

        } catch (err: any) {
            console.error('Error in seat plan generation:', err);
            toast({ variant: 'destructive', title: 'সিট প্ল্যান তৈরিতে সমস্যা হয়েছে', description: err?.message });
        } finally {
            setIsGenerating(false);
        }
    };

    // Save to Firebase
    const handleSavePlan = async () => {
        if (!db || generatedRooms.length === 0) return;
        setIsSaving(true);
        try {
            const cleanExam = selectedExam.trim();
            const examSlug = getExamSlug(cleanExam);
            const docRef = doc(db, 'seatPlans', `plan_${academicYear}_${examSlug}`);

            await setDoc(docRef, {
                academicYear,
                examName: cleanExam,
                roomsSetup: rooms,
                genderPattern,
                classPattern,
                selectedClasses,
                rooms: generatedRooms,
                updatedAt: serverTimestamp()
            }, { merge: true });

            toast({ title: `'${cleanExam}' এর সিট প্ল্যান সার্ভারে সংরক্ষণ করা হয়েছে।` });
        } catch (e: any) {
            console.error('Error saving seat plan:', e);
            toast({ variant: 'destructive', title: 'সংরক্ষণ ব্যর্থ হয়েছে', description: e.message });
        } finally {
            setIsSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-8 font-kalpurush">

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    @page { size: A4 portrait; margin: 8mm 6mm !important; }
                    html, body { background: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .page-break { page-break-after: always !important; }
                    .seat-sticker-grid {
                        display: grid !important;
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 8px !important;
                    }
                    .door-notice-box {
                        border: 2px solid black !important;
                        padding: 12px !important;
                        margin-bottom: 20px !important;
                        page-break-inside: avoid !important;
                    }
                }
            `}</style>

            {/* Control & Configuration Card */}
            <Card className="border-2 shadow-xl rounded-3xl overflow-hidden bg-white no-print">
                <CardHeader className="bg-gradient-to-r from-violet-50 to-indigo-50 border-b-2 border-violet-100 p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-2xl font-black text-slate-800 flex items-center gap-2">
                                <Sparkles className="h-6 w-6 text-violet-600" /> স্মার্ট অটো সিট প্ল্যান (Automatic Exam Seating)
                            </CardTitle>
                            <CardDescription className="font-bold text-slate-600 mt-1">
                                শিক্ষাবর্ষ: {toBengaliNumber(academicYear)} | নকল প্রতিরোধক ক্রস-ক্লাস ও জেন্ডারভিত্তিক স্বয়ংক্রিয় আসন বিন্যাস
                            </CardDescription>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {generatedRooms.length > 0 && (
                                <>
                                    <Button onClick={handlePrint} variant="outline" className="font-black h-11 border-2 border-primary text-primary hover:bg-primary/5 shadow-sm">
                                        <Printer className="mr-2 h-4 w-4" /> প্রিন্ট করুন
                                    </Button>
                                    <Button onClick={handleSavePlan} disabled={isSaving} className="font-black h-11 px-6 shadow-md bg-emerald-600 hover:bg-emerald-700 text-white">
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        সিট প্ল্যান সেভ করুন
                                    </Button>
                                </>
                            )}
                            <Button 
                                onClick={handleGenerate} 
                                disabled={isGenerating || isFetchingStudents}
                                className="font-black h-11 px-7 shadow-xl bg-violet-600 hover:bg-violet-700 text-white text-base"
                            >
                                {isGenerating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                                অটো সিট তৈরি করুন
                            </Button>
                        </div>
                    </div>

                    {/* Stats Overview */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-violet-200/60">
                        <div className="p-3 bg-white rounded-xl border border-violet-200 shadow-xs">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">নির্বাচিত পরীক্ষার্থী</span>
                            <p className="text-xl font-black text-violet-700">{toBengaliNumber(totalSelectedStudents)} জন</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-violet-200 shadow-xs">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">মোট পরীক্ষার কক্ষ</span>
                            <p className="text-xl font-black text-slate-800">{toBengaliNumber(rooms.length)} টি</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-violet-200 shadow-xs">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">মোট বেঞ্চ সংখ্যা</span>
                            <p className="text-xl font-black text-slate-800">{toBengaliNumber(totalBenches)} টি</p>
                        </div>
                        <div className="p-3 bg-white rounded-xl border border-violet-200 shadow-xs">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">আসন ক্ষমতা / অবস্থান</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xl font-black text-slate-800">{toBengaliNumber(totalCapacity)} সিট</span>
                                {totalCapacity >= totalSelectedStudents ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">পর্যাপ্ত ✓</Badge>
                                ) : (
                                    <Badge className="bg-rose-100 text-rose-800 text-[10px] font-bold">ঘাটতি {toBengaliNumber(totalSelectedStudents - totalCapacity)}</Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">

                    {/* 1. Exam & Participating Classes */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <div className="space-y-2">
                            <Label className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                                <FileText className="h-4 w-4 text-primary" /> ১. পরীক্ষার নাম নির্বাচন
                            </Label>
                            <Select value={selectedExam} onValueChange={setSelectedExam}>
                                <SelectTrigger className="bg-white border-2 font-bold h-11"><SelectValue placeholder="পরীক্ষা বাছুন" /></SelectTrigger>
                                <SelectContent className="font-kalpurush">
                                    {examsList.map((exam, idx) => (
                                        <SelectItem key={`ex-${idx}`} value={exam} className="font-bold">{exam}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2 md:col-span-2">
                            <Label className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                                <Users className="h-4 w-4 text-primary" /> ২. অংশগ্রহণকারী শ্রেণি নির্বাচন করুন
                            </Label>
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                {['6', '7', '8', '9', '10'].map(cName => {
                                    const isSelected = selectedClasses.includes(cName);
                                    const count = studentsByClass[cName]?.length || 0;
                                    return (
                                        <button
                                            key={cName}
                                            type="button"
                                            onClick={() => toggleClass(cName)}
                                            className={cn(
                                                "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 border-2",
                                                isSelected 
                                                    ? "bg-primary text-white border-primary shadow-sm" 
                                                    : "bg-white text-slate-700 border-slate-300 hover:border-primary/50"
                                            )}
                                        >
                                            <span className={cn("w-2 h-2 rounded-full", isSelected ? "bg-white" : "bg-slate-300")} />
                                            {classNamesMap[cName]} শ্রেণি ({toBengaliNumber(count)} জন)
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* 2. Room Setup */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="font-black text-base text-slate-800 flex items-center gap-2">
                                <LayoutGrid className="h-5 w-5 text-violet-600" /> ৩. কক্ষ ও বেঞ্চ ব্যবস্থাপনা (কয়টি রুম ও কতটি বেঞ্চ)
                            </Label>
                            <Button 
                                type="button" 
                                size="sm" 
                                variant="outline" 
                                onClick={handleAddRoom}
                                className="font-black border-2 border-primary text-primary hover:bg-primary/5 h-9"
                            >
                                <Plus className="h-4 w-4 mr-1" /> + নতুন কক্ষ যোগ করুন
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {rooms.map((room, idx) => (
                                <div key={room.id} className="p-4 bg-slate-50/70 border-2 border-slate-200 rounded-2xl space-y-3 relative group hover:border-violet-300 transition-colors">
                                    <div className="flex items-center justify-between gap-2">
                                        <Input
                                            value={room.roomName}
                                            onChange={e => updateRoom(room.id, 'roomName', e.target.value)}
                                            className="font-black text-sm h-9 bg-white border border-slate-300 w-36"
                                            placeholder="কক্ষের নাম"
                                        />
                                        {rooms.length > 1 && (
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                                                onClick={() => handleRemoveRoom(room.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-bold text-slate-600">বেঞ্চ সংখ্যা</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                max="100"
                                                value={room.benchCount}
                                                onChange={e => updateRoom(room.id, 'benchCount', Math.max(1, parseInt(e.target.value) || 1))}
                                                className="h-8 font-black text-center bg-white"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[11px] font-bold text-slate-600">বেঞ্চে আসন</Label>
                                            <Select 
                                                value={String(room.seatsPerBench)} 
                                                onValueChange={v => updateRoom(room.id, 'seatsPerBench', parseInt(v))}
                                            >
                                                <SelectTrigger className="h-8 bg-white font-bold text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent className="font-kalpurush">
                                                    <SelectItem value="2" className="font-bold">২ জন (ডানে/বামে)</SelectItem>
                                                    <SelectItem value="3" className="font-bold">৩ জন (স্যান্ডউইচ)</SelectItem>
                                                    <SelectItem value="4" className="font-bold">৪ জন (বড় বেঞ্চ)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-slate-200/80 flex justify-between items-center text-[11px] font-bold text-slate-500">
                                        <span>কক্ষের মোট আসন:</span>
                                        <span className="text-violet-700 font-black">{toBengaliNumber(room.benchCount * room.seatsPerBench)} টি</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* 3. Seating Pattern Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-violet-50/50 rounded-2xl border-2 border-violet-100">
                        {/* Gender arrangement */}
                        <div className="space-y-2">
                            <Label className="font-black text-sm text-violet-950 flex items-center gap-1.5">
                                <Users className="h-4 w-4 text-violet-600" /> ৪. ছাত্র-ছাত্রী বসার পদ্ধতি
                            </Label>
                            <Select value={genderPattern} onValueChange={(v: GenderPattern) => setGenderPattern(v)}>
                                <SelectTrigger className="bg-white border-2 border-violet-200 font-bold h-11 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="font-kalpurush text-xs">
                                    <SelectItem value="opposite_sides" className="font-bold">
                                        👫 এক বেঞ্চে একদিকে ছাত্র, একদিকে ছাত্রী (বিপরীত পাশে)
                                    </SelectItem>
                                    <SelectItem value="sandwich_girl_middle" className="font-bold">
                                        🥪 ৩ জনের বেঞ্চ: দুই পাশে ছাত্র, মাঝখানে ছাত্রী (Boy - Girl - Boy)
                                    </SelectItem>
                                    <SelectItem value="sandwich_boy_middle" className="font-bold">
                                        🥪 ৩ জনের বেঞ্চ: দুই পাশে ছাত্রী, মাঝখানে ছাত্র (Girl - Boy - Girl)
                                    </SelectItem>
                                    <SelectItem value="normal" className="font-bold">
                                        📋 সাধারণ / স্বাভাবিক ক্রমবিন্যাস
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] font-semibold text-slate-500">
                                * এক বেঞ্চে ছাত্র এবং ছাত্রী ভারসাম্যপূর্ণভাবে সুনির্দিষ্ট ক্রমে বসবে।
                            </p>
                        </div>

                        {/* Class mixing pattern */}
                        <div className="space-y-2">
                            <Label className="font-black text-sm text-violet-950 flex items-center gap-1.5">
                                <ShieldCheck className="h-4 w-4 text-emerald-600" /> ৫. নকল প্রতিরোধে শ্রেণি বিন্যাস
                            </Label>
                            <Select value={classPattern} onValueChange={(v: ClassPattern) => setClassPattern(v)}>
                                <SelectTrigger className="bg-white border-2 border-violet-200 font-bold h-11 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="font-kalpurush text-xs">
                                    <SelectItem value="cross_class" className="font-bold">
                                        🛡️ অল্টারনেট শ্রেণি (একই বেঞ্চে পাশাপাশি ভিন্ন শ্রেণি - যেমন: ১০ম + ৬ষ্ঠ)
                                    </SelectItem>
                                    <SelectItem value="same_class" className="font-bold">
                                        📚 সাধারণ শ্রেণিভিত্তিক বিন্যাস
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[11px] font-semibold text-slate-500">
                                * ক্রস-ক্লাস মোডে পাশাপাশি একই শ্রেণির শিক্ষার্থী না বসে অন্য শ্রেণির শিক্ষার্থী বসবে।
                            </p>
                        </div>
                    </div>

                </CardContent>
            </Card>

            {/* Generated Results & Preview Section */}
            {generatedRooms.length > 0 && (
                <div className="space-y-6">

                    {/* View Switcher Tabs (no-print) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border-2 border-slate-200 shadow-sm no-print">
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant={activePrintTab === 'preview' ? 'default' : 'outline'}
                                onClick={() => setActivePrintTab('preview')}
                                className="font-black text-xs h-9"
                            >
                                <Eye className="h-4 w-4 mr-1.5" /> রুমভিত্তিক গ্রিড ভিউ
                            </Button>
                            <Button
                                size="sm"
                                variant={activePrintTab === 'door_notice' ? 'default' : 'outline'}
                                onClick={() => setActivePrintTab('door_notice')}
                                className="font-black text-xs h-9"
                            >
                                <FileText className="h-4 w-4 mr-1.5" /> দরজার নোটিশ শিট (প্রিন্ট)
                            </Button>
                            <Button
                                size="sm"
                                variant={activePrintTab === 'desk_slips' ? 'default' : 'outline'}
                                onClick={() => setActivePrintTab('desk_slips')}
                                className="font-black text-xs h-9"
                            >
                                <Tag className="h-4 w-4 mr-1.5" /> বেঞ্চ সিট স্টিকার (প্রিন্ট)
                            </Button>
                            <Button
                                size="sm"
                                variant={activePrintTab === 'master_chart' ? 'default' : 'outline'}
                                onClick={() => setActivePrintTab('master_chart')}
                                className="font-black text-xs h-9"
                            >
                                <LayoutGrid className="h-4 w-4 mr-1.5" /> মাস্টার চার্ট (প্রিন্ট)
                            </Button>
                        </div>

                        <Button 
                            onClick={handlePrint}
                            className="font-black text-xs bg-slate-900 text-white hover:bg-black h-9 px-4"
                        >
                            <Printer className="h-3.5 w-3.5 mr-1.5" /> এই ভিউ প্রিন্ট করুন
                        </Button>
                    </div>

                    {/* VIEW 1: Visual Interactive Room Grid (On Screen) */}
                    {activePrintTab === 'preview' && (
                        <div className="space-y-8 no-print">
                            {generatedRooms.map((room) => (
                                <Card key={room.roomId} className="border-2 rounded-3xl overflow-hidden shadow-lg bg-white">
                                    <CardHeader className="bg-slate-900 text-white p-5 flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle className="text-xl font-black text-white flex items-center gap-2">
                                                <Grid3X3 className="h-5 w-5 text-violet-400" /> {room.roomName}
                                            </CardTitle>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                {room.classSummaries.map((cs, i) => (
                                                    <Badge key={i} className="bg-white/20 text-white text-xs font-bold border-none">
                                                        {classNamesMap[cs.className]} শ্রেণি: রোল {cs.rollsStr} ({toBengaliNumber(cs.count)} জন)
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs text-white/70">মোট পরীক্ষার্থী</span>
                                            <p className="text-2xl font-black text-violet-300">{toBengaliNumber(room.totalStudents)} জন</p>
                                        </div>
                                    </CardHeader>

                                    <CardContent className="p-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {room.benches.map((bench) => (
                                                <div key={bench.benchNumber} className="border-2 border-slate-300 rounded-2xl p-3 bg-slate-50/50 shadow-xs space-y-2">
                                                    <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                                                        <span className="text-xs font-black text-slate-700 bg-white px-2 py-0.5 rounded-md border border-slate-300">
                                                            বেঞ্চ #{toBengaliNumber(bench.benchNumber)}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-500">
                                                            {bench.seats.filter(s => s.student).length} জন বসেছে
                                                        </span>
                                                    </div>

                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                                        {bench.seats.map((seat, sIdx) => {
                                                            const st = seat.student;
                                                            if (!st) {
                                                                return (
                                                                    <div key={sIdx} className="h-16 rounded-xl border border-dashed border-slate-300 bg-white/50 flex items-center justify-center text-slate-400 text-[10px] font-bold italic">
                                                                        খালি সিট
                                                                    </div>
                                                                );
                                                            }
                                                            const isMale = st.gender === 'male';
                                                            return (
                                                                <div 
                                                                    key={sIdx} 
                                                                    className={cn(
                                                                        "p-2 rounded-xl border flex flex-col justify-between shadow-xs transition-transform hover:scale-102",
                                                                        isMale 
                                                                            ? "bg-blue-50/80 border-blue-200 text-blue-950" 
                                                                            : "bg-rose-50/80 border-rose-200 text-rose-950"
                                                                    )}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-[9px] font-black uppercase tracking-wider">
                                                                            {classNamesMap[st.className]}
                                                                        </span>
                                                                        <span className="text-xs">{isMale ? '👦' : '👧'}</span>
                                                                    </div>
                                                                    <div className="text-center my-1">
                                                                        <span className="text-sm font-black bg-white/90 px-1.5 py-0.5 rounded-md border border-black/10">
                                                                            রোল: {toBengaliNumber(st.roll)}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[10px] font-bold truncate text-center" title={st.name}>
                                                                        {st.name}
                                                                    </p>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}

                    {/* VIEW 2: Door Notice Chart (Print View) */}
                    {(activePrintTab === 'door_notice' || activePrintTab === 'preview') && (
                        <div className={cn("space-y-6", activePrintTab === 'preview' ? "hidden" : "print-only block")}>
                            {generatedRooms.map((room, rIdx) => (
                                <div key={room.roomId} className="door-notice-box page-break bg-white text-black p-8 font-kalpurush border-2 border-black rounded-2xl">
                                    <header className="text-center border-b-2 border-black pb-3 mb-4">
                                        <h1 className="text-2xl font-black">{schoolInfo.name}</h1>
                                        <p className="text-xs font-bold text-slate-700">{schoolInfo.address}</p>
                                        <div className="mt-2 inline-block border-2 border-black px-6 py-1 rounded-full font-black text-base bg-slate-100 uppercase">
                                            {selectedExam} - {toBengaliNumber(academicYear)}
                                        </div>
                                        <h2 className="text-xl font-black mt-2 text-primary underline underline-offset-4">
                                            কক্ষের সিট চার্ট ও নোটিশ: {room.roomName}
                                        </h2>
                                    </header>

                                    <div className="my-4">
                                        <table className="w-full border-collapse border-2 border-black text-center">
                                            <thead>
                                                <tr className="bg-slate-100 border-b-2 border-black text-sm font-black">
                                                    <th className="border-r-2 border-black p-2.5">ক্রমিক</th>
                                                    <th className="border-r-2 border-black p-2.5">শ্রেণি</th>
                                                    <th className="border-r-2 border-black p-2.5">রোল নম্বরসমূহ</th>
                                                    <th className="p-2.5">মোট পরীক্ষার্থী</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {room.classSummaries.map((cs, cIdx) => (
                                                    <tr key={cIdx} className="border-b border-black text-sm font-bold">
                                                        <td className="border-r-2 border-black p-2 font-black">{toBengaliNumber(cIdx + 1)}</td>
                                                        <td className="border-r-2 border-black p-2 font-black">{classNamesMap[cs.className]} শ্রেণি</td>
                                                        <td className="border-r-2 border-black p-2 font-black text-base">{cs.rollsStr}</td>
                                                        <td className="p-2 font-black text-base">{toBengaliNumber(cs.count)} জন</td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-slate-100 font-black text-base border-t-2 border-black">
                                                    <td colSpan={3} className="border-r-2 border-black p-2.5 text-right pr-4">এই কক্ষের মোট পরীক্ষার্থী:</td>
                                                    <td className="p-2.5">{toBengaliNumber(room.totalStudents)} জন</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="mt-6 p-4 bg-slate-50 border border-black rounded-lg text-xs space-y-1">
                                        <p className="font-bold">⚠️ পরীক্ষার্থীদের জন্য নির্দেশনাবলী:</p>
                                        <p>১. নিজ নিজ নির্ধারিত কক্ষে বেঞ্চের স্টিকারে থাকা রোল অনুযায়ী নির্ধারিত আসনে বসতে হবে।</p>
                                        <p>২. পরীক্ষা শুরুর অন্তত ১৫ মিনিট পূর্বে কক্ষে উপস্থিত থাকতে হবে।</p>
                                    </div>

                                    <div className="flex justify-between items-end mt-16 pt-8 text-xs font-black">
                                        <div className="text-center w-40 border-t border-black pt-1">
                                            আহ্বায়ক / পরীক্ষা কমিটি
                                        </div>
                                        <div className="text-center w-40 border-t border-black pt-1">
                                            প্রধান শিক্ষক
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* VIEW 3: Desk Slips / Stickers (Print View) */}
                    {(activePrintTab === 'desk_slips') && (
                        <div className="print-only block space-y-6">
                            {generatedRooms.map((room) => {
                                // Flatten all assigned seats in room
                                const allAssigned = room.benches.flatMap(b => 
                                    b.seats.filter(s => s.student).map(s => ({
                                        benchNo: b.benchNumber,
                                        seatNo: s.seatNo,
                                        student: s.student!
                                    }))
                                );

                                // Chunk by 8 per A4 page
                                const chunkSize = 8;
                                const chunks: typeof allAssigned[] = [];
                                for (let i = 0; i < allAssigned.length; i += chunkSize) {
                                    chunks.push(allAssigned.slice(i, i + chunkSize));
                                }

                                return (
                                    <div key={room.roomId} className="space-y-4">
                                        {chunks.map((chunk, cIdx) => (
                                            <div key={cIdx} className="page-break p-4 bg-white text-black font-kalpurush">
                                                <div className="seat-sticker-grid grid grid-cols-2 gap-4">
                                                    {chunk.map((item, idx) => (
                                                        <div key={idx} className="border-2 border-dashed border-black rounded-xl p-3 bg-white space-y-1 relative">
                                                            <div className="text-center border-b border-black pb-1">
                                                                <h4 className="text-[11px] font-black leading-tight">{schoolInfo.name}</h4>
                                                                <span className="text-[9px] font-bold text-slate-700">{selectedExam} - {toBengaliNumber(academicYear)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded border border-black/20 my-1">
                                                                <span>{room.roomName}</span>
                                                                <span>বেঞ্চ #{toBengaliNumber(item.benchNo)} | সিট #{toBengaliNumber(item.seatNo)}</span>
                                                            </div>
                                                            <div className="text-center py-1">
                                                                <span className="text-xs font-black text-primary border border-primary/30 px-2 py-0.5 rounded-full inline-block">
                                                                    {classNamesMap[item.student.className]} শ্রেণি
                                                                </span>
                                                                <p className="text-xl font-black mt-1">রোল: {toBengaliNumber(item.student.roll)}</p>
                                                                <p className="text-xs font-bold truncate mt-0.5">{item.student.name}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* VIEW 4: Master Chart for Invigilators */}
                    {(activePrintTab === 'master_chart') && (
                        <div className="print-only block space-y-8">
                            {generatedRooms.map((room) => (
                                <div key={room.roomId} className="page-break bg-white text-black p-6 font-kalpurush border border-black">
                                    <header className="text-center border-b-2 border-black pb-2 mb-3">
                                        <h2 className="text-xl font-black">{schoolInfo.name}</h2>
                                        <p className="text-xs font-bold">{selectedExam} - {toBengaliNumber(academicYear)}</p>
                                        <h3 className="text-base font-black underline mt-1">কক্ষ পরিদর্শকের মাস্টার সিট প্ল্যান: {room.roomName}</h3>
                                    </header>

                                    <table className="w-full border-collapse border border-black text-center text-xs">
                                        <thead>
                                            <tr className="bg-slate-100 border-b border-black font-black">
                                                <th className="border-r border-black p-1.5 w-16">বেঞ্চ</th>
                                                <th className="border-r border-black p-1.5">আসন ১</th>
                                                <th className="border-r border-black p-1.5">আসন ২</th>
                                                {room.benches[0]?.seats.length > 2 && <th className="border-r border-black p-1.5">আসন ৩</th>}
                                                {room.benches[0]?.seats.length > 3 && <th className="p-1.5">আসন ৪</th>}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {room.benches.map((b) => (
                                                <tr key={b.benchNumber} className="border-b border-black">
                                                    <td className="border-r border-black p-1 font-black bg-slate-50">বেঞ্চ #{toBengaliNumber(b.benchNumber)}</td>
                                                    {b.seats.map((s, idx) => (
                                                        <td key={idx} className="border-r last:border-r-0 border-black p-1">
                                                            {s.student ? (
                                                                <div className="font-bold">
                                                                    <span className="font-black text-primary">[{classNamesMap[s.student.className]}]</span> রোল: {toBengaliNumber(s.student.roll)}
                                                                    <br/><span className="text-[10px] text-slate-700">{s.student.name}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 italic">খালি</span>
                                                            )}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    <div className="flex justify-between items-end mt-12 pt-4 text-xs font-black">
                                        <div>কক্ষ পরিদর্শকের স্বাক্ষর: ____________________</div>
                                        <div>প্রধান শিক্ষক: ____________________</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                </div>
            )}

        </div>
    );
}
