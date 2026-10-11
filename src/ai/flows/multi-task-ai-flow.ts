'use server';
/**
 * @fileOverview A multi-tasking AI agent for school administration.
 * Extracts data from images, PDFs, or text for attendance, results, admission, and fees.
 */

import { ai, createAiClient, getAvailableApiKeys } from '@/ai/genkit';
import { z } from 'genkit';

const MultiTaskAiInputSchema = z.object({
  photoDataUri: z.string().optional().describe("Image or PDF as data URI (base64)"),
  rawText: z.string().optional().describe("Manual text instructions or raw data to process"),
  taskType: z.enum(['attendance', 'results', 'admission', 'fees']).describe("The administrative task to perform"),
  academicYear: z.string().optional().describe("Current academic year (e.g. 2026)"),
});

export type MultiTaskAiInput = z.infer<typeof MultiTaskAiInputSchema>;

export const multiTaskAiFlow = ai.defineFlow(
  {
    name: 'multiTaskAiFlow',
    inputSchema: MultiTaskAiInputSchema,
    outputSchema: z.any(),
  },
  async (input) => {
    const parts: any[] = [];
    if (input.photoDataUri) {
      parts.push({ media: { url: input.photoDataUri } });
    }

    const year = input.academicYear || '2026';

    const taskInstructions: Record<string, string> = {
      attendance: `TASK: ATTENDANCE EXTRACTION (হাজিরা গ্রহণ - হস্তলিখিত ও মুদ্রিত উভয় প্রকার, টেবিল হেডার, একাধিক মাস ও বছর সূক্ষ্ম বিশ্লেষণ)
1. LINE-BY-LINE & CELL-BY-CELL ANALYSIS (প্রতিটি লাইন, কলাম হেডার ও টেক্সট নির্দেশনা গভীর মনোযোগ দিয়ে পর্যবেক্ষণ করুন):
   - টেবিল বা ছবির প্রতিটি কলামের হেডার (Header) সতর্কতার সাথে পড়ুন।
   - TWO-LINE / HYPHENATED DAY-MONTH HEADERS (তারিখ-মাস কলাম হেডার শনাক্তকরণ):
     * ছবিতে প্রায়ই দেখা যায় প্রতিটি কলামের মাথায় দিন এবং নিচে মাস লেখা থাকে, অথবা হাইফেন দিয়ে লেখা থাকে, যেমন:
       - "01-10" বা "০১-১০" = ০১ অক্টোবর (Day: 01, Month: 10)
       - "02-১০" = ০২ অক্টোবর (Day: 02, Month: 10)
       - "03-১০" = ০৩ অক্টোবর (Day: 03, Month: 10)
       - "04-09" বা "০৪-০৯" = ০৪ সেপ্টেম্বর (Day: 04, Month: 09)
       - "05-09" = ০৫ সেপ্টেম্বর (Day: 05, Month: 09) ... এবং "27-09" পর্যন্ত!
     * লক্ষ্য করুন: একই টেবিলে বিভিন্ন কলামে বিভিন্ন মাস থাকতে পারে! যেমন প্রথম ৩টি কলাম ১০ম মাস (অক্টোবর) এবং পরের কলামগুলো ৯ম মাস (সেপ্টেম্বর)! প্রতিটি কলামের দিন (DD) এবং মাস (MM) আলাদা করে পড়ে নির্ভুল YYYY-MM-DD তৈরি করতে হবে।
   - BENGALI & ENGLISH NUMBERS:
     * কলাম হেডারে বাংলা বা ইংরেজি যেকোনো সংখ্যা থাকতে পারে (০১, 01, ১০, 10, ০৯, 09)। উভয়টিই সঠিকভাবে ডিকোড করুন।
   - CRITICAL YEAR DETECTION:
     * যদি ডকুমেন্টে বা ইউজারের নির্দেশনায় কোনো বছর (যেমন: ২০২৫, 2025, ২০২৬, 2026) উল্লেখ থাকে, সেই বছর ব্যবহার করুন।
     * উল্লেখ না থাকলে ডিফল্ট শিক্ষাবর্ষ (${year}) ব্যবহার করুন।
   - Always return:
     * dates: Array of ALL detected dates in ISO 'YYYY-MM-DD' format, in the EXACT order they appear in the columns (e.g. ["${year}-10-01", "${year}-10-02", "${year}-10-03", "${year}-09-04", "${year}-09-05", ...]).
     * date: The primary date (first date) in 'YYYY-MM-DD'.
     * monthName: All detected months in Bengali (e.g. "অক্টোবর, সেপ্টেম্বর").
     * detectedYears: Array of academic years found (e.g. ["${year}"]).
     * attendanceByDate: Array of objects for EACH date column:
       [
         { date: "YYYY-MM-DD", year: "YYYY", month: "MM", presentRolls: [1, 2, ...], absentRolls: [...] }
       ]

2. MULTI-CLASS & HANDWRITING RECOGNITION (একাধিক শ্রেণি ও হাতের লেখা শনাক্তকরণ):
   - HANDWRITING: Accurately read handwritten Bengali rolls (১, ২, ৩...), handwritten names, and attendance marks (টিক চিহ্ন ✓, P, উপস্থিত, cross ✗, A, অনুপস্থিত, বা ফাঁকা ঘর)।
   - MULTIPLE CLASSES SUPPORT: If the document contains attendance for MORE THAN ONE CLASS (e.g. ৬ষ্ঠ ও ৭ম শ্রেণি একসাথে, বা একাধিক শ্রেণির রোল লেখা আছে):
     * Extract attendance grouped by class in 'classesAttendance' array:
       [
         { 
           className: "6", 
           presentRolls: [1, 2, 3], 
           absentRolls: [4], 
           students: [{ roll: 1, name: "...", status: "present" }],
           attendanceByDate?: [{ date: "YYYY-MM-DD", presentRolls: [1, 2], absentRolls: [3] }]
         },
         { 
           className: "7", 
           presentRolls: [1, 5], 
           absentRolls: [2], 
           students: [{ roll: 1, name: "...", status: "present" }] 
         }
       ]
   - IF SINGLE CLASS:
     * Set className ('6', '7', '8', '9', '10' or null if not written).
     * If no class is explicitly written, set className to null; the system will match student names and rolls with database.
   - For EVERY student in the document, extract:
     * roll: integer (convert Bengali digits ১..১০ to standard 1..10)
     * name: student name in Bengali (hastily handwritten names should be interpreted to closest Bengali phonetic match)
     * className: class if identifiable ('6', '7', '8', '9', '10') or null
     * status: 'present' (if marked P, উপস্থিত, টিকচিহ্ন ✓, বা রোল লেখা আছে), or 'absent' (if marked A, অনুপস্থিত, ক্রস ✗, বা ফাঁকা).
   - presentRolls: array of present roll numbers (e.g. [1, 2, 3])
   - absentRolls: array of absent roll numbers (e.g. [4])
   - totalStudents, totalPresent, totalAbsent
   - description: Bengali summary of what was extracted (e.g. '২০২৫ সালের সেপ্টেম্বর মাসের ৬ষ্ঠ শ্রেণির এবং ২০২৬ সালের ৭ম শ্রেণির হাজিরা শনাক্ত হয়েছে।')
   - actionPlan: "নির্দিষ্ট শিক্ষাবর্ষ, শ্রেণি ও তারিখসমূহ অনুযায়ী নির্ভুলভাবে ডাটাবেজে সংরক্ষণ করা হবে।"`,

      fees: `TASK: FEE PAYMENT EXTRACTION (বেতন আদায়)
1. DATES & MONTH:
   - Identify payment date (YYYY-MM-DD). If day/month notation (01.02, 01/02), format as ${year}-MM-DD.
   - dates: Array of all payment dates found.
   - date: Primary payment date.
   - monthName: Bengali fee month name (যেমন 'জানুয়ারি', 'ফেব্রুয়ারি').
2. CLASS & STUDENTS:
   - Identify student roll, name, className ('6'..'10' or null if missing).
3. HOW:
   - collections: array of [{ roll: number, name: string, className: string | null, amount: number, feeHead: string, month: string, date: string }]
   - totalAmount: sum of amounts
   - description: Bengali summary of payment records.
   - actionPlan: "শিক্ষার্থীর বেতন আদায় ভাউচারে ডাটা যুক্ত হবে।"`,

      results: `TASK: EXAM RESULTS EXTRACTION (ফলাফল ইনপুট)
1. DATES & EXAM:
   - Exam Name (অর্ধবার্ষিক, বার্ষিক, প্রাক-নির্বাচনী, নির্বাচনী), Subject (বিষয়), Date (YYYY-MM-DD if present).
   - dates: Array of dates found.
2. CLASS & STUDENTS:
   - Class ('6'..'10' or null if missing).
   - results: [{ roll: number, name: string, written: number, mcq: number, practical: number, total: number }]
   - description: Bengali summary of marks detected.
   - actionPlan: "পরীক্ষার ফলাফল এন্ট্রি টেবিলে ডাটা যুক্ত হবে।"`,

      admission: `TASK: ADMISSION FORM EXTRACTION (নতুন ভর্তি)
1. DETAILS:
   - Class ('6'..'10'), academicYear ('${year}').
   - student: { studentNameBn: string, fatherNameBn: string, motherNameBn: string, roll: number, phone: string, className: string, address: string }
   - description: Bengali summary of student admission form.
   - actionPlan: "শিক্ষার্থী ভর্তি রেজিস্টারে নতুন প্রোফাইল তৈরি হবে।"`,
    };

    const taskPrompt = taskInstructions[input.taskType] || taskInstructions.attendance;

    parts.push({
      text: `You are an expert school administrative AI assistant in Bangladesh.
Academic Year: ${year}.

Your mission is to analyze this document (image, PDF, or text) and determine WHERE, HOW, and TO WHOM the data should be assigned.

${taskPrompt}

ADDITIONAL USER INSTRUCTIONS:
${input.rawText || 'None provided'}

GENERAL RULES:
- Convert all Bengali numbers (০-৯) to standard integers (0-9).
- Accurately read handwritten or printed Bengali names and rolls.
- MULTI-DATE SUPPORT: If multiple dates appear (e.g. '01.02, 03' -> ['${year}-02-01', '${year}-02-03']), include all in 'dates' array.
- BENGALI MONTHS: If Bengali month names are written (জানুয়ারি=01, ফেব্রুয়ারি=02, মার্চ=03, এপ্রিল=04, মে=05, জুন=06, জুলাই=07, আগস্ট=08, সেপ্টেম্বর=09, অক্টোবর=10, নভেম্বর=11, ডিসেম্বর=12), map them accurately.
- Output MUST be valid JSON only, without any markdown formatting or surrounding backticks.`
    });

    const availableKeys = getAvailableApiKeys();
    const candidateModels = [
      'googleai/gemini-flash-lite-latest',
      'googleai/gemini-flash-latest',
      'googleai/gemini-3.5-flash',
    ];

    let lastError: any = null;
    let text = '';

    // Automatic multi-key + multi-model failover loop
    keyLoop: for (let k = 0; k < availableKeys.length; k++) {
      const currentKey = availableKeys[k];

      for (let m = 0; m < candidateModels.length; m++) {
        const targetModel = candidateModels[m];
        const client = createAiClient(currentKey, targetModel);

        try {
          const response = await client.generate({
            model: targetModel,
            prompt: parts,
            config: {
              responseMimeType: 'application/json',
            },
          });

          text = response.text?.trim() || '';
          if (text) {
            // Success!
            break keyLoop;
          }
        } catch (err: any) {
          lastError = err;
          const errMsg = String(err?.message || err);
          console.warn(`[AI Failover] Key #${k + 1} with Model ${targetModel} failed: ${errMsg}`);
          // Continue to next model or next key
        }
      }
    }

    if (!text) {
      if (lastError) {
        throw lastError;
      }
      return { error: 'এআই থেকে কোনো তথ্য পাওয়া যায়নি।' };
    }

    try {
      const cleanJson = text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      return { error: 'এআই রেসপন্স পার্স করতে ব্যর্থ হয়েছে।', raw: text };
    }
  }
);

/**
 * Server action to run the multi-task AI flow.
 */
export async function runMultiTaskAi(input: MultiTaskAiInput) {
  try {
    return await multiTaskAiFlow(input);
  } catch (error: any) {
    console.error("AI Error:", error);
    const msg = error?.message || 'AI প্রসেসিং ব্যর্থ হয়েছে।';
    return { error: `AI ত্রুটি: ${msg}` };
  }
}

