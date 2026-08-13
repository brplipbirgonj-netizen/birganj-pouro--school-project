'use client';
import {
  collection,
  Timestamp,
  Firestore,
  getDocs,
  query,
  where,
  QueryDocumentSnapshot
} from 'firebase/firestore';

export type FeeBreakdown = {
  tuitionCurrent?: number;
  tuitionAdvance?: number;
  tuitionDue?: number;
  tuitionFine?: number;
  examFeeHalfYearly?: number;
  examFeeAnnual?: number;
  examFeePreNirbachoni?: number;
  examFeeNirbachoni?: number;
  sessionFee?: number;
  admissionFee?: number;
  scoutFee?: number;
  developmentFee?: number;
  libraryFee?: number;
  tiffinFee?: number;
};

export type FeeCollection = {
  id: string;
  studentId: string;
  academicYear: string;
  collectionDate: Date;
  description: string;
  totalAmount: number;
  collectorName?: string;
  collectorUid?: string;
  transactionIds: string[];
  breakdown: FeeBreakdown;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

const FEE_COLLECTION_PATH = 'feeCollections';

export const feeCollectionFromDoc = (docSnap: QueryDocumentSnapshot): FeeCollection | null => {
    const data = docSnap.data();
    if (!data) return null;

    let collectionDate: Date | null = null;

    if (data.collectionDate) {
        if (typeof data.collectionDate.toDate === 'function') {
            collectionDate = data.collectionDate.toDate();
        } else if (data.collectionDate instanceof Timestamp) {
            collectionDate = data.collectionDate.toDate();
        } else if (data.collectionDate.seconds !== undefined) {
            collectionDate = new Timestamp(data.collectionDate.seconds, data.collectionDate.nanoseconds || 0).toDate();
        } else {
            const parsed = new Date(data.collectionDate);
            if (!isNaN(parsed.getTime())) {
                collectionDate = parsed;
            }
        }
    }
    
    if (!collectionDate) {
        collectionDate = new Date(); // Fallback
    }

    return {
        id: docSnap.id,
        ...data,
        collectionDate: collectionDate,
    } as FeeCollection;
}

export const getFeeCollectionsForStudent = async (db: Firestore, studentId: string, academicYear: string): Promise<FeeCollection[]> => {
  const q = query(
    collection(db, FEE_COLLECTION_PATH),
    where("studentId", "==", studentId),
    where("academicYear", "==", academicYear)
  );
  try {
    const querySnapshot = await getDocs(q);
    const collections = querySnapshot.docs
        .map(feeCollectionFromDoc)
        .filter((item): item is FeeCollection => item !== null)
        .sort((a, b) => b.collectionDate.getTime() - a.collectionDate.getTime());

    return collections;
  } catch (e) {
    console.error("Error getting fee collections:", e);
    return [];
  }
};
