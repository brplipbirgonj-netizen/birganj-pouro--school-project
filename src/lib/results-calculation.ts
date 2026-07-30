'use client';
import type { Student } from './student-data';
import { getSubjects, subjectNameNormalization } from './subjects';
import type { ClassResult } from './results-data';
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
    grade: string;
    point: number;
    isPass: boolean;
}

export interface StudentProcessedResult {
    student: Student;
    totalMarks: number;
    totalPossibleMarks: number;
    gpa: number;
    finalGrade: string;
    isPass: boolean;
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

/**
 * Normalizes a subject name for comparison
 */
const normalize = (name: string) => {
    if (!name) return "";
    const trimmed = name.trim();
    return (subjectNameNormalization[trimmed] || trimmed).toLowerCase();
};

const groupMap: Record<string, string> = { 
    'science': 'science', 'বিজ্ঞান': 'science',
    'arts': 'arts', 'মানবিক': 'arts', 'humanities': 'arts',
    'commerce': 'commerce', 'ব্যবসায় শিক্ষা': 'commerce', 'business': 'commerce'
};

export function processStudentResults(
    students: Student[],
    resultsBySubject: ClassResult[],
    allSubjectsForGroup: Subject[]
): StudentProcessedResult[] {

    const studentResults: StudentProcessedResult[] = students.map(student => {
        const rawGroup = (student.group || '').toLowerCase().trim();
        const studentGroupNormalized = groupMap[rawGroup] || rawGroup;
        const optionalSubjectName = student.optionalSubject;

        // Get the subjects actually allowed/expected for this student's specific group
        const groupAllowedSubjects = getSubjects(student.className, studentGroupNormalized).map(s => s.name);

        const subjectsForStudent = allSubjectsForGroup.filter(subjectInfo => {
            if (student.className < '9') return true;

            // Important: If we are in "All Groups" view, the allSubjectsForGroup list is the Union.
            // We must only process subjects that this specific student actually takes.
            if (!groupAllowedSubjects.some(name => normalize(name) === normalize(subjectInfo.name))) return false;

            if (optionalSubjectName === 'উচ্চতর গণিত' && subjectInfo.name === 'কৃষি শিক্ষা') return false;
            if (optionalSubjectName === 'কৃষি শিক্ষা' && subjectInfo.name === 'উচ্চতর গণিত') return false;
            
            return true;
        });

        let totalMarks = 0;
        let totalPossibleMarks = 0;
        const subjectResults = new Map<string, StudentSubjectResult>();

        subjectsForStudent.forEach(subjectInfo => {
            const normalizedSubjectName = normalize(subjectInfo.name);
            
            // ROBUST MATCHING: Find the specific result document for this subject.
            const matchingRecords = resultsBySubject.filter(r => 
                normalize(r.subject) === normalizedSubjectName && 
                r.className === student.className
            );

            // Priority 1: Match by direct Student ID inclusion in the record's results array
            let classResult = matchingRecords.find(r => r.results.some(res => res.studentId === student.id));
            
            // Priority 2: Fallback to matching by group name if not found by ID (lenient match)
            if (!classResult) {
                classResult = matchingRecords.find(r => {
                    const recordGroup = (r.group || '').toLowerCase().trim();
                    const recordGroupNormalized = groupMap[recordGroup] || recordGroup;
                    return student.className < '9' || recordGroupNormalized === studentGroupNormalized || !recordGroupNormalized || recordGroupNormalized === 'none';
                });
            }
            
            const studentResult = classResult?.results.find(r => r.studentId === student.id);
            const fullMarks = classResult?.fullMarks || subjectInfo.fullMarks;

            const written = studentResult?.written;
            const mcq = studentResult?.mcq;
            const practical = studentResult?.practical;
            const obtainedMarks = (written || 0) + (mcq || 0) + (practical || 0);
            
            const passMark = Math.ceil(fullMarks * 0.33);

            // A subject is passed if marks are >= 33% and at least one mark type was entered
            const isMarkEntered = written !== undefined || mcq !== undefined || practical !== undefined;
            const isPassSubject = isMarkEntered && obtainedMarks >= passMark;
            
            const percentageForGrade = (obtainedMarks / fullMarks) * 100;
            const { grade, point } = getGradePoint(isPassSubject ? percentageForGrade : 0);
            
            totalMarks += obtainedMarks;
            totalPossibleMarks += fullMarks;
            
            subjectResults.set(subjectInfo.name, {
                written,
                mcq,
                practical,
                marks: obtainedMarks,
                grade: isPassSubject ? grade : 'F',
                point: isPassSubject ? point : 0,
                isPass: isPassSubject
            });
        });
        
        let totalCompulsoryPoints = 0;
        let compulsorySubjectsCount = 0;
        let failedInCompulsoryCount = 0;
        let bonusPoints = 0;

        subjectsForStudent.forEach(subjectInfo => {
            const result = subjectResults.get(subjectInfo.name);
            if (!result) return;
    
            if (subjectInfo.name === optionalSubjectName) {
                if (result.isPass && result.point > 2.0) {
                    bonusPoints = result.point - 2.0;
                }
            } else {
                totalCompulsoryPoints += result.point;
                compulsorySubjectsCount++;
                if (!result.isPass) {
                    failedInCompulsoryCount++;
                }
            }
        });

        const isPass = failedInCompulsoryCount === 0;
        let gpa = 0;

        if (isPass && compulsorySubjectsCount > 0) {
            gpa = (totalCompulsoryPoints + bonusPoints) / compulsorySubjectsCount;
        }
        
        if (gpa > 5.0) gpa = 5.0;

        const finalGrade = isPass ? getFinalGrade(gpa) : 'F';
        
        return {
            student,
            totalMarks,
            totalPossibleMarks,
            gpa: isPass ? parseFloat(gpa.toFixed(2)) : 0.0,
            finalGrade,
            isPass,
            failedSubjectsCount: failedInCompulsoryCount,
            subjectResults,
        };
    });

    const passedStudents = studentResults
        .filter(s => s.isPass)
        .sort((a, b) => {
             if (b.totalMarks !== a.totalMarks) {
                return b.totalMarks - a.totalMarks;
            }
            return a.student.roll - b.student.roll;
        });

    let rank = 1;
    for (let i = 0; i < passedStudents.length; i++) {
        if (i > 0 && passedStudents[i].totalMarks < passedStudents[i - 1].totalMarks) {
            rank = i + 1;
        }
        const studentToUpdate = studentResults.find(s => s.student.id === passedStudents[i].student.id);
        if (studentToUpdate) {
            studentToUpdate.meritPosition = rank;
        }
    }

    return studentResults;
}