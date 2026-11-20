import { useState } from 'react';
import { formatLongDate } from '../../lib/formatters';
import type { AuthorizedContact, LearnerFullDetails, ParentRecord } from '../../types/database';
import { CloseIcon, ShareIcon } from '../Icons';

interface ViewLearnerModalProps {
  learner: LearnerFullDetails | null;
  onClose: () => void;
  onEdit?: (learner: LearnerFullDetails) => void;
  onShare?: (learner: LearnerFullDetails) => void;
}

function ParentViewBlock({ title, parent }: { title: string; parent?: ParentRecord }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--text-light)',
          textTransform: 'uppercase',
          marginBottom: '0.65rem',
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
          background: '#fafafa',
        }}
      >
        <div className="learner-info-grid" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
              Name
            </span>
            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-dark)', wordBreak: 'break-word' }}>
              {parent?.full_name || 'N/A'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
              Relationship
            </span>
            <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', wordBreak: 'break-word' }}>
              {parent?.relationship || 'N/A'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
              Mobile Number
            </span>
            <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', wordBreak: 'break-word' }}>
              {parent?.mobile_number || 'N/A'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
              Emergency Contact
            </span>
            <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', wordBreak: 'break-word' }}>
              {parent?.emergency_contact_number || 'N/A'}
            </span>
          </div>
        </div>
        <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
              Home Address
            </span>
            <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', wordBreak: 'break-word' }}>
              {parent?.home_address || 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AuthorizedContactsBlock({ contacts }: { contacts?: AuthorizedContact[] | null }) {
  const list = (contacts ?? []).filter((c) => c && (c.name?.trim() || c.relationship?.trim())).slice(0, 3);
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          color: 'var(--text-light)',
          textTransform: 'uppercase',
          marginBottom: '0.65rem',
          letterSpacing: '0.5px',
        }}
      >
        Authorized Person of Contact
      </div>
      <div
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: '12px',
          padding: '1.5rem',
          background: '#fafafa',
        }}
      >
        {list.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
            No authorized reunification contacts listed.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {list.map((c, idx) => (
              <div
                key={idx}
                className="learner-info-grid"
                style={{
                  paddingBottom: idx < list.length - 1 ? '1rem' : 0,
                  borderBottom: idx < list.length - 1 ? '1px dashed var(--border-color)' : 'none',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                    Name
                  </span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-dark)', wordBreak: 'break-word' }}>
                    {c.name || 'N/A'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                    Relationship
                  </span>
                  <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', wordBreak: 'break-word' }}>
                    {c.relationship || 'N/A'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ViewLearnerModal({ learner, onClose, onEdit, onShare }: ViewLearnerModalProps) {
  const [activeTab, setActiveTab] = useState<'reunification' | 'profile'>('reunification');

  if (!learner) return null;

  const primary = learner.parents.find((p) => p.parent_type === 'Primary');
  const secondary = learner.parents.find((p) => p.parent_type === 'Secondary');
  const hasPastRecords = learner.assessments.length > 0 || learner.cases.length > 0;

  const gradeSectionLabel =
    learner.grade_level || learner.grade_section
      ? `${learner.grade_level || learner.grade_section}${learner.section ? ` - ${learner.section}` : ''}`
      : 'N/A';

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
      <div
        className="modal-content modal-content-wide"
        style={{
          maxWidth: '960px',
          width: '95%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* Fixed Header with green accent bar */}
        <div
          className="modal-header"
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid var(--border-color)',
            flexShrink: 0,
            background: 'white',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '4px', height: '24px', background: 'var(--primary)', borderRadius: '4px', flexShrink: 0 }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>
              Learner Full Information
            </h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
            <CloseIcon />
          </button>
        </div>

        {/* Fixed Tabs: 1. Student Reunification, 2. Student Profile */}
        <div
          className="modal-tabs"
          role="tablist"
          aria-label="Learner Modal Tabs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'reunification'}
            className={`tab-btn modal-tab-btn ${activeTab === 'reunification' ? 'active' : ''}`}
            onClick={() => setActiveTab('reunification')}
          >
            Student Reunification
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'profile'}
            className={`tab-btn modal-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Student Profile
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div
          className="modal-body"
          style={{
            padding: '1.75rem',
            overflowY: 'auto',
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* TAB 1: STUDENT REUNIFICATION */}
          {activeTab === 'reunification' && (
            <div>
              <ParentViewBlock title="Primary Parent" parent={primary} />
              <ParentViewBlock title="Secondary Parent" parent={secondary} />
              <AuthorizedContactsBlock contacts={learner.reunification_contacts} />

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
            </div>
          )}

          {/* TAB 2: STUDENT PROFILE */}
          {activeTab === 'profile' && (
            <div>
              <div
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  marginBottom: '1rem',
                  background: '#fafafa',
                }}
              >
                <div className="learner-info-grid" style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                      Full Name
                    </span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-dark)', wordBreak: 'break-word' }}>
                      {learner.full_name || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                      LRN
                    </span>
                    <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', wordBreak: 'break-word' }}>
                      {learner.lrn || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                      School Year
                    </span>
                    <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', wordBreak: 'break-word' }}>
                      {learner.school_year || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                      Grade &amp; Section
                    </span>
                    <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', wordBreak: 'break-word' }}>
                      {gradeSectionLabel}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                      Date of Birth
                    </span>
                    <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', wordBreak: 'break-word' }}>
                      {formatLongDate(learner.date_of_birth) || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                      Blood Type
                    </span>
                    <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', wordBreak: 'break-word' }}>
                      {learner.blood_type || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                      Status
                    </span>
                    <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', wordBreak: 'break-word' }}>
                      {learner.status || 'Currently Enrolled'}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: '1px dashed var(--border-color)',
                    paddingTop: '1.25rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                      Home Address
                    </span>
                    <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', wordBreak: 'break-word' }}>
                      {learner.home_address || 'N/A'}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    borderTop: '1px dashed var(--border-color)',
                    paddingTop: '1.25rem',
                  }}
                  className="learner-info-grid"
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                      Allergies
                    </span>
                    <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', wordBreak: 'break-word' }}>
                      {learner.allergies || 'None'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                      Medications
                    </span>
                    <span style={{ fontSize: '0.95rem', color: 'var(--text-dark)', wordBreak: 'break-word' }}>
                      {learner.medications || 'None'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer with action buttons */}
        <div
          className="modal-footer"
          style={{
            padding: '1.15rem 1.75rem',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '1rem',
            background: 'white',
            flexShrink: 0,
          }}
        >
          <button type="button" className="control-btn" onClick={onClose} style={{ padding: '0.65rem 1.25rem' }}>
            Close
          </button>
          {onShare && (
            <button
              type="button"
              className="control-btn"
              onClick={() => onShare(learner)}
              style={{ padding: '0.65rem 1.15rem' }}
            >
              <ShareIcon size={15} /> Share
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              className="submit-btn"
              onClick={() => onEdit(learner)}
              style={{ padding: '0.65rem 1.5rem', borderRadius: '8px' }}
            >
              Edit Details
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
