'use client';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  Firestore,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { subjectNameNormalization } from './subjects';

export interface StudentResult {
  studentId: string;
  written?: number;
  mcq?: number;
  practical?: number;
}

export interface ClassResult {
  id?: string;
  academicYear: string;
  examName: string;
  className: string;
  group?: string;
  subject: string;
  fullMarks: number;
  writtenLimit?: number;
  mcqLimit?: number;
  practicalLimit?: number;
  results: StudentResult[];
}

const resultsCollection = 'results';

export const getDocumentId = (result: Omit<ClassResult, 'results' | 'fullMarks' | 'id'>): string => {
    const sanitizedSubject = result.subject.replace(/[^\p{L}\p{N}]+/gu, '-');
    const sanitizedExam = result.examName.replace(/[^\p{L}\p{N}]+/gu, '-');
    return `${result.academicYear}_${sanitizedExam}_${result.className}_${result.group || 'none'}_${sanitizedSubject}`;
}

export const saveClassResults = (db: Firestore, newResult: ClassResult) => {
  const normalizedSubject = subjectNameNormalization[newResult.subject] || newResult.subject;
  const resultWithNormalizedSubject = { ...newResult, subject: normalizedSubject };

  const docId = getDocumentId(resultWithNormalizedSubject);
  const docRef = doc(db, resultsCollection, docId);
  
  const dataToSave: { [key: string]: any } = { ...resultWithNormalizedSubject };
  delete dataToSave.id;

  Object.keys(dataToSave).forEach(key => {
    if (dataToSave[key] === undefined) {
      delete dataToSave[key];
    }
  });

  if (dataToSave.results && Array.isArray(dataToSave.results)) {
    dataToSave.results = dataToSave.results.map((studentResult: StudentResult) => {
      const cleanedResult: { [key: string]: any } = {};
      Object.keys(studentResult).forEach((keyStr) => {
        const key = keyStr as keyof StudentResult;
        const value = studentResult[key];
        if (value !== undefined && value !== null) {
          cleanedResult[key] = value;
        }
      });
      return cleanedResult;
    });
  }

  // Non-blocking setDoc for offline stability
  setDoc(docRef, dataToSave, { merge: true })
    .catch(async (serverError) => {
      console.error("Error saving results:", serverError);
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'write',
        requestResourceData: dataToSave,
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
    });
    
  return Promise.resolve();
};

export const getResultsForClass = async (
  db: Firestore,
  academicYear: string,
  examName: string,
  className: string,
  subject: string,
  group?: string
): Promise<ClassResult | undefined> => {
    const normalizedSubject = subjectNameNormalization[subject] || subject;
    const docId = getDocumentId({ academicYear, examName, className, subject: normalizedSubject, group });
    const docRef = doc(db, resultsCollection, docId);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as ClassResult;
        }
        return undefined;
    } catch(e: any) {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: docRef.path,
                operation: 'get',
            }));
        }
        console.error("Error getting results by ID:", e);
        return undefined;
    }
};

export const getAllResults = async (db: Firestore, academicYear: string, examName?: string): Promise<ClassResult[]> => {
    let q = query(collection(db, resultsCollection), where("academicYear", "==", academicYear));
    if (examName) {
        q = query(q, where("examName", "==", examName));
    }
    try {
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassResult));
    } catch (e: any) {
        if (e.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: resultsCollection,
                operation: 'list',
            }));
        }
        console.error("Error getting all results:", e);
        return [];
    }
};

export const deleteClassResult = (db: Firestore, id: string) => {
    const docRef = doc(db, resultsCollection, id);
    // Non-blocking deleteDoc
    deleteDoc(docRef)
    .catch(async (serverError) => {
        console.error("Error deleting result:", serverError);
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    });
    return Promise.resolve();
};

export interface ExamAttendanceRecord {
  id?: string;
  academicYear: string;
  examName: string;
  className: string;
  group?: string;
  attendance: Record<string, 'present' | 'absent'>;
  updatedAt?: any;
}

export const getExamAttendanceDocId = (academicYear: string, examName: string, className: string, group?: string) => {
  const sanitizedExam = examName.replace(/[^\p{L}\p{N}]+/gu, '-');
  const grp = (group || 'none').toLowerCase().trim();
  return `${academicYear}_${sanitizedExam}_${className}_${grp}_ATTENDANCE`;
};

export const saveExamAttendance = async (
  db: Firestore,
  record: ExamAttendanceRecord
) => {
  const docId = getExamAttendanceDocId(record.academicYear, record.examName, record.className, record.group);
  const grp = (record.group || 'none').toLowerCase().trim();
  
  // 1. Save to dedicated examAttendance collection
  const examAttRef = doc(db, 'examAttendance', docId);
  setDoc(examAttRef, {
    academicYear: record.academicYear,
    examName: record.examName,
    className: record.className,
    group: grp,
    attendance: record.attendance,
    updatedAt: new Date().toISOString(),
  }, { merge: true }).catch(err => {
    console.warn("Notice: could not write to examAttendance collection directly:", err);
  });

  // 2. Also save to results collection with subject '__ATTENDANCE__' for instant getAllResults synchronization
  const sanitizedExam = record.examName.replace(/[^\p{L}\p{N}]+/gu, '-');
  const resultsDocId = `${record.academicYear}_${sanitizedExam}_${record.className}_${grp}___ATTENDANCE__`;
  const resultsRef = doc(db, resultsCollection, resultsDocId);
  await setDoc(resultsRef, {
    academicYear: record.academicYear,
    examName: record.examName,
    className: record.className,
    group: grp,
    subject: '__ATTENDANCE__',
    fullMarks: 0,
    results: [],
    attendanceMap: record.attendance,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
};

export const getExamAttendance = async (
  db: Firestore,
  academicYear: string,
  examName: string,
  className: string,
  group?: string
): Promise<ExamAttendanceRecord | undefined> => {
  const grp = (group || 'none').toLowerCase().trim();
  const sanitizedExam = examName.replace(/[^\p{L}\p{N}]+/gu, '-');

  // Try results collection with subject '__ATTENDANCE__' first as it guarantees consistency
  try {
    const resultsDocId = `${academicYear}_${sanitizedExam}_${className}_${grp}___ATTENDANCE__`;
    const rSnap = await getDoc(doc(db, resultsCollection, resultsDocId));
    if (rSnap.exists()) {
      const data = rSnap.data();
      return {
        id: rSnap.id,
        academicYear: data.academicYear,
        examName: data.examName,
        className: data.className,
        group: data.group,
        attendance: data.attendanceMap || {},
      };
    }
  } catch (e) {
    console.warn("Could not read attendance from results collection:", e);
  }

  // Fallback to examAttendance collection
  try {
    const docId = getExamAttendanceDocId(academicYear, examName, className, grp);
    const snap = await getDoc(doc(db, 'examAttendance', docId));
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as ExamAttendanceRecord;
    }
  } catch (e) {
    console.warn("Could not read attendance from examAttendance collection:", e);
  }

  // If specific group not found, check fallback to 'none' (সকল শাখা)
  if (grp !== 'none' && grp !== 'all') {
    return getExamAttendance(db, academicYear, examName, className, 'none');
  }

  return undefined;
};
