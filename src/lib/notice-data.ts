
'use client';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Firestore,
  serverTimestamp,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export interface Notice {
  id: string;
  title: string;
  content: string;
  date: Date;
  priority: 'normal' | 'important' | 'urgent';
  senderName: string;
  pdfUrl?: string;
}

export type NewNoticeData = Omit<Notice, 'id' | 'date'>;

const NOTICES_COLLECTION = 'notices';

export const getNotices = async (db: Firestore, maxCount = 5): Promise<Notice[]> => {
  const q = query(collection(db, NOTICES_COLLECTION), orderBy('date', 'desc'), limit(maxCount));
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            date: data.date instanceof Timestamp ? data.date.toDate() : new Date(data.date),
        } as Notice;
    });
  } catch (e) {
    console.error("Error getting notices:", e);
    return [];
  }
};

export const addNotice = async (db: Firestore, noticeData: NewNoticeData) => {
  const collectionRef = collection(db, NOTICES_COLLECTION);
  const dataToSave = {
    ...noticeData,
    date: serverTimestamp(),
  };

  try {
    return await addDoc(collectionRef, dataToSave);
  } catch (serverError: any) {
    if (serverError.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: NOTICES_COLLECTION,
            operation: 'create',
            requestResourceData: dataToSave,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
    }
    throw serverError;
  }
};

export const deleteNotice = async (db: Firestore, id: string) => {
  const docRef = doc(db, NOTICES_COLLECTION, id);
  try {
    await deleteDoc(docRef);
  } catch (serverError: any) {
    if (serverError.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
    }
    throw serverError;
  }
};
