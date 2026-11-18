import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signInWithEmail, signOut } from '../services/authService';
import {
  acceptSharedInvitation,
  requestViewerMagicLink,
  SharedAccessError,
} from '../services/sharedAccessService';

export function SharedAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, loading: authLoading, userEmail } = useAuth();

  const token = (searchParams.get('token') ?? '').trim();

  const [authMode, setAuthMode] = useState<'magic' | 'password'>('magic');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [authError, setAuthError] = useState('');

  const [acceptState, setAcceptState] = useState<'idle' | 'verifying' | 'error'>('idle');
  const [acceptError, setAcceptError] = useState('');
  const [acceptCode, setAcceptCode] = useState<string | undefined>(undefined);
  const attemptedForUser = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading || !session || !token) return;
    const key = `${session.user.id}:${token}`;
    if (attemptedForUser.current === key) return;
    attemptedForUser.current = key;

    let active = true;
    setAcceptState('verifying');
    setAcceptError('');
    setAcceptCode(undefined);

    acceptSharedInvitation(token)
      .then((res) => {
        if (active) {
          navigate(`/shared/view/${res.share_id}`, { replace: true });
        }
      })
      .catch((err) => {
        if (!active) return;
        setAcceptState('error');
        if (err instanceof SharedAccessError) {
          setAcceptError(err.message);
          setAcceptCode(err.code);
        } else {
          setAcceptError(err instanceof Error ? err.message : 'Unable to verify this invitation.');
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, session, token, navigate]);

  const handleMagicLinkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setMagicSent(false);
    if (!email.trim()) {
      setAuthError('Please enter the email address that received this invitation.');
      return;
    }

    setBusy(true);
    try {
      const redirectUrl = `${window.location.origin}/shared/accept?token=${encodeURIComponent(token)}`;
      await requestViewerMagicLink(email.trim(), redirectUrl);
      setMagicSent(true);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Could not send verification sign-in link.');
    } finally {
      setBusy(false);
    }
  };

  const handlePasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setBusy(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Invalid email or password.');
    } finally {
      setBusy(false);
    }
  };

  const handleSwitchAccount = async () => {
    attemptedForUser.current = null;
    setAcceptState('idle');
    setAcceptError('');
    await signOut();
  };

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
        {session && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{userEmail}</span>
            <button type="button" className="control-btn" onClick={() => void handleSwitchAccount()}>
              Sign Out
            </button>
          </div>
        )}
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
          ) : authLoading || acceptState === 'verifying' ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem' }}>
                Verifying Invitation Access...
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Confirming your verified email and authorization permissions.
              </p>
            </div>
          ) : session && acceptState === 'error' ? (
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: 'var(--danger-text)', marginBottom: '0.75rem' }}>
                {acceptCode === 'expired'
                  ? 'Invitation Expired'
                  : acceptCode === 'revoked'
                    ? 'Access Revoked'
                    : 'Unable to Open Invitation'}
              </h2>
              <div className="msg-error" style={{ marginBottom: '1.25rem', textAlign: 'left' }}>
                {acceptError}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Signed in as <strong>{userEmail}</strong>. If this invitation was sent to another email address, sign out and authenticate with the invited email.
              </p>
              <button
                type="button"
                className="submit-btn"
                style={{ width: '100%' }}
                onClick={() => void handleSwitchAccount()}
              >
                Sign Out &amp; Use Another Email
              </button>
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
                Verify Your Invited Email
              </h2>
              <p
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.88rem',
                  textAlign: 'center',
                  marginBottom: '1.5rem',
                  lineHeight: 1.5,
                }}
              >
                Sign in using the exact email address authorized by the AES Guidance Office to view this shared record.
              </p>

              <div className="tabs" style={{ marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  className={`tab-btn ${authMode === 'magic' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '0.65rem 0.75rem', fontSize: '0.88rem' }}
                  onClick={() => {
                    setAuthMode('magic');
                    setAuthError('');
                  }}
                >
                  Email Sign-In Link
                </button>
                <button
                  type="button"
                  className={`tab-btn ${authMode === 'password' ? 'active' : ''}`}
                  style={{ flex: 1, padding: '0.65rem 0.75rem', fontSize: '0.88rem' }}
                  onClick={() => {
                    setAuthMode('password');
                    setAuthError('');
                  }}
                >
                  Email &amp; Password
                </button>
              </div>

              {authMode === 'magic' ? (
                magicSent ? (
                  <div className="msg-success" style={{ lineHeight: 1.5 }}>
                    <strong>Check your inbox!</strong> We sent a secure verification sign-in link to{' '}
                    <strong>{email.trim()}</strong>. Click that link to automatically open the shared record.
                  </div>
                ) : (
                  <form onSubmit={handleMagicLinkSubmit}>
                    <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                      <label htmlFor="viewer_magic_email">Invited Email Address</label>
                      <input
                        id="viewer_magic_email"
                        type="email"
                        className="form-control"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    {authError && (
                      <div className="msg-error" style={{ marginBottom: '1rem' }}>
                        {authError}
                      </div>
                    )}
                    <button type="submit" className="submit-btn" style={{ width: '100%' }} disabled={busy}>
                      {busy ? 'Sending Verification Link...' : 'Send Verification Sign-In Link'}
                    </button>
                  </form>
                )
              ) : (
                <form onSubmit={handlePasswordSignIn}>
                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label htmlFor="viewer_pw_email">Invited Email Address</label>
                    <input
                      id="viewer_pw_email"
                      type="email"
                      className="form-control"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label htmlFor="viewer_pw_pass">Password</label>
                    <input
                      id="viewer_pw_pass"
                      type="password"
                      className="form-control"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  {authError && (
                    <div className="msg-error" style={{ marginBottom: '1rem' }}>
                      {authError}
                    </div>
                  )}
                  <button type="submit" className="submit-btn" style={{ width: '100%' }} disabled={busy}>
                    {busy ? 'Signing In...' : 'Sign In & Open Record'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

