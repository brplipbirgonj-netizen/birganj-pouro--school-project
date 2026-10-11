'use server';
/**
 * @fileOverview Universal AI Assistant for school management system.
 * Handles ALL modules: notices, attendance, fees, students, results, staff, holidays, navigation.
 */

import { createAiClient, getAvailableApiKeys } from '@/ai/genkit';

export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}

export interface LiveSchoolContext {
  totalStudents?: number;
  studentsSample?: Array<{ roll: number; className: string; name: string; mobile?: string }>;
  todayAttendanceSummary?: string;
  feesSummary?: string;
  upcomingHolidays?: Array<{ date: string; description: string }>;
}

export interface UniversalAiInput {
  query: string;
  academicYear: string;
  institutionName: string;
  currentPage?: string;
  chatHistory?: ChatMessage[];
  liveContext?: LiveSchoolContext;
}

export interface UniversalAiOutput {
  response: string;
  actionType: 'CHAT' | 'NOTICE_DRAFT' | 'NAVIGATE' | 'STUDENT_QUERY' | 'ATTENDANCE_QUERY' | 'FEE_QUERY' | 'RESULT_QUERY' | 'STAFF_QUERY' | 'HOLIDAY_QUERY';
  actionData?: {
    title?: string;
    content?: string;
    priority?: 'normal' | 'important' | 'urgent';
    path?: string;
    [key: string]: any;
  };
}

