
'use client';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  query,
  orderBy,
  Firestore,
  serverTimestamp,
  Timestamp,
  limit,
  setDoc
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export interface Notice {
  id: string;
  title: string;
  content: string;
  date: Date | null;
  priority: 'normal' | 'important' | 'urgent';
  senderName: string;
  pdfUrl?: string;
  isScrolling?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type NewNoticeData = Omit<Notice, 'id' | 'date' | 'createdAt' | 'updatedAt'>;

const NOTICES_COLLECTION = 'notices';

/**
 * Fetches notices with real-time updates.
 */
export const getNotices = async (db: Firestore, maxCount = 50): Promise<Notice[]> => {
  const q = query(collection(db, NOTICES_COLLECTION), orderBy('date', 'desc'), limit(maxCount));
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            date: data.date instanceof Timestamp ? data.date.toDate() : (data.date ? new Date(data.date) : null),
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
        } as Notice;
    });
  } catch (e) {
    console.error("Error getting notices:", e);
    return [];
  }
};

/**
 * Adds a new notice using non-blocking pattern for optimistic UI.
 */
export const addNotice = (db: Firestore, noticeData: NewNoticeData) => {
  const docRef = doc(collection(db, NOTICES_COLLECTION));
  
  const dataToSave: any = {
    title: noticeData.title,
    content: noticeData.content,
    priority: noticeData.priority,
    senderName: noticeData.senderName,
    isScrolling: !!noticeData.isScrolling,
    date: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (noticeData.pdfUrl) {
    dataToSave.pdfUrl = noticeData.pdfUrl;
  }

  setDoc(docRef, dataToSave)
    .catch(async (serverError: any) => {
      console.error("Firestore Save Error:", serverError);
      if (serverError.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
              path: NOTICES_COLLECTION,
              operation: 'create',
              requestResourceData: dataToSave,
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
      }
    });
};

export const updateNoticeScrolling = (db: Firestore, id: string, isScrolling: boolean) => {
  const docRef = doc(db, NOTICES_COLLECTION, id);
  const dataToUpdate = { isScrolling, updatedAt: serverTimestamp() };
  
  updateDoc(docRef, dataToUpdate)
    .catch(async (serverError: any) => {
      if (serverError.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'update',
              requestResourceData: dataToUpdate,
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
      }
    });
};

export const deleteNotice = (db: Firestore, id: string) => {
  const docRef = doc(db, NOTICES_COLLECTION, id);
  deleteDoc(docRef)
    .catch(async (serverError: any) => {
      if (serverError.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'delete',
              requestResourceData: { id },
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
      }
    });
};
