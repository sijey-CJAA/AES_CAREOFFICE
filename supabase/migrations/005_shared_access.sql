-- ============================================================================
-- AES CareOffice — Migration 005: Secure Share Access & View-Only Record Sharing
-- ============================================================================
-- Security Guarantees:
--   1. Preserves all existing tables, data, and public.is_admin() RLS policies.
--   2. Never inserts external viewers into public.admins.
--   3. Stores ONLY SHA-256 hashes of invitation tokens (never plaintext).
--   4. Enables strict admin-only RLS on all new sharing tables; revokes all
--      privileges from PUBLIC and anon.
--   5. External viewers have ZERO direct PostgREST table access; all viewer
--      authentication, token acceptance, field-level filtering, and PDF data
--      authorization are enforced server-side by the `shared-access` Supabase
--      Edge Function.
--   6. All admin RPCs below are SECURITY INVOKER (never SECURITY DEFINER)
--      with fixed search_path and explicit public.is_admin() checks.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ── 1. Custom ENUM Types ────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shared_resource_type_enum') THEN
        CREATE TYPE public.shared_resource_type_enum AS ENUM ('learner', 'assessment', 'case', 'report');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shared_permission_mode_enum') THEN
        CREATE TYPE public.shared_permission_mode_enum AS ENUM ('view_only');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shared_access_status_enum') THEN
        CREATE TYPE public.shared_access_status_enum AS ENUM ('pending', 'active', 'expired', 'revoked');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shared_access_action_enum') THEN
        CREATE TYPE public.shared_access_action_enum AS ENUM (
            'invitation_created',
            'invitation_sent',
            'invitation_accepted',
            'record_viewed',
            'pdf_downloaded',
            'permission_updated',
            'expiration_extended',
            'access_revoked',
            'access_denied'
        );
    END IF;
END
$$;

-- ── 2. Table: public.shared_access ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    recipient_email VARCHAR(255) NOT NULL CHECK (
        btrim(recipient_email) <> '' AND position('@' IN recipient_email) > 1
    ),
    recipient_name VARCHAR(255) DEFAULT NULL,
    recipient_user_id UUID DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    resource_type public.shared_resource_type_enum NOT NULL,
    resource_id BIGINT NOT NULL CHECK (resource_id > 0),
    resource_label VARCHAR(255) DEFAULT NULL,
    permission public.shared_permission_mode_enum NOT NULL DEFAULT 'view_only',
    status public.shared_access_status_enum NOT NULL DEFAULT 'pending',
    token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ DEFAULT NULL,
    last_accessed_at TIMESTAMPTZ DEFAULT NULL,
    revoked_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_access_recipient_email
    ON public.shared_access (lower(recipient_email));
