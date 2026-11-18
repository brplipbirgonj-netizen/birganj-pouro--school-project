import { NextResponse } from 'next/server';
import { runMultiTaskAi } from '@/ai/flows/multi-task-ai-flow';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await runMultiTaskAi(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('MultiTask AI API error:', error);
    return NextResponse.json(
      { error: error?.message || 'সার্ভার ত্রুটি ঘটেছে।' },
      { status: 500 }
    );
  }
}
