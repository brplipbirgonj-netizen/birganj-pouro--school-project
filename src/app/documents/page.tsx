'use client';

import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, FilePlus, IdCard, FileText, FileBadge, Award, Grid3X3, Contact } from 'lucide-react';

export default function DocumentsPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 font-kalpurush">
      <Header />
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 pb-80">
        <div className="mb-4">
            <h1 className="text-3xl font-black text-primary">অফিসিয়াল ডকুমেন্ট জেনারেটর</h1>
            <p className="text-muted-foreground">শিক্ষার্থীদের জন্য প্রয়োজনীয় কাগজপত্র তৈরি ও প্রিন্ট করুন</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* ID Card Card */}
            <Card className="border-2 border-primary/20 hover:border-primary/40 transition-all shadow-lg bg-white">
                <CardHeader className="bg-primary/5">
                    <CardTitle className="flex items-center gap-2">
                        <Contact className="h-6 w-6 text-primary" /> পরিচয়পত্র (ID Card)
                    </CardTitle>
                    <CardDescription>ছবিসহ প্রফেশনাল ডিজিটাল আইডি কার্ড</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                   <p className="text-sm text-muted-foreground leading-relaxed">
                        সকল শিক্ষার্থীর জন্য দৃষ্টিনন্দিত আইডি কার্ড জেনারেট করুন। এক পাতায় ৮টি কার্ড স্বয়ংক্রিয়ভাবে সাজানো হবে।
                   </p>
                </CardContent>
                 <CardFooter>
                    <Link href="/documents/id-card" className="w-full">
                        <Button className="w-full font-black text-md shadow-md">
                            জেনারেট করুন
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </CardFooter>
            </Card>

            {/* Admit Card Card */}
            <Card className="border-2 border-primary/10 hover:border-primary/30 transition-all shadow-md">
                <CardHeader className="bg-primary/5">
                    <CardTitle className="flex items-center gap-2">
                        <IdCard className="h-6 w-6 text-primary" /> প্রবেশ পত্র
                    </CardTitle>
                    <CardDescription>পরীক্ষার জন্য ডিজিটাল প্রবেশ পত্র</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                   <p className="text-sm text-muted-foreground leading-relaxed">
                        একক বা শ্রেণি অনুযায়ী সকল শিক্ষার্থীর জন্য লাইভ প্রিভিউ দেখে প্রবেশপত্র তৈরি ও প্রিন্ট করুন।
                   </p>
                </CardContent>
                 <CardFooter>
                    <Link href="/documents/admit-card" className="w-full">
                        <Button className="w-full font-bold">
                            জেনারেট করুন
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </CardFooter>
            </Card>

            {/* Seat Plan Card */}
            <Card className="border-2 border-indigo-100 hover:border-indigo-300 transition-all shadow-md">
                <CardHeader className="bg-indigo-50">
                    <CardTitle className="flex items-center gap-2 text-indigo-800">
                        <Grid3X3 className="h-6 w-6" /> আসন বিন্যাস (Seat Plan)
                    </CardTitle>
                    <CardDescription>বেঞ্চে লাগানোর জন্য সিট লেবেল</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                   <p className="text-sm text-muted-foreground leading-relaxed">
                        রোল নম্বর অনুযায়ী পরীক্ষার রুম এবং বেঞ্চের বিন্যাস স্বয়ংক্রিয়ভাবে তৈরি ও প্রিন্ট করার সুবিধা।
                   </p>
                </CardContent>
                 <CardFooter>
                    <Link href="/documents/seat-plan" className="w-full">
                        <Button className="w-full bg-indigo-700 hover:bg-indigo-800 font-bold">
                            জেনারেট করুন
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </CardFooter>
            </Card>

            {/* Testimonial Card */}
            <Card className="border-2 border-emerald-100 hover:border-emerald-300 transition-all shadow-md">
                <CardHeader className="bg-emerald-50">
                    <CardTitle className="flex items-center gap-2 text-emerald-800">
                        <FileBadge className="h-6 w-6" /> প্রত্যয়ন পত্র
                    </CardTitle>
                    <CardDescription>অধ্যয়নরত শিক্ষার্থীদের জন্য সনদ</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                   <p className="text-sm text-muted-foreground leading-relaxed">
                        শিক্ষার্থীর জন্য প্রফেশনাল প্রত্যয়ন পত্র তৈরি করুন। লাইভ প্রিভিউ ও কাস্টম বিবরণ এডিট সুবিধা সহ।
                   </p>
                </CardContent>
                 <CardFooter>
                    <Link href="/documents/testimonial" className="w-full">
                        <Button className="w-full bg-emerald-700 hover:bg-emerald-800 font-bold">
                            জেনারেট করুন
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </CardFooter>
            </Card>

            {/* Appreciation Card */}
            <Card className="border-2 border-blue-100 hover:border-blue-300 transition-all shadow-md">
                <CardHeader className="bg-blue-50">
                    <CardTitle className="flex items-center gap-2 text-blue-800">
                        <Award className="h-6 w-6" /> প্রশংসাপত্র
                    </CardTitle>
                    <CardDescription>শিক্ষার্থীদের জন্য চারিত্রিক সনদ</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                   <p className="text-sm text-muted-foreground leading-relaxed">
                        শিক্ষার্থীদের উজ্জ্বল ভবিষ্যৎ ও ভালো চরিত্রের প্রশংসাসূচক প্রফেশনাল প্রশংসাপত্র তৈরি করুন।
                   </p>
                </CardContent>
                 <CardFooter>
                    <Link href="/documents/appreciation" className="w-full">
                        <Button className="w-full bg-blue-700 hover:bg-blue-800 font-bold">
                            জেনারেট করুন
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </CardFooter>
            </Card>

            {/* TC Card */}
            <Card className="border-2 border-amber-100 hover:border-amber-300 transition-all shadow-md">
                <CardHeader className="bg-amber-50">
                    <CardTitle className="flex items-center gap-2 text-amber-800">
                        <FileText className="h-6 w-6" /> ছাড়পত্র (TC)
                    </CardTitle>
                    <CardDescription>স্থানান্তর বা ছাড়পত্র সনদ</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                   <p className="text-sm text-muted-foreground leading-relaxed">
                        বিদ্যালয় ত্যাগের কারণ ও ফলাফল উল্লেখ করে প্রফেশনাল ছাড়পত্র (Transfer Certificate) তৈরি করুন।
                   </p>
                </CardContent>
                 <CardFooter>
                    <Link href="/documents/tc" className="w-full">
                        <Button className="w-full bg-amber-700 hover:bg-amber-800 font-bold">
                            জেনারেট করুন
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </CardFooter>
            </Card>
            
            {/* Custom Pad Card */}
            <Card className="border-2 border-slate-200 hover:border-slate-400 transition-all shadow-md">
                <CardHeader className="bg-slate-50">
                    <CardTitle className="flex items-center gap-2 text-slate-800">
                        <FilePlus className="h-6 w-6" /> খালি প্যাড
                    </CardTitle>
                    <CardDescription>প্রতিষ্ঠানের লেটারহেড প্যাড</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                   <p className="text-sm text-muted-foreground leading-relaxed">
                       যেকোনো কাস্টম ডকুমেন্ট বা চিঠি সরাসরি প্যাডে লিখে প্রিন্ট করার সুবিধা।
                   </p>
                </CardContent>
                 <CardFooter>
                    <Link href="/documents/custom-pad" className="w-full">
                        <Button variant="outline" className="w-full font-bold">
                            প্যাড খুলুন
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </Link>
                </CardFooter>
            </Card>
        </div>
      </main>
    </div>
  );
}
