'use client';

import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, FilePlus } from 'lucide-react';

export default function DocumentsPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-80">
        <Card>
            <CardHeader>
                <CardTitle>ডকুমেন্ট</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader>
                            <CardTitle>प्रत्यয়ন পত্র</CardTitle>
                            <CardDescription>শিক্ষার্থীদের জন্য প্রশংসাপত্র বা প্রত্যয়ন পত্র জেনারেট করুন।</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <p className="text-sm text-muted-foreground">
                               प्रत्यয়ন পত্র তৈরি করতে, শিক্ষার্থী তালিকা থেকে নির্দিষ্ট শিক্ষার্থীকে বেছে নিন এবং তার প্রোফাইল থেকে "प्रत्यয়ন পত্র" অপশনটি নির্বাচন করুন।
                           </p>
                        </CardContent>
                         <CardFooter>
                            <Link href="/student-list" className="w-full">
                                <Button className="w-full">
                                    শিক্ষার্থী তালিকা দেখুন
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>
                     <Card>
                        <CardHeader>
                            <CardTitle>খালি প্যাড</CardTitle>
                            <CardDescription>প্রতিষ্ঠানের প্যাডে কাস্টম ডকুমেন্ট তৈরি ও প্রিন্ট করুন।</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <p className="text-sm text-muted-foreground">
                               যেকোনো ধরনের কাস্টম চিঠি বা ডকুমেন্ট তৈরি করতে প্রতিষ্ঠানের প্যাড ব্যবহার করুন।
                           </p>
                        </CardContent>
                         <CardFooter>
                            <Link href="/documents/custom-pad" className="w-full">
                                <Button className="w-full">
                                    প্যাড খুলুন
                                    <FilePlus className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>প্রবেশ পত্র</CardTitle>
                            <CardDescription>পরীক্ষার জন্য শিক্ষার্থীদের প্রবেশ পত্র জেনারেট করুন।</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <p className="text-sm text-muted-foreground">
                               পরীক্ষা এবং শ্রেণি নির্বাচন করে সকল শিক্ষার্থীর জন্য একসাথে প্রবেশপত্র তৈরি ও প্রিন্ট করুন।
                           </p>
                        </CardContent>
                         <CardFooter>
                            <Link href="/documents/admit-card" className="w-full">
                                <Button className="w-full">
                                    প্রবেশ পত্র তৈরি করুন
                                    <FilePlus className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        </CardFooter>
                    </Card>
                </div>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
