'use client';
import { ReactNode, useMemo } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, Firestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache, setLogLevel } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

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

  const app = window.__FIREBASE_APP__!;

  if (!window.__FIREBASE_FIRESTORE__) {
    /**
     * Modern Firestore Initialization (SDK v11+)
     * - persistentMultipleTabManager: একাধিক ট্যাব নিরাপদে ব্যবহার করতে পারবে
     * - experimentalAutoDetectLongPolling: WebSocket/Long-polling স্বয়ংক্রিয়ভাবে নির্বাচন করবে
     *   (ForceLongPolling এর বদলে AutoDetect ব্যবহার করলে ca9 assertion কমে)
     */
    try {
      window.__FIREBASE_FIRESTORE__ = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
        experimentalAutoDetectLongPolling: true,
      });
    } catch {
      // fallback: IndexedDB না পেলে memory cache
      try {
        window.__FIREBASE_FIRESTORE__ = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } catch {
        window.__FIREBASE_FIRESTORE__ = initializeFirestore(app, {
          localCache: memoryLocalCache(),
        });
      }
    }

    // Console noise কমাতে silent mode
    setLogLevel('silent');
  }

  if (!window.__FIREBASE_AUTH__) {
    window.__FIREBASE_AUTH__ = getAuth(app);
  }

  return {
    app: window.__FIREBASE_APP__!,
    firestore: window.__FIREBASE_FIRESTORE__!,
    auth: window.__FIREBASE_AUTH__!,
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
