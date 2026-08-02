'use client';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Firestore,
  where,
  writeBatch
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export interface Holiday {
  id: string; // Firestore doc ID
  date: string; // YYYY-MM-DD
  description: string;
}

export type NewHolidayData = Omit<Holiday, 'id'>;

const HOLIDAYS_COLLECTION_PATH = 'holidays';

export const createInitialHolidays = async (db: Firestore): Promise<Holiday[]> => {
    const holidaysFor2026: NewHolidayData[] = [
        { date: '2026-01-17', description: 'শব-ই-মিরাজ' },
        { date: '2026-01-23', description: 'শ্রী শ্রী সরস্বতী পূজা' },
        { date: '2026-02-01', description: 'মাঘী পূর্ণিমা' },
        { date: '2026-02-04', description: 'শব-ই-বরাত' },
        { date: '2026-02-15', description: 'শ্রী শ্রী শিবরাত্রি ব্রত' },
        { date: '2026-02-21', description: 'শহিদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস' },
        { date: '2026-03-03', description: 'শুভ দোলযাত্রা' },
        { date: '2026-04-05', description: 'ইস্টার সানডে' },
        { date: '2026-04-12', description: 'বৈসাবি উৎস' },
        { date: '2026-04-13', description: 'চৈত্র সংক্রান্তি' },
        { date: '2026-04-14', description: 'বাংলা নববর্ষ' },
        { date: '2026-05-01', description: 'মে দিবস ও বুদ্ধ পূর্ণিমা' },
        { date: '2026-06-26', description: 'পবিত্র আশুরা (মহররম)' },
        { date: '2026-07-29', description: 'আষাঢ়ী পূর্ণিমা' },
        { date: '2026-08-05', description: 'জুলাই গণঅভ্যুত্থান দিবস' },
        { date: '2026-08-12', description: 'আখেরী চাহার সোম্বা' },
        { date: '2026-08-26', description: 'ঈদ-ই-মিলাদুন্নবী (সা.)' },
        { date: '2026-09-04', description: 'শুভ জন্মাষ্টমী' },
        { date: '2026-09-24', description: 'ফাতেমা-ই-ইয়াজ দাহম' },
        { date: '2026-09-26', description: 'মধু পূর্ণিমা' },
        { date: '2026-10-10', description: 'শুভ মহালয়া' },
        { date: '2026-10-25', description: 'শ্রী শ্রী লক্ষ্মীপূজা/প্রবারণা পূর্ণিমা' },
        { date: '2026-11-08', description: 'শ্রী শ্রী শ্যামাপূজা' },
        { date: '2026-12-16', description: 'বিজয় দিবস' },
        { date: '2026-12-25', description: 'বড় দিন' },
    ];

    const holidayRangesFor2026 = [
        { start: '2026-02-19', end: '2026-03-26', description: 'পবিত্র রমজান, শব-ই-কদর ও ঈদ-উল-ফিতর' },
        { start: '2026-05-24', end: '2026-06-04', description: 'ঈদ-উল-আযহা ও গ্রীষ্মকালীন অবকাশ' },
        { start: '2026-10-18', end: '2026-10-22', description: 'দুর্গাপূজা (বিজয়া দশমী সহ)' },
        { start: '2026-12-20', end: '2026-12-31', description: 'শীতকালীন অবকাশ' },
    ];

    holidayRangesFor2026.forEach(range => {
        const startDate = new Date(`${range.start}T12:00:00Z`); // Explicitly parse as UTC noon
        const endDate = new Date(`${range.end}T12:00:00Z`);   // Explicitly parse as UTC noon

        let currentDate = new Date(startDate);

        while (currentDate <= endDate) {
            holidaysFor2026.push({
                date: currentDate.toISOString().split('T')[0], // YYYY-MM-DD format
                description: range.description,
            });
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }
    });

    const uniqueHolidays = Array.from(new Map(holidaysFor2026.map(item => [item.date, item])).values());
    uniqueHolidays.sort((a, b) => a.date.localeCompare(b.date));

    const batch = writeBatch(db);
    const holidaysWithIds: Holiday[] = [];
    
    // First, delete all existing holidays for 2026 to ensure a clean slate
    const existingHolidaysQuery = query(collection(db, HOLIDAYS_COLLECTION_PATH), where("date", ">=", "2026-01-01"), where("date", "<=", "2026-12-31"));
    try {
        const existingDocsSnapshot = await getDocs(existingHolidaysQuery);
        existingDocsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
    } catch (e) {
        // If querying fails, we might still proceed, but the commit might fail if we don't have read access.
        // The global error handler will catch this.
        console.error("Error querying existing holidays for deletion:", e);
    }

    uniqueHolidays.forEach(holiday => {
        const docRef = doc(collection(db, HOLIDAYS_COLLECTION_PATH));
        batch.set(docRef, holiday);
        holidaysWithIds.push({ id: docRef.id, ...holiday });
    });

    try {
        await batch.commit();
        return holidaysWithIds.sort((a,b) => a.date.localeCompare(b.date));
    } catch (e) {
        console.error("Error creating initial holidays:", e);
        const permissionError = new FirestorePermissionError({
            path: HOLIDAYS_COLLECTION_PATH,
            operation: 'write',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw permissionError;
    }
}


export const getHolidays = async (db: Firestore): Promise<Holiday[]> => {
  const holidaysQuery = query(
    collection(db, HOLIDAYS_COLLECTION_PATH),
    orderBy('date')
  );
  try {
    const querySnapshot = await getDocs(holidaysQuery);
    if (querySnapshot.empty) {
        return createInitialHolidays(db);
    }
    return querySnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Holiday)
    );
  } catch (e) {
    console.error('Error getting holidays:', e);
    return [];
  }
};

export const addHoliday = async (db: Firestore, holidayData: NewHolidayData) => {
  const holidaysCollection = collection(db, HOLIDAYS_COLLECTION_PATH);
  // Check for duplicates before adding
  const q = query(holidaysCollection, where('date', '==', holidayData.date));
  const existing = await getDocs(q);
  if (!existing.empty) {
    console.log('Holiday for this date already exists.');
    return null; // Or throw an error
  }

  return addDoc(holidaysCollection, holidayData).catch(async (serverError) => {
    console.error('Error adding holiday:', serverError);
    const permissionError = new FirestorePermissionError({
      path: HOLIDAYS_COLLECTION_PATH,
      operation: 'create',
      requestResourceData: holidayData,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });
};

export const deleteHoliday = async (db: Firestore, id: string): Promise<void> => {
  const docRef = doc(db, HOLIDAYS_COLLECTION_PATH, id);
  return deleteDoc(docRef).catch(async (serverError) => {
    console.error('Error deleting holiday:', serverError);
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });
};

export const isHoliday = async (
  db: Firestore,
  date: string
): Promise<Holiday | undefined> => {
  const holidaysCollection = collection(db, HOLIDAYS_COLLECTION_PATH);
  const q = query(holidaysCollection, where('date', '==', date));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Holiday;
  }
  return undefined;
};
