'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Eye, CheckCircle, XCircle, Trash2, Loader2, Phone, Calendar, UserPlus, Filter } from 'lucide-react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const classNamesMap: Record<string, string> = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

export default function AdmissionsManagementPage() {
    const db = useFirestore();
    const { user, hasPermission } = useAuth();
    const { toast } = useToast();
    
    const [applications, setApplications] = useState<AdmissionApplication[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedApp, setSelectedUser] = useState<AdmissionApplication | null>(null);
    const [isApproveOpen, setIsApproveOpen] = useState(false);
    const [rollNumber, setRollNumber] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [filterClass, setFilterClass] = useState<string>('all');

    const canManageAdmissions = hasPermission('manage:admissions');

    const fetchApplications = async () => {
        if (!db) return;
        setIsLoading(true);
        try {
            const data = await getAdmissionApplications(db);
            setApplications(data);
        } catch (e) {
            console.error(e);
        }
        setIsLoading(false);
    };

    useEffect(() => {
        if (db && user) fetchApplications();
    }, [db, user]);

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
            setIsApproveOpen(false);
            setSelectedUser(null);
            setRollNumber('');
            fetchApplications();
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

    if (!canManageAdmissions) {
        return (
            <div className="min-h-screen bg-slate-100 font-kalpurush">
                <Header />
                <main className="p-8 text-center">
                    <p className="text-xl text-red-600 font-bold">আপনার এই পেজটি দেখার অনুমতি নেই।</p>
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
                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-muted-foreground" />
                                <Select value={filterClass} onValueChange={setFilterClass}>
                                    <SelectTrigger className="w-40 bg-white shadow-sm"><SelectValue placeholder="শ্রেণি ফিল্টার" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">সকল আবেদন</SelectItem>
                                        {Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="p-20 text-center italic text-muted-foreground">লোড হচ্ছে...</div>
                        ) : filteredApps.length === 0 ? (
                            <div className="p-20 text-center text-muted-foreground">কোনো নতুন আবেদন পাওয়া যায়নি।</div>
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
                                                    <p className="text-xs font-bold text-emerald-700 flex items-center gap-1 mt-1"><Phone className="h-3 w-3" /> {app.guardianMobile}</p>
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
                                                        <Button variant="outline" size="sm" className="h-8 w-8" onClick={() => setSelectedUser(app)}><Eye className="h-4 w-4" /></Button>
                                                        {app.status === 'pending' && (
                                                            <Button variant="default" size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" onClick={() => { setSelectedUser(app); setIsApproveOpen(true); }}><CheckCircle className="h-4 w-4 mr-1" /> ভর্তি</Button>
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

            {/* View Details Dialog */}
            <Dialog open={!!selectedApp && !isApproveOpen} onOpenChange={(o) => !o && setSelectedUser(null)}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto font-kalpurush">
                    {selectedApp && (
                        <>
                            <DialogHeader className="flex-row items-center gap-4">
                                <Image src={selectedApp.photoUrl || 'https://picsum.photos/seed/1/200/200'} alt="Photo" width={80} height={80} className="rounded-lg border shadow-sm object-cover" />
                                <div>
                                    <DialogTitle className="text-2xl font-black">{selectedApp.studentNameBn}</DialogTitle>
                                    <DialogDescription className="text-md font-bold text-primary">{classNamesMap[selectedApp.className]} শ্রেণিতে ভর্তির আবেদন</DialogDescription>
                                </div>
                            </DialogHeader>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6 border-t mt-4">
                                <div className="space-y-4">
                                    <h4 className="font-black text-sm text-muted-foreground uppercase border-b pb-1">ব্যক্তিগত তথ্য</h4>
                                    <div className="space-y-2 text-sm font-bold">
                                        <p className="flex justify-between"><span>নাম (ইংরেজি):</span> <span className="text-slate-800">{selectedApp.studentNameEn || '-'}</span></p>
                                        <p className="flex justify-between"><span>জন্ম তারিখ:</span> <span className="text-slate-800">{selectedApp.dob ? format(selectedApp.dob, 'dd MMM yyyy', { locale: bn }) : '-'}</span></p>
                                        <p className="flex justify-between"><span>লিঙ্গ:</span> <span className="text-slate-800">{selectedApp.gender === 'male' ? 'পুরুষ' : 'মহিলা'}</span></p>
                                        <p className="flex justify-between"><span>জন্ম নিবন্ধন:</span> <span className="text-slate-800">{selectedApp.birthRegNo || '-'}</span></p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="font-black text-sm text-muted-foreground uppercase border-b pb-1">অভিভাবক ও যোগাযোগ</h4>
                                    <div className="space-y-2 text-sm font-bold">
                                        <p className="flex justify-between"><span>পিতার নাম:</span> <span className="text-slate-800">{selectedApp.fatherNameBn}</span></p>
                                        <p className="flex justify-between"><span>মাতার নাম:</span> <span className="text-slate-800">{selectedApp.motherNameBn}</span></p>
                                        <p className="flex justify-between"><span>মোবাইল:</span> <span className="text-emerald-700">{selectedApp.guardianMobile}</span></p>
                                        <p className="flex justify-between"><span>ঠিকানা:</span> <span className="text-slate-800">{selectedApp.presentVillage || '-'}, {selectedApp.presentUpazila || '-'}</span></p>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter className="sticky bottom-0 bg-white border-t pt-4">
                                {selectedApp.status === 'pending' ? (
                                    <div className="flex gap-4 w-full">
                                        <Button variant="outline" className="flex-1 font-bold text-rose-600" onClick={() => setSelectedUser(null)}>বন্ধ করুন</Button>
                                        <Button className="flex-1 font-black bg-emerald-600 hover:bg-emerald-700" onClick={() => setIsApproveOpen(true)}>ভর্তি নিশ্চিত করুন</Button>
                                    </div>
                                ) : (
                                    <Button className="w-full font-bold" variant="outline" onClick={() => setSelectedUser(null)}>বন্ধ করুন</Button>
                                )}
                            </DialogFooter>
                        </>
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
