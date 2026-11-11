import { getSupabaseClient } from '../lib/supabase';
import type { ParentInput, ParentRecord, ParentType } from '../types/database';

export async function fetchActiveParents(): Promise<ParentRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('parents')
    .select('*, students(full_name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const studentObj = row.students as unknown as { full_name: string | null } | null;
    const { students: _ignored, ...rest } = row;
    return {
      ...(rest as ParentRecord),
      student_name: studentObj?.full_name ?? null,
    };
  });
}

export async function fetchParentById(id: number): Promise<ParentRecord> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from('parents').select('*').eq('id', id).single();
  if (error || !data) throw new Error(error?.message || 'Parent not found');
  return data as ParentRecord;
}

export async function createParentsForStudent(
  studentId: number,
  primaryParent: ParentInput,
  secondaryParent?: ParentInput | null
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('create_parents_for_student', {
    p_student_id: studentId,
    p_primary_parent: primaryParent,
    p_secondary_parent: secondaryParent ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function updateParentRecord(
  id: number,
  payload: {
    student_id: number;
    parent_type: ParentType;
    full_name: string;
    relationship: string;
    mobile_number: string;
    home_address: string;
    telephone_number: string;
    email_address: string;
    workplace: string;
    workplace_address: string;
    emergency_contact_number: string;
  }
): Promise<void> {
  const supabase = getSupabaseClient();
  const clean = (v: string) => {
    const trimmed = v.trim();
    return trimmed === '' ? null : trimmed;
  };

  const { error } = await supabase
    .from('parents')
    .update({
      student_id: payload.student_id,
      parent_type: payload.parent_type,
      full_name: clean(payload.full_name),
      relationship: clean(payload.relationship),
      mobile_number: clean(payload.mobile_number),
      home_address: clean(payload.home_address),
      telephone_number: clean(payload.telephone_number),
      email_address: clean(payload.email_address),
      workplace: clean(payload.workplace),
      workplace_address: clean(payload.workplace_address),
      emergency_contact_number: clean(payload.emergency_contact_number),
    })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

