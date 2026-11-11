import { ALLOWED_GRADES } from '../lib/constants';
import { getSupabaseClient } from '../lib/supabase';
import type { GradeLevel } from '../types/database';

export type SectionsMap = Record<GradeLevel, string[]>;

function emptySectionsMap(): SectionsMap {
  return ALLOWED_GRADES.reduce((acc, g) => {
    acc[g] = [];
    return acc;
  }, {} as SectionsMap);
}

export async function fetchGradeSections(): Promise<SectionsMap> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('grade_sections')
    .select('grade_level, section_name')
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);

  const map = emptySectionsMap();
  for (const row of data ?? []) {
    const grade = row.grade_level as GradeLevel;
    if (map[grade]) {
      map[grade].push(row.section_name);
    }
  }
  return map;
}

export async function addGradeSection(gradeLevel: string, sectionName: string): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('add_grade_section', {
    p_grade_level: gradeLevel,
    p_section_name: sectionName,
  });
  if (error) throw new Error(error.message);
  return (data as string[]) ?? [];
}

