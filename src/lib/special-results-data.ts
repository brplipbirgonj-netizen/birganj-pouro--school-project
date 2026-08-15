'use client';
/**
 * @fileOverview Data services for Special Exams (Monthly/Weekly evaluations).
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
  limit
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export interface SpecialStudentResult {
  studentId: string;
  marks?: number;
}

export interface SpecialClassResult {
  id?: string;
  academicYear: string;
  className: string;
  subject: string;
  examType: string; // বিশেষ পরীক্ষা-১, বিশেষ পরীক্ষা-২, ইত্যাদি
  month: string;
  fullMarks: number;
  results: SpecialStudentResult[];
}

const COLLECTION = 'specialResults';

export const getSpecialResultId = (res: Omit<SpecialClassResult, 'results' | 'id'>) => {
    const sanitizedSub = res.subject.replace(/[^\p{L}\p{N}]+/gu, '-');
    const sanitizedExam = res.examType.replace(/[^\p{L}\p{N}]+/gu, '-');
    const sanitizedMonth = res.month.replace(/[^\p{L}\p{N}]+/gu, '-');
    return `${res.academicYear}_${sanitizedMonth}_${res.className}_${sanitizedSub}_${sanitizedExam}`;
};

export const saveSpecialResults = (db: Firestore, data: SpecialClassResult) => {
  const docId = getSpecialResultId(data);
  const docRef = doc(db, COLLECTION, docId);
  
  const dataToSave = {
    ...data,
    updatedAt: serverTimestamp()
  };
  delete (dataToSave as any).id;

  return setDoc(docRef, dataToSave, { merge: true })
    .catch(async (serverError) => {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'write',
        requestResourceData: dataToSave,
      });
      errorEmitter.emit('permission-error', permissionError);
    });
};

export const getSpecialResultsForClass = async (
  db: Firestore,
  academicYear: string,
  className: string,
  month: string
): Promise<SpecialClassResult[]> => {
  const q = query(
    collection(db, COLLECTION),
    where("academicYear", "==", academicYear),
    where("className", "==", className),
    where("month", "==", month)
  );
  try {
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SpecialClassResult));
  } catch (e: any) {
    if (e.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: COLLECTION,
            operation: 'list',
        }));
    }
    console.error(e);
    return [];
  }
};
