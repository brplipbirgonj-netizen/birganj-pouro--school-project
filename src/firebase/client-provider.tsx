'use client';
import { ReactNode, useMemo } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, Firestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

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

  auth = getAuth(app);

  // Enable offline persistence
  enableIndexedDbPersistence(firestore).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support persistence
      console.warn('Firestore persistence failed: Browser not supported');
    }
  });
}

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const instances = useMemo(() => {
    if (!app || !firestore || !auth) {
        return null;
    }
    return { app, firestore, auth };
  }, []);

  if (!instances) {
    return <>{children}</>;
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
