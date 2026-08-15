'use client';
import { ReactNode, useMemo, useEffect, useState } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, Firestore, enableIndexedDbPersistence, setLogLevel } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

import { firebaseConfig } from './config';
import { FirebaseProvider } from './provider';

// Singleton instances to prevent re-initialization
let app: FirebaseApp | undefined;
let firestore: Firestore | undefined;
let auth: Auth | undefined;

// Initialize Firebase on the client-side only
if (typeof window !== 'undefined') {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  // Use initializeFirestore with force long polling for better workstation compatibility
  // and stability in flaky internet environments.
  firestore = initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });

  // Suppress connectivity warnings in console to avoid confusion when working offline
  setLogLevel('error');

  auth = getAuth(app);
}

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && firestore && !isInitialized) {
      // Enable offline persistence with a safe check
      enableIndexedDbPersistence(firestore)
        .catch((err) => {
          if (err.code === 'failed-precondition') {
            console.warn('Firestore persistence failed: Multiple tabs open');
          } else if (err.code === 'unimplemented') {
            console.warn('Firestore persistence failed: Browser not supported');
          }
        })
        .finally(() => {
          setIsInitialized(true);
        });
    } else {
        setIsInitialized(true);
    }
  }, [isInitialized]);

  const instances = useMemo(() => {
    if (!app || !firestore || !auth) {
        return null;
    }
    return { app, firestore, auth };
  }, []);

  if (!instances || !isInitialized) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-indigo-50 font-kalpurush">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-black text-primary animate-pulse">সার্ভারের সাথে সংযোগ স্থাপন করা হচ্ছে...</p>
        </div>
      </div>
    );
  }

  return (
    <FirebaseProvider
      app={instances.app}
      firestore={instances.firestore}
      auth={instances.auth}
    >
      {children}
    </FirebaseProvider>
  );
}
