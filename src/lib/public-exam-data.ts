
'use client';
/**
 * @fileOverview Data services for Public Exam Records (SSC, JSC, Scholarship).
 */

import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  where,
  Firestore,
  serverTimestamp,
  Timestamp,
  deleteDoc,
  orderBy
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type PublicExamType = 'SSC' | 'JSC' | 'Scholarship';

export interface PublicExamRecord {
    id: string;
    registrationNo: string;
    rollNo: string;
    studentName: string;
    group: string; // 'science', 'arts', 'commerce', 'general'
    centerName: string;
    totalMarks: number;
    grade: string;
    gpa: number;
    examType: PublicExamType;
    academicYear: string;
    createdAt?: any;
    updatedAt?: any;
}

export type NewPublicExamData = Omit<PublicExamRecord, 'id' | 'createdAt' | 'updatedAt'>;

const COLLECTION_NAME = 'publicExamRecords';

/**
 * Saves or updates a public exam record.
 */
export const savePublicExamRecord = (db: Firestore, data: NewPublicExamData, id?: string) => {
    const docRef = id ? doc(db, COLLECTION_NAME, id) : doc(collection(db, COLLECTION_NAME));
    const dataToSave = {
        ...data,
        updatedAt: serverTimestamp(),
        createdAt: id ? undefined : serverTimestamp(),
    };

    // Clean undefined fields
    Object.keys(dataToSave).forEach(key => (dataToSave as any)[key] === undefined && delete (dataToSave as any)[key]);

    return setDoc(docRef, dataToSave, { merge: true })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: COLLECTION_NAME,
                operation: id ? 'update' : 'create',
                requestResourceData: dataToSave,
            });
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
};

/**
 * Fetches public exam records based on year and type.
 */
export const getPublicExamRecords = async (db: Firestore, year: string, type: PublicExamType): Promise<PublicExamRecord[]> => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('academicYear', '==', year),
        where('examType', '==', type)
    );

    try {
        const snap = await getDocs(q);
        return snap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
            } as PublicExamRecord;
        });
    } catch (e: any) {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: COLLECTION_NAME,
                operation: 'list',
            }));
        }
        return [];
    }
};

/**
 * Deletes a record.
 */
export const deletePublicExamRecord = (db: Firestore, id: string) => {
    return deleteDoc(doc(db, COLLECTION_NAME, id)).catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: COLLECTION_NAME,
            operation: 'delete',
        }));
    });
};
