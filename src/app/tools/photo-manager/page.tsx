'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { 
    ImageIcon, Upload, Search, UserCheck, X, CheckCircle2, 
    Loader2, Save, Trash2, ImagePlus, ArrowRight, RotateCcw, 
    Maximize2, Sliders, Check, FileImage, ShieldCheck, AlertCircle, Info,
    FilePen, Users, Scissors, Crop, MousePointer2, Eraser, Palette
} from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Student, studentFromDoc, sanitizePhotoUrl, getStudentPlaceholderImage } from '@/lib/student-data';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

const classNamesMap: Record<string, string> = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

type ProcessingImage = {
    id: string;
    file: File;
    fileName: string;
    preview: string;
    matchedStudent: Student | null;
    status: 'pending' | 'matched' | 'unmatched' | 'saving' | 'saved' | 'error';
    processedDataUrl?: string;
    brightness: number;
    contrast: number;
    bgColor: string;
    isBgRemoved: boolean;
    cropArea: { x: number, y: number, scale: number };
};

export default function PhotoManagerPage() {
    const db = useFirestore();
    const { user } = useAuth();
    const { selectedYear } = useAcademicYear();
    const { toast } = useToast();
    
    const [isClient, setIsClient] = useState(false);
    const [queue, setQueue] = useState<ProcessingImage[]>([]);
    const [currentIndex, setCurrentIdx] = useState<number>(0);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [isFetchingStudents, setIsFetchingStudents] = useState(true);

    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [manualClass, setManualClass] = useState<string>('');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => { setIsClient(true); }, []);

    const fetchStudents = useCallback(async () => {
        if (!db || !user) return;
        setIsFetchingStudents(true);
        try {
            const q = query(collection(db, 'students'), where('academicYear', '==', selectedYear));
            const snap = await getDocs(q);
            setAllStudents(snap.docs.map(studentFromDoc));
        } catch (e) {
            console.error(e);
        } finally {
            setIsFetchingStudents(false);
        }
    }, [db, user, selectedYear]);

    useEffect(() => { fetchStudents(); }, [fetchStudents]);

    const currentImage = useMemo(() => queue[currentIndex] || null, [queue, currentIndex]);

    const matchStudentByName = (name: string, students: Student[]) => {
        const cleanName = name.replace(/\.[^/.]+$/, "");
        const match = cleanName.match(/(\d+)[_\-\s](\d+)/);
        if (match) {
            const cls = match[1];
            const roll = parseInt(match[2], 10);
            return students.find(s => s.className === cls && s.roll === roll) || null;
        }
        return null;
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newItems: ProcessingImage[] = files.map(file => {
            const matchedStudent = matchStudentByName(file.name, allStudents);
            return {
                id: Math.random().toString(36).substr(2, 9),
                file,
                fileName: file.name,
                preview: URL.createObjectURL(file),
                matchedStudent,
                status: matchedStudent ? 'matched' : 'unmatched',
                brightness: 100,
                contrast: 100,
                bgColor: 'transparent',
                isBgRemoved: false,
                cropArea: { x: 0, y: 0, scale: 1 }
            };
        });

        setQueue(prev => [...prev, ...newItems]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!currentImage) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !currentImage) return;
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        
        setQueue(prev => prev.map(it => it.id === currentImage.id ? {
            ...it,
            cropArea: { ...it.cropArea, x: it.cropArea.x + dx, y: it.cropArea.y + dy }
        } : it));
        setDragStart({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleWheel = (e: React.WheelEvent) => {
        if (!currentImage) return;
        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        const nextScale = Math.max(0.1, Math.min(5, currentImage.cropArea.scale + delta));
        
        setQueue(prev => prev.map(it => it.id === currentImage.id ? {
            ...it,
            cropArea: { ...it.cropArea, scale: nextScale }
        } : it));
    };

    const handleUpdateItem = (fields: Partial<ProcessingImage>) => {
        if (!currentImage) return;
        setQueue(prev => prev.map(it => it.id === currentImage.id ? { ...it, ...fields } : it));
    };

    const handleNameChange = (newName: string) => {
        if (!currentImage) return;
        const matchedStudent = matchStudentByName(newName, allStudents);
        setQueue(prev => prev.map(it => it.id === currentImage.id ? { 
            ...it, 
            fileName: newName,
            matchedStudent,
            status: matchedStudent ? 'matched' : 'unmatched'
        } : it));
        if (matchedStudent) setManualClass(matchedStudent.className);
    };

    const processFinalImage = async (item: ProcessingImage): Promise<string> => {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { reject('No context'); return; }

            const img = new window.Image();
            img.src = item.preview;
            img.onload = () => {
                const targetSize = 300; // Final resolution changed from 512 to 300 as per request
                canvas.width = targetSize;
                canvas.height = targetSize;

                if (item.bgColor !== 'transparent') {
                    ctx.fillStyle = item.bgColor;
                    ctx.fillRect(0, 0, targetSize, targetSize);
                }

                ctx.filter = `brightness(${item.brightness}%) contrast(${item.contrast}%)`;
                
                const { x, y, scale } = item.cropArea;
                const iw = img.width;
                const ih = img.height;
                const aspect = iw / ih;
                
                let dw, dh;
                if (aspect > 1) {
                    dw = targetSize;
                    dh = targetSize / aspect;
                } else {
                    dh = targetSize;
                    dw = targetSize * aspect;
                }

                const finalWidth = dw * scale;
                const finalHeight = dh * scale;
                
                // Adjust scale factor based on the preview vs canvas ratio
                const scaleFactor = targetSize / 320; 
                const cx = (targetSize - finalWidth) / 2 + (x * scaleFactor);
                const cy = (targetSize - finalHeight) / 2 + (y * scaleFactor);

                ctx.drawImage(img, cx, cy, finalWidth, finalHeight);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => reject('Image load error');
        });
    };

    const handleSaveIndividual = async (idx: number) => {
        if (!db) return;
        const item = queue[idx];
        if (!item.matchedStudent) {
            toast({ variant: 'destructive', title: 'ত্রুটি', description: 'শিক্ষার্থী নির্বাচন করুন।' });
            return;
        }

        setQueue(prev => prev.map((it, i) => i === idx ? { ...it, status: 'saving' } : it));

        try {
            const processedUrl = await processFinalImage(item);

            await updateDoc(doc(db, 'students', item.matchedStudent.id), {
                photoUrl: processedUrl,
                updatedAt: serverTimestamp()
            });

            toast({ title: 'ছবি সেভ হয়েছে', description: `${item.matchedStudent.studentNameBn} এর প্রোফাইল আপডেট করা হয়েছে।` });
            setQueue(prev => prev.map((it, i) => i === idx ? { ...it, status: 'saved', processedDataUrl: processedUrl } : it));
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'ত্রুটি', description: 'সংরক্ষণ ব্যর্থ হয়েছে।' });
            setQueue(prev => prev.map((it, i) => i === idx ? { ...it, status: 'error' } : it));
        }
    };

    const studentsFilteredByClass = useMemo(() => {
        if (!manualClass) return [];
        return allStudents.filter(s => s.className === manualClass).sort((a, b) => a.roll - b.roll);
    }, [allStudents, manualClass]);

    function toBengaliNumber(str: string | number | undefined | null) {
        if (!str && str !== 0) return '';
        const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
        return String(str).replace(/[0-9]/g, (w) => digits[parseInt(w, 10)]);
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#F6F7F9] font-kalpurush">
            <Header />
            <main className="flex-1 p-4 md:p-10 pb-40">
                <div className="max-w-[1400px] mx-auto space-y-8">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">স্মার্ট ফটো পোর্টাল (Auto-Linker)</h1>
                            <p className="text-sm font-bold text-muted-foreground mt-1">শিক্ষার্থীদের ছবি এডিট এবং অটো-প্রোফাইল আপডেটিং টুল</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" className="font-black border-2 gap-2" onClick={() => fileInputRef.current?.click()}>
                                <ImagePlus className="h-4 w-4" /> ছবি আপলোড করুন
                            </Button>
                            <input type="file" multiple ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        <div className="space-y-6">
                            <Card className="border-[4px] border-black rounded-[32px] overflow-hidden shadow-2xl bg-white">
                                <CardHeader className="bg-primary/5 border-b-[3px] border-black flex flex-row justify-between items-center p-6">
                                    <CardTitle className="text-lg font-black flex items-center gap-2 text-primary">
                                        <Loader2 className={cn("h-5 w-5", queue.some(i => i.status === 'saving') && "animate-spin")} /> কিউ (Queue)
                                    </CardTitle>
                                    <Badge className="font-black">{toBengaliNumber(queue.length)} টি ছবি</Badge>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[500px]">
                                        {queue.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center p-12 text-center opacity-30">
                                                <ImageIcon className="h-16 w-16 mb-4" />
                                                <p className="font-black">কোনো ছবি নেই</p>
                                                <p className="text-xs font-bold">ছবি ড্রপ করুন বা আপলোড দিন</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y-2 divide-slate-100">
                                                {queue.map((item, idx) => (
                                                    <div 
                                                        key={item.id} 
                                                        className={cn(
                                                            "p-3 space-y-2 cursor-pointer transition-all hover:bg-slate-50",
                                                            currentIndex === idx ? "bg-primary/5 ring-inset ring-2 ring-primary" : ""
                                                        )}
                                                        onClick={() => {
                                                            setCurrentIdx(idx);
                                                            if (item.matchedStudent) setManualClass(item.matchedStudent.className);
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="relative h-12 w-12 rounded-lg overflow-hidden border shadow-sm shrink-0">
                                                                <img src={item.preview} className="object-cover h-full w-full" alt="" />
                                                                {item.status === 'saved' && (
                                                                    <div className="absolute inset-0 bg-emerald-600/60 flex items-center justify-center">
                                                                        <Check className="h-6 w-6 text-white" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[10px] font-black text-slate-700 truncate">{item.fileName}</p>
                                                                <div className="flex items-center gap-1.5 mt-1">
                                                                    {item.matchedStudent ? (
                                                                        <Badge className="bg-emerald-600 text-[8px] h-4 py-0 font-black">রোল {toBengaliNumber(item.matchedStudent.roll)} - {item.matchedStudent.studentNameBn}</Badge>
                                                                    ) : (
                                                                        <Badge variant="destructive" className="text-[8px] h-4 py-0 font-black">মিল নেই</Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button 
                                                                className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                                onClick={(e) => { e.stopPropagation(); setQueue(prev => prev.filter(it => it.id !== item.id)); }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                        <Button 
                                                            size="sm" 
                                                            disabled={item.status === 'saved' || item.status === 'saving' || !item.matchedStudent}
                                                            className="w-full h-7 text-[10px] font-black bg-emerald-600 hover:bg-emerald-700 shadow-sm"
                                                            onClick={(e) => { e.stopPropagation(); handleSaveIndividual(idx); }}
                                                        >
                                                            {item.status === 'saving' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                                                            এই ছবিটি সেভ করুন
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                            <div className="p-5 bg-blue-50 border-2 border-dashed border-blue-200 rounded-2xl flex items-start gap-3">
                                <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                                <div className="text-[11px] font-bold text-blue-900 space-y-1">
                                    <p>• ছবির নাম দিন: <strong>[শ্রেণি]_[রোল]</strong> (উদা: 6_01.jpg)</p>
                                    <p>• ছবির উপর মাউস দিয়ে ড্র্যাগ করে পজিশন ঠিক করুন।</p>
                                    <p>• <strong>সেভ করার সময়</strong> ছবি ৩০০x৩০০ পিক্সেল মাপে অপ্টিমাইজড হবে।</p>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-2 space-y-6">
                            {!currentImage ? (
                                <Card className="border-[4px] border-black rounded-[32px] p-20 text-center flex flex-col items-center justify-center bg-white shadow-xl opacity-50">
                                    <ImageIcon className="h-24 w-24 text-slate-200 mb-6" />
                                    <h2 className="text-2xl font-black text-slate-400">এডিটর ব্যবহারের জন্য ছবি নির্বাচন করুন</h2>
                                </Card>
                            ) : (
                                <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500">
                                    <Card className="border-[4px] border-black rounded-[32px] overflow-hidden shadow-2xl bg-white">
                                        <div className="bg-primary/5 p-4 border-b-[3px] border-black flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-primary rounded-xl text-white"><FilePen className="h-5 w-5" /></div>
                                                <div>
                                                    <h3 className="font-black text-slate-800">ছবি সম্পাদন</h3>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{currentImage.fileName}</p>
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="h-8 font-black" onClick={() => handleUpdateItem({ brightness: 100, contrast: 100, bgColor: 'transparent', cropArea: {x: 0, y: 0, scale: 1} })}>
                                                <RotateCcw className="h-3.5 w-3.5 mr-1" /> রিসেট
                                            </Button>
                                        </div>
                                        <CardContent className="p-8">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
                                                <div className="flex flex-col items-center space-y-4">
                                                    <div 
                                                        className="relative aspect-square w-full max-w-[320px] rounded-2xl border-4 border-black overflow-hidden bg-slate-100 shadow-xl cursor-move select-none"
                                                        onMouseDown={handleMouseDown}
                                                        onMouseMove={handleMouseMove}
                                                        onMouseUp={handleMouseUp}
                                                        onMouseLeave={handleMouseUp}
                                                        onWheel={handleWheel}
                                                    >
                                                        <img 
                                                            src={currentImage.preview} 
                                                            className="w-full h-full object-contain pointer-events-none" 
                                                            style={{
                                                                filter: `brightness(${currentImage.brightness}%) contrast(${currentImage.contrast}%)`,
                                                                transform: `translate(${currentImage.cropArea.x}px, ${currentImage.cropArea.y}px) scale(${currentImage.cropArea.scale})`,
                                                                backgroundColor: currentImage.bgColor === 'transparent' ? '#f1f5f9' : currentImage.bgColor,
                                                                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                                                            }}
                                                            alt="" 
                                                        />
                                                        <div className="absolute inset-0 border-2 border-primary/30 pointer-events-none flex items-center justify-center">
                                                            <div className="w-full h-0.5 bg-primary/20 absolute" />
                                                            <div className="h-full w-0.5 bg-primary/20 absolute" />
                                                        </div>
                                                        <div className="absolute bottom-3 left-3 bg-primary text-white text-[8px] px-2 py-0.5 rounded-full font-black shadow-lg">১:১ স্কোয়ার মোড</div>
                                                    </div>

                                                    <div className="grid grid-cols-3 gap-2 w-full max-w-[320px]">
                                                        <Button variant="outline" size="sm" className="h-8 text-[10px] font-black" onClick={() => handleUpdateItem({ cropArea: { ...currentImage.cropArea, scale: Math.max(0.1, currentImage.cropArea.scale - 0.1) }})}><Scissors className="h-3 w-3 mr-1" /> ছোট</Button>
                                                        <Button variant="outline" size="sm" className="h-8 text-[10px] font-black" onClick={() => handleUpdateItem({ cropArea: { ...currentImage.cropArea, scale: Math.min(5, currentImage.cropArea.scale + 0.1) }})}><Maximize2 className="h-3 w-3 mr-1" /> বড়</Button>
                                                        <Button variant="outline" size="sm" className="h-8 text-[10px] font-black" onClick={() => handleUpdateItem({ cropArea: { x: 0, y: 0, scale: 1 }})}><RotateCcw className="h-3 w-3 mr-1" /> ফিট</Button>
                                                    </div>

                                                    <div className="w-full max-w-[320px] space-y-4 pt-2">
                                                        <div className="space-y-2">
                                                            <Label className="text-[9px] font-black uppercase text-slate-500 flex items-center gap-1"><Palette className="h-3 w-3" /> ব্যাকগ্রাউন্ড কালার</Label>
                                                            <div className="flex gap-2 justify-between bg-slate-50 p-2 rounded-lg border">
                                                                {['transparent', '#ffffff', '#3b82f6', '#1e40af', '#dc2626'].map(color => (
                                                                    <button 
                                                                        key={color} 
                                                                        className={cn("h-6 w-6 rounded-full border-2 transition-all", currentImage.bgColor === color ? "border-primary scale-110 shadow-md" : "border-slate-300")} 
                                                                        style={{ backgroundColor: color === 'transparent' ? '#f1f5f9' : color }}
                                                                        onClick={() => handleUpdateItem({ bgColor: color })}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                        <Button variant="secondary" className="w-full h-8 text-[10px] font-black" onClick={() => toast({ title: "সতর্কতা", description: "উন্নত ব্যাকগ্রাউন্ড রিমুভ ফিচারটি লোড হচ্ছে..." })}>
                                                            <Eraser className="h-3 w-3 mr-1" /> ব্যাকগ্রাউন্ড রিমুভ (AI)
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="space-y-6">
                                                    <div className="space-y-4">
                                                        <h4 className="font-black text-sm text-primary flex items-center gap-2 border-b pb-2"><Sliders className="h-4 w-4" /> এডজাস্টমেন্ট</h4>
                                                        <div className="space-y-5">
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between items-center"><Label className="text-xs font-black">উজ্জ্বলতা</Label><span className="text-xs font-black">{toBengaliNumber(currentImage.brightness)}%</span></div>
                                                                <Slider value={[currentImage.brightness]} min={50} max={150} step={1} onValueChange={([v]) => handleUpdateItem({ brightness: v })} />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <div className="flex justify-between items-center"><Label className="text-xs font-black">কন্ট্রাস্ট</Label><span className="text-xs font-black">{toBengaliNumber(currentImage.contrast)}%</span></div>
                                                                <Slider value={[currentImage.contrast]} min={50} max={150} step={1} onValueChange={([v]) => handleUpdateItem({ contrast: v })} />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Separator />
                                                    <div className="space-y-4">
                                                        <h4 className="font-black text-sm text-primary flex items-center gap-2 border-b pb-2"><Users className="h-4 w-4" /> শিক্ষার্থীর সাথে সংযোগ</h4>
                                                        <div className="space-y-3">
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[10px] font-black uppercase text-slate-500">সেভ নাম (শ্রেণি_রোল)</Label>
                                                                <Input 
                                                                    value={currentImage.fileName} 
                                                                    onChange={e => handleNameChange(e.target.value)}
                                                                    className="h-9 border-2 font-black text-xs"
                                                                    placeholder="উদা: 6_01"
                                                                />
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[10px] font-black uppercase text-slate-500">১. শ্রেণি নির্বাচন</Label>
                                                                <Select value={manualClass} onValueChange={setManualClass}>
                                                                    <SelectTrigger className="h-9 border-2 font-bold"><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
                                                                    <SelectContent className="font-kalpurush">{Object.entries(classNamesMap).map(([k, v]) => <SelectItem key={k} value={k}>{v} শ্রেণি</SelectItem>)}</SelectContent>
                                                                </Select>
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <Label className="text-[10px] font-black uppercase text-slate-500">২. শিক্ষার্থী নির্বাচন</Label>
                                                                <Select 
                                                                    value={currentImage.matchedStudent?.id || ""} 
                                                                    onValueChange={(val) => handleUpdateItem({ matchedStudent: allStudents.find(s => s.id === val) || null, status: 'matched' })}
                                                                    disabled={!manualClass}
                                                                >
                                                                    <SelectTrigger className="h-9 border-2 font-bold"><SelectValue placeholder="শিক্ষার্থী" /></SelectTrigger>
                                                                    <SelectContent className="font-kalpurush max-h-[250px]">{studentsFilteredByClass.map(s => <SelectItem key={s.id} value={s.id}>রোল {toBengaliNumber(s.roll)} - {s.studentNameBn}</SelectItem>)}</SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                        {currentImage.matchedStudent && (
                                                            <div className="p-3 bg-emerald-50 border-2 border-emerald-200 rounded-xl flex items-center gap-3 animate-in slide-in-from-right-2">
                                                                <Avatar className="h-10 w-10 border-2 border-white shadow-sm shrink-0"><AvatarImage src={currentImage.matchedStudent.photoUrl} /><AvatarFallback>S</AvatarFallback></Avatar>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-black text-slate-900 leading-none text-xs">{currentImage.matchedStudent.studentNameBn}</p>
                                                                    <p className="text-[9px] font-bold text-emerald-700 mt-1">{classNamesMap[currentImage.matchedStudent.className]} শ্রেণি, রোল- {toBengaliNumber(currentImage.matchedStudent.roll)}</p>
                                                                </div>
                                                                <Badge className="bg-emerald-600 text-[8px] font-black">মিল আছে</Badge>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="p-8 bg-slate-50 border-t-[3px] border-black flex justify-between gap-4">
                                            <Button variant="outline" className="h-14 flex-1 font-black text-lg border-2" onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0}>পূর্ববর্তী</Button>
                                            <Button className="h-14 flex-[2] font-black text-xl shadow-2xl gap-2 bg-emerald-600 hover:bg-emerald-700" disabled={currentImage.status === 'saving' || !currentImage.matchedStudent} onClick={() => handleSaveIndividual(currentIndex)}>
                                                {currentImage.status === 'saving' ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : <Save className="h-6 w-6 mr-2" />} সংরক্ষণ ও প্রোফাইলে যুক্ত করুন
                                            </Button>
                                            <Button variant="outline" className="h-14 w-14 shrink-0 font-black border-2" onClick={() => setCurrentIdx(prev => Math.min(queue.length - 1, prev + 1))} disabled={currentIndex === queue.length - 1}><ArrowRight className="h-6 w-6" /></Button>
                                        </CardFooter>
                                    </Card>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
