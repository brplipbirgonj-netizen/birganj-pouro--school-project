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
import { UserPlus } from 'lucide-react';

function AuthFormFields({ email, password, setEmail, setPassword }: {
    email: string;
    password: string;
    setEmail: (value: string) => void;
    setPassword: (value: string) => void;
}) {
    return (
        <>
            <div className="space-y-2">
                <Label htmlFor="email">ইমেইল</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
                <Label htmlFor="password">পাসওয়ার্ড</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
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

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-indigo-50 p-4 font-kalpurush">
            <div className="mb-8 flex flex-col items-center gap-4 text-center">
                {isSchoolInfoLoading ? (
                    <>
                        <Skeleton className="h-20 w-20 rounded-full" />
                        <Skeleton className="h-8 w-64" />
                    </>
                ) : (
                    <>
                        {schoolInfo.logoUrl && (
                            <Image
                                src={schoolInfo.logoUrl}
                                alt="School Logo"
                                width={100}
                                height={100}
                                className="rounded-full object-contain bg-white p-1 shadow-lg"
                            />
                        )}
                        <h1 className="text-3xl font-black text-primary">{schoolInfo.name}</h1>
                        <p className="text-muted-foreground font-bold italic">কেন্দ্রীয় ডিজিটাল ম্যানেজমেন্ট পোর্টাল</p>
                    </>
                )}
            </div>
            
            <Card className="w-full max-w-md shadow-2xl border-none">
                <CardHeader className="bg-primary/5 border-b text-center">
                    <CardTitle className="text-xl">প্রবেশ করুন</CardTitle>
                    <CardDescription className="font-bold">সিস্টেম ব্যবহারের জন্য আপনার ইমেইল ও পাসওয়ার্ড দিন</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                    <Tabs defaultValue="teacher-login">
                        <TabsList className="grid w-full grid-cols-3 bg-muted p-1">
                            <TabsTrigger value="teacher-login" className="font-bold text-xs">শিক্ষক</TabsTrigger>
                            <TabsTrigger value="admin-login" className="font-bold text-xs">এডমিন</TabsTrigger>
                            <TabsTrigger value="signup" className="font-bold text-xs">নিবন্ধন</TabsTrigger>
                        </TabsList>

                        <TabsContent value="teacher-login">
                            <form onSubmit={(e) => { e.preventDefault(); handleAuthAction('signIn', 'teacher'); }} className="space-y-4 pt-4">
                                <AuthFormFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                                <Button type="submit" className="w-full h-11 font-black" disabled={isLoading}>{isLoading ? 'লোড হচ্ছে...' : 'লগইন করুন'}</Button>
                            </form>
                        </TabsContent>
                        
                        <TabsContent value="admin-login">
                           <form onSubmit={(e) => { e.preventDefault(); handleAuthAction('signIn', 'admin'); }} className="space-y-4 pt-4">
                                <AuthFormFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                                <Button type="submit" className="w-full h-11 font-black" disabled={isLoading}>{isLoading ? 'লোড হচ্ছে...' : 'এডমিন লগইন'}</Button>
                            </form>
                        </TabsContent>
                        
                        <TabsContent value="signup">
                            <form onSubmit={(e) => { e.preventDefault(); handleAuthAction('signUp', 'teacher'); }} className="space-y-4 pt-4">
                                <AuthFormFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                                <Button type="submit" className="w-full h-11 font-black" disabled={isLoading}>{isLoading ? 'লোড হচ্ছে...' : 'অ্যাকাউন্ট তৈরি করুন'}</Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            <div className="mt-8 w-full max-w-md">
                <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-300"></span></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-indigo-50 px-2 text-muted-foreground font-black">নতুন শিক্ষার্থী হলে</span></div>
                </div>
                <Link href="/admission" className="mt-4 block">
                    <Button variant="outline" className="w-full h-14 border-primary text-primary hover:bg-primary/5 font-black text-lg shadow-sm">
                        <UserPlus className="mr-2 h-6 w-6" /> অনলাইন ভর্তি আবেদন
                    </Button>
                </Link>
            </div>
        </div>
    );
}
