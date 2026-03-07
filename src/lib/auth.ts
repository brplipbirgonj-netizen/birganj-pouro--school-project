
'use client';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  query,
  where,
  limit,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import type { UserRole } from './user';
import { defaultPermissions } from './permissions';


export async function signUp(email: string, password: string): Promise<{ success: boolean; role?: UserRole; error?: string }> {
  const auth = getAuth();
  const db = getFirestore();
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Check if any admin exists in the system
    let role: UserRole = 'teacher';
    let displayName = email.split('@')[0];

    try {
        const usersRef = collection(db, 'users');
        const adminQuery = query(usersRef, where('role', '==', 'admin'), limit(1));
        const adminSnapshot = await getDocs(adminQuery);
        
        // If no admin exists, first user is admin
        if (adminSnapshot.empty) {
            role = 'admin';
            displayName = 'System Admin';
        } else {
            // Check if user is in staff/teacher list
            const staffRef = collection(db, 'staff');
            const teacherQuery = query(staffRef, where('email', '==', email.toLowerCase()), limit(1));
            const teacherSnapshot = await getDocs(teacherQuery);

            if (!teacherSnapshot.empty) {
                const staffData = teacherSnapshot.docs[0].data();
                displayName = staffData.nameBn || displayName;
            }
        }
    } catch (e) {
        // If collection doesn't exist yet or query fails, assume this is the first user
        role = 'admin';
        displayName = 'System Admin';
    }

    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      role: role,
      displayName: displayName,
      isOnline: true,
      permissions: defaultPermissions[role] || [],
      lastLoginAt: serverTimestamp(),
    });

    return { success: true, role: role };

  } catch (error: any) {
    console.error("Signup error:", error);
    if (error.code === 'auth/email-already-in-use') {
        return { success: false, error: 'এই ইমেইল দিয়ে ইতিমধ্যে একটি একাউন্ট তৈরি করা আছে।' };
    }
    return { success: false, error: 'নিবন্ধন করা যায়নি। ' + (error.message || '') };
  }
}

export async function signIn(email: string, password: string, role: UserRole): Promise<{ success: boolean; error?: string }> {
  const auth = getAuth();
  const db = getFirestore();
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
        await setDoc(userDocRef, {
            uid: user.uid,
            email: user.email,
            role: role,
            isOnline: true,
            permissions: defaultPermissions[role] || [],
            lastLoginAt: serverTimestamp(),
        });
        return { success: true };
    }

    if (userDoc.data().role !== role) {
      await firebaseSignOut(auth);
      return { success: false, error: 'আপনার ভূমিকা (role) সঠিক নয়।' };
    }

    await setDoc(userDocRef, { 
      isOnline: true,
      lastLoginAt: serverTimestamp() 
    }, { merge: true });

    return { success: true };
  } catch (error: any) {
     console.error("Signin error:", error);
     if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      return { success: false, error: 'আপনার ইমেইল অথবা পাসওয়ার্ড ভুল।' };
    }
    return { success: false, error: 'লগইন করা যায়নি।' };
  }
}

export async function signOut() {
  const auth = getAuth();
  const db = getFirestore();
  const user = auth.currentUser;
  
  if (user) {
    const userDocRef = doc(db, 'users', user.uid);
    try {
      // IMPORTANT: Wait for online status update before actual sign-out
      // This prevents permission denied errors because we are still authed
      await updateDoc(userDocRef, { isOnline: false });
    } catch (e) {
      // Silent catch to ensure signout proceeds even if firestore write fails
      console.log("Logout: Online status update skipped.");
    }
  }
  
  return firebaseSignOut(auth);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const auth = getAuth();
  const user = auth.currentUser;

  if (!user || !user.email) {
    return { success: false, error: 'ব্যবহারকারী লগইন করা নেই।' };
  }

  try {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    return { success: true };
  } catch (error: any) {
    if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      return { success: false, error: 'আপনার বর্তমান পাসওয়ার্ডটি ভুল।' };
    }
    return { success: false, error: 'পাসওয়ার্ড পরিবর্তন করা যায়নি।' };
  }
}
