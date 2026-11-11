import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExportIcon, FilterIcon } from '../components/Icons';
import { Modal } from '../components/Modal';
import { SearchableSelect } from '../components/SearchableSelect';
import { useGlobalSearch } from '../context/SearchContext';
import {
  ALLOWED_GRADES,
  ASSESSMENT_SCHOOL_YEARS,
  DIAGNOSIS_OPTIONS,
  getCurrentAcademicYear,
} from '../lib/constants';
import { formatShortDate, getTodayIsoDate, truncateText } from '../lib/formatters';
import { exportTableToPDF } from '../lib/pdfExport';
import { softDeleteRecord } from '../services/archiveService';
import {
  createAssessment,
  fetchActiveAssessments,
  fetchAssessmentById,
  fetchNextAssessmentNumber,
  updateAssessment,
  type AssessmentInput,
} from '../services/assessmentsService';
import {
  fetchAllStudentsSummary,
  fetchSectionsWithStudentsByGrade,
  fetchStudentsBySection,
} from '../services/studentsService';
import type { AssessmentRecord, Student, StudentDrillItem } from '../types/database';

const KNOWN_DIAGNOSES = ['GDD', 'IDD', 'ADHD', 'Autism'];

function emptyAssessmentInput(recordNumber = 'AES-AR-001'): AssessmentInput {
  return {
    student_id: 0,
    record_number: recordNumber,
    school_year: getCurrentAcademicYear(),
    date: getTodayIsoDate(),
    grade_section: '',
    contact_number: '',
    status: '',
    assessment_provider: '',
    findings: '',
    diagnosis: '',
    recommendations: '',
  };
}

