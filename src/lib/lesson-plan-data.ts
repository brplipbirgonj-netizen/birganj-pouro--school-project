
'use client';
/**
 * @fileOverview Lesson plan and syllabus progress data services.
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
  orderBy
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export interface LessonPlan {
  id: string;
  teacherUid: string;
  teacherName: string;
  className: string;
  subject: string;
  academicYear: string;
  week: string; // Format: YYYY-Wxx
  topic: string;
  objectives?: string;
  progress: number; // 0 to 100
  updatedAt: Date;
}

export type NewLessonPlan = Omit<LessonPlan, 'id' | 'updatedAt'>;

const COLLECTION_NAME = 'lessonPlans';

/**
 * Saves or updates a lesson plan.
 */
export const saveLessonPlan = async (db: Firestore, plan: NewLessonPlan) => {
    // Unique ID based on Year, Class, Subject, Week, and Teacher
    const docId = `${plan.academicYear}_${plan.className}_${plan.subject.replace(/\s+/g, '-')}_${plan.week}_${plan.teacherUid}`;
    const docRef = doc(db, COLLECTION_NAME, docId);
    
    const dataToSave = {
        ...plan,
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
            throw serverError;
        });
};

/**
 * Fetches lesson plans for a specific teacher.
 */
export const getLessonPlansForTeacher = async (db: Firestore, teacherUid: string, academicYear: string): Promise<LessonPlan[]> => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('teacherUid', '==', teacherUid),
        where('academicYear', '==', academicYear),
        orderBy('updatedAt', 'desc')
    );

    try {
        const snap = await getDocs(q);
        return snap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
            } as LessonPlan;
        });
    } catch (e) {
        console.error("Error fetching lesson plans:", e);
        return [];
    }
};

/**
 * Fetches all lesson plans for admin overview.
 */
export const getAllLessonPlans = async (db: Firestore, academicYear: string): Promise<LessonPlan[]> => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('academicYear', '==', academicYear),
        orderBy('updatedAt', 'desc')
    );

    try {
        const snap = await getDocs(q);
        return snap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(),
            } as LessonPlan;
        });
    } catch (e) {
        console.error("Error fetching all lesson plans:", e);
        return [];
    }
};
