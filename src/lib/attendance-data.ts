
'use client';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  Firestore,
  setDoc,
  orderBy,
  limit,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type AttendanceStatus = 'present' | 'absent';

export interface StudentAttendance {
  studentId: string;
  status: AttendanceStatus;
}

export interface DailyAttendance {
  id?: string;
  date: string; // YYYY-MM-DD
  academicYear: string;
  className: string;
  attendance: StudentAttendance[];
}

const ATTENDANCE_COLLECTION = 'attendance';

export const getAttendanceFromStorage = async (db: Firestore): Promise<DailyAttendance[]> => {
  const q = query(collection(db, ATTENDANCE_COLLECTION), orderBy('date', 'desc'));
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAttendance));
  } catch (e) {
    console.error("Error getting attendance:", e);
    return [];
  }
};

export const saveDailyAttendance = async (db: Firestore, record: DailyAttendance) => {
  const q = query(
    collection(db, ATTENDANCE_COLLECTION),
    where("date", "==", record.date),
    where("academicYear", "==", record.academicYear),
    where("className", "==", record.className)
  );

  const existing = await getDocs(q);
  
  if (!existing.empty) {
    const docId = existing.docs[0].id;
    const docRef = doc(db, ATTENDANCE_COLLECTION, docId);
    return setDoc(docRef, record, { merge: true }).catch(async (serverError) => {
      console.error("Error updating attendance:", serverError);
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'write',
        requestResourceData: record,
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
    });
  } else {
    const collectionRef = collection(db, ATTENDANCE_COLLECTION);
    return addDoc(collectionRef, record).catch(async (serverError) => {
      console.error("Error saving attendance:", serverError);
      const permissionError = new FirestorePermissionError({
        path: ATTENDANCE_COLLECTION,
        operation: 'create',
        requestResourceData: record,
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
    });
  }
};

export const getAttendanceForDate = async (db: Firestore, date: string, academicYear: string): Promise<DailyAttendance[]> => {
    const q = query(
        collection(db, ATTENDANCE_COLLECTION),
        where("date", "==", date),
        where("academicYear", "==", academicYear)
    );
    try {
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DailyAttendance));
    } catch (e) {
        console.error("Error getting attendance for date:", e);
        return [];
    }
}

export const getAttendanceForClassAndDate = async (db: Firestore, date: string, className: string, academicYear: string): Promise<DailyAttendance | undefined> => {
    const q = query(
        collection(db, ATTENDANCE_COLLECTION),
        where("date", "==", date),
        where("className", "==", className),
        where("academicYear", "==", academicYear)
    );
    try {
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            return { id: doc.id, ...doc.data() } as DailyAttendance;
        }
        return undefined;
    } catch(e) {
        console.error("Error getting attendance for class and date:", e);
        return undefined;
    }
};

export interface StudentConsecutiveAbsence {
    studentId: string;
    absentDays: number;
    lastAbsentDate: string;
}

export const getConsecutiveAbsences = async (db: Firestore, className: string, academicYear: string): Promise<StudentConsecutiveAbsence[]> => {
    const q = query(
        collection(db, ATTENDANCE_COLLECTION),
        where("academicYear", "==", academicYear),
        where("className", "==", className),
        orderBy("date", "desc"),
        limit(15) // Check last 15 records to find streaks
    );

    try {
        const snap = await getDocs(q);
        const records = snap.docs.map(d => d.data() as DailyAttendance);
        if (records.length === 0) return [];

        const studentAbsenceMap = new Map<string, number>();
        const studentLastDateMap = new Map<string, string>();
        
        // Get all unique students in this class from the records
        const allStudentIds = new Set<string>();
        records.forEach(r => r.attendance.forEach(a => allStudentIds.add(a.studentId)));

        allStudentIds.forEach(studentId => {
            let consecutive = 0;
            for (const record of records) {
                const att = record.attendance.find(a => a.studentId === studentId);
                if (att?.status === 'absent') {
                    consecutive++;
                } else if (att?.status === 'present') {
                    break; // Streak broken
                }
                // If not found (e.g. holiday or data gap), we don't break but we don't increment
            }
            if (consecutive >= 3) {
                studentAbsenceMap.set(studentId, consecutive);
                studentLastDateMap.set(studentId, records[0].date);
            }
        });

        return Array.from(studentAbsenceMap.entries()).map(([studentId, count]) => ({
            studentId,
            absentDays: count,
            lastAbsentDate: studentLastDateMap.get(studentId) || '',
        }));
    } catch (e) {
        console.error("Error checking consecutive absences:", e);
        return [];
    }
}