export function AssessmentsPage() {
  const { searchQuery } = useGlobalSearch();

  const [assessments, setAssessments] = useState<AssessmentRecord[]>([]);
  const [students, setStudents] = useState<Pick<Student, 'id' | 'full_name' | 'lrn'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showFilters, setShowFilters] = useState(false);
  const [filterSchoolYear, setFilterSchoolYear] = useState('all');
  const [filterStatus, setFilterStatus] = useState('');

  // Add Modal State (2-step drill-down)
  const [addOpen, setAddOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [drillGrade, setDrillGrade] = useState('');
  const [drillSections, setDrillSections] = useState<string[]>([]);
  const [drillSection, setDrillSection] = useState('');
  const [drillStudents, setDrillStudents] = useState<StudentDrillItem[]>([]);
  const [drillSearch, setDrillSearch] = useState('');
  const [selectedStudentName, setSelectedStudentName] = useState('');
  const [addForm, setAddForm] = useState<AssessmentInput>(() => emptyAssessmentInput());
  const [addDiagSelect, setAddDiagSelect] = useState('');
  const [addDiagOther, setAddDiagOther] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Modal State
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<AssessmentInput>(() => emptyAssessmentInput());
  const [editDiagSelect, setEditDiagSelect] = useState('');
  const [editDiagOther, setEditDiagOther] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, studentList] = await Promise.all([
        fetchActiveAssessments(),
        fetchAllStudentsSummary(),
      ]);
      setAssessments(rows);
      setStudents(studentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load assessment records.');
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

  const displayedAssessments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assessments.filter((a) => {
      if (filterSchoolYear !== 'all' && (a.school_year ?? '').toLowerCase() !== filterSchoolYear.toLowerCase()) {
        return false;
      }
      if (filterStatus && !(a.status ?? '').toLowerCase().includes(filterStatus.toLowerCase())) {
        return false;
      }
      if (!q) return true;
      const hay = [
        a.record_number,
        a.student_name,
        a.school_year,
        a.grade_section,
        a.contact_number,
        a.status,
        a.assessment_provider,
        a.findings,
        a.diagnosis,
        a.recommendations,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [assessments, searchQuery, filterSchoolYear, filterStatus]);

  const filteredDrillStudents = useMemo(() => {
    const q = drillSearch.trim().toLowerCase();
    if (!q) return drillStudents;
    return drillStudents.filter(
      (s) =>
        (s.full_name ?? '').toLowerCase().includes(q) ||
        (s.lrn ?? '').toLowerCase().includes(q)
    );
  }, [drillStudents, drillSearch]);

  const openAddModal = async () => {
    setAddStep(1);
    setDrillGrade('');
    setDrillSections([]);
    setDrillSection('');
    setDrillStudents([]);
    setDrillSearch('');
    setSelectedStudentName('');
    setAddDiagSelect('');
    setAddDiagOther('');
    setAddMsg(null);

    let nextNumber = 'AES-AR-001';
    try {
      nextNumber = await fetchNextAssessmentNumber();
    } catch {
      // Fallback handled on server or manually
    }
    setAddForm(emptyAssessmentInput(nextNumber));
    setAddOpen(true);
  };

  const handleDrillGradeChange = async (grade: string) => {
    setDrillGrade(grade);
    setDrillSection('');
    setDrillSections([]);
    setDrillStudents([]);
    if (!grade) return;

    if (grade === 'Graduates') {
      setDrillSection('ALL_GRADUATES');
      try {
        const list = await fetchStudentsBySection('Graduates', 'ALL_GRADUATES');
        setDrillStudents(list);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Unable to load graduates.');
      }
      return;
    }

    try {
      const secs = await fetchSectionsWithStudentsByGrade(grade);
      if (secs.length === 0) {
        alert('No sections found for this grade.');
      }
      setDrillSections(secs);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to load sections.');
    }
  };

  const handleDrillSectionChange = async (section: string) => {
    setDrillSection(section);
    setDrillStudents([]);
    if (!section || !drillGrade) return;
    try {
      const list = await fetchStudentsBySection(drillGrade, section);
      setDrillStudents(list);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to load students.');
    }
  };

  const handleSelectDrillStudent = (student: StudentDrillItem) => {
    setSelectedStudentName(student.full_name ?? '');
    setAddForm((prev) => ({
      ...prev,
      student_id: student.id,
      grade_section: `${drillGrade} - ${drillSection}`,
      status: student.status ?? '',
      contact_number: student.contact_number ?? '',
      school_year: student.school_year || prev.school_year,
    }));
    setAddStep(2);
  };

  const handleAddDiagChange = (val: string) => {
    setAddDiagSelect(val);
    if (val === 'Other') {
      setAddForm((prev) => ({ ...prev, diagnosis: addDiagOther }));
    } else {
      setAddDiagOther('');
      setAddForm((prev) => ({ ...prev, diagnosis: val }));
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSaving(true);
    setAddMsg(null);
    try {
      await createAssessment(addForm);
      setAddMsg({ type: 'success', text: 'Assessment record successfully saved!' });
      await loadData();
      setTimeout(() => {
        setAddOpen(false);
        setAddMsg(null);
      }, 900);
    } catch (err) {
      setAddMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save assessment record.',
      });
    } finally {
      setAddSaving(false);
    }
  };

  const handleOpenEdit = async (id: number) => {
    try {
      const rec = await fetchAssessmentById(id);
      setEditId(rec.id);
      const diag = rec.diagnosis ?? '';
      if (KNOWN_DIAGNOSES.includes(diag)) {
        setEditDiagSelect(diag);
        setEditDiagOther('');
      } else if (diag === '') {
        setEditDiagSelect('');
        setEditDiagOther('');
      } else {
        setEditDiagSelect('Other');
        setEditDiagOther(diag);
      }
      setEditForm({
        student_id: rec.student_id,
        record_number: rec.record_number ?? '',
        school_year: rec.school_year ?? 'Unknown/Not Indicated',
        date: rec.date ?? '',
        grade_section: rec.grade_section ?? '',
        contact_number: rec.contact_number ?? '',
        status: rec.status ?? '',
        assessment_provider: rec.assessment_provider ?? '',
        findings: rec.findings ?? '',
        diagnosis: diag,
        recommendations: rec.recommendations ?? '',
      });
      setEditMsg(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not fetch assessment details.');
    }
  };

  const handleEditDiagChange = (val: string) => {
    setEditDiagSelect(val);
    if (val === 'Other') {
      setEditForm((prev) => ({ ...prev, diagnosis: editDiagOther }));
    } else {
      setEditDiagOther('');
      setEditForm((prev) => ({ ...prev, diagnosis: val }));
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId === null) return;
    setEditSaving(true);
    setEditMsg(null);
    try {
      await updateAssessment(editId, editForm);
      setEditMsg({ type: 'success', text: 'Assessment record successfully updated!' });
      await loadData();
      setTimeout(() => {
        setEditId(null);
        setEditMsg(null);
      }, 900);
    } catch (err) {
      setEditMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to update assessment record.',
      });
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
      await softDeleteRecord('assessment_records', editId);
      setEditId(null);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to delete record.');
    }
  };

  const handleExport = () => {
    exportTableToPDF({
      filename: 'assessments.pdf',
      headers: [
        'Record No.',
        'Student Name',
        'Date',
        'School Year',
        'Grade & Section',
        'Parent Contact Number',
        'Status',
        'Provider',
        'Findings',
        'Diagnosis',
        'Recommendations',
      ],
      rows: displayedAssessments.map((r) => [
        r.record_number,
        r.student_name ?? 'Unknown',
        formatShortDate(r.date),
        r.school_year,
        r.grade_section,
        r.contact_number,
        r.status,
        r.assessment_provider,
        r.findings,
        r.diagnosis,
        r.recommendations,
      ]),
    });
  };

  return (
    <>
      <div className="page-header-container">
        <h1 className="page-title">Assessments</h1>
        <div className="page-controls">
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Showing <strong id="showing-counter" style={{ color: 'var(--text-dark)' }}>{displayedAssessments.length}</strong>
          </span>
          <button type="button" className="control-btn" onClick={() => setShowFilters((f) => !f)}>
            <FilterIcon /> Filter
          </button>
          <button type="button" className="control-btn" onClick={handleExport}>
            <ExportIcon /> Export
          </button>
          <button type="button" className="control-btn btn-primary" onClick={() => void openAddModal()}>
            + Add New Assessment
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filter-panel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>School Year</label>
            <select
              className="form-control"
              value={filterSchoolYear}
              onChange={(e) => setFilterSchoolYear(e.target.value)}
              style={{ minWidth: '150px' }}
            >
              <option value="all">All School Years</option>
              {ASSESSMENT_SCHOOL_YEARS.filter((sy) => sy !== 'Unknown/Not Indicated').map((sy) => (
                <option key={sy} value={sy}>
                  {sy}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status</label>
            <input
              type="text"
              className="form-control"
              placeholder="Type status..."
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
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
                <th>Record No.</th>
                <th>Student Name</th>
                <th>Date</th>
                <th>School Year</th>
                <th>Grade &amp; Section</th>
                <th>Parent Contact Number</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Findings</th>
                <th>Diagnosis</th>
                <th>Recommendations</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    Loading...
                  </td>
                </tr>
              ) : displayedAssessments.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No assessment records found.
                  </td>
                </tr>
              ) : (
                displayedAssessments.map((record) => (
                  <tr
                    key={record.id}
                    className="clickable-row"
                    onClick={() => void handleOpenEdit(record.id)}
                  >
                    <td style={{ color: 'var(--text-muted)' }}>{record.record_number}</td>
                    <td style={{ fontWeight: 500, color: 'var(--text-dark)' }}>
                      {record.student_name ?? 'Unknown'}
                    </td>
                    <td>{formatShortDate(record.date)}</td>
                    <td>{record.school_year}</td>
                    <td>{record.grade_section}</td>
                    <td>{record.contact_number}</td>
                    <td>{record.status}</td>
                    <td>{record.assessment_provider}</td>
                    <td>{truncateText(record.findings, 30)}</td>
                    <td>{truncateText(record.diagnosis, 30)}</td>
                    <td>{truncateText(record.recommendations, 30)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Assessment Modal (2-Step Drill-Down) */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add New Assessment Record"
        maxWidth="1000px"
      >
        {addStep === 1 ? (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Select Grade Level
              </label>
              <select
                className="form-control"
                value={drillGrade}
                onChange={(e) => void handleDrillGradeChange(e.target.value)}
              >
                <option value="">-- Select Grade --</option>
                {ALLOWED_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value="Graduates">Graduates</option>
              </select>
            </div>

            {drillGrade && drillGrade !== 'Graduates' && drillSections.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                  Select Section
                </label>
                <select
                  className="form-control"
                  value={drillSection}
                  onChange={(e) => void handleDrillSectionChange(e.target.value)}
                >
                  <option value="">-- Select Section --</option>
                  {drillSections.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {drillSection && (
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select Student</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search name or LRN..."
                    value={drillSearch}
                    onChange={(e) => setDrillSearch(e.target.value)}
                    style={{ width: '220px', padding: '0.35rem 0.65rem', fontSize: '0.85rem' }}
                  />
                </div>
                <div
                  style={{
                    display: 'grid',
                    gap: '0.5rem',
                    maxHeight: '250px',
                    overflowY: 'auto',
                    padding: '0.5rem',
                    border: '1px solid var(--border-light)',
                    borderRadius: '6px',
                    background: '#f8fafc',
                  }}
                >
                  {filteredDrillStudents.length === 0 ? (
                    <div style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>
                      No students found in this section.
                    </div>
                  ) : (
                    filteredDrillStudents.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => handleSelectDrillStudent(s)}
                        style={{
                          padding: '0.5rem',
                          background: '#fff',
                          border: '1px solid var(--border-light)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span>
                          <strong>{s.full_name}</strong>{' '}
                          <small style={{ color: 'var(--text-muted)' }}>(LRN: {s.lrn})</small>
                        </span>
                        <button
                          type="button"
                          style={{
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '0.25rem 0.6rem',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                          }}
                        >
                          Select
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleCreateSubmit}>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Student Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={selectedStudentName}
                  readOnly
                  style={{ background: '#f1f5f9', fontWeight: 600 }}
                />
              </div>
              <div className="form-group">
                <label htmlFor="add_record_number">Record Number</label>
                <input
                  type="text"
                  id="add_record_number"
                  className="form-control"
                  value={addForm.record_number}
                  readOnly
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="add_sy">School Year</label>
                <select
                  id="add_sy"
                  className="form-control"
                  value={addForm.school_year}
                  onChange={(e) => setAddForm({ ...addForm, school_year: e.target.value })}
                  required
                >
                  {ASSESSMENT_SCHOOL_YEARS.map((sy) => (
                    <option key={sy} value={sy}>
                      {sy}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="add_date">Date</label>
                <input
                  type="date"
                  id="add_date"
                  className="form-control"
                  value={addForm.date}
                  onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Grade &amp; Section</label>
                <input
                  type="text"
                  className="form-control"
                  value={addForm.grade_section}
                  readOnly
                  style={{ background: '#f1f5f9' }}
                />
              </div>
              <div className="form-group">
                <label>Parent Contact Number</label>
                <input
                  type="text"
                  className="form-control"
                  value={addForm.contact_number}
                  onChange={(e) => setAddForm({ ...addForm, contact_number: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <input
                  type="text"
                  className="form-control"
                  value={addForm.status}
                  onChange={(e) => setAddForm({ ...addForm, status: e.target.value })}
                />
              </div>
              <div className="form-group full-width">
                <label>Assessment Provider</label>
                <input
                  type="text"
                  className="form-control"
                  value={addForm.assessment_provider}
                  onChange={(e) => setAddForm({ ...addForm, assessment_provider: e.target.value })}
                />
              </div>
              <div className="form-group full-width">
                <label>Findings</label>
                <textarea
                  className="form-control"
                  value={addForm.findings}
                  onChange={(e) => setAddForm({ ...addForm, findings: e.target.value })}
                />
              </div>
              <div className="form-group full-width">
                <label>Diagnosis</label>
                <select
                  className="form-control"
                  value={addDiagSelect}
                  onChange={(e) => handleAddDiagChange(e.target.value)}
                >
                  <option value="">-- Select Diagnosis --</option>
                  {DIAGNOSIS_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {addDiagSelect === 'Other' && (
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Please specify diagnosis"
                    style={{ marginTop: '0.5rem' }}
                    value={addDiagOther}
                    onChange={(e) => {
                      setAddDiagOther(e.target.value);
                      setAddForm((prev) => ({ ...prev, diagnosis: e.target.value }));
                    }}
                  />
                )}
              </div>
              <div className="form-group full-width">
                <label>Recommendations</label>
                <textarea
                  className="form-control"
                  value={addForm.recommendations}
                  onChange={(e) => setAddForm({ ...addForm, recommendations: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="submit-btn"
                style={{ background: '#94a3b8', color: 'white' }}
                onClick={() => setAddStep(1)}
              >
                Back to Selection
              </button>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flex: 1, justifyContent: 'flex-end' }}>
                {addMsg && (
                  <div className={addMsg.type === 'success' ? 'msg-success' : 'msg-error'}>
                    {addMsg.text}
                  </div>
                )}
                <button type="submit" className="submit-btn" disabled={addSaving}>
                  {addSaving ? 'Saving...' : 'Save Record'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* Edit Assessment Modal */}
      <Modal
        isOpen={editId !== null}
        onClose={() => setEditId(null)}
        title="Edit Assessment Record"
        maxWidth="1000px"
      >
        <form onSubmit={handleEditSubmit}>
          <div className="form-group full-width" style={{ marginBottom: '1.5rem' }}>
            <label>Student Name</label>
            <SearchableSelect
              options={studentOptions}
              value={String(editForm.student_id || '')}
              onChange={(val) => setEditForm({ ...editForm, student_id: Number(val) })}
              required
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Record Number</label>
              <input type="text" className="form-control" value={editForm.record_number} readOnly required />
            </div>
            <div className="form-group">
              <label>School Year</label>
              <select
                className="form-control"
                value={editForm.school_year}
                onChange={(e) => setEditForm({ ...editForm, school_year: e.target.value })}
                required
              >
                {editForm.school_year && !ASSESSMENT_SCHOOL_YEARS.includes(editForm.school_year) && (
                  <option value={editForm.school_year}>{editForm.school_year}</option>
                )}
                {ASSESSMENT_SCHOOL_YEARS.map((sy) => (
                  <option key={sy} value={sy}>
                    {sy}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                className="form-control"
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Grade &amp; Section</label>
              <input
                type="text"
                className="form-control"
                value={editForm.grade_section}
                onChange={(e) => setEditForm({ ...editForm, grade_section: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Parent Contact Number</label>
              <input
                type="text"
                className="form-control"
                value={editForm.contact_number}
                onChange={(e) => setEditForm({ ...editForm, contact_number: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <input
                type="text"
                className="form-control"
                value={editForm.status}
                onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
              />
            </div>
            <div className="form-group full-width">
              <label>Assessment Provider</label>
              <input
                type="text"
                className="form-control"
                value={editForm.assessment_provider}
                onChange={(e) => setEditForm({ ...editForm, assessment_provider: e.target.value })}
              />
            </div>
            <div className="form-group full-width">
              <label>Findings</label>
              <textarea
                className="form-control"
                value={editForm.findings}
                onChange={(e) => setEditForm({ ...editForm, findings: e.target.value })}
              />
            </div>
            <div className="form-group full-width">
              <label>Diagnosis</label>
              <select
                className="form-control"
                value={editDiagSelect}
                onChange={(e) => handleEditDiagChange(e.target.value)}
              >
                <option value="">-- Select Diagnosis --</option>
                {DIAGNOSIS_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {editDiagSelect === 'Other' && (
                <input
                  type="text"
                  className="form-control"
                  placeholder="Please specify diagnosis"
                  style={{ marginTop: '0.5rem' }}
                  value={editDiagOther}
                  onChange={(e) => {
                    setEditDiagOther(e.target.value);
                    setEditForm((prev) => ({ ...prev, diagnosis: e.target.value }));
                  }}
                />
              )}
            </div>
            <div className="form-group full-width">
              <label>Recommendations</label>
              <textarea
                className="form-control"
                value={editForm.recommendations}
                onChange={(e) => setEditForm({ ...editForm, recommendations: e.target.value })}
              />
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
    </>
  );
}

