'use client';
/**
 * @fileOverview Syllabus data services for defining subject chapters for exams.
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  Firestore,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export interface Syllabus {
  id?: string;
  academicYear: string;
  examName: string;
  className: string;
  subjectName: string;
  chapters: string[];
  chapterComments?: Record<string, string>;
  updatedAt: Date;
}

export type NewSyllabus = Omit<Syllabus, 'id' | 'updatedAt'>;

const COLLECTION_NAME = 'syllabi';

export const getSyllabusId = (academicYear: string, examName: string, className: string, subjectName: string) => {
    const sanitizedExam = examName.replace(/[^\p{L}\p{N}]+/gu, '-');
    const sanitizedSubject = subjectName.replace(/[^\p{L}\p{N}]+/gu, '-');
    return `${academicYear}_${sanitizedExam}_${className}_${sanitizedSubject}`;
};

/**
 * Saves or updates a syllabus configuration.
 */
export const saveSyllabus = (db: Firestore, data: NewSyllabus) => {
    const docId = getSyllabusId(data.academicYear, data.examName, data.className, data.subjectName);
    const docRef = doc(db, COLLECTION_NAME, docId);
    
    const dataToSave = {
        ...data,
        updatedAt: serverTimestamp(),
    };

    return setDoc(docRef, dataToSave, { merge: true })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: COLLECTION_NAME,
                operation: 'write',
                requestResourceData: dataToSave,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        });
};

/**
 * Fetches a specific syllabus for an exam, class, and subject.
 */
export const getSyllabus = async (db: Firestore, academicYear: string, examName: string, className: string, subjectName: string): Promise<Syllabus | null> => {
    const docId = getSyllabusId(academicYear, examName, className, subjectName);
    const docRef = doc(db, COLLECTION_NAME, docId);

    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            return {
                id: docSnap.id,
                ...data,
                updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : new Date()),
            } as Syllabus;
        }
        return null;
    } catch (e: any) {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: COLLECTION_NAME,
                operation: 'get',
            } satisfies SecurityRuleContext));
        }
        console.error("Error fetching syllabus:", e);
        return null;
    }
};
