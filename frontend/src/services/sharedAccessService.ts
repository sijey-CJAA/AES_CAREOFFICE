import { getSupabaseClient } from '../lib/supabase';
import type {
  AuthorizedSharedResponse,
  CreateSharedAccessInput,
  CreateSharedAccessResult,
  SharedAccessLogRecord,
  SharedAccessPermissions,
  SharedAccessRecord,
  SharedAccessStatus,
  SharedResourceType,
} from '../types/database';

export class SharedAccessError extends Error {
  code?: string;
  httpStatus?: number;

  constructor(message: string, code?: string, httpStatus?: number) {
    super(message);
    this.name = 'SharedAccessError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface PermissionMeta {
  key: keyof SharedAccessPermissions;
  label: string;
  description: string;
  sensitive?: boolean;
}

export function getApplicablePermissions(resourceType: SharedResourceType): PermissionMeta[] {
  if (resourceType === 'learner') {
    return [
      {
        key: 'view_basic_info',
        label: 'View basic learner information',
        description: 'Name, LRN, grade & section, school year, DOB, status, and medical basics.',
      },
      {
        key: 'view_parent_info',
        label: 'View parent/guardian information',
        description: 'Primary and secondary parent/guardian names and contact details.',
        sensitive: true,
      },
      {
        key: 'view_assessment_records',
        label: 'View assessment records',
        description: 'Linked guidance assessment providers, findings, diagnoses, and recommendations.',
        sensitive: true,
      },
      {
        key: 'view_case_records',
        label: 'View counseling/case records',
        description: 'Linked case register entries, incident descriptions, and actions taken.',
        sensitive: true,
      },
      {
        key: 'view_download_pdf',
        label: 'Download authorized PDF report',
        description: 'Allows exporting a view-only PDF containing only the checked sections above.',
      },
    ];
  }

  if (resourceType === 'assessment') {
    return [
      {
        key: 'view_basic_info',
        label: 'View basic learner & assessment header',
        description: 'Record number, learner name, grade & section, date, school year, and status.',
      },
      {
        key: 'view_parent_info',
        label: 'View parent/guardian contact number',
        description: 'Displays the parent contact number attached to this assessment.',
        sensitive: true,
      },
      {
        key: 'view_assessment_records',
        label: 'View assessment findings, diagnosis & recommendations',
        description: 'Assessment provider, clinical findings, diagnosis, and recommendations.',
        sensitive: true,
      },
      {
        key: 'view_download_pdf',
        label: 'Download authorized PDF report',
        description: 'Allows exporting a view-only PDF containing only the checked sections above.',
      },
    ];
  }

  if (resourceType === 'report') {
    return [
      {
        key: 'view_basic_info',
        label: 'View basic case summary & register table',
        description: 'Case number, learner name(s), date, school year, grade & section, and outcome disposition.',
      },
      {
        key: 'view_case_records',
        label: 'View counseling incident details & actions taken',
        description: 'Includes case types, brief incident descriptions, and counselor actions taken for all cases in the filtered batch.',
        sensitive: true,
      },
      {
        key: 'view_download_pdf',
        label: 'Download authorized PDF report',
        description: 'Allows exporting an authorized view-only PDF of the shared cases register.',
      },
    ];
  }

  return [
    {
      key: 'view_basic_info',
      label: 'View basic case summary',
      description: 'Case number, involved learner name(s), date, school year, and outcome disposition.',
    },
    {
      key: 'view_case_records',
      label: 'View counseling/case details',
      description: 'Case type, brief incident description, and counselor actions taken.',
      sensitive: true,
    },
    {
      key: 'view_download_pdf',
      label: 'Download authorized PDF report',
      description: 'Allows exporting a view-only PDF containing only the checked sections above.',
    },
  ];
}

/**
 * Defaults strictly to minimum necessary access.
 * Sensitive parent, assessment, counseling case, and PDF permissions start unchecked.
 */
export function defaultPermissionsForResource(): SharedAccessPermissions {
  return {
    view_basic_info: true,
    view_parent_info: false,
    view_assessment_records: false,
    view_case_records: false,
    view_download_pdf: false,
  };
}

export function buildInvitationLink(token: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/shared/accept?token=${encodeURIComponent(token)}`;
}

export function getEffectiveShareStatus(record: Pick<SharedAccessRecord, 'status' | 'revoked_at' | 'expires_at'>): SharedAccessStatus {
  if (record.status === 'revoked' || record.revoked_at) return 'revoked';
  if (record.status === 'expired' || new Date(record.expires_at).getTime() <= Date.now()) {
    return 'expired';
  }
  return record.status;
}

async function invokeSharedAccessFunction<T>(body: Record<string, unknown>): Promise<T> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.functions.invoke('shared-access', { body });

  if (error) {
    let errMsg = error.message || 'Unable to process shared access request.';
    let errCode: string | undefined;
    let httpStatus: number | undefined;

    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.clone === 'function') {
      httpStatus = ctx.status;
      try {
        const parsed = (await ctx.clone().json()) as { error?: string; code?: string };
        if (parsed?.error) errMsg = parsed.error;
        if (parsed?.code) errCode = parsed.code;
      } catch {
        // Ignore non-JSON body
      }
    }

    throw new SharedAccessError(errMsg, errCode, httpStatus);
  }

  return data as T;
}

export async function fetchSharedAccessList(): Promise<SharedAccessRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('shared_access')
    .select('*, shared_access_permissions(*)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const rawPerms = Array.isArray(row.shared_access_permissions)
      ? row.shared_access_permissions[0]
      : row.shared_access_permissions;

    const { shared_access_permissions: _ignored, token_hash: _hiddenHash, ...rest } = row as Record<
      string,
      unknown
    >;

    return {
      ...(rest as unknown as Omit<SharedAccessRecord, 'permissions'>),
      permissions: {
        view_basic_info: Boolean(rawPerms?.view_basic_info),
        view_parent_info: Boolean(rawPerms?.view_parent_info),
        view_assessment_records: Boolean(rawPerms?.view_assessment_records),
        view_case_records: Boolean(rawPerms?.view_case_records),
        view_download_pdf: Boolean(rawPerms?.view_download_pdf),
      },
    };
  });
}

export async function fetchSharedAccessLogs(shareId: string): Promise<SharedAccessLogRecord[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('shared_access_logs')
    .select('*')
    .eq('shared_access_id', shareId)
    .order('accessed_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SharedAccessLogRecord[];
}

export async function createSharedAccess(
  input: CreateSharedAccessInput
): Promise<CreateSharedAccessResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('create_shared_access', {
    p_recipient_email: input.recipient_email.trim(),
    p_recipient_name: input.recipient_name?.trim() || null,
    p_resource_type: input.resource_type,
    p_resource_id: input.resource_id,
    p_expires_at: input.expires_at,
    p_permissions: input.permissions,
    p_filter_params: input.filter_params || null,
    p_custom_label: input.custom_label || null,
  });

  if (error || !data) {
    throw new Error(error?.message || 'Unable to create sharing invitation.');
  }

  const parsed = data as Omit<CreateSharedAccessResult, 'invite_url'>;
  return {
    ...parsed,
    invite_url: buildInvitationLink(parsed.invite_token),
  };
}

export async function sendSharedAccessInviteEmail(
  shareId: string,
  inviteToken: string
): Promise<{ sent: boolean; delivery_method: string }> {
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  return invokeSharedAccessFunction({
    action: 'send_invite',
    share_id: shareId,
    invite_token: inviteToken,
    app_origin: appOrigin,
  });
}

export async function updateSharedAccessPermissions(
  shareId: string,
  permissions: SharedAccessPermissions
): Promise<SharedAccessPermissions> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('update_shared_access_permissions', {
    p_share_id: shareId,
    p_permissions: permissions,
  });
  if (error) throw new Error(error.message);
  return data as SharedAccessPermissions;
}

export async function extendSharedAccessExpiration(
  shareId: string,
  expiresAtIso: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('extend_shared_access', {
    p_share_id: shareId,
    p_expires_at: expiresAtIso,
  });
  if (error) throw new Error(error.message);
}

export async function revokeSharedAccess(shareId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('revoke_shared_access', {
    p_share_id: shareId,
  });
  if (error) throw new Error(error.message);
}

export async function regenerateSharedAccessLink(
  shareId: string
): Promise<{ id: string; invite_token: string; invite_url: string }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('regenerate_shared_access_token', {
    p_share_id: shareId,
  });
  if (error || !data) throw new Error(error?.message || 'Unable to generate invitation link.');
  const parsed = data as { id: string; invite_token: string };
  return {
    ...parsed,
    invite_url: buildInvitationLink(parsed.invite_token),
  };
}

export interface StoredViewerSession {
  shareId: string;
  token: string;
  email: string;
  expiresAt: string;
}

const VIEWER_SESSION_KEY_PREFIX = 'aes_careoffice_viewer_session:';

export function saveViewerSession(session: StoredViewerSession): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(
    `${VIEWER_SESSION_KEY_PREFIX}${session.shareId}`,
    JSON.stringify(session)
  );
}

export function getViewerSession(shareId: string): StoredViewerSession | null {
  if (typeof window === 'undefined' || !shareId) return null;
  const raw = window.sessionStorage.getItem(`${VIEWER_SESSION_KEY_PREFIX}${shareId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredViewerSession>;
    if (
      typeof parsed.shareId !== 'string' ||
      typeof parsed.token !== 'string' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.expiresAt !== 'string'
    ) {
      clearViewerSession(shareId);
      return null;
    }
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      clearViewerSession(shareId);
      return null;
    }
    return parsed as StoredViewerSession;
  } catch {
    clearViewerSession(shareId);
    return null;
  }
}

