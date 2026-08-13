
import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export interface SchoolInfo {
  id?: string;
  name: string;
  nameEn?: string;
  eiin: string;
  code: string;
  address: string;
  logoUrl: string;
}

// আপনার অ্যাপের আইকন। এটি সরাসরি ছবির লিংক হতে হবে।
export const APP_ICON_URL = 'https://i.postimg.cc/zvsNP6qY/IMG-20260218-WA0002.jpg';

export const defaultSchoolInfo: SchoolInfo = {
    name: 'বীরগঞ্জ পৌর উচ্চ বিদ্যালয়',
    nameEn: 'Birganj Pouro High School',
    eiin: '138244',
    code: '0000',
    address: 'বীরগঞ্জ, দিনাজপুর',
    logoUrl: APP_ICON_URL
};

const SCHOOL_INFO_DOC_PATH = 'school/info';

export const getSchoolInfo = async (db: Firestore): Promise<SchoolInfo> => {
    const docRef = doc(db, SCHOOL_INFO_DOC_PATH);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...defaultSchoolInfo, ...docSnap.data() } as SchoolInfo;
        } else {
            return defaultSchoolInfo;
        }
    } catch (e) {
        console.error("Error getting school info:", e);
        return defaultSchoolInfo;
    }
};

export const saveSchoolInfo = async (db: Firestore, info: Partial<SchoolInfo>): Promise<void> => {
  const docRef = doc(db, SCHOOL_INFO_DOC_PATH);
  const dataToSave = { ...info };
  if ('id' in dataToSave) {
    delete dataToSave.id;
  }

  return setDoc(docRef, dataToSave, { merge: true })
    .catch(async (serverError) => {
      console.error("Error saving school info:", serverError);
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'write',
        requestResourceData: dataToSave,
      });
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
    });
};
