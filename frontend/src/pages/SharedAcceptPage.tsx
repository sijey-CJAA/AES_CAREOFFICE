import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  requestEmailVerificationCode,
  SharedAccessError,
  verifyEmailCode,
} from '../services/sharedAccessService';

export function SharedAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = (searchParams.get('token') ?? '').trim();

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);
  const [infoMsg, setInfoMsg] = useState('');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setErrorCode(undefined);
    setInfoMsg('');

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMsg('Please enter the email address that received this invitation.');
      return;
    }

    setBusy(true);
    try {
      const res = await requestEmailVerificationCode(token, trimmedEmail);
      setMaskedEmail(res.masked_email || trimmedEmail);
      setStep('code');
      setCode('');
      setResendCooldown(30);
      setInfoMsg(
        `A 6-digit verification code has been sent to ${res.masked_email || trimmedEmail}. Check your Gmail inbox (and Spam folder).`
      );
    } catch (err) {
      if (err instanceof SharedAccessError) {
        setErrorMsg(err.message);
        setErrorCode(err.code);
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to send verification code.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || busy) return;
    setErrorMsg('');
    setErrorCode(undefined);
    setInfoMsg('');
    setBusy(true);
    try {
      const res = await requestEmailVerificationCode(token, email.trim());
      setResendCooldown(30);
      setInfoMsg(
        `A fresh 6-digit verification code has been sent to ${res.masked_email || email.trim()}.`
      );
    } catch (err) {
      if (err instanceof SharedAccessError) {
        setErrorMsg(err.message);
        setErrorCode(err.code);
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to resend verification code.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setErrorCode(undefined);

    const digitsOnly = code.replace(/\D/g, '').trim();
    if (digitsOnly.length !== 6) {
      setErrorMsg('Please enter the full 6-digit verification code from your email.');
      return;
    }

    setBusy(true);
    try {
      const res = await verifyEmailCode(token, email.trim(), digitsOnly);
      navigate(`/shared/view/${res.share_id}`, { replace: true });
    } catch (err) {
      if (err instanceof SharedAccessError) {
        setErrorMsg(err.message);
        setErrorCode(err.code);
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Unable to verify code.');
      }
    } finally {
      setBusy(false);
    }
  };

  const isTerminalShareError = errorCode === 'expired' || errorCode === 'revoked' || errorCode === 'not_found';

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
              Secure Record Sharing Portal
            </div>
          </div>
        </div>
        <span className="status-pill" style={{ background: 'var(--info-bg)', color: 'var(--info-text)' }}>
          No Account Required
        </span>
      </header>

      <main className="viewer-main" style={{ maxWidth: '500px' }}>
        <div className="viewer-card">
          {!token ? (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: 'var(--danger-text)', marginBottom: '0.75rem' }}>
                Invalid Invitation Link
              </h2>
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                This shared access URL is missing a valid invitation token. Please open the full link sent to you by the AES Guidance Office.
              </p>
            </div>
          ) : isTerminalShareError ? (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: 'var(--danger-text)', marginBottom: '0.75rem' }}>
                {errorCode === 'expired'
                  ? 'Invitation Expired'
                  : errorCode === 'revoked'
                    ? 'Access Revoked'
                    : 'Invitation Not Found'}
              </h2>
              <div className="msg-error" style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
                {errorMsg}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', lineHeight: 1.5 }}>
                Please contact the AES Guidance Office if you need a new shared record invitation.
              </p>
            </div>
          ) : step === 'email' ? (
            <div>
              <h2
                style={{
                  color: 'var(--primary)',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                Verify Your Invited Email
              </h2>
              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.88rem',
                  textAlign: 'center',
                  marginBottom: '1.5rem',
                  lineHeight: 1.55,
                }}
              >
                <strong>No sign-up or login needed.</strong> Enter the exact email address authorized by the AES Guidance Office to receive a temporary 6-digit verification code in Gmail.
              </p>

              <form onSubmit={handleRequestCode}>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="viewer_invited_email">Invited Email Address</label>
                  <input
                    id="viewer_invited_email"
                    type="email"
                    className="form-control"
                    placeholder="your.email@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                {errorMsg && (
                  <div className="msg-error" style={{ marginBottom: '1rem' }}>
                    {errorMsg}
                  </div>
                )}

                <button type="submit" className="submit-btn" style={{ width: '100%' }} disabled={busy}>
                  {busy ? 'Sending Verification Code...' : 'Send 6-Digit Verification Code'}
                </button>
              </form>
            </div>
          ) : (
            <div>
              <h2
                style={{
                  color: 'var(--primary)',
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  marginBottom: '0.5rem',
                }}
              >
                Enter Gmail Verification Code
              </h2>
              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.88rem',
                  textAlign: 'center',
                  marginBottom: '1.25rem',
                  lineHeight: 1.55,
                }}
              >
                Enter the 6-digit code sent to <strong>{maskedEmail || email}</strong> to open your temporary view-only record.
              </p>

              {infoMsg && (
                <div className="msg-success" style={{ marginBottom: '1rem', fontSize: '0.85rem', lineHeight: 1.5 }}>
                  {infoMsg}
                </div>
              )}

              <form onSubmit={handleVerifyCode}>
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="viewer_otp_code">6-Digit Verification Code</label>
                  <input
                    id="viewer_otp_code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    className="form-control"
                    placeholder="123456"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    style={{
                      textAlign: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 800,
                      letterSpacing: '0.35em',
                    }}
                    required
                  />
                </div>

                {errorMsg && (
                  <div className="msg-error" style={{ marginBottom: '1rem' }}>
                    {errorMsg}
                  </div>
                )}

                <button type="submit" className="submit-btn" style={{ width: '100%' }} disabled={busy}>
                  {busy ? 'Verifying Code...' : 'Verify & Open Record'}
                </button>
              </form>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginTop: '1.25rem',
                  flexWrap: 'wrap',
                }}
              >
                <button
                  type="button"
                  className="control-btn"
                  disabled={busy || resendCooldown > 0}
                  onClick={() => void handleResendCode()}
                >
                  {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                </button>
                <button
                  type="button"
                  className="control-btn"
                  disabled={busy}
                  onClick={() => {
                    setStep('email');
                    setCode('');
                    setErrorMsg('');
                    setErrorCode(undefined);
                    setInfoMsg('');
                  }}
                >
                  Use Different Email
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-color)',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            Temporary view-only access — no account is created and access ends automatically when you close this tab or when the invitation expires.
          </div>
        </div>
      </main>
    </div>
  );
}
