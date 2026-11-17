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
    Layers, LayoutGrid, FileText, Tag, RefreshCw, Eye, UserX, Check, ChevronDown, ChevronUp, Search,
    ArrowLeftRight
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

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

export interface ColumnSetting {
    className: string; // '6' | '7' | '8' | '9' | '10' | 'auto'
    gender: 'male' | 'female' | 'any';
}

const getDefaultSideColumns = (spb: number, defaultGender: 'male' | 'female' = 'male'): ColumnSetting[] => {
    return Array.from({ length: spb }).map(() => ({
        className: 'auto',
        gender: defaultGender
    }));
};

const getDefaultSeatGenders = (spb: number): ('male' | 'female' | 'any')[] => {
    if (spb === 2) return ['male', 'female'];
    if (spb === 3) return ['male', 'female', 'male'];
    if (spb === 4) return ['male', 'female', 'male', 'female'];
    return Array(spb).fill('any');
};

function sanitizeForFirestore(val: any): any {
    if (val === undefined) return null;
    if (val === null || typeof val !== 'object') return val;
    if (Array.isArray(val)) return val.map(sanitizeForFirestore);
    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(val)) {
        const item = val[key];
        if (item !== undefined) {
            cleaned[key] = sanitizeForFirestore(item);
        } else {
            cleaned[key] = null;
        }
    }
    return cleaned;
}

