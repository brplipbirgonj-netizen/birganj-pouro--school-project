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
