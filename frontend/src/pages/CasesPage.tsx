import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ExportIcon, FilterIcon } from '../components/Icons';
import { Modal } from '../components/Modal';
import { MultiSearchableSelect, SearchableSelect } from '../components/SearchableSelect';
import { useGlobalSearch } from '../context/SearchContext';
import {
  ASSESSMENT_SCHOOL_YEARS,
  CASE_TYPE_OPTIONS,
  getCurrentAcademicYear,
  OUTCOME_DISPOSITION_OPTIONS,
} from '../lib/constants';
import { formatShortDate, getTodayIsoDate, truncateText } from '../lib/formatters';
import { exportTableToPDF } from '../lib/pdfExport';
import { softDeleteRecord } from '../services/archiveService';
import {
  createCase,
  fetchActiveCases,
  fetchCaseById,
  fetchNextCaseNumber,
  updateCase,
} from '../services/casesService';
import { fetchAllStudentsSummary } from '../services/studentsService';
import type { CaseRecord, Student } from '../types/database';

const STANDARD_CASE_TYPES: string[] = CASE_TYPE_OPTIONS.filter((t) => t !== 'Other');
const STANDARD_OUTCOMES: string[] = OUTCOME_DISPOSITION_OPTIONS.filter((o) => o !== 'Other');

