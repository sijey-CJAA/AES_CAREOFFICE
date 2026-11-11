import { getSupabaseClient } from '../lib/supabase';
import type { AssessmentRecord } from '../types/database';

export interface AssessmentInput {
  student_id: number;
  record_number: string;
  school_year: string;
  date: string;
  grade_section: string;
  contact_number: string;
  status: string;
  assessment_provider: string;
  findings: string;
  diagnosis: string;
  recommendations: string;
}

function clean(val: string | null | undefined): string | null {
  if (val === null || val === undefined) return null;
  const trimmed = val.trim();
  return trimmed === '' ? null : trimmed;
}

export async function fetchActiveAssessments(): Promise<AssessmentRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assessment_records')
    .select('*, students(full_name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const studentObj = row.students as unknown as { full_name: string | null } | null;
    const { students: _ignored, ...rest } = row;
    return {
      ...(rest as AssessmentRecord),
      student_name: studentObj?.full_name ?? null,
    };
  });
}

export async function fetchNextAssessmentNumber(): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_next_assessment_number');
  if (error) throw new Error(error.message);
  return String(data ?? 'AES-AR-001');
}

export async function fetchAssessmentById(id: number): Promise<AssessmentRecord> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('assessment_records')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !data) throw new Error(error?.message || 'Assessment record not found');
  return data as AssessmentRecord;
}

export async function createAssessment(input: AssessmentInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('assessment_records').insert({
    student_id: input.student_id,
    record_number: clean(input.record_number),
    school_year: clean(input.school_year),
    date: clean(input.date),
    grade_section: clean(input.grade_section),
    contact_number: clean(input.contact_number),
    status: clean(input.status),
    assessment_provider: clean(input.assessment_provider),
    findings: clean(input.findings),
    diagnosis: clean(input.diagnosis),
    recommendations: clean(input.recommendations),
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Record Number already exists. Please choose a different record number.');
    }
    throw new Error(error.message);
  }
}

export async function updateAssessment(id: number, input: AssessmentInput): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('assessment_records')
    .update({
      student_id: input.student_id,
      record_number: clean(input.record_number),
      school_year: clean(input.school_year),
      date: clean(input.date),
      grade_section: clean(input.grade_section),
      contact_number: clean(input.contact_number),
      status: clean(input.status),
      assessment_provider: clean(input.assessment_provider),
      findings: clean(input.findings),
      diagnosis: clean(input.diagnosis),
      recommendations: clean(input.recommendations),
    })
    .eq('id', id);

  if (error) {
    if (error.code === '23505') {
      throw new Error('Record Number already exists. Please choose a different record number.');
    }
    throw new Error(error.message);
  }
}

