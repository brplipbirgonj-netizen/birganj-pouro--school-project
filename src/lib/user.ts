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
    
    // Robust parsing of lastLoginAt field
    let lastLoginAt: Date | undefined = undefined;
    if (data.lastLoginAt) {
        if (typeof data.lastLoginAt.toDate === 'function') {
            lastLoginAt = data.lastLoginAt.toDate();
        } else if (data.lastLoginAt instanceof Timestamp) {
            lastLoginAt = data.lastLoginAt.toDate();
        } else if (data.lastLoginAt.seconds !== undefined) {
            lastLoginAt = new Timestamp(data.lastLoginAt.seconds, data.lastLoginAt.nanoseconds || 0).toDate();
        } else {
            const parsed = new Date(data.lastLoginAt);
            if (!isNaN(parsed.getTime())) {
                lastLoginAt = parsed;
            }
        }
    }

    return {
        uid: doc.id,
        email: data.email,
        role: data.role,
        photoUrl: data.photoUrl,
        displayName: data.displayName,
        isOnline: data.isOnline || false,
        permissions: data.permissions || [],
        lastLoginAt: lastLoginAt,
    } as User;
}
