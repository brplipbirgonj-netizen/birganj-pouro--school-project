
'use client';
/**
 * @fileOverview Dashboard Gallery data services.
 * Handles fetching and updating gallery images and display settings.
 */

import { doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export interface GalleryImage {
    id: string;
    url: string;
    title: string;
    isActive: boolean;
}

export interface GalleryConfig {
    images: GalleryImage[];
    duration: number; // in seconds
}

export const defaultGalleryConfig: GalleryConfig = {
    images: [
        { id: '1', url: 'https://picsum.photos/seed/school1/400/300', title: 'আমাদের বিদ্যালয়', isActive: true },
        { id: '2', url: 'https://picsum.photos/seed/school2/400/300', title: 'লাইব্রেরি', isActive: true },
        { id: '3', url: 'https://picsum.photos/seed/school3/400/300', title: 'খেলার মাঠ', isActive: true }
    ],
    duration: 5
};

const GALLERY_DOC_PATH = 'school/gallery';

/**
 * Fetches the gallery configuration from Firestore.
 */
export const getGalleryConfig = async (db: Firestore): Promise<GalleryConfig> => {
    const docRef = doc(db, GALLERY_DOC_PATH);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { ...defaultGalleryConfig, ...docSnap.data() } as GalleryConfig;
        }
        return defaultGalleryConfig;
    } catch (e) {
        console.error("Error getting gallery config:", e);
        return defaultGalleryConfig;
    }
};

/**
 * Saves the gallery configuration to Firestore.
 */
export const saveGalleryConfig = async (db: Firestore, config: GalleryConfig): Promise<void> => {
    const docRef = doc(db, GALLERY_DOC_PATH);
    return setDoc(docRef, config, { merge: true })
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: GALLERY_DOC_PATH,
                operation: 'write',
                requestResourceData: config,
            });
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
};
