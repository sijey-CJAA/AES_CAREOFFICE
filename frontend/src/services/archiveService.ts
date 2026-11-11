import { getSupabaseClient } from '../lib/supabase';
import type {
  AssessmentRecord,
  CaseRecord,
  ParentRecord,
  SoftDeleteTable,
  Student,
} from '../types/database';

export interface ArchivedRecordsBundle {
  students: Student[];
  parents: ParentRecord[];
  assessments: AssessmentRecord[];
  cases: CaseRecord[];
}

export async function fetchArchivedRecords(): Promise<ArchivedRecordsBundle> {
  const supabase = getSupabaseClient();

  const [studentsRes, parentsRes, assessRes, casesRes] = await Promise.all([
    supabase
      .from('students')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('parents')
      .select('*, students(full_name)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('assessment_records')
      .select('*, students(full_name)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
    supabase
      .from('case_register_view')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false }),
  ]);

  if (studentsRes.error) throw new Error(studentsRes.error.message);
  if (parentsRes.error) throw new Error(parentsRes.error.message);
  if (assessRes.error) throw new Error(assessRes.error.message);
  if (casesRes.error) throw new Error(casesRes.error.message);

  const parents = (parentsRes.data ?? []).map((row) => {
    const st = row.students as unknown as { full_name: string | null } | null;
    const { students: _ignored, ...rest } = row;
    return { ...(rest as ParentRecord), student_name: st?.full_name ?? null };
  });

  const assessments = (assessRes.data ?? []).map((row) => {
    const st = row.students as unknown as { full_name: string | null } | null;
    const { students: _ignored, ...rest } = row;
    return { ...(rest as AssessmentRecord), student_name: st?.full_name ?? null };
  });

  return {
    students: (studentsRes.data ?? []) as Student[],
    parents,
    assessments,
    cases: (casesRes.data ?? []) as CaseRecord[],
  };
}

export async function softDeleteRecord(table: SoftDeleteTable, id: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('soft_delete_record', {
    p_table: table,
    p_id: id,
  });
  if (error) throw new Error(error.message);
}

export async function restoreRecord(table: SoftDeleteTable, id: number): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('restore_record', {
    p_table: table,
    p_id: id,
  });
  if (error) throw new Error(error.message);
}

