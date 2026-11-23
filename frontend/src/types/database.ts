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

export interface AuthorizedContact {
  name: string;
  relationship: string;
}

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
  reunification_contacts?: AuthorizedContact[] | null;
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
  flagged_students: number;
  total_sections: number;
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
  reunification_contacts?: AuthorizedContact[];
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

export interface AdminProfile {
  id: number;
  email: string;
  nickname: string | null;
  display_name: string | null;
  auth_user_id: string | null;
}

export type SharedResourceType = 'learner' | 'assessment' | 'case' | 'report';
export type SharedAccessStatus = 'pending' | 'active' | 'expired' | 'revoked';
export type SharedAccessAction =
  | 'invitation_created'
  | 'invitation_sent'
  | 'verification_code_sent'
  | 'invitation_accepted'
  | 'record_viewed'
  | 'pdf_downloaded'
  | 'permission_updated'
  | 'expiration_extended'
  | 'access_revoked'
  | 'access_denied';

export interface SharedAccessPermissions {
  view_basic_info: boolean;
  view_parent_info: boolean;
  view_assessment_records: boolean;
  view_case_records: boolean;
  view_download_pdf: boolean;
}

export interface SharedAccessRecord {
  id: string;
  created_by: string;
  recipient_email: string;
  recipient_name: string | null;
  recipient_user_id: string | null;
  resource_type: SharedResourceType;
  resource_id: number;
  resource_label: string | null;
  permission: 'view_only';
  status: SharedAccessStatus;
  expires_at: string;
  accepted_at: string | null;
  last_accessed_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  permissions: SharedAccessPermissions;
  filter_params?: Record<string, unknown> | null;
}

export interface SharedAccessLogRecord {
  id: number;
  shared_access_id: string;
  actor_user_id: string | null;
  action: SharedAccessAction;
  accessed_at: string;
  metadata: Record<string, unknown>;
}

export interface CreateSharedAccessInput {
  recipient_email: string;
  recipient_name?: string;
  resource_type: SharedResourceType;
  resource_id: number;
  expires_at: string;
  permissions: SharedAccessPermissions;
  filter_params?: Record<string, unknown> | null;
  custom_label?: string | null;
}

export interface CreateSharedAccessResult {
  id: string;
  invite_token: string;
  invite_url: string;
  resource_label: string;
  expires_at: string;
  status: SharedAccessStatus;
  permissions: SharedAccessPermissions;
}

export interface SharedLearnerData {
  basic_info?: {
    full_name: string | null;
    lrn: string | null;
    grade_level: string | null;
    section: string | null;
    school_year: string | null;
    date_of_birth: string | null;
    status: string | null;
    home_address: string | null;
    blood_type: string | null;
    allergies: string | null;
    medications: string | null;
  };
  parents?: Array<{
    parent_type: string | null;
    full_name: string | null;
    relationship: string | null;
    mobile_number: string | null;
    telephone_number: string | null;
    email_address: string | null;
    home_address: string | null;
    workplace: string | null;
    workplace_address: string | null;
    emergency_contact_number: string | null;
  }>;
  assessments?: Array<{
    record_number: string | null;
    school_year: string | null;
    date: string | null;
    grade_section: string | null;
    status: string | null;
    assessment_provider: string | null;
    findings: string | null;
    diagnosis: string | null;
    recommendations: string | null;
  }>;
  cases?: Array<{
    case_number: string | null;
    school_year: string | null;
    date: string | null;
    grade_section: string | null;
    case_type: string | null;
    brief_description: string | null;
    actions_taken: string | null;
    outcome_disposition: string | null;
  }>;
}

export interface SharedAssessmentData {
  basic_info?: {
    record_number: string | null;
    student_name: string | null;
    school_year: string | null;
    date: string | null;
    grade_section: string | null;
    status: string | null;
  };
  parent_contact?: {
    contact_number: string | null;
  };
  assessment_details?: {
    assessment_provider: string | null;
    findings: string | null;
    diagnosis: string | null;
    recommendations: string | null;
  };
}

export interface SharedCaseData {
  basic_info?: {
    case_number: string | null;
    student_names: string | null;
    school_year: string | null;
    date: string | null;
    grade_section: string | null;
    outcome_disposition: string | null;
  };
  case_details?: {
    case_type: string | null;
    brief_description: string | null;
    actions_taken: string | null;
  };
}

export interface SharedReportData {
  summary?: {
    total_cases: number;
    date_from?: string | null;
    date_to?: string | null;
    school_year?: string | null;
    case_type?: string | null;
    outcome?: string | null;
  };
  cases?: Array<{
    id?: number | null;
    case_number: string | null;
    student_names?: string | null;
    school_year: string | null;
    date: string | null;
    grade_section?: string | null;
    outcome_disposition?: string | null;
    case_type?: string | null;
    brief_description?: string | null;
    actions_taken?: string | null;
  }>;
}

export interface AuthorizedSharedResponse {
  share: {
    id: string;
    resource_type: SharedResourceType;
    resource_label: string | null;
    recipient_email: string;
    recipient_name: string | null;
    expires_at: string;
    accepted_at: string | null;
    permissions: SharedAccessPermissions;
  };
  data: SharedLearnerData | SharedAssessmentData | SharedCaseData | SharedReportData;
}

