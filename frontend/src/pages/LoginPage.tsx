import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { EyeToggleIcon } from '../components/Icons';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { requestPasswordReset, signInWithEmail } from '../services/authService';

export function LoginPage() {
  const { session, isAuthorizedAdmin } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (session && isAuthorizedAdmin) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmail(email.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMsg(null);
    setResetBusy(true);
    try {
      await requestPasswordReset(resetEmail.trim());
      setResetMsg({
        type: 'success',
        text: 'If an account matches that email, a password reset link has been sent.',
      });
    } catch (err) {
      setResetMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not send reset email.',
      });
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-wrapper">
        <div className="login-brand">AES Care</div>

        <div className="login-card-box">
          <h2
            style={{
              color: 'var(--primary)',
              fontSize: '1.1rem',
              fontWeight: 800,
              textAlign: 'center',
              marginBottom: '2.5rem',
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}
          >
            Log In To Your Account
          </h2>

          {!isSupabaseConfigured && (
            <div
              className="msg-error"
              style={{ marginBottom: '1.5rem', textAlign: 'left', lineHeight: 1.45 }}
            >
              <strong>Supabase Not Connected Yet:</strong> Configure{' '}
              <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in{' '}
              <code>frontend/.env.local</code> once your Supabase project is ready.
            </div>
          )}

          {error && (
            <div
              style={{
                background: '#fee2e2',
                color: '#991b1b',
                padding: '1rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                textAlign: 'center',
                fontSize: '0.9rem',
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="Email Address"
                required
                autoFocus
                className="login-pill-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '1rem', position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                placeholder="Password"
                required
                className="login-pill-input"
                style={{ paddingRight: '3rem' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((s) => !s)}
                style={{
                  position: 'absolute',
                  right: '1.3rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                }}
              >
                <EyeToggleIcon visible={showPassword} />
              </button>
            </div>

            <div style={{ textAlign: 'right', marginBottom: '2.5rem' }}>
              <button
                type="button"
                onClick={() => {
                  setResetEmail(email);
                  setResetMsg(null);
                  setForgotOpen(true);
                }}
                style={{
                  color: 'var(--primary)',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Forgot Password?
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button
                type="submit"
                disabled={submitting || !isSupabaseConfigured}
                className="login-submit-btn"
              >
                {submitting ? 'Signing In...' : 'Login'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <Modal
        isOpen={forgotOpen}
        onClose={() => setForgotOpen(false)}
        title="Reset Password"
        maxWidth="420px"
      >
        <form onSubmit={handleResetSubmit}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', lineHeight: 1.5 }}>
            Enter your counselor email address and we will send you a Supabase password recovery link.
          </p>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="reset_email">Email Address</label>
            <input
              id="reset_email"
              type="email"
              className="form-control"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              required
            />
          </div>
          {resetMsg && (
            <div className={resetMsg.type === 'success' ? 'msg-success' : 'msg-error'} style={{ marginBottom: '1rem' }}>
              {resetMsg.text}
            </div>
          )}
          <button type="submit" disabled={resetBusy} className="submit-btn" style={{ width: '100%' }}>
            {resetBusy ? 'Sending...' : 'Send Recovery Email'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

