export type SharedResourceType = 'learner' | 'assessment' | 'case' | 'report';
export type SharedAccessStatus = 'pending' | 'active' | 'expired' | 'revoked';

export interface SharedPermissions {
  view_basic_info: boolean;
  view_parent_info: boolean;
  view_assessment_records: boolean;
  view_case_records: boolean;
  view_download_pdf: boolean;
}

export interface SharedAccessRow {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  recipient_user_id: string | null;
  resource_type: SharedResourceType;
  resource_id: number;
  resource_label: string | null;
  status: SharedAccessStatus;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  permissions: SharedPermissions;
}

export interface AuthActor {
  id: string | null;
  email: string | null;
  emailConfirmedAt: string | null;
  authMethod?: 'supabase_auth' | 'email_otp';
  sessionShareId?: string | null;
}

export interface VerificationCodeRow {
  code_hash: string;
  expires_at: string;
  attempts: number;
  used_at: string | null;
}

export type OtpVerifyResult =
  | { ok: true }
  | {
      ok: false;
      httpStatus: number;
      code: 'no_active_code' | 'code_expired' | 'too_many_attempts' | 'invalid_code';
      message: string;
      shouldIncrementAttempts?: boolean;
      remainingAttempts?: number;
    };

export const MAX_OTP_ATTEMPTS = 5;

