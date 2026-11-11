import type { GradeLevel } from '../types/database';

export const ALLOWED_GRADES: GradeLevel[] = [
  'Kindergarten',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
];

export const GRADE_CARD_STYLES: Record<'All' | GradeLevel, { bg: string; color: string }> = {
  All: { bg: 'rgba(0, 135, 90, 0.10)', color: 'var(--primary)' },
  Kindergarten: { bg: '#f4cce8', color: '#a64d79' },
  'Grade 1': { bg: '#cfe2f3', color: '#0b5394' },
  'Grade 2': { bg: '#ead1dc', color: '#741b47' },
  'Grade 3': { bg: '#fce5cd', color: '#b45f06' },
  'Grade 4': { bg: '#d9ead3', color: '#274e13' },
  'Grade 5': { bg: '#fff2cc', color: '#bf9000' },
  'Grade 6': { bg: '#f4cccc', color: '#990000' },
};

export const SECTION_PILL_COLORS: Record<string, string> = {
  Kindergarten: '#f4cce8',
  'Grade 1': '#cfe2f3',
  'Grade 2': '#ead1dc',
  'Grade 3': '#fce5cd',
  'Grade 4': '#d9ead3',
  'Grade 5': '#fff2cc',
  'Grade 6': '#f4cccc',
};

export const STUDENT_STATUS_OPTIONS = [
  'Currently Enrolled',
  'Graduated',
  'Transferred',
  'Dropped Out',
  'Unknown / Not Indicated',
] as const;

export const STUDENT_STATUS_BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  'Currently Enrolled': { bg: '#dcfce7', color: '#166534' },
  Graduated: { bg: '#dbeafe', color: '#1e40af' },
  Transferred: { bg: '#fef3c7', color: '#92400e' },
  'Dropped Out': { bg: '#fee2e2', color: '#991b1b' },
};

export const ASSESSMENT_SCHOOL_YEARS = [
  'Unknown/Not Indicated',
  '2021-2022',
  '2022-2023',
  '2023-2024',
  '2024-2025',
  '2025-2026',
  '2026-2027',
];

export const DIAGNOSIS_OPTIONS = ['GDD', 'IDD', 'ADHD', 'Autism', 'Other'] as const;

export const CASE_TYPE_OPTIONS = [
  'Bullying',
  'Physical Violence/Altercation',
  'Sexual Violence/Abuse',
  'Verbal/Relational Conflict',
  'Behavioral Concern',
  'Emotional/Psychosocial Concern',
  'Academic Concern',
  'Family/Home Concern',
  'Other',
] as const;

export const OUTCOME_DISPOSITION_OPTIONS = [
  'Ongoing',
  'To Follow-Up',
  'Referred',
  'Closed/Resolved',
  'Other',
] as const;

export function getLearnerSchoolYearOptions(): string[] {
  const startYear = 2024;
  const endYear = new Date().getFullYear() + 1;
  const years: string[] = [];
  for (let y = startYear; y <= endYear; y++) {
    years.push(`${y}-${y + 1}`);
  }
  return years;
}

export function getCurrentAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-11 (Aug is 7)
  return month >= 7 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

