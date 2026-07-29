
'use client';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  Firestore,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export interface ProxyClass {
  id: string;
  date: string; // YYYY-MM-DD
  academicYear: string;
  className: string;
  periodIndex: number;
  originalTeacher: string;
  proxyTeacher: string;
  subject: string;
  assignedBy?: string;
  assignedAt?: Date;
}

export type NewProxyData = Omit<ProxyClass, 'id' | 'assignedAt'>;

const PROXY_COLLECTION = 'proxyClasses';

export const getProxyClasses = async (db: Firestore, date: string, academicYear: string): Promise<ProxyClass[]> => {
  const q = query(
    collection(db, PROXY_COLLECTION),
    where("date", "==", date),
    where("academicYear", "==", academicYear)
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        assignedAt: data.assignedAt instanceof Timestamp ? data.assignedAt.toDate() : new Date(data.assignedAt),
      } as ProxyClass;
    });
  } catch (e) {
    console.error("Error fetching proxies:", e);
    return [];
  }
};

export const saveProxyClass = async (db: Firestore, proxy: NewProxyData) => {
  const docId = `${proxy.date}_${proxy.className}_${proxy.periodIndex}`;
  const docRef = doc(db, PROXY_COLLECTION, docId);
  const dataToSave = {
    ...proxy,
    assignedAt: serverTimestamp(),
  };

  return setDoc(docRef, dataToSave, { merge: true }).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: PROXY_COLLECTION,
      operation: 'write',
      requestResourceData: dataToSave,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });
};

export const deleteProxyClass = async (db: Firestore, id: string) => {
  const docRef = doc(db, PROXY_COLLECTION, id);
  return deleteDoc(docRef).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });
};
