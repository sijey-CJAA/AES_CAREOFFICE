-- ============================================================================
-- AES CareOffice — Phase 2 Migration 002: Triggers, Views & Transactional RPCs
-- ============================================================================

-- ── 1. Generic updated_at Trigger (replaces MySQL ON UPDATE CURRENT_TIMESTAMP) ──
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cars_sessions_updated_at ON public.cars_assessment_sessions;
CREATE TRIGGER trg_cars_sessions_updated_at
    BEFORE UPDATE ON public.cars_assessment_sessions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cars_evaluations_updated_at ON public.cars_student_evaluations;
CREATE TRIGGER trg_cars_evaluations_updated_at
    BEFORE UPDATE ON public.cars_student_evaluations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. Auto-link Supabase Auth users to public.admins by verified email ────
CREATE OR REPLACE FUNCTION public.link_auth_user_to_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.admins
    SET auth_user_id = NEW.id
    WHERE lower(email) = lower(NEW.email)
      AND (auth_user_id IS NULL OR auth_user_id = NEW.id);
    RETURN NEW;
END;
$$;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS trg_link_auth_user_admin ON auth.users;
    CREATE TRIGGER trg_link_auth_user_admin
        AFTER INSERT OR UPDATE OF email ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.link_auth_user_to_admin();
EXCEPTION
    WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping auth.users trigger due to role privileges; is_admin() handles verified email matching directly.';
END
$$;

-- ── 3. Authorization Helper for RLS Policies ────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.admins a
        WHERE a.auth_user_id = auth.uid()
           OR EXISTS (
               SELECT 1
               FROM auth.users u
               WHERE u.id = auth.uid()
                 AND u.email_confirmed_at IS NOT NULL
                 AND lower(u.email) = lower(a.email)
           )
    );
$$;

-- ── 4. Security-Invoker Views (replace MySQL GROUP_CONCAT queries) ──────────
CREATE OR REPLACE VIEW public.case_register_view
WITH (security_invoker = true) AS
SELECT
    c.id,
    c.case_number,
    c.school_year,
    c.date,
    c.grade_section,
    c.case_type,
    c.brief_description,
    c.actions_taken,
    c.outcome_disposition,
    c.created_at,
    c.deleted_at,
    COALESCE(
        STRING_AGG(s.full_name, ', ' ORDER BY s.full_name) FILTER (WHERE s.id IS NOT NULL),
        ''
    ) AS student_names,
    COALESCE(
        ARRAY_AGG(s.id ORDER BY s.full_name) FILTER (WHERE s.id IS NOT NULL),
        ARRAY[]::BIGINT[]
    ) AS student_ids
FROM public.case_register c
LEFT JOIN public.case_students cs ON cs.case_id = c.id
LEFT JOIN public.students s ON s.id = cs.student_id
GROUP BY c.id;

