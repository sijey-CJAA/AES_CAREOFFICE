import { getSupabaseClient } from '../lib/supabase';
import type { CaseRecord } from '../types/database';

export interface CaseInput {
  case_number: string;
  school_year: string;
  date: string;
  grade_section: string;
  case_type: string;
  brief_description: string;
  actions_taken: string;
  outcome_disposition: string;
  student_ids: number[];
}

export async function fetchActiveCases(): Promise<CaseRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('case_register_view')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as CaseRecord[];
}

export async function fetchNextCaseNumber(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_next_case_number');
  if (error) throw new Error(error.message);
  return String(data ?? 'AES-CR-001');
}

export async function fetchCaseById(id: number): Promise<CaseRecord> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('case_register_view')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) throw new Error(error?.message || 'Case record not found');
  return data as CaseRecord;
}

export async function createCase(input: CaseInput): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('create_case_with_students', {
    p_case: {
      case_number: input.case_number,
      school_year: input.school_year,
      date: input.date,
      grade_section: input.grade_section,
      case_type: input.case_type,
      brief_description: input.brief_description,
      actions_taken: input.actions_taken,
      outcome_disposition: input.outcome_disposition,
    },
    p_student_ids: input.student_ids,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Case Number already exists. Please choose a different number.');
    }
    throw new Error(error.message);
  }
  return Number(data);
}

export async function updateCase(id: number, input: CaseInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('update_case_with_students', {
    p_case_id: id,
    p_case: {
      case_number: input.case_number,
      school_year: input.school_year,
      date: input.date,
      grade_section: input.grade_section,
      case_type: input.case_type,
      brief_description: input.brief_description,
      actions_taken: input.actions_taken,
      outcome_disposition: input.outcome_disposition,
    },
    p_student_ids: input.student_ids,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Case Number already exists. Please choose a different number.');
    }
    throw new Error(error.message);
  }
}

