import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateRecoveredPassword } from '../services/authService';

export function ResetPasswordPage() {
  const { clearPasswordRecovery } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await updateRecoveredPassword(password);
      clearPasswordRecovery();
      setDone(true);
      setTimeout(() => navigate('/', { replace: true }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setSaving(false);
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
              marginBottom: '2rem',
              textTransform: 'uppercase',
            }}
          >
            Set New Password
          </h2>

          {done ? (
            <div className="msg-success" style={{ textAlign: 'center' }}>
              Password updated! Redirecting to dashboard...
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                <label htmlFor="recover_pw">New Password</label>
                <input
                  id="recover_pw"
                  type="password"
                  className="form-control"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label htmlFor="recover_pw_confirm">Confirm New Password</label>
                <input
                  id="recover_pw_confirm"
                  type="password"
                  className="form-control"
                  minLength={8}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error && (
                <div className="msg-error" style={{ marginBottom: '1rem' }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={saving} className="submit-btn" style={{ width: '100%' }}>
                {saving ? 'Updating...' : 'Save New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

