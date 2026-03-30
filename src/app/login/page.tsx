
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
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4">
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
                                width={80}
                                height={80}
                                className="rounded-full object-contain"
                            />
                        )}
                        <h1 className="text-2xl font-bold text-primary">{schoolInfo.name}</h1>
                    </>
                )}
            </div>
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardDescription>লগইন বা সাইন আপ করুন</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="teacher-login">
                        <TabsList className="inline-flex h-auto flex-wrap items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
                            <TabsTrigger value="teacher-login">শিক্ষক লগইন</TabsTrigger>
                            <TabsTrigger value="admin-login">এডমিন লগইন</TabsTrigger>
                            <TabsTrigger value="signup">সাইন আপ</TabsTrigger>
                        </TabsList>

                        <TabsContent value="teacher-login">
                            <form onSubmit={(e) => { e.preventDefault(); handleAuthAction('signIn', 'teacher'); }} className="space-y-4 pt-4">
                                <AuthFormFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                                <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? 'লোড হচ্ছে...' : 'শিক্ষক হিসেবে লগইন'}</Button>
                            </form>
                        </TabsContent>
                        
                        <TabsContent value="admin-login">
                           <form onSubmit={(e) => { e.preventDefault(); handleAuthAction('signIn', 'admin'); }} className="space-y-4 pt-4">
                                <AuthFormFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                                <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? 'লোড হচ্ছে...' : 'এডমিন হিসেবে লগইন'}</Button>
                            </form>
                        </TabsContent>
                        
                        <TabsContent value="signup">
                            <form onSubmit={(e) => { e.preventDefault(); handleAuthAction('signUp', 'teacher'); }} className="space-y-4 pt-4">
                                <AuthFormFields email={email} password={password} setEmail={setEmail} setPassword={setPassword} />
                                <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? 'লোড হচ্ছে...' : 'সাইন আপ'}</Button>
                            </form>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
