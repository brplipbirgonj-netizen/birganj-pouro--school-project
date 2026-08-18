'use client';
/**
 * @fileOverview Data services for Teacher-Subject Allocation.
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
  deleteDoc
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export interface SubjectAllocation {
  className: string;
  subjectName: string;
}

export interface TeacherAllocationRecord {
  id?: string;
  teacherName: string;
  allocations: SubjectAllocation[];
  academicYear: string;
  updatedAt?: any;
}

const COLLECTION_NAME = 'teacherAllocations';

/**
 * Saves teacher-subject allocation to Firestore.
 */
export const saveTeacherAllocation = async (db: Firestore, data: TeacherAllocationRecord) => {
  const docId = `${data.academicYear}_${data.teacherName.replace(/\s+/g, '-')}`;
  const docRef = doc(db, COLLECTION_NAME, docId);
  
  const dataToSave = {
    ...data,
    updatedAt: serverTimestamp()
  };
  delete (dataToSave as any).id;

  return setDoc(docRef, dataToSave, { merge: true })
    .catch(async (serverError) => {
      if (serverError.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: COLLECTION_NAME,
          operation: 'write',
          requestResourceData: dataToSave,
        }));
      }
      throw serverError;
    });
};

/**
 * Fetches all teacher-subject allocations for a given academic year.
 */
export const getTeacherAllocations = async (db: Firestore, academicYear: string): Promise<TeacherAllocationRecord[]> => {
  const q = query(collection(db, COLLECTION_NAME), where('academicYear', '==', academicYear));
  try {
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherAllocationRecord));
  } catch (e) {
    console.error("Error fetching teacher allocations:", e);
    return [];
  }
};
