
'use client';
/**
 * @fileOverview Admission application data services.
 * Handles public application submission and administrative review/enrollment.
 */

import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  Timestamp,
  Firestore,
  DocumentData,
  getDoc,
  getDocs,
  query,
  orderBy,
  where,
  writeBatch
} from 'firebase/firestore';
import { NewStudentData } from './student-data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export interface AdmissionApplication extends Omit<NewStudentData, 'roll'> {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: Date;
  applicationId: string;
}

export type NewAdmissionData = Omit<AdmissionApplication, 'id' | 'status' | 'appliedAt' | 'applicationId'>;

const ADMISSIONS_COLLECTION = 'admissionApplications';

/**
 * Public function to save a new admission application.
 */
export const saveAdmissionApplication = (db: Firestore, data: NewAdmissionData) => {
    const applicationId = 'APP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const dataToSave = {
        ...data,
        status: 'pending',
        applicationId,
        appliedAt: serverTimestamp(),
        // Ensure academic year is string for consistency
        academicYear: String(data.academicYear),
    };

    return addDoc(collection(db, ADMISSIONS_COLLECTION), dataToSave)
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: ADMISSIONS_COLLECTION,
                operation: 'create',
                requestResourceData: dataToSave,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
};

/**
 * Fetches all admission applications for admin review.
 */
export const getAdmissionApplications = async (db: Firestore): Promise<AdmissionApplication[]> => {
    const q = query(collection(db, ADMISSIONS_COLLECTION), orderBy('appliedAt', 'desc'));
    try {
        const snap = await getDocs(q);
        return snap.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                appliedAt: data.appliedAt instanceof Timestamp ? data.appliedAt.toDate() : (data.appliedAt ? new Date(data.appliedAt) : new Date()),
                dob: data.dob instanceof Timestamp ? data.dob.toDate() : (data.dob ? new Date(data.dob) : undefined),
            } as AdmissionApplication;
        });
    } catch (serverError: any) {
        if (serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: ADMISSIONS_COLLECTION,
                operation: 'list',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
        }
        throw serverError;
    }
};

/**
 * Updates application status (e.g., to rejected).
 */
export const updateApplicationStatus = (db: Firestore, id: string, status: 'approved' | 'rejected') => {
    const docRef = doc(db, ADMISSIONS_COLLECTION, id);
    const data = { status };
    return setDoc(docRef, data, { merge: true })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'update',
                requestResourceData: data,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
};

/**
 * Enrolls a student by moving data to the main students collection.
 */
export const approveAndEnrollStudent = async (db: Firestore, application: AdmissionApplication, rollNumber: number) => {
    const batch = writeBatch(db);
    
    // Prepare main student record
    const { id, status, appliedAt, applicationId, ...studentData } = application;
    
    const studentId = doc(collection(db, 'students')).id;
    const studentRef = doc(db, 'students', studentId);
    
    const yearSuffix = String(application.academicYear).slice(-2);
    const classCode = String(application.className).padStart(2, '0');
    const rollSerial = rollNumber.toString().padStart(4, '0');
    const generatedId = `${yearSuffix}${classCode}${rollSerial}`;

    const newStudentData = {
        ...studentData,
        roll: rollNumber,
        generatedId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // Convert Date back to Timestamp for Firestore
        dob: application.dob ? Timestamp.fromDate(new Date(application.dob)) : null
    };

    batch.set(studentRef, newStudentData);

    // Update application status
    const appRef = doc(db, ADMISSIONS_COLLECTION, id);
    batch.update(appRef, { status: 'approved' });

    return batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: 'batch-enrollment',
            operation: 'write',
            requestResourceData: { studentId, rollNumber, appId: id }
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

/**
 * Deletes an application record.
 */
export const deleteApplication = (db: Firestore, id: string) => {
    const docRef = doc(db, ADMISSIONS_COLLECTION, id);
    return deleteDoc(docRef)
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: docRef.path,
                operation: 'delete',
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
};
