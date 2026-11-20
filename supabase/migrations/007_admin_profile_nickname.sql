-- ============================================================================
-- AES CareOffice — Migration 007: Admin Profile Nickname / Display Name
-- ============================================================================
-- Adds `nickname` and `display_name` columns to `public.admins` so counselors
-- can configure a custom display name (e.g., "Christopher Artuz") instead of
-- relying on raw email parsing.
--
-- Security Guarantees:
--   1. Preserves existing admin RLS policies; admins can only read and update
--      their own admin row (`auth_user_id = auth.uid()` or matching verified email).
--   2. Non-admins cannot read or modify any rows in `public.admins`.
--   3. Provides a secure SECURITY INVOKER RPC `public.update_admin_profile`.
-- ============================================================================

ALTER TABLE public.admins
    ADD COLUMN IF NOT EXISTS nickname VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS display_name VARCHAR(100) DEFAULT NULL;

-- Automatically pre-populate Christopher Artuz's nickname if unassigned
UPDATE public.admins
SET nickname = 'Christopher Artuz',
    display_name = 'Christopher Artuz'
WHERE lower(email) = 'artuzjrchristopher@gmail.com'
  AND (nickname IS NULL OR btrim(nickname) = '');

-- Grant UPDATE privilege on public.admins to authenticated users
GRANT SELECT, UPDATE ON public.admins TO authenticated;

-- Allow verified admins to update their own profile/nickname
DROP POLICY IF EXISTS admins_update_own_profile ON public.admins;
CREATE POLICY admins_update_own_profile ON public.admins
    FOR UPDATE TO authenticated
    USING (
        public.is_admin() AND (
            auth_user_id = auth.uid() OR
            lower(email) = lower(COALESCE(auth.jwt()->>'email', ''))
        )
    )
    WITH CHECK (
        public.is_admin() AND (
            auth_user_id = auth.uid() OR
            lower(email) = lower(COALESCE(auth.jwt()->>'email', ''))
        )
    );

-- Helper RPC for updating admin profile nickname safely
CREATE OR REPLACE FUNCTION public.update_admin_profile(p_nickname TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_email TEXT := lower(COALESCE(auth.jwt()->>'email', ''));
    v_trimmed TEXT := btrim(COALESCE(p_nickname, ''));
    v_updated public.admins%ROWTYPE;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Access denied. Administrator privileges required.';
    END IF;

    IF v_trimmed = '' THEN
        v_trimmed := NULL;
    END IF;

    UPDATE public.admins
    SET nickname = v_trimmed,
        display_name = v_trimmed,
        auth_user_id = COALESCE(auth_user_id, v_user_id)
    WHERE (auth_user_id = v_user_id OR lower(email) = v_email)
    RETURNING * INTO v_updated;

    IF NOT FOUND THEN
        UPDATE public.admins
        SET nickname = v_trimmed,
            display_name = v_trimmed
        WHERE auth_user_id = v_user_id
        RETURNING * INTO v_updated;
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Admin profile record not found for this user.';
    END IF;

    RETURN jsonb_build_object(
        'id', v_updated.id,
        'email', v_updated.email,
        'nickname', v_updated.nickname,
        'display_name', v_updated.display_name
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_admin_profile(TEXT) TO authenticated;

