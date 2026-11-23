import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  buildInvitationLinkEmail,
  buildVerificationCodeEmail,
  sendCareOfficeEmail,
} from './mailer.ts';
import {
  evaluateOtpCodeVerification,
  evaluateShareAccess,
  filterSharedAssessmentPayload,
  filterSharedCasePayload,
  filterSharedLearnerPayload,
  filterSharedReportPayload,
  normalizeEmail,
  sanitizePermissionsForResource,
  timingSafeEqualStrings,
  type AuthActor,
  type SharedAccessRow,
  type SharedPermissions,
  type SharedResourceType,
  type VerificationCodeRow,
} from './policy.ts';

const OTP_TTL_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 30;
const VIEWER_SESSION_MAX_SECONDS = 4 * 60 * 60; // 4 hours max temporary session

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      Pragma: 'no-cache',
    },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSixDigitCode(): string {
  const range = 900000; // 100000..999999
  const maxUnbiased = Math.floor(0xffffffff / range) * range;
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= maxUnbiased);
  return String(100000 + (value % range));
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Uint8Array | null {
  try {
    const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

interface ViewerSessionPayload {
  v: 1;
  sid: string;
  email: string;
  iat: number;
  exp: number;
}

async function hmacSha256Base64Url(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`aes-careoffice-viewer-session:${secret}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return toBase64Url(new Uint8Array(sig));
}

async function signViewerSession(payload: ViewerSessionPayload, secret: string): Promise<string> {
  const encoded = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSha256Base64Url(encoded, secret);
  return `${encoded}.${sig}`;
}

async function verifyViewerSession(
  token: string,
  secret: string
): Promise<ViewerSessionPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = await hmacSha256Base64Url(encoded, secret);
  if (!timingSafeEqualStrings(sig, expectedSig)) return null;

  const bytes = fromBase64Url(encoded);
  if (!bytes) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as Partial<ViewerSessionPayload>;
    if (
      parsed.v !== 1 ||
      typeof parsed.sid !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.exp !== 'number' ||
      typeof parsed.iat !== 'number'
    ) {
      return null;
    }
    if (parsed.exp * 1000 <= Date.now()) {
      return null;
    }
    return parsed as ViewerSessionPayload;
  } catch {
    return null;
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0] ?? '*'}*@${domain}`;
  return `${local.slice(0, 2)}${'*'.repeat(Math.min(5, local.length - 2))}@${domain}`;
}

function getSafeAppOrigin(requestedOrigin?: string): string {
  const configured = (Deno.env.get('APP_BASE_URL') ?? '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (requestedOrigin && /^https?:\/\/[^/\s]+$/i.test(requestedOrigin.trim())) {
    return requestedOrigin.trim().replace(/\/+$/, '');
  }
  return 'http://localhost:5173';
}

function mapDbShareRow(row: Record<string, unknown>): SharedAccessRow {
  const permsObj = Array.isArray(row.shared_access_permissions)
    ? (row.shared_access_permissions[0] as Partial<SharedPermissions> | undefined)
    : (row.shared_access_permissions as Partial<SharedPermissions> | null | undefined);

  const resourceType = row.resource_type as SharedResourceType;
  return {
    id: String(row.id),
    recipient_email: String(row.recipient_email),
    recipient_name: (row.recipient_name as string | null) ?? null,
    recipient_user_id: (row.recipient_user_id as string | null) ?? null,
    resource_type: resourceType,
    resource_id: Number(row.resource_id),
    resource_label: (row.resource_label as string | null) ?? null,
    status: row.status as SharedAccessRow['status'],
    expires_at: String(row.expires_at),
    accepted_at: (row.accepted_at as string | null) ?? null,
    revoked_at: (row.revoked_at as string | null) ?? null,
    permissions: sanitizePermissionsForResource(resourceType, permsObj),
    filter_params: (row.filter_params as Record<string, unknown> | null) ?? null,
  };
}

async function recordAuditLog(
  adminClient: ReturnType<typeof createClient>,
  shareId: string,
  actorUserId: string | null,
  action: string,
  metadata: Record<string, unknown> = {}
) {
  await adminClient.from('shared_access_logs').insert({
    shared_access_id: shareId,
    actor_user_id: actorUserId,
    action,
    metadata,
  });
}

async function fetchAuthorizedResourcePayload(
  adminClient: ReturnType<typeof createClient>,
  share: SharedAccessRow
): Promise<{ found: boolean; payload: Record<string, unknown> }> {
  const perms = sanitizePermissionsForResource(share.resource_type, share.permissions);

  if (share.resource_type === 'learner') {
    const { data: student, error: studentErr } = await adminClient
      .from('students')
      .select(
        'full_name, lrn, grade_level, grade_section, section, school_year, date_of_birth, status, home_address, blood_type, allergies, medications'
      )
      .eq('id', share.resource_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (studentErr) throw new Error(studentErr.message);
    if (!student) return { found: false, payload: {} };

    const [parentsRes, assessmentsRes, casesRes] = await Promise.all([
      perms.view_parent_info
        ? adminClient
            .from('parents')
            .select(
              'parent_type, full_name, relationship, mobile_number, telephone_number, email_address, home_address, workplace, workplace_address, emergency_contact_number'
            )
            .eq('student_id', share.resource_id)
            .is('deleted_at', null)
        : Promise.resolve({ data: [], error: null }),
      perms.view_assessment_records
        ? adminClient
            .from('assessment_records')
            .select(
              'record_number, school_year, date, grade_section, status, assessment_provider, findings, diagnosis, recommendations'
            )
            .eq('student_id', share.resource_id)
            .is('deleted_at', null)
            .order('date', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      perms.view_case_records
        ? adminClient
            .from('case_students')
            .select(
              'case_register!inner(case_number, school_year, date, grade_section, case_type, brief_description, actions_taken, outcome_disposition, deleted_at)'
            )
            .eq('student_id', share.resource_id)
            .is('case_register.deleted_at', null)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (parentsRes.error) throw new Error(parentsRes.error.message);
    if (assessmentsRes.error) throw new Error(assessmentsRes.error.message);
    if (casesRes.error) throw new Error(casesRes.error.message);

    const caseRows = (casesRes.data ?? [])
      .map((row: Record<string, unknown>) => row.case_register as Record<string, unknown> | null)
      .filter((c: Record<string, unknown> | null): c is Record<string, unknown> => c !== null)
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        String(b.date ?? '').localeCompare(String(a.date ?? ''))
      );

    return {
      found: true,
      payload: filterSharedLearnerPayload(
        {
          student,
          parents: (parentsRes.data ?? []) as Record<string, unknown>[],
          assessments: (assessmentsRes.data ?? []) as Record<string, unknown>[],
          cases: caseRows,
        },
        perms
      ),
    };
  }

  if (share.resource_type === 'assessment') {
    const { data: assessment, error } = await adminClient
      .from('assessment_records')
      .select(
        'record_number, school_year, date, grade_section, contact_number, status, assessment_provider, findings, diagnosis, recommendations, students(full_name)'
      )
      .eq('id', share.resource_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!assessment) return { found: false, payload: {} };

    const st = assessment.students as unknown as { full_name: string | null } | null;
    return {
      found: true,
      payload: filterSharedAssessmentPayload(
        {
          ...(assessment as Record<string, unknown>),
          student_name: st?.full_name ?? null,
        },
        perms
      ),
    };
  }

  if (share.resource_type === 'case') {
    const { data: caseRow, error } = await adminClient
      .from('case_register_view')
      .select(
        'case_number, student_names, school_year, date, grade_section, case_type, brief_description, actions_taken, outcome_disposition'
      )
      .eq('id', share.resource_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!caseRow) return { found: false, payload: {} };

    return {
      found: true,
      payload: filterSharedCasePayload(caseRow as Record<string, unknown>, perms),
    };
  }

  if (share.resource_type === 'report') {
    let query = adminClient
      .from('case_register_view')
      .select(
        'id, case_number, student_names, school_year, date, grade_section, case_type, brief_description, actions_taken, outcome_disposition'
      )
      .is('deleted_at', null);

    const caseIds = Array.isArray(share.filter_params?.case_ids)
      ? (share.filter_params?.case_ids as (number | string)[])
      : null;

    if (caseIds && caseIds.length > 0) {
      query = query.in('id', caseIds);
    } else {
      if (share.filter_params?.date_from) {
        query = query.gte('date', share.filter_params.date_from);
      }
      if (share.filter_params?.date_to) {
        query = query.lte('date', share.filter_params.date_to);
      }
      if (share.filter_params?.school_year && share.filter_params.school_year !== 'all') {
        query = query.eq('school_year', share.filter_params.school_year);
      }
      if (share.filter_params?.case_type) {
        query = query.ilike('case_type', `%${share.filter_params.case_type}%`);
      }
      if (share.filter_params?.outcome) {
        query = query.ilike('outcome_disposition', `%${share.filter_params.outcome}%`);
      }
    }

    query = query.order('date', { ascending: false });
    const { data: caseRows, error } = await query;

    if (error) throw new Error(error.message);

    return {
      found: true,
      payload: filterSharedReportPayload(
        (caseRows ?? []) as Record<string, unknown>[],
        perms,
        share.filter_params ?? undefined
      ),
    };
  }

  return { found: false, payload: {} };
}

async function isAuthorizedAdminUser(
  adminClient: ReturnType<typeof createClient>,
  actor: AuthActor
): Promise<boolean> {
  if (!actor.emailConfirmedAt) return false;
  const { data, error } = await adminClient
    .from('admins')
    .select('id, auth_user_id, email');
  if (error || !data) return false;

  const actorEmail = normalizeEmail(actor.email);
  return data.some(
    (row: { auth_user_id: string | null; email: string }) =>
      row.auth_user_id === actor.id || normalizeEmail(row.email) === actorEmail
  );
}

async function resolveSupabaseAuthActor(
  req: Request,
  adminClient: ReturnType<typeof createClient>
): Promise<AuthActor | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return null;
  const jwt = authHeader.slice(7).trim();
  if (!jwt) return null;

  const { data: userData, error: userErr } = await adminClient.auth.getUser(jwt);
  if (userErr || !userData?.user) return null;

  return {
    id: userData.user.id,
    email: userData.user.email ?? null,
    emailConfirmedAt: userData.user.email_confirmed_at ?? null,
    authMethod: 'supabase_auth',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Edge Function environment is not configured.' }, 500);
  }

  const signingSecret = (Deno.env.get('VIEWER_SESSION_SECRET') ?? '').trim() || serviceRoleKey;

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON request payload.' }, 400);
  }

  const action = String(body.action ?? '').trim();

  try {
    // ── ACTION 1: Admin sends/resends invitation email (NO external account created) ──
    if (action === 'send_invite') {
      const actor = await resolveSupabaseAuthActor(req, adminClient);
      if (!actor) {
        return jsonResponse(
          { error: 'Administrator sign-in required.', code: 'unauthenticated' },
          401
        );
      }

      const adminOk = await isAuthorizedAdminUser(adminClient, actor);
      if (!adminOk) {
        return jsonResponse({ error: 'Administrator privileges required.' }, 403);
      }

      const shareId = String(body.share_id ?? '').trim();
      const inviteToken = String(body.invite_token ?? '').trim();
      if (!shareId || !inviteToken) {
        return jsonResponse({ error: 'Missing share_id or invite_token.' }, 400);
      }

      const { data: rawShare, error: shareErr } = await adminClient
        .from('shared_access')
        .select('id, recipient_email, recipient_name, resource_type, resource_label, status, token_hash, expires_at, revoked_at')
        .eq('id', shareId)
        .maybeSingle();

      if (shareErr || !rawShare) {
        return jsonResponse({ error: 'Shared access record not found.' }, 404);
      }

      if (rawShare.status === 'revoked' || rawShare.revoked_at) {
        return jsonResponse({ error: 'Cannot send an invitation for a revoked share.' }, 400);
      }

      if (new Date(rawShare.expires_at).getTime() <= Date.now()) {
        return jsonResponse({ error: 'Cannot send an expired invitation. Extend expiration first.' }, 400);
      }

      const computedHash = await sha256Hex(inviteToken);
      if (!timingSafeEqualStrings(computedHash, String(rawShare.token_hash))) {
        return jsonResponse({ error: 'Invitation token mismatch. Generate a fresh link first.' }, 400);
      }

      const origin = getSafeAppOrigin(typeof body.app_origin === 'string' ? body.app_origin : undefined);
      const inviteUrl = `${origin}/shared/accept?token=${encodeURIComponent(inviteToken)}`;

      const emailContent = buildInvitationLinkEmail({
        recipientName: rawShare.recipient_name,
        resourceLabel: rawShare.resource_label,
        resourceType: rawShare.resource_type,
        inviteUrl,
        expiresAtIso: rawShare.expires_at,
      });

      const delivery = await sendCareOfficeEmail({
        to: rawShare.recipient_email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      await recordAuditLog(adminClient, shareId, actor.id, 'invitation_sent', {
        delivery_method: delivery.provider,
      });

      return jsonResponse({ sent: true, delivery_method: delivery.provider });
    }

    // ── ACTION 2: External viewer requests a 6-digit Gmail verification code ──
    if (action === 'request_verification_code') {
      const token = String(body.token ?? '').trim();
      const submittedEmail = normalizeEmail(typeof body.email === 'string' ? body.email : '');

      if (!token || token.length < 16) {
        return jsonResponse({ error: 'Invalid invitation link token.', code: 'not_found' }, 400);
      }
      if (!submittedEmail || !submittedEmail.includes('@')) {
        return jsonResponse({ error: 'Please enter a valid email address.', code: 'invalid_email' }, 400);
      }

      const tokenHash = await sha256Hex(token);
      const { data: rawShare, error: shareErr } = await adminClient
        .from('shared_access')
        .select('*, shared_access_permissions(*)')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (shareErr) throw new Error(shareErr.message);

      if (!rawShare) {
        return jsonResponse(
          { error: 'This shared record invitation was not found or is no longer valid.', code: 'not_found' },
          404
        );
      }

      const share = mapDbShareRow(rawShare as Record<string, unknown>);

      if (share.status === 'revoked' || share.revoked_at !== null) {
        await recordAuditLog(adminClient, share.id, null, 'access_denied', {
          stage: 'request_code',
          reason: 'revoked',
        });
        return jsonResponse(
          { error: 'Access to this shared record has been revoked by the administrator.', code: 'revoked' },
          403
        );
      }

      if (share.status === 'expired' || new Date(share.expires_at).getTime() <= Date.now()) {
        if (share.status !== 'expired') {
          await adminClient.from('shared_access').update({ status: 'expired' }).eq('id', share.id);
        }
        await recordAuditLog(adminClient, share.id, null, 'access_denied', {
          stage: 'request_code',
          reason: 'expired',
        });
        return jsonResponse(
          { error: 'This shared access invitation has expired. Please contact the Guidance Office.', code: 'expired' },
          410
        );
      }

      if (normalizeEmail(share.recipient_email) !== submittedEmail) {
        await recordAuditLog(adminClient, share.id, null, 'access_denied', {
          stage: 'request_code',
          reason: 'email_mismatch',
        });
        return jsonResponse(
          { error: 'This email address does not match the invited recipient for this link.', code: 'email_mismatch' },
          403
        );
      }

      // Rate-limit resend requests (30-second cooldown)
      const { data: recentCode } = await adminClient
        .from('shared_access_verifications')
        .select('created_at')
        .eq('shared_access_id', share.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentCode?.created_at) {
        const elapsedSec = Math.floor((Date.now() - new Date(recentCode.created_at).getTime()) / 1000);
        if (elapsedSec < OTP_RESEND_COOLDOWN_SECONDS) {
          const waitSec = OTP_RESEND_COOLDOWN_SECONDS - elapsedSec;
          return jsonResponse(
            {
              error: `A verification code was just sent. Please wait ${waitSec} seconds before requesting another.`,
              code: 'rate_limited',
            },
            429
          );
        }
      }

      const code = generateSixDigitCode();
      const codeHash = await sha256Hex(`${share.id}:${code}`);
      const codeExpiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

      // Invalidate any prior unused verification codes for this share
      await adminClient
        .from('shared_access_verifications')
        .update({ used_at: new Date().toISOString() })
        .eq('shared_access_id', share.id)
        .is('used_at', null);

      const { error: insertErr } = await adminClient.from('shared_access_verifications').insert({
        shared_access_id: share.id,
        recipient_email: share.recipient_email,
        code_hash: codeHash,
        expires_at: codeExpiresAt,
      });

      if (insertErr) throw new Error(insertErr.message);

      const emailContent = buildVerificationCodeEmail({
        recipientName: share.recipient_name,
        resourceLabel: share.resource_label,
        code,
        expiresMinutes: OTP_TTL_MINUTES,
      });

      const delivery = await sendCareOfficeEmail({
        to: share.recipient_email,
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
      });

      await recordAuditLog(adminClient, share.id, null, 'verification_code_sent', {
        delivery_method: delivery.provider,
      });

      return jsonResponse({
        sent: true,
        expires_in_seconds: OTP_TTL_MINUTES * 60,
        masked_email: maskEmail(share.recipient_email),
      });
    }

    // ── ACTION 3: External viewer submits 6-digit Gmail verification code ─────
    if (action === 'verify_code') {
      const token = String(body.token ?? '').trim();
      const submittedEmail = normalizeEmail(typeof body.email === 'string' ? body.email : '');
      const submittedCode = String(body.code ?? '').replace(/\D/g, '').trim();

      if (!token || token.length < 16) {
        return jsonResponse({ error: 'Invalid invitation link token.', code: 'not_found' }, 400);
      }
      if (!submittedEmail || !submittedEmail.includes('@')) {
        return jsonResponse({ error: 'Please enter your invited email address.', code: 'invalid_email' }, 400);
      }
      if (!/^\d{6}$/.test(submittedCode)) {
        return jsonResponse({ error: 'Please enter the 6-digit verification code from your email.', code: 'invalid_code' }, 400);
      }

      const tokenHash = await sha256Hex(token);
      const { data: rawShare, error: shareErr } = await adminClient
        .from('shared_access')
        .select('*, shared_access_permissions(*)')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (shareErr) throw new Error(shareErr.message);

      if (!rawShare) {
        return jsonResponse(
          { error: 'This shared record invitation was not found or is no longer valid.', code: 'not_found' },
          404
        );
      }

      const share = mapDbShareRow(rawShare as Record<string, unknown>);

      if (share.status === 'revoked' || share.revoked_at !== null) {
        await recordAuditLog(adminClient, share.id, null, 'access_denied', {
          stage: 'verify_code',
          reason: 'revoked',
        });
        return jsonResponse(
          { error: 'Access to this shared record has been revoked by the administrator.', code: 'revoked' },
          403
        );
      }

      if (share.status === 'expired' || new Date(share.expires_at).getTime() <= Date.now()) {
        if (share.status !== 'expired') {
          await adminClient.from('shared_access').update({ status: 'expired' }).eq('id', share.id);
        }
        await recordAuditLog(adminClient, share.id, null, 'access_denied', {
          stage: 'verify_code',
          reason: 'expired',
        });
        return jsonResponse(
          { error: 'This shared access invitation has expired. Please contact the Guidance Office.', code: 'expired' },
          410
        );
      }

      if (normalizeEmail(share.recipient_email) !== submittedEmail) {
        await recordAuditLog(adminClient, share.id, null, 'access_denied', {
          stage: 'verify_code',
          reason: 'email_mismatch',
        });
        return jsonResponse(
          { error: 'This invitation belongs to a different email address.', code: 'email_mismatch' },
          403
        );
      }

      const { data: latestOtp, error: otpErr } = await adminClient
        .from('shared_access_verifications')
        .select('id, code_hash, expires_at, attempts, used_at')
        .eq('shared_access_id', share.id)
        .is('used_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (otpErr) throw new Error(otpErr.message);

      const submittedHash = await sha256Hex(`${share.id}:${submittedCode}`);
      const otpCheck = evaluateOtpCodeVerification(
        (latestOtp as (VerificationCodeRow & { id: string }) | null) ?? null,
        submittedHash
      );

      if (!otpCheck.ok) {
        if (latestOtp && otpCheck.shouldIncrementAttempts) {
          await adminClient
            .from('shared_access_verifications')
            .update({ attempts: (latestOtp.attempts ?? 0) + 1 })
            .eq('id', latestOtp.id);
        }
        await recordAuditLog(adminClient, share.id, null, 'access_denied', {
          stage: 'verify_code',
          reason: otpCheck.code,
        });
        return jsonResponse({ error: otpCheck.message, code: otpCheck.code }, otpCheck.httpStatus);
      }

      const nowIso = new Date().toISOString();

      await adminClient
        .from('shared_access_verifications')
        .update({ used_at: nowIso })
        .eq('id', latestOtp!.id);

      const { error: activateErr } = await adminClient
        .from('shared_access')
        .update({
          status: 'active',
          accepted_at: share.accepted_at ?? nowIso,
          last_accessed_at: nowIso,
        })
        .eq('id', share.id);

      if (activateErr) throw new Error(activateErr.message);

      const nowSec = Math.floor(Date.now() / 1000);
      const shareExpSec = Math.floor(new Date(share.expires_at).getTime() / 1000);
      const sessionExpSec = Math.min(nowSec + VIEWER_SESSION_MAX_SECONDS, shareExpSec);

      const viewerSession = await signViewerSession(
        {
          v: 1,
          sid: share.id,
          email: submittedEmail,
          iat: nowSec,
          exp: sessionExpSec,
        },
        signingSecret
      );

      await recordAuditLog(adminClient, share.id, null, 'invitation_accepted', {
        resource_type: share.resource_type,
        method: 'email_otp',
      });

      return jsonResponse({
        share_id: share.id,
        resource_type: share.resource_type,
        viewer_session: viewerSession,
        viewer_email: share.recipient_email,
        session_expires_at: new Date(sessionExpSec * 1000).toISOString(),
      });
    }

    // ── ACTION 4 & 5: Recipient views record OR requests authorized PDF data ──
    if (action === 'view' || action === 'pdf_export') {
      const shareId = String(body.share_id ?? '').trim();
      if (!shareId || !/^[0-9a-f-]{36}$/i.test(shareId)) {
        return jsonResponse({ error: 'Invalid shared record identifier.', code: 'not_found' }, 400);
      }

      // Resolve viewer identity via temporary signed viewer_session (primary) or Supabase JWT (fallback)
      let actor: AuthActor | null = null;
      const viewerSessionToken = typeof body.viewer_session === 'string' ? body.viewer_session.trim() : '';
      if (viewerSessionToken) {
        const parsedSession = await verifyViewerSession(viewerSessionToken, signingSecret);
        if (parsedSession) {
          actor = {
            id: null,
            email: parsedSession.email,
            emailConfirmedAt: new Date(parsedSession.iat * 1000).toISOString(),
            authMethod: 'email_otp',
            sessionShareId: parsedSession.sid,
          };
        }
      } else {
        actor = await resolveSupabaseAuthActor(req, adminClient);
      }

      const { data: rawShare, error: shareErr } = await adminClient
        .from('shared_access')
        .select('*, shared_access_permissions(*)')
        .eq('id', shareId)
        .maybeSingle();

      if (shareErr) throw new Error(shareErr.message);

      const share = rawShare ? mapDbShareRow(rawShare as Record<string, unknown>) : null;
      const check = evaluateShareAccess(share, actor, {
        mode: action === 'pdf_export' ? 'pdf' : 'view',
      });

      if (!check.ok) {
        if (share) {
          if (check.shouldMarkExpired) {
            await adminClient.from('shared_access').update({ status: 'expired' }).eq('id', share.id);
          }
          await recordAuditLog(adminClient, share.id, actor?.id ?? null, 'access_denied', {
            stage: action,
            reason: check.code,
          });
        }
        return jsonResponse({ error: check.message, code: check.code }, check.httpStatus);
      }

      const { found, payload } = await fetchAuthorizedResourcePayload(adminClient, share!);
      if (!found) {
        await recordAuditLog(adminClient, share!.id, actor?.id ?? null, 'access_denied', {
          stage: action,
          reason: 'resource_archived_or_missing',
        });
        return jsonResponse(
          { error: 'The shared record is no longer available.', code: 'not_found' },
          404
        );
      }

      await adminClient
        .from('shared_access')
        .update({ last_accessed_at: new Date().toISOString() })
        .eq('id', share!.id);

      await recordAuditLog(
        adminClient,
        share!.id,
        actor?.id ?? null,
        action === 'pdf_export' ? 'pdf_downloaded' : 'record_viewed',
        { resource_type: share!.resource_type }
      );

      return jsonResponse({
        share: {
          id: share!.id,
          resource_type: share!.resource_type,
          resource_label: share!.resource_label,
          recipient_email: share!.recipient_email,
          recipient_name: share!.recipient_name,
          expires_at: share!.expires_at,
          accepted_at: share!.accepted_at,
          permissions: sanitizePermissionsForResource(share!.resource_type, share!.permissions),
        },
        data: payload,
      });
    }

    return jsonResponse({ error: `Unsupported action: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected server error.';
    return jsonResponse({ error: message }, 500);
  }
});

