import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { useGlobalSearch } from '../context/SearchContext';
import { formatDateTime } from '../lib/formatters';
import {
  extendSharedAccessExpiration,
  fetchSharedAccessList,
  fetchSharedAccessLogs,
  getApplicablePermissions,
  getEffectiveShareStatus,
  regenerateSharedAccessLink,
  revokeSharedAccess,
  sendSharedAccessInviteEmail,
  updateSharedAccessPermissions,
} from '../services/sharedAccessService';
import type {
  SharedAccessAction,
  SharedAccessLogRecord,
  SharedAccessPermissions,
  SharedAccessRecord,
  SharedAccessStatus,
} from '../types/database';

type FilterStatus = 'all' | SharedAccessStatus;

const STATUS_STYLES: Record<SharedAccessStatus, { bg: string; color: string; label: string }> = {
  pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
  active: { bg: '#dcfce7', color: '#166534', label: 'Active' },
  expired: { bg: '#f1f5f9', color: '#475569', label: 'Expired' },
  revoked: { bg: '#fee2e2', color: '#991b1b', label: 'Revoked' },
};

const ACTION_LABELS: Record<SharedAccessAction, string> = {
  invitation_created: 'Invitation Created',
  invitation_sent: 'Invitation Sent / Link Generated',
  verification_code_sent: 'Gmail Verification Code Sent',
  invitation_accepted: 'Email Verified & Opened',
  record_viewed: 'Record Viewed',
  pdf_downloaded: 'PDF Downloaded',
  permission_updated: 'Permissions Updated',
  expiration_extended: 'Expiration Extended',
  access_revoked: 'Access Revoked',
  access_denied: 'Access Denied',
};

function summarizePermissions(record: SharedAccessRecord): string[] {
  const tags: string[] = [];
  if (record.permissions.view_basic_info) tags.push('Basic Info');
  if (record.permissions.view_parent_info) tags.push('Parent Info');
  if (record.permissions.view_assessment_records) tags.push('Assessments');
  if (record.permissions.view_case_records) tags.push('Cases');
  if (record.permissions.view_download_pdf) tags.push('PDF');
  return tags;
}

