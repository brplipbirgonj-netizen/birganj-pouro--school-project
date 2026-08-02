
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { signIn, signUp } from '@/lib/auth';
import type { UserRole } from '@/lib/user';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { UserPlus, BookOpen } from 'lucide-react';

function AuthFormFields({ email, password, setEmail, setPassword }: {
    email: string;
    password: string;
    setEmail: (value: string) => void;
    setPassword: (value: string) => void;
}) {
    return (
        <>
            <div className="space-y-2">
                <Label htmlFor="email" className="font-bold text-xs">ইমেইল</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-10" />
            </div>
            <div className="space-y-2">
                <Label htmlFor="password" throws="font-bold text-xs">পাসওয়ার্ড</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-10" />
            </div>
        </>
    );
}

export default function LoginPage() {
    const { toast } = useToast();
    const router = useRouter();
    const { user, loading } = useAuth();
    const { schoolInfo, isLoading: isSchoolInfoLoading } = useSchoolInfo();
    
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            router.push('/');
        }
    }, [user, loading, router]);

    if(loading || user) {
        return <div className="flex min-h-screen items-center justify-center">লোড হচ্ছে...</div>
    }

    const handleAuthAction = async (action: 'signIn' | 'signUp', role: UserRole) => {
        setIsLoading(true);
        try {
            if (action === 'signIn') {
                const result = await signIn(email, password, role);
                if (result.success) {
                    toast({ title: 'লগইন সফল হয়েছে' });
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'লগইন ব্যর্থ হয়েছে',
                        description: result.error || 'ইমেইল বা পাসওয়ার্ড ভুল।',
                    });
                }
            } else {
                const result = await signUp(email, password);
                 if (result.success) {
                    toast({ title: 'সাইন আপ সফল হয়েছে', description: `আপনাকে একজন ${result.role} হিসেবে নিবন্ধন করা হয়েছে।` });
                } else {
                    toast({
                        variant: 'destructive',
                        title: 'সাইন আপ ব্যর্থ হয়েছে',
                        description: result.error || 'অনুগ্রহ করে পুনরায় চেষ্টা করুন।',
                    });
                }
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'একটি অপ্রত্যাশিত ত্রুটি ঘটেছে',
                description: error.message || 'সার্ভারে সংযোগ করা যাচ্ছে না।',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const ActionButtonRow = ({ role, action }: { role: UserRole, action: 'signIn' | 'signUp' }) => (
        <div className="flex flex-row gap-2 mt-6">
            <Link href="/public-results" className="flex-1">
                <Button variant="outline" type="button" className="w-full h-11 font-bold text-[10px] sm:text-xs px-1 border-primary/20 hover:bg-primary/5">
                    ফলাফল দেখুন
                </Button>
            </Link>
            <Button 
                type="submit" 
                className="flex-1 h-11 font-black text-[10px] sm:text-xs px-1 shadow-lg" 
                disabled={isLoading}
            >
                {isLoading ? '...' : (action === 'signIn' ? 'প্রবেশ করুন' : 'নিবন্ধন')}
            </Button>
            <Link href="/admission" className="flex-1">
                <Button variant="outline" type="button" className="w-full h-11 font-bold text-[10px] sm:text-xs px-1 border-primary/20 hover:bg-primary/5">
                    অনলাইন ভর্তি
                </Button>
            </Link>
        </div>
    );

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-indigo-50 p-4 font-kalpurush text-black">
            <div className="mb-6 flex flex-col items-center gap-0 text-center">
                {isSchoolInfoLoading ? (
                    <>
                        <Skeleton className="h-20 w-20 rounded-full" />
                        <Skeleton className="h-8 w-64" />
                    </>
                ) : (
                    <>
                        {schoolInfo.logoUrl && (
                            <div className="relative z-10 -mb-2">
                                <Image
                                    src={schoolInfo.logoUrl}
                                    alt="School Logo"
                                    width={90}
                                    height={90}
                                    className="rounded-full object-contain bg-white p-1 shadow-lg border-2 border-primary/20"
                                />
                            </div>
                        )}
                        
                        <div className="bg-[#2418ff] border-[5px] border-red-600 rounded-[2.5rem] px-8 py-6 flex flex-col items-center gap-0 shadow-[0_15px_30px_-5px_rgba(36,24,255,0.4)] animate-in zoom-in duration-500 transform hover:scale-[1.01] transition-transform relative z-0">
                            <h1 className="text-2xl sm:text-[45px] font-black text-white leading-none tracking-tighter mb-2 [text-shadow:2px_2px_4px_rgba(0,0,0,0.5)]">
                                {schoolInfo.name}
                            </h1>
                            <p className="text-white font-bold italic text-sm sm:text-xl leading-none opacity-95">
                                কেন্দ্রীয় ডিজিটাল ম্যানেজমেন্ট পোর্টাল
                            </p>
                        </div>
                    </>
                )}
            </div>
            
            <div className="w-full max-w-md space-y-6">
                <Card className="shadow-2xl border-2 border-white/50 overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b-2 border-primary/10 text-center py-3">
                        <CardTitle className="text-lg font-black text-primary">প্রবেশ করুন</CardTitle>
                        <CardDescription className="font-bold text-[11px] text-muted-foreground">সিস্টেম ব্যবহারের জন্য আপনার ইমেইল ও পাসওয়ার্ড দিন</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <Tabs defaultValue="teacher-login">
                            <TabsList className="grid w-full grid-cols-3 bg-muted p-1 mb-4">
                                <TabsTrigger value="teacher-login" className="font-bold text-xs h-8">শিক্ষক</TabsTrigger>
                                <TabsTrigger value="admin-login" className="font-bold text-xs h-8">এডমিন</TabsTrigger>
                                <TabsTrigger value="signup" className="font-bold text-xs h-8">নিবন্ধন</TabsTrigger>
                            </TabsList>

                            <TabsContent value="teacher-login" className="mt-0">
                                <form onSubmit={(e) => { e.preventDefault(); handleAuthAction('signIn', 'teacher'); }} className="space-y-4">
                                    <AuthFormFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                                    <ActionButtonRow role="teacher" action="signIn" />
                                </form>
                            </TabsContent>
                            
                            <TabsContent value="admin-login" className="mt-0">
                                <form onSubmit={(e) => { e.preventDefault(); handleAuthAction('signIn', 'admin'); }} className="space-y-4">
                                    <AuthFormFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                                    <ActionButtonRow role="admin" action="signIn" />
                                </form>
                            </TabsContent>
                            
                            <TabsContent value="signup" className="mt-0">
                                <form onSubmit={(e) => { e.preventDefault(); handleAuthAction('signUp', 'teacher'); }} className="space-y-4">
                                    <AuthFormFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                                    <ActionButtonRow role="teacher" action="signUp" />
                                </form>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                <div className="text-center">
                    <p className="text-[10px] font-bold text-muted-foreground opacity-60">© ২০২৬ {schoolInfo.name}। সর্বস্বত্ব সংরক্ষিত।</p>
                </div>
            </div>
        </div>
    );
}
