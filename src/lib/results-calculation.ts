'use client';
import type { Student } from './student-data';
import { getSubjects, subjectNameNormalization } from './subjects';
import type { ClassResult, StudentResult } from './results-data';
import type { Subject } from './subjects';

export interface GradeInfo {
  grade: string;
  point: number;
}

export interface StudentSubjectResult {
    written?: number;
    mcq?: number;
    practical?: number;
    marks: number;
    fullMarks: number;
    grade: string;
    point: number;
    isPass: boolean;
    writtenFail?: boolean;
    mcqFail?: boolean;
    practicalFail?: boolean;
}

export interface StudentProcessedResult {
    student: Student;
    totalMarks: number;
    totalPossibleMarks: number;
    gpa: number;
    finalGrade: string;
    isPass: boolean;
    isAbsent?: boolean;
    failedSubjectsCount: number;
    meritPosition?: number;
    subjectResults: Map<string, StudentSubjectResult>;
}

export const getGradePoint = (percentage: number): GradeInfo => {
    if (percentage < 33) return { grade: 'F', point: 0.0 };
    if (percentage < 40) return { grade: 'D', point: 1.0 };
    if (percentage < 50) return { grade: 'C', point: 2.0 };
    if (percentage < 60) return { grade: 'B', point: 3.0 };
    if (percentage < 70) return { grade: 'A-', point: 3.5 };
    if (percentage < 80) return { grade: 'A', point: 4.0 };
    return { grade: 'A+', point: 5.0 };
};

const getFinalGrade = (gpa: number): string => {
    if (gpa === 5.0) return 'A+';
    if (gpa >= 4.0) return 'A';
    if (gpa >= 3.5) return 'A-';
    if (gpa >= 3.0) return 'B';
    if (gpa >= 2.0) return 'C';
    if (gpa >= 1.0) return 'D';
    return 'F';
}

const normalize = (name: string) => {
    if (!name) return "";
    const trimmed = name.trim();
    return (subjectNameNormalization[trimmed] || trimmed).toLowerCase();
};

const groupMap: Record<string, string> = { 
    'science': 'science', 'বিজ্ঞান': 'science', 'Science': 'science', 'বিজ্ঞান শাখা': 'science',
    'arts': 'arts', 'মানবিক': 'arts', 'humanities': 'arts', 'humanity': 'arts', 'Arts': 'arts', 'মানবিক শাখা': 'arts',
    'commerce': 'commerce', 'ব্যবসায় শিক্ষা': 'commerce', 'business': 'commerce', 'Commerce': 'commerce', 'ব্যবসায় শিক্ষা শাখা': 'commerce',
    'none': 'none', 'all': 'none', 'general': 'none', '': 'none'
};

export function checkPartFails(params: {
    subjectName: string;
    fullMarks: number;
    written?: number;
    mcq?: number;
    practical?: number;
    writtenLimit?: number;
    mcqLimit?: number;
    practicalLimit?: number;
    hasPractical?: boolean;
}): { writtenFail: boolean; mcqFail: boolean; practicalFail: boolean; isPass: boolean } {
    const { subjectName, fullMarks, written, mcq, practical } = params;
    const normalizedSubjectName = normalize(subjectName);
    
    const isEnglish = normalizedSubjectName === normalize('ইংরেজি প্রথম') || normalizedSubjectName === normalize('ইংরেজি দ্বিতীয়');
    const isIct = normalizedSubjectName.includes('তথ্য ও যোগাযোগ') || normalizedSubjectName.includes('আইসিটি') || normalizedSubjectName === 'ict';

    let writtenFail = false;
    let mcqFail = false;
    let practicalFail = false;

    const obtainedMarks = (written || 0) + (mcq || 0) + (practical || 0);
    const overallPassMark = Math.ceil(fullMarks * 0.33);
    const isOverallFail = obtainedMarks < overallPassMark;

    if (!isEnglish) {
        if (isIct) {
            // ১. ICT (আইসিটি) পাশের লজিক: আইসিটির জন্য বিশেষ পাশের নিয়ম (নৈবেত্তিকে অন্তত ৮ এবং ব্যবহারিকে অন্তত ৮)
            if (mcq !== undefined && mcq < 8) mcqFail = true;
            if (practical !== undefined && practical < 8) practicalFail = true;
            if (params.writtenLimit && params.writtenLimit > 0 && written !== undefined && written < Math.ceil(params.writtenLimit * 0.33)) {
                writtenFail = true;
            }
        } else if (fullMarks === 100) {
            const hasPrac = (params.practicalLimit !== undefined && params.practicalLimit > 0) || params.hasPractical;
            if (hasPrac) {
                if (written !== undefined && written < 17) writtenFail = true;
                if (mcq !== undefined && mcq < 8) mcqFail = true;
                if (practical !== undefined && practical < 8) practicalFail = true;
            } else {
                if (written !== undefined && written < 23) writtenFail = true;
                if (mcq !== undefined && mcq < 10) mcqFail = true;
            }
        } else if (fullMarks === 50) {
            const hasPrac = (params.practicalLimit !== undefined && params.practicalLimit > 0) || params.hasPractical;
            if (hasPrac) {
                if (written !== undefined && written < 8) writtenFail = true;
                if (mcq !== undefined && mcq < 8) mcqFail = true;
                if (practical !== undefined && practical < 8) practicalFail = true;
            } else {
                if (written !== undefined && written < 12) writtenFail = true;
                if (mcq !== undefined && mcq < 5) mcqFail = true;
            }
        } else if (fullMarks === 25) {
            if (mcq !== undefined && mcq < 8) mcqFail = true;
            if (practical !== undefined && practical < 8) practicalFail = true;
            if (written !== undefined && written < 8) writtenFail = true;
        } else {
            if (params.writtenLimit && params.writtenLimit > 0 && written !== undefined && written < Math.ceil(params.writtenLimit * 0.33)) {
                writtenFail = true;
            }
            if (params.mcqLimit && params.mcqLimit > 0 && mcq !== undefined && mcq < Math.ceil(params.mcqLimit * 0.33)) {
                mcqFail = true;
            }
            if (params.practicalLimit && params.practicalLimit > 0 && practical !== undefined && practical < Math.ceil(params.practicalLimit * 0.33)) {
                practicalFail = true;
            }
        }
    }

    const isPass = !isOverallFail && !writtenFail && !mcqFail && !practicalFail;
    return { writtenFail, mcqFail, practicalFail, isPass };
}

