-- Migration 008: Add reunification_contacts JSONB column to students and update RPCs

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS reunification_contacts JSONB DEFAULT '[]'::jsonb;

-- Update create_learner_with_parents RPC
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
        date_of_birth, home_address, blood_type, allergies, medications, status,
        reunification_contacts
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
        coalesce(nullif(btrim(p_student ->> 'status'), ''), 'Unknown / Not Indicated'),
        coalesce(p_student -> 'reunification_contacts', '[]'::jsonb)
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

-- Update update_learner_with_parents RPC
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
        status = coalesce(nullif(btrim(p_student ->> 'status'), ''), 'Unknown / Not Indicated'),
        reunification_contacts = CASE 
            WHEN p_student ? 'reunification_contacts' THEN coalesce(p_student -> 'reunification_contacts', '[]'::jsonb)
            ELSE reunification_contacts
        END
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
