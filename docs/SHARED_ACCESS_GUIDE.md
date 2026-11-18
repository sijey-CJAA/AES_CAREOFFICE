# AES CareOffice — Secure Share Access & View-Only Record Sharing Guide

This guide documents the **Secure Share Access** subsystem implemented in AES CareOffice, including its database schema, Supabase Edge Function, security architecture, deployment steps, email configuration, and testing procedures.

---

## 1. Architecture & Security Model

AES CareOffice preserves its existing **administrator-only RLS model** (`public.admins` + `public.is_admin()`). External recipients are **never** inserted into `public.admins` and receive **zero** direct PostgREST access to `students`, `parents`, `assessment_records`, `case_register`, or any `shared_access*` table.

### Security Guarantees
1. **Email-Authenticated Access Only:** No public/anonymous record links exist. Recipients must authenticate via Supabase Auth with the exact verified email address on the invitation.
2. **Hashed Invitation Tokens:** Invitations use 256-bit cryptographically random tokens (`extensions.gen_random_bytes(32)`). Only the SHA-256 hex digest (`token_hash`) is stored in `public.shared_access`; plaintext tokens are never persisted.
3. **Server-Side Authorization & Field Filtering:** Every external viewer call (`accept`, `view`, `pdf_export`) is handled by the **`shared-access` Supabase Edge Function** (`supabase/functions/shared-access/index.ts`), which verifies:
   - Valid Supabase Auth JWT + verified email (`email_confirmed_at IS NOT NULL`)
   - Exact email match (`lower(recipient_email) === lower(user.email)`)
   - Bound `recipient_user_id === user.id` (prevents IDOR across URLs)
   - `status === 'active'`, `revoked_at IS NULL`, `expires_at > now()`
   - Resource-specific field-level filtering (`policy.ts`): unauthorized fields are **never** queried or returned in JSON responses
   - `Cache-Control: no-store` on all responses, plus fresh server-side re-validation before any PDF download
4. **Admin-Only Direct Table RLS:** `shared_access`, `shared_access_permissions`, and `shared_access_logs` have RLS enabled, `PUBLIC`/`anon` privileges revoked, append-only audit logs (`SELECT, INSERT` only), and no `DELETE` permission so expired/revoked shares remain auditable.

---

## 2. Files Created & Updated

### Database & Edge Function
- `supabase/migrations/005_shared_access.sql` — 4 ENUMs, 3 tables (`shared_access`, `shared_access_permissions`, `shared_access_logs`), RLS policies, least-privilege grants, and 6 `SECURITY INVOKER` admin RPCs.
- `supabase/functions/shared-access/policy.ts` — Pure authorization & server-side field-filtering engine.
- `supabase/functions/shared-access/index.ts` — Deno Edge Function handling `send_invite`, `accept`, `view`, and `pdf_export`.
- `supabase/hidden/scripts/apply_migrations.mjs` — Updated to seamlessly scan both `supabase/hidden/migrations/` (`001`–`004`) and `supabase/migrations/` (`005+`) in sorted order.

### Frontend (`frontend/src/`)
- `types/database.ts` — Added `SharedAccess*`, `SharedLearnerData`, `SharedAssessmentData`, `SharedCaseData`, `AuthorizedSharedResponse`.
- `services/sharedAccessService.ts` — Typed service wrapper for admin RPCs, Edge Function invocations, and viewer OTP magic-link authentication.
- `lib/pdfExport.ts` — Added `exportAuthorizedSharedRecordToPDF()` (separate from admin table exports; renders strictly authorized sections only).
- `components/sharing/ShareAccessModal.tsx` — Reusable modal for generating, copying, and emailing view-only invitations with resource-aware permission checkboxes (sensitive permissions default unchecked).
- `components/students/ViewLearnerModal.tsx` & `StudentDirectory.tsx` — Added **Share** button on Learner profiles (`resource_type: 'learner'`).
- `pages/AssessmentsPage.tsx` — Added **Share** button on Assessment records (`resource_type: 'assessment'`).
- `pages/CasesPage.tsx` — Added **Share** button on Case Register entries (`resource_type: 'case'`).
- `pages/SharedAccessPage.tsx` — Admin management page at `/shared-access` (status filters, details & audit log viewer, edit permissions, extend expiration, copy fresh link, revoke access).
- `components/AppShell.tsx` — Added **Shared Access** link under `SYSTEM` in sidebar.
- `pages/SharedAcceptPage.tsx` — Isolated external viewer invitation acceptance & email authentication at `/shared/accept`.
- `pages/SharedViewPage.tsx` — Isolated read-only viewer interface at `/shared/view/:id` with permission-aware sections and server-verified PDF export.
- `App.tsx` & `styles/global.css` — Added routes and responsive styles.

### Tests
- `frontend/src/test/sharedAccessPolicy.test.ts` — 12 unit tests covering Edge Function authorization, IDOR/revocation/expiration blocking, and strict field filtering.
- `frontend/src/test/SharedAccessFlows.test.tsx` — 5 integration tests covering admin Share Modal, `/shared-access` management, isolated viewer rendering, revoked PDF re-validation, and email mismatch blocking.

---

## 3. Database Tables Overview

