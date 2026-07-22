
'use client';
import {
  collection,
  getDocs,
  query,
  orderBy,
  Firestore,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { User, userFromDoc, UserRole } from './user';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { defaultPermissions } from './permissions';

const USERS_COLLECTION_PATH = 'users';

export const getUsers = async (db: Firestore): Promise<User[]> => {
  const usersQuery = query(collection(db, USERS_COLLECTION_PATH), orderBy('email'));
  try {
    const querySnapshot = await getDocs(usersQuery);
    return querySnapshot.docs.map(doc => userFromDoc(doc));
  } catch (e) {
    console.error('Error getting users:', e);
    return [];
  }
};


export const updateUserPermissions = async (db: Firestore, uid: string, permissions: string[]): Promise<void> => {
    const userRef = doc(db, USERS_COLLECTION_PATH, uid);
    return updateDoc(userRef, { permissions }).catch(async (serverError: any) => {
        if (serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: { permissions },
            });
            errorEmitter.emit('permission-error', permissionError);
            throw permissionError;
        }
        throw serverError;
    });
};

export const updateUserRole = async (db: Firestore, uid: string, role: UserRole): Promise<void> => {
    const userRef = doc(db, USERS_COLLECTION_PATH, uid);
    // When changing role, reset permissions to the new role's defaults
    const permissions = defaultPermissions[role] || [];
    return updateDoc(userRef, { role, permissions }).catch(async (serverError: any) => {
        if (serverError.code === 'permission-denied') {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: { role, permissions },
            });
            errorEmitter.emit('permission-error', permissionError);
            throw permissionError;
        }
        throw serverError;
    });
};

export const deleteUserRecord = async (db: Firestore, uid: string): Promise<void> => {
    const userRef = doc(db, USERS_COLLECTION_PATH, uid);
    try {
        await deleteDoc(userRef);
    } catch (serverError: any) {
        console.error("Error deleting user record:", serverError);
        if (serverError.code === 'permission-denied' || serverError.message?.includes('permissions')) {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
            throw permissionError;
        }
        throw serverError;
    }
};
