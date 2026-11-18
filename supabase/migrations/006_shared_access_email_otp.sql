-- ============================================================================
-- AES CareOffice — Migration 006: Passwordless Email Verification Codes (OTP)
-- ============================================================================
-- Enables temporary Gmail 6-digit code verification for shared record viewers
-- WITHOUT creating external accounts or logins in auth.users.
--
-- Security Guarantees:
--   1. Preserves all existing tables, data, and public.is_admin() RLS policies.
--   2. Stores ONLY SHA-256 hashes of 6-digit verification codes (never plaintext).
--   3. Locks public.shared_access_verifications so neither anon nor authenticated
--      PostgREST clients can read/write codes; ONLY the Edge Function (service_role)
--      generates and validates verification codes.
--   4. Adds 'verification_code_sent' to public.shared_access_action_enum for audit trails.
-- ============================================================================

ALTER TYPE public.shared_access_action_enum
    ADD VALUE IF NOT EXISTS 'verification_code_sent';

CREATE TABLE IF NOT EXISTS public.shared_access_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shared_access_id UUID NOT NULL REFERENCES public.shared_access(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    used_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_access_verifications_share_created
    ON public.shared_access_verifications (shared_access_id, created_at DESC);

ALTER TABLE public.shared_access_verifications ENABLE ROW LEVEL SECURITY;

-- Zero direct PostgREST access for PUBLIC, anon, or authenticated users.
-- All verification code creation and validation occurs strictly inside the
-- `shared-access` Supabase Edge Function using the service_role client.
REVOKE ALL ON TABLE public.shared_access_verifications FROM PUBLIC, anon, authenticated;

