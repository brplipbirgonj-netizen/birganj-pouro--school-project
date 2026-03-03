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

export const logMessage = async (db: Firestore, logData: NewMessageLog) => {
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

  try {
    return await setDoc(docRef, dataToSave);
  } catch (serverError: any) {
    console.error("Error logging message:", serverError);
    if (serverError.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: MESSAGES_COLLECTION,
            operation: 'create',
            requestResourceData: dataToSave,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
    }
    throw serverError;
  }
};

export const updateMessageNote = async (db: Firestore, id: string, notes: string) => {
  const docRef = doc(db, MESSAGES_COLLECTION, id);
  try {
    return await updateDoc(docRef, { notes });
  } catch (serverError: any) {
    console.error("Error updating message note:", serverError);
    throw serverError;
  }
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
            sentAt: data.sentAt instanceof Timestamp ? data.sentAt.toDate() : new Date(data.sentAt),
        } as MessageLog;
    });
  } catch (e) {
    console.error("Error getting message logs:", e);
    return [];
  }
};

export const deleteMessageLog = async (db: Firestore, id: string) => {
  const docRef = doc(db, MESSAGES_COLLECTION, id);
  try {
    await deleteDoc(docRef);
  } catch (serverError: any) {
    console.error("Error deleting message log:", serverError);
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
