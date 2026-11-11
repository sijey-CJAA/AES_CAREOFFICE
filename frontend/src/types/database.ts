export type GradeLevel =
  | 'Kindergarten'
  | 'Grade 1'
  | 'Grade 2'
  | 'Grade 3'
  | 'Grade 4'
  | 'Grade 5'
  | 'Grade 6';

export type ParentType = 'Primary' | 'Secondary';

export type StudentStatus =
  | 'Currently Enrolled'
  | 'Graduated'
  | 'Transferred'
  | 'Dropped Out'
  | 'Unknown / Not Indicated';

export type SoftDeleteTable =
  | 'students'
  | 'parents'
  | 'assessment_records'
  | 'case_register';

export interface Student {
  id: number;
  full_name: string | null;
  lrn: string | null;
  grade_section: string | null;
  grade_level: string | null;
  section: string | null;
  school_year: string | null;
  date_of_birth: string | null;
  contact_number: string | null;
  home_address: string | null;
  blood_type: string | null;
  allergies: string | null;
  medications: string | null;
  status: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface StudentListRow extends Student {
  primary_parent: string | null;
  secondary_parent: string | null;
}

export interface ParentRecord {
  id: number;
  student_id: number;
  parent_type: ParentType;
  full_name: string | null;
  relationship: string | null;
  home_address: string | null;
  mobile_number: string | null;
  telephone_number: string | null;
  email_address: string | null;
  workplace: string | null;
  workplace_address: string | null;
  emergency_contact_number: string | null;
  created_at: string;
  deleted_at: string | null;
  student_name?: string | null;
}

export interface AssessmentRecord {
  id: number;
  student_id: number;
  record_number: string | null;
  school_year: string | null;
  date: string | null;
  grade_section: string | null;
  contact_number: string | null;
  status: string | null;
  assessment_provider: string | null;
  findings: string | null;
  diagnosis: string | null;
  recommendations: string | null;
  created_at: string;
  deleted_at: string | null;
  student_name?: string | null;
}

export interface CaseRecord {
  id: number;
  case_number: string | null;
  school_year: string | null;
  date: string | null;
  grade_section: string | null;
  case_type: string | null;
  brief_description: string | null;
  actions_taken: string | null;
  outcome_disposition: string | null;
  created_at: string;
  deleted_at: string | null;
  student_names?: string;
  student_ids?: number[];
}

export interface LearnerFullDetails extends Student {
  parents: ParentRecord[];
  assessments: AssessmentRecord[];
  cases: CaseRecord[];
}

export interface GradeSectionRow {
  id: number;
  grade_level: GradeLevel;
  section_name: string;
  created_at: string;
}

export interface DashboardStats {
  total_students: number;
  total_parents: number;
  total_assessments: number;
  total_cases: number;
}

export type GradeCounts = Record<'All' | GradeLevel, number>;

export interface ParentInput {
  id?: number | null;
  full_name: string;
  relationship: string;
  mobile_number: string;
  telephone_number: string;
  email_address: string;
  home_address: string;
  workplace: string;
  workplace_address: string;
  emergency_contact_number: string;
}

export interface LearnerFormInput {
  full_name: string;
  lrn: string;
  grade_level: string;
  section: string;
  school_year: string;
  date_of_birth: string;
  home_address: string;
  blood_type: string;
  allergies: string;
  medications: string;
  status: string;
  primary_parent: ParentInput;
  secondary_parent: ParentInput;
}

export interface StudentDrillItem {
  id: number;
  full_name: string | null;
  lrn: string | null;
  status: string | null;
  school_year: string | null;
  contact_number: string | null;
}