export function clearViewerSession(shareId?: string): void {
  if (typeof window === 'undefined') return;
  if (shareId) {
    window.sessionStorage.removeItem(`${VIEWER_SESSION_KEY_PREFIX}${shareId}`);
    return;
  }
  const keysToRemove: string[] = [];
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const k = window.sessionStorage.key(i);
    if (k && k.startsWith(VIEWER_SESSION_KEY_PREFIX)) {
      keysToRemove.push(k);
    }
  }
  for (const k of keysToRemove) {
    window.sessionStorage.removeItem(k);
  }
}

export async function requestEmailVerificationCode(
  token: string,
  email: string
): Promise<{ sent: boolean; expires_in_seconds: number; masked_email: string }> {
  return invokeSharedAccessFunction({
    action: 'request_verification_code',
    token: token.trim(),
    email: email.trim(),
  });
}

export async function verifyEmailCode(
  token: string,
  email: string,
  code: string
): Promise<{
  share_id: string;
  resource_type: SharedResourceType;
  viewer_session: string;
  viewer_email: string;
  session_expires_at: string;
}> {
  const res = await invokeSharedAccessFunction<{
    share_id: string;
    resource_type: SharedResourceType;
    viewer_session: string;
    viewer_email: string;
    session_expires_at: string;
  }>({
    action: 'verify_code',
    token: token.trim(),
    email: email.trim(),
    code: code.replace(/\D/g, '').trim(),
  });

  saveViewerSession({
    shareId: res.share_id,
    token: res.viewer_session,
    email: res.viewer_email,
    expiresAt: res.session_expires_at,
  });

  return res;
}

export async function fetchAuthorizedSharedRecord(
  shareId: string
): Promise<AuthorizedSharedResponse> {
  const viewerSession = getViewerSession(shareId);
  return invokeSharedAccessFunction({
    action: 'view',
    share_id: shareId,
    viewer_session: viewerSession?.token,
  });
}

export async function requestAuthorizedPdfPayload(
  shareId: string
): Promise<AuthorizedSharedResponse> {
  const viewerSession = getViewerSession(shareId);
  return invokeSharedAccessFunction({
    action: 'pdf_export',
    share_id: shareId,
    viewer_session: viewerSession?.token,
  });
}

