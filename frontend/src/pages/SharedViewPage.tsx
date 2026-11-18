import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExportIcon } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { formatDateTime, formatLongDate, formatShortDate } from '../lib/formatters';
import { exportAuthorizedSharedRecordToPDF } from '../lib/pdfExport';
import { signOut } from '../services/authService';
import {
  fetchAuthorizedSharedRecord,
  requestAuthorizedPdfPayload,
  SharedAccessError,
} from '../services/sharedAccessService';
import type {
  AuthorizedSharedResponse,
  SharedAssessmentData,
  SharedCaseData,
  SharedLearnerData,
} from '../types/database';

function FieldItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
        {label}
      </span>
      <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', whiteSpace: 'pre-wrap' }}>
        {value || 'N/A'}
      </span>
    </div>
  );
}

export function SharedViewPage() {
  const { id } = useParams<{ id: string }>();
  const { session, loading: authLoading, userEmail } = useAuth();

  const [payload, setPayload] = useState<AuthorizedSharedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const loadRecord = useCallback(async () => {
    if (!id || !session) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setErrorCode(undefined);
    try {
      const res = await fetchAuthorizedSharedRecord(id);
      setPayload(res);
    } catch (err) {
      setPayload(null);
      if (err instanceof SharedAccessError) {
        setErrorMsg(err.message);
        setErrorCode(err.code);
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Access denied.');
      }
    } finally {
      setLoading(false);
    }
  }, [id, session]);

  useEffect(() => {
    if (authLoading) return;
    void loadRecord();
  }, [authLoading, loadRecord]);

  const handleDownloadPdf = async () => {
    if (!id) return;
    setPdfError('');
    setDownloadingPdf(true);
    try {
      // Re-verify authorization and fetch fresh filtered data server-side before exporting
      const freshAuthorized = await requestAuthorizedPdfPayload(id);
      await exportAuthorizedSharedRecordToPDF(freshAuthorized);
    } catch (err) {
      if (err instanceof SharedAccessError) {
        if (err.code === 'revoked' || err.code === 'expired' || err.code === 'forbidden') {
          setPayload(null);
          setErrorCode(err.code);
          setErrorMsg(err.message);
          return;
        }
        setPdfError(err.message);
      } else {
        setPdfError(err instanceof Error ? err.message : 'Unable to generate PDF.');
      }
    } finally {
      setDownloadingPdf(false);
    }
  };

  const renderLearnerContent = (data: SharedLearnerData, perms: AuthorizedSharedResponse['share']['permissions']) => (
    <>
      {perms.view_basic_info && data.basic_info && (
        <section className="viewer-section">
          <h3 className="viewer-section-title">Basic Learner Information</h3>
          <div className="viewer-info-grid">
            <FieldItem label="Full Name" value={data.basic_info.full_name} />
            <FieldItem label="LRN" value={data.basic_info.lrn} />
            <FieldItem
              label="Grade & Section"
              value={`${data.basic_info.grade_level || ''}${data.basic_info.section ? ` - ${data.basic_info.section}` : ''}`}
            />
            <FieldItem label="School Year" value={data.basic_info.school_year} />
            <FieldItem label="Date of Birth" value={formatLongDate(data.basic_info.date_of_birth)} />
            <FieldItem label="Status" value={data.basic_info.status} />
            <FieldItem label="Blood Type" value={data.basic_info.blood_type} />
            <FieldItem label="Home Address" value={data.basic_info.home_address} />
            <FieldItem label="Allergies" value={data.basic_info.allergies || 'None'} />
            <FieldItem label="Medications" value={data.basic_info.medications || 'None'} />
          </div>
        </section>
      )}

      {perms.view_parent_info && data.parents && (
        <section className="viewer-section">
          <h3 className="viewer-section-title">Parent / Guardian Information</h3>
          {data.parents.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No parent/guardian records available.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.parents.map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    background: '#fafafa',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary)', marginBottom: '0.75rem', textTransform: 'uppercase' }}>
                    {p.parent_type || 'Guardian'} Parent
                  </div>
                  <div className="viewer-info-grid">
                    <FieldItem label="Full Name" value={p.full_name} />
                    <FieldItem label="Relationship" value={p.relationship} />
                    <FieldItem label="Mobile Number" value={p.mobile_number} />
                    <FieldItem label="Emergency Contact" value={p.emergency_contact_number} />
                    <FieldItem label="Telephone" value={p.telephone_number} />
                    <FieldItem label="Email Address" value={p.email_address} />
                    <FieldItem label="Home Address" value={p.home_address} />
                    <FieldItem label="Workplace" value={p.workplace} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {perms.view_assessment_records && data.assessments && (
        <section className="viewer-section">
          <h3 className="viewer-section-title">Assessment Records</h3>
          {data.assessments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No assessment records available.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th>Record #</th>
                    <th>Date</th>
                    <th>School Year</th>
                    <th>Provider</th>
                    <th>Diagnosis</th>
                    <th>Findings</th>
                    <th>Recommendations</th>
                  </tr>
                </thead>
                <tbody>
                  {data.assessments.map((a, idx) => (
                    <tr key={idx}>
                      <td>{a.record_number || 'N/A'}</td>
                      <td>{formatShortDate(a.date)}</td>
                      <td>{a.school_year || 'N/A'}</td>
                      <td>{a.assessment_provider || 'N/A'}</td>
                      <td>{a.diagnosis || 'N/A'}</td>
                      <td>{a.findings || 'N/A'}</td>
                      <td>{a.recommendations || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {perms.view_case_records && data.cases && (
        <section className="viewer-section">
          <h3 className="viewer-section-title">Counseling / Case Records</h3>
          {data.cases.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No case records available.</p>
          ) : (
            <div className="table-responsive">
              <table className="data-table" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th>Case #</th>
                    <th>Date</th>
                    <th>School Year</th>
                    <th>Case Type</th>
                    <th>Outcome</th>
                    <th>Description</th>
                    <th>Actions Taken</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cases.map((c, idx) => (
                    <tr key={idx}>
                      <td>{c.case_number || 'N/A'}</td>
                      <td>{formatShortDate(c.date)}</td>
                      <td>{c.school_year || 'N/A'}</td>
                      <td>{c.case_type || 'N/A'}</td>
                      <td>{c.outcome_disposition || 'N/A'}</td>
                      <td>{c.brief_description || 'N/A'}</td>
                      <td>{c.actions_taken || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );

  const renderAssessmentContent = (
    data: SharedAssessmentData,
    perms: AuthorizedSharedResponse['share']['permissions']
  ) => (
    <>
      {perms.view_basic_info && data.basic_info && (
        <section className="viewer-section">
          <h3 className="viewer-section-title">Assessment Summary</h3>
          <div className="viewer-info-grid">
            <FieldItem label="Record Number" value={data.basic_info.record_number} />
            <FieldItem label="Learner Name" value={data.basic_info.student_name} />
            <FieldItem label="Date" value={formatLongDate(data.basic_info.date)} />
            <FieldItem label="School Year" value={data.basic_info.school_year} />
            <FieldItem label="Grade & Section" value={data.basic_info.grade_section} />
            <FieldItem label="Status" value={data.basic_info.status} />
          </div>
        </section>
      )}
      {perms.view_parent_info && data.parent_contact && (
        <section className="viewer-section">
          <h3 className="viewer-section-title">Parent Contact</h3>
          <FieldItem label="Parent Contact Number" value={data.parent_contact.contact_number} />
        </section>
      )}
      {perms.view_assessment_records && data.assessment_details && (
        <section className="viewer-section">
          <h3 className="viewer-section-title">Assessment Findings &amp; Recommendations</h3>
          <div className="viewer-info-grid">
            <FieldItem label="Assessment Provider" value={data.assessment_details.assessment_provider} />
            <FieldItem label="Diagnosis" value={data.assessment_details.diagnosis} />
            <FieldItem label="Findings" value={data.assessment_details.findings} />
            <FieldItem label="Recommendations" value={data.assessment_details.recommendations} />
          </div>
        </section>
      )}
    </>
  );

  const renderCaseContent = (
    data: SharedCaseData,
    perms: AuthorizedSharedResponse['share']['permissions']
  ) => (
    <>
      {perms.view_basic_info && data.basic_info && (
        <section className="viewer-section">
          <h3 className="viewer-section-title">Case Register Summary</h3>
          <div className="viewer-info-grid">
            <FieldItem label="Case Number" value={data.basic_info.case_number} />
            <FieldItem label="Student(s) Involved" value={data.basic_info.student_names} />
            <FieldItem label="Date" value={formatLongDate(data.basic_info.date)} />
            <FieldItem label="School Year" value={data.basic_info.school_year} />
            <FieldItem label="Outcome / Disposition" value={data.basic_info.outcome_disposition} />
          </div>
        </section>
      )}
      {perms.view_case_records && data.case_details && (
        <section className="viewer-section">
          <h3 className="viewer-section-title">Counseling / Case Details</h3>
          <div className="viewer-info-grid">
            <FieldItem label="Case Type" value={data.case_details.case_type} />
            <FieldItem label="Brief Description" value={data.case_details.brief_description} />
            <FieldItem label="Actions Taken" value={data.case_details.actions_taken} />
          </div>
        </section>
      )}
    </>
  );

  return (
    <div className="viewer-shell">
      <header className="viewer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img
            src="/aes-cares-logo-transparent.png"
            alt="Ambulong ES Care Center"
            style={{ width: '40px', height: '40px', objectFit: 'contain' }}
          />
          <div>
            <div style={{ fontWeight: 800, color: 'var(--text-dark)', fontSize: '1.05rem' }}>
              AES Care Office
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              View-Only Shared Record
            </div>
          </div>
        </div>
        {session && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span className="status-pill" style={{ background: 'var(--info-bg)', color: 'var(--info-text)' }}>
              Read-Only Viewer
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{userEmail}</span>
            <button type="button" className="control-btn" onClick={() => void signOut()}>
              Sign Out
            </button>
          </div>
        )}
      </header>

      <main className="viewer-main">
        {authLoading || loading ? (
          <div className="viewer-card" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loading authorized record...</div>
          </div>
        ) : !session ? (
          <div className="viewer-card" style={{ textAlign: 'center', maxWidth: '520px', margin: '0 auto' }}>
            <h2 style={{ color: 'var(--text-dark)', marginBottom: '0.75rem' }}>Authentication Required</h2>
            <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
              Shared records require email verification. Please open the original invitation link sent to your email address to sign in and view this record.
            </p>
          </div>
        ) : errorMsg || !payload ? (
          <div className="viewer-card" style={{ textAlign: 'center', maxWidth: '540px', margin: '0 auto' }}>
            <h2 style={{ color: 'var(--danger-text)', marginBottom: '0.75rem' }}>
              {errorCode === 'expired'
                ? 'Shared Access Expired'
                : errorCode === 'revoked'
                  ? 'Shared Access Revoked'
                  : 'Access Denied'}
            </h2>
            <div className="msg-error" style={{ marginBottom: '1.25rem' }}>
              {errorMsg || 'You do not have permission to view this shared record.'}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              If you believe this is an error, please contact the AES Guidance Office to request a new invitation.
            </p>
          </div>
        ) : (
          <div className="viewer-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: '1rem',
                flexWrap: 'wrap',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '1.25rem',
                marginBottom: '1.5rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Authorized {payload.share.resource_type} Record · View-Only
                </div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-dark)', marginTop: '0.25rem' }}>
                  {payload.share.resource_label || 'Shared Guidance Record'}
                </h1>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Shared with <strong>{payload.share.recipient_email}</strong> · Access expires{' '}
                  <strong>{formatDateTime(payload.share.expires_at)}</strong>
                </div>
              </div>

              {payload.share.permissions.view_download_pdf && (
                <button
                  type="button"
                  className="control-btn btn-primary"
                  disabled={downloadingPdf}
                  onClick={() => void handleDownloadPdf()}
                >
                  <ExportIcon /> {downloadingPdf ? 'Preparing PDF...' : 'Download Authorized PDF'}
                </button>
              )}
            </div>

            {pdfError && (
              <div className="msg-error" style={{ marginBottom: '1.25rem' }}>
                {pdfError}
              </div>
            )}

            {payload.share.resource_type === 'learner' &&
              renderLearnerContent(payload.data as SharedLearnerData, payload.share.permissions)}

            {payload.share.resource_type === 'assessment' &&
              renderAssessmentContent(payload.data as SharedAssessmentData, payload.share.permissions)}

            {payload.share.resource_type === 'case' &&
              renderCaseContent(payload.data as SharedCaseData, payload.share.permissions)}

            <div
              style={{
                marginTop: '2rem',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-color)',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
              }}
            >
              Confidential — Shared for authorized viewing only by Ambulong Elementary School Care Office.
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

