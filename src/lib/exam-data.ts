'use client';
import {
  collection,
  getDocs,
  query,
  where,
  Firestore,
  doc,
  writeBatch
} from 'firebase/firestore';

export interface Exam {
  id: string;
  name: string;
  academicYear: string;
  classes: string[];
}

export const EXAMS_COLLECTION = 'exams';

export const createInitialExams = async (db: Firestore, academicYear: string): Promise<Exam[]> => {
    const defaultExams = [
        { name: 'অর্ধ-বার্ষিক পরীক্ষা', classes: ['6', '7', '8', '9', '10'] },
        { name: 'বার্ষিক পরীক্ষা', classes: ['6', '7', '8', '9', '10'] },
        { name: 'প্রাক-নির্বাচনী পরীক্ষা', classes: ['10'] },
        { name: 'নির্বাচনী পরীক্ষা', classes: ['10'] },
    ];

    const batch = writeBatch(db);
    const examsWithIds: Exam[] = [];

    for (const exam of defaultExams) {
        const examSlug = exam.name.replace(/[^\p{L}\p{N}]+/gu, '-');
        const docId = `${academicYear}_${examSlug}`;
        const docRef = doc(db, EXAMS_COLLECTION, docId);
        
        const examData = {
            ...exam,
            academicYear: academicYear
        };
        batch.set(docRef, examData, { merge: true });
        examsWithIds.push({ id: docId, ...examData });
    }

    try {
        await batch.commit();
        return examsWithIds;
    } catch (e) {
        return defaultExams.map((e, idx) => ({ id: `temp-${idx}`, ...e, academicYear }));
    }
}

export const getExams = async (db: Firestore, academicYear: string): Promise<Exam[]> => {
    const q = query(collection(db, EXAMS_COLLECTION), where("academicYear", "==", academicYear));
    try {
        const querySnapshot = await getDocs(q);
        let exams: Exam[] = [];
        if (querySnapshot.empty) {
            exams = await createInitialExams(db, academicYear);
        } else {
            exams = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
        }
        
        // Deduplicate based on name
        const seen = new Set();
        return exams.filter(exam => {
            const duplicate = seen.has(exam.name);
            seen.add(exam.name);
            return !duplicate;
        });
    } catch(e) {
        console.error("Error getting exams:", e);
        return [];
    }
}