export function processStudentResults(
    students: Student[],
    resultsBySubject: ClassResult[],
    allSubjectsForGroup: Subject[]
): StudentProcessedResult[] {

    return students.map(student => {
        const rawGroup = (student.group || 'none').toLowerCase().trim();
        const studentGroupNormalized = groupMap[rawGroup] || rawGroup;
        
        let optionalSubjectNameNormalized = normalize(student.optionalSubject || '');
        const studentClassNum = parseInt(student.className);

        const groupAllowedSubjects = getSubjects(student.className, studentGroupNormalized);
        
        const subjectsForStudent = groupAllowedSubjects.filter(subInfo => {
            const currentSubNameNormalized = normalize(subInfo.name);
            
            if (studentClassNum >= 9) {
                const hmNorm = normalize('উচ্চতর গণিত');
                const agriNorm = normalize('কৃষি শিক্ষা');
                
                if (currentSubNameNormalized === hmNorm || currentSubNameNormalized === agriNorm) {
                    if (optionalSubjectNameNormalized) {
                        return currentSubNameNormalized === optionalSubjectNameNormalized;
                    }
                    
                    const studentHasMarks = resultsBySubject.some(r => {
                        const nameMatch = normalize(r.subject) === currentSubNameNormalized;
                        if (!nameMatch) return false;
                        const studentResult = r.results.find(res => res.studentId === student.id);
                        return studentResult && (studentResult.written !== undefined || studentResult.mcq !== undefined || studentResult.practical !== undefined);
                    });
                    
                    return studentHasMarks;
                }
            }
            return true;
        });

        let totalMarks = 0;
        let totalPossibleMarks = 0;
        let hasAnyMarkEntered = false;
        const subjectResultsMap = new Map<string, StudentSubjectResult>();

        subjectsForStudent.forEach(subjectInfo => {
            const normalizedSubjectName = normalize(subjectInfo.name);
            
            // Candidate records matching subject and className
            const candidateRecords = resultsBySubject.filter(r => {
                return normalize(r.subject) === normalizedSubjectName && String(r.className) === String(student.className);
            });

            // Priority & Smart Data Merging across student's own group and general/none record
            const groupRecord = candidateRecords.find(r => {
                const rGroupRaw = (r.group || 'none').toLowerCase().trim();
                const rGroupNorm = groupMap[rGroupRaw] || rGroupRaw;
                return rGroupNorm === studentGroupNormalized;
            });
            const groupStudentResult = groupRecord?.results.find(res => res.studentId === student.id);

            const generalRecord = candidateRecords.find(r => {
                const rGroupRaw = (r.group || 'none').toLowerCase().trim();
                const rGroupNorm = groupMap[rGroupRaw] || rGroupRaw;
                return rGroupNorm === 'none' || rGroupNorm === 'all' || !r.group;
            });
            const generalStudentResult = generalRecord?.results.find(res => res.studentId === student.id);

            const anyOtherRecord = candidateRecords.find(r => r.results.some(res => res.studentId === student.id && (res.written !== undefined || res.mcq !== undefined || res.practical !== undefined)));
            const anyOtherStudentResult = anyOtherRecord?.results.find(res => res.studentId === student.id);

            // Merge marks with student's own group having priority, falling back to general/none record
            const written = groupStudentResult?.written !== undefined ? groupStudentResult.written 
                : (generalStudentResult?.written !== undefined ? generalStudentResult.written : anyOtherStudentResult?.written);

            const mcq = groupStudentResult?.mcq !== undefined ? groupStudentResult.mcq 
                : (generalStudentResult?.mcq !== undefined ? generalStudentResult.mcq : anyOtherStudentResult?.mcq);

            const practical = groupStudentResult?.practical !== undefined ? groupStudentResult.practical 
                : (generalStudentResult?.practical !== undefined ? generalStudentResult.practical : anyOtherStudentResult?.practical);

            const activeRecord = (groupRecord?.fullMarks && groupRecord.fullMarks > 0) ? groupRecord 
                : ((generalRecord?.fullMarks && generalRecord.fullMarks > 0) ? generalRecord : (anyOtherRecord || candidateRecords[0]));

            const fullMarks = activeRecord?.fullMarks || subjectInfo.fullMarks;
            const writtenLimit = activeRecord?.writtenLimit ?? generalRecord?.writtenLimit;
            const mcqLimit = activeRecord?.mcqLimit ?? generalRecord?.mcqLimit;
            const practicalLimit = activeRecord?.practicalLimit ?? generalRecord?.practicalLimit;

            const obtainedMarks = (written || 0) + (mcq || 0) + (practical || 0);

            const isIct = normalizedSubjectName.includes('তথ্য ও যোগাযোগ') || normalizedSubjectName.includes('আইসিটি') || normalizedSubjectName === 'ict';
            const hasPractical = subjectInfo.practical || isIct;

            const partFails = checkPartFails({
                subjectName: subjectInfo.name,
                fullMarks,
                written,
                mcq,
                practical,
                writtenLimit,
                mcqLimit,
                practicalLimit,
                hasPractical,
            });

            const isPassSubject = partFails.isPass;
            const percentageForGrade = fullMarks > 0 ? (obtainedMarks / fullMarks) * 100 : 0;
            const { grade, point } = getGradePoint(percentageForGrade);
            
            if (written !== undefined || mcq !== undefined || practical !== undefined) {
                hasAnyMarkEntered = true;
            }

            totalMarks += obtainedMarks;
            totalPossibleMarks += fullMarks;
            
            subjectResultsMap.set(subjectInfo.name, {
                written,
                mcq,
                practical,
                marks: obtainedMarks,
                fullMarks: fullMarks,
                grade: isPassSubject ? grade : 'F',
                point: isPassSubject ? point : 0,
                isPass: isPassSubject,
                writtenFail: partFails.writtenFail,
                mcqFail: partFails.mcqFail,
                practicalFail: partFails.practicalFail
            });
        });
        
        let totalCompulsoryPoints = 0;
        let compulsorySubjectsCount = 0;
        let failedInCompulsoryCount = 0;
        let bonusPoints = 0;

        subjectsForStudent.forEach(subjectInfo => {
            const result = subjectResultsMap.get(subjectInfo.name);
            const isOptional = normalize(subjectInfo.name) === optionalSubjectNameNormalized;

            if (isOptional) {
                if (result && result.isPass && result.point > 2.0) {
                    bonusPoints = result.point - 2.0;
                }
            } else if (subjectInfo.fullMarks > 0) {
                compulsorySubjectsCount++;
                if (!result || !result.isPass) {
                    failedInCompulsoryCount++;
                } else {
                    totalCompulsoryPoints += result.point;
                }
            }
        });

        let effectiveCompulsoryCount = compulsorySubjectsCount;
        if (studentClassNum >= 9 && effectiveCompulsoryCount > 11) {
            effectiveCompulsoryCount = 11;
        }

        const isAbsent = !hasAnyMarkEntered;
        const isPass = !isAbsent && failedInCompulsoryCount === 0;
        let gpa = 0;

        if (isPass && effectiveCompulsoryCount > 0) {
            gpa = (totalCompulsoryPoints + bonusPoints) / effectiveCompulsoryCount;
            if (gpa > 5.0) gpa = 5.0;
        }
        
        const finalGrade = isPass ? getFinalGrade(gpa) : 'F';
        
        return {
            student,
            totalMarks,
            totalPossibleMarks,
            gpa: isPass ? parseFloat(gpa.toFixed(2)) : 0.0,
            finalGrade,
            isPass,
            isAbsent,
            failedSubjectsCount: isAbsent ? compulsorySubjectsCount : failedInCompulsoryCount,
            subjectResults: subjectResultsMap,
        };
    }).sort((a, b) => {
        if (a.isPass !== b.isPass) return a.isPass ? -1 : 1;
        if (a.isPass) {
            if (b.gpa !== a.gpa) return b.gpa - a.gpa;
            if (b.totalMarks !== a.totalMarks) return b.totalMarks - a.totalMarks;
            return a.student.roll - b.student.roll;
        }
        if (a.isAbsent !== b.isAbsent) return a.isAbsent ? 1 : -1;
        if (a.failedSubjectsCount !== b.failedSubjectsCount) return a.failedSubjectsCount - b.failedSubjectsCount;
        return b.totalMarks - a.totalMarks;
    }).map((res, idx, self) => {
        if (!res.isPass) return res;
        let meritPosition = idx + 1;
        if (idx > 0) {
            const prev = self[idx - 1];
            if (prev.isPass && prev.gpa === res.gpa && prev.totalMarks === res.totalMarks) {
                meritPosition = (prev as StudentProcessedResult).meritPosition!;
            }
        }
        return { ...res, meritPosition };
    });
}