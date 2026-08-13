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
}

export type NewNoticeData = Omit<Notice, 'id' | 'date'>;

const NOTICES_COLLECTION = 'notices';

/**
 * Fetches notices with real-time updates not possible here, 
 * so it's a one-time fetch helper. Main reactive logic is in page component.
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
  const collectionRef = collection(db, NOTICES_COLLECTION);
  const dataToSave = {
    ...noticeData,
    date: serverTimestamp(),
  };

  // Perform the write without awaiting the server response for better UX
  addDoc(collectionRef, dataToSave)
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
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
      }
    });
};
