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
    FilePen
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

const classNamesMap: Record<string, string> = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': 'দশম' };

type ProcessingImage = {
    id: string;
    file: File;
    preview: string;
    matchedStudent: Student | null;
    status: 'pending' | 'matched' | 'unmatched' | 'saving' | 'saved' | 'error';
    processedDataUrl?: string;
    classId?: string;
    roll?: number;
};

export default function PhotoManagerPage() {
    const db = useFirestore();
    const { user } = useAuth();
    const { selectedYear } = useAcademicYear();
    const { toast } = useToast();
    
    const [isClient, setIsClient] = useState(false);
    const [queue, setQueue] = useState<ProcessingImage[]>([]);
    const [currentIndex, setCurrentIdx] = useState<number>(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [isFetchingStudents, setIsFetchingStudents] = useState(true);

    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    
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

    const parseFileName = (name: string): { classId: string | null; roll: number | null } => {
        const cleanName = name.replace(/\.[^/.]+$/, "");
        const match = cleanName.match(/(\d+)[_\-\s](\d+)/);
        if (match) {
            return { classId: match[1], roll: parseInt(match[2], 10) };
        }
        return { classId: null, roll: null };
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const newItems: ProcessingImage[] = files.map(file => {
            const { classId, roll } = parseFileName(file.name);
            let matchedStudent: Student | null = null;
            
            if (classId && roll) {
                matchedStudent = allStudents.find(s => s.className === classId && s.roll === roll) || null;
            }

            return {
                id: Math.random().toString(36).substr(2, 9),
                file,
                preview: URL.createObjectURL(file),
                matchedStudent,
                status: matchedStudent ? 'matched' : 'unmatched',
                classId: classId || undefined,
                roll: roll || undefined
            };
        });

        setQueue(prev => [...prev, ...newItems]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const applyFiltersAndDraw = useCallback(() => {
        if (!canvasRef.current || !currentImage) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const img = new window.Image();
        img.src = currentImage.preview;
        img.onload = () => {
            const targetSize = 512;
            canvas.width = targetSize;
            canvas.height = targetSize;

            let sx, sy, sw, sh;
            if (img.width > img.height) {
                sh = img.height;
                sw = img.height;
                sx = (img.width - sw) / 2;
                sy = 0;
            } else {
                sw = img.width;
                sh = img.width;
                sx = 0;
                sy = (img.height - sh) / 2;
            }

            ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
            ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetSize, targetSize);
            
            const processed = canvas.toDataURL('image/jpeg', 0.85);
            setQueue(prev => prev.map(item => 
                item.id === currentImage.id ? { ...item, processedDataUrl: processed } : item
            ));
        };
    }, [currentImage, brightness, contrast]);

    useEffect(() => {
        if (currentImage && currentImage.status !== 'saved') {
            applyFiltersAndDraw();
        }
    }, [currentImage?.id, brightness, contrast, applyFiltersAndDraw]);

    const handleSaveAndNext = async () => {
        if (!db || !currentImage || !currentImage.matchedStudent || !currentImage.processedDataUrl) return;

        const studentId = currentImage.matchedStudent.id;
        const dataUrl = currentImage.processedDataUrl;

        setQueue(prev => prev.map(item => item.id === currentImage.id ? { ...item, status: 'saving' } : item));

        try {
            await updateDoc(doc(db, 'students', studentId), {
                photoUrl: dataUrl,
                updatedAt: serverTimestamp()
            });

            toast({ title: 'ছবি সেভ হয়েছে', description: `${currentImage.matchedStudent.studentNameBn} এর প্রোফাইল আপডেট করা হয়েছে।` });
            
            setQueue(prev => prev.map(item => item.id === currentImage.id ? { ...item, status: 'saved' } : item));
            
            if (currentIndex < queue.length - 1) {
                setCurrentIdx(prev => prev + 1);
                setBrightness(100);
                setContrast(100);
            }
        } catch (e) {
            toast({ variant: 'destructive', title: 'ত্রুটি', description: 'ছবি সংরক্ষণ করা যায়নি।' });
            setQueue(prev => prev.map(item => item.id === currentImage.id ? { ...item, status: 'error' } : item));
        }
    };

    const handleRemoveFromQueue = (id: string) => {
        setQueue(prev => prev.filter(i => i.id !== id));
        if (currentIndex >= queue.length - 1 && currentIndex > 0) {
            setCurrentIdx(prev => prev - 1);
        }
    };

    const handleManualMatch = (studentId: string) => {
        if (!currentImage) return;
        const student = allStudents.find(s => s.id === studentId) || null;
        setQueue(prev => prev.map(item => 
            item.id === currentImage.id ? { ...item, matchedStudent: student, status: student ? 'matched' : 'unmatched' } : item
        ));
    };

    function toBengaliNumber(str: string | number | undefined | null) {
        if (!str && str !== 0) return '';
        const digits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
        return String(str).replace(/[0-9]/g, (w) => digits[parseInt(w, 10)]);
    }

    if (!isClient) return null;

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
                                        <Loader2 className={cn("h-5 w-5", isProcessing && "animate-spin")} /> কিউ (Queue)
                                    </CardTitle>
                                    <Badge className="font-black">{toBengaliNumber(queue.length)} টি ছবি</Badge>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <ScrollArea className="h-[600px]">
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
                                                            "p-3 flex items-center gap-3 cursor-pointer transition-all hover:bg-slate-50",
                                                            currentIndex === idx ? "bg-primary/5 ring-inset ring-2 ring-primary" : ""
                                                        )}
                                                        onClick={() => setCurrentIdx(idx)}
                                                    >
                                                        <div className="relative h-12 w-12 rounded-lg overflow-hidden border shadow-sm shrink-0">
                                                            <img src={item.preview} className="object-cover h-full w-full" alt="" />
                                                            {item.status === 'saved' && (
                                                                <div className="absolute inset-0 bg-emerald-600/60 flex items-center justify-center">
                                                                    <Check className="h-6 w-6 text-white" />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-[11px] font-black truncate">{item.file.name}</p>
                                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                                {item.matchedStudent ? (
                                                                    <Badge className="bg-emerald-600 text-[8px] h-4 py-0 font-black">রোল {toBengaliNumber(item.matchedStudent.roll)} - {item.matchedStudent.studentNameBn}</Badge>
                                                                ) : (
                                                                    <Badge variant="destructive" className="text-[8px] h-4 py-0 font-black">মিল নেই</Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button 
                                                            className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                                            onClick={(e) => { e.stopPropagation(); handleRemoveFromQueue(item.id); }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
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
                                    <p>• ছবির নাম দিন: <strong>[শ্রেণি]_[রোল]</strong></p>
                                    <p>• উদাহরণ: <strong>6_01.jpg</strong> (৬ষ্ঠ শ্রেণি রোল ১)</p>
                                    <p>• এডিটর থেকে সরাসরি ১:১ (বর্গাকার) ক্রপ হয়ে শিক্ষার্থীর প্রোফাইলে সেভ হবে।</p>
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
                                                <div className="p-2 bg-primary rounded-xl text-white">
                                                    <FilePen className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-slate-800">ছবি সম্পাদন করুন</h3>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{currentImage.file.name}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="sm" className="h-8 font-black" onClick={() => { setBrightness(100); setContrast(100); }}><RotateCcw className="h-3.5 w-3.5 mr-1" /> রিসেট</Button>
                                            </div>
                                        </div>
                                        <CardContent className="p-8">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                                                <div className="flex flex-col items-center space-y-4">
                                                    <div className="relative aspect-square w-full max-w-[320px] rounded-2xl border-4 border-black overflow-hidden bg-slate-100 shadow-xl ring-8 ring-slate-50">
                                                        <canvas ref={canvasRef} className="w-full h-full object-cover hidden" />
                                                        {currentImage.processedDataUrl ? (
                                                            <img src={currentImage.processedDataUrl} className="w-full h-full object-cover" alt="Processed" />
                                                        ) : (
                                                            <img src={currentImage.preview} className="w-full h-full object-cover" alt="Original" />
                                                        )}
                                                        <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md text-white text-[9px] px-2 py-0.5 rounded-full font-black border border-white/20">
                                                            PREVIEW 512x512
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <Badge className="bg-primary px-3">বর্তমান ছবি</Badge>
                                                        <span className="text-[10px] font-black text-muted-foreground italic">(বর্গাকার ক্রপ করা হবে)</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-8">
                                                    <div className="space-y-6">
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between items-center">
                                                                <Label className="font-black text-xs uppercase text-slate-600">উজ্জ্বলতা (Brightness)</Label>
                                                                <span className="font-black text-primary text-xs">{toBengaliNumber(brightness)}%</span>
                                                            </div>
                                                            <Slider value={[brightness]} min={50} max={150} step={1} onValueChange={([v]) => setBrightness(v)} />
                                                        </div>
                                                        <div className="space-y-3">
                                                            <div className="flex justify-between items-center">
                                                                <Label className="font-black text-xs uppercase text-slate-600">কন্ট্রাস্ট (Contrast)</Label>
                                                                <span className="font-black text-primary text-xs">{toBengaliNumber(contrast)}%</span>
                                                            </div>
                                                            <Slider value={[contrast]} min={50} max={150} step={1} onValueChange={([v]) => setContrast(v)} />
                                                        </div>
                                                    </div>

                                                    <Separator />

                                                    <div className="space-y-4">
                                                        <Label className="font-black text-sm text-primary flex items-center gap-2"><Users className="h-4 w-4" /> শিক্ষার্থীর সাথে সংযোগ</Label>
                                                        
                                                        {currentImage.matchedStudent ? (
                                                            <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-2xl flex items-center gap-4 animate-in slide-in-from-right-2">
                                                                <Avatar className="h-12 w-12 border-2 border-white shadow-md">
                                                                    <AvatarImage src={currentImage.matchedStudent.photoUrl} />
                                                                    <AvatarFallback>S</AvatarFallback>
                                                                </Avatar>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="font-black text-slate-900 leading-none">{currentImage.matchedStudent.studentNameBn}</p>
                                                                    <p className="text-[10px] font-bold text-emerald-700 mt-1">{classNamesMap[currentImage.matchedStudent.className]} শ্রেণি, রোল- {toBengaliNumber(currentImage.matchedStudent.roll)}</p>
                                                                </div>
                                                                <Badge className="bg-emerald-600 font-black">ম্যাচড</Badge>
                                                            </div>
                                                        ) : (
                                                            <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl space-y-3">
                                                                <p className="text-xs font-bold text-rose-800 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> স্বয়ংক্রিয়ভাবে কাউকে পাওয়া যায়নি</p>
                                                                <Select onValueChange={handleManualMatch}>
                                                                    <SelectTrigger className="bg-white border-2">
                                                                        <SelectValue placeholder="শিক্ষার্থী নির্বাচন করুন..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent className="max-h-[200px]">
                                                                        {allStudents.map(s => (
                                                                            <SelectItem key={s.id} value={s.id} className="font-bold">রোল {s.roll} - {s.studentNameBn}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                        <CardFooter className="p-8 bg-slate-50 border-t-[3px] border-black flex justify-between gap-4">
                                            <Button variant="outline" className="h-14 flex-1 font-black text-lg border-2" onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))} disabled={currentIndex === 0}>পূর্ববর্তী ছবি</Button>
                                            <Button 
                                                className="h-14 flex-[2] font-black text-xl shadow-2xl gap-2" 
                                                disabled={currentImage.status === 'saving' || currentImage.status === 'saved' || !currentImage.matchedStudent}
                                                onClick={handleSaveAndNext}
                                            >
                                                {currentImage.status === 'saving' ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
                                                সেভ করুন ও পরবর্তী
                                            </Button>
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
