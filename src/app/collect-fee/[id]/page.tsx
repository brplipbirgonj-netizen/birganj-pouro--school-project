'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CreditCard } from 'lucide-react';

export default function CollectFeePage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params?.id as string;
  const { toast } = useToast();

  const [amount, setAmount] = useState('');
  const [feeType, setFeeType] = useState('টিউশন ফি');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) {
      toast({ title: 'ত্রুটি', description: 'টাকার পরিমাণ দিন', variant: 'destructive' });
      return;
    }
    setLoading(true);
    // Fee collection logic placeholder
    setTimeout(() => {
      setLoading(false);
      toast({ title: 'সফল', description: 'ফি সফলভাবে গ্রহণ করা হয়েছে' });
      router.push('/accounts');
    }, 1000);
  };

  return (
    <div className="container mx-auto p-4 max-w-lg">
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> ফিরে যান
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            ফি গ্রহণ করুন (শিক্ষার্থী ID: {studentId})
          </CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="feeType">ফি-এর প্রকার</Label>
              <Input
                id="feeType"
                value={feeType}
                onChange={(e) => setFeeType(e.target.value)}
                placeholder="যেমন: টিউশন ফি, পরীক্ষার ফি"
                required
              />
            </div>
            <div>
              <Label htmlFor="amount">পরিমাণ (টাকা)</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="০.০০"
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'প্রসেসিং...' : 'জমা নিন'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
