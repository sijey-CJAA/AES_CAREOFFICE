import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  evaluateShareAccess,
  filterSharedAssessmentPayload,
  filterSharedCasePayload,
  filterSharedLearnerPayload,
  normalizeEmail,
  sanitizePermissionsForResource,
  type AuthActor,
  type SharedAccessRow,
  type SharedPermissions,
  type SharedResourceType,
} from './policy.ts';

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
      .filter((c): c is Record<string, unknown> => c !== null)
      .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return jsonResponse({ error: 'Edge Function environment is not configured.' }, 500);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing Authorization token.', code: 'unauthenticated' }, 401);
  }

  const jwt = authHeader.slice(7).trim();
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await adminClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: 'Invalid or expired session. Please sign in again.', code: 'unauthenticated' }, 401);
  }

  const actor: AuthActor = {
    id: userData.user.id,
    email: userData.user.email ?? null,
    emailConfirmedAt: userData.user.email_confirmed_at ?? null,
  };

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ error: 'Invalid JSON request payload.' }, 400);
  }

  const action = String(body.action ?? '').trim();

  try {
    // ── ACTION 1: Admin sends/resends invitation email ───────────────────────
    if (action === 'send_invite') {
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
      if (computedHash !== rawShare.token_hash) {
        return jsonResponse({ error: 'Invitation token mismatch. Generate a fresh link first.' }, 400);
      }

      const origin = getSafeAppOrigin(typeof body.app_origin === 'string' ? body.app_origin : undefined);
      const redirectTo = `${origin}/shared/accept?token=${encodeURIComponent(inviteToken)}`;

      let deliveryMethod: 'invite' | 'magic_link' = 'invite';
      const inviteRes = await adminClient.auth.admin.inviteUserByEmail(rawShare.recipient_email, {
        redirectTo,
        data: {
          invited_role: 'shared_viewer',
          full_name: rawShare.recipient_name ?? undefined,
        },
      });

      if (inviteRes.error) {
        // Recipient already has a Supabase Auth account -> deliver a verified Magic Link OTP
        const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const otpRes = await anonClient.auth.signInWithOtp({
          email: rawShare.recipient_email,
          options: {
            emailRedirectTo: redirectTo,
            shouldCreateUser: false,
          },
        });
        if (otpRes.error) {
          return jsonResponse(
            {
              error: `Could not deliver invitation email: ${otpRes.error.message}. You can still copy the invitation link manually.`,
            },
            502
          );
        }
        deliveryMethod = 'magic_link';
      }

      await recordAuditLog(adminClient, shareId, actor.id, 'invitation_sent', {
        delivery_method: deliveryMethod,
      });

      return jsonResponse({ sent: true, delivery_method: deliveryMethod });
    }

    // ── ACTION 2: Recipient accepts invitation token ─────────────────────────
    if (action === 'accept') {
      const token = String(body.token ?? '').trim();
      if (!token || token.length < 16) {
        return jsonResponse({ error: 'Invalid invitation token.', code: 'not_found' }, 400);
      }

      const tokenHash = await sha256Hex(token);
      const { data: rawShare, error: shareErr } = await adminClient
        .from('shared_access')
        .select('*, shared_access_permissions(*)')
        .eq('token_hash', tokenHash)
        .maybeSingle();

      if (shareErr) throw new Error(shareErr.message);

      const share = rawShare ? mapDbShareRow(rawShare as Record<string, unknown>) : null;
      const check = evaluateShareAccess(share, actor, { mode: 'accept' });

      if (!check.ok) {
        if (share) {
          if (check.shouldMarkExpired) {
            await adminClient.from('shared_access').update({ status: 'expired' }).eq('id', share.id);
          }
          await recordAuditLog(adminClient, share.id, actor.id, 'access_denied', {
            stage: 'accept',
            reason: check.code,
          });
        }
        return jsonResponse({ error: check.message, code: check.code }, check.httpStatus);
      }

      const nowIso = new Date().toISOString();
      const { error: bindErr } = await adminClient
        .from('shared_access')
        .update({
          recipient_user_id: actor.id,
          status: 'active',
          accepted_at: share!.accepted_at ?? nowIso,
        })
        .eq('id', share!.id);

      if (bindErr) throw new Error(bindErr.message);

      await recordAuditLog(adminClient, share!.id, actor.id, 'invitation_accepted', {
        resource_type: share!.resource_type,
      });

      return jsonResponse({
        share_id: share!.id,
        resource_type: share!.resource_type,
      });
    }

    // ── ACTION 3 & 4: Recipient views record OR requests authorized PDF data ─
    if (action === 'view' || action === 'pdf_export') {
      const shareId = String(body.share_id ?? '').trim();
      if (!shareId || !/^[0-9a-f-]{36}$/i.test(shareId)) {
        return jsonResponse({ error: 'Invalid shared record identifier.', code: 'not_found' }, 400);
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
          await recordAuditLog(adminClient, share.id, actor.id, 'access_denied', {
            stage: action,
            reason: check.code,
          });
        }
        return jsonResponse({ error: check.message, code: check.code }, check.httpStatus);
      }

      const { found, payload } = await fetchAuthorizedResourcePayload(adminClient, share!);
      if (!found) {
        await recordAuditLog(adminClient, share!.id, actor.id, 'access_denied', {
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
        actor.id,
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