export function CasesPage() {
  const { searchQuery } = useGlobalSearch();

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [students, setStudents] = useState<Pick<Student, 'id' | 'full_name' | 'lrn'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showFilters, setShowFilters] = useState(false);
  const [filterSchoolYear, setFilterSchoolYear] = useState('all');
  const [filterCaseType, setFilterCaseType] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('');

  // Add Case Modal (2-step)
  const [addOpen, setAddOpen] = useState(false);
  const [addStep, setAddStep] = useState<1 | 2>(1);
  const [numStudents, setNumStudents] = useState(1);
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>(['']);
  const [addCaseNumber, setAddCaseNumber] = useState('AES-CR-001');
  const [addSchoolYear, setAddSchoolYear] = useState(getCurrentAcademicYear());
  const [addDate, setAddDate] = useState(getTodayIsoDate());
  const [addCaseType, setAddCaseType] = useState<string>(CASE_TYPE_OPTIONS[0]);
  const [addCaseTypeOther, setAddCaseTypeOther] = useState('');
  const [addOutcome, setAddOutcome] = useState<string>(OUTCOME_DISPOSITION_OPTIONS[0]);
  const [addOutcomeOther, setAddOutcomeOther] = useState('');
  const [addBriefDesc, setAddBriefDesc] = useState('');
  const [addActionsTaken, setAddActionsTaken] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit Case Modal
  const [editId, setEditId] = useState<number | null>(null);
  const [editStudentIds, setEditStudentIds] = useState<string[]>([]);
  const [editCaseNumber, setEditCaseNumber] = useState('');
  const [editSchoolYear, setEditSchoolYear] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editGradeSection, setEditGradeSection] = useState('');
  const [editCaseType, setEditCaseType] = useState<string>(CASE_TYPE_OPTIONS[0]);
  const [editCaseTypeOther, setEditCaseTypeOther] = useState('');
  const [editOutcome, setEditOutcome] = useState<string>(OUTCOME_DISPOSITION_OPTIONS[0]);
  const [editOutcomeOther, setEditOutcomeOther] = useState('');
  const [editBriefDesc, setEditBriefDesc] = useState('');
  const [editActionsTaken, setEditActionsTaken] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [caseList, studentList] = await Promise.all([
        fetchActiveCases(),
        fetchAllStudentsSummary(),
      ]);
      setCases(caseList);
      setStudents(studentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load cases.');
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

  // Analytics calculations (matches cases.php:33-57)
  const analytics = useMemo(() => {
    let referred = 0;
    let closed = 0;
    let ongoing = 0;
    let followup = 0;
    let other = 0;
    const byType = new Map<string, number>();

    for (const c of cases) {
      const out = c.outcome_disposition;
      if (out === 'Referred') referred++;
      else if (out === 'Closed/Resolved') closed++;
      else if (out === 'Ongoing') ongoing++;
      else if (out === 'To Follow-Up') followup++;
      else other++;

      const t = c.case_type || 'Unknown';
      byType.set(t, (byType.get(t) ?? 0) + 1);
    }

    const sortedTypes = [...byType.entries()].sort((a, b) => b[1] - a[1]);
    return {
      total: cases.length,
      referred,
      closed,
      ongoing,
      followup,
      other,
      sortedTypes,
    };
  }, [cases]);

  const displayedCases = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cases.filter((c) => {
      if (filterSchoolYear !== 'all' && (c.school_year ?? '').toLowerCase() !== filterSchoolYear.toLowerCase()) {
        return false;
      }
      if (filterCaseType && !(c.case_type ?? '').toLowerCase().includes(filterCaseType.toLowerCase())) {
        return false;
      }
      if (filterOutcome && !(c.outcome_disposition ?? '').toLowerCase().includes(filterOutcome.toLowerCase())) {
        return false;
      }
      if (!q) return true;
      const hay = [
        c.case_number,
        c.student_names,
        c.school_year,
        c.grade_section,
        c.case_type,
        c.brief_description,
        c.actions_taken,
        c.outcome_disposition,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [cases, searchQuery, filterSchoolYear, filterCaseType, filterOutcome]);

  const filterByOutcome = (outcome: string) => {
    setFilterOutcome(outcome);
    setFilterCaseType('');
    if (outcome !== '') setShowFilters(true);
  };

  const filterByCaseType = (type: string) => {
    setFilterCaseType(type);
    setFilterOutcome('');
    if (type !== '') setShowFilters(true);
  };

  const openAddModal = async () => {
    setAddStep(1);
    setNumStudents(1);
    setSelectedSlotIds(['']);
    setAddSchoolYear(getCurrentAcademicYear());
    setAddDate(getTodayIsoDate());
    setAddCaseType(CASE_TYPE_OPTIONS[0]);
    setAddCaseTypeOther('');
    setAddOutcome(OUTCOME_DISPOSITION_OPTIONS[0]);
    setAddOutcomeOther('');
    setAddBriefDesc('');
    setAddActionsTaken('');
    setAddMsg(null);

    let nextNum = 'AES-CR-001';
    try {
      nextNum = await fetchNextCaseNumber();
    } catch {
      // Fallback
    }
    setAddCaseNumber(nextNum);
    setAddOpen(true);
  };

  const handleNumStudentsChange = (rawVal: string) => {
    let n = Number.parseInt(rawVal, 10) || 1;
    if (n < 1) n = 1;
    if (n > 20) n = 20;
    setNumStudents(n);
    setSelectedSlotIds((prev) => {
      const next = [...prev];
      while (next.length < n) next.push('');
      return next.slice(0, n);
    });
  };

  const proceedToStep2 = () => {
    if (selectedSlotIds.some((id) => !id)) {
      alert('Please select a student for all fields.');
      return;
    }
    setAddStep(2);
  };

  const selectedStudentLabels = useMemo(
    () =>
      selectedSlotIds.map(
        (id) => studentOptions.find((o) => o.value === id)?.label ?? `Student #${id}`
      ),
    [selectedSlotIds, studentOptions]
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSaving(true);
    setAddMsg(null);
    const resolvedType = addCaseType === 'Other' ? addCaseTypeOther : addCaseType;
    const resolvedOutcome = addOutcome === 'Other' ? addOutcomeOther : addOutcome;
    try {
      await createCase({
        case_number: addCaseNumber,
        school_year: addSchoolYear,
        date: addDate,
        grade_section: '',
        case_type: resolvedType,
        brief_description: addBriefDesc,
        actions_taken: addActionsTaken,
        outcome_disposition: resolvedOutcome,
        student_ids: selectedSlotIds.map((id) => Number(id)),
      });
      setAddMsg({ type: 'success', text: 'Case record successfully saved!' });
      await loadData();
      setTimeout(() => {
        setAddOpen(false);
        setAddMsg(null);
      }, 900);
    } catch (err) {
      setAddMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save case record.',
      });
    } finally {
      setAddSaving(false);
    }
  };

  const handleOpenEdit = async (id: number) => {
    try {
      const rec = await fetchCaseById(id);
      setEditId(rec.id);
      setEditStudentIds((rec.student_ids ?? []).map(String));
      setEditCaseNumber(rec.case_number ?? '');
      setEditSchoolYear(rec.school_year ?? 'Unknown/Not Indicated');
      setEditDate(rec.date ?? '');
      setEditGradeSection(rec.grade_section ?? '');

      const cType = rec.case_type ?? '';
      if (STANDARD_CASE_TYPES.includes(cType)) {
        setEditCaseType(cType);
        setEditCaseTypeOther('');
      } else {
        setEditCaseType('Other');
        setEditCaseTypeOther(cType);
      }

      const out = rec.outcome_disposition ?? '';
      if (STANDARD_OUTCOMES.includes(out)) {
        setEditOutcome(out);
        setEditOutcomeOther('');
      } else {
        setEditOutcome('Other');
        setEditOutcomeOther(out);
      }

      setEditBriefDesc(rec.brief_description ?? '');
      setEditActionsTaken(rec.actions_taken ?? '');
      setEditMsg(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not fetch case details.');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId === null) return;
    if (editStudentIds.length === 0) {
      setEditMsg({ type: 'error', text: 'Please select at least one student.' });
      return;
    }
    setEditSaving(true);
    setEditMsg(null);
    const resolvedType = editCaseType === 'Other' ? editCaseTypeOther : editCaseType;
    const resolvedOutcome = editOutcome === 'Other' ? editOutcomeOther : editOutcome;
    try {
      await updateCase(editId, {
        case_number: editCaseNumber,
        school_year: editSchoolYear,
        date: editDate,
        grade_section: editGradeSection,
        case_type: resolvedType,
        brief_description: editBriefDesc,
        actions_taken: editActionsTaken,
        outcome_disposition: resolvedOutcome,
        student_ids: editStudentIds.map(Number),
      });
      setEditMsg({ type: 'success', text: 'Case record successfully updated!' });
      await loadData();
      setTimeout(() => {
        setEditId(null);
        setEditMsg(null);
      }, 900);
    } catch (err) {
      setEditMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to update case record.',
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
      await softDeleteRecord('case_register', editId);
      setEditId(null);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to delete record.');
    }
  };

  const handleExport = () => {
    exportTableToPDF({
      filename: 'cases.pdf',
      headers: [
        'Case No.',
        'Student Name',
        'School Year',
        'Date',
        'Grade & Section',
        'Case Type',
        'Brief Description',
        'Actions Taken',
        'Outcome',
      ],
      rows: displayedCases.map((c) => [
        c.case_number,
        c.student_names || 'Unknown',
        c.school_year,
        formatShortDate(c.date),
        c.grade_section,
        c.case_type,
        c.brief_description,
        c.actions_taken,
        c.outcome_disposition,
      ]),
    });
  };

  return (
    <>
      <div className="page-header-container">
        <h1 className="page-title">Case Register</h1>
        <div className="page-controls">
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Showing <strong id="showing-counter" style={{ color: 'var(--text-dark)' }}>{displayedCases.length}</strong>
          </span>
          <button type="button" className="control-btn" onClick={() => setShowFilters((f) => !f)}>
            <FilterIcon /> Filter
          </button>
          <button type="button" className="control-btn" onClick={handleExport}>
            <ExportIcon /> Export
          </button>
          <button type="button" className="control-btn btn-primary" onClick={() => void openAddModal()}>
            + Add New Case
          </button>
        </div>
      </div>

      {/* Outcome Analytics Grid */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <button type="button" className="analytics-card" onClick={() => filterByOutcome('')}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Total Cases</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)' }}>{analytics.total}</span>
        </button>
        <button type="button" className="analytics-card" onClick={() => filterByOutcome('Closed/Resolved')}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Closed / Resolved</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#166534' }}>{analytics.closed}</span>
        </button>
        <button type="button" className="analytics-card" onClick={() => filterByOutcome('Referred')}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Referred</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1e40af' }}>{analytics.referred}</span>
        </button>
        <button type="button" className="analytics-card" onClick={() => filterByOutcome('Ongoing')}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Ongoing</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#92400e' }}>{analytics.ongoing}</span>
        </button>
        <button type="button" className="analytics-card" onClick={() => filterByOutcome('To Follow-Up')}>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>To Follow-Up</span>
          <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#8b5cf6' }}>{analytics.followup}</span>
        </button>
        {analytics.other > 0 && (
          <div className="analytics-card" style={{ cursor: 'default' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Other Outcomes</span>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: '#475569' }}>{analytics.other}</span>
          </div>
        )}
      </div>

      <h3 style={{ fontSize: '1.1rem', color: 'var(--text-dark)', marginBottom: '1rem' }}>Cases by Type</h3>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        {analytics.sortedTypes.map(([type, count]) => (
          <button
            type="button"
            key={type}
            className="analytics-card"
            onClick={() => filterByCaseType(type)}
            title={type}
          >
            <span
              style={{
                color: 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                width: '100%',
              }}
            >
              {type}
            </span>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary)' }}>{count}</span>
          </button>
        ))}
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
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Case Type</label>
            <input
              type="text"
              className="form-control"
              placeholder="Type case type..."
              value={filterCaseType}
              onChange={(e) => setFilterCaseType(e.target.value)}
              style={{ minWidth: '150px' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Outcome</label>
            <input
              type="text"
              className="form-control"
              placeholder="Type outcome..."
              value={filterOutcome}
              onChange={(e) => setFilterOutcome(e.target.value)}
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
                <th>Case No.</th>
                <th>Student Name</th>
                <th>School Year</th>
                <th>Date</th>
                <th>Grade &amp; Section</th>
                <th>Case Type</th>
                <th>Brief Description</th>
                <th>Actions Taken</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    Loading...
                  </td>
                </tr>
              ) : displayedCases.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No case records found.
                  </td>
                </tr>
              ) : (
                displayedCases.map((c) => {
                  const outcome = c.outcome_disposition || '';
                  let badgeStyle = { background: '#f1f5f9', color: '#475569' };
                  if (outcome === 'Closed/Resolved') badgeStyle = { background: '#dcfce7', color: '#166534' };
                  else if (outcome === 'Ongoing') badgeStyle = { background: '#fef3c7', color: '#92400e' };
                  else if (outcome === 'Referred') badgeStyle = { background: '#dbeafe', color: '#1e40af' };

                  return (
                    <tr key={c.id} className="clickable-row" onClick={() => void handleOpenEdit(c.id)}>
                      <td style={{ color: 'var(--text-muted)' }}>{c.case_number}</td>
                      <td style={{ fontWeight: 500, color: 'var(--text-dark)' }}>
                        {c.student_names || 'Unknown'}
                      </td>
                      <td>{c.school_year}</td>
                      <td>{formatShortDate(c.date)}</td>
                      <td>{c.grade_section}</td>
                      <td>{c.case_type}</td>
                      <td>{truncateText(c.brief_description, 30)}</td>
                      <td>{truncateText(c.actions_taken, 30)}</td>
                      <td>
                        <span className="status-pill" style={badgeStyle}>
                          {outcome}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Case Modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add New Case Record"
        maxWidth="1000px"
      >
        {addStep === 1 ? (
          <div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                How many students are involved in this case?
              </label>
              <input
                type="number"
                className="form-control"
                min={1}
                max={20}
                value={numStudents}
                onChange={(e) => handleNumStudentsChange(e.target.value)}
              />
            </div>

            <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {selectedSlotIds.map((slotVal, idx) => (
                <div key={idx}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                    Student {idx + 1}
                  </label>
                  <SearchableSelect
                    options={studentOptions}
                    value={slotVal}
                    onChange={(val) => {
                      setSelectedSlotIds((prev) => prev.map((item, i) => (i === idx ? val : item)));
                    }}
                    placeholder="-- Search by Name or LRN --"
                    required
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              className="submit-btn"
              style={{ width: '100%' }}
              onClick={proceedToStep2}
            >
              Proceed to Case Details
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateSubmit}>
            <div className="form-grid">
              <div className="form-group full-width">
                <label>Students Involved</label>
                <div
                  style={{
                    background: '#f1f5f9',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    fontWeight: 600,
                    minHeight: '40px',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {selectedStudentLabels.map((lbl, idx) => (
                    <div key={idx}>{lbl}</div>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Case Number</label>
                <input type="text" className="form-control" value={addCaseNumber} readOnly required />
              </div>
              <div className="form-group">
                <label>School Year</label>
                <select
                  className="form-control"
                  value={addSchoolYear}
                  onChange={(e) => setAddSchoolYear(e.target.value)}
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
                <label>Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={addDate}
                  onChange={(e) => setAddDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label>Grade &amp; Section</label>
                <input
                  type="text"
                  className="form-control"
                  value="Multiple (See Students)"
                  readOnly
                  style={{ background: '#f1f5f9' }}
                />
              </div>
              <div className="form-group">
                <label>Case Type</label>
                <select
                  className="form-control"
                  value={addCaseType}
                  onChange={(e) => setAddCaseType(e.target.value)}
                  required
                >
                  {CASE_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {addCaseType === 'Other' && (
                  <input
                    type="text"
                    className="form-control"
                    style={{ marginTop: '0.5rem' }}
                    placeholder="Specify case type..."
                    value={addCaseTypeOther}
                    onChange={(e) => setAddCaseTypeOther(e.target.value)}
                    required
                  />
                )}
              </div>
              <div className="form-group">
                <label>Outcome/Disposition</label>
                <select
                  className="form-control"
                  value={addOutcome}
                  onChange={(e) => setAddOutcome(e.target.value)}
                  required
                >
                  {OUTCOME_DISPOSITION_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                {addOutcome === 'Other' && (
                  <input
                    type="text"
                    className="form-control"
                    style={{ marginTop: '0.5rem' }}
                    placeholder="Specify outcome..."
                    value={addOutcomeOther}
                    onChange={(e) => setAddOutcomeOther(e.target.value)}
                    required
                  />
                )}
              </div>
              <div className="form-group full-width">
                <label>Brief Description</label>
                <textarea
                  className="form-control"
                  value={addBriefDesc}
                  onChange={(e) => setAddBriefDesc(e.target.value)}
                />
              </div>
              <div className="form-group full-width">
                <label>Actions Taken</label>
                <textarea
                  className="form-control"
                  value={addActionsTaken}
                  onChange={(e) => setAddActionsTaken(e.target.value)}
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

      {/* Edit Case Modal */}
      <Modal
        isOpen={editId !== null}
        onClose={() => setEditId(null)}
        title="Edit Case Record"
        maxWidth="1000px"
      >
        <form onSubmit={handleEditSubmit}>
          <div className="form-group full-width" style={{ marginBottom: '1.5rem' }}>
            <label>Students Involved</label>
            <MultiSearchableSelect
              options={studentOptions}
              values={editStudentIds}
              onChange={setEditStudentIds}
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>Case Number</label>
              <input type="text" className="form-control" value={editCaseNumber} readOnly required />
            </div>
            <div className="form-group">
              <label>School Year</label>
              <select
                className="form-control"
                value={editSchoolYear}
                onChange={(e) => setEditSchoolYear(e.target.value)}
                required
              >
                {editSchoolYear && !ASSESSMENT_SCHOOL_YEARS.includes(editSchoolYear) && (
                  <option value={editSchoolYear}>{editSchoolYear}</option>
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
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Grade &amp; Section</label>
              <input
                type="text"
                className="form-control"
                value="Multiple (See Students)"
                readOnly
                style={{ background: '#f1f5f9' }}
              />
            </div>
            <div className="form-group">
              <label>Case Type</label>
              <select
                className="form-control"
                value={editCaseType}
                onChange={(e) => setEditCaseType(e.target.value)}
                required
              >
                {CASE_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {editCaseType === 'Other' && (
                <input
                  type="text"
                  className="form-control"
                  style={{ marginTop: '0.5rem' }}
                  placeholder="Specify case type..."
                  value={editCaseTypeOther}
                  onChange={(e) => setEditCaseTypeOther(e.target.value)}
                  required
                />
              )}
            </div>
            <div className="form-group">
              <label>Outcome/Disposition</label>
              <select
                className="form-control"
                value={editOutcome}
                onChange={(e) => setEditOutcome(e.target.value)}
                required
              >
                {OUTCOME_DISPOSITION_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              {editOutcome === 'Other' && (
                <input
                  type="text"
                  className="form-control"
                  style={{ marginTop: '0.5rem' }}
                  placeholder="Specify outcome..."
                  value={editOutcomeOther}
                  onChange={(e) => setEditOutcomeOther(e.target.value)}
                  required
                />
              )}
            </div>
            <div className="form-group full-width">
              <label>Brief Description</label>
              <textarea
                className="form-control"
                value={editBriefDesc}
                onChange={(e) => setEditBriefDesc(e.target.value)}
              />
            </div>
            <div className="form-group full-width">
              <label>Actions Taken</label>
              <textarea
                className="form-control"
                value={editActionsTaken}
                onChange={(e) => setEditActionsTaken(e.target.value)}
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

