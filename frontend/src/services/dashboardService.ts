import { getSupabaseClient } from '../lib/supabase';
import type { DashboardStats } from '../types/database';

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('get_dashboard_stats');
  if (error) throw new Error(error.message);

  const raw = (data ?? {}) as Partial<DashboardStats>;
  const hasUpgradedRpc =
    typeof raw.flagged_students === 'number' && typeof raw.total_sections === 'number';

  let totalAssessments = Number(raw.total_assessments ?? 0);
  let flaggedStudents = hasUpgradedRpc ? Number(raw.flagged_students) : 0;
  let totalSections = hasUpgradedRpc ? Number(raw.total_sections) : 0;

  // Fallback when the live database still runs the earlier get_dashboard_stats() RPC:
  // compute distinct assessed students (1 student = 1), distinct flagged students
  // (union of students with active cases OR active assessments), and section count directly.
  if (!hasUpgradedRpc) {
    const [caseStudentsRes, assessedStudentsRes, sectionsRes] = await Promise.all([
      supabase
        .from('case_students')
        .select('student_id, case_register!inner(deleted_at), students!inner(deleted_at)')
        .is('case_register.deleted_at', null)
        .is('students.deleted_at', null),
      supabase
        .from('assessment_records')
        .select('student_id, students!inner(deleted_at)')
        .is('deleted_at', null)
        .is('students.deleted_at', null),
      supabase.from('grade_sections').select('id', { count: 'exact', head: true }),
    ]);

    if (caseStudentsRes.error) throw new Error(caseStudentsRes.error.message);
    if (assessedStudentsRes.error) throw new Error(assessedStudentsRes.error.message);
    if (sectionsRes.error) throw new Error(sectionsRes.error.message);

    const assessedStudentIds = new Set(
      (assessedStudentsRes.data ?? []).map((row) => (row as { student_id: number }).student_id)
    );
    const flaggedStudentIds = new Set<number>(assessedStudentIds);
    for (const row of caseStudentsRes.data ?? []) {
      flaggedStudentIds.add((row as { student_id: number }).student_id);
    }

    totalAssessments = assessedStudentIds.size;
    flaggedStudents = flaggedStudentIds.size;
    totalSections = sectionsRes.count ?? 0;
  }

  return {
    total_students: Number(raw.total_students ?? 0),
    total_parents: Number(raw.total_parents ?? 0),
    total_assessments: totalAssessments,
    total_cases: Number(raw.total_cases ?? 0),
    flagged_students: flaggedStudents,
    total_sections: totalSections,
  };
}

