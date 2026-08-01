'use client';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
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
import { NewStudentData, addStudent } from './student-data';

export interface AdmissionApplication extends Omit<NewStudentData, 'roll'> {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: Date;
  applicationId: string;
}

export type NewAdmissionData = Omit<AdmissionApplication, 'id' | 'status' | 'appliedAt' | 'applicationId'>;

const ADMISSIONS_COLLECTION = 'admissionApplications';

export const saveAdmissionApplication = async (db: Firestore, data: NewAdmissionData) => {
    const applicationId = 'APP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const dataToSave = {
        ...data,
        status: 'pending',
        applicationId,
        appliedAt: serverTimestamp(),
    };

    return addDoc(collection(db, ADMISSIONS_COLLECTION), dataToSave);
};

export const getAdmissionApplications = async (db: Firestore): Promise<AdmissionApplication[]> => {
    const q = query(collection(db, ADMISSIONS_COLLECTION), orderBy('appliedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            appliedAt: data.appliedAt instanceof Timestamp ? data.appliedAt.toDate() : data.appliedAt,
            dob: data.dob instanceof Timestamp ? data.dob.toDate() : data.dob,
        } as AdmissionApplication;
    });
};

export const updateApplicationStatus = async (db: Firestore, id: string, status: 'approved' | 'rejected') => {
    const docRef = doc(db, ADMISSIONS_COLLECTION, id);
    return setDoc(docRef, { status }, { merge: true });
};

export const approveAndEnrollStudent = async (db: Firestore, application: AdmissionApplication, rollNumber: number) => {
    const batch = writeBatch(db);
    
    // 1. Prepare student data
    const { id, status, appliedAt, applicationId, ...studentData } = application;
    
    // 2. Add to main students collection
    await addStudent(db, {
        ...studentData,
        roll: rollNumber,
    });

    // 3. Mark application as approved
    const appRef = doc(db, ADMISSIONS_COLLECTION, id);
    batch.update(appRef, { status: 'approved' });

    return batch.commit();
};

export const deleteApplication = async (db: Firestore, id: string) => {
    const docRef = doc(db, ADMISSIONS_COLLECTION, id);
    return deleteDoc(docRef);
};
