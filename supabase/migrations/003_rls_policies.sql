-- ============================================================================
-- AES CareOffice — Phase 2 Migration 003: Row Level Security (RLS) Policies
-- ============================================================================
-- Security Model:
--   - Anonymous (`anon`) users have ZERO access to all tables.
--   - Only authenticated users verified in `public.admins` (`public.is_admin()`)
--     can read or mutate CareOffice records.
--   - `public.admins` itself can only be read by admins (and cannot be modified
--     directly from client PostgREST calls — manage admin membership via
--     Supabase Dashboard / SQL Editor / service_role only).
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars_assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars_student_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars_norm_tables ENABLE ROW LEVEL SECURITY;

-- Revoke default anon privileges defensively
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.grade_sections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_register TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cars_assessment_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cars_student_evaluations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cars_norm_tables TO authenticated;
GRANT SELECT ON public.admins TO authenticated;
GRANT SELECT ON public.case_register_view TO authenticated;

-- ── 1. admins (read-only for verified admins) ───────────────────────────────
DROP POLICY IF EXISTS admins_select_policy ON public.admins;
CREATE POLICY admins_select_policy ON public.admins
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- ── 2. grade_sections ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS grade_sections_admin_all ON public.grade_sections;
CREATE POLICY grade_sections_admin_all ON public.grade_sections
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ── 3. students ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS students_admin_all ON public.students;
CREATE POLICY students_admin_all ON public.students
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ── 4. parents ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS parents_admin_all ON public.parents;
CREATE POLICY parents_admin_all ON public.parents
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ── 5. assessment_records ───────────────────────────────────────────────────
DROP POLICY IF EXISTS assessment_records_admin_all ON public.assessment_records;
CREATE POLICY assessment_records_admin_all ON public.assessment_records
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ── 6. case_register ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS case_register_admin_all ON public.case_register;
CREATE POLICY case_register_admin_all ON public.case_register
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ── 7. case_students ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS case_students_admin_all ON public.case_students;
CREATE POLICY case_students_admin_all ON public.case_students
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ── 8. CARS Module Tables ───────────────────────────────────────────────────
DROP POLICY IF EXISTS cars_sessions_admin_all ON public.cars_assessment_sessions;
CREATE POLICY cars_sessions_admin_all ON public.cars_assessment_sessions
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS cars_evaluations_admin_all ON public.cars_student_evaluations;
CREATE POLICY cars_evaluations_admin_all ON public.cars_student_evaluations
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS cars_norms_admin_all ON public.cars_norm_tables;
CREATE POLICY cars_norms_admin_all ON public.cars_norm_tables
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

