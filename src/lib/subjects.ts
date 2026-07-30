export interface Subject {
    name: string; // Bengali name
    englishName: string;
    code: string;
    practical: boolean;
    fullMarks: number;
    isExamSubject?: boolean;
}

export const subjectNameNormalization: { [key: string]: string } = {
    'ধর্ম শিক্ষা': 'ধর্ম ও নৈতিক শিক্ষা',
    'ইসলাম ধর্ম': 'ধর্ম ও নৈতিক শিক্ষা',
    'হিন্দু ধর্ম': 'ধর্ম ও নৈতিক শিক্ষা',
    'বাংলা ১ম': 'বাংলা প্রথম', 'বাংলা 1st': 'বাংলা প্রথম',
    'বাংলা ২য়': 'বাংলা দ্বিতীয়', 'বাংলা 2nd': 'বাংলা দ্বিতীয়',
    'ইংরেজি ১ম': 'ইংরেজি প্রথম', 'ইংরেজি 1st': 'ইংরেজি প্রথম',
    'ইংরেজী ১ম': 'ইংরেজি প্রথম',
    'ইংরেজি ২য়': 'ইংরেজি দ্বিতীয়', 'ইংরেজি 2nd': 'ইংরেজি দ্বিতীয়',
    'ইংরেজী ২য়': 'ইংরেজি দ্বিতীয়',
    'ইংরেজী২য়': 'ইংরেজি দ্বিতীয়',
    'আইসিটি': 'তথ্য ও যোগাযোগ প্রযুক্তি',
    'বিজিএস': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'বি ও বি পরিচয়': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'বাংলাদেশ ও বিশ্বপরিচয়': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'পদার্থবিজ্ঞান': 'পদার্থ',
    'রসায়ন': 'রসায়ন',
    'জীববিজ্ঞান': 'জীব বিজ্ঞান',
    'সাধারণ গণিত': 'গণিত',
    'সাধারন গণিত': 'গণিত',
    'ম্যাথ': 'গণিত',
    'Mathematics': 'গণিত',
    'Math': 'গণিত',
    'জেনারেল ম্যাথ': 'গণিত',
};

const subjectsFor6to8: Subject[] = [
    { name: 'বাংলা প্রথম', englishName: 'Bangla 1st Paper', code: '101', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'বাংলা দ্বিতীয়', englishName: 'Bangla 2nd Paper', code: '102', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'ইংরেজি প্রথম', englishName: 'English 1st Paper', code: '107', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'ইংরেজি দ্বিতীয়', englishName: 'English 2nd Paper', code: '108', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'গণিত', englishName: 'Mathematics', code: '109', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'ধর্ম ও নৈতিক শিক্ষা', englishName: 'Religion & Moral Education', code: '111', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'তথ্য ও যোগাযোগ প্রযুক্তি', englishName: 'ICT', code: '154', practical: false, fullMarks: 25, isExamSubject: true },
    { name: 'সাধারণ বিজ্ঞান', englishName: 'General Science', code: '127', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'বাংলাদেশ ও বিশ্ব পরিচয়', englishName: 'Bangladesh & Global Studies', code: '150', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'কৃষি শিক্ষা', englishName: 'Agriculture Studies', code: '134', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'শারীরিক শিক্ষা', englishName: 'Physical Education', code: '147', practical: false, fullMarks: 0, isExamSubject: false },
];

const commonSubjectsFor9to10: Subject[] = [
    { name: 'বাংলা প্রথম', englishName: 'Bangla 1st Paper', code: '101', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'বাংলা দ্বিতীয়', englishName: 'Bangla 2nd Paper', code: '102', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'ইংরেজি প্রথম', englishName: 'English 1st Paper', code: '107', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'ইংরেজি দ্বিতীয়', englishName: 'English 2nd Paper', code: '108', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'গণিত', englishName: 'Mathematics', code: '109', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'ধর্ম ও নৈতিক শিক্ষা', englishName: 'Religion & Moral Education', code: '111', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'তথ্য ও যোগাযোগ প্রযুক্তি', englishName: 'ICT', code: '154', practical: false, fullMarks: 25, isExamSubject: true },
];

const scienceSubjects: Subject[] = [
    { name: 'বাংলাদেশ ও বিশ্ব পরিচয়', englishName: 'Bangladesh & Global Studies', code: '150', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'পদার্থ', englishName: 'Physics', code: '136', practical: true, fullMarks: 100, isExamSubject: true },
    { name: 'রসায়ন', englishName: 'Chemistry', code: '137', practical: true, fullMarks: 100, isExamSubject: true },
    { name: 'জীব বিজ্ঞান', englishName: 'Biology', code: '138', practical: true, fullMarks: 100, isExamSubject: true },
    { name: 'কৃষি শিক্ষা', englishName: 'Agriculture Studies', code: '134', practical: true, fullMarks: 100, isExamSubject: true },
    { name: 'উচ্চতর গণিত', englishName: 'Higher Mathematics', code: '126', practical: true, fullMarks: 100, isExamSubject: true },
];

const artsSubjects: Subject[] = [
    { name: 'সাধারণ বিজ্ঞান', englishName: 'General Science', code: '127', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা', englishName: 'Bangladesh History & World Civilization', code: '153', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'ভূগোল ও পরিবেশ', englishName: 'Geography & Environment', code: '110', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'পৌরনীতি ও নাগরিকতা', englishName: 'Civics & Citizenship', code: '140', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'কৃষি শিক্ষা', englishName: 'Agriculture Studies', code: '134', practical: true, fullMarks: 100, isExamSubject: true },
];

const commerceSubjects: Subject[] = [
    { name: 'সাধারণ বিজ্ঞান', englishName: 'General Science', code: '127', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'হিসাব বিজ্ঞান', englishName: 'Accounting', code: '146', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'ফিন্যান্স ও ব্যাংকিং', englishName: 'Finance & Banking', code: '152', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'ব্যবসায় উদ্যোগ', englishName: 'Business Entrepreneurship', code: '143', practical: false, fullMarks: 100, isExamSubject: true },
    { name: 'কৃষি শিক্ষা', englishName: 'Agriculture Studies', code: '134', practical: true, fullMarks: 100, isExamSubject: true },
];

export const getSubjects = (className: string, group?: string): Subject[] => {
    if (['6', '7', '8'].includes(className)) {
        return subjectsFor6to8;
    }
    
    const normalizedGroup = group?.toLowerCase().trim();

    if (['9', '10'].includes(className)) {
        const uniqueSubjects = new Map<string, Subject>();
        commonSubjectsFor9to10.forEach(s => uniqueSubjects.set(s.name, s));

        if (normalizedGroup === 'science' || normalizedGroup === 'বিজ্ঞান') {
            scienceSubjects.forEach(s => uniqueSubjects.set(s.name, s));
        } else if (normalizedGroup === 'arts' || normalizedGroup === 'মানবিক' || normalizedGroup === 'humanities') {
            artsSubjects.forEach(s => uniqueSubjects.set(s.name, s));
        } else if (normalizedGroup === 'commerce' || normalizedGroup === 'ব্যবসায় শিক্ষা' || normalizedGroup === 'business') {
            commerceSubjects.forEach(s => uniqueSubjects.set(s.name, s));
        } else {
            // Union of all subjects for the "All Groups" view
            [...scienceSubjects, ...artsSubjects, ...commerceSubjects].forEach(s => {
                if (!uniqueSubjects.has(s.name)) {
                    uniqueSubjects.set(s.name, s);
                }
            });
        }

        return Array.from(uniqueSubjects.values());
    }
    return [];
};