| Table | Purpose | Access Control |
|---|---|---|
| `public.shared_access` | Stores invitations, `recipient_email`, `recipient_user_id`, `(resource_type, resource_id)`, SHA-256 `token_hash`, `status`, `expires_at`, `revoked_at`, `last_accessed_at` | Admin-only RLS (`SELECT, INSERT, UPDATE`); Edge Function (`service_role`) |
| `public.shared_access_permissions` | Independent boolean flags: `view_basic_info`, `view_parent_info`, `view_assessment_records`, `view_case_records`, `view_download_pdf` | Admin-only RLS (`SELECT, INSERT, UPDATE`); Edge Function (`service_role`) |
| `public.shared_access_logs` | Append-only audit trail (`invitation_created`, `invitation_sent`, `invitation_accepted`, `record_viewed`, `pdf_downloaded`, `permission_updated`, `expiration_extended`, `access_revoked`, `access_denied`) | Admin-only RLS (`SELECT, INSERT` — no `UPDATE`/`DELETE`); Edge Function (`service_role`) |

---

## 4. Environment Variables & Supabase Configuration

### Frontend (`frontend/.env.local` & Vercel)
No new frontend environment variables are required, and **no `service_role` key** is ever placed in `frontend/`:
```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-publishable-key>
```

### Edge Function Secrets (Supabase Cloud)
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by Supabase Edge Runtime. Set `APP_BASE_URL` so invitation emails always point to your production domain:

```powershell
npx supabase secrets set APP_BASE_URL=https://aes-care-connect.vercel.app --project-ref <your-project-ref>
```

### Supabase Auth Redirect URLs (Required)
In **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**, add:
- `https://aes-care-connect.vercel.app/shared/accept`
- `https://aes-care-connect.vercel.app/reset-password`
- `http://localhost:5173/shared/accept` *(for local testing)*

### Email Delivery Configuration
- Out of the box, `send_invite` uses Supabase Auth's built-in emailer (`inviteUserByEmail` for new recipients; `signInWithOtp` magic link for existing accounts).
- Supabase's default built-in emailer has strict hourly rate limits (~2–4 emails/hour on Free tier). For reliable school production delivery, configure a custom SMTP provider (e.g., Resend, Brevo, or school Google Workspace SMTP) under **Supabase Dashboard → Project Settings → Authentication → SMTP Settings**.
- Even if email rate limits are hit, administrators can always use **Copy Link** inside the Share Modal or `/shared-access` to share the invitation URL directly; the recipient still verifies their email via Supabase Auth before accessing the record.

---

## 5. Deployment Commands (Not Yet Deployed Automatically)

> **Important:** The database migration and Edge Function must be deployed to your live Supabase project before testing live sharing in production.

### Step 1 — Apply SQL Migration `005_shared_access.sql`
Either run via your local migration runner (with `SUPABASE_ACCESS_TOKEN` set in your local `.env`):
```powershell
node supabase/hidden/scripts/apply_migrations.mjs
```
Or paste the contents of `supabase/migrations/005_shared_access.sql` into **Supabase Dashboard → SQL Editor → Run**.

### Step 2 — Deploy the `shared-access` Edge Function
```powershell
npx supabase login
npx supabase functions deploy shared-access --project-ref <your-project-ref> --no-verify-jwt
```
*(Note: `--no-verify-jwt` allows CORS preflight `OPTIONS` requests cleanly while `index.ts` explicitly verifies every `Authorization: Bearer <jwt>` header via `adminClient.auth.getUser(jwt)` and rejects unauthenticated requests with `401`.)*

### Step 3 — Set `APP_BASE_URL` Secret
```powershell
npx supabase secrets set APP_BASE_URL=https://aes-care-connect.vercel.app --project-ref <your-project-ref>
```

### Step 4 — Deploy Frontend
Commit and push to `main` so Vercel builds and deploys `frontend/`.

---

## 6. Verification & End-to-End Testing Checklist

### Automated Tests
```powershell
cd frontend
npm test
npm run build
```
```powershell
node --test supabase/hidden/scripts/test_converter.mjs supabase/hidden/scripts/test_migrations_runner.mjs
```

### Manual End-to-End Test After Live Deployment
1. **Admin creates invitation:** Sign in as counselor → open a Learner profile → click **Share** → enter a secondary test email you control → keep only **Basic Learner Info** checked → set **24 hours** → click **Generate Invitation** → click **Copy Link** (or **Send Invitation Email**).
2. **Wrong-email block:** Open the invitation link while signed in as a different email → confirm `This invitation belongs to a different email address` appears and `access_denied` is logged in `/shared-access` → **Details**.
3. **Authorized viewer flow:** Sign in with the invited email via the Email Sign-In Link → verify redirection to `/shared/view/<id>` → confirm **only** Basic Learner Information appears (no admin sidebar, no Parents, no Assessments, no Cases, no Download PDF button).
4. **Live permission update:** As admin on `/shared-access`, click **Permissions** → enable **Download authorized PDF report** → refresh viewer tab → confirm **Download Authorized PDF** appears and downloads a filtered PDF.
5. **Immediate revocation:** As admin on `/shared-access`, click **Revoke** → as viewer, click **Download Authorized PDF** or reload `/shared/view/<id>` → confirm access is immediately blocked with **Shared Access Revoked**.

