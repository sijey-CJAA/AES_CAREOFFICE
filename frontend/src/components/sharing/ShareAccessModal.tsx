import React, { useEffect, useState } from 'react';
import { formatDateTime } from '../../lib/formatters';
import {
  createSharedAccess,
  defaultPermissionsForResource,
  getApplicablePermissions,
  sendSharedAccessInviteEmail,
} from '../../services/sharedAccessService';
import type {
  CreateSharedAccessResult,
  SharedAccessPermissions,
  SharedResourceType,
} from '../../types/database';
import { Modal } from '../Modal';

export interface ShareTarget {
  resourceType: Exclude<SharedResourceType, 'report'>;
  resourceId: number;
  resourceLabel: string;
}

interface ShareAccessModalProps {
  target: ShareTarget | null;
  onClose: () => void;
  onCreated?: () => void;
}

type ExpiryPreset = '24h' | '7d' | '30d' | 'custom';

function computeExpiresAtIso(preset: ExpiryPreset, customDate: string): string {
  const now = Date.now();
  if (preset === '24h') return new Date(now + 24 * 60 * 60 * 1000).toISOString();
  if (preset === '7d') return new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  if (preset === '30d') return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
  const parsed = new Date(customDate);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Please choose a valid custom expiration date and time.');
  }
  return parsed.toISOString();
}

