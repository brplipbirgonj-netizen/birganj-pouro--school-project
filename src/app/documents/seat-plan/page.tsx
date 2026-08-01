'use client';

import { useState, useEffect, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { Exam, getExams } from '@/lib/exam-data';
import { Printer, ArrowLeft, Grid3X3, Plus, Trash2, Info } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { useSchoolInfo } from '@/context/SchoolInfoContext';

const classNamesMap: Record<string, string> = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

type RoomConfig = {
    roomName: string;
    startRoll: number;
    endRoll: number;
};

const toBengaliNumber = (str: string | number) => String(str).replace(/[0-9]/g, (w) => ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'][parseInt(w, 10)]);

export default function SeatPlanGeneratorPage() {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const { schoolInfo } = useSchoolInfo();

    const [exams, setExams] = useState<Exam[]>([]);
    const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
    const [selectedClass, setSelectedClass] = useState<string>('6');
    const [students, setStudents] = useState<Student[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [roomConfigs, setRoomConfigs] = useState<RoomConfig[]>([{ roomName: '', startRoll: 1, endRoll: 50 }]);

    useEffect(() => {
        if (!db) return;
        getExams(db, selectedYear).then(setExams);
    }, [db, selectedYear]);

    const fetchStudents = async () => {
        if (!db || !selectedClass) return;
        setIsLoading(true);
        try {
            const q = query(
                collection(db, 'students'),
                where('academicYear', '==', selectedYear),
                where('className', '==', selectedClass),
                orderBy('roll')
            );
            const snap = await getDocs(q);
            setStudents(snap.docs.map(studentFromDoc));
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStudents();
    }, [selectedClass, selectedYear, db]);

    const addRoom = () => setRoomConfigs([...roomConfigs, { roomName: '', startRoll: 1, endRoll: 50 }]);
    const removeRoom = (index: number) => setRoomConfigs(roomConfigs.filter((_, i) => i !== index));
    const updateRoom = (index: number, field: keyof RoomConfig, value: any) => {
        const next = [...roomConfigs];
        next[index] = { ...next[index], [field]: value };
        setRoomConfigs(next);
    };

    const seatLabels = useMemo(() => {
        const labels: any[] = [];
        roomConfigs.forEach(room => {
            const roomStudents = students.filter(s => s.roll >= room.startRoll && s.roll <= room.endRoll);
            roomStudents.forEach(s => {
                labels.push({
                    student: s,
                    room: room.roomName,
                    exam: selectedExam?.name || 'বার্ষিক পরীক্ষা'
                });
            });
        });
        return labels;
    }, [students, roomConfigs, selectedExam]);

    // Group labels for printing (8 per A4 page)
    const paginatedLabels = useMemo(() => {
        const pages: any[][] = [];
        for (let i = 0; i < seatLabels.length; i += 8) {
            pages.push(seatLabels.slice(i, i + 8));
        }
        return pages;
    }, [seatLabels]);

    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-100 font-kalpurush">
            <Header />
            <main className="flex-1 p-4 md:p-8 no-print">
                <div className="max-w-[1200px] mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <Link href="/documents">
                            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black text-primary">পরীক্ষার আসন বিন্যাস (Seat Plan)</h1>
                            <p className="text-sm text-muted-foreground">বেঞ্চে লাগানোর জন্য রোল ভিত্তিক লেবেল জেনারেট করুন</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        {/* Control Panel */}
                        <Card className="lg:col-span-1 shadow-lg border-2">
                            <CardHeader className="bg-indigo-50 border-b">
                                <CardTitle className="text-lg">কনফিগারেশন</CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="font-bold">পরীক্ষা নির্বাচন করুন</Label>
                                        <Select value={selectedExam?.id || ''} onValueChange={(id) => setSelectedExam(exams.find(e => e.id === id) || null)}>
                                            <SelectTrigger className="bg-white"><SelectValue placeholder="পরীক্ষা" /></SelectTrigger>
                                            <SelectContent>
                                                {exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold">শ্রেণি</Label>
                                        <Select value={selectedClass} onValueChange={setSelectedClass}>
                                            <SelectTrigger className="bg-white"><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
                                            <SelectContent>
                                                {Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-4 border-t pt-4">
                                    <Label className="font-black text-indigo-700">রুম ও রোল রেঞ্জ</Label>
                                    {roomConfigs.map((room, idx) => (
                                        <div key={idx} className="p-3 border rounded-lg bg-slate-50 space-y-3 relative group">
                                            {roomConfigs.length > 1 && (
                                                <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-red-500 opacity-0 group-hover:opacity-100" onClick={() => removeRoom(idx)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                            <div className="space-y-1">
                                                <Label className="text-[10px] uppercase font-bold">রুম নম্বর/নাম</Label>
                                                <Input value={room.roomName} onChange={e => updateRoom(idx, 'roomName', e.target.value)} placeholder="উদা: ১০১" className="h-8 text-xs" />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold">রোল থেকে</Label>
                                                    <Input type="number" value={room.startRoll} onChange={e => updateRoom(idx, 'startRoll', parseInt(e.target.value))} className="h-8 text-xs" />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-bold">রোল পর্যন্ত</Label>
                                                    <Input type="number" value={room.endRoll} onChange={e => updateRoom(idx, 'endRoll', parseInt(e.target.value))} className="h-8 text-xs" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <Button variant="outline" className="w-full border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 font-bold" onClick={addRoom}>
                                        <Plus className="h-4 w-4 mr-1" /> আরও রুম যোগ করুন
                                    </Button>
                                </div>

                                <Button onClick={() => window.print()} className="w-full h-12 text-lg font-black bg-indigo-700 hover:bg-indigo-800 shadow-xl" disabled={seatLabels.length === 0}>
                                    <Printer className="mr-2 h-5 w-5" /> প্রিন্ট লেবেল ({toBengaliNumber(seatLabels.length)})
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Preview Area */}
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                                <Info className="h-4 w-4" /> প্রিভিউ (এক পাতায় ৮টি লেবেল থাকবে)
                            </h3>
                            <div className="bg-white p-8 border-4 border-dashed rounded-2xl min-h-[500px] flex flex-wrap gap-4 justify-center items-start overflow-y-auto max-h-[800px] shadow-inner">
                                {seatLabels.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground opacity-30">
                                        <Grid3X3 className="h-20 w-20 mb-4" />
                                        <p className="text-xl font-black">তথ্য সিলেক্ট করুন</p>
                                    </div>
                                ) : (
                                    seatLabels.map((item, i) => (
                                        <SeatLabel key={i} data={item} schoolInfo={schoolInfo} />
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Printable Area */}
            <div className="hidden print:block printable-area bg-white">
                {paginatedLabels.map((page, pIdx) => (
                    <div key={pIdx} className="w-[210mm] h-[297mm] grid grid-cols-2 grid-rows-4 p-[10mm] gap-[5mm] box-border" style={{ pageBreakAfter: 'always' }}>
                        {page.map((item, i) => (
                            <div key={i} className="flex items-center justify-center border-2 border-dashed border-gray-300">
                                <SeatLabel data={item} schoolInfo={schoolInfo} isPrint />
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

function SeatLabel({ data, schoolInfo, isPrint = false }: { data: any, schoolInfo: any, isPrint?: boolean }) {
    return (
        <div className={cn(
            "border-2 border-black p-4 flex flex-col font-kalpurush bg-white box-border overflow-hidden",
            isPrint ? "w-[90mm] h-[65mm]" : "w-[240px] h-[160px] shadow-md rounded-md"
        )}>
            <div className="flex items-center gap-2 border-b border-black pb-1 mb-2">
                {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" width={30} height={30} className="object-contain" />}
                <div className="text-left overflow-hidden">
                    <h2 className="text-[12px] font-black text-indigo-900 leading-tight uppercase whitespace-nowrap">{schoolInfo.name}</h2>
                    <p className="text-[8px] font-bold text-slate-600 uppercase">{data.exam}</p>
                </div>
            </div>
            
            <div className="flex-1 flex flex-col justify-center gap-1.5">
                <div className="flex items-end gap-2 border-b border-dashed border-slate-300 pb-0.5">
                    <span className="text-[10px] font-bold text-slate-500 min-w-10">নাম:</span>
                    <span className="text-[14px] font-black text-slate-800 leading-none">{data.student.studentNameBn}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-end gap-2 border-b border-dashed border-slate-300 pb-0.5">
                        <span className="text-[10px] font-bold text-slate-500">শ্রেণি:</span>
                        <span className="text-[12px] font-black text-slate-800 leading-none">{classNamesMap[data.student.className] || data.student.className}</span>
                    </div>
                    <div className="flex items-end gap-2 border-b border-dashed border-slate-300 pb-0.5">
                        <span className="text-[10px] font-bold text-slate-500">রোল:</span>
                        <span className="text-[16px] font-black text-indigo-700 leading-none">{toBengaliNumber(data.student.roll)}</span>
                    </div>
                </div>
            </div>

            <div className="mt-2 flex justify-between items-center bg-slate-50 p-1.5 rounded border border-slate-200">
                <div className="flex items-center gap-1">
                    <span className="text-[9px] font-bold uppercase text-slate-500">রুম:</span>
                    <span className="text-[13px] font-black text-indigo-900">{toBengaliNumber(data.room) || '-'}</span>
                </div>
                <span className="text-[8px] font-black text-slate-400 italic">BPHS Management System</span>
            </div>
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
