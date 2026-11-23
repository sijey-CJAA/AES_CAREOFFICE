-- ============================================================================
-- AES CareOffice — Migration 009: Filter-Based Batch Case Sharing (Reports)
-- ============================================================================
-- Enables sharing filtered case registers (e.g. by date range, school year,
-- case type, outcome) under a single secure, view-only shared access link.
-- ============================================================================

ALTER TABLE public.shared_access
    ADD COLUMN IF NOT EXISTS filter_params JSONB DEFAULT NULL;

-- Update permission normalizer to allow 'report' resource type
CREATE OR REPLACE FUNCTION public.normalize_shared_permissions(
    p_resource_type public.shared_resource_type_enum,
    p_permissions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    v_basic BOOLEAN := COALESCE((p_permissions ->> 'view_basic_info')::boolean, false);
    v_parent BOOLEAN := COALESCE((p_permissions ->> 'view_parent_info')::boolean, false);
    v_assess BOOLEAN := COALESCE((p_permissions ->> 'view_assessment_records')::boolean, false);
    v_case BOOLEAN := COALESCE((p_permissions ->> 'view_case_records')::boolean, false);
    v_pdf BOOLEAN := COALESCE((p_permissions ->> 'view_download_pdf')::boolean, false);
BEGIN
    IF p_resource_type = 'learner' THEN
        -- All 5 flags valid
        NULL;
    ELSIF p_resource_type = 'assessment' THEN
        v_case := false;
    ELSIF p_resource_type = 'case' THEN
        v_parent := false;
        v_assess := false;
    ELSIF p_resource_type = 'report' THEN
        v_parent := false;
        v_assess := false;
    ELSE
        RAISE EXCEPTION 'Sharing is currently supported only for learner, assessment, case, and report resources.';
    END IF;

    IF NOT (v_basic OR v_parent OR v_assess OR v_case) THEN
        RAISE EXCEPTION 'At least one viewable content permission must be enabled.';
    END IF;

    RETURN jsonb_build_object(
        'view_basic_info', v_basic,
        'view_parent_info', v_parent,
        'view_assessment_records', v_assess,
        'view_case_records', v_case,
        'view_download_pdf', v_pdf
    );
END;
$$;

-- Drop older 6-parameter signature so there is no ambiguity with defaults
DROP FUNCTION IF EXISTS public.create_shared_access(TEXT, TEXT, public.shared_resource_type_enum, BIGINT, TIMESTAMPTZ, JSONB);

-- Updated create_shared_access supporting filter_params and custom_label
CREATE OR REPLACE FUNCTION public.create_shared_access(
    p_recipient_email TEXT,
    p_recipient_name TEXT,
    p_resource_type public.shared_resource_type_enum,
    p_resource_id BIGINT,
    p_expires_at TIMESTAMPTZ,
    p_permissions JSONB,
    p_filter_params JSONB DEFAULT NULL,
    p_custom_label TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
    v_email TEXT := lower(btrim(COALESCE(p_recipient_email, '')));
    v_name TEXT := nullif(btrim(COALESCE(p_recipient_name, '')), '');
    v_resource_label TEXT;
    v_perms JSONB;
    v_token TEXT;
    v_token_hash CHAR(64);
    v_share_id UUID;
    v_cases_count INT;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RAISE EXCEPTION 'Please provide a valid recipient email address.';
    END IF;

    IF p_expires_at IS NULL OR p_expires_at <= now() THEN
        RAISE EXCEPTION 'Expiration date must be in the future.';
    END IF;

    IF p_resource_id IS NULL OR p_resource_id <= 0 THEN
        RAISE EXCEPTION 'Invalid resource ID.';
    END IF;

    -- Validate target resource exists and is active, and derive safe label server-side
    IF p_resource_type = 'learner' THEN
        SELECT COALESCE(nullif(btrim(full_name), ''), 'Learner #' || id::text)
        INTO v_resource_label
        FROM public.students
        WHERE id = p_resource_id AND deleted_at IS NULL;
    ELSIF p_resource_type = 'assessment' THEN
        SELECT COALESCE(nullif(btrim(a.record_number), ''), 'Assessment #' || a.id::text)
               || COALESCE(' — ' || nullif(btrim(s.full_name), ''), '')
        INTO v_resource_label
        FROM public.assessment_records a
        LEFT JOIN public.students s ON s.id = a.student_id
        WHERE a.id = p_resource_id AND a.deleted_at IS NULL;
    ELSIF p_resource_type = 'case' THEN
        SELECT COALESCE(nullif(btrim(case_number), ''), 'Case #' || id::text)
        INTO v_resource_label
        FROM public.case_register
        WHERE id = p_resource_id AND deleted_at IS NULL;
    ELSIF p_resource_type = 'report' THEN
        IF p_custom_label IS NOT NULL AND btrim(p_custom_label) <> '' THEN
            v_resource_label := btrim(p_custom_label);
        ELSE
            v_cases_count := COALESCE(jsonb_array_length(p_filter_params -> 'case_ids'), 0);
            v_resource_label := 'Case Register Report (' || v_cases_count::text || ' cases)';
        END IF;
    ELSE
        RAISE EXCEPTION 'Unsupported resource type for sharing.';
    END IF;

    IF v_resource_label IS NULL THEN
        RAISE EXCEPTION 'Target record was not found or has been archived.';
    END IF;

    v_perms := public.normalize_shared_permissions(p_resource_type, COALESCE(p_permissions, '{}'::jsonb));

    -- Generate 256-bit random token and store ONLY its SHA-256 hex digest
    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

    INSERT INTO public.shared_access (
        created_by,
        recipient_email,
        recipient_name,
        resource_type,
        resource_id,
        resource_label,
        permission,
        status,
        token_hash,
        expires_at,
        filter_params
    ) VALUES (
        auth.uid(),
        v_email,
        v_name,
        p_resource_type,
        p_resource_id,
        left(v_resource_label, 255),
        'view_only',
        'pending',
        v_token_hash,
        p_expires_at,
        p_filter_params
    )
    RETURNING id INTO v_share_id;

    INSERT INTO public.shared_access_permissions (
        shared_access_id,
        view_basic_info,
        view_parent_info,
        view_assessment_records,
        view_case_records,
        view_download_pdf
    ) VALUES (
        v_share_id,
        (v_perms ->> 'view_basic_info')::boolean,
        (v_perms ->> 'view_parent_info')::boolean,
        (v_perms ->> 'view_assessment_records')::boolean,
        (v_perms ->> 'view_case_records')::boolean,
        (v_perms ->> 'view_download_pdf')::boolean
    );

    INSERT INTO public.shared_access_logs (
        shared_access_id,
        actor_user_id,
        action,
        metadata
    ) VALUES (
        v_share_id,
        auth.uid(),
        'invitation_created',
        jsonb_build_object(
            'recipient_email', v_email,
            'resource_type', p_resource_type,
            'resource_id', p_resource_id,
            'expires_at', p_expires_at,
            'permissions', v_perms,
            'filter_params', p_filter_params
        )
    );

    RETURN jsonb_build_object(
        'id', v_share_id,
        'invite_token', v_token,
        'resource_label', v_resource_label,
        'expires_at', p_expires_at,
        'status', 'pending',
        'permissions', v_perms
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_shared_access(
    TEXT, TEXT, public.shared_resource_type_enum, BIGINT, TIMESTAMPTZ, JSONB, JSONB, TEXT
) TO authenticated;
