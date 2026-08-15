'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Header } from '@/components/Header';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useFirestore } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Printer, ArrowLeft, Settings2, Type, Info, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const toBengaliNumber = (str: string | number | undefined | null) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

export default function CustomPadPage() {
    const db = useFirestore();
    const { schoolInfo, isLoading: isSchoolInfoLoading } = useSchoolInfo();

    const [isClient, setIsClient] = useState(false);
    
    // Customization Settings
    const [customSettings, setCustomSettings] = useState({
        watermarkOpacity: 0.05,
        borderStyle: 'border-b-4',
        fontSize: 20,
        headerPadding: 'pb-4'
    });

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient || isSchoolInfoLoading) {
        return <div className="flex items-center justify-center min-h-screen bg-gray-100 font-kalpurush">লোড হচ্ছে...</div>;
    }
    
    const issueDate = toBengaliNumber(format(new Date(), "d MMMM, yyyy", { locale: bn }));

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#F6F7F9] font-kalpurush">
            <Header />
            <main className="flex-1 p-4 md:p-8 no-print pb-40">
                <div className="max-w-[1400px] mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <Link href="/documents">
                            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                        </Link>
                        <div>
                            <h1 className="text-2xl font-black text-primary">প্রতিষ্ঠানের প্যাড (Letterhead)</h1>
                            <p className="text-sm text-muted-foreground">ডকুমেন্ট লিখে সরাসরি প্রিন্ট করুন</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        {/* Sidebar Customization - Left */}
                        <div className="space-y-6">
                            <Card className="shadow-lg border-2 border-primary/10">
                                <CardHeader className="bg-primary/5 border-b">
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Settings2 className="h-5 w-5 text-primary" /> টেমপ্লেট কাস্টমাইজেশন (লাইভ)
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="font-bold text-xs flex items-center gap-2">
                                                    স্কুল লোগো জলছাপ (Opacity)
                                                </Label>
                                                <select 
                                                    className="w-full h-9 rounded-md border-2 border-slate-200 px-3 text-xs font-bold focus:border-primary outline-none"
                                                    value={customSettings.watermarkOpacity.toString()} 
                                                    onChange={(e) => setCustomSettings(prev => ({ ...prev, watermarkOpacity: parseFloat(e.target.value) }))}
                                                >
                                                    <option value="0.05">৫% (হালকা)</option>
                                                    <option value="0.1">১০% (স্পষ্ট)</option>
                                                    <option value="0.15">১৫% (গাঢ়)</option>
                                                    <option value="0">জলছাপ বন্ধ</option>
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label className="font-bold text-xs flex items-center gap-2">
                                                    হেডার বর্ডার ডিজাইন
                                                </Label>
                                                <select 
                                                    className="w-full h-9 rounded-md border-2 border-slate-200 px-3 text-xs font-bold focus:border-primary outline-none"
                                                    value={customSettings.borderStyle} 
                                                    onChange={(e) => setCustomSettings(prev => ({ ...prev, borderStyle: e.target.value }))}
                                                >
                                                    <option value="border-b-4">সলিড (Solid)</option>
                                                    <option value="border-b-8 border-double">ডাবল (Double)</option>
                                                    <option value="border-b-2 border-dashed">ড্যাশ (Dashed)</option>
                                                    <option value="border-none">বর্ডার নেই</option>
                                                </select>
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <Label className="font-bold text-xs flex items-center gap-2">
                                                        <Type className="h-4 w-4" /> ফন্ট সাইজ (Font Size)
                                                    </Label>
                                                    <Badge variant="outline" className="font-black h-5">{toBengaliNumber(customSettings.fontSize)}px</Badge>
                                                </div>
                                                <Slider 
                                                    value={[customSettings.fontSize]} 
                                                    min={12} 
                                                    max={32} 
                                                    step={1} 
                                                    onValueChange={([v]) => setCustomSettings(prev => ({ ...prev, fontSize: v }))} 
                                                />
                                            </div>

                                            <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-start gap-2">
                                                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                                                <p className="text-[10px] font-bold text-blue-800 leading-tight">
                                                    ডান পাশের প্রিভিউতে সরাসরি টাইপ করুন। আপনি নাম এবং পদবিও নিজের মতো পরিবর্তন করতে পারবেন।
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Button onClick={() => window.print()} size="lg" className="w-full font-black h-14 text-xl shadow-xl">
                                <Printer className="mr-2 h-6 w-6" /> প্যাড প্রিন্ট করুন
                            </Button>
                        </div>

                        {/* Preview Column - Right */}
                        <div className="sticky top-24">
                            <h3 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-2 px-1">
                                <FileText className="h-4 w-4" /> লাইভ প্রিভিউ ও এডিটর
                            </h3>
                            <div className="bg-white border-4 border-black/10 rounded-xl overflow-hidden shadow-2xl origin-top-left scale-[0.45] sm:scale-[0.52] lg:scale-[0.55] xl:scale-[0.7] min-w-[210mm] min-h-[297mm]">
                                <LetterheadTemplate 
                                    schoolInfo={schoolInfo} 
                                    settings={customSettings} 
                                    issueDate={issueDate}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Hidden Printable Area */}
            <div className="hidden print:block printable-area">
                <LetterheadTemplate 
                    schoolInfo={schoolInfo} 
                    settings={customSettings} 
                    issueDate={issueDate}
                />
            </div>
        </div>
    );
}

