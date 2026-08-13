
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

export const saveProxyClass = (db: Firestore, proxy: NewProxyData) => {
  // Use a unique but consistent ID for the assignment to prevent duplicates
  const docId = `${proxy.academicYear}_${proxy.date}_${proxy.className}_${proxy.periodIndex}`;
  const docRef = doc(db, PROXY_COLLECTION, docId);
  
  const dataToSave = {
    ...proxy,
    assignedAt: serverTimestamp(),
  };

  // Remove id if accidentally included
  if ('id' in dataToSave) delete (dataToSave as any).id;

  // Optimistic save: do not await here. Chain .catch() for error reporting.
  setDoc(docRef, dataToSave, { merge: true }).catch(async (serverError: any) => {
    console.error("Firestore Save Error:", serverError);
    if (serverError.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'write',
            requestResourceData: dataToSave,
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  });
};

export const deleteProxyClass = (db: Firestore, id: string) => {
  const docRef = doc(db, PROXY_COLLECTION, id);
  // Optimistic delete
  deleteDoc(docRef).catch(async (serverError: any) => {
    if (serverError.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  });
};