export function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export function evaluateOtpCodeVerification(
  row: VerificationCodeRow | null,
  submittedCodeHash: string,
  options: { now?: Date } = {}
): OtpVerifyResult {
  if (!row || row.used_at !== null) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'no_active_code',
      message: 'No active verification code was found. Please request a new 6-digit code.',
    };
  }

  const nowMs = (options.now ?? new Date()).getTime();
  const expiresMs = new Date(row.expires_at).getTime();
  if (Number.isNaN(expiresMs) || expiresMs <= nowMs) {
    return {
      ok: false,
      httpStatus: 410,
      code: 'code_expired',
      message: 'This verification code has expired. Please request a new 6-digit code.',
    };
  }

  if (row.attempts >= MAX_OTP_ATTEMPTS) {
    return {
      ok: false,
      httpStatus: 429,
      code: 'too_many_attempts',
      message: 'Too many incorrect attempts. Please request a new 6-digit verification code.',
    };
  }

  if (!timingSafeEqualStrings(row.code_hash, submittedCodeHash)) {
    const remaining = Math.max(0, MAX_OTP_ATTEMPTS - (row.attempts + 1));
    return {
      ok: false,
      httpStatus: 403,
      code: 'invalid_code',
      message:
        remaining > 0
          ? `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Incorrect verification code. Please request a new 6-digit code.',
      shouldIncrementAttempts: true,
      remainingAttempts: remaining,
    };
  }

  return { ok: true };
}

export type AccessCheckMode = 'accept' | 'view' | 'pdf';

export type AccessCheckResult =
  | { ok: true }
  | {
      ok: false;
      httpStatus: number;
      code:
        | 'not_found'
        | 'unauthenticated'
        | 'unverified_email'
        | 'revoked'
        | 'expired'
        | 'email_mismatch'
        | 'forbidden'
        | 'not_accepted'
        | 'pdf_not_permitted';
      message: string;
      shouldMarkExpired?: boolean;
    };

export function normalizeEmail(email?: string | null): string {
  return (email ?? '').trim().toLowerCase();
}

export function sanitizePermissionsForResource(
  resourceType: SharedResourceType,
  raw: Partial<SharedPermissions> | null | undefined
): SharedPermissions {
  const base: SharedPermissions = {
    view_basic_info: Boolean(raw?.view_basic_info),
    view_parent_info: Boolean(raw?.view_parent_info),
    view_assessment_records: Boolean(raw?.view_assessment_records),
    view_case_records: Boolean(raw?.view_case_records),
    view_download_pdf: Boolean(raw?.view_download_pdf),
  };

  if (resourceType === 'assessment') {
    base.view_case_records = false;
  } else if (resourceType === 'case') {
    base.view_parent_info = false;
    base.view_assessment_records = false;
  }

  return base;
}

export function evaluateShareAccess(
  share: SharedAccessRow | null,
  actor: AuthActor | null,
  options: { mode: AccessCheckMode; now?: Date }
): AccessCheckResult {
  const isOtpSession = actor?.authMethod === 'email_otp';

  if (!actor || !actor.email || (!isOtpSession && !actor.id)) {
    return {
      ok: false,
      httpStatus: 401,
      code: 'unauthenticated',
      message: 'Verification required. Please open your invitation link and verify your email address.',
    };
  }

  if (!actor.emailConfirmedAt) {
    return {
      ok: false,
      httpStatus: 403,
      code: 'unverified_email',
      message: 'Please verify your email address before viewing shared records.',
    };
  }

  if (!share) {
    return {
      ok: false,
      httpStatus: 404,
      code: 'not_found',
      message: 'This shared record invitation was not found or is no longer valid.',
    };
  }

  if (share.status === 'revoked' || share.revoked_at !== null) {
    return {
      ok: false,
      httpStatus: 403,
      code: 'revoked',
      message: 'Access to this shared record has been revoked by the administrator.',
    };
  }

  const nowMs = (options.now ?? new Date()).getTime();
  const expiresMs = new Date(share.expires_at).getTime();
  if (share.status === 'expired' || Number.isNaN(expiresMs) || expiresMs <= nowMs) {
    return {
      ok: false,
      httpStatus: 410,
      code: 'expired',
      message: 'This shared access invitation has expired. Please contact the Guidance Office.',
      shouldMarkExpired: share.status !== 'expired',
    };
  }

  if (normalizeEmail(share.recipient_email) !== normalizeEmail(actor.email)) {
    return {
      ok: false,
      httpStatus: 403,
      code: 'email_mismatch',
      message: 'This invitation belongs to a different email address.',
    };
  }

  if (isOtpSession) {
    if (options.mode === 'view' || options.mode === 'pdf') {
      if (!actor.sessionShareId || actor.sessionShareId !== share.id) {
        return {
          ok: false,
          httpStatus: 403,
          code: 'forbidden',
          message: 'Your temporary verification session is not authorized for this record.',
        };
      }
      if (share.status !== 'active' || !share.accepted_at) {
        return {
          ok: false,
          httpStatus: 403,
          code: 'not_accepted',
          message: 'Please verify your invitation link before viewing this record.',
        };
      }
    }
  } else {
    if (share.recipient_user_id && share.recipient_user_id !== actor.id) {
      return {
        ok: false,
        httpStatus: 403,
        code: 'forbidden',
        message: 'This invitation is bound to another authenticated account.',
      };
    }

    if (options.mode === 'view' || options.mode === 'pdf') {
      if (share.status !== 'active' || !share.recipient_user_id) {
        return {
          ok: false,
          httpStatus: 403,
          code: 'not_accepted',
          message: 'Please accept your invitation link before viewing this record.',
        };
      }
    }
  }

  if (options.mode === 'pdf') {
    const perms = sanitizePermissionsForResource(share.resource_type, share.permissions);
    if (!perms.view_download_pdf) {
      return {
        ok: false,
        httpStatus: 403,
        code: 'pdf_not_permitted',
        message: 'PDF download is not permitted for this shared record.',
      };
    }
  }

  return { ok: true };
}

export interface RawLearnerBundle {
  student: Record<string, unknown>;
  parents: Record<string, unknown>[];
  assessments: Record<string, unknown>[];
  cases: Record<string, unknown>[];
}

export function filterSharedLearnerPayload(
  raw: RawLearnerBundle,
  rawPerms: SharedPermissions
) {
  const perms = sanitizePermissionsForResource('learner', rawPerms);
  const result: Record<string, unknown> = {};

  if (perms.view_basic_info) {
    result.basic_info = {
      full_name: raw.student.full_name ?? null,
      lrn: raw.student.lrn ?? null,
      grade_level: raw.student.grade_level ?? raw.student.grade_section ?? null,
      section: raw.student.section ?? null,
      school_year: raw.student.school_year ?? null,
      date_of_birth: raw.student.date_of_birth ?? null,
      status: raw.student.status ?? null,
      home_address: raw.student.home_address ?? null,
      blood_type: raw.student.blood_type ?? null,
      allergies: raw.student.allergies ?? null,
      medications: raw.student.medications ?? null,
    };
  }

  if (perms.view_parent_info) {
    result.parents = raw.parents.map((p) => ({
      parent_type: p.parent_type ?? null,
      full_name: p.full_name ?? null,
      relationship: p.relationship ?? null,
      mobile_number: p.mobile_number ?? null,
      telephone_number: p.telephone_number ?? null,
      email_address: p.email_address ?? null,
      home_address: p.home_address ?? null,
      workplace: p.workplace ?? null,
      workplace_address: p.workplace_address ?? null,
      emergency_contact_number: p.emergency_contact_number ?? null,
    }));
  }

  if (perms.view_assessment_records) {
    result.assessments = raw.assessments.map((a) => ({
      record_number: a.record_number ?? null,
      school_year: a.school_year ?? null,
      date: a.date ?? null,
      grade_section: a.grade_section ?? null,
      status: a.status ?? null,
      assessment_provider: a.assessment_provider ?? null,
      findings: a.findings ?? null,
      diagnosis: a.diagnosis ?? null,
      recommendations: a.recommendations ?? null,
    }));
  }

  if (perms.view_case_records) {
    result.cases = raw.cases.map((c) => ({
      case_number: c.case_number ?? null,
      school_year: c.school_year ?? null,
      date: c.date ?? null,
      grade_section: c.grade_section ?? null,
      case_type: c.case_type ?? null,
      brief_description: c.brief_description ?? null,
      actions_taken: c.actions_taken ?? null,
      outcome_disposition: c.outcome_disposition ?? null,
    }));
  }

  return result;
}

export function filterSharedAssessmentPayload(
  raw: Record<string, unknown> & { student_name?: string | null },
  rawPerms: SharedPermissions
) {
  const perms = sanitizePermissionsForResource('assessment', rawPerms);
  const result: Record<string, unknown> = {};

  if (perms.view_basic_info) {
    result.basic_info = {
      record_number: raw.record_number ?? null,
      student_name: raw.student_name ?? null,
      school_year: raw.school_year ?? null,
      date: raw.date ?? null,
      grade_section: raw.grade_section ?? null,
      status: raw.status ?? null,
    };
  }

  if (perms.view_parent_info) {
    result.parent_contact = {
      contact_number: raw.contact_number ?? null,
    };
  }

  if (perms.view_assessment_records) {
    result.assessment_details = {
      assessment_provider: raw.assessment_provider ?? null,
      findings: raw.findings ?? null,
      diagnosis: raw.diagnosis ?? null,
      recommendations: raw.recommendations ?? null,
    };
  }

  return result;
}

export function filterSharedCasePayload(
  raw: Record<string, unknown>,
  rawPerms: SharedPermissions
) {
  const perms = sanitizePermissionsForResource('case', rawPerms);
  const result: Record<string, unknown> = {};

  if (perms.view_basic_info) {
    result.basic_info = {
      case_number: raw.case_number ?? null,
      student_names: raw.student_names ?? null,
      school_year: raw.school_year ?? null,
      date: raw.date ?? null,
      grade_section: raw.grade_section ?? null,
      outcome_disposition: raw.outcome_disposition ?? null,
    };
  }

  if (perms.view_case_records) {
    result.case_details = {
      case_type: raw.case_type ?? null,
      brief_description: raw.brief_description ?? null,
      actions_taken: raw.actions_taken ?? null,
    };
  }

  return result;
}

