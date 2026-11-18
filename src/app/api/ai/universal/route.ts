import { NextResponse } from 'next/server';
import { runUniversalAi } from '@/ai/flows/universal-ai-flow';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await runUniversalAi(body);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Universal AI API error:', error);
    return NextResponse.json(
      { response: 'AI সহকারী রেসপন্স দিতে পারছে না। অনুগ্রহ করে পুনরায় চেষ্টা করুন।', actionType: 'CHAT' },
      { status: 500 }
    );
  }
}
