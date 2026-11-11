import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileTextIcon, FolderIcon, UsersIcon } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { fetchDashboardStats } from '../services/dashboardService';
import type { DashboardStats } from '../types/database';

export function DashboardPage() {
  const { userName } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    total_students: 0,
    total_parents: 0,
    total_assessments: 0,
    total_cases: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchDashboardStats()
      .then((res) => {
        if (active) setStats(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load stats.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <div className="page-header-container">
        <div>
          <h1 className="page-title">Welcome, {userName}!</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem' }}>Here&apos;s the latest update.</p>
        </div>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', marginBottom: '2.5rem' }}>
        <Link to="/learners" className="kpi-card">
          <div style={{ width: '50px', height: '50px', background: 'rgba(0, 135, 90, 0.1)', color: 'var(--primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UsersIcon size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
              Total Learners
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-dark)' }}>
              {loading ? '—' : stats.total_students}
            </div>
          </div>
        </Link>

        <Link to="/assessments" className="kpi-card">
          <div style={{ width: '50px', height: '50px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileTextIcon size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
              Assessments
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-dark)' }}>
              {loading ? '—' : stats.total_assessments}
            </div>
          </div>
        </Link>

        <Link to="/cases" className="kpi-card">
          <div style={{ width: '50px', height: '50px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FolderIcon size={24} />
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase' }}>
              Case Register
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-dark)' }}>
              {loading ? '—' : stats.total_cases}
            </div>
          </div>
        </Link>
      </div>
    </>
  );
}

