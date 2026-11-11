import { ALLOWED_GRADES } from '../lib/constants';
import { getSupabaseClient } from '../lib/supabase';
import type {
  AssessmentRecord,
  CaseRecord,
  GradeCounts,
  GradeLevel,
  LearnerFormInput,
  LearnerFullDetails,
  ParentRecord,
  Student,
  StudentDrillItem,
  StudentListRow,
} from '../types/database';

function emptyCounts(): GradeCounts {
  const base = { All: 0 } as GradeCounts;
  for (const g of ALLOWED_GRADES) base[g] = 0;
  return base;
}

export async function fetchStudentGradeCounts(graduated: boolean): Promise<GradeCounts> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_student_grade_counts', {
    p_graduated: graduated,
  });
  if (error) throw new Error(error.message);

  const counts = emptyCounts();
  const raw = (data ?? {}) as Record<string, number>;
  counts.All = Number(raw.All ?? 0);
  for (const g of ALLOWED_GRADES) {
    counts[g] = Number(raw[g] ?? 0);
  }
  return counts;
}

export async function fetchFilteredStudents(options: {
  graduated: boolean;
  gradeLevel: string;
  section: string;
}): Promise<StudentListRow[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('students')
    .select('*, parents(parent_type, full_name, deleted_at)')
    .is('deleted_at', null);

  if (options.graduated) {
    query = query.eq('status', 'Graduated');
  } else {
    query = query.or('status.neq.Graduated,status.is.null');
  }

  if (options.gradeLevel && options.gradeLevel !== 'All') {
    query = query.eq('grade_level', options.gradeLevel);
  }

  if (options.section && options.section !== 'All') {
    query = query.eq('section', options.section);
  }

  query = query
    .order('grade_level', { ascending: true })
    .order('section', { ascending: true })
    .order('full_name', { ascending: true });

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const rawParents = (row.parents ?? []) as Array<{
      parent_type: string;
      full_name: string | null;
      deleted_at: string | null;
    }>;
    const activeParents = rawParents.filter((p) => p.deleted_at === null);
    const primary = activeParents.find((p) => p.parent_type === 'Primary');
    const secondary = activeParents.find((p) => p.parent_type === 'Secondary');
    const { parents: _ignored, ...studentFields } = row;
    return {
      ...(studentFields as Student),
      primary_parent: primary?.full_name ?? null,
      secondary_parent: secondary?.full_name ?? null,
    };
  });
}

export async function fetchAllStudentsSummary(): Promise<Pick<Student, 'id' | 'full_name' | 'lrn'>[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .select('id, full_name, lrn')
    .order('full_name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<Student, 'id' | 'full_name' | 'lrn'>[];
}

export async function fetchLearnerDetails(id: number): Promise<LearnerFullDetails> {
  const supabase = getSupabaseClient();

  const [studentRes, parentsRes, assessRes, casesRes] = await Promise.all([
    supabase.from('students').select('*').eq('id', id).single(),
    supabase.from('parents').select('*').eq('student_id', id).is('deleted_at', null),
    supabase
      .from('assessment_records')
      .select('*')
      .eq('student_id', id)
      .is('deleted_at', null)
      .order('date', { ascending: false }),
    supabase
      .from('case_students')
      .select('case_register(*)')
      .eq('student_id', id),
  ]);

  if (studentRes.error || !studentRes.data) {
    throw new Error(studentRes.error?.message || 'Learner not found');
  }
  if (parentsRes.error) throw new Error(parentsRes.error.message);
  if (assessRes.error) throw new Error(assessRes.error.message);
  if (casesRes.error) throw new Error(casesRes.error.message);

  const cases = (casesRes.data ?? [])
    .map((row) => (row as unknown as { case_register: CaseRecord | null }).case_register)
    .filter((c): c is CaseRecord => c !== null && c.deleted_at === null)
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  return {
    ...(studentRes.data as Student),
    parents: (parentsRes.data ?? []) as ParentRecord[],
    assessments: (assessRes.data ?? []) as AssessmentRecord[],
    cases,
  };
}

export async function createLearner(input: LearnerFormInput): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('create_learner_with_parents', {
    p_student: {
      full_name: input.full_name,
      lrn: input.lrn,
      grade_level: input.grade_level,
      section: input.section,
      school_year: input.school_year,
      date_of_birth: input.date_of_birth,
      home_address: input.home_address,
      blood_type: input.blood_type,
      allergies: input.allergies,
      medications: input.medications,
      status: input.status,
    },
    p_primary_parent: input.primary_parent,
    p_secondary_parent: input.secondary_parent,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('A learner with this LRN already exists.');
    }
    throw new Error(error.message);
  }
  return Number(data);
}

export async function updateLearner(id: number, input: LearnerFormInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('update_learner_with_parents', {
    p_student_id: id,
    p_student: {
      full_name: input.full_name,
      lrn: input.lrn,
      grade_level: input.grade_level,
      section: input.section,
      school_year: input.school_year,
      date_of_birth: input.date_of_birth,
      home_address: input.home_address,
      blood_type: input.blood_type,
      allergies: input.allergies,
      medications: input.medications,
      status: input.status,
    },
    p_primary_parent: input.primary_parent,
    p_secondary_parent: input.secondary_parent,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('A learner with this LRN already exists.');
    }
    throw new Error(error.message);
  }
}

export async function fetchSectionsWithStudentsByGrade(gradeLevel: GradeLevel | string): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .select('section')
    .eq('grade_level', gradeLevel)
    .is('deleted_at', null);
  if (error) throw new Error(error.message);

  const unique = new Set<string>();
  for (const row of data ?? []) {
    if (row.section) unique.add(row.section);
  }
  return [...unique].sort((a, b) => a.localeCompare(b));
}

export async function fetchStudentsBySection(gradeLevel: string, section: string): Promise<StudentDrillItem[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from('students')
    .select('id, full_name, lrn, status, school_year, parents(mobile_number, parent_type, deleted_at)')
    .is('deleted_at', null);

  if (gradeLevel === 'Graduates' && section === 'ALL_GRADUATES') {
    query = query.eq('status', 'Graduated');
  } else {
    query = query
      .eq('grade_level', gradeLevel)
      .eq('section', section)
      .or('status.neq.Graduated,status.is.null');
  }

  query = query.order('full_name', { ascending: true });
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const rawParents = (row.parents ?? []) as Array<{
      mobile_number: string | null;
      parent_type: string;
      deleted_at: string | null;
    }>;
    const primary = rawParents.find((p) => p.deleted_at === null && p.parent_type === 'Primary');
    return {
      id: row.id,
      full_name: row.full_name,
      lrn: row.lrn,
      status: row.status,
      school_year: row.school_year,
      contact_number: primary?.mobile_number ?? null,
    };
  });
}

