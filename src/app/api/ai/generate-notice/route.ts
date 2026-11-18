import { NextResponse } from 'next/server';
import { generateNotice } from '@/ai/flows/generate-notice-flow';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await generateNotice(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Generate Notice AI API error:', error);
    return NextResponse.json(
      { error: error?.message || 'নোটিশ তৈরিতে ত্রুটি ঘটেছে।' },
      { status: 500 }
    );
  }
}
