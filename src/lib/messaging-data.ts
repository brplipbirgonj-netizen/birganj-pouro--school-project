'use client';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Firestore,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export interface MessageLog {
  id: string;
  recipientsCount: number;
  type: 'all' | 'class' | 'individual' | 'absent' | 'call';
  className?: string;
  content: string;
  notes?: string;
  sentAt: Date;
  senderUid: string;
  senderName: string;
}

export type NewMessageLog = Omit<MessageLog, 'id' | 'sentAt'>;

const MESSAGES_COLLECTION = 'messageLogs';

export const logMessage = (db: Firestore, logData: NewMessageLog) => {
  // Use doc(collection) without ID to let Firestore generate a unique ID
  const docRef = doc(collection(db, MESSAGES_COLLECTION));
  const dataToSave: any = {
    ...logData,
    sentAt: serverTimestamp(),
  };

  // Remove undefined fields to prevent Firestore errors
  Object.keys(dataToSave).forEach(key => {
    if (dataToSave[key] === undefined) {
      delete dataToSave[key];
    }
  });

  return setDoc(docRef, dataToSave)
    .catch(async (serverError: any) => {
      console.error("Error logging message:", serverError);
      if (serverError.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
              path: MESSAGES_COLLECTION,
              operation: 'create',
              requestResourceData: dataToSave,
          });
          errorEmitter.emit('permission-error', permissionError);
      }
    });
};

export const updateMessageNote = (db: Firestore, id: string, notes: string) => {
  const docRef = doc(db, MESSAGES_COLLECTION, id);
  return updateDoc(docRef, { notes })
    .catch(async (serverError: any) => {
      if (serverError.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'update',
              requestResourceData: { notes },
          });
          errorEmitter.emit('permission-error', permissionError);
      }
    });
};

export const getMessageLogs = async (db: Firestore): Promise<MessageLog[]> => {
  const q = query(collection(db, MESSAGES_COLLECTION), orderBy('sentAt', 'desc'));
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            sentAt: data.sentAt instanceof Timestamp ? data.sentAt.toDate() : (data.sentAt ? new Date(data.sentAt) : new Date()),
        } as MessageLog;
    });
  } catch (e: any) {
    if (e.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: MESSAGES_COLLECTION,
            operation: 'list',
        }));
    }
    console.error("Error getting message logs:", e);
    return [];
  }
};

export const deleteMessageLog = (db: Firestore, id: string) => {
  const docRef = doc(db, MESSAGES_COLLECTION, id);
  return deleteDoc(docRef)
    .catch(async (serverError: any) => {
      console.error("Error deleting message log:", serverError);
      if (serverError.code === 'permission-denied') {
          const permissionError = new FirestorePermissionError({
              path: docRef.path,
              operation: 'delete',
          });
          errorEmitter.emit('permission-error', permissionError);
      }
    });
};