CREATE INDEX IF NOT EXISTS idx_shared_access_recipient_user_id
    ON public.shared_access (recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_shared_access_resource
    ON public.shared_access (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_shared_access_status_expires
    ON public.shared_access (status, expires_at);

DROP TRIGGER IF EXISTS trg_shared_access_updated_at ON public.shared_access;
CREATE TRIGGER trg_shared_access_updated_at
    BEFORE UPDATE ON public.shared_access
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 3. Table: public.shared_access_permissions ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_access_permissions (
    shared_access_id UUID PRIMARY KEY REFERENCES public.shared_access(id) ON DELETE CASCADE,
    view_basic_info BOOLEAN NOT NULL DEFAULT true,
    view_parent_info BOOLEAN NOT NULL DEFAULT false,
    view_assessment_records BOOLEAN NOT NULL DEFAULT false,
    view_case_records BOOLEAN NOT NULL DEFAULT false,
    view_download_pdf BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_shared_access_permissions_updated_at ON public.shared_access_permissions;
CREATE TRIGGER trg_shared_access_permissions_updated_at
    BEFORE UPDATE ON public.shared_access_permissions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 4. Table: public.shared_access_logs ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shared_access_logs (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    shared_access_id UUID NOT NULL REFERENCES public.shared_access(id) ON DELETE CASCADE,
    actor_user_id UUID DEFAULT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    action public.shared_access_action_enum NOT NULL,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_shared_access_logs_share_time
    ON public.shared_access_logs (shared_access_id, accessed_at DESC);

-- ── 5. Row Level Security & Least-Privilege Grants ──────────────────────────
ALTER TABLE public.shared_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_access_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_access_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON
    public.shared_access,
    public.shared_access_permissions,
    public.shared_access_logs
FROM PUBLIC, anon;
REVOKE ALL ON SEQUENCE public.shared_access_logs_id_seq FROM PUBLIC, anon;

-- Admins can read/create/update sharing records; no DELETE so audit history is preserved
GRANT SELECT, INSERT, UPDATE ON public.shared_access TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.shared_access_permissions TO authenticated;
GRANT SELECT, INSERT ON public.shared_access_logs TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.shared_access_logs_id_seq TO authenticated;

DROP POLICY IF EXISTS shared_access_admin_select ON public.shared_access;
CREATE POLICY shared_access_admin_select ON public.shared_access
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS shared_access_admin_insert ON public.shared_access;
CREATE POLICY shared_access_admin_insert ON public.shared_access
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS shared_access_admin_update ON public.shared_access;
CREATE POLICY shared_access_admin_update ON public.shared_access
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS shared_access_permissions_admin_select ON public.shared_access_permissions;
CREATE POLICY shared_access_permissions_admin_select ON public.shared_access_permissions
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS shared_access_permissions_admin_insert ON public.shared_access_permissions;
CREATE POLICY shared_access_permissions_admin_insert ON public.shared_access_permissions
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS shared_access_permissions_admin_update ON public.shared_access_permissions;
CREATE POLICY shared_access_permissions_admin_update ON public.shared_access_permissions
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS shared_access_logs_admin_select ON public.shared_access_logs;
CREATE POLICY shared_access_logs_admin_select ON public.shared_access_logs
    FOR SELECT TO authenticated
    USING (public.is_admin());

DROP POLICY IF EXISTS shared_access_logs_admin_insert ON public.shared_access_logs;
CREATE POLICY shared_access_logs_admin_insert ON public.shared_access_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

-- ── 6. Permission Sanitization Helper (Enforces Resource-Specific Rules) ────
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
        -- All 5 flags are valid for learners
        NULL;
    ELSIF p_resource_type = 'assessment' THEN
        v_case := false;
    ELSIF p_resource_type = 'case' THEN
        v_parent := false;
        v_assess := false;
    ELSE
        RAISE EXCEPTION 'Sharing is currently supported only for learner, assessment, and case records.';
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

-- ── 7. Admin RPC: Create Share Access Invitation (Atomic + Token Hashed) ────
CREATE OR REPLACE FUNCTION public.create_shared_access(
    p_recipient_email TEXT,
    p_recipient_name TEXT,
    p_resource_type public.shared_resource_type_enum,
    p_resource_id BIGINT,
    p_expires_at TIMESTAMPTZ,
    p_permissions JSONB
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
        expires_at
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
        p_expires_at
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
            'resource_type', p_resource_type,
            'expires_at', p_expires_at,
            'permissions', v_perms
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

-- ── 8. Admin RPC: Update Share Permissions ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_shared_access_permissions(
    p_share_id UUID,
    p_permissions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_share public.shared_access%ROWTYPE;
    v_perms JSONB;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT * INTO v_share FROM public.shared_access WHERE id = p_share_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shared access invitation not found.';
    END IF;

    IF v_share.status = 'revoked' OR v_share.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot edit permissions on a revoked invitation.';
    END IF;

    v_perms := public.normalize_shared_permissions(v_share.resource_type, COALESCE(p_permissions, '{}'::jsonb));

    UPDATE public.shared_access_permissions
    SET
        view_basic_info = (v_perms ->> 'view_basic_info')::boolean,
        view_parent_info = (v_perms ->> 'view_parent_info')::boolean,
        view_assessment_records = (v_perms ->> 'view_assessment_records')::boolean,
        view_case_records = (v_perms ->> 'view_case_records')::boolean,
        view_download_pdf = (v_perms ->> 'view_download_pdf')::boolean
    WHERE shared_access_id = p_share_id;

    INSERT INTO public.shared_access_logs (
        shared_access_id,
        actor_user_id,
        action,
        metadata
    ) VALUES (
        p_share_id,
        auth.uid(),
        'permission_updated',
        jsonb_build_object('permissions', v_perms)
    );

    RETURN v_perms;
END;
$$;

-- ── 9. Admin RPC: Extend Expiration ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.extend_shared_access(
    p_share_id UUID,
    p_expires_at TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_share public.shared_access%ROWTYPE;
    v_next_status public.shared_access_status_enum;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_expires_at IS NULL OR p_expires_at <= now() THEN
        RAISE EXCEPTION 'New expiration date must be in the future.';
    END IF;

    SELECT * INTO v_share FROM public.shared_access WHERE id = p_share_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shared access invitation not found.';
    END IF;

    IF v_share.status = 'revoked' OR v_share.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot extend a revoked invitation.';
    END IF;

    v_next_status := CASE
        WHEN v_share.accepted_at IS NOT NULL THEN 'active'::public.shared_access_status_enum
        ELSE 'pending'::public.shared_access_status_enum
    END;

    UPDATE public.shared_access
    SET
        expires_at = p_expires_at,
        status = v_next_status
    WHERE id = p_share_id;

    INSERT INTO public.shared_access_logs (
        shared_access_id,
        actor_user_id,
        action,
        metadata
    ) VALUES (
        p_share_id,
        auth.uid(),
        'expiration_extended',
        jsonb_build_object(
            'previous_expires_at', v_share.expires_at,
            'new_expires_at', p_expires_at
        )
    );
END;
$$;

-- ── 10. Admin RPC: Revoke Access Immediately ────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_shared_access(p_share_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_share public.shared_access%ROWTYPE;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT * INTO v_share FROM public.shared_access WHERE id = p_share_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shared access invitation not found.';
    END IF;

    IF v_share.status = 'revoked' AND v_share.revoked_at IS NOT NULL THEN
        RETURN;
    END IF;

    UPDATE public.shared_access
    SET
        status = 'revoked',
        revoked_at = now()
    WHERE id = p_share_id;

    INSERT INTO public.shared_access_logs (
        shared_access_id,
        actor_user_id,
        action,
        metadata
    ) VALUES (
        p_share_id,
        auth.uid(),
        'access_revoked',
        jsonb_build_object('previous_status', v_share.status)
    );
END;
$$;

-- ── 11. Admin RPC: Rotate Invitation Token (Copy/Resend Link Securely) ──────
CREATE OR REPLACE FUNCTION public.regenerate_shared_access_token(p_share_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
    v_share public.shared_access%ROWTYPE;
    v_token TEXT;
    v_token_hash CHAR(64);
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT * INTO v_share FROM public.shared_access WHERE id = p_share_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shared access invitation not found.';
    END IF;

    IF v_share.status = 'revoked' OR v_share.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot generate a link for a revoked invitation.';
    END IF;

    IF v_share.expires_at <= now() THEN
        RAISE EXCEPTION 'Invitation has expired. Extend its expiration first.';
    END IF;

    v_token := encode(extensions.gen_random_bytes(32), 'hex');
    v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');

    UPDATE public.shared_access
    SET token_hash = v_token_hash
    WHERE id = p_share_id;

    INSERT INTO public.shared_access_logs (
        shared_access_id,
        actor_user_id,
        action,
        metadata
    ) VALUES (
        p_share_id,
        auth.uid(),
        'invitation_sent',
        jsonb_build_object('event', 'token_rotated_for_link')
    );

    RETURN jsonb_build_object(
        'id', p_share_id,
        'invite_token', v_token
    );
END;
$$;

-- ── 12. Lock Down Function Execution Privileges ─────────────────────────────
REVOKE EXECUTE ON FUNCTION
    public.normalize_shared_permissions(public.shared_resource_type_enum, JSONB),
    public.create_shared_access(TEXT, TEXT, public.shared_resource_type_enum, BIGINT, TIMESTAMPTZ, JSONB),
    public.update_shared_access_permissions(UUID, JSONB),
    public.extend_shared_access(UUID, TIMESTAMPTZ),
    public.revoke_shared_access(UUID),
    public.regenerate_shared_access_token(UUID)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
    public.normalize_shared_permissions(public.shared_resource_type_enum, JSONB),
    public.create_shared_access(TEXT, TEXT, public.shared_resource_type_enum, BIGINT, TIMESTAMPTZ, JSONB),
    public.update_shared_access_permissions(UUID, JSONB),
    public.extend_shared_access(UUID, TIMESTAMPTZ),
    public.revoke_shared_access(UUID),
    public.regenerate_shared_access_token(UUID)
TO authenticated;

