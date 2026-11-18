'use client';
import { ReactNode, useMemo, useEffect, useState } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, Firestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, setLogLevel } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { Loader2 } from 'lucide-react';

import { firebaseConfig } from './config';
import { FirebaseProvider } from './provider';

/**
 * Singleton instances to prevent re-initialization.
 * Using global window object to persist across HMR reloads in development.
 */
declare global {
  interface Window {
    __FIREBASE_APP__?: FirebaseApp;
    __FIREBASE_FIRESTORE__?: Firestore;
    __FIREBASE_AUTH__?: Auth;
  }
}

function getFirebaseInstances() {
  if (typeof window === 'undefined') return null;

  if (!window.__FIREBASE_APP__) {
    if (!getApps().length) {
      window.__FIREBASE_APP__ = initializeApp(firebaseConfig);
    } else {
      window.__FIREBASE_APP__ = getApp();
    }
  }

  const app = window.__FIREBASE_APP__;

  if (!window.__FIREBASE_FIRESTORE__) {
    /**
     * Modern Firestore Initialization (SDK v11+)
     * Using persistentMultipleTabManager so multiple tabs can safely
     * share IndexedDB cache without throwing target/ownership assertion errors.
     */
    try {
      window.__FIREBASE_FIRESTORE__ = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
        experimentalForceLongPolling: true,
      });
    } catch {
      window.__FIREBASE_FIRESTORE__ = initializeFirestore(app, {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true,
      });
    }

    // Set log level to 'silent' to reduce noise in console
    setLogLevel('silent');
  }

  if (!window.__FIREBASE_AUTH__) {
    window.__FIREBASE_AUTH__ = getAuth(app);
  }

  return {
    app: window.__FIREBASE_APP__,
    firestore: window.__FIREBASE_FIRESTORE__,
    auth: window.__FIREBASE_AUTH__,
  };
}

export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const instances = useMemo(() => getFirebaseInstances(), []);

  return (
    <FirebaseProvider
      app={instances?.app ?? null}
      firestore={instances?.firestore ?? null}
      auth={instances?.auth ?? null}
    >
      {children}
    </FirebaseProvider>
  );
}
