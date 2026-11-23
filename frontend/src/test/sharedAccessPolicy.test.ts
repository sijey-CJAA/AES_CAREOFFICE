import { describe, expect, it } from 'vitest';
import {
  evaluateOtpCodeVerification,
  evaluateShareAccess,
  filterSharedAssessmentPayload,
  filterSharedCasePayload,
  filterSharedLearnerPayload,
  filterSharedReportPayload,
  sanitizePermissionsForResource,
  type AuthActor,
  type SharedAccessRow,
} from '../../../supabase/functions/shared-access/policy';

const futureIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastIso = new Date(Date.now() - 60 * 1000).toISOString();

function makeShare(overrides: Partial<SharedAccessRow> = {}): SharedAccessRow {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    recipient_email: 'parent.viewer@example.com',
    recipient_name: 'Parent Viewer',
    recipient_user_id: 'viewer-uid-1',
    resource_type: 'learner',
    resource_id: 10,
    resource_label: 'Juan Dela Cruz',
    status: 'active',
    expires_at: futureIso,
    accepted_at: new Date().toISOString(),
    revoked_at: null,
    permissions: {
      view_basic_info: true,
      view_parent_info: false,
      view_assessment_records: false,
      view_case_records: false,
      view_download_pdf: false,
    },
    ...overrides,
  };
}

const verifiedViewer: AuthActor = {
  id: 'viewer-uid-1',
  email: 'parent.viewer@example.com',
  emailConfirmedAt: '2026-11-18T00:00:00Z',
};

describe('Edge Function shared-access policy & security checks', () => {
  it('allows an authorized viewer with verified email on an active unexpired share', () => {
    const res = evaluateShareAccess(makeShare(), verifiedViewer, { mode: 'view' });
    expect(res).toEqual({ ok: true });
  });

  it('rejects unauthenticated requests', () => {
    const res = evaluateShareAccess(makeShare(), null, { mode: 'view' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.httpStatus).toBe(401);
      expect(res.code).toBe('unauthenticated');
    }
  });

  it('rejects authenticated users whose email is not verified', () => {
    const unverified: AuthActor = { ...verifiedViewer, emailConfirmedAt: null };
    const res = evaluateShareAccess(makeShare(), unverified, { mode: 'accept' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.httpStatus).toBe(403);
      expect(res.code).toBe('unverified_email');
    }
  });

  it('prevents a different email from accepting or viewing another recipient invitation', () => {
    const otherUser: AuthActor = {
      id: 'attacker-uid',
      email: 'attacker@example.com',
      emailConfirmedAt: '2026-11-18T00:00:00Z',
    };
    const pendingShare = makeShare({ status: 'pending', recipient_user_id: null });
    const acceptRes = evaluateShareAccess(pendingShare, otherUser, { mode: 'accept' });
    expect(acceptRes.ok).toBe(false);
    if (!acceptRes.ok) {
      expect(acceptRes.code).toBe('email_mismatch');
    }

    const viewRes = evaluateShareAccess(makeShare(), otherUser, { mode: 'view' });
    expect(viewRes.ok).toBe(false);
    if (!viewRes.ok) {
      expect(viewRes.code).toBe('email_mismatch');
    }
  });

  it('blocks IDOR when user ID does not match bound recipient_user_id', () => {
    const differentUidSameEmail: AuthActor = {
      id: 'different-uid-999',
      email: 'parent.viewer@example.com',
      emailConfirmedAt: '2026-11-18T00:00:00Z',
    };
    const res = evaluateShareAccess(makeShare(), differentUidSameEmail, { mode: 'view' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.httpStatus).toBe(403);
      expect(res.code).toBe('forbidden');
    }
  });

  it('blocks viewing expired invitations and flags shouldMarkExpired', () => {
    const res = evaluateShareAccess(makeShare({ expires_at: pastIso }), verifiedViewer, {
      mode: 'view',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.httpStatus).toBe(410);
      expect(res.code).toBe('expired');
      expect(res.shouldMarkExpired).toBe(true);
    }
  });

  it('blocks viewing and PDF export on revoked invitations immediately', () => {
    const revoked = makeShare({
      status: 'revoked',
      revoked_at: new Date().toISOString(),
      permissions: {
        view_basic_info: true,
        view_parent_info: true,
        view_assessment_records: true,
        view_case_records: true,
        view_download_pdf: true,
      },
    });
    const viewRes = evaluateShareAccess(revoked, verifiedViewer, { mode: 'view' });
    const pdfRes = evaluateShareAccess(revoked, verifiedViewer, { mode: 'pdf' });
    expect(viewRes.ok).toBe(false);
    expect(pdfRes.ok).toBe(false);
    if (!pdfRes.ok) expect(pdfRes.code).toBe('revoked');
  });

  it('blocks PDF download when view_download_pdf is false and allows when true', () => {
    const denied = evaluateShareAccess(makeShare(), verifiedViewer, { mode: 'pdf' });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.code).toBe('pdf_not_permitted');

    const allowed = evaluateShareAccess(
      makeShare({
        permissions: {
          view_basic_info: true,
          view_parent_info: false,
          view_assessment_records: false,
          view_case_records: false,
          view_download_pdf: true,
        },
      }),
      verifiedViewer,
      { mode: 'pdf' }
    );
    expect(allowed).toEqual({ ok: true });
  });

  it('blocks viewing a pending share before acceptance', () => {
    const pending = makeShare({ status: 'pending', recipient_user_id: null, accepted_at: null });
    const res = evaluateShareAccess(pending, verifiedViewer, { mode: 'view' });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe('not_accepted');
  });

  it('returns 404 when share does not exist (IDOR random UUID guess)', () => {
    const res = evaluateShareAccess(null, verifiedViewer, { mode: 'view' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.httpStatus).toBe(404);
      expect(res.code).toBe('not_found');
    }
  });
});

