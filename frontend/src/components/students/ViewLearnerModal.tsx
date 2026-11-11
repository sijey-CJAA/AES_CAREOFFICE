import { formatLongDate } from '../../lib/formatters';
import type { LearnerFullDetails, ParentRecord } from '../../types/database';
import { CloseIcon } from '../Icons';

interface ViewLearnerModalProps {
  learner: LearnerFullDetails | null;
  onClose: () => void;
  onEdit?: (learner: LearnerFullDetails) => void;
}

function ParentViewBlock({ title, parent }: { title: string; parent?: ParentRecord }) {
  return (
    <>
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--text-light)',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
          letterSpacing: '0.5px',
        }}
      >
        {title}
      </div>
      <div
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1.5rem',
          marginBottom: '2rem',
          background: '#fafafa',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.5rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
              Name
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-dark)' }}>
              {parent?.full_name || 'N/A'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
              Relationship
            </span>
            <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)' }}>
              {parent?.relationship || 'N/A'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
              Mobile Number
            </span>
            <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)' }}>
              {parent?.mobile_number || 'N/A'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
              Emergency Contact
            </span>
            <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)' }}>
              {parent?.emergency_contact_number || 'N/A'}
            </span>
          </div>
        </div>
        <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
              Home Address
            </span>
            <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)' }}>
              {parent?.home_address || 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

export function ViewLearnerModal({ learner, onClose, onEdit }: ViewLearnerModalProps) {
  if (!learner) return null;

  const primary = learner.parents.find((p) => p.parent_type === 'Primary');
  const secondary = learner.parents.find((p) => p.parent_type === 'Secondary');
  const hasPastRecords = learner.assessments.length > 0 || learner.cases.length > 0;

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Learner Full Information"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: '700px', padding: '2rem' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '2rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '4px', height: '24px', background: 'var(--primary)', borderRadius: '4px' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-dark)' }}>
              Learner Full Information
            </h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
            <CloseIcon />
          </button>
        </div>

        <div className="modal-body" style={{ padding: 0 }}>
          <div
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-light)',
              textTransform: 'uppercase',
              marginBottom: '0.75rem',
              letterSpacing: '0.5px',
            }}
          >
            Student Profile
          </div>
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '2rem',
              background: '#fafafa',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1.5rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  Full Name
                </span>
                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-dark)' }}>
                  {learner.full_name || 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  LRN
                </span>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)' }}>
                  {learner.lrn || 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  School Year
                </span>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)' }}>
                  {learner.school_year || 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  Grade &amp; Section
                </span>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)' }}>
                  {`${learner.grade_level || learner.grade_section || ''} - ${learner.section || ''}`}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  Date of Birth
                </span>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)' }}>
                  {formatLongDate(learner.date_of_birth)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  Blood Type
                </span>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)' }}>
                  {learner.blood_type || 'N/A'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  Status
                </span>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)' }}>
                  {learner.status || 'Unknown / Not Indicated'}
                </span>
              </div>
            </div>

            <div
              style={{
                borderTop: '1px dashed var(--border-color)',
                paddingTop: '1.5rem',
                marginBottom: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  Home Address
                </span>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)' }}>
                  {learner.home_address || 'N/A'}
                </span>
              </div>
            </div>

            <div
              style={{
                borderTop: '1px dashed var(--border-color)',
                paddingTop: '1.5rem',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '1.5rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  Allergies
                </span>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)' }}>
                  {learner.allergies || 'None'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  Medications
                </span>
                <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)' }}>
                  {learner.medications || 'None'}
                </span>
              </div>
            </div>
          </div>

          <ParentViewBlock title="Primary Parent" parent={primary} />
          <ParentViewBlock title="Secondary Parent" parent={secondary} />

          {hasPastRecords && (
            <div style={{ marginTop: '2rem', borderTop: '2px solid var(--border-color)', paddingTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--primary)', marginBottom: '1rem' }}>
                Past Guidance Records
              </h3>

              <h4 style={{ fontSize: '0.95rem', color: 'var(--text-dark)', marginBottom: '0.75rem' }}>
                Assessment Records
              </h4>
              <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                <table className="data-table" style={{ minWidth: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Record #</th>
                      <th>Date</th>
                      <th>School Year</th>
                      <th>Status</th>
                      <th>Provider</th>
                    </tr>
                  </thead>
                  <tbody>
                    {learner.assessments.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                          No assessment records found.
                        </td>
                      </tr>
                    ) : (
                      learner.assessments.map((a) => (
                        <tr key={a.id}>
                          <td style={{ color: 'var(--text-muted)' }}>{a.record_number || 'N/A'}</td>
                          <td>{a.date || 'N/A'}</td>
                          <td>{a.school_year || 'N/A'}</td>
                          <td>
                            <span style={{ fontWeight: 600, fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#f1f5f9', borderRadius: '4px' }}>
                              {a.status || 'N/A'}
                            </span>
                          </td>
                          <td>{a.assessment_provider || 'N/A'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <h4 style={{ fontSize: '0.95rem', color: 'var(--text-dark)', marginBottom: '0.75rem' }}>
                Case Register
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ minWidth: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Case #</th>
                      <th>Date</th>
                      <th>School Year</th>
                      <th>Type</th>
                      <th>Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {learner.cases.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
                          No case register entries found.
                        </td>
                      </tr>
                    ) : (
                      learner.cases.map((c) => (
                        <tr key={c.id}>
                          <td style={{ color: 'var(--text-muted)' }}>{c.case_number || 'N/A'}</td>
                          <td>{c.date || 'N/A'}</td>
                          <td>{c.school_year || 'N/A'}</td>
                          <td>{c.case_type || 'N/A'}</td>
                          <td>
                            <span style={{ fontWeight: 600, fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#f1f5f9', borderRadius: '4px' }}>
                              {c.outcome_disposition || 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '1rem',
              paddingTop: '1.5rem',
              marginTop: '1.5rem',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <button type="button" className="control-btn" onClick={onClose} style={{ padding: '0.75rem 1.5rem' }}>
              Close
            </button>
            {onEdit && (
              <button
                type="button"
                className="submit-btn"
                onClick={() => onEdit(learner)}
                style={{ padding: '0.75rem 2rem', borderRadius: '8px' }}
              >
                Edit Details
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

