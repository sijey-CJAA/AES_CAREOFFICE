# AES CareOffice — Secure Share Access & View-Only Record Sharing Guide

This guide documents the **Secure Share Access** subsystem implemented in AES CareOffice, including its database schema, Supabase Edge Function, passwordless Gmail 6-digit verification model, deployment steps, and testing procedures.

---

## 1. Architecture & Security Model

AES CareOffice preserves its existing **administrator-only RLS model** (`public.admins` + `public.is_admin()`). External recipients are **never** inserted into `public.admins`, **never** created as accounts in `auth.users`, and receive **zero** direct PostgREST access to `students`, `parents`, `assessment_records`, `case_register`, or any `shared_access*` table.

### Security Guarantees
1. **Passwordless Gmail 6-Digit Verification (No Sign-Up or Login Required):**
   - No unrestricted public record links exist, AND external recipients never have to sign up or log into Vercel, Supabase, or any third-party app.
   - Recipients open their private invitation link (`/shared/accept?token=...`), enter their invited email address, and receive a **one-time 6-digit verification code** in their Gmail inbox (10-minute expiration, 5-attempt lockout, 30-second resend cooldown).
   - Once verified, the Edge Function issues a short-lived **HMAC-SHA256 signed Temporary Viewer Session** (stored strictly in `sessionStorage` for that browser tab, capped at 4 hours or the share's expiration, and scoped exclusively to that single `share_id`).
2. **Hashed Tokens & Codes Only:**
   - Invitation tokens use 256-bit cryptographically random bytes (`extensions.gen_random_bytes(32)`); only the SHA-256 `token_hash` is stored in `public.shared_access`.
   - 6-digit email verification codes are stored strictly as SHA-256 hashes in `public.shared_access_verifications` (zero PostgREST access for `anon`/`authenticated`; `service_role` only).
3. **Server-Side Authorization & Field Filtering:**
   - Every viewer request (`request_verification_code`, `verify_code`, `view`, `pdf_export`) is verified server-side inside the **`shared-access` Supabase Edge Function** (`supabase/functions/shared-access/index.ts`), enforcing:
     - Valid HMAC-signed temporary viewer session bound strictly to `share_id` (prevents IDOR across URLs)
     - Exact email match (`lower(recipient_email) === lower(session.email)`)
     - Live DB check of `status === 'active'`, `revoked_at IS NULL`, `expires_at > now()` (revoking access takes effect immediately)
     - Resource-specific field-level filtering (`policy.ts`): unauthorized fields are never queried or returned in JSON responses
     - `Cache-Control: no-store` on all responses, plus fresh server-side re-validation before every PDF download
4. **Admin-Only Direct Table RLS:** `shared_access`, `shared_access_permissions`, and `shared_access_logs` have RLS enabled, `PUBLIC`/`anon` privileges revoked, append-only audit logs (`SELECT, INSERT` only), and no `DELETE` permission so expired/revoked shares remain auditable.

---

## 2. Files Created & Updated

### Database & Edge Function
- `supabase/migrations/005_shared_access.sql` — 4 ENUMs, 3 tables (`shared_access`, `shared_access_permissions`, `shared_access_logs`), admin-only RLS policies, least-privilege grants, and 6 `SECURITY INVOKER` admin RPCs.
- `supabase/migrations/006_shared_access_email_otp.sql` — Adds `public.shared_access_verifications` (hashed 6-digit OTP storage locked to `service_role`) and `'verification_code_sent'` audit action.
- `supabase/functions/shared-access/policy.ts` — Pure authorization, OTP verification, and server-side field-filtering engine.
- `supabase/functions/shared-access/mailer.ts` — Pure HTTPS email delivery supporting the Google Apps Script Gmail Bridge (`GMAIL_WEBHOOK_URL`) and optional Resend API (`RESEND_API_KEY`).
- `supabase/functions/shared-access/gmail_apps_script_bridge.gs` — 20-line script you paste into your own Google Apps Script account (`script.google.com`) to send verification codes directly from Gmail with zero third-party sign-ups.
- `supabase/functions/shared-access/index.ts` — Deno Edge Function handling `send_invite`, `request_verification_code`, `verify_code`, `view`, and `pdf_export`.

### Frontend (`frontend/src/`)
- `types/database.ts` — `SharedAccess*`, `SharedLearnerData`, `SharedAssessmentData`, `SharedCaseData`, `AuthorizedSharedResponse`.
- `services/sharedAccessService.ts` — Typed service wrapper for admin RPCs, Edge Function calls, 6-digit Gmail OTP verification, and tab-only `sessionStorage` viewer session management.
- `lib/pdfExport.ts` — Dedicated `exportAuthorizedSharedRecordToPDF()` (never reuses admin exports; renders only authorized sections).
- `components/sharing/ShareAccessModal.tsx` — Share modal wired into Learner profiles, Assessments, and Cases (sensitive permissions default unchecked).
- `pages/SharedAccessPage.tsx` — Admin management page at `/shared-access` (filters, details & activity logs, edit permissions, extend expiration, copy fresh link, revoke access).
- `pages/SharedAcceptPage.tsx` — Isolated 2-step Gmail verification screen at `/shared/accept` (no sign-up, no password, no login).
- `pages/SharedViewPage.tsx` — Isolated read-only viewer at `/shared/view/:id` with temporary session banner, **Close Session**, and server-verified PDF export.

---

## 3. Pure Gmail Delivery Setup (Zero Third-Party Sign-Ups — 2 Minutes)

Supabase Edge Functions block outbound SMTP ports 25/587, so the cleanest way to send emails strictly through **your own Gmail account** without signing up for any external email service is Google's built-in **Google Apps Script**:

1. Open [script.google.com](https://script.google.com) while signed into your Guidance Office Gmail account.
2. Click **New project**, clear the default code, and paste the contents of `supabase/functions/shared-access/gmail_apps_script_bridge.gs`.
3. Click **Project Settings** (gear icon) → **Script Properties** → **Add script property**:
   - Property: `WEBHOOK_SECRET`
   - Value: any long random password you choose (e.g. `aes-care-2026-secret-9x8k2m`)
4. Click **Deploy → New deployment**:
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, authorize Gmail sending when Google asks, and copy the **Web app URL** (ends with `/exec`).
5. Save the URL and secret in Supabase (Step 3 below).

---

## 4. Deployment Steps

### Step 1 — Run SQL Migrations (`005` + `006`)
- If `005_shared_access.sql` is already applied, paste `supabase/migrations/006_shared_access_email_otp.sql` into **Supabase Dashboard → SQL Editor → Run**.
- *(Or run `node supabase/hidden/scripts/apply_migrations.mjs` locally with `SUPABASE_ACCESS_TOKEN` set.)*

### Step 2 — Deploy the `shared-access` Edge Function
```powershell
npx supabase login
npx supabase functions deploy shared-access --project-ref qrsjdtayhufppajokegu --no-verify-jwt
```
*(Note: `--no-verify-jwt` is required because external viewers do not have a Supabase Auth login; `send_invite` strictly verifies the admin's JWT inside `index.ts`, while viewer endpoints strictly verify the 256-bit invitation token, 6-digit Gmail OTP, and HMAC-signed temporary session.)*

### Step 3 — Set Supabase Edge Function Secrets
```powershell
npx supabase secrets set `
  APP_BASE_URL="https://aes-care-connect.vercel.app" `
  GMAIL_WEBHOOK_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec" `
  GMAIL_WEBHOOK_SECRET="YOUR_SAME_WEBHOOK_SECRET" `
  --project-ref qrsjdtayhufppajokegu
```

### Step 4 — Deploy Frontend
Commit and push to `main` so Vercel automatically deploys the updated `frontend/` build.

---

## 5. End-to-End Verification Checklist
1. **Admin Creates & Sends Share:** Open a Learner/Assessment/Case → click **Share** → enter recipient Gmail → verify sensitive checkboxes start unchecked → click **Generate Invitation** → click **Send Invitation Email** → confirm email arrives in recipient's Gmail inbox.
2. **Recipient Opens Link (No Login / No Sign-Up):** Open the private link in an incognito browser → verify there is **no password or signup form** → enter the invited Gmail → click **Send 6-Digit Verification Code** → enter the 6-digit code from Gmail → confirm read-only viewer opens with **only** the checked sections.
3. **Wrong Email Blocked:** Enter an uninvited email on `/shared/accept` → verify access is denied and logged as `Access Denied` on `/shared-access`.
4. **Immediate Revocation:** While the viewer has `/shared/view/:id` open, click **Revoke** on `/shared-access` → refresh or click **Download Authorized PDF** in the viewer → verify immediate `Shared Access Revoked` block and cleared temporary session.
5. **No Admin Leak:** While viewing a shared record, visit `/` or `/shared-access` → verify the viewer is redirected to `/login` (they have zero admin session or `auth.users` account).