function LetterheadTemplate({ schoolInfo, settings, issueDate }: any) {
    return (
        <div className="letterhead-container bg-white mx-auto relative text-black flex flex-col p-12 box-border font-kalpurush overflow-hidden">
            <style jsx global>{`
                @media print {
                    @page { size: A4 portrait; margin: 0.4in !important; }
                    .printable-area { padding: 0 !important; margin: 0 !important; border: none !important; width: 100% !important; }
                    .letterhead-container { width: 100% !important; min-height: 275mm !important; height: auto !important; padding: 10mm !important; }
                }
                @media screen {
                    .letterhead-container { width: 210mm; min-height: 297mm; }
                }
                .no-print-outline:focus { outline: none !important; background-color: rgba(59, 130, 246, 0.05); }
            `}</style>

            {/* Header Section */}
            <div className={cn(
                "w-full text-center mb-6 flex justify-between items-center px-4 border-black/20",
                settings.borderStyle,
                settings.headerPadding
            )}>
                <div className="w-24 h-24 relative shrink-0">
                    {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" fill className="object-contain" />}
                </div>
                <div className="flex-grow text-center px-4">
                    <p className="text-xl font-bold text-[#2d572c] mb-1">প্রধান শিক্ষকের কার্যালয়</p>
                    <h1 className="text-4xl font-black text-[#2d572c] mb-1 leading-tight">{schoolInfo.name}</h1>
                    <p className="text-sm font-bold text-gray-700">{schoolInfo.address} | স্থাপিত: ২০১৯ ইং</p>
                    <p className="text-[11px] font-bold text-gray-600 mt-1">
                        EIIN: {toBengaliNumber(schoolInfo.eiin)} | মোবাইলঃ ০১৭১৭৫৭৬০৩০
                    </p>
                </div>
                <div className="w-24 h-24 shrink-0"></div>
            </div>

            <div className="flex justify-between font-bold text-base mb-8 px-4">
                <span contentEditable={true} suppressContentEditableWarning={true} className="no-print-outline px-1">স্মারক নং: বিপৌউবি/......................</span>
                <span contentEditable={true} suppressContentEditableWarning={true} className="no-print-outline px-1">তারিখ: {issueDate} ইং</span>
            </div>

            {/* Watermark */}
            {schoolInfo.logoUrl && settings.watermarkOpacity > 0 && (
                <div 
                    className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none"
                    style={{ opacity: settings.watermarkOpacity }}
                >
                    <Image src={schoolInfo.logoUrl} alt="Watermark" width={450} height={450} />
                </div>
            )}

            {/* Main Body - Fully Editable */}
            <main 
                className="relative z-10 flex-grow text-justify leading-relaxed px-6 text-slate-900 no-print-outline"
                style={{ fontSize: `${settings.fontSize}px` }}
                contentEditable={true}
                suppressContentEditableWarning={true}
            >
                <p>আপনার ডকুমেন্টের বিষয়বস্তু এখানে লিখুন...</p>
            </main>

            {/* Footer / Signature - Fully Editable */}
            <footer className="relative z-10 px-6 pb-10 flex justify-end mt-20">
                <div className="text-center min-w-[250px]">
                    <div className="border-t-2 border-black pt-2">
                        <div contentEditable={true} suppressContentEditableWarning={true} className="no-print-outline font-black text-xl mb-0.5 min-h-[1.5em] empty:before:content-['[নাম_লিখুন]'] empty:before:text-gray-300"></div>
                        <div contentEditable={true} suppressContentEditableWarning={true} className="no-print-outline font-bold text-lg text-gray-700 min-h-[1.2em] empty:before:content-['[পদবি_লিখুন]'] empty:before:text-gray-300">প্রধান শিক্ষক</div>
                        <p className="font-bold text-gray-600 text-sm">{schoolInfo.name}</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}