-- ── 5. Dashboard & Grade Count RPCs ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_students BIGINT;
    v_parents BIGINT;
    v_assessments BIGINT;
    v_cases BIGINT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT COUNT(*) INTO v_students FROM public.students WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO v_parents FROM public.parents WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO v_assessments FROM public.assessment_records WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO v_cases FROM public.case_register WHERE deleted_at IS NULL;

    RETURN jsonb_build_object(
        'total_students', v_students,
        'total_parents', v_parents,
        'total_assessments', v_assessments,
        'total_cases', v_cases
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_student_grade_counts(p_graduated BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_counts JSONB;
    v_total BIGINT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT
        COALESCE(jsonb_object_agg(grade_level, cnt), '{}'::jsonb),
        COALESCE(SUM(cnt), 0)
    INTO v_counts, v_total
    FROM (
        SELECT grade_level, COUNT(*)::BIGINT AS cnt
        FROM public.students
        WHERE deleted_at IS NULL
          AND grade_level IS NOT NULL
          AND (
              (p_graduated AND status = 'Graduated')
              OR (NOT p_graduated AND (status IS DISTINCT FROM 'Graduated'))
          )
        GROUP BY grade_level
    ) sub;

    RETURN v_counts || jsonb_build_object('All', v_total);
END;
$$;

-- ── 6. Next Record/Case Number Preview Helpers ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_next_assessment_number()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_next BIGINT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    SELECT COALESCE(MAX(id), 0) + 1 INTO v_next FROM public.assessment_records;
    RETURN 'AES-AR-' || lpad(v_next::text, 3, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_case_number()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_next BIGINT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    SELECT COALESCE(MAX(id), 0) + 1 INTO v_next FROM public.case_register;
    RETURN 'AES-CR-' || lpad(v_next::text, 3, '0');
END;
$$;

-- ── 7. Transactional Learner + Parents RPCs ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_learner_with_parents(
    p_student JSONB,
    p_primary_parent JSONB DEFAULT NULL,
    p_secondary_parent JSONB DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_grade_level TEXT := nullif(btrim(p_student ->> 'grade_level'), '');
    v_section TEXT := nullif(btrim(p_student ->> 'section'), '');
    v_student_id BIGINT;
    v_p1_name TEXT := nullif(btrim(coalesce(p_primary_parent ->> 'full_name', '')), '');
    v_p2_name TEXT := nullif(btrim(coalesce(p_secondary_parent ->> 'full_name', '')), '');
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF v_grade_level IS NULL OR v_section IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.grade_sections gs
        WHERE gs.grade_level = v_grade_level
          AND lower(gs.section_name) = lower(v_section)
    ) THEN
        RAISE EXCEPTION 'Please select a valid section for the selected grade level.';
    END IF;

    INSERT INTO public.students (
        full_name, lrn, grade_level, section, school_year,
        date_of_birth, home_address, blood_type, allergies, medications, status
    ) VALUES (
        nullif(btrim(p_student ->> 'full_name'), ''),
        nullif(btrim(p_student ->> 'lrn'), ''),
        v_grade_level,
        v_section,
        nullif(btrim(p_student ->> 'school_year'), ''),
        nullif(btrim(p_student ->> 'date_of_birth'), '')::date,
        nullif(btrim(p_student ->> 'home_address'), ''),
        nullif(btrim(p_student ->> 'blood_type'), ''),
        nullif(btrim(p_student ->> 'allergies'), ''),
        nullif(btrim(p_student ->> 'medications'), ''),
        coalesce(nullif(btrim(p_student ->> 'status'), ''), 'Unknown / Not Indicated')
    )
    RETURNING id INTO v_student_id;

    IF v_p1_name IS NOT NULL THEN
        INSERT INTO public.parents (
            student_id, parent_type, full_name, relationship, mobile_number,
            telephone_number, email_address, home_address, workplace,
            workplace_address, emergency_contact_number
        ) VALUES (
            v_student_id, 'Primary', v_p1_name,
            nullif(btrim(p_primary_parent ->> 'relationship'), ''),
            nullif(btrim(p_primary_parent ->> 'mobile_number'), ''),
            nullif(btrim(p_primary_parent ->> 'telephone_number'), ''),
            nullif(btrim(p_primary_parent ->> 'email_address'), ''),
            nullif(btrim(p_primary_parent ->> 'home_address'), ''),
            nullif(btrim(p_primary_parent ->> 'workplace'), ''),
            nullif(btrim(p_primary_parent ->> 'workplace_address'), ''),
            nullif(btrim(p_primary_parent ->> 'emergency_contact_number'), '')
        );
    END IF;

    IF v_p2_name IS NOT NULL THEN
        INSERT INTO public.parents (
            student_id, parent_type, full_name, relationship, mobile_number,
            telephone_number, email_address, home_address, workplace,
            workplace_address, emergency_contact_number
        ) VALUES (
            v_student_id, 'Secondary', v_p2_name,
            nullif(btrim(p_secondary_parent ->> 'relationship'), ''),
            nullif(btrim(p_secondary_parent ->> 'mobile_number'), ''),
            nullif(btrim(p_secondary_parent ->> 'telephone_number'), ''),
            nullif(btrim(p_secondary_parent ->> 'email_address'), ''),
            nullif(btrim(p_secondary_parent ->> 'home_address'), ''),
            nullif(btrim(p_secondary_parent ->> 'workplace'), ''),
            nullif(btrim(p_secondary_parent ->> 'workplace_address'), ''),
            nullif(btrim(p_secondary_parent ->> 'emergency_contact_number'), '')
        );
    END IF;

    RETURN v_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_learner_with_parents(
    p_student_id BIGINT,
    p_student JSONB,
    p_primary_parent JSONB DEFAULT NULL,
    p_secondary_parent JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_grade_level TEXT := nullif(btrim(p_student ->> 'grade_level'), '');
    v_section TEXT := nullif(btrim(p_student ->> 'section'), '');
    v_p1_id BIGINT := nullif(btrim(coalesce(p_primary_parent ->> 'id', '')), '')::bigint;
    v_p1_name TEXT := nullif(btrim(coalesce(p_primary_parent ->> 'full_name', '')), '');
    v_p2_id BIGINT := nullif(btrim(coalesce(p_secondary_parent ->> 'id', '')), '')::bigint;
    v_p2_name TEXT := nullif(btrim(coalesce(p_secondary_parent ->> 'full_name', '')), '');
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_student_id IS NULL THEN
        RAISE EXCEPTION 'Missing ID for edit.';
    END IF;

    IF v_grade_level IS NULL OR v_section IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.grade_sections gs
        WHERE gs.grade_level = v_grade_level
          AND lower(gs.section_name) = lower(v_section)
    ) THEN
        RAISE EXCEPTION 'Please select a valid section for the selected grade level.';
    END IF;

    UPDATE public.students SET
        full_name = nullif(btrim(p_student ->> 'full_name'), ''),
        lrn = nullif(btrim(p_student ->> 'lrn'), ''),
        grade_level = v_grade_level,
        section = v_section,
        school_year = nullif(btrim(p_student ->> 'school_year'), ''),
        date_of_birth = nullif(btrim(p_student ->> 'date_of_birth'), '')::date,
        home_address = nullif(btrim(p_student ->> 'home_address'), ''),
        blood_type = nullif(btrim(p_student ->> 'blood_type'), ''),
        allergies = nullif(btrim(p_student ->> 'allergies'), ''),
        medications = nullif(btrim(p_student ->> 'medications'), ''),
        status = coalesce(nullif(btrim(p_student ->> 'status'), ''), 'Unknown / Not Indicated')
    WHERE id = p_student_id;

    IF v_p1_id IS NOT NULL THEN
        UPDATE public.parents SET
            full_name = v_p1_name,
            relationship = nullif(btrim(p_primary_parent ->> 'relationship'), ''),
            mobile_number = nullif(btrim(p_primary_parent ->> 'mobile_number'), ''),
            telephone_number = nullif(btrim(p_primary_parent ->> 'telephone_number'), ''),
            email_address = nullif(btrim(p_primary_parent ->> 'email_address'), ''),
            home_address = nullif(btrim(p_primary_parent ->> 'home_address'), ''),
            workplace = nullif(btrim(p_primary_parent ->> 'workplace'), ''),
            workplace_address = nullif(btrim(p_primary_parent ->> 'workplace_address'), ''),
            emergency_contact_number = nullif(btrim(p_primary_parent ->> 'emergency_contact_number'), '')
        WHERE id = v_p1_id AND student_id = p_student_id;
    ELSIF v_p1_name IS NOT NULL THEN
        INSERT INTO public.parents (
            student_id, parent_type, full_name, relationship, mobile_number,
            telephone_number, email_address, home_address, workplace,
            workplace_address, emergency_contact_number
        ) VALUES (
            p_student_id, 'Primary', v_p1_name,
            nullif(btrim(p_primary_parent ->> 'relationship'), ''),
            nullif(btrim(p_primary_parent ->> 'mobile_number'), ''),
            nullif(btrim(p_primary_parent ->> 'telephone_number'), ''),
            nullif(btrim(p_primary_parent ->> 'email_address'), ''),
            nullif(btrim(p_primary_parent ->> 'home_address'), ''),
            nullif(btrim(p_primary_parent ->> 'workplace'), ''),
            nullif(btrim(p_primary_parent ->> 'workplace_address'), ''),
            nullif(btrim(p_primary_parent ->> 'emergency_contact_number'), '')
        );
    END IF;

    IF v_p2_id IS NOT NULL THEN
        UPDATE public.parents SET
            full_name = v_p2_name,
            relationship = nullif(btrim(p_secondary_parent ->> 'relationship'), ''),
            mobile_number = nullif(btrim(p_secondary_parent ->> 'mobile_number'), ''),
            telephone_number = nullif(btrim(p_secondary_parent ->> 'telephone_number'), ''),
            email_address = nullif(btrim(p_secondary_parent ->> 'email_address'), ''),
            home_address = nullif(btrim(p_secondary_parent ->> 'home_address'), ''),
            workplace = nullif(btrim(p_secondary_parent ->> 'workplace'), ''),
            workplace_address = nullif(btrim(p_secondary_parent ->> 'workplace_address'), ''),
            emergency_contact_number = nullif(btrim(p_secondary_parent ->> 'emergency_contact_number'), '')
        WHERE id = v_p2_id AND student_id = p_student_id;
    ELSIF v_p2_name IS NOT NULL THEN
        INSERT INTO public.parents (
            student_id, parent_type, full_name, relationship, mobile_number,
            telephone_number, email_address, home_address, workplace,
            workplace_address, emergency_contact_number
        ) VALUES (
            p_student_id, 'Secondary', v_p2_name,
            nullif(btrim(p_secondary_parent ->> 'relationship'), ''),
            nullif(btrim(p_secondary_parent ->> 'mobile_number'), ''),
            nullif(btrim(p_secondary_parent ->> 'telephone_number'), ''),
            nullif(btrim(p_secondary_parent ->> 'email_address'), ''),
            nullif(btrim(p_secondary_parent ->> 'home_address'), ''),
            nullif(btrim(p_secondary_parent ->> 'workplace'), ''),
            nullif(btrim(p_secondary_parent ->> 'workplace_address'), ''),
            nullif(btrim(p_secondary_parent ->> 'emergency_contact_number'), '')
        );
    END IF;
END;
$$;

-- ── 8. Transactional Parent Creation RPC ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_parents_for_student(
    p_student_id BIGINT,
    p_primary_parent JSONB,
    p_secondary_parent JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_p1_name TEXT := nullif(btrim(coalesce(p_primary_parent ->> 'full_name', '')), '');
    v_p2_name TEXT := nullif(btrim(coalesce(p_secondary_parent ->> 'full_name', '')), '');
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_student_id IS NULL OR v_p1_name IS NULL THEN
        RAISE EXCEPTION 'Please select a learner and provide at least the primary parent name.';
    END IF;

    INSERT INTO public.parents (
        student_id, parent_type, full_name, relationship, home_address,
        mobile_number, telephone_number, email_address, workplace,
        workplace_address, emergency_contact_number
    ) VALUES (
        p_student_id, 'Primary', v_p1_name,
        nullif(btrim(p_primary_parent ->> 'relationship'), ''),
        nullif(btrim(p_primary_parent ->> 'home_address'), ''),
        nullif(btrim(p_primary_parent ->> 'mobile_number'), ''),
        nullif(btrim(p_primary_parent ->> 'telephone_number'), ''),
        nullif(btrim(p_primary_parent ->> 'email_address'), ''),
        nullif(btrim(p_primary_parent ->> 'workplace'), ''),
        nullif(btrim(p_primary_parent ->> 'workplace_address'), ''),
        nullif(btrim(p_primary_parent ->> 'emergency_contact_number'), '')
    );

    IF v_p2_name IS NOT NULL THEN
        INSERT INTO public.parents (
            student_id, parent_type, full_name, relationship, home_address,
            mobile_number, telephone_number, email_address, workplace,
            workplace_address, emergency_contact_number
        ) VALUES (
            p_student_id, 'Secondary', v_p2_name,
            nullif(btrim(p_secondary_parent ->> 'relationship'), ''),
            nullif(btrim(p_secondary_parent ->> 'home_address'), ''),
            nullif(btrim(p_secondary_parent ->> 'mobile_number'), ''),
            nullif(btrim(p_secondary_parent ->> 'telephone_number'), ''),
            nullif(btrim(p_secondary_parent ->> 'email_address'), ''),
            nullif(btrim(p_secondary_parent ->> 'workplace'), ''),
            nullif(btrim(p_secondary_parent ->> 'workplace_address'), ''),
            nullif(btrim(p_secondary_parent ->> 'emergency_contact_number'), '')
        );
    END IF;
END;
$$;

-- ── 9. Transactional Case Register RPCs ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_case_with_students(
    p_case JSONB,
    p_student_ids BIGINT[]
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_case_id BIGINT;
    v_case_number TEXT := nullif(btrim(p_case ->> 'case_number'), '');
    v_unique_ids BIGINT[];
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT ARRAY_AGG(DISTINCT sid) INTO v_unique_ids
    FROM unnest(p_student_ids) AS sid
    WHERE sid IS NOT NULL;

    IF v_unique_ids IS NULL OR array_length(v_unique_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'Missing student IDs.';
    END IF;

    INSERT INTO public.case_register (
        case_number, school_year, date, grade_section, case_type,
        brief_description, actions_taken, outcome_disposition
    ) VALUES (
        v_case_number,
        nullif(btrim(p_case ->> 'school_year'), ''),
        nullif(btrim(p_case ->> 'date'), '')::date,
        nullif(btrim(p_case ->> 'grade_section'), ''),
        nullif(btrim(p_case ->> 'case_type'), ''),
        nullif(btrim(p_case ->> 'brief_description'), ''),
        nullif(btrim(p_case ->> 'actions_taken'), ''),
        nullif(btrim(p_case ->> 'outcome_disposition'), '')
    )
    RETURNING id INTO v_case_id;

    -- Populate case_number atomically if omitted
    IF v_case_number IS NULL THEN
        UPDATE public.case_register
        SET case_number = 'AES-CR-' || lpad(v_case_id::text, 3, '0')
        WHERE id = v_case_id;
    END IF;

    INSERT INTO public.case_students (case_id, student_id)
    SELECT v_case_id, sid FROM unnest(v_unique_ids) AS sid;

    RETURN v_case_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_case_with_students(
    p_case_id BIGINT,
    p_case JSONB,
    p_student_ids BIGINT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_unique_ids BIGINT[];
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_case_id IS NULL THEN
        RAISE EXCEPTION 'Missing Case ID.';
    END IF;

    SELECT ARRAY_AGG(DISTINCT sid) INTO v_unique_ids
    FROM unnest(p_student_ids) AS sid
    WHERE sid IS NOT NULL;

    IF v_unique_ids IS NULL OR array_length(v_unique_ids, 1) IS NULL THEN
        RAISE EXCEPTION 'Missing student IDs.';
    END IF;

    UPDATE public.case_register SET
        case_number = nullif(btrim(p_case ->> 'case_number'), ''),
        school_year = nullif(btrim(p_case ->> 'school_year'), ''),
        date = nullif(btrim(p_case ->> 'date'), '')::date,
        grade_section = nullif(btrim(p_case ->> 'grade_section'), ''),
        case_type = nullif(btrim(p_case ->> 'case_type'), ''),
        brief_description = nullif(btrim(p_case ->> 'brief_description'), ''),
        actions_taken = nullif(btrim(p_case ->> 'actions_taken'), ''),
        outcome_disposition = nullif(btrim(p_case ->> 'outcome_disposition'), '')
    WHERE id = p_case_id;

    DELETE FROM public.case_students WHERE case_id = p_case_id;

    INSERT INTO public.case_students (case_id, student_id)
    SELECT p_case_id, sid FROM unnest(v_unique_ids) AS sid;
END;
$$;

-- ── 10. Soft Delete & Restore RPCs (whitelisted tables) ─────────────────────
CREATE OR REPLACE FUNCTION public.soft_delete_record(p_table TEXT, p_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_table NOT IN ('students', 'parents', 'assessment_records', 'case_register') THEN
        RAISE EXCEPTION 'Invalid table specified.';
    END IF;

    IF p_id IS NULL OR p_id <= 0 THEN
        RAISE EXCEPTION 'Invalid record ID.';
    END IF;

    EXECUTE format('UPDATE public.%I SET deleted_at = now() WHERE id = $1', p_table) USING p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_record(p_table TEXT, p_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_table NOT IN ('students', 'parents', 'assessment_records', 'case_register') THEN
        RAISE EXCEPTION 'Invalid table specified.';
    END IF;

    IF p_id IS NULL OR p_id <= 0 THEN
        RAISE EXCEPTION 'Invalid record ID.';
    END IF;

    EXECUTE format('UPDATE public.%I SET deleted_at = NULL WHERE id = $1', p_table) USING p_id;
END;
$$;

-- ── 11. Add Grade Section RPC (replaces config/sections.json file writes) ──
CREATE OR REPLACE FUNCTION public.add_grade_section(p_grade_level TEXT, p_section_name TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_grade TEXT := btrim(coalesce(p_grade_level, ''));
    v_section TEXT := btrim(coalesce(p_section_name, ''));
    v_sections TEXT[];
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF v_grade = '' OR v_section = '' THEN
        RAISE EXCEPTION 'Please provide both Grade Level and Section Name.';
    END IF;

    IF v_grade NOT IN ('Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6') THEN
        RAISE EXCEPTION 'Invalid Grade Level.';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.grade_sections
        WHERE grade_level = v_grade
          AND lower(section_name) = lower(v_section)
    ) THEN
        RAISE EXCEPTION 'Section already exists for this grade level.';
    END IF;

    INSERT INTO public.grade_sections (grade_level, section_name)
    VALUES (v_grade, v_section);

    SELECT ARRAY_AGG(section_name ORDER BY id ASC)
    INTO v_sections
    FROM public.grade_sections
    WHERE grade_level = v_grade;

    RETURN COALESCE(v_sections, ARRAY[]::TEXT[]);
END;
$$;
