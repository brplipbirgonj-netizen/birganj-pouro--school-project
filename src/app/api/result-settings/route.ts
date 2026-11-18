import { NextResponse } from 'next/server';

const PROJECT_ID = 'birganj-pouro-high-schoo-ce8e5';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

/**
 * ফলাফল প্রকাশ সেটিংস সংরক্ষণ করে।
 * Client-side SDK-এর বদলে Firestore REST API ব্যবহার করা হচ্ছে
 * কারণ Next.js API route-এ user-এর Firebase ID token দিয়ে authenticated হওয়া যায়।
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];

    const body = await request.json();
    const { settings } = body;

    if (!settings) {
      return NextResponse.json({ error: 'settings required' }, { status: 400 });
    }

    // Firestore REST API-তে FieldValue format তৈরি
    const firestoreDoc = {
      fields: {
        resultPublicationSettings: {
          mapValue: {
            fields: {
              globalPublicAccess: {
                booleanValue: Boolean(settings.globalPublicAccess ?? true),
              },
              examRules: {
                arrayValue: {
                  values: (settings.examRules || []).map((r: any) => ({
                    mapValue: {
                      fields: {
                        academicYear: { stringValue: r.academicYear || '' },
                        examName: { stringValue: r.examName || '' },
                        isHidden: { booleanValue: Boolean(r.isHidden) },
                        publishFrom: r.publishFrom
                          ? { stringValue: r.publishFrom }
                          : { nullValue: null },
                        publishUntil: r.publishUntil
                          ? { stringValue: r.publishUntil }
                          : { nullValue: null },
                      },
                    },
                  })),
                },
              },
            },
          },
        },
      },
    };

    // PATCH দিয়ে merge করে update (শুধু resultPublicationSettings field update হবে)
    const url = `${FIRESTORE_BASE}/school/info?updateMask.fieldPaths=resultPublicationSettings`;

    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify(firestoreDoc),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Firestore REST API error:', error);
      return NextResponse.json(
        { error: error?.error?.message || 'Firestore write failed' },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Result settings API error:', error);
    return NextResponse.json(
      { error: error?.message || 'সার্ভার ত্রুটি ঘটেছে।' },
      { status: 500 }
    );
  }
}

/**
 * ফলাফল প্রকাশ সেটিংস পড়ে।
 */
export async function GET(request: Request) {
  try {
    const url = `${FIRESTORE_BASE}/school/info`;
    const response = await fetch(url);

    if (!response.ok) {
      return NextResponse.json(
        { globalPublicAccess: true, examRules: [] }
      );
    }

    const data = await response.json();
    const fields = data?.fields || {};
    const rps = fields?.resultPublicationSettings?.mapValue?.fields;

    if (!rps) {
      return NextResponse.json({ globalPublicAccess: true, examRules: [] });
    }

    const globalPublicAccess = rps?.globalPublicAccess?.booleanValue ?? true;
    const examRulesArr = rps?.examRules?.arrayValue?.values || [];

    const examRules = examRulesArr.map((v: any) => {
      const f = v?.mapValue?.fields || {};
      return {
        academicYear: f?.academicYear?.stringValue || '',
        examName: f?.examName?.stringValue || '',
        isHidden: f?.isHidden?.booleanValue ?? false,
        publishFrom: f?.publishFrom?.stringValue || null,
        publishUntil: f?.publishUntil?.stringValue || null,
      };
    });

    return NextResponse.json({ globalPublicAccess, examRules });
  } catch (error: any) {
    return NextResponse.json({ globalPublicAccess: true, examRules: [] });
  }
}
