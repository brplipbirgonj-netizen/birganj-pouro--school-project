'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/results');
  }, [router]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-background">
      <p>এই পৃষ্ঠাটি সরানো হয়েছে। আপনাকে ফলাফল পৃষ্ঠায় পাঠানো হচ্ছে...</p>
    </div>
  );
}
