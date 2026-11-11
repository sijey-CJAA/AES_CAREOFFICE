import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useGlobalSearch } from '../context/SearchContext';
import { truncateEmail } from '../lib/formatters';
import { changePassword, signOut } from '../services/authService';
import {
  BellIcon,
  CalendarIcon,
  DashboardIcon,
  EyeToggleIcon,
  FileTextIcon,
  GraduationCapIcon,
  LockIcon,
  LogoutIcon,
  MailIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from './Icons';
import { Modal } from './Modal';

const SIDEBAR_LS_KEY = 'aes_sidebar_collapsed';

export function AppShell() {
  const { userEmail, userName } = useAuth();
  const { searchQuery, setSearchQuery } = useGlobalSearch();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_LS_KEY) === '1';
    } catch {
      return false;
    }
  });

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [cpOpen, setCpOpen] = useState(false);
  const [cpCurrent, setCpCurrent] = useState('');
  const [cpNew, setCpNew] = useState('');
  const [cpConfirm, setCpConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cpError, setCpError] = useState('');
  const [cpSaving, setCpSaving] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, []);

  const toggleSidebar = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_LS_KEY, next ? '1' : '0');
      } catch {
        // Ignore storage restriction
      }
      return next;
    });
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setCpError('');
    if (cpNew !== cpConfirm) {
      setCpError('New passwords do not match!');
      return;
    }
    if (cpNew.length < 8) {
      setCpError('New password must be at least 8 characters.');
      return;
    }

    setCpSaving(true);
    try {
      await changePassword(userEmail, cpCurrent, cpNew);
      alert('Password successfully updated!');
      setCpOpen(false);
      setCpCurrent('');
      setCpNew('');
      setCpConfirm('');
    } catch (err) {
      setCpError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setCpSaving(false);
    }
  };

  const initials = (userName.slice(0, 2) || 'AC').toUpperCase();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`} id="sidebar">
        <div className="sidebar-header">
          <img src="/aeslogo.svg" alt="AES Logo" className="sidebar-logo-icon" />
          <div className="sidebar-text-group">
            <div className="sidebar-title">AES Care Office</div>
            <div className="sidebar-subtitle">Counselor Portal</div>
          </div>
        </div>

        <button
          type="button"
          className="sidebar-toggle"
          onClick={toggleSidebar}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label="Toggle sidebar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            {collapsed ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
          </svg>
        </button>

        <nav className="sidebar-nav">
          <div className="nav-label">Navigation</div>
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} data-tooltip="Dashboard">
            <DashboardIcon />
            <span className="nav-text">Dashboard</span>
          </NavLink>

          <div className="nav-label">INFORMATION</div>
          <NavLink to="/learners" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} data-tooltip="Learners Information">
            <UsersIcon />
            <span className="nav-text">Learners Information</span>
          </NavLink>

          <div className="nav-label">GUIDANCE RECORDS</div>
          <NavLink to="/assessments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} data-tooltip="Assessment Records">
            <FileTextIcon />
            <span className="nav-text">Assessment Records</span>
          </NavLink>
          <NavLink to="/cases" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} data-tooltip="Case Register">
            <CalendarIcon />
            <span className="nav-text">Case Register</span>
          </NavLink>
          <NavLink to="/graduates" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} data-tooltip="Graduates">
            <GraduationCapIcon />
            <span className="nav-text">Graduates</span>
          </NavLink>

          <div className="nav-label">SYSTEM</div>
          <NavLink to="/archive" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} data-tooltip="Deleted Records">
            <TrashIcon />
            <span className="nav-text">Deleted Records</span>
          </NavLink>

          <div style={{ marginTop: 'auto' }} />

          <button type="button" onClick={handleLogout} className="nav-item" data-tooltip="Logout">
            <LogoutIcon />
            <span className="nav-text">Logout</span>
          </button>
        </nav>
      </aside>

      <div className="main-wrapper">
        <div className="top-bar">
          <div className="search-bar">
            <SearchIcon />
            <input
              type="text"
              id="globalSearchInput"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="top-bar-right">
            <div className="top-bar-icons" aria-hidden="true">
              <MailIcon />
              <BellIcon />
            </div>

            <div
              className="user-profile"
              ref={profileRef}
              onClick={() => setDropdownOpen((o) => !o)}
            >
              <div className="user-avatar" aria-label="User avatar">
                {initials}
              </div>
              <div className="user-info">
                <span className="user-name">{userName}</span>
                <span className="user-email">{truncateEmail(userEmail)}</span>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-muted)' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>

              {dropdownOpen && (
                <div className="profile-dropdown">
                  <button
                    type="button"
                    className="profile-dropdown-item"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDropdownOpen(false);
                      setCpError('');
                      setCpOpen(true);
                    }}
                  >
                    <LockIcon />
                    Change Password
                  </button>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border-color)', margin: '0.5rem 0' }} />
                  <button
                    type="button"
                    className="profile-dropdown-item danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleLogout();
                    }}
                  >
                    <LogoutIcon size={16} />
                    Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <main className="main-content">
          <Outlet />
          <footer style={{ marginTop: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <p>&copy; {new Date().getFullYear()} AES Care Office. All rights reserved.</p>
          </footer>
        </main>
      </div>

      <Modal isOpen={cpOpen} onClose={() => setCpOpen(false)} title="Change Password" maxWidth="400px">
        <form onSubmit={handleChangePassword}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="cp_current">Current Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrent ? 'text' : 'password'}
                id="cp_current"
                className="form-control"
                value={cpCurrent}
                onChange={(e) => setCpCurrent(e.target.value)}
                required
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((s) => !s)}
                aria-label="Toggle current password"
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <EyeToggleIcon visible={showCurrent} />
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="cp_new">New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                id="cp_new"
                className="form-control"
                value={cpNew}
                onChange={(e) => setCpNew(e.target.value)}
                required
                minLength={8}
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                aria-label="Toggle new password"
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <EyeToggleIcon visible={showNew} />
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="cp_confirm">Confirm New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                id="cp_confirm"
                className="form-control"
                value={cpConfirm}
                onChange={(e) => setCpConfirm(e.target.value)}
                required
                minLength={8}
                style={{ paddingRight: '2.5rem' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                aria-label="Toggle confirm password"
                style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
              >
                <EyeToggleIcon visible={showConfirm} />
              </button>
            </div>
          </div>

          {cpError && (
            <div className="msg-error" style={{ marginBottom: '1rem' }}>
              {cpError}
            </div>
          )}

          <button
            type="submit"
            disabled={cpSaving}
            className="control-btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '0.75rem' }}
          >
            {cpSaving ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </Modal>
    </div>
  );
}

