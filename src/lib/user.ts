
'use client';
import { Timestamp, type DocumentData } from 'firebase/firestore';

export type UserRole = 'admin' | 'teacher';

export interface User {
  uid: string;
  email: string | null;
  role: UserRole;
  photoUrl?: string;
  displayName?: string;
  isOnline?: boolean;
  permissions?: string[];
  lastLoginAt?: Date;
}

export const userFromDoc = (doc: any): User => {
    const data = doc.data();
    return {
        uid: doc.id,
        email: data.email,
        role: data.role,
        photoUrl: data.photoUrl,
        displayName: data.displayName,
        isOnline: data.isOnline || false,
        permissions: data.permissions || [],
        lastLoginAt: data.lastLoginAt instanceof Timestamp ? data.lastLoginAt.toDate() : (data.lastLoginAt ? new Date(data.lastLoginAt) : undefined),
    } as User;
}
