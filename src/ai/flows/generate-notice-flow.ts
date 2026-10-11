'use server';
/**
 * @fileOverview AI notice generation flow for professional school communication.
 *
 * - generateNotice - A function that generates professional school notice content using Gemini.
 * - GenerateNoticeInput - The input type for the notice generation.
 * - GenerateNoticeOutput - The return type for the notice generation.
 */

import { ai, createAiClient, getAvailableApiKeys } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateNoticeInputSchema = z.object({
  topic: z.string().describe('The topic or subject of the notice.'),
  academicYear: z.string().optional().describe('The active academic year/session (e.g. 2025, 2026).'),
  institutionName: z.string().optional().describe('The name of the educational institution.'),
});
export type GenerateNoticeInput = z.infer<typeof GenerateNoticeInputSchema>;

const GenerateNoticeOutputSchema = z.object({
  title: z.string().describe('A suitable short title for the notice in Bengali.'),
  content: z.string().describe('The detailed content of the notice in Bengali.'),
});
export type GenerateNoticeOutput = z.infer<typeof GenerateNoticeOutputSchema>;

/**
 * Server action to generate professional school notice with session/academic year awareness.
 */
export async function generateNotice(input: GenerateNoticeInput): Promise<GenerateNoticeOutput> {
  const year = input.academicYear || new Date().getFullYear().toString();
  const school = input.institutionName || 'বিদ্যালয়';

  const systemPrompt = `You are a professional school administrator and principal's secretary at ${school} in Bangladesh.
Current Academic Year / Session: ${year} শিক্ষাবর্ষ।

Your task is to write a formal, highly professional, polished notice in Bengali for school noticeboard.

Topic: ${input.topic}

REQUIREMENTS:
1. SESSION / ACADEMIC YEAR AWARENESS (অত্যন্ত গুরুত্বপূর্ণ):
   - Notice MUST explicitly state and align with "${year} শিক্ষাবর্ষ" (e.g. "${year} শিক্ষাবর্ষের সকল শিক্ষার্থী ও সংশ্লিষ্টদের জানানো যাচ্ছে যে...").
   - If the topic is about a holiday (ছুটি), session break (সেশনের ছুটি), summer/winter/ramadan/eid break, state the reason, holiday dates for the ${year} session, when classes will resume, and instructions for homework/examination preparations for this session.
2. The title must be appropriate, authoritative, and concise (যেমন: "${year} শিক্ষাবর্ষের অবকাশকালীন ছুটির নোটিশ" বা "${input.topic} সংক্রান্ত জরুরি নোটিশ")।
3. Content must be formal and well-structured with clear paragraphs (প্যারাগ্রাফ ও বুলেট পয়েন্ট যদি দরকার হয়)।
4. End with formal authority signoff placeholder (e.g., "আদেশক্রমে, প্রধান শিক্ষক, ${school}")।
5. Output MUST be valid JSON only with keys:
   {
     "title": "...",
     "content": "..."
   }
No markdown backticks, raw JSON only.`;

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
          config: {
            responseMimeType: 'application/json',
          },
        });

        text = response.text?.trim() || '';
        if (text) {
          break keyLoop;
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`[Notice AI Failover] Key #${k + 1} with Model ${targetModel} failed:`, err?.message || err);
      }
    }
  }

  if (!text) {
    console.error("Notice Generation Failure:", lastError);
    throw new Error('AI সেবাটি এই মুহূর্তে ব্যস্ত আছে। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।');
  }

  try {
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    return {
      title: `${year} শিক্ষাবর্ষের নোটিশ`,
      content: text,
    };
  }
}
