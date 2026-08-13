'use client';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
  Firestore,
  DocumentData,
  WithFieldValue
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type TransactionType = 'income' | 'expense';
export type PaymentMethod = 'cash' | 'bank';

export interface Transaction {
  id: string;
  date: Date;
  type: TransactionType;
  method: PaymentMethod;
  accountHead: string;
  description: string;
  amount: number;
  academicYear: string;
  voucherNo?: string;
  checkNo?: string;
  feeCollectionId?: string;
  createdAt?: Timestamp;
}

export type NewTransactionData = Omit<Transaction, 'id' | 'createdAt'>;

const TRANSACTIONS_COLLECTION = 'transactions';

export const transactionFromDoc = (doc: DocumentData): Transaction => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        method: data.method || 'cash',
        date: data.date.toDate(),
    } as Transaction;
}

export const getTransactions = async (db: Firestore, academicYear: string): Promise<Transaction[]> => {
    const transactionsQuery = query(
        collection(db, TRANSACTIONS_COLLECTION),
        where("academicYear", "==", academicYear)
    );
    try {
        const querySnapshot = await getDocs(transactionsQuery);
        return querySnapshot.docs.map(transactionFromDoc);
    } catch (e) {
        console.error("Error getting transactions:", e);
        return [];
    }
};

export const addTransaction = async (db: Firestore, transactionData: NewTransactionData) => {
  const dataToSave: WithFieldValue<DocumentData> = {
    ...transactionData,
    date: Timestamp.fromDate(transactionData.date),
    createdAt: serverTimestamp(),
  };

  Object.keys(dataToSave).forEach(key => {
    if (dataToSave[key] === undefined || dataToSave[key] === '') {
      delete dataToSave[key];
    }
  });

  return addDoc(collection(db, TRANSACTIONS_COLLECTION), dataToSave)
    .catch(async (serverError) => {
      console.error("Error adding transaction:", serverError);
      const permissionError = new FirestorePermissionError({
        path: TRANSACTIONS_COLLECTION,
        operation: 'create',
        requestResourceData: dataToSave,
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
    });
};

export const deleteTransaction = async (db: Firestore, id: string): Promise<void> => {
  const docRef = doc(db, TRANSACTIONS_COLLECTION, id);
  return deleteDoc(docRef)
    .catch(async (serverError) => {
        console.error("Error deleting transaction:", serverError);
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
    });
};