describe('Edge Function server-side field filtering', () => {
  it('excludes unauthorized parents, assessments, cases, and internal IDs from learner payload', () => {
    const payload = filterSharedLearnerPayload(
      {
        student: {
          id: 99,
          full_name: 'Juan Dela Cruz',
          lrn: '100020003001',
          grade_level: 'Grade 4',
          section: 'Rose Quartz',
          status: 'Currently Enrolled',
          deleted_at: null,
        },
        parents: [{ id: 5, student_id: 99, full_name: 'Secret Parent', mobile_number: '09171234567' }],
        assessments: [{ id: 8, student_id: 99, record_number: 'AES-AR-001', diagnosis: 'ADHD' }],
        cases: [{ id: 12, case_number: 'AES-CR-001', brief_description: 'Confidential incident' }],
      },
      {
        view_basic_info: true,
        view_parent_info: false,
        view_assessment_records: false,
        view_case_records: false,
        view_download_pdf: false,
      }
    );

    expect(payload.basic_info).toBeDefined();
    expect((payload.basic_info as Record<string, unknown>).id).toBeUndefined();
    expect(payload.parents).toBeUndefined();
    expect(payload.assessments).toBeUndefined();
    expect(payload.cases).toBeUndefined();
  });

  it('enforces resource-type permission boundaries on assessments and cases', () => {
    const assessPerms = sanitizePermissionsForResource('assessment', {
      view_basic_info: true,
      view_parent_info: false,
      view_assessment_records: false,
      view_case_records: true, // invalid for assessment -> must be forced false
      view_download_pdf: false,
    });
    expect(assessPerms.view_case_records).toBe(false);

    const assessPayload = filterSharedAssessmentPayload(
      {
        id: 1,
        record_number: 'AES-AR-001',
        student_name: 'Juan Dela Cruz',
        contact_number: '09171234567',
        diagnosis: 'ADHD',
        findings: 'Sensitive findings',
      },
      assessPerms
    );
    expect(assessPayload.basic_info).toBeDefined();
    expect(assessPayload.parent_contact).toBeUndefined();
    expect(assessPayload.assessment_details).toBeUndefined();

    const casePerms = sanitizePermissionsForResource('case', {
      view_basic_info: true,
      view_parent_info: true,
      view_assessment_records: true,
      view_case_records: false,
      view_download_pdf: false,
    });
    expect(casePerms.view_parent_info).toBe(false);
    expect(casePerms.view_assessment_records).toBe(false);

    const casePayload = filterSharedCasePayload(
      {
        case_number: 'AES-CR-001',
        student_names: 'Juan Dela Cruz',
        outcome_disposition: 'Ongoing',
        case_type: 'Bullying',
        brief_description: 'Sensitive incident narrative',
      },
      casePerms
    );
    expect(casePayload.basic_info).toBeDefined();
    expect(casePayload.case_details).toBeUndefined();
  });
});

