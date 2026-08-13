'use client';
import {
  createContext,
  ReactNode,
  useContext,
  useMemo,
} from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';

import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

type FirebaseContextType = {
  app: FirebaseApp | null;
  firestore: Firestore | null;
  auth: Auth | null;
};

const FirebaseContext = createContext<FirebaseContextType>({
  app: null,
  firestore: null,
  auth: null,
});

type FirebaseProviderProps = {
  children: ReactNode;
  app: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
};

export function FirebaseProvider({
  children,
  app,
  firestore,
  auth,
}: FirebaseProviderProps) {
  const value = useMemo(
    () => ({
      app,
      firestore,
      auth,
    }),
    [app, firestore, auth]
  );
  return (
    <FirebaseContext.Provider value={value}>
      {children}
      <FirebaseErrorListener />
    </FirebaseContext.Provider>
  );
}

export function useFirebase() {
  return useContext(FirebaseContext);
}

export function useFirebaseApp() {
  return useContext(FirebaseContext)?.app;
}

export function useAuth() {
  return useContext(FirebaseContext)?.auth;
}

export function useFirestore() {
  return useContext(FirebaseContext)?.firestore;
}
