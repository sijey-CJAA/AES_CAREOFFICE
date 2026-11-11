import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExportIcon } from '../components/Icons';
import { useGlobalSearch } from '../context/SearchContext';
import { formatDateTime } from '../lib/formatters';
import { exportTableToPDF } from '../lib/pdfExport';
import {
  fetchArchivedRecords,
  restoreRecord,
  type ArchivedRecordsBundle,
} from '../services/archiveService';
import type { SoftDeleteTable } from '../types/database';

type ArchiveTab = 'learners' | 'parents' | 'assessments' | 'cases';

export function ArchivePage() {
  const { searchQuery } = useGlobalSearch();
  const [activeTab, setActiveTab] = useState<ArchiveTab>('learners');
  const [bundle, setBundle] = useState<ArchivedRecordsBundle>({
    students: [],
    parents: [],
    assessments: [],
    cases: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadArchive = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchArchivedRecords();
      setBundle(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading archive records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArchive();
  }, [loadArchive]);

  const q = searchQuery.trim().toLowerCase();

  const filteredStudents = useMemo(
    () =>
      bundle.students.filter(
        (s) =>
          !q ||
          (s.full_name ?? '').toLowerCase().includes(q) ||
          (s.lrn ?? '').toLowerCase().includes(q)
      ),
    [bundle.students, q]
  );

  const filteredParents = useMemo(
    () =>
      bundle.parents.filter(
        (p) =>
          !q ||
          (p.full_name ?? '').toLowerCase().includes(q) ||
          (p.student_name ?? '').toLowerCase().includes(q)
      ),
    [bundle.parents, q]
  );

  const filteredAssessments = useMemo(
    () =>
      bundle.assessments.filter(
        (a) =>
          !q ||
          (a.record_number ?? '').toLowerCase().includes(q) ||
          (a.student_name ?? '').toLowerCase().includes(q)
      ),
    [bundle.assessments, q]
  );

  const filteredCases = useMemo(
    () =>
      bundle.cases.filter(
        (c) =>
          !q ||
          (c.case_number ?? '').toLowerCase().includes(q) ||
          (c.student_names ?? '').toLowerCase().includes(q)
      ),
    [bundle.cases, q]
  );

  const activeCount = useMemo(() => {
    if (activeTab === 'learners') return filteredStudents.length;
    if (activeTab === 'parents') return filteredParents.length;
    if (activeTab === 'assessments') return filteredAssessments.length;
    return filteredCases.length;
  }, [activeTab, filteredStudents.length, filteredParents.length, filteredAssessments.length, filteredCases.length]);

  const handleRestore = async (table: SoftDeleteTable, id: number) => {
    if (!window.confirm('Are you sure you want to restore this record?')) return;
    try {
      await restoreRecord(table, id);
      await loadArchive();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to restore record.');
    }
  };

  const handleExport = () => {
    if (activeTab === 'learners') {
      exportTableToPDF({
        filename: 'archive_export.pdf',
        headers: ['Full Name', 'LRN', 'Deleted At'],
        rows: filteredStudents.map((r) => [r.full_name, r.lrn, formatDateTime(r.deleted_at)]),
      });
    } else if (activeTab === 'parents') {
      exportTableToPDF({
        filename: 'archive_export.pdf',
        headers: ['Parent Name', 'Student Name', 'Deleted At'],
        rows: filteredParents.map((r) => [r.full_name, r.student_name ?? 'Unknown', formatDateTime(r.deleted_at)]),
      });
    } else if (activeTab === 'assessments') {
      exportTableToPDF({
        filename: 'archive_export.pdf',
        headers: ['Record No.', 'Student Name', 'Deleted At'],
        rows: filteredAssessments.map((r) => [r.record_number, r.student_name ?? 'Unknown', formatDateTime(r.deleted_at)]),
      });
    } else {
      exportTableToPDF({
        filename: 'archive_export.pdf',
        headers: ['Case No.', 'Student Name', 'Deleted At'],
        rows: filteredCases.map((r) => [r.case_number, r.student_names || 'Unknown', formatDateTime(r.deleted_at)]),
      });
    }
  };

  return (
    <>
      <div className="page-header-container">
        <h1 className="page-title">Deleted Records</h1>
        <div className="page-controls">
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Showing <strong style={{ color: 'var(--text-dark)' }}>{activeCount}</strong>
          </span>
          <button type="button" className="control-btn" onClick={handleExport}>
            <ExportIcon /> Export
          </button>
        </div>
      </div>

      {error && <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="content-card">
        <div className="tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'learners' ? 'active' : ''}`}
            onClick={() => setActiveTab('learners')}
          >
            Learners ({bundle.students.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'parents' ? 'active' : ''}`}
            onClick={() => setActiveTab('parents')}
          >
            Parents ({bundle.parents.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'assessments' ? 'active' : ''}`}
            onClick={() => setActiveTab('assessments')}
          >
            Assessments ({bundle.assessments.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'cases' ? 'active' : ''}`}
            onClick={() => setActiveTab('cases')}
          >
            Cases ({bundle.cases.length})
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            Loading deleted records...
          </div>
        ) : (
          <div className="table-responsive">
            {activeTab === 'learners' && (
              <table className="data-table" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>LRN</th>
                    <th>Deleted At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No deleted learners found.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((row) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 500, color: 'var(--text-dark)' }}>{row.full_name}</td>
                        <td>{row.lrn}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{formatDateTime(row.deleted_at)}</td>
                        <td>
                          <button type="button" className="btn-restore" onClick={() => void handleRestore('students', row.id)}>
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'parents' && (
              <table className="data-table" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th>Parent Name</th>
                    <th>Student Name</th>
                    <th>Deleted At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParents.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No deleted parents found.
                      </td>
                    </tr>
                  ) : (
                    filteredParents.map((row) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 500, color: 'var(--text-dark)' }}>{row.full_name}</td>
                        <td>{row.student_name ?? 'Unknown'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{formatDateTime(row.deleted_at)}</td>
                        <td>
                          <button type="button" className="btn-restore" onClick={() => void handleRestore('parents', row.id)}>
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'assessments' && (
              <table className="data-table" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th>Record No.</th>
                    <th>Student Name</th>
                    <th>Deleted At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssessments.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No deleted assessments found.
                      </td>
                    </tr>
                  ) : (
                    filteredAssessments.map((row) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 500, color: 'var(--text-dark)' }}>{row.record_number}</td>
                        <td>{row.student_name ?? 'Unknown'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{formatDateTime(row.deleted_at)}</td>
                        <td>
                          <button type="button" className="btn-restore" onClick={() => void handleRestore('assessment_records', row.id)}>
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'cases' && (
              <table className="data-table" style={{ minWidth: 'max-content' }}>
                <thead>
                  <tr>
                    <th>Case No.</th>
                    <th>Student Name</th>
                    <th>Deleted At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCases.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No deleted cases found.
                      </td>
                    </tr>
                  ) : (
                    filteredCases.map((row) => (
                      <tr key={row.id}>
                        <td style={{ fontWeight: 500, color: 'var(--text-dark)' }}>{row.case_number}</td>
                        <td>{row.student_names || 'Unknown'}</td>
                        <td style={{ color: 'var(--text-muted)' }}>{formatDateTime(row.deleted_at)}</td>
                        <td>
                          <button type="button" className="btn-restore" onClick={() => void handleRestore('case_register', row.id)}>
                            Restore
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </>
  );
}