describe('Passwordless Gmail OTP & temporary viewer session security', () => {
  const otpViewer: AuthActor = {
    id: null,
    email: 'parent.viewer@example.com',
    emailConfirmedAt: '2026-11-18T00:00:00Z',
    authMethod: 'email_otp',
    sessionShareId: '11111111-1111-1111-1111-111111111111',
  };

  it('allows viewing active share via temporary email_otp session with no Supabase auth user', () => {
    const share = makeShare({ recipient_user_id: null, status: 'active' });
    expect(evaluateShareAccess(share, otpViewer, { mode: 'view' })).toEqual({ ok: true });
  });

  it('blocks IDOR when temporary viewer session for one share attempts to open another share', () => {
    const otherShare = makeShare({
      id: '99999999-9999-9999-9999-999999999999',
      recipient_user_id: null,
      status: 'active',
    });
    const res = evaluateShareAccess(otherShare, otpViewer, { mode: 'view' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.httpStatus).toBe(403);
      expect(res.code).toBe('forbidden');
    }
  });

  it('validates 6-digit OTP hashes and enforces expiration, reuse, and 5-attempt lockout', () => {
    const validRow = {
      code_hash: 'a'.repeat(64),
      expires_at: futureIso,
      attempts: 0,
      used_at: null,
    };

    expect(evaluateOtpCodeVerification(validRow, 'a'.repeat(64))).toEqual({ ok: true });

    const wrongRes = evaluateOtpCodeVerification(validRow, 'b'.repeat(64));
    expect(wrongRes.ok).toBe(false);
    if (!wrongRes.ok) {
      expect(wrongRes.code).toBe('invalid_code');
      expect(wrongRes.shouldIncrementAttempts).toBe(true);
      expect(wrongRes.remainingAttempts).toBe(4);
    }

    const lockedRes = evaluateOtpCodeVerification({ ...validRow, attempts: 5 }, 'a'.repeat(64));
    expect(lockedRes.ok).toBe(false);
    if (!lockedRes.ok) expect(lockedRes.code).toBe('too_many_attempts');

    const expiredRes = evaluateOtpCodeVerification({ ...validRow, expires_at: pastIso }, 'a'.repeat(64));
    expect(expiredRes.ok).toBe(false);
    if (!expiredRes.ok) expect(expiredRes.code).toBe('code_expired');

    const usedRes = evaluateOtpCodeVerification(
      { ...validRow, used_at: new Date().toISOString() },
      'a'.repeat(64)
    );
    expect(usedRes.ok).toBe(false);
    if (!usedRes.ok) expect(usedRes.code).toBe('no_active_code');
  });

  it('sanitizes permissions for report resource by stripping parent and assessment records', () => {
    const raw = {
      view_basic_info: true,
      view_parent_info: true,
      view_assessment_records: true,
      view_case_records: true,
      view_download_pdf: true,
    };
    const perms = sanitizePermissionsForResource('report', raw);
    expect(perms).toEqual({
      view_basic_info: true,
      view_parent_info: false,
      view_assessment_records: false,
      view_case_records: true,
      view_download_pdf: true,
    });
  });

  it('filters report payload strictly hiding case details when view_case_records is false', () => {
    const rawCases = [
      {
        id: 1,
        case_number: 'AES-CR-001',
        student_names: 'Maria Santos',
        school_year: '2025-2026',
        date: '2026-10-15',
        grade_section: 'Grade 3 - Jade',
        outcome_disposition: 'Closed/Resolved',
        case_type: 'Bullying',
        brief_description: 'Incident in hallway',
        actions_taken: 'Parent counseling session',
      },
    ];

    const basicOnly = filterSharedReportPayload(
      rawCases,
      {
        view_basic_info: true,
        view_parent_info: false,
        view_assessment_records: false,
        view_case_records: false,
        view_download_pdf: false,
      },
      {
        date_from: '2026-10-01',
        date_to: '2026-10-31',
      }
    );

    expect(basicOnly.summary).toEqual({
      total_cases: 1,
      date_from: '2026-10-01',
      date_to: '2026-10-31',
    });
    const cases = basicOnly.cases as Array<Record<string, unknown>>;
    expect(cases).toHaveLength(1);
    expect(cases[0].case_number).toBe('AES-CR-001');
    expect(cases[0].student_names).toBe('Maria Santos');
    expect(cases[0].case_type).toBeUndefined();
    expect(cases[0].brief_description).toBeUndefined();
    expect(cases[0].actions_taken).toBeUndefined();

    const withDetails = filterSharedReportPayload(
      rawCases,
      {
        view_basic_info: true,
        view_parent_info: false,
        view_assessment_records: false,
        view_case_records: true,
        view_download_pdf: true,
      },
      {
        date_from: '2026-10-01',
        date_to: '2026-10-31',
      }
    );
    const detailCases = withDetails.cases as Array<Record<string, unknown>>;
    expect(detailCases[0].case_type).toBe('Bullying');
    expect(detailCases[0].brief_description).toBe('Incident in hallway');
    expect(detailCases[0].actions_taken).toBe('Parent counseling session');
  });
});

