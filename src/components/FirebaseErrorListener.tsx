'use client';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Firestore Permission Error',
        description:
          'দুঃখিত, আপনার এই কাজটি করার অনুমতি নেই। বিস্তারিত জানতে প্রধান শিক্ষকের সাথে যোগাযোগ করুন।',
        duration: 9000,
      });
      // Throw the error to surface it to the Next.js development overlay
      if (process.env.NODE_ENV === 'development') {
        throw error;
      }
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  return null;
}
