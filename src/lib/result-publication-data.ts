'use client';

import { doc, getDoc, setDoc, Firestore, onSnapshot } from 'firebase/firestore';

export interface ExamPublicationRule {
  academicYear: string;
  examName: string;
  isHidden: boolean;         // সম্পূর্ণ লুকানো
  publishFrom: string | null; // ISO date-time string, null = সবসময়
  publishUntil: string | null;// ISO date-time string, null = মেয়াদহীন
}

export interface ResultPublicationSettings {
  globalPublicAccess: boolean;  // সবার জন্য সার্বিক অ্যাক্সেস
  examRules: ExamPublicationRule[];
}

export const defaultResultPublicationSettings: ResultPublicationSettings = {
  globalPublicAccess: true,
  examRules: [],
};

const DOC_PATH = 'school/resultSettings';

export const getResultPublicationSettings = async (
  db: Firestore
): Promise<ResultPublicationSettings> => {
  try {
    const snap = await getDoc(doc(db, 'school', 'resultSettings'));
    if (snap.exists()) {
      return { ...defaultResultPublicationSettings, ...snap.data() } as ResultPublicationSettings;
    }
    return defaultResultPublicationSettings;
  } catch {
    return defaultResultPublicationSettings;
  }
};

export const saveResultPublicationSettings = async (
  db: Firestore,
  settings: ResultPublicationSettings
): Promise<void> => {
  const cleanRules = (settings.examRules || []).map(r => ({
    academicYear: r.academicYear || '',
    examName: r.examName || '',
    isHidden: Boolean(r.isHidden),
    publishFrom: r.publishFrom ?? null,
    publishUntil: r.publishUntil ?? null,
  }));

  const cleanData = {
    globalPublicAccess: Boolean(settings.globalPublicAccess ?? true),
    examRules: cleanRules,
  };

  await setDoc(doc(db, 'school', 'resultSettings'), cleanData, { merge: true });
};

export const subscribeResultPublicationSettings = (
  db: Firestore,
  callback: (settings: ResultPublicationSettings) => void
): (() => void) => {
  try {
    return onSnapshot(
      doc(db, 'school', 'resultSettings'),
      (snap) => {
        if (snap.exists()) {
          callback({ ...defaultResultPublicationSettings, ...snap.data() } as ResultPublicationSettings);
        } else {
          callback(defaultResultPublicationSettings);
        }
      },
      (error) => {
        console.warn('Result settings listener warning:', error);
        callback(defaultResultPublicationSettings);
      }
    );
  } catch (err) {
    console.warn('Failed to subscribe to result settings:', err);
    return () => {};
  }
};

/**
 * Check if an exam result is currently accessible to the public.
 * Returns: { allowed: boolean, reason: string }
 */
export const checkResultAccess = (
  settings: ResultPublicationSettings,
  academicYear: string,
  examName: string
): { allowed: boolean; reason: string } => {
  if (!settings.globalPublicAccess) {
    return { allowed: false, reason: 'ফলাফল প্রকাশ সাময়িকভাবে বন্ধ রাখা হয়েছে।' };
  }

  const rule = settings.examRules.find(
    r => r.academicYear === academicYear && r.examName === examName
  );

  if (!rule) {
    // No rule = allowed by default
    return { allowed: true, reason: '' };
  }

  if (rule.isHidden) {
    return { allowed: false, reason: `"${examName}" এর ফলাফল এখনো প্রকাশ করা হয়নি।` };
  }

  const now = new Date();

  if (rule.publishFrom) {
    const from = new Date(rule.publishFrom);
    if (now < from) {
      const dateStr = from.toLocaleString('bn-BD', { dateStyle: 'long', timeStyle: 'short' });
      return {
        allowed: false,
        reason: `"${examName}" এর ফলাফল ${dateStr} থেকে দেখা যাবে।`
      };
    }
  }

  if (rule.publishUntil) {
    const until = new Date(rule.publishUntil);
    if (now > until) {
      return { allowed: false, reason: `"${examName}" এর ফলাফল দেখার সময়সীমা শেষ হয়ে গেছে।` };
    }
  }

  return { allowed: true, reason: '' };
};