export function SharedAccessPage() {
  const { searchQuery } = useGlobalSearch();
  const [records, setRecords] = useState<SharedAccessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Details & Audit Log Modal
  const [detailShare, setDetailShare] = useState<SharedAccessRecord | null>(null);
  const [detailLogs, setDetailLogs] = useState<SharedAccessLogRecord[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Edit Permissions Modal
  const [editPermShare, setEditPermShare] = useState<SharedAccessRecord | null>(null);
  const [editPerms, setEditPerms] = useState<SharedAccessPermissions>({
    view_basic_info: true,
    view_parent_info: false,
    view_assessment_records: false,
    view_case_records: false,
    view_download_pdf: false,
  });
  const [savingPerms, setSavingPerms] = useState(false);
  const [permMsg, setPermMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Extend Expiration Modal
  const [extendShare, setExtendShare] = useState<SharedAccessRecord | null>(null);
  const [extendDays, setExtendDays] = useState<'24h' | '7d' | '30d' | 'custom'>('7d');
  const [extendCustomDate, setExtendCustomDate] = useState('');
  const [savingExtend, setSavingExtend] = useState(false);
  const [extendMsg, setExtendMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await fetchSharedAccessList();
      setRecords(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load shared access records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const statusCounts = useMemo(() => {
    const counts: Record<FilterStatus, number> = {
      all: records.length,
      pending: 0,
      active: 0,
      expired: 0,
      revoked: 0,
    };
    for (const r of records) {
      const eff = getEffectiveShareStatus(r);
      counts[eff]++;
    }
    return counts;
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      const eff = getEffectiveShareStatus(r);
      if (statusFilter !== 'all' && eff !== statusFilter) return false;
      if (!q) return true;
      const hay = [r.recipient_email, r.recipient_name, r.resource_label, r.resource_type, eff]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [records, statusFilter, searchQuery]);

  const handleOpenDetails = async (share: SharedAccessRecord) => {
    setDetailShare(share);
    setDetailLogs([]);
    setLogsLoading(true);
    try {
      const logs = await fetchSharedAccessLogs(share.id);
      setDetailLogs(logs);
    } catch {
      setDetailLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleOpenEditPerms = (share: SharedAccessRecord) => {
    setEditPermShare(share);
    setEditPerms({ ...share.permissions });
    setPermMsg(null);
  };

  const handleSavePerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPermShare) return;
    setSavingPerms(true);
    setPermMsg(null);
    try {
      await updateSharedAccessPermissions(editPermShare.id, editPerms);
      setPermMsg({ type: 'success', text: 'Permissions updated!' });
      await loadList();
      setTimeout(() => {
        setEditPermShare(null);
        setPermMsg(null);
      }, 700);
    } catch (err) {
      setPermMsg({ type: 'error', text: err instanceof Error ? err.message : 'Unable to update permissions.' });
    } finally {
      setSavingPerms(false);
    }
  };

  const handleSaveExtend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendShare) return;
    setExtendMsg(null);

    let nextIso = '';
    const now = Date.now();
    if (extendDays === '24h') nextIso = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    else if (extendDays === '7d') nextIso = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    else if (extendDays === '30d') nextIso = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    else {
      const parsed = new Date(extendCustomDate);
      if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= now) {
        setExtendMsg({ type: 'error', text: 'Please select a valid future date and time.' });
        return;
      }
      nextIso = parsed.toISOString();
    }

    setSavingExtend(true);
    try {
      await extendSharedAccessExpiration(extendShare.id, nextIso);
      setExtendMsg({ type: 'success', text: 'Expiration updated!' });
      await loadList();
      setTimeout(() => {
        setExtendShare(null);
        setExtendMsg(null);
      }, 700);
    } catch (err) {
      setExtendMsg({ type: 'error', text: err instanceof Error ? err.message : 'Unable to extend expiration.' });
    } finally {
      setSavingExtend(false);
    }
  };

  const handleRevoke = async (share: SharedAccessRecord) => {
    if (
      !window.confirm(
        `Revoke view-only access for ${share.recipient_email} immediately? They will no longer be able to view or download this record.`
      )
    ) {
      return;
    }
    setToast(null);
    try {
      await revokeSharedAccess(share.id);
      setToast({ type: 'success', text: `Access revoked for ${share.recipient_email}.` });
      await loadList();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Unable to revoke access.' });
    }
  };

  const handleCopyLink = async (share: SharedAccessRecord, alsoSendEmail = false) => {
    setToast(null);
    try {
      const fresh = await regenerateSharedAccessLink(share.id);
      if (alsoSendEmail) {
        await sendSharedAccessInviteEmail(share.id, fresh.invite_token);
        setToast({ type: 'success', text: `Fresh invitation email sent to ${share.recipient_email}.` });
      } else {
        try {
          await navigator.clipboard.writeText(fresh.invite_url);
          setToast({ type: 'success', text: `Fresh invitation link copied for ${share.recipient_email}.` });
        } catch {
          window.prompt('Copy this fresh invitation link:', fresh.invite_url);
        }
      }
      await loadList();
    } catch (err) {
      setToast({ type: 'error', text: err instanceof Error ? err.message : 'Unable to generate link.' });
    }
  };

  return (
    <>
      <div className="page-header-container">
        <div>
          <h1 className="page-title">Shared Access</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '0.2rem' }}>
            Manage view-only record invitations, permissions, expirations, and audit history.
          </p>
        </div>
        <div className="page-controls">
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Showing <strong style={{ color: 'var(--text-dark)' }}>{filteredRecords.length}</strong>
          </span>
        </div>
      </div>

      {toast && (
        <div className={toast.type === 'success' ? 'msg-success' : 'msg-error'} style={{ marginBottom: '1rem' }}>
          {toast.text}
        </div>
      )}
      {error && <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="content-card">
        <div className="tabs">
          {(['all', 'pending', 'active', 'expired', 'revoked'] as FilterStatus[]).map((st) => (
            <button
              key={st}
              type="button"
              className={`tab-btn ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st.charAt(0).toUpperCase() + st.slice(1)} ({statusCounts[st]})
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            Loading shared access invitations...
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" style={{ minWidth: 'max-content' }}>
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Shared Resource</th>
                  <th>Type</th>
                  <th>Granted Permissions</th>
                  <th>Invited</th>
                  <th>Expires</th>
                  <th>Last Accessed</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No shared access invitations found. Use the Share button on any Learner, Assessment, or Case record to invite a viewer.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((share) => {
                    const effStatus = getEffectiveShareStatus(share);
                    const badge = STATUS_STYLES[effStatus];
                    const permTags = summarizePermissions(share);
                    const isRevoked = effStatus === 'revoked';
                    const isExpired = effStatus === 'expired';

                    return (
                      <tr key={share.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{share.recipient_email}</div>
                          {share.recipient_name && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{share.recipient_name}</div>
                          )}
                        </td>
                        <td style={{ fontWeight: 500, color: 'var(--text-dark)' }}>
                          {share.resource_label || `${share.resource_type} #${share.resource_id}`}
                        </td>
                        <td style={{ textTransform: 'capitalize' }}>{share.resource_type}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', maxWidth: '240px' }}>
                            {permTags.map((tag) => (
                              <span key={tag} className="perm-badge">
                                {tag}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{formatDateTime(share.created_at)}</td>
                        <td style={{ color: isExpired ? 'var(--danger-text)' : 'var(--text-dark)' }}>
                          {formatDateTime(share.expires_at)}
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>
                          {share.last_accessed_at ? formatDateTime(share.last_accessed_at) : 'Never'}
                        </td>
                        <td>
                          <span className="status-pill" style={{ background: badge.bg, color: badge.color }}>
                            {badge.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="control-btn"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                              onClick={() => void handleOpenDetails(share)}
                            >
                              Details
                            </button>
                            {!isRevoked && (
                              <>
                                <button
                                  type="button"
                                  className="control-btn"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                                  onClick={() => handleOpenEditPerms(share)}
                                >
                                  Permissions
                                </button>
                                <button
                                  type="button"
                                  className="control-btn"
                                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                                  onClick={() => {
                                    setExtendShare(share);
                                    setExtendDays('7d');
                                    setExtendCustomDate('');
                                    setExtendMsg(null);
                                  }}
                                >
                                  Extend
                                </button>
                                {!isExpired && (
                                  <button
                                    type="button"
                                    className="control-btn"
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                                    onClick={() => void handleCopyLink(share, false)}
                                  >
                                    Copy Link
                                  </button>
                                )}
                                <button
                                  type="button"
                                  className="btn-delete-soft"
                                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                                  onClick={() => void handleRevoke(share)}
                                >
                                  Revoke
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details & Audit Log Modal */}
      <Modal
        isOpen={detailShare !== null}
        onClose={() => setDetailShare(null)}
        title="Sharing Details & Activity Log"
        maxWidth="660px"
      >
        {detailShare && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '0.85rem',
                background: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '1rem',
                marginBottom: '1.25rem',
                fontSize: '0.88rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  Recipient
                </div>
                <div style={{ fontWeight: 600 }}>{detailShare.recipient_email}</div>
                {detailShare.recipient_name && <div style={{ color: 'var(--text-muted)' }}>{detailShare.recipient_name}</div>}
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  Shared Resource
                </div>
                <div style={{ fontWeight: 600 }}>{detailShare.resource_label}</div>
                <div style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{detailShare.resource_type} · View-Only</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  Accepted At
                </div>
                <div>{detailShare.accepted_at ? formatDateTime(detailShare.accepted_at) : 'Not accepted yet'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
                  Expires / Revoked
                </div>
                <div>
                  {detailShare.revoked_at
                    ? `Revoked ${formatDateTime(detailShare.revoked_at)}`
                    : formatDateTime(detailShare.expires_at)}
                </div>
              </div>
            </div>

            {getEffectiveShareStatus(detailShare) !== 'revoked' && getEffectiveShareStatus(detailShare) !== 'expired' && (
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <button type="button" className="control-btn" onClick={() => void handleCopyLink(detailShare, false)}>
                  Copy Fresh Invitation Link
                </button>
                <button type="button" className="control-btn btn-primary" onClick={() => void handleCopyLink(detailShare, true)}>
                  Resend Invitation Email
                </button>
              </div>
            )}

            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.75rem' }}>
              Activity History
            </h3>
            {logsLoading ? (
              <div style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>Loading activity logs...</div>
            ) : detailLogs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', padding: '1rem 0' }}>No activity logged yet.</div>
            ) : (
              <div className="audit-log-list">
                {detailLogs.map((log) => (
                  <div key={log.id} className="audit-log-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                      <strong style={{ color: log.action === 'access_denied' ? 'var(--danger-text)' : 'var(--text-dark)' }}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        {formatDateTime(log.accessed_at)}
                      </span>
                    </div>
                    {log.metadata && Object.keys(log.metadata).length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        {typeof log.metadata.reason === 'string' && `Reason: ${log.metadata.reason}`}
                        {typeof log.metadata.delivery_method === 'string' &&
                          `Delivery: ${log.metadata.delivery_method}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Permissions Modal */}
      <Modal
        isOpen={editPermShare !== null}
        onClose={() => setEditPermShare(null)}
        title="Edit Shared Permissions"
        maxWidth="540px"
      >
        {editPermShare && (
          <form onSubmit={handleSavePerms}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Updating permissions for <strong>{editPermShare.recipient_email}</strong> ({editPermShare.resource_label}). Changes take effect immediately.
            </p>
            <div className="perm-checklist" style={{ marginBottom: '1.25rem' }}>
              {getApplicablePermissions(editPermShare.resource_type).map((perm) => (
                <label key={perm.key} className="perm-check-item">
                  <input
                    type="checkbox"
                    checked={editPerms[perm.key]}
                    onChange={() =>
                      setEditPerms((prev) => ({ ...prev, [perm.key]: !prev[perm.key] }))
                    }
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{perm.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{perm.description}</div>
                  </div>
                </label>
              ))}
            </div>
            {permMsg && (
              <div className={permMsg.type === 'success' ? 'msg-success' : 'msg-error'} style={{ marginBottom: '1rem' }}>
                {permMsg.text}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-cancel" onClick={() => setEditPermShare(null)}>
                Cancel
              </button>
              <button type="submit" className="submit-btn" disabled={savingPerms}>
                {savingPerms ? 'Saving...' : 'Save Permissions'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Extend Expiration Modal */}
      <Modal
        isOpen={extendShare !== null}
        onClose={() => setExtendShare(null)}
        title="Extend Expiration"
        maxWidth="480px"
      >
        {extendShare && (
          <form onSubmit={handleSaveExtend}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Set a new expiration window for <strong>{extendShare.recipient_email}</strong>.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {(
                [
                  { id: '24h', label: '+24 hours' },
                  { id: '7d', label: '+7 days' },
                  { id: '30d', label: '+30 days' },
                  { id: 'custom', label: 'Custom date' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`control-btn ${extendDays === opt.id ? 'btn-primary' : ''}`}
                  onClick={() => setExtendDays(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {extendDays === 'custom' && (
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="extend_custom_dt">New Expiration Date &amp; Time</label>
                <input
                  id="extend_custom_dt"
                  type="datetime-local"
                  className="form-control"
                  value={extendCustomDate}
                  onChange={(e) => setExtendCustomDate(e.target.value)}
                  required
                />
              </div>
            )}
            {extendMsg && (
              <div className={extendMsg.type === 'success' ? 'msg-success' : 'msg-error'} style={{ marginBottom: '1rem' }}>
                {extendMsg.text}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn-cancel" onClick={() => setExtendShare(null)}>
                Cancel
              </button>
              <button type="submit" className="submit-btn" disabled={savingExtend}>
                {savingExtend ? 'Updating...' : 'Update Expiration'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

