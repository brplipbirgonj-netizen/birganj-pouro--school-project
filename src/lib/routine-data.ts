'use client';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where,
  Firestore,
  WriteBatch,
  writeBatch,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export interface ClassRoutine {
  id?: string;
  academicYear: string;
  className: string;
  day: string; // রবিবার, সোমবার, etc.
  periods: string[]; // Array of 7 strings like "Subject - Teacher"
}

export const ROUTINE_COLLECTION = 'classRoutines';

// This function will create initial data if the routine is empty.
const createInitialRoutine = async (db: Firestore, academicYear: string): Promise<ClassRoutine[]> => {
    const hardcodedData: Record<string, Record<string, string[]>> = {
    '6': {
        'রবিবার': ['বাংলা ১ম - ওবায়দা', 'গণিত - ধনঞ্জয়', 'বিজ্ঞান - শান্তি', 'বা ও বি - জান্নাতুন', 'বাংলা ২য় - যুধিষ্ঠির', 'আইসিটি - শারমিন', ''],
        'সোমবার': ['কৃষি - জান্নাতুন', 'বাংলা ২য় - যুধিষ্ঠির', 'আইসিটি - শারমিন', 'বা ও বি - জান্নাতুন', 'বাংলা ১ম - ওবায়দা', 'বিজ্ঞান - শান্তি', ''],
        'মঙ্গলবার': ['ইংরেজি ১ম - আরিফুর', 'শারীরিক - মাহাবুর', 'ধর্ম - নীলা', 'ইংরেজি ২য় - যুধিষ্ঠির', 'গণিত - ধনঞ্জয়', 'শারীরিক - মাহাবুর', ''],
        'বুধবার': ['কৃষি - জান্নাতুন', 'গণিত - ধনঞ্জয়', 'ধর্ম - নীলা', 'বাংলা ২য় - যুধিষ্ঠির', 'ইংরেজি ১ম - আরিফুর', 'আইসিটি - শারমিন', ''],
        'বৃহস্পতিবার': ['বা ও বি - জান্নাতুন', 'বাংলা ২য় - যুধিষ্ঠির', 'ইংরেজি ১ম - আরিফুর', 'বাংলা ১ম - ওবায়দা', 'ইংরেজি ২য় - যুধিষ্ঠির', 'বিজ্ঞান - শান্তি', ''],
    },
    '7': {
        'রবিবার': ['ইংরেজি ১ম - আরিফুর', 'শারীরিক - ওবায়দা', 'কৃষি - মাহাবুর', 'ধর্ম - আনিছুর/নীলা', 'বিজ্ঞান - শান্তি', 'ইংরেজি ২য় - যুধিষ্ঠির', ''],
        'সোমবার': ['গণিত - ধনঞ্জয়', 'আইসিটি - শারমিন', 'বা ও বি - আনিছুর', 'কৃষি - মাহাবুর', 'কৃষি - মাহাবুর', 'শারীরিক - ওবায়দা', ''],
        'মঙ্গলবার': ['কৃষি - মাহাবুর', 'বাংলা ২য় - যুধিষ্ঠির', 'বিজ্ঞান - শান্তি', 'গণিত - ধনঞ্জয়', 'ধর্ম - আনিছুর/নীলা', 'বা ও বি - আনিছুর', ''],
        'বুধবার': ['বাংলা ১ম - ওবায়দা', 'ইংরেজি ১ম - আরিফুর', 'ইংরেজি ২য় - আরিফুর', 'কৃষি - মাহাবুর', 'গণিত - ধনঞ্জয়', 'শারীরিক - ওবায়দা', ''],
        'বৃহস্পতিবার': ['গণিত - ধনঞ্জয়', 'বা ও বি - আনিছুর', 'ইংরেজি ২য় - আরিফুর', 'বিজ্ঞান - শান্তি', 'ধর্ম - আনিছুর/নীলা', 'বাংলা ১ম - ওবায়দা', ''],
    },
    '8': {
        'রবিবার': ['বাংলা ২য় - যুধিষ্ঠির', 'ধর্ম - মাহাবুর/নীলা', 'ইংরেজি ১ম - আরিফুর', 'বিজ্ঞান - শান্তি', 'বাংলা ১ম - ওবায়দা', 'বা ও বি - আনিছুর', ''],
        'সোমবার': ['বাংলা ১ম - ওবায়দা', 'গণিত - ধনঞ্জয়', 'বাংলা ২য় - যুধিষ্ঠির', 'বাংলা ২য় - যুধিষ্ঠির', 'ইংরেজি ২য় - আরিফুর', 'ধর্ম - মাহাবুর/নীলা', ''],
        'মঙ্গলবার': ['বাংলা ২য় - যুধিষ্ঠির', 'শারীরিক - নীলা', 'বাংলা ১ম - ওবায়দা', 'গণিত - ধনঞ্জয়', 'আইসিটি - শারমিন', 'ধর্ম - মাহাবুর/নীলা', ''],
        'বুধবার': ['গণিত - ধনঞ্জয়', 'বাংলা ১ম - ওবায়দা', 'কৃষি - জান্নাতুন', 'ধর্ম - মাহাবুর/নীলা', 'বাংলা ২য় - যুধিষ্ঠির', 'আইসিটি - শারমিন', ''],
        'Thursday': ['শারীরিক - নীলা', 'কৃষি - জান্নাতুন', 'গণিত - ধনঞ্জয়', 'কৃষি - জান্নাতুন', 'ইংরেজি ১ম - আরিফুর', 'বিজ্ঞান - শান্তি', ''],
    },
    '9': {
        'রবিবার': ['গণিত - ধনঞ্জয়', 'জীব/পৌরনীতি - শান্তি/জান্নাতুন', 'রসায়ন/ভূগোল - ধনঞ্জয়/শারমিন', 'বাংলা ২য় - যুধিষ্ঠির', 'রসায়ন/ভূগোল - ধনঞ্জয়/শারমিন', 'বা ও বি/বিজ্ঞান - আনিছুর/শান্তি', ''],
        'Monday': ['আইসিটি - শারমিন', 'গণিত - ধনঞ্জয়', 'জীব/পৌরনীতি - শান্তি/জান্নাতুন', 'ইংরেজি ১ম - আরিফুর', 'গণিত - ধনঞ্জয়', 'রসায়ন/ভূগোল - ধনঞ্জয়/শারমিন', ''],
        'Tuesday': ['গণিত - ধনঞ্জয়', 'বাংলা ১ম - ওবায়দা', 'পদার্থ/ইতিহাস - ধনঞ্জয়/জান্নাতুন', 'জীব/পৌরনীতি - শান্তি/জান্নাতুন', 'ধর্ম - মাহাবুর/নীলা', 'বা ও বি/বিজ্ঞান - আনিছুর/শান্তি', ''],
        'Wednesday': ['ইংরেজি ২য় - আরিফুর', 'পদার্থ/ইতিহাস - ধনঞ্জয়/জান্নাতুন', 'কৃষি - মাহাবুর', 'শারীরিক - মাহাবুর', 'উচ্চতর গণিত - ধনঞ্জয়', 'কৃষি - মাহাবুর', ''],
        'Thursday': ['পদার্থ/ইতিহাস - ধনঞ্জয়/জান্নাতুন', 'গণিত - ধনঞ্জয়', 'রসায়ন/ভূগোল - ধনঞ্জয়/শারমিন', 'শারীরিক - মাহাবুর', 'উচ্চতর গণিত - ধনঞ্জয়', 'ধর্ম - মাহাবুর/নীলা', ''],
    },
    '10': {
        'রবিবার': ['আইসিটি - শারমিন', 'জীব/পৌরনীতি - শান্তি/জান্নাতুন', 'বাংলা ২য় - যুধিষ্ঠির', 'ইংরেজি ১ম - আরিফুর', 'বাংলা ১ম - ওবায়দা', 'গণিত - ধনঞ্জয়', ''],
        'Monday': ['আইসিটি - শারমিন', 'ধর্ম - মাহাবুর/নীলা', 'জীব/পৌরনীতি - শান্তি/জান্নাতুন', 'বা ও বি - আনিছুর', 'গণিত - ধনঞ্জয়', 'আইসিটি - শারমিন', ''],
        'Tuesday': ['আইসিটি - শারমিন', 'ইংরেজি ২য় - আরিফুর', 'ধর্ম - মাহাবুর/নীলা', 'ইংরেজি ২য় - আরিফুর', 'জীব/পৌরনীতি - শান্তি/জান্নাতুন', 'কৃষি - মাহাবুর', ''],
        'Wednesday': ['আইসিটি - শারমিন', 'বাংলা ১ম - ওবায়দা', 'বাংলা ২য় - যুধিষ্ঠির', 'বাংলা ১ম - ওবায়দা', 'ধর্ম - মাহাবুর/নীলা', 'ইংরেজি ১ম - আরিফুর', ''],
        'Thursday': ['বাংলা ১ম - ওবায়দা', 'ইংরেজি ১ম - আরিফুর', 'কৃষি - মাহাবুর', 'বাংলা ২য় - যুধিষ্ঠির', 'ধর্ম - মাহাবুর/নীলা', 'আইসিটি - শারমিন', ''],
    },
   };

   const routinesToSave: ClassRoutine[] = [];
   Object.keys(hardcodedData).forEach(className => {
       Object.keys(hardcodedData[className]).forEach(day => {
           routinesToSave.push({
               academicYear: academicYear,
               className,
               day,
               periods: hardcodedData[className][day]
           });
       });
   });
   
   await saveRoutinesBatch(db, routinesToSave);
   return routinesToSave;
};