export function ShareAccessModal({ target, onClose, onCreated }: ShareAccessModalProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [permissions, setPermissions] = useState<SharedAccessPermissions>(defaultPermissionsForResource);
  const [expiryPreset, setExpiryPreset] = useState<ExpiryPreset>('7d');
  const [customExpiry, setCustomExpiry] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState<CreateSharedAccessResult | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (target) {
      setRecipientEmail('');
      setRecipientName('');
      setPermissions(defaultPermissionsForResource());
      setExpiryPreset('7d');
      setCustomExpiry('');
      setCreated(null);
      setCopied(false);
      setFeedback(null);
    }
  }, [target]);

  if (!target) return null;

  const applicablePerms = getApplicablePermissions(target.resourceType);

  const togglePermission = (key: keyof SharedAccessPermissions) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const hasContentPermission =
    permissions.view_basic_info ||
    permissions.view_parent_info ||
    permissions.view_assessment_records ||
    permissions.view_case_records;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!recipientEmail.trim()) {
      setFeedback({ type: 'error', text: 'Please enter the recipient email address.' });
      return;
    }
    if (!hasContentPermission) {
      setFeedback({ type: 'error', text: 'Select at least one viewable information permission.' });
      return;
    }

    let expiresAtIso: string;
    try {
      expiresAtIso = computeExpiresAtIso(expiryPreset, customExpiry);
      if (new Date(expiresAtIso).getTime() <= Date.now()) {
        setFeedback({ type: 'error', text: 'Expiration date must be in the future.' });
        return;
      }
    } catch (err) {
      setFeedback({ type: 'error', text: err instanceof Error ? err.message : 'Invalid expiration date.' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await createSharedAccess({
        recipient_email: recipientEmail.trim(),
        recipient_name: recipientName.trim() || undefined,
        resource_type: target.resourceType,
        resource_id: target.resourceId,
        expires_at: expiresAtIso,
        permissions,
      });
      setCreated(result);
      setFeedback({
        type: 'success',
        text: 'Secure view-only invitation created! You can copy the invitation link or send it by email below.',
      });
      onCreated?.();
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to generate sharing invitation.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.invite_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFeedback({
        type: 'error',
        text: 'Clipboard access blocked. Please select and copy the link manually.',
      });
    }
  };

  const handleSendEmail = async () => {
    if (!created) return;
    setSendingEmail(true);
    setFeedback(null);
    try {
      const res = await sendSharedAccessInviteEmail(created.id, created.invite_token);
      setFeedback({
        type: 'success',
        text:
          res.delivery_method === 'invite'
            ? `Invitation email sent to ${recipientEmail.trim()}!`
            : `Secure sign-in link sent to ${recipientEmail.trim()}!`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text:
          err instanceof Error
            ? err.message
            : 'Unable to send email automatically. You can still copy and share the link manually.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const resourceTitle =
    target.resourceType === 'learner'
      ? 'Learner Profile'
      : target.resourceType === 'assessment'
        ? 'Assessment Record'
        : 'Case Register Entry';

  return (
    <Modal isOpen={true} onClose={onClose} title={`Share ${resourceTitle}`} maxWidth="620px">
      <div
        style={{
          background: '#f8fafc',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '0.85rem 1rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>
            Selected Record (View-Only)
          </div>
          <div style={{ fontWeight: 700, color: 'var(--text-dark)', marginTop: '0.15rem' }}>
            {target.resourceLabel}
          </div>
        </div>
        <span className="status-pill" style={{ background: 'var(--info-bg)', color: 'var(--info-text)' }}>
          Email Auth Required
        </span>
      </div>

      {!created ? (
        <form onSubmit={handleGenerate}>
          <div className="form-grid" style={{ marginBottom: '1.25rem' }}>
            <div className="form-group">
              <label htmlFor="share_recipient_email">Recipient Email Address *</label>
              <input
                id="share_recipient_email"
                type="email"
                className="form-control"
                placeholder="recipient@school.edu.ph"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="share_recipient_name">Recipient Name (Optional)</label>
              <input
                id="share_recipient_name"
                type="text"
                className="form-control"
                placeholder="e.g. Dr. Santos / Adviser"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
              Permission Settings (View-Only)
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Only checked sections will be sent to the recipient. Sensitive records are unchecked by default.
            </p>
            <div className="perm-checklist">
              {applicablePerms.map((perm) => (
                <label key={perm.key} className="perm-check-item">
                  <input
                    type="checkbox"
                    checked={permissions[perm.key]}
                    onChange={() => togglePermission(perm.key)}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-dark)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {perm.label}
                      {perm.sensitive && (
                        <span
                          className="status-pill"
                          style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', fontSize: '0.68rem', padding: '0.1rem 0.45rem' }}
                        >
                          Sensitive
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      {perm.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="share_expiry_preset" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '0.5rem' }}>
              Access Expiration
            </label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: expiryPreset === 'custom' ? '0.75rem' : 0 }}>
              {(
                [
                  { id: '24h', label: '24 hours' },
                  { id: '7d', label: '7 days' },
                  { id: '30d', label: '30 days' },
                  { id: 'custom', label: 'Custom date' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`control-btn ${expiryPreset === opt.id ? 'btn-primary' : ''}`}
                  onClick={() => setExpiryPreset(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {expiryPreset === 'custom' && (
              <input
                id="share_custom_expiry"
                type="datetime-local"
                className="form-control"
                value={customExpiry}
                onChange={(e) => setCustomExpiry(e.target.value)}
                required
              />
            )}
          </div>

          {feedback && (
            <div className={feedback.type === 'success' ? 'msg-success' : 'msg-error'} style={{ marginBottom: '1rem' }}>
              {feedback.text}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? 'Generating...' : 'Generate Invitation'}
            </button>
          </div>
        </form>
      ) : (
        <div>
          {feedback && (
            <div className={feedback.type === 'success' ? 'msg-success' : 'msg-error'} style={{ marginBottom: '1rem' }}>
              {feedback.text}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label htmlFor="generated_invite_url">Private Invitation Link (Valid Only for {recipientEmail.trim()})</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                id="generated_invite_url"
                type="text"
                className="form-control"
                value={created.invite_url}
                readOnly
                style={{ fontFamily: 'monospace', fontSize: '0.82rem', background: '#f8fafc' }}
              />
              <button type="button" className="control-btn" onClick={() => void handleCopyLink()}>
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
            </div>
            <small style={{ color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
              Expires: <strong>{formatDateTime(created.expires_at)}</strong>. This link is stored only as a secure hash; copy or send it now.
            </small>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="control-btn btn-primary"
              disabled={sendingEmail}
              onClick={() => void handleSendEmail()}
            >
              {sendingEmail ? 'Sending Email...' : 'Send Invitation Email'}
            </button>
            <button type="button" className="btn-cancel" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