export interface RoomSetup {
    id: string;
    roomName: string;
    benchCount: number;       // total = leftBenchCount + rightBenchCount
    leftBenchCount: number;   // বামের বেঞ্চ
    rightBenchCount: number;  // ডানের বেঞ্চ
    seatsPerBench: number;
    // Word Diagram layout: column configurations for right and left sides
    rightSideColumns?: ColumnSetting[];
    leftSideColumns?: ColumnSetting[];
    genderSide?: 'boys_left' | 'girls_left' | 'mixed'; // legacy
    benchSeatGenders?: ('male' | 'female' | 'any')[];  // legacy
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
    student?: SeatStudent | null;
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
        { 
            id: 'r-1', 
            roomName: 'কক্ষ নং ১০১', 
            benchCount: 20, 
            leftBenchCount: 10, 
            rightBenchCount: 10, 
            seatsPerBench: 2, 
            rightSideColumns: getDefaultSideColumns(2, 'male'),
            leftSideColumns: getDefaultSideColumns(2, 'female'),
            benchSeatGenders: ['male', 'female'] 
        },
        { 
            id: 'r-2', 
            roomName: 'কক্ষ নং ১০২', 
            benchCount: 20, 
            leftBenchCount: 10, 
            rightBenchCount: 10, 
            seatsPerBench: 2, 
            rightSideColumns: getDefaultSideColumns(2, 'male'),
            leftSideColumns: getDefaultSideColumns(2, 'female'),
            benchSeatGenders: ['male', 'female'] 
        },
        { 
            id: 'r-3', 
            roomName: 'কক্ষ নং ১০৩', 
            benchCount: 20, 
            leftBenchCount: 10, 
            rightBenchCount: 10, 
            seatsPerBench: 2, 
            rightSideColumns: getDefaultSideColumns(2, 'male'),
            leftSideColumns: getDefaultSideColumns(2, 'female'),
            benchSeatGenders: ['male', 'female'] 
        },
    ]);

    // Seating Pattern
    const [genderPattern, setGenderPattern] = useState<GenderPattern>('opposite_sides');
    const [classPattern, setClassPattern] = useState<ClassPattern>('cross_class');

    // Absent Students Filtering
    const [excludeAbsents, setExcludeAbsents] = useState<boolean>(true);
    const [absentStudentIds, setAbsentStudentIds] = useState<Set<string>>(new Set());
    const [isSyncingAbsents, setIsSyncingAbsents] = useState<boolean>(false);
    const [showAbsentManager, setShowAbsentManager] = useState<boolean>(false);
    const [absentManagerClass, setAbsentManagerClass] = useState<string>('10');
    const [absentSearchQuery, setAbsentSearchQuery] = useState<string>('');

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

    // Fetch students for all classes
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

    // Automatically sync absent students from results & attendance
    const syncAbsentsFromResults = async () => {
        if (!db || !academicYear || !selectedExam) return;
        setIsSyncingAbsents(true);
        try {
            const foundAbsentIds = new Set<string>();
            const sanitizedExam = selectedExam.replace(/[^\p{L}\p{N}]+/gu, '-');

            // 1. Scan attendance docs in results collection
            for (const cName of selectedClasses) {
                for (const grp of ['none', 'arts', 'science', 'business', 'all']) {
                    try {
                        const docId = `${academicYear}_${sanitizedExam}_${cName}_${grp}___ATTENDANCE__`;
                        const snap = await getDoc(doc(db, 'results', docId));
                        if (snap.exists()) {
                            const att = snap.data().attendance;
                            if (att) {
                                Object.entries(att).forEach(([stId, status]) => {
                                    if (status === 'absent') foundAbsentIds.add(stId);
                                });
                            }
                        }
                    } catch (e) {}
                }
            }

            // 2. Scan subject result documents for isAbsent: true
            for (const cName of selectedClasses) {
                try {
                    const q = query(
                        collection(db, 'results'),
                        where('academicYear', '==', academicYear),
                        where('examName', '==', selectedExam),
                        where('className', '==', cName)
                    );
                    const rSnap = await getDocs(q);
                    rSnap.forEach(d => {
                        const resList = d.data().results || [];
                        resList.forEach((r: any) => {
                            if (r.isAbsent || r.absent) {
                                foundAbsentIds.add(r.studentId);
                            }
                        });
                    });
                } catch (e) {}
            }

            setAbsentStudentIds(prev => new Set([...prev, ...foundAbsentIds]));

            if (foundAbsentIds.size > 0) {
                toast({
                    title: 'অনুপস্থিত শিক্ষার্থী সিন্ক হয়েছে!',
                    description: `ফলাফল সেকশন থেকে ${foundAbsentIds.size} জন অনুপস্থিত শিক্ষার্থী শনাক্ত করা হয়েছে।`
                });
            } else {
                toast({
                    title: 'ফলাফলে কোনো অনুপস্থিত মার্ক করা নেই',
                    description: 'আপনি নিচের তালিকা থেকে নিজে টিক দিয়ে যেকোনো শিক্ষার্থীকে অনুপস্থিত চিহ্নিত করতে পারেন।'
                });
            }
        } catch (err: any) {
            console.error('Error syncing absents:', err);
        } finally {
            setIsSyncingAbsents(false);
        }
    };

    // Auto-sync when exam changes
    useEffect(() => {
        if (selectedExam && academicYear) {
            syncAbsentsFromResults();
        }
    }, [selectedExam, academicYear]);

    // Load saved seat plan from Firebase if available
    useEffect(() => {
        if (!db || !academicYear || !selectedExam) return;
        const examSlug = getExamSlug(selectedExam);
        const docRef = doc(db, 'classRoutines', `seatPlan_${academicYear}_${examSlug}`);
        getDoc(docRef).then(snap => {
            if (snap.exists()) {
                const data = snap.data();
                if (Array.isArray(data.rooms)) {
                    setGeneratedRooms(data.rooms);
                }
                if (data.roomsSetup) {
                    // Migrate old room setup that may lack new fields
                    const migratedRooms: RoomSetup[] = (data.roomsSetup as any[]).map((r: any) => {
                        const spb = r.seatsPerBench || 2;
                        let genders = r.benchSeatGenders;
                        if (!Array.isArray(genders) || genders.length !== spb) {
                            if (r.genderSide === 'boys_left') {
                                genders = getDefaultSeatGenders(spb);
                            } else if (r.genderSide === 'girls_left') {
                                genders = spb === 3 ? ['female', 'male', 'female'] : ['female', 'male'];
                            } else {
                                genders = getDefaultSeatGenders(spb);
                            }
                        }
                        const rightCols = Array.isArray(r.rightSideColumns) && r.rightSideColumns.length === spb
                            ? r.rightSideColumns
                            : getDefaultSideColumns(spb, 'male');
                        const leftCols = Array.isArray(r.leftSideColumns) && r.leftSideColumns.length === spb
                            ? r.leftSideColumns
                            : getDefaultSideColumns(spb, 'female');

                        return {
                            id: r.id,
                            roomName: r.roomName,
                            benchCount: r.benchCount || 20,
                            leftBenchCount: r.leftBenchCount ?? Math.floor((r.benchCount || 20) / 2),
                            rightBenchCount: r.rightBenchCount ?? Math.ceil((r.benchCount || 20) / 2),
                            seatsPerBench: spb,
                            rightSideColumns: rightCols,
                            leftSideColumns: leftCols,
                            genderSide: r.genderSide || 'mixed',
                            benchSeatGenders: genders,
                        };
                    });
                    setRooms(migratedRooms);
                }
                if (data.genderPattern) setGenderPattern(data.genderPattern);
                if (data.classPattern) setClassPattern(data.classPattern);
                if (Array.isArray(data.selectedClasses)) setSelectedClasses(data.selectedClasses);
                if (Array.isArray(data.absentStudentIds)) setAbsentStudentIds(new Set(data.absentStudentIds));
                if (data.excludeAbsents !== undefined) setExcludeAbsents(data.excludeAbsents);
            }
        }).catch(err => console.error('Error loading saved seat plan:', err));
    }, [db, academicYear, selectedExam]);

    // Calculate totals considering absent filter
    const totalSelectedStudents = useMemo(() => {
        return selectedClasses.reduce((acc, cName) => {
            const list = studentsByClass[cName] || [];
            return acc + list.length;
        }, 0);
    }, [selectedClasses, studentsByClass]);

    const activeExamineesCount = useMemo(() => {
        return selectedClasses.reduce((acc, cName) => {
            const list = studentsByClass[cName] || [];
            if (!excludeAbsents) return acc + list.length;
            const activeList = list.filter(s => !absentStudentIds.has(s.id));
            return acc + activeList.length;
        }, 0);
    }, [selectedClasses, studentsByClass, excludeAbsents, absentStudentIds]);

    const absentInSelectedClasses = useMemo(() => {
        let count = 0;
        selectedClasses.forEach(cName => {
            const list = studentsByClass[cName] || [];
            list.forEach(s => {
                if (absentStudentIds.has(s.id)) count++;
            });
        });
        return count;
    }, [selectedClasses, studentsByClass, absentStudentIds]);

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

    // Toggle single student absent status
    const toggleStudentAbsent = (studentId: string) => {
        setAbsentStudentIds(prev => {
            const next = new Set(prev);
            if (next.has(studentId)) {
                next.delete(studentId);
            } else {
                next.add(studentId);
            }
            return next;
        });
    };

    // Room setup handlers
    const handleAddRoom = () => {
        const nextNum = rooms.length + 101;
        setRooms(prev => [
            ...prev,
            { 
                id: `r-${Date.now()}`, 
                roomName: `কক্ষ নং ${nextNum}`, 
                benchCount: 20, 
                leftBenchCount: 10, 
                rightBenchCount: 10, 
                seatsPerBench: 2, 
                rightSideColumns: getDefaultSideColumns(2, 'male'),
                leftSideColumns: getDefaultSideColumns(2, 'female'),
                benchSeatGenders: ['male', 'female'] 
            }
        ]);
    };

    const handleRemoveRoom = (id: string) => {
        if (rooms.length <= 1) return;
        setRooms(prev => prev.filter(r => r.id !== id));
    };

    const updateRoom = (id: string, field: keyof RoomSetup, val: any) => {
        setRooms(prev => prev.map(r => {
            if (r.id !== id) return r;
            const updated = { ...r, [field]: val };
            // Auto-update benchCount when left or right changes
            if (field === 'leftBenchCount') {
                const left = Math.max(0, parseInt(String(val)) || 0);
                updated.leftBenchCount = left;
                updated.benchCount = left + updated.rightBenchCount;
            } else if (field === 'rightBenchCount') {
                const right = Math.max(0, parseInt(String(val)) || 0);
                updated.rightBenchCount = right;
                updated.benchCount = updated.leftBenchCount + right;
            } else if (field === 'seatsPerBench') {
                const spb = parseInt(String(val)) || 2;
                updated.seatsPerBench = spb;
                
                // Adjust rightSideColumns length
                const curRight = r.rightSideColumns || getDefaultSideColumns(r.seatsPerBench, 'male');
                const nextRight: ColumnSetting[] = [];
                for (let i = 0; i < spb; i++) {
                    nextRight.push(curRight[i] || { className: 'auto', gender: 'male' });
                }
                updated.rightSideColumns = nextRight;

                // Adjust leftSideColumns length
                const curLeft = r.leftSideColumns || getDefaultSideColumns(r.seatsPerBench, 'female');
                const nextLeft: ColumnSetting[] = [];
                for (let i = 0; i < spb; i++) {
                    nextLeft.push(curLeft[i] || { className: 'auto', gender: 'female' });
                }
                updated.leftSideColumns = nextLeft;

                const prevGenders = r.benchSeatGenders || getDefaultSeatGenders(r.seatsPerBench);
                const nextGenders: ('male' | 'female' | 'any')[] = [];
                for (let i = 0; i < spb; i++) {
                    if (i < prevGenders.length) {
                        nextGenders.push(prevGenders[i]);
                    } else {
                        nextGenders.push(i % 2 === 0 ? 'male' : 'female');
                    }
                }
                updated.benchSeatGenders = nextGenders;
            }
            return updated;
        }));
    };

    const updateSideColumn = (
        roomId: string, 
        side: 'right' | 'left', 
        colIdx: number, 
        field: 'className' | 'gender', 
        value: string
    ) => {
        setRooms(prev => prev.map(r => {
            if (r.id !== roomId) return r;
            const key = side === 'right' ? 'rightSideColumns' : 'leftSideColumns';
            const defaultGender = side === 'right' ? 'male' : 'female';
            const current = [...(r[key] || getDefaultSideColumns(r.seatsPerBench, defaultGender))];
            current[colIdx] = {
                ...current[colIdx],
                [field]: value
            };
            return {
                ...r,
                [key]: current
            };
        }));
    };

    const updateSeatGender = (roomId: string, seatIdx: number, gender: 'male' | 'female' | 'any') => {
        setRooms(prev => prev.map(r => {
            if (r.id !== roomId) return r;
            const current = [...(r.benchSeatGenders || getDefaultSeatGenders(r.seatsPerBench))];
            current[seatIdx] = gender;
            return {
                ...r,
                benchSeatGenders: current,
            };
        }));
    };

    // ==========================================
    // SEATING GENERATION ALGORITHM
    // ==========================================
    const handleGenerate = () => {
        if (selectedClasses.length === 0) {
            toast({ variant: 'destructive', title: 'কোনো শ্রেণি নির্বাচন করা হয়নি' });
            return;
        }

        if (activeExamineesCount === 0) {
            toast({ variant: 'destructive', title: 'কোনো সক্রিয় পরীক্ষার্থী পাওয়া যায়নি' });
            return;
        }

        if (totalCapacity < activeExamineesCount) {
            toast({ 
                variant: 'destructive', 
                title: 'আসন সংখ্যা অপ্রতুল!', 
                description: `মোট সক্রিয় পরীক্ষার্থী ${activeExamineesCount} জন, কিন্তু মোট আসন ক্ষমতা ${totalCapacity} টি। অনুগ্রহ করে আরও রুম বা বেঞ্চ যোগ করুন।` 
            });
            return;
        }

        setIsGenerating(true);

        try {
            // Prepare structured queues for each class (excluding absents if toggle active)
            const classQueues: Record<string, {
                male: SeatStudent[];
                female: SeatStudent[];
                all: SeatStudent[];
            }> = {};

            selectedClasses.forEach(cName => {
                const list = studentsByClass[cName] || [];
                const activeList = excludeAbsents 
                    ? list.filter(s => !absentStudentIds.has(s.id))
                    : list;

                const mapped: SeatStudent[] = activeList.map(s => ({
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

            // Class pairing strategy for Cross-Class
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

            // Pull student from class queue
            const pullStudent = (cName: string, preferGender?: 'male' | 'female'): SeatStudent | undefined => {
                const q = classQueues[cName];
                if (!q) return undefined;

                if (preferGender === 'male' && q.male.length > 0) {
                    const st = q.male.shift()!;
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

            // Global fallback
            const pullAnyRemaining = (preferGender?: 'male' | 'female'): SeatStudent | undefined => {
                for (const cName of selectedClasses) {
                    const st = pullStudent(cName, preferGender);
                    if (st) return st;
                }
                if (preferGender) {
                    for (const cName of selectedClasses) {
                        const st = pullStudent(cName, undefined);
                        if (st) return st;
                    }
                }
                return undefined;
            };

            // Allocate into rooms and benches
            const newRoomPlans: RoomSeating[] = [];
            let currentPairIdx = 0;

            for (const rSetup of rooms) {
                const roomBenches: BenchSlot[] = [];
                const roomStudents: SeatStudent[] = [];
                const spb = rSetup.seatsPerBench;

                const rightCols = rSetup.rightSideColumns || getDefaultSideColumns(spb, 'male');
                const leftCols = rSetup.leftSideColumns || getDefaultSideColumns(spb, 'female');

                let benchNumberCounter = 1;

                // 1. ডানের বেঞ্চসমূহ (Right side benches)
                for (let b = 1; b <= rSetup.rightBenchCount; b++) {
                    const benchSeats: SeatSlot[] = [];
                    for (let sPos = 0; sPos < spb; sPos++) {
                        const colConfig = rightCols[sPos] || { className: 'auto', gender: 'male' };
                        let st: SeatStudent | undefined = undefined;

                        if (colConfig.className !== 'auto') {
                            st = pullStudent(colConfig.className, colConfig.gender === 'any' ? undefined : colConfig.gender);
                        } else {
                            st = pullAnyRemaining(colConfig.gender === 'any' ? undefined : colConfig.gender);
                        }

                        // Fallback without gender restriction if still not found
                        if (!st) {
                            if (colConfig.className !== 'auto') {
                                st = pullStudent(colConfig.className, undefined);
                            }
                            if (!st) {
                                st = pullAnyRemaining(undefined);
                            }
                        }

                        benchSeats.push({
                            seatNo: sPos + 1,
                            student: st || null
                        });
                        if (st) roomStudents.push(st);
                    }

                    roomBenches.push({
                        benchNumber: benchNumberCounter++,
                        seats: benchSeats
                    });
                }

                // 2. বামের বেঞ্চসমূহ (Left side benches)
                for (let b = 1; b <= rSetup.leftBenchCount; b++) {
                    const benchSeats: SeatSlot[] = [];
                    for (let sPos = 0; sPos < spb; sPos++) {
                        const colConfig = leftCols[sPos] || { className: 'auto', gender: 'female' };
                        let st: SeatStudent | undefined = undefined;

                        if (colConfig.className !== 'auto') {
                            st = pullStudent(colConfig.className, colConfig.gender === 'any' ? undefined : colConfig.gender);
                        } else {
                            st = pullAnyRemaining(colConfig.gender === 'any' ? undefined : colConfig.gender);
                        }

                        // Fallback without gender restriction if still not found
                        if (!st) {
                            if (colConfig.className !== 'auto') {
                                st = pullStudent(colConfig.className, undefined);
                            }
                            if (!st) {
                                st = pullAnyRemaining(undefined);
                            }
                        }

                        benchSeats.push({
                            seatNo: sPos + 1,
                            student: st || null
                        });
                        if (st) roomStudents.push(st);
                    }

                    roomBenches.push({
                        benchNumber: benchNumberCounter++,
                        seats: benchSeats
                    });
                }

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
                description: `মোট ${activeExamineesCount} জন শিক্ষার্থীর জন্য ${rooms.length}টি কক্ষে আসন বিন্যাস সম্পন্ন হয়েছে${excludeAbsents && absentInSelectedClasses > 0 ? ` (অনুপস্থিত ${absentInSelectedClasses} জন বাদ)` : ''}।`
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
            const docRef = doc(db, 'classRoutines', `seatPlan_${academicYear}_${examSlug}`);

            const payload = sanitizeForFirestore({
                academicYear,
                examName: cleanExam,
                roomsSetup: rooms,
                genderPattern,
                classPattern,
                selectedClasses,
                excludeAbsents,
                absentStudentIds: Array.from(absentStudentIds),
                rooms: generatedRooms,
                updatedAt: serverTimestamp()
            });

            await setDoc(docRef, payload, { merge: true });

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

    // Filter students for the on-screen absent manager list
    const currentClassStudentsForAbsent = useMemo(() => {
        const list = studentsByClass[absentManagerClass] || [];
        if (!absentSearchQuery.trim()) return list;
        const q = absentSearchQuery.toLowerCase();
        return list.filter(s => 
            (s.studentNameBn || '').toLowerCase().includes(q) ||
            (s.studentNameEn || '').toLowerCase().includes(q) ||
            String(s.roll || '').includes(q)
        );
    }, [studentsByClass, absentManagerClass, absentSearchQuery]);

    // Compute which print content to show in the printable area
    const activePrintContent = useMemo(() => {
        if (generatedRooms.length === 0) return null;
        // For 'preview' tab, show door_notice as the default print content
        const tab = activePrintTab === 'preview' ? 'door_notice' : activePrintTab;
        return tab;
    }, [activePrintTab, generatedRooms]);

    return (
        <div className="space-y-8 font-kalpurush">

            {/* Print Styles */}
            <style jsx global>{`
                @media print {
                    @page { 
                        size: A4 portrait; 
                        margin: 8mm 6mm !important; 
                    }
                    html, body { 
                        background: white !important; 
                        color: black !important; 
                        margin: 0 !important; 
                        padding: 0 !important; 
                        width: 100% !important;
                        height: auto !important;
                        overflow: visible !important;
                    }
                    body * { 
                        visibility: hidden !important; 
                    }
                    .printable-area,
                    .printable-area * { 
                        visibility: visible !important; 
                    }
                    .printable-area.seat-plan-print-root { 
                        position: absolute !important; 
                        top: 0 !important; 
                        left: 0 !important; 
                        width: 100% !important; 
                        max-width: 100% !important;
                        height: auto !important;
                        min-height: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        overflow: visible !important;
                        display: block !important;
                        box-sizing: border-box !important;
                        z-index: 99999 !important;
                    }
                    .no-print { 
                        display: none !important; 
                    }
                    .page-break { 
                        page-break-after: always !important; 
                        break-after: page !important; 
                    }
                    .seat-sticker-grid {
                        display: grid !important;
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 12px !important;
                    }
                    .door-notice-box {
                        border: 2px solid black !important;
                        padding: 10px !important;
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .master-chart-block {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .master-chart-block:not(:last-child) {
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                    .master-chart-block table {
                        font-size: 10px !important;
                    }
                    .signature-row {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                        margin-top: 8px !important;
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
                                শিক্ষাবর্ষ: {toBengaliNumber(academicYear)} | নকল প্রতিরোধক ক্রস-ক্লাস, জেন্ডার ও অনুপস্থিতি ফিল্টারিং সমন্বয়
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
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">সক্রিয় পরীক্ষার্থী</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <p className="text-xl font-black text-violet-700">{toBengaliNumber(activeExamineesCount)} জন</p>
                                {excludeAbsents && absentInSelectedClasses > 0 && (
                                    <Badge className="bg-rose-100 text-rose-700 text-[10px] font-bold border-none">
                                        -{toBengaliNumber(absentInSelectedClasses)} অনুপস্থিত
                                    </Badge>
                                )}
                            </div>
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
                                {totalCapacity >= activeExamineesCount ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold">পর্যাপ্ত ✓</Badge>
                                ) : (
                                    <Badge className="bg-rose-100 text-rose-800 text-[10px] font-bold">ঘাটতি {toBengaliNumber(activeExamineesCount - totalCapacity)}</Badge>
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
                                <LayoutGrid className="h-5 w-5 text-violet-600" /> ৩. কক্ষ ও বেঞ্চ ব্যবস্থাপনা (বাম-ডান বেঞ্চ ও জেন্ডার সাইড)
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

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            {rooms.map((room) => {
                                const rightCols = room.rightSideColumns || getDefaultSideColumns(room.seatsPerBench, 'male');
                                const leftCols = room.leftSideColumns || getDefaultSideColumns(room.seatsPerBench, 'female');

                                return (
                                    <div key={room.id} className="p-4 bg-slate-50/70 border-2 border-slate-300 rounded-3xl space-y-3 relative group hover:border-violet-400 transition-colors shadow-sm">
                                        {/* Room Name, Bench Seats & Delete */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200">
                                            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                                <div className="w-3 h-3 rounded-full bg-violet-600 shrink-0"></div>
                                                <Input
                                                    value={room.roomName}
                                                    onChange={e => updateRoom(room.id, 'roomName', e.target.value)}
                                                    className="font-black text-base h-9 bg-white border border-slate-300 flex-1"
                                                    placeholder="কক্ষের নাম"
                                                />
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5 text-xs font-bold bg-white px-2.5 py-1 rounded-xl border border-slate-200 shadow-2xs">
                                                    <span className="text-slate-600">বেঞ্চে আসন:</span>
                                                    <Select 
                                                        value={String(room.seatsPerBench)} 
                                                        onValueChange={v => updateRoom(room.id, 'seatsPerBench', parseInt(v))}
                                                    >
                                                        <SelectTrigger className="h-7 w-20 bg-violet-50 font-black text-violet-800 text-xs border-violet-200"><SelectValue /></SelectTrigger>
                                                        <SelectContent className="font-kalpurush">
                                                            <SelectItem value="2" className="font-bold">২ জন</SelectItem>
                                                            <SelectItem value="3" className="font-bold">৩ জন</SelectItem>
                                                            <SelectItem value="4" className="font-bold">৪ জন</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>

                                                <div className="text-[11px] font-black bg-violet-100 text-violet-900 px-3 py-1 rounded-xl border border-violet-200 shadow-2xs">
                                                    মোট: {toBengaliNumber(room.benchCount)} বেঞ্চ ({toBengaliNumber(room.benchCount * room.seatsPerBench)} আসন)
                                                </div>

                                                {rooms.length > 1 && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl shrink-0"
                                                        onClick={() => handleRemoveRoom(room.id)}
                                                        title="কক্ষ মুছুন"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Side-by-side Layout: ডান সাইড এবং বাম সাইড (Word Diagram Style) */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                            {/* ডান সাইড (Right Side) */}
                                            <div className="bg-white p-3 rounded-2xl border-2 border-blue-200/80 shadow-2xs space-y-2.5">
                                                <div className="flex items-center justify-between border-b border-blue-100 pb-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                                                        <span className="font-black text-xs text-blue-950">ডান সাইড</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[11px] font-bold">
                                                        <span className="text-slate-500">বেঞ্চ:</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={room.rightBenchCount}
                                                            onChange={e => updateRoom(room.id, 'rightBenchCount', Math.max(0, parseInt(e.target.value) || 0))}
                                                            className="w-12 h-6 text-center font-black bg-blue-50/80 border border-blue-300 rounded text-xs"
                                                        />
                                                        <span className="text-blue-700 font-bold">({toBengaliNumber(room.rightBenchCount * room.seatsPerBench)} আসন)</span>
                                                    </div>
                                                </div>

                                                {/* Column Settings (Class Dropdown & Gender) */}
                                                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${room.seatsPerBench}, minmax(0, 1fr))` }}>
                                                    {Array.from({ length: room.seatsPerBench }).map((_, cIdx) => {
                                                        const col = rightCols[cIdx] || { className: 'auto', gender: 'male' };
                                                        const colTitle = cIdx === 0 ? 'কলাম ১ (বাম)' : (room.seatsPerBench === 3 && cIdx === 1) ? 'কলাম ২ (মাঝ)' : cIdx === room.seatsPerBench - 1 ? `কলাম ${toBengaliNumber(cIdx + 1)} (ডান)` : `কলাম ${toBengaliNumber(cIdx + 1)}`;

                                                        return (
                                                            <div key={cIdx} className="bg-slate-50/90 p-1.5 rounded-xl border border-slate-200 space-y-1">
                                                                <div className="text-[10px] font-black text-slate-700 text-center truncate">
                                                                    {colTitle}
                                                                </div>
                                                                {/* Class Dropdown */}
                                                                <select
                                                                    value={col.className}
                                                                    onChange={e => updateSideColumn(room.id, 'right', cIdx, 'className', e.target.value)}
                                                                    className="w-full h-7 text-[10px] font-black bg-white border border-slate-300 rounded px-1 text-slate-800"
                                                                >
                                                                    <option value="auto">স্বয়ংক্রিয় (অটো)</option>
                                                                    {selectedClasses.map(c => (
                                                                        <option key={c} value={c}>{classNamesMap[c]} শ্রেণি</option>
                                                                    ))}
                                                                </select>
                                                                {/* Gender Toggle */}
                                                                <div className="flex gap-0.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateSideColumn(room.id, 'right', cIdx, 'gender', 'male')}
                                                                        className={cn(
                                                                            "flex-1 py-0.5 text-[9px] font-black rounded border transition-all text-center",
                                                                            col.gender === 'male' ? "bg-blue-600 text-white border-blue-600 shadow-2xs" : "bg-white text-slate-600 border-slate-200 hover:bg-blue-50"
                                                                        )}
                                                                    >
                                                                        ছাত্র
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateSideColumn(room.id, 'right', cIdx, 'gender', 'female')}
                                                                        className={cn(
                                                                            "flex-1 py-0.5 text-[9px] font-black rounded border transition-all text-center",
                                                                            col.gender === 'female' ? "bg-rose-600 text-white border-rose-600 shadow-2xs" : "bg-white text-slate-600 border-slate-200 hover:bg-rose-50"
                                                                        )}
                                                                    >
                                                                        ছাত্রী
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateSideColumn(room.id, 'right', cIdx, 'gender', 'any')}
                                                                        className={cn(
                                                                            "px-1 py-0.5 text-[8px] font-bold rounded border transition-all text-center",
                                                                            col.gender === 'any' ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-500 border-slate-200"
                                                                        )}
                                                                    >
                                                                        উভয়
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Mini Bench Rows Preview Table */}
                                                <div className="border border-slate-200 rounded-xl overflow-hidden text-[10px]">
                                                    <table className="w-full text-center border-collapse">
                                                        <thead>
                                                            <tr className="bg-blue-50 font-bold border-b border-blue-200 text-[9px] text-blue-900">
                                                                {Array.from({ length: room.seatsPerBench }).map((_, cIdx) => (
                                                                    <th key={cIdx} className="p-1 border-r border-blue-200 last:border-r-0">
                                                                        {cIdx === 0 ? 'আসন ১ (বাম)' : (room.seatsPerBench === 3 && cIdx === 1) ? 'আসন ২ (মাঝ)' : cIdx === room.seatsPerBench - 1 ? 'আসন ৩ (ডান)' : `আসন ${toBengaliNumber(cIdx + 1)}`}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {Array.from({ length: Math.min(4, Math.max(1, room.rightBenchCount)) }).map((_, rIdx) => (
                                                                <tr key={rIdx} className="border-b border-slate-100 last:border-b-0">
                                                                    {Array.from({ length: room.seatsPerBench }).map((_, cIdx) => {
                                                                        const col = rightCols[cIdx] || { className: 'auto', gender: 'male' };
                                                                        const isMale = col.gender === 'male';
                                                                        return (
                                                                            <td key={cIdx} className="p-1 border-r border-slate-100 last:border-r-0 font-bold">
                                                                                <span className={cn(
                                                                                    "inline-block px-1.5 py-0.5 rounded text-[9px] font-bold",
                                                                                    isMale ? "bg-blue-50 text-blue-800 border border-blue-200" : col.gender === 'female' ? "bg-rose-50 text-rose-800 border border-rose-200" : "bg-slate-100 text-slate-700 border border-slate-200"
                                                                                )}>
                                                                                    {col.className !== 'auto' ? `[${classNamesMap[col.className]}] ` : ''}
                                                                                    {isMale ? 'ছাত্র' : col.gender === 'female' ? 'ছাত্রী' : 'উভয়'}
                                                                                </span>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {room.rightBenchCount > 4 && (
                                                        <div className="bg-slate-50 text-[9px] text-center py-0.5 text-slate-500 font-semibold border-t border-slate-100">
                                                            + আরও {toBengaliNumber(room.rightBenchCount - 4)}টি বেঞ্চ নিচে সাজানো হবে
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* বাম সাইড (Left Side) */}
                                            <div className="bg-white p-3 rounded-2xl border-2 border-rose-200/80 shadow-2xs space-y-2.5">
                                                <div className="flex items-center justify-between border-b border-rose-100 pb-1.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                                                        <span className="font-black text-xs text-rose-950">বাম সাইড</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-[11px] font-bold">
                                                        <span className="text-slate-500">বেঞ্চ:</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max="100"
                                                            value={room.leftBenchCount}
                                                            onChange={e => updateRoom(room.id, 'leftBenchCount', Math.max(0, parseInt(e.target.value) || 0))}
                                                            className="w-12 h-6 text-center font-black bg-rose-50/80 border border-rose-300 rounded text-xs"
                                                        />
                                                        <span className="text-rose-700 font-bold">({toBengaliNumber(room.leftBenchCount * room.seatsPerBench)} আসন)</span>
                                                    </div>
                                                </div>

                                                {/* Column Settings (Class Dropdown & Gender) */}
                                                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${room.seatsPerBench}, minmax(0, 1fr))` }}>
                                                    {Array.from({ length: room.seatsPerBench }).map((_, cIdx) => {
                                                        const col = leftCols[cIdx] || { className: 'auto', gender: 'female' };
                                                        const colTitle = cIdx === 0 ? 'কলাম ১ (বাম)' : (room.seatsPerBench === 3 && cIdx === 1) ? 'কলাম ২ (মাঝ)' : cIdx === room.seatsPerBench - 1 ? `কলাম ${toBengaliNumber(cIdx + 1)} (ডান)` : `কলাম ${toBengaliNumber(cIdx + 1)}`;

                                                        return (
                                                            <div key={cIdx} className="bg-slate-50/90 p-1.5 rounded-xl border border-slate-200 space-y-1">
                                                                <div className="text-[10px] font-black text-slate-700 text-center truncate">
                                                                    {colTitle}
                                                                </div>
                                                                {/* Class Dropdown */}
                                                                <select
                                                                    value={col.className}
                                                                    onChange={e => updateSideColumn(room.id, 'left', cIdx, 'className', e.target.value)}
                                                                    className="w-full h-7 text-[10px] font-black bg-white border border-slate-300 rounded px-1 text-slate-800"
                                                                >
                                                                    <option value="auto">স্বয়ংক্রিয় (অটো)</option>
                                                                    {selectedClasses.map(c => (
                                                                        <option key={c} value={c}>{classNamesMap[c]} শ্রেণি</option>
                                                                    ))}
                                                                </select>
                                                                {/* Gender Toggle */}
                                                                <div className="flex gap-0.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateSideColumn(room.id, 'left', cIdx, 'gender', 'male')}
                                                                        className={cn(
                                                                            "flex-1 py-0.5 text-[9px] font-black rounded border transition-all text-center",
                                                                            col.gender === 'male' ? "bg-blue-600 text-white border-blue-600 shadow-2xs" : "bg-white text-slate-600 border-slate-200 hover:bg-blue-50"
                                                                        )}
                                                                    >
                                                                        ছাত্র
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateSideColumn(room.id, 'left', cIdx, 'gender', 'female')}
                                                                        className={cn(
                                                                            "flex-1 py-0.5 text-[9px] font-black rounded border transition-all text-center",
                                                                            col.gender === 'female' ? "bg-rose-600 text-white border-rose-600 shadow-2xs" : "bg-white text-slate-600 border-slate-200 hover:bg-rose-50"
                                                                        )}
                                                                    >
                                                                        ছাত্রী
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updateSideColumn(room.id, 'left', cIdx, 'gender', 'any')}
                                                                        className={cn(
                                                                            "px-1 py-0.5 text-[8px] font-bold rounded border transition-all text-center",
                                                                            col.gender === 'any' ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-500 border-slate-200"
                                                                        )}
                                                                    >
                                                                        উভয়
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                {/* Mini Bench Rows Preview Table */}
                                                <div className="border border-slate-200 rounded-xl overflow-hidden text-[10px]">
                                                    <table className="w-full text-center border-collapse">
                                                        <thead>
                                                            <tr className="bg-rose-50 font-bold border-b border-rose-200 text-[9px] text-rose-900">
                                                                {Array.from({ length: room.seatsPerBench }).map((_, cIdx) => (
                                                                    <th key={cIdx} className="p-1 border-r border-rose-200 last:border-r-0">
                                                                        {cIdx === 0 ? 'আসন ১ (বাম)' : (room.seatsPerBench === 3 && cIdx === 1) ? 'আসন ২ (মাঝ)' : cIdx === room.seatsPerBench - 1 ? 'আসন ৩ (ডান)' : `আসন ${toBengaliNumber(cIdx + 1)}`}
                                                                    </th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {Array.from({ length: Math.min(4, Math.max(1, room.leftBenchCount)) }).map((_, rIdx) => (
                                                                <tr key={rIdx} className="border-b border-slate-100 last:border-b-0">
                                                                    {Array.from({ length: room.seatsPerBench }).map((_, cIdx) => {
                                                                        const col = leftCols[cIdx] || { className: 'auto', gender: 'female' };
                                                                        const isMale = col.gender === 'male';
                                                                        return (
                                                                            <td key={cIdx} className="p-1 border-r border-slate-100 last:border-r-0 font-bold">
                                                                                <span className={cn(
                                                                                    "inline-block px-1.5 py-0.5 rounded text-[9px] font-bold",
                                                                                    isMale ? "bg-blue-50 text-blue-800 border border-blue-200" : col.gender === 'female' ? "bg-rose-50 text-rose-800 border border-rose-200" : "bg-slate-100 text-slate-700 border border-slate-200"
                                                                                )}>
                                                                                    {col.className !== 'auto' ? `[${classNamesMap[col.className]}] ` : ''}
                                                                                    {isMale ? 'ছাত্র' : col.gender === 'female' ? 'ছাত্রী' : 'উভয়'}
                                                                                </span>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                    {room.leftBenchCount > 4 && (
                                                        <div className="bg-slate-50 text-[9px] text-center py-0.5 text-slate-500 font-semibold border-t border-slate-100">
                                                            + আরও {toBengaliNumber(room.leftBenchCount - 4)}টি বেঞ্চ নিচে সাজানো হবে
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 3. Seating Pattern Options */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-violet-50/50 rounded-2xl border-2 border-violet-100">
                        {/* Gender arrangement */}
                        <div className="space-y-2">
                            <Label className="font-black text-sm text-violet-950 flex items-center gap-1.5">
                                <Users className="h-4 w-4 text-violet-600" /> ৪. ছাত্র-ছাত্রী বসার পদ্ধতি (মিশ্রিত কক্ষের জন্য)
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
                                * যদি কোনো কক্ষের আসনে "উভয়" জেন্ডার রাখা থাকে, তবে সেখানে এই সাধারণ নিয়ম প্রযোজ্য হবে।
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

                    {/* 4. ABSENT STUDENTS FILTERING & MANAGER */}
                    <div className="p-5 bg-rose-50/60 rounded-2xl border-2 border-rose-200 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center space-x-3">
                                <Checkbox 
                                    id="exclude-absents-checkbox"
                                    checked={excludeAbsents}
                                    onCheckedChange={(checked) => setExcludeAbsents(!!checked)}
                                    className="h-5 w-5 border-2 border-rose-500 data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600"
                                />
                                <div>
                                    <Label htmlFor="exclude-absents-checkbox" className="font-black text-sm text-rose-950 cursor-pointer flex items-center gap-2">
                                        <UserX className="h-4 w-4 text-rose-600" /> ৬. অনুপস্থিত শিক্ষার্থীদের সিট থেকে বাদ দিন
                                    </Label>
                                    <p className="text-xs text-rose-800 font-bold mt-0.5">
                                        ফলাফল সেকশনের রেকর্ড অনুযায়ী বা নিচে ম্যানুয়ালি টিক দেওয়া অনুপস্থিত শিক্ষার্থীরা সিট পাবে না।
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowAbsentManager(prev => !prev)}
                                    className="font-black text-xs h-9 border-rose-300 text-rose-800 hover:bg-rose-100 bg-white shadow-xs"
                                >
                                    {showAbsentManager ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                                    শিক্ষার্থী নির্বাচন করুন ({toBengaliNumber(absentStudentIds.size)})
                                </Button>
                            </div>
                        </div>

                        {/* List of currently excluded absent students */}
                        {absentStudentIds.size > 0 && (
                            <div className="pt-2 border-t border-rose-200">
                                <span className="text-[11px] font-bold text-rose-900 block mb-1.5">
                                    বর্তমানে বাদ দেওয়া অনুপস্থিত শিক্ষার্থী ({toBengaliNumber(absentStudentIds.size)} জন):
                                </span>
                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                                    {Array.from(absentStudentIds).map(stId => {
                                        let foundStudent: Student | undefined = undefined;
                                        for (const c of ['6','7','8','9','10']) {
                                            foundStudent = (studentsByClass[c] || []).find(s => s.id === stId);
                                            if (foundStudent) break;
                                        }
                                        return (
                                            <Badge 
                                                key={stId} 
                                                variant="outline" 
                                                className="bg-white border-rose-300 text-rose-900 font-bold text-xs py-1 px-2.5 flex items-center gap-1.5 shadow-2xs"
                                            >
                                                <span>
                                                    {foundStudent ? `[${classNamesMap[foundStudent.className]}] রোল ${toBengaliNumber(foundStudent.roll)} - ${foundStudent.studentNameBn}` : stId}
                                                </span>
                                                <button 
                                                    type="button" 
                                                    onClick={() => toggleStudentAbsent(stId)}
                                                    className="text-rose-500 hover:text-rose-800 font-black ml-1 text-sm leading-none"
                                                    title="উপস্থিত করুন"
                                                >
                                                    ×
                                                </button>
                                            </Badge>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Expandable On-Screen Student Absent Toggler */}
                        {showAbsentManager && (
                            <div className="mt-3 p-4 bg-white rounded-xl border border-rose-200 space-y-3 animate-in fade-in duration-300">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-2 border-b">
                                    {/* Class tabs */}
                                    <div className="flex flex-wrap items-center gap-1">
                                        {selectedClasses.map(cName => (
                                            <Button
                                                key={`abs-c-${cName}`}
                                                type="button"
                                                size="sm"
                                                variant={absentManagerClass === cName ? 'default' : 'ghost'}
                                                onClick={() => setAbsentManagerClass(cName)}
                                                className={cn("h-7 px-3 text-xs font-black", absentManagerClass === cName && "bg-rose-600 hover:bg-rose-700 text-white")}
                                            >
                                                {classNamesMap[cName]} শ্রেণি
                                            </Button>
                                        ))}
                                    </div>

                                    {/* Search by name/roll */}
                                    <div className="relative w-full sm:w-60">
                                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input
                                            value={absentSearchQuery}
                                            onChange={e => setAbsentSearchQuery(e.target.value)}
                                            placeholder="রোল বা নাম দিয়ে খুঁজুন..."
                                            className="h-8 pl-8 text-xs bg-slate-50 border-slate-300"
                                        />
                                    </div>
                                </div>

                                {/* Student check grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
                                    {currentClassStudentsForAbsent.map(st => {
                                        const isAbsent = absentStudentIds.has(st.id);
                                        return (
                                            <button
                                                key={st.id}
                                                type="button"
                                                onClick={() => toggleStudentAbsent(st.id)}
                                                className={cn(
                                                    "p-2 rounded-lg border text-left flex items-center justify-between transition-all",
                                                    isAbsent 
                                                        ? "bg-rose-100 border-rose-400 text-rose-950 font-black shadow-xs" 
                                                        : "bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800 font-bold"
                                                )}
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <span className="text-xs font-black mr-1 text-primary">
                                                        #{toBengaliNumber(st.roll)}
                                                    </span>
                                                    <span className="text-xs truncate">{st.studentNameBn || st.studentNameEn}</span>
                                                </div>
                                                <Badge className={cn("text-[10px] shrink-0 font-bold", isAbsent ? "bg-rose-600 text-white" : "bg-slate-200 text-slate-700")}>
                                                    {isAbsent ? "অনুপস্থিত" : "উপস্থিত"}
                                                </Badge>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
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

                    {/* VIEW 1: Visual Interactive Room Grid (On Screen Only) */}
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

                    {/* PRINTABLE AREA - contains the active print view, always rendered but only visible on print */}
                    <div className="printable-area seat-plan-print-root">
                        {/* Door Notice - shown when activePrintTab is door_notice or preview (default print) */}
                        {(activePrintContent === 'door_notice') && (() => {
                            // Group rooms into pairs (2 per page)
                            const pairs: RoomSeating[][] = [];
                            for (let i = 0; i < generatedRooms.length; i += 2) {
                                pairs.push(generatedRooms.slice(i, i + 2));
                            }
                            return (
                                <div className="w-full">
                                    {pairs.map((pair, pIdx) => (
                                        <div key={pIdx} className={pIdx < pairs.length - 1 ? 'page-break' : ''}>
                                            {pair.map((room) => (
                                                <div key={room.roomId} className="door-notice-box bg-white text-black font-kalpurush border-2 border-black mb-4" style={{padding:'10px'}}>
                                                    <header className="text-center border-b-2 border-black pb-2 mb-3">
                                                        <h1 className="text-lg font-black">{schoolInfo.name}</h1>
                                                        <p className="text-[10px] font-bold text-slate-700">{schoolInfo.address}</p>
                                                        <div className="mt-1 inline-block border-2 border-black px-4 py-0.5 rounded-full font-black text-sm bg-slate-100 uppercase">
                                                            {selectedExam} - {toBengaliNumber(academicYear)}
                                                        </div>
                                                        <h2 className="text-base font-black mt-1 text-primary underline underline-offset-2">
                                                            কক্ষের সিট চার্ট ও নোটিশ: {room.roomName}
                                                        </h2>
                                                    </header>

                                                    <div className="my-2">
                                                        <table className="w-full border-collapse border-2 border-black text-center">
                                                            <thead>
                                                                <tr className="bg-slate-100 border-b-2 border-black text-xs font-black">
                                                                    <th className="border-r-2 border-black p-1.5">ক্রমিক</th>
                                                                    <th className="border-r-2 border-black p-1.5">শ্রেণি</th>
                                                                    <th className="border-r-2 border-black p-1.5">রোল নম্বরসমূহ</th>
                                                                    <th className="p-1.5">মোট পরীক্ষার্থী</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {room.classSummaries.map((cs, cIdx) => (
                                                                    <tr key={cIdx} className="border-b border-black text-xs font-bold">
                                                                        <td className="border-r-2 border-black p-1 font-black">{toBengaliNumber(cIdx + 1)}</td>
                                                                        <td className="border-r-2 border-black p-1 font-black">{classNamesMap[cs.className]} শ্রেণি</td>
                                                                        <td className="border-r-2 border-black p-1 font-black">{cs.rollsStr}</td>
                                                                        <td className="p-1 font-black">{toBengaliNumber(cs.count)} জন</td>
                                                                    </tr>
                                                                ))}
                                                                <tr className="bg-slate-100 font-black text-sm border-t-2 border-black">
                                                                    <td colSpan={3} className="border-r-2 border-black p-1.5 text-right pr-3">এই কক্ষের মোট পরীক্ষার্থী:</td>
                                                                    <td className="p-1.5">{toBengaliNumber(room.totalStudents)} জন</td>
                                                                </tr>
                                                            </tbody>
                                                        </table>
                                                    </div>

                                                    <div className="mt-2 p-2 bg-slate-50 border border-black rounded text-[10px] space-y-0.5">
                                                        <p className="font-bold">⚠️ পরীক্ষার্থীদের জন্য নির্দেশনাবলী:</p>
                                                        <p>১. নির্ধারিত কক্ষে বেঞ্চের স্টিকার অনুযায়ী নির্ধারিত আসনে বসতে হবে।</p>
                                                        <p>২. পরীক্ষা শুরুর অন্তত ১৫ মিনিট পূর্বে কক্ষে উপস্থিত থাকতে হবে।</p>
                                                    </div>

                                                    <div className="signature-row flex justify-between items-end mt-6 pt-4 text-[10px] font-black">
                                                        <div className="text-center w-36 border-t border-black pt-1">আহ্বায়ক / পরীক্ষা কমিটি</div>
                                                        <div className="text-center w-36 border-t border-black pt-1">প্রধান শিক্ষক</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}

                        {/* Desk Slips */}
                        {activePrintContent === 'desk_slips' && (
                            <div className="space-y-8 w-full">
                                {generatedRooms.map((room, rIdx) => {
                                    const allAssigned = room.benches.flatMap(b => 
                                        b.seats.filter(s => s.student).map(s => ({
                                            benchNo: b.benchNumber,
                                            seatNo: s.seatNo,
                                            student: s.student!
                                        }))
                                    );
                                    const chunkSize = 10;
                                    const chunks: typeof allAssigned[] = [];
                                    for (let i = 0; i < allAssigned.length; i += chunkSize) {
                                        chunks.push(allAssigned.slice(i, i + chunkSize));
                                    }
                                    return (
                                        <div key={room.roomId} className="space-y-6">
                                            {chunks.map((chunk, cIdx) => (
                                                <div key={cIdx} className={cIdx < chunks.length - 1 || rIdx < generatedRooms.length - 1 ? "page-break p-4 bg-white text-black font-kalpurush" : "p-4 bg-white text-black font-kalpurush"}>
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

                        {/* Master Chart */}
                        {activePrintContent === 'master_chart' && (
                            <div className="space-y-8 w-full">
                                {generatedRooms.map((room) => (
                                    <div key={room.roomId} className="master-chart-block bg-white text-black p-6 font-kalpurush border border-black">
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

                                        <div className="signature-row flex justify-between items-end mt-4 pt-3 text-xs font-black">
                                            <div>কক্ষ পরিদর্শকের স্বাক্ষর: ____________________</div>
                                            <div>প্রধান শিক্ষক: ____________________</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* On-screen previews for non-preview tabs (no-print) */}
                    {activePrintTab === 'door_notice' && (
                        <div className="space-y-8 no-print max-w-4xl mx-auto">
                            {generatedRooms.map((room) => (
                                <div key={room.roomId} className="door-notice-box bg-white text-black font-kalpurush border-2 border-black rounded-2xl p-6 sm:p-8 shadow-xl mb-8">
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
                                        <div className="text-center w-40 border-t border-black pt-1">আহ্বায়ক / পরীক্ষা কমিটি</div>
                                        <div className="text-center w-40 border-t border-black pt-1">প্রধান শিক্ষক</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activePrintTab === 'desk_slips' && (
                        <div className="space-y-8 no-print max-w-4xl mx-auto">
                            {generatedRooms.map((room) => {
                                const allAssigned = room.benches.flatMap(b => 
                                    b.seats.filter(s => s.student).map(s => ({
                                        benchNo: b.benchNumber,
                                        seatNo: s.seatNo,
                                        student: s.student!
                                    }))
                                );
                                const chunkSize = 10;
                                const chunks: typeof allAssigned[] = [];
                                for (let i = 0; i < allAssigned.length; i += chunkSize) {
                                    chunks.push(allAssigned.slice(i, i + chunkSize));
                                }
                                return (
                                    <div key={room.roomId} className="space-y-6">
                                        {chunks.map((chunk, cIdx) => (
                                            <div key={cIdx} className="p-6 rounded-2xl border-2 border-slate-300 shadow-xl mb-8 bg-white text-black font-kalpurush">
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

                    {activePrintTab === 'master_chart' && (
                        <div className="space-y-8 no-print max-w-4xl mx-auto">
                            {generatedRooms.map((room) => (
                                <div key={room.roomId} className="bg-white text-black font-kalpurush border border-black p-6 rounded-2xl shadow-xl mb-8">
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