export async function runUniversalAi(input: UniversalAiInput): Promise<UniversalAiOutput> {
  const year = input.academicYear || new Date().getFullYear().toString();
  const school = input.institutionName || 'বিদ্যালয়';
  const today = new Date().toLocaleDateString('bn-BD', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    timeZone: 'Asia/Dhaka',
  });

  // Build chat history context
  const historyText = (input.chatHistory || [])
    .slice(-6)
    .map(m => `${m.role === 'user' ? 'ব্যবহারকারী' : 'AI'}: ${m.text}`)
    .join('\n');

  // Build live context insights string if provided
  let contextString = '';
  if (input.liveContext) {
    const ctx = input.liveContext;
    const parts: string[] = [];
    if (ctx.totalStudents !== undefined) {
      parts.push(`- মোট নিবন্ধিত শিক্ষার্থী: ${ctx.totalStudents} জন`);
    }
    if (ctx.studentsSample && ctx.studentsSample.length > 0) {
      const sampleList = ctx.studentsSample
        .slice(0, 15)
        .map(s => `[শ্রেণি ${s.className}, রোল ${s.roll}: ${s.name} (মোবাইল: ${s.mobile || 'নেই'})]`)
        .join(', ');
      parts.push(`- ডাটাবেজে উপস্থিত কয়েকজন শিক্ষার্থী: ${sampleList}`);
    }
    if (ctx.upcomingHolidays && ctx.upcomingHolidays.length > 0) {
      const hList = ctx.upcomingHolidays
        .map(h => `${h.date}: ${h.description}`)
        .join('; ');
      parts.push(`- ক্যালেন্ডারের আসন্ন ছুটিসমূহ: ${hList}`);
    }
    if (ctx.todayAttendanceSummary) {
      parts.push(`- আজকের উপস্থিতি তথ্য: ${ctx.todayAttendanceSummary}`);
    }
    if (ctx.feesSummary) {
      parts.push(`- ফি সংক্রান্ত তথ্য: ${ctx.feesSummary}`);
    }
    if (parts.length > 0) {
      contextString = `\nলাইভ স্কুল ডাটাবেজ তথ্য (${year} সেশন):\n${parts.join('\n')}\n`;
    }
  }

  const systemPrompt = `তুমি "${school}"-এর একজন অত্যন্ত দক্ষ, দায়িত্বশীল এবং বুদ্ধিমান ভার্চুয়াল প্রধান শিক্ষক / কেন্দ্রীয় AI সহকারী। তুমি বাংলায় সুন্দর ও প্রমিত ভাষায় কথা বলো।
বর্তমান শিক্ষাবর্ষ: ${year} | আজকের তারিখ: ${today}
বর্তমান পেজ: ${input.currentPage || 'ড্যাশবোর্ড'}

${contextString}

তুমি নিচের সব কাজ সরাসরি সম্পাদন ও উত্তর দিতে পারো:

📋 নোটিশ: যেকোনো আনুষ্ঠানিক নোটিশের নিখুঁত ড্রাফট তৈরি করা
👥 উপস্থিতি: উপস্থিতির তথ্য, হাজিরা রিপোর্ট সম্পর্কে জানানো
💰 ফি: ফি সংক্রান্ত তথ্য, বকেয়া এবং আদায় সম্পর্কে জানানো
👤 ছাত্র: ছাত্রছাত্রী সম্পর্কিত সুনির্দিষ্ট তথ্য ও অনুসন্ধান
📊 ফলাফল: পরীক্ষার ফলাফল সম্পর্কে তথ্য
👨‍🏫 শিক্ষক/কর্মচারী: শিক্ষক ও কর্মচারী সম্পর্কে তথ্য
📅 ছুটি ও রুটিন: ছুটির তারিখ ও ক্লাস রুটিন জানানো
🔗 পেজে নিয়ে যাওয়া: নির্দিষ্ট পেজে instant navigate করা

পেজের পথসমূহ:
- হোম পেজ / প্রধান ড্যাশবোর্ড → /
- নোটিশ বোর্ড → /notices-management
- উপস্থিতি → /attendance
- উপস্থিতি রিপোর্ট → /attendance-report
- ফি সংগ্রহ ও হিসাব → /accounts
- ছাত্র তালিকা → /student-list
- নতুন ছাত্র যোগ → /add-student
- ফলাফল ও মার্কশিট → /results
- ফলাফল আপলোড → /results-upload
- শিক্ষক ও কর্মচারী → /staff
- ক্লাস রুটিন → /routines
- ভর্তি আবেদন → /admission
- ভর্তি ব্যবস্থাপনা → /admissions-management
- সেটিংস ও কনফিগ → /settings

${historyText ? `\nআগের কথোপকথন:\n${historyText}\n` : ''}

ব্যবহারকারীর প্রশ্ন বা নির্দেশ: ${input.query}

IMPORTANT — তুমি MUST শুধুমাত্র নিচের JSON format-এ উত্তর দেবে (কোনো markdown বা extra text নয়):
{
  "response": "বাংলায় সম্পূর্ণ ও গোছানো উত্তর",
  "actionType": "ACTION_TYPE",
  "actionData": {}
}

actionType নির্বাচনের নিয়ম:
- নোটিশ তৈরির অনুরোধ → "NOTICE_DRAFT", actionData-তে { "title": "...", "content": "...", "priority": "normal"|"important"|"urgent" } রাখো
- কোনো পেজে যেতে চাইলে (যেমন হোম পেজ, নোটিশ, হিসাব, ইত্যাদি) → "NAVIGATE", actionData-তে { "path": "উপযুক্ত_পাথ" } রাখো
- ছাত্র সংক্রান্ত → "STUDENT_QUERY"
- উপস্থিতি সংক্রান্ত → "ATTENDANCE_QUERY"
- ফি সংক্রান্ত → "FEE_QUERY"
- ফলাফল সংক্রান্ত → "RESULT_QUERY"
- শিক্ষক সংক্রান্ত → "STAFF_QUERY"
- ছুটি/রুটিন সংক্রান্ত → "HOLIDAY_QUERY"
- অন্য সব → "CHAT"

Raw JSON only, no backticks.`;

  const availableKeys = getAvailableApiKeys();
  const candidateModels = [
    'googleai/gemini-flash-lite-latest',
    'googleai/gemini-flash-latest',
    'googleai/gemini-3.5-flash',
  ];

  let lastError: any = null;
  let text = '';

  keyLoop: for (let k = 0; k < availableKeys.length; k++) {
    const currentKey = availableKeys[k];
    for (let m = 0; m < candidateModels.length; m++) {
      const targetModel = candidateModels[m];
      const client = createAiClient(currentKey, targetModel);
      try {
        const response = await client.generate({
          model: targetModel,
          prompt: systemPrompt,
          config: { responseMimeType: 'application/json' },
        });
        text = response.text?.trim() || '';
        if (text) break keyLoop;
      } catch (err: any) {
        lastError = err;
        console.warn(`[Universal AI Failover] Key #${k + 1} Model ${targetModel} failed:`, err?.message || err);
      }
    }
  }

  if (!text) {
    console.error('Universal AI Failure:', lastError);
    return {
      response: 'দুঃখিত, AI সেবাটি এই মুহূর্তে ব্যস্ত আছে। অনুগ্রহ করে কিছুক্ষণ পরে চেষ্টা করুন।',
      actionType: 'CHAT',
    };
  }

  try {
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      response: parsed.response || 'কোনো উত্তর পাওয়া যায়নি।',
      actionType: parsed.actionType || 'CHAT',
      actionData: parsed.actionData || undefined,
    };
  } catch {
    return { response: text, actionType: 'CHAT' };
  }
}
