'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { useAuth } from '@/hooks/useAuth';
import { getAdmissionApplications, approveAndEnrollStudent, deleteApplication, AdmissionApplication } from '@/lib/admission-data';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Eye, CheckCircle, XCircle, Trash2, Loader2, Phone, Calendar, UserPlus, Filter, MapPin, User, Users, GraduationCap, FileText, MessageCircle, MessageSquareDashed, RefreshCw } from 'lucide-react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const classNamesMap: Record<string, string> = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };
const religionMapBn: Record<string, string> = {
    'islam': 'ইসলাম', 'hinduism': 'হিন্দু', 'buddhism': 'বৌদ্ধ', 'christianity': 'খ্রিস্টান', 'other': 'অন্যান্য'
};

export default function AdmissionsManagementPage() {
    const db = useFirestore();
    const { user, hasPermission, loading: authLoading } = useAuth();
    const { toast } = useToast();
    
    const [isMounted, setIsMounted] = useState(false);
    const [applications, setApplications] = useState<AdmissionApplication[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedApp, setSelectedApp] = useState<AdmissionApplication | null>(null);
    const [isApproveOpen, setIsApproveOpen] = useState(false);
    const [rollNumber, setRollNumber] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [filterClass, setFilterClass] = useState<string>('all');

    const canManageAdmissions = useMemo(() => hasPermission('manage:admissions'), [hasPermission]);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const fetchApplications = useCallback(async (showToast = false) => {
        if (!db || !user || !canManageAdmissions) return;
        setIsLoading(true);
        try {
            const data = await getAdmissionApplications(db);
            setApplications(data);
            if (showToast) toast({ title: 'আপডেট সম্পন্ন', description: 'নতুন আবেদনগুলো লোড করা হয়েছে।' });
        } catch (e) {
            console.error("Fetch Applications Error:", e);
        } finally {
            setIsLoading(false);
        }
    }, [db, user, canManageAdmissions, toast]);

    useEffect(() => {
        if (isMounted && !authLoading) {
            if (user && canManageAdmissions) {
                fetchApplications();
            } else {
                setIsLoading(false);
            }
        }
    }, [isMounted, authLoading, user, canManageAdmissions, fetchApplications]);

    const filteredApps = useMemo(() => {
        if (filterClass === 'all') return applications;
        return applications.filter(a => a.className === filterClass);
    }, [applications, filterClass]);

    const handleApprove = async () => {
        if (!db || !selectedApp || !rollNumber) return;
        setIsProcessing(true);
        try {
            await approveAndEnrollStudent(db, selectedApp, parseInt(rollNumber));
            toast({ title: 'সফল', description: 'শিক্ষার্থীকে সফলভাবে ভর্তি করা হয়েছে।' });
            
            // Send confirmation SMS
            const msg = `সম্মানিত অভিভাবক, অভিনন্দন! বীরগঞ্জ পৌর উচ্চ বিদ্যালয়ে আপনার সন্তান ${selectedApp.studentNameBn}-এর ভর্তি প্রক্রিয়া সফলভাবে সম্পন্ন হয়েছে। রোল নম্বর: ${rollNumber.toLocaleString('bn-BD')}। ধন্যবাদ। - প্রধান শিক্ষক`;
            const encodedMsg = encodeURIComponent(msg);
            const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
            const separator = isIOS ? '&' : '?';
            
            setIsApproveOpen(false);
            const mobile = selectedApp.guardianMobile;
            setSelectedApp(null);
            setRollNumber('');
            fetchApplications();

            // Open SMS drafter after a small delay to allow UI updates
            setTimeout(() => {
                window.location.href = `sms:${mobile}${separator}body=${encodedMsg}`;
            }, 500);

        } catch (e) {
            toast({ variant: 'destructive', title: 'ত্রুটি', description: 'ভর্তি প্রক্রিয়া সম্পন্ন করা যায়নি।' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!db) return;
        try {
            await deleteApplication(db, id);
            toast({ title: 'আবেদন মুছে ফেলা হয়েছে' });
            fetchApplications();
        } catch (e) {}
    };

    const handleSendDirectSMS = (mobile: string, studentName: string) => {
        const msg = `সম্মানিত অভিভাবক, বীরগঞ্জ পৌর উচ্চ বিদ্যালয়ে আপনার সন্তান ${studentName}-এর অনলাইন ভর্তি আবেদনটি আমরা পেয়েছি। আবেদনের বিষয়ে বিস্তারিত তথ্যের জন্য বিদ্যালয়ে যোগাযোগ করার অনুরোধ করা হলো। ধন্যবাদ। - প্রধান শিক্ষক`;
        const encodedMsg = encodeURIComponent(msg);
        const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
        const separator = isIOS ? '&' : '?';
        window.location.href = `sms:${mobile}${separator}body=${encodedMsg}`;
    };

    const handleSendWhatsApp = (mobile: string, studentName: string) => {
        const msg = `সম্মানিত অভিভাবক, বীরগঞ্জ পৌর উচ্চ বিদ্যালয়ে আপনার সন্তান ${studentName}-এর অনলাইন ভর্তি আবেদনটি আমরা পেয়েছি।`;
        const encodedMsg = encodeURIComponent(msg);
        let cleanNum = mobile.replace(/[^\d]/g, '');
        if (cleanNum.startsWith('0')) cleanNum = '88' + cleanNum;
        if (!cleanNum.startsWith('88')) cleanNum = '880' + cleanNum;
        window.open(`https://wa.me/${cleanNum}?text=${encodedMsg}`, '_blank');
    };

    if (!isMounted) {
        return null;
    }

    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-100 flex items-center justify-center font-kalpurush">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-muted-foreground font-bold">অথেনটিকেশন যাচাই করা হচ্ছে...</p>
                </div>
            </div>
        );
    }

    if (!user || !canManageAdmissions) {
        return (
            <div className="min-h-screen bg-slate-100 font-kalpurush">
                <Header />
                <main className="p-8 text-center mt-20">
                    <Card className="max-w-md mx-auto p-10 border-2 border-red-200">
                        <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-black text-red-900 mb-2">প্রবেশাধিকার নেই</h2>
                        <p className="text-slate-600 font-bold">আপনার এই পেজটি দেখার অনুমতি নেই। দয়া করে এডমিনের সাথে যোগাযোগ করুন।</p>
                    </Card>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-kalpurush">
            <Header />
            <main className="flex-1 p-4 md:p-8 pb-40">
                <Card className="max-w-[1400px] mx-auto border-none shadow-xl">
                    <CardHeader className="bg-primary/5 border-b pb-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-3xl font-black text-primary flex items-center gap-2"><UserPlus className="h-8 w-8" /> অনলাইন ভর্তি আবেদনসমূহ</CardTitle>
                                <CardDescription>নতুন আবেদনগুলো যাচাই করে ভর্তি নিশ্চিত করুন</CardDescription>
                            </div>
                            <div className="flex items-center gap-3">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="bg-white shadow-sm font-bold gap-2"
                                    onClick={() => fetchApplications(true)}
                                    disabled={isLoading}
                                >
                                    <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                                    রিফ্রেশ
                                </Button>
                                <div className="flex items-center gap-2 border-l pl-3">
                                    <Filter className="h-4 w-4 text-muted-foreground" />
                                    <Select value={filterClass} onValueChange={setFilterClass}>
                                        <SelectTrigger className="w-40 bg-white shadow-sm font-bold"><SelectValue placeholder="শ্রেণি ফিল্টার" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">সকল আবেদন</SelectItem>
                                            {Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="p-20 text-center italic text-muted-foreground flex flex-col items-center gap-4">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                <span>আবেদনগুলো লোড হচ্ছে...</span>
                            </div>
                        ) : filteredApps.length === 0 ? (
                            <div className="p-20 text-center text-muted-foreground font-bold">কোনো নতুন আবেদন পাওয়া যায়নি।</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-muted/50">
                                        <TableRow>
                                            <TableHead className="font-bold">আবেদন আইডি ও তারিখ</TableHead>
                                            <TableHead className="font-bold">ছবি</TableHead>
                                            <TableHead className="font-bold">শিক্ষার্থীর নাম</TableHead>
                                            <TableHead className="font-bold text-center">শ্রেণি</TableHead>
                                            <TableHead className="font-bold">পিতা-মাতার নাম ও মোবাইল</TableHead>
                                            <TableHead className="font-bold text-center">অবস্থা</TableHead>
                                            <TableHead className="font-bold text-right">কার্যক্রম</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredApps.map(app => (
                                            <TableRow key={app.id} className="hover:bg-accent/5">
                                                <TableCell>
                                                    <p className="font-black text-xs text-primary">{app.applicationId}</p>
                                                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(app.appliedAt, 'PPP', { locale: bn })}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="h-10 w-10 rounded border overflow-hidden bg-muted">
                                                        {app.photoUrl ? <Image src={app.photoUrl} alt="Photo" width={40} height={40} className="object-cover h-full w-full" /> : <Loader2 className="h-4 w-4 m-3 animate-spin" />}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <p className="font-black text-slate-800">{app.studentNameBn}</p>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">{app.studentNameEn || '-'}</p>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="secondary" className="font-black px-3">{classNamesMap[app.className]} শ্রেণি</Badge>
                                                    {app.group && <p className="text-[9px] font-bold text-primary mt-1">{app.group === 'science' ? 'বিজ্ঞান' : app.group === 'arts' ? 'মানবিক' : 'ব্যবসায় শিক্ষা'}</p>}
                                                </TableCell>
                                                <TableCell>
                                                    <p className="text-xs font-bold text-slate-700">পিতা: {app.fatherNameBn}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-xs font-bold text-emerald-700 flex items-center gap-1"><Phone className="h-3 w-3" /> {app.guardianMobile}</p>
                                                        <div className="flex gap-1">
                                                            <button 
                                                                onClick={() => handleSendDirectSMS(app.guardianMobile, app.studentNameBn)}
                                                                className="text-blue-600 hover:text-blue-800"
                                                                title="SMS পাঠান"
                                                            >
                                                                <MessageSquareDashed className="h-3 w-3" />
                                                            </button>
                                                            <button 
                                                                onClick={() => handleSendWhatsApp(app.guardianMobile, app.studentNameBn)}
                                                                className="text-green-600 hover:text-green-800"
                                                                title="WhatsApp পাঠান"
                                                            >
                                                                <MessageCircle className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={cn(
                                                        "font-black text-[10px] px-3",
                                                        app.status === 'pending' ? 'bg-amber-100 text-amber-800' : 
                                                        app.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                    )}>
                                                        {app.status === 'pending' ? 'অপেক্ষমান' : app.status === 'approved' ? 'ভর্তি সম্পন্ন' : 'বাতিল'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="outline" size="sm" className="h-8 w-8" onClick={() => setSelectedApp(app)}><Eye className="h-4 w-4" /></Button>
                                                        {app.status === 'pending' && (
                                                            <Button variant="default" size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setSelectedApp(app); setIsApproveOpen(true); }}><CheckCircle className="h-4 w-4 mr-1" /> ভর্তি</Button>
                                                        )}
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500" onClick={() => handleDelete(app.id)}><Trash2 className="h-4 w-4" /></Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </main>

            {/* View Full Details Dialog */}
            <Dialog open={!!selectedApp && !isApproveOpen} onOpenChange={(o) => !o && setSelectedApp(null)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto font-kalpurush p-0 border-none shadow-2xl">
                    {selectedApp && (
                        <div className="flex flex-col h-full overflow-hidden">
                            <DialogHeader className="p-6 bg-primary text-white sticky top-0 z-10 flex-row items-center gap-6">
                                <div className="h-24 w-24 rounded-lg border-2 border-white/50 bg-white p-1 overflow-hidden shrink-0 shadow-lg">
                                    <Image src={selectedApp.photoUrl || 'https://picsum.photos/seed/student/200/200'} alt="Photo" width={96} height={96} className="object-cover h-full w-full rounded" />
                                </div>
                                <div className="flex-1">
                                    <DialogTitle className="text-3xl font-black">{selectedApp.studentNameBn}</DialogTitle>
                                    <DialogDescription className="text-white/90 text-lg font-bold">
                                        {classNamesMap[selectedApp.className]} শ্রেণিতে ভর্তির আবেদন - {selectedApp.academicYear}
                                    </DialogDescription>
                                    <div className="flex gap-4 mt-2">
                                        <Badge variant="outline" className="bg-white/10 text-white border-white/30 font-black">{selectedApp.applicationId}</Badge>
                                        <Badge variant="outline" className="bg-white/10 text-white border-white/30 font-black uppercase">{selectedApp.studentNameEn || 'ENGLISH NAME MISSING'}</Badge>
                                    </div>
                                </div>
                            </DialogHeader>

                            <div className="p-8 space-y-10">
                                {/* Section 1: Institutional & Personal */}
                                <section className="space-y-4">
                                    <h4 className="text-xl font-black text-primary border-b-2 border-primary/20 pb-2 flex items-center gap-2">
                                        <GraduationCap className="h-6 w-6" /> ১. প্রাতিষ্ঠানিক ও ব্যক্তিগত তথ্য
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-sm font-bold">
                                        <p className="p-3 bg-slate-50 rounded-lg border">ভর্তির শ্রেণি: <span className="text-primary font-black ml-1">{classNamesMap[selectedApp.className]} শ্রেণি</span></p>
                                        <p className="p-3 bg-slate-50 rounded-lg border">পূর্ববর্তী বিদ্যালয়: <span className="text-slate-800 font-black ml-1">{selectedApp.previousSchool || '-'}</span></p>
                                        <p className="p-3 bg-slate-50 rounded-lg border">বিভাগ ও ঐচ্ছিক: <span className="text-slate-800 font-black ml-1">{selectedApp.group ? (selectedApp.group === 'science' ? 'বিজ্ঞান' : selectedApp.group === 'arts' ? 'মানবিক' : 'ব্যবসায় শিক্ষা') : 'সাধারণ'}, {selectedApp.optionalSubject || '-'}</span></p>
                                        <p className="p-3 bg-slate-50 rounded-lg border">জন্ম তারিখ: <span className="text-slate-800 font-black ml-1">{selectedApp.dob ? format(new Date(selectedApp.dob), 'dd MMMM yyyy', { locale: bn }) : '-'}</span></p>
                                        <p className="p-3 bg-slate-50 rounded-lg border">জন্ম নিবন্ধন: <span className="text-slate-800 font-black ml-1">{selectedApp.birthRegNo || '-'}</span></p>
                                        <p className="p-3 bg-slate-50 rounded-lg border">লিঙ্গ ও ধর্ম: <span className="text-slate-800 font-black ml-1">{selectedApp.gender === 'male' ? 'পুরুষ' : 'মহিলা'}, {religionMapBn[selectedApp.religion?.toLowerCase() || ''] || selectedApp.religion}</span></p>
                                    </div>
                                </section>

                                {/* Section 2: Parents' Info */}
                                <section className="space-y-4">
                                    <h4 className="text-xl font-black text-primary border-b-2 border-primary/20 pb-2 flex items-center gap-2">
                                        <Users className="h-6 w-6" /> ২. পিতা ও মাতার তথ্য
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2">
                                            <p className="text-xs text-blue-700 uppercase font-black tracking-widest mb-2 border-l-4 border-blue-500 pl-2">পিতার তথ্য</p>
                                            <p>নাম (বাংলা): <span className="font-black text-slate-800">{selectedApp.fatherNameBn}</span></p>
                                            <p>নাম (ইংরেজি): <span className="font-black text-slate-700 uppercase">{selectedApp.fatherNameEn || '-'}</span></p>
                                            <p>এনআইডি নম্বর: <span className="font-black text-slate-800">{selectedApp.fatherNid || '-'}</span></p>
                                        </div>
                                        <div className="p-4 bg-purple-50/50 rounded-xl border border-purple-100 space-y-2">
                                            <p className="text-xs text-purple-700 uppercase font-black tracking-widest mb-2 border-l-4 border-purple-500 pl-2">মাতার তথ্য</p>
                                            <p>নাম (বাংলা): <span className="font-black text-slate-800">{selectedApp.motherNameBn}</span></p>
                                            <p>নাম (ইংরেজি): <span className="font-black text-slate-700 uppercase">{selectedApp.motherNameEn || '-'}</span></p>
                                            <p>এনআইডি নম্বর: <span className="font-black text-slate-800">{selectedApp.motherNid || '-'}</span></p>
                                        </div>
                                    </div>
                                </section>

                                {/* Section 3: Contacts & Addresses */}
                                <section className="space-y-4">
                                    <h4 className="text-xl font-black text-primary border-b-2 border-primary/20 pb-2 flex items-center gap-2">
                                        <MapPin className="h-6 w-6" /> ৩. ঠিকানা ও যোগাযোগ
                                    </h4>
                                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 mb-6 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <Phone className="h-6 w-6 text-emerald-700" />
                                            <div>
                                                <p className="text-xs text-emerald-700 font-black uppercase">অভিভাবকের মোবাইল নম্বর</p>
                                                <p className="text-2xl font-black text-slate-800">{selectedApp.guardianMobile}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button 
                                                variant="outline" 
                                                className="bg-white text-blue-600 border-blue-200 hover:bg-blue-50 font-bold"
                                                onClick={() => handleSendDirectSMS(selectedApp.guardianMobile, selectedApp.studentNameBn)}
                                            >
                                                <MessageSquareDashed className="mr-2 h-4 w-4" /> SMS পাঠান
                                            </Button>
                                            <Button 
                                                variant="outline" 
                                                className="bg-white text-green-600 border-green-200 hover:bg-green-50 font-bold"
                                                onClick={() => handleSendWhatsApp(selectedApp.guardianMobile, selectedApp.studentNameBn)}
                                            >
                                                <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-2 text-sm">
                                            <p className="font-black text-slate-500 uppercase text-[10px] tracking-widest mb-1">বর্তমান ঠিকানা</p>
                                            <div className="p-4 bg-white border rounded-lg shadow-sm font-bold leading-relaxed">
                                                {selectedApp.presentVillage}, {selectedApp.presentUnion || 'N/A'}<br />
                                                {selectedApp.presentPostOffice}, {selectedApp.presentUpazila}<br />
                                                {selectedApp.presentDistrict}
                                            </div>
                                        </div>
                                        <div className="space-y-2 text-sm">
                                            <p className="font-black text-slate-500 uppercase text-[10px] tracking-widest mb-1">স্থায়ী ঠিকানা</p>
                                            <div className="p-4 bg-white border rounded-lg shadow-sm font-bold leading-relaxed">
                                                {selectedApp.permanentVillage || selectedApp.presentVillage}, {selectedApp.permanentUnion || selectedApp.presentUnion || 'N/A'}<br />
                                                {selectedApp.permanentPostOffice || selectedApp.presentPostOffice}, {selectedApp.permanentUpazila || selectedApp.presentUpazila}<br />
                                                {selectedApp.permanentDistrict || selectedApp.presentDistrict}
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>

                            <DialogFooter className="p-6 bg-slate-50 border-t sticky bottom-0">
                                <div className="flex gap-4 w-full">
                                    <Button variant="outline" className="flex-1 h-12 font-black border-slate-300" onClick={() => setSelectedApp(null)}>বন্ধ করুন</Button>
                                    {selectedApp.status === 'pending' ? (
                                        <Button className="flex-1 h-12 font-black bg-emerald-600 hover:bg-emerald-700 shadow-xl" onClick={() => setIsApproveOpen(true)}>
                                            ভর্তি নিশ্চিত করুন
                                        </Button>
                                    ) : (
                                        <Button variant="ghost" disabled className="flex-1 h-12 font-black bg-slate-200 text-slate-500">
                                            {selectedApp.status === 'approved' ? 'ভর্তি সম্পন্ন হয়েছে' : 'আবেদন বাতিল করা হয়েছে'}
                                        </Button>
                                    )}
                                </div>
                            </DialogFooter>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Approve Enrollment Dialog */}
            <Dialog open={isApproveOpen} onOpenChange={setIsApproveOpen}>
                <DialogContent className="max-w-md font-kalpurush">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black flex items-center gap-2 text-emerald-700"><CheckCircle /> ভর্তি চূড়ান্তকরণ</DialogTitle>
                        <DialogDescription className="font-bold">শিক্ষার্থীকে মূল তালিকায় যুক্ত করার জন্য রোল নম্বর নির্ধারণ করুন।</DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-4">
                        <div className="p-4 bg-muted/30 rounded-lg border text-sm space-y-1">
                            <p><strong>শিক্ষার্থীর নাম:</strong> {selectedApp?.studentNameBn}</p>
                            <p><strong>ভর্তির শ্রেণি:</strong> {selectedApp ? classNamesMap[selectedApp.className] : ''} শ্রেণি</p>
                            <p><strong>শিক্ষাবর্ষ:</strong> {selectedApp?.academicYear}</p>
                        </div>
                        <div className="space-y-2">
                            <Label className="font-black text-primary">রোল নম্বর প্রদান করুন (ইংরেজি অংকে)</Label>
                            <Input type="number" placeholder="উদা: ১" value={rollNumber} onChange={e => setRollNumber(e.target.value)} autoFocus className="h-12 text-lg font-black" />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setIsApproveOpen(false)} disabled={isProcessing}>বাতিল</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700 font-black h-12 px-8" onClick={handleApprove} disabled={!rollNumber || isProcessing}>
                            {isProcessing ? <Loader2 className="animate-spin" /> : 'এপ্রুভ ও এনরোল করুন'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