// Function to get the entire routine for an academic year
export const getFullRoutine = async (db: Firestore, academicYear: string): Promise<ClassRoutine[]> => {
  if (!db) return [];
  
  const q = query(collection(db, ROUTINE_COLLECTION), where("academicYear", "==", academicYear));
  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      // If no routine is found for the year, create it from hardcoded data
      return await createInitialRoutine(db, academicYear);
    }
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassRoutine));
  } catch (e: any) {
    console.error("Error getting full routine:", e);
    if (e.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: ROUTINE_COLLECTION,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    }
    return [];
  }
};


// A batch function to save multiple changes
export const saveRoutinesBatch = async (db: Firestore, routines: ClassRoutine[]) => {
    const batch: WriteBatch = writeBatch(db);

    routines.forEach(routine => {
        const { academicYear, className, day } = routine;
        const docId = `${academicYear}_${className}_${day}`;
        const docRef = doc(db, ROUTINE_COLLECTION, docId);
        
        const dataToSave: any = { ...routine };
        delete dataToSave.id;
        
        batch.set(docRef, dataToSave, { merge: true });
    });

    return batch.commit().catch(async (serverError) => {
      console.error("Error saving routines batch:", serverError);
      const permissionError = new FirestorePermissionError({
        path: ROUTINE_COLLECTION,
        operation: 'write',
        requestResourceData: routines,
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
    });
}
