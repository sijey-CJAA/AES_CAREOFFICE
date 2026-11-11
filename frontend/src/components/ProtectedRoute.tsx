import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../services/authService';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, isAuthorizedAdmin, userEmail } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="login-shell">
        <div style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loading AES Care Office...</div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAuthorizedAdmin) {
    return (
      <div className="login-shell">
        <div className="login-card-box" style={{ maxWidth: '460px', textAlign: 'center' }}>
          <h2 style={{ color: '#991b1b', marginBottom: '0.75rem' }}>Access Restricted</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Your account (<strong>{userEmail}</strong>) is signed in, but is not authorized in the{' '}
            <code>admins</code> directory. Contact the Care Office administrator.
          </p>
          <button
            type="button"
            className="submit-btn"
            onClick={() => {
              void signOut();
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

