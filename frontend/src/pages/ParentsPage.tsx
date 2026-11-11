import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExportIcon, FilterIcon } from '../components/Icons';
import { Modal } from '../components/Modal';
import { SearchableSelect } from '../components/SearchableSelect';
import { emptyParentInput } from '../components/students/LearnerFormFields';
import { ViewLearnerModal } from '../components/students/ViewLearnerModal';
import { useGlobalSearch } from '../context/SearchContext';
import { formatShortDate, truncateText } from '../lib/formatters';
import { exportTableToPDF } from '../lib/pdfExport';
import { softDeleteRecord } from '../services/archiveService';
import {
  createParentsForStudent,
  fetchActiveParents,
  fetchParentById,
  updateParentRecord,
} from '../services/parentsService';
import { fetchAllStudentsSummary, fetchLearnerDetails } from '../services/studentsService';
import type { LearnerFullDetails, ParentInput, ParentRecord, ParentType, Student } from '../types/database';

export function ParentsPage() {
  const { searchQuery } = useGlobalSearch();

  const [parents, setParents] = useState<ParentRecord[]>([]);
  const [students, setStudents] = useState<Pick<Student, 'id' | 'full_name' | 'lrn'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [filterRelation, setFilterRelation] = useState('');

  // Add Parent Modal
  const [addOpen, setAddOpen] = useState(false);
  const [addStudentId, setAddStudentId] = useState('');
  const [p1, setP1] = useState<ParentInput>(emptyParentInput);
  const [p2, setP2] = useState<ParentInput>(emptyParentInput);
  const [addSaving, setAddSaving] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Parent Modal
  const [editId, setEditId] = useState<number | null>(null);
  const [editStudentId, setEditStudentId] = useState('');
  const [editParentType, setEditParentType] = useState<ParentType>('Primary');
  const [editForm, setEditForm] = useState<ParentInput>(emptyParentInput);
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Linked learner quick view
  const [viewLearner, setViewLearner] = useState<LearnerFullDetails | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [parentsList, studentList] = await Promise.all([
        fetchActiveParents(),
        fetchAllStudentsSummary(),
      ]);
      setParents(parentsList);
      setStudents(studentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load parent records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const studentOptions = useMemo(
    () =>
      students.map((s) => ({
        value: String(s.id),
        label: `${s.full_name ?? 'Unknown'} (LRN: ${s.lrn ?? 'N/A'})`,
      })),
    [students]
  );

  const displayedParents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return parents.filter((p) => {
      if (filterType && p.parent_type.toLowerCase() !== filterType.toLowerCase()) {
        return false;
      }
      if (filterRelation && !(p.relationship ?? '').toLowerCase().includes(filterRelation.toLowerCase())) {
        return false;
      }
      if (!q) return true;
      const hay = [
        p.full_name,
        p.student_name,
        p.relationship,
        p.parent_type,
        p.mobile_number,
        p.email_address,
        p.home_address,
        p.workplace_address,
        p.emergency_contact_number,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [parents, searchQuery, filterType, filterRelation]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStudentId || !p1.full_name.trim()) {
      setAddMsg({ type: 'error', text: 'Please select a learner and provide at least the primary parent name.' });
      return;
    }
    setAddSaving(true);
    setAddMsg(null);
    try {
      await createParentsForStudent(Number(addStudentId), p1, p2);
      setAddMsg({ type: 'success', text: 'Parent/Guardian record successfully saved!' });
      await loadData();
      setTimeout(() => {
        setAddOpen(false);
        setAddMsg(null);
        setAddStudentId('');
        setP1(emptyParentInput());
        setP2(emptyParentInput());
      }, 900);
    } catch (err) {
      setAddMsg({ type: 'error', text: err instanceof Error ? err.message : 'Unable to save parent record.' });
    } finally {
      setAddSaving(false);
    }
  };

  const handleOpenEdit = async (id: number) => {
    try {
      const parent = await fetchParentById(id);
      setEditId(parent.id);
      setEditStudentId(String(parent.student_id));
      setEditParentType(parent.parent_type);
      setEditForm({
        id: parent.id,
        full_name: parent.full_name ?? '',
        relationship: parent.relationship ?? '',
        mobile_number: parent.mobile_number ?? '',
        telephone_number: parent.telephone_number ?? '',
        email_address: parent.email_address ?? '',
        home_address: parent.home_address ?? '',
        workplace: parent.workplace ?? '',
        workplace_address: parent.workplace_address ?? '',
        emergency_contact_number: parent.emergency_contact_number ?? '',
      });
      setEditMsg(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not fetch parent details.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId === null || !editStudentId || !editForm.full_name.trim()) {
      setEditMsg({ type: 'error', text: 'Please provide the learner, parent name, and required fields.' });
      return;
    }
    setEditSaving(true);
    setEditMsg(null);
    try {
      await updateParentRecord(editId, {
        student_id: Number(editStudentId),
        parent_type: editParentType,
        full_name: editForm.full_name,
        relationship: editForm.relationship,
        mobile_number: editForm.mobile_number,
        home_address: editForm.home_address,
        telephone_number: editForm.telephone_number,
        email_address: editForm.email_address,
        workplace: editForm.workplace,
        workplace_address: editForm.workplace_address,
        emergency_contact_number: editForm.emergency_contact_number,
      });
      setEditMsg({ type: 'success', text: 'Parent/Guardian record successfully updated!' });
      await loadData();
      setTimeout(() => {
        setEditId(null);
        setEditMsg(null);
      }, 900);
    } catch (err) {
      setEditMsg({ type: 'error', text: err instanceof Error ? err.message : 'Unable to update parent record.' });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (editId === null) return;
    if (!window.confirm('Are you sure you want to move this record to the trash? It can be restored from the Deleted Records page.')) {
      return;
    }
    try {
      await softDeleteRecord('parents', editId);
      setEditId(null);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to delete record.');
    }
  };

  const handleExport = () => {
    exportTableToPDF({
      filename: 'parents.pdf',
      headers: [
        'Parent / Guardian',
        'Linked Learner',
        'Relationship',
        'Type',
        'Mobile Number',
        'Email Address',
        'Home Address',
        'Workplace Address',
        'Emergency Contact',
        'Registered',
      ],
      rows: displayedParents.map((p) => [
        p.full_name,
        p.student_name ?? 'Unknown',
        p.relationship,
        p.parent_type,
        p.mobile_number,
        p.email_address || 'N/A',
        p.home_address || 'N/A',
        p.workplace_address || 'N/A',
        p.emergency_contact_number || 'N/A',
        formatShortDate(p.created_at),
      ]),
    });
  };

  return (
    <>
      <div className="page-header-container">
        <h1 className="page-title">Parents</h1>
        <div className="page-controls">
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Showing <strong id="showing-counter" style={{ color: 'var(--text-dark)' }}>{displayedParents.length}</strong>
          </span>
          <button type="button" className="control-btn" onClick={() => setShowFilters((f) => !f)}>
            <FilterIcon /> Filter
          </button>
          <button type="button" className="control-btn" onClick={handleExport}>
            <ExportIcon /> Export
          </button>
          <button
            type="button"
            className="control-btn btn-primary"
            onClick={() => {
              setAddMsg(null);
              setAddOpen(true);
            }}
          >
            + Add New Parent
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filter-panel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Type</label>
            <select
              className="form-control"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{ minWidth: '150px' }}
            >
              <option value="">All</option>
              <option value="Primary">Primary</option>
              <option value="Secondary">Secondary</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Relationship</label>
            <input
              type="text"
              className="form-control"
              placeholder="E.g. Mother..."
              value={filterRelation}
              onChange={(e) => setFilterRelation(e.target.value)}
              style={{ minWidth: '150px' }}
            />
          </div>
        </div>
      )}

      {error && <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="content-card">
        <div className="table-responsive">
          <table className="data-table" id="dataTable" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th>Parent / Guardian</th>
                <th>Linked Learner</th>
                <th>Relationship</th>
                <th>Type</th>
                <th>Mobile Number</th>
                <th>Email Address</th>
                <th>Home Address</th>
                <th>Workplace Address</th>
                <th>Emergency Contact</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    Loading...
                  </td>
                </tr>
              ) : displayedParents.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No active parents found.
                  </td>
                </tr>
              ) : (
                displayedParents.map((parent) => (
                  <tr key={parent.id}>
                    <td style={{ fontWeight: 500, color: 'var(--text-dark)' }}>{parent.full_name}</td>
                    <td>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const details = await fetchLearnerDetails(parent.student_id);
                            setViewLearner(details);
                          } catch {
                            // Ignore if parent linked to missing student
                          }
                        }}
                        style={{
                          color: 'var(--primary)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 500,
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                        }}
                      >
                        {parent.student_name ?? 'Unknown'}
                      </button>
                    </td>
                    <td>{parent.relationship}</td>
                    <td>
                      <span
                        className="status-pill"
                        style={
                          parent.parent_type === 'Primary'
                            ? { background: '#dcfce7', color: '#166534' }
                            : { background: '#f1f5f9', color: '#475569' }
                        }
                      >
                        {parent.parent_type}
                      </span>
                    </td>
                    <td>{parent.mobile_number}</td>
                    <td>{parent.email_address || 'N/A'}</td>
                    <td>{truncateText(parent.home_address || 'N/A', 30)}</td>
                    <td>{truncateText(parent.workplace_address || 'N/A', 30)}</td>
                    <td style={{ color: '#b91c1c', fontWeight: 500 }}>
                      {parent.emergency_contact_number || 'N/A'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatShortDate(parent.created_at)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => void handleOpenEdit(parent.id)}
                        style={{
                          background: '#f1f5f9',
                          color: 'var(--primary)',
                          border: '1px solid #cbd5e1',
                          padding: '0.25rem 0.75rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Parent Modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add New Parent / Guardian">
        <form onSubmit={handleCreateSubmit}>
          <div className="form-group full-width" style={{ marginBottom: '1.25rem' }}>
            <label htmlFor="add_parent_student">Link to Learner</label>
            <SearchableSelect
              id="add_parent_student"
              options={studentOptions}
              value={addStudentId}
              onChange={setAddStudentId}
              placeholder="-- Select a learner --"
              required
            />
          </div>

          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)', marginBottom: '1rem' }}>
            Primary Parent / Guardian
          </h4>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Full Name</label>
              <input type="text" className="form-control" required value={p1.full_name} onChange={(e) => setP1({ ...p1, full_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Relationship</label>
              <input type="text" className="form-control" required value={p1.relationship} onChange={(e) => setP1({ ...p1, relationship: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Mobile Number</label>
              <input type="text" className="form-control" required value={p1.mobile_number} onChange={(e) => setP1({ ...p1, mobile_number: e.target.value })} />
            </div>
            <div className="form-group full-width">
              <label>Home Address</label>
              <textarea className="form-control" required value={p1.home_address} onChange={(e) => setP1({ ...p1, home_address: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Telephone</label>
              <input type="text" className="form-control" value={p1.telephone_number} onChange={(e) => setP1({ ...p1, telephone_number: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" className="form-control" value={p1.email_address} onChange={(e) => setP1({ ...p1, email_address: e.target.value })} />
            </div>
            <div className="form-group full-width">
              <label>Workplace</label>
              <input type="text" className="form-control" value={p1.workplace} onChange={(e) => setP1({ ...p1, workplace: e.target.value })} />
            </div>
            <div className="form-group full-width">
              <label>Workplace Address</label>
              <textarea className="form-control" value={p1.workplace_address} onChange={(e) => setP1({ ...p1, workplace_address: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Emergency Contact</label>
              <input type="text" className="form-control" required value={p1.emergency_contact_number} onChange={(e) => setP1({ ...p1, emergency_contact_number: e.target.value })} />
            </div>
          </div>

          <hr style={{ margin: '1.5rem 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
          <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Secondary Parent / Guardian <span style={{ fontWeight: 400 }}>(Optional)</span>
          </h4>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Full Name</label>
              <input type="text" className="form-control" value={p2.full_name} onChange={(e) => setP2({ ...p2, full_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Relationship</label>
              <input type="text" className="form-control" value={p2.relationship} onChange={(e) => setP2({ ...p2, relationship: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Mobile Number</label>
              <input type="text" className="form-control" value={p2.mobile_number} onChange={(e) => setP2({ ...p2, mobile_number: e.target.value })} />
            </div>
            <div className="form-group full-width">
              <label>Home Address</label>
              <textarea className="form-control" value={p2.home_address} onChange={(e) => setP2({ ...p2, home_address: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Telephone</label>
              <input type="text" className="form-control" value={p2.telephone_number} onChange={(e) => setP2({ ...p2, telephone_number: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" className="form-control" value={p2.email_address} onChange={(e) => setP2({ ...p2, email_address: e.target.value })} />
            </div>
            <div className="form-group full-width">
              <label>Workplace</label>
              <input type="text" className="form-control" value={p2.workplace} onChange={(e) => setP2({ ...p2, workplace: e.target.value })} />
            </div>
            <div className="form-group full-width">
              <label>Workplace Address</label>
              <textarea className="form-control" value={p2.workplace_address} onChange={(e) => setP2({ ...p2, workplace_address: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Emergency Contact</label>
              <input type="text" className="form-control" value={p2.emergency_contact_number} onChange={(e) => setP2({ ...p2, emergency_contact_number: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '1.5rem' }}>
            {addMsg && (
              <div className={addMsg.type === 'success' ? 'msg-success' : 'msg-error'} style={{ flex: 1 }}>
                {addMsg.text}
              </div>
            )}
            <button type="button" className="btn-cancel" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={addSaving}>
              {addSaving ? 'Saving...' : 'Save Parent Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Parent Modal */}
      <Modal isOpen={editId !== null} onClose={() => setEditId(null)} title="Edit Parent Record">
        <form onSubmit={handleEditSubmit}>
          <div className="form-section">
            <div className="form-group full-width">
              <label>Linked Learner</label>
              <SearchableSelect
                options={studentOptions}
                value={editStudentId}
                onChange={setEditStudentId}
                required
              />
            </div>
          </div>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Parent Type</label>
              <select
                className="form-control"
                value={editParentType}
                onChange={(e) => setEditParentType(e.target.value as ParentType)}
                required
              >
                <option value="Primary">Primary</option>
                <option value="Secondary">Secondary</option>
              </select>
            </div>
            <div className="form-group full-width">
              <label>Full Name</label>
              <input type="text" className="form-control" required value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Relationship to Learner</label>
              <input type="text" className="form-control" required value={editForm.relationship} onChange={(e) => setEditForm({ ...editForm, relationship: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Mobile Number</label>
              <input type="text" className="form-control" required value={editForm.mobile_number} onChange={(e) => setEditForm({ ...editForm, mobile_number: e.target.value })} />
            </div>
            <div className="form-group full-width">
              <label>Home Address</label>
              <textarea className="form-control" required value={editForm.home_address} onChange={(e) => setEditForm({ ...editForm, home_address: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Telephone Number</label>
              <input type="text" className="form-control" value={editForm.telephone_number} onChange={(e) => setEditForm({ ...editForm, telephone_number: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" className="form-control" value={editForm.email_address} onChange={(e) => setEditForm({ ...editForm, email_address: e.target.value })} />
            </div>
            <div className="form-group full-width">
              <label>Workplace</label>
              <input type="text" className="form-control" value={editForm.workplace} onChange={(e) => setEditForm({ ...editForm, workplace: e.target.value })} />
            </div>
            <div className="form-group full-width">
              <label>Workplace Address</label>
              <textarea className="form-control" value={editForm.workplace_address} onChange={(e) => setEditForm({ ...editForm, workplace_address: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Emergency Contact Number</label>
              <input type="text" className="form-control" required value={editForm.emergency_contact_number} onChange={(e) => setEditForm({ ...editForm, emergency_contact_number: e.target.value })} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {editMsg && (
              <div className={editMsg.type === 'success' ? 'msg-success' : 'msg-error'} style={{ flex: 1 }}>
                {editMsg.text}
              </div>
            )}
            <button type="button" className="btn-delete-soft" onClick={() => void handleDelete()}>
              Delete Record
            </button>
            <button type="submit" className="submit-btn" disabled={editSaving}>
              {editSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      <ViewLearnerModal learner={viewLearner} onClose={() => setViewLearner(null)} />
    </>
  );
}

