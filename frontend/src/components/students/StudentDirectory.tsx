import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalSearch } from '../../context/SearchContext';
import {
  ALLOWED_GRADES,
  GRADE_CARD_STYLES,
  SECTION_PILL_COLORS,
  STUDENT_STATUS_BADGE_STYLES,
  STUDENT_STATUS_OPTIONS,
} from '../../lib/constants';
import { formatShortDate, truncateText } from '../../lib/formatters';
import { exportTableToPDF } from '../../lib/pdfExport';
import { softDeleteRecord } from '../../services/archiveService';
import { addGradeSection, fetchGradeSections, type SectionsMap } from '../../services/sectionsService';
import {
  createLearner,
  fetchFilteredStudents,
  fetchLearnerDetails,
  fetchStudentGradeCounts,
  updateLearner,
} from '../../services/studentsService';
import type {
  GradeCounts,
  GradeLevel,
  LearnerFormInput,
  LearnerFullDetails,
  ParentInput,
  ParentRecord,
  StudentListRow,
} from '../../types/database';
import { ExportIcon, FilterIcon, UsersIcon } from '../Icons';
import { Modal } from '../Modal';
import {
  emptyLearnerFormInput,
  emptyParentInput,
  LearnerFormFields,
} from './LearnerFormFields';
import { ViewLearnerModal } from './ViewLearnerModal';

interface StudentDirectoryProps {
  mode: 'active' | 'graduates';
}

function parentRecordToInput(p?: ParentRecord): ParentInput {
  if (!p) return emptyParentInput();
  return {
    id: p.id,
    full_name: p.full_name ?? '',
    relationship: p.relationship ?? '',
    mobile_number: p.mobile_number ?? '',
    telephone_number: p.telephone_number ?? '',
    email_address: p.email_address ?? '',
    home_address: p.home_address ?? '',
    workplace: p.workplace ?? '',
    workplace_address: p.workplace_address ?? '',
    emergency_contact_number: p.emergency_contact_number ?? '',
  };
}

export function StudentDirectory({ mode }: StudentDirectoryProps) {
  const isGraduated = mode === 'graduates';
  const pageTitle = isGraduated ? 'Graduates' : 'Learners';
  const exportFilename = isGraduated ? 'graduates.pdf' : 'learners.pdf';
  const { searchQuery } = useGlobalSearch();

  const [currentGrade, setCurrentGrade] = useState<'All' | GradeLevel>('All');
  const [currentSection, setCurrentSection] = useState<string>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [filterSchoolYear, setFilterSchoolYear] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [students, setStudents] = useState<StudentListRow[]>([]);
  const [counts, setCounts] = useState<GradeCounts>(() => {
    const base = { All: 0 } as GradeCounts;
    for (const g of ALLOWED_GRADES) base[g] = 0;
    return base;
  });
  const [sectionsMap, setSectionsMap] = useState<SectionsMap>({} as SectionsMap);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add Learner Modal
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<LearnerFormInput>(emptyLearnerFormInput);
  const [addSaving, setAddSaving] = useState(false);
  const [addMsg, setAddMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // View & Edit Modals
  const [viewLearner, setViewLearner] = useState<LearnerFullDetails | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<LearnerFormInput>(emptyLearnerFormInput);
  const [editSaving, setEditSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Section Modal
  const [sectionModalGrade, setSectionModalGrade] = useState<GradeLevel | null>(null);
  const [newSectionName, setNewSectionName] = useState('');
  const [sectionSaving, setSectionSaving] = useState(false);
  const [sectionMsg, setSectionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [rows, gradeCounts, secMap] = await Promise.all([
        fetchFilteredStudents({
          graduated: isGraduated,
          gradeLevel: currentGrade,
          section: currentSection,
        }),
        fetchStudentGradeCounts(isGraduated),
        fetchGradeSections(),
      ]);
      setStudents(rows);
      setCounts(gradeCounts);
      setSectionsMap(secMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load learners.');
    } finally {
      setLoading(false);
    }
  }, [isGraduated, currentGrade, currentSection]);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const displayedStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (filterSchoolYear && !(s.school_year ?? '').toLowerCase().includes(filterSchoolYear.toLowerCase())) {
        return false;
      }
      if (filterStatus && (s.status ?? '') !== filterStatus) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        s.full_name,
        s.lrn,
        s.school_year,
        s.grade_level,
        s.section,
        s.blood_type,
        s.status,
        s.home_address,
        s.allergies,
        s.medications,
        s.primary_parent,
        s.secondary_parent,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [students, searchQuery, filterSchoolYear, filterStatus]);

  const handleGradeSwitch = (grade: 'All' | GradeLevel) => {
    setCurrentGrade(grade);
    setCurrentSection('All');
  };

  const handleOpenView = async (id: number) => {
    try {
      const details = await fetchLearnerDetails(id);
      setViewLearner(details);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not fetch learner details.');
    }
  };

  const handleOpenEditFromDetails = (learner: LearnerFullDetails) => {
    setViewLearner(null);
    const primary = learner.parents.find((p) => p.parent_type === 'Primary');
    const secondary = learner.parents.find((p) => p.parent_type === 'Secondary');
    setEditId(learner.id);
    setEditMsg(null);
    setEditForm({
      full_name: learner.full_name ?? '',
      lrn: learner.lrn ?? '',
      grade_level: learner.grade_level ?? '',
      section: learner.section ?? '',
      school_year: learner.school_year ?? '',
      date_of_birth: learner.date_of_birth ?? '',
      home_address: learner.home_address ?? '',
      blood_type: learner.blood_type ?? '',
      allergies: learner.allergies ?? '',
      medications: learner.medications ?? '',
      status: learner.status ?? 'Unknown / Not Indicated',
      primary_parent: parentRecordToInput(primary),
      secondary_parent: parentRecordToInput(secondary),
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddSaving(true);
    setAddMsg(null);
    try {
      await createLearner(addForm);
      setAddMsg({ type: 'success', text: 'Learner and parent records successfully saved!' });
      setAddForm(emptyLearnerFormInput());
      await loadDirectory();
      setTimeout(() => {
        setAddOpen(false);
        setAddMsg(null);
      }, 900);
    } catch (err) {
      setAddMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to save learner record.',
      });
    } finally {
      setAddSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editId === null) return;
    setEditSaving(true);
    setEditMsg(null);
    try {
      await updateLearner(editId, editForm);
      setEditMsg({ type: 'success', text: 'Learner records successfully updated!' });
      await loadDirectory();
      setTimeout(() => {
        setEditId(null);
        setEditMsg(null);
      }, 900);
    } catch (err) {
      setEditMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to update learner record.',
      });
    } finally {
      setEditSaving(false);
    }
  };

  const handleSoftDelete = async () => {
    if (editId === null) return;
    if (!window.confirm('Are you sure you want to move this record to the trash? It can be restored from the Deleted Records page.')) {
      return;
    }
    try {
      await softDeleteRecord('students', editId);
      setEditId(null);
      await loadDirectory();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to delete record.');
    }
  };

  const handleAddSectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sectionModalGrade) return;
    setSectionSaving(true);
    setSectionMsg(null);
    try {
      const updated = await addGradeSection(sectionModalGrade, newSectionName);
      setSectionsMap((prev) => ({ ...prev, [sectionModalGrade]: updated }));
      setSectionMsg({ type: 'success', text: 'Section added successfully!' });
      setTimeout(() => {
        setSectionModalGrade(null);
        setNewSectionName('');
        setSectionMsg(null);
      }, 800);
    } catch (err) {
      setSectionMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to save the new section.',
      });
    } finally {
      setSectionSaving(false);
    }
  };

  const handleExport = () => {
    exportTableToPDF({
      filename: exportFilename,
      headers: [
        'Full Name',
        'LRN',
        'School Year',
        'Grade Level',
        'Section',
        'Date of Birth',
        'Blood Type',
        'Status',
        'Home Address',
        'Allergies',
        'Medications',
        'Registered',
        'Primary Parent',
        'Secondary Parent',
      ],
      rows: displayedStudents.map((s) => [
        s.full_name,
        s.lrn,
        s.school_year,
        s.grade_level || s.grade_section,
        s.section,
        formatShortDate(s.date_of_birth),
        s.blood_type,
        s.status || 'Unknown / Not Indicated',
        s.home_address,
        s.allergies,
        s.medications,
        formatShortDate(s.created_at),
        s.primary_parent,
        s.secondary_parent,
      ]),
    });
  };

  const allCards: Array<'All' | GradeLevel> = ['All', ...ALLOWED_GRADES];
  const currentSections = currentGrade !== 'All' ? sectionsMap[currentGrade] ?? [] : [];
  const activePillBg = SECTION_PILL_COLORS[currentGrade] || '#f1f5f9';

  return (
    <>
      <div className="page-header-container">
        <h1 className="page-title">{pageTitle}</h1>
        <div className="page-controls">
          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            Total: <strong id="display-count" style={{ color: 'var(--text-dark)' }}>{displayedStudents.length}</strong>
          </span>
          <button type="button" className="control-btn" onClick={() => setShowFilters((f) => !f)}>
            <FilterIcon /> Filter
          </button>
          <button type="button" className="control-btn" onClick={handleExport}>
            <ExportIcon /> Export
          </button>
          {!isGraduated && (
            <button
              type="button"
              className="control-btn btn-primary"
              onClick={() => {
                setAddForm(emptyLearnerFormInput());
                setAddMsg(null);
                setAddOpen(true);
              }}
            >
              + Add New Learner
            </button>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="filter-panel">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>School Year</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g. 2025-2026"
              value={filterSchoolYear}
              onChange={(e) => setFilterSchoolYear(e.target.value)}
              style={{ minWidth: '160px' }}
            />
          </div>
          {!isGraduated && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status</label>
              <select
                className="form-control"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{ minWidth: '190px' }}
              >
                <option value="">All Statuses</option>
                {STUDENT_STATUS_OPTIONS.filter((s) => s !== 'Graduated').map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      <div className="content-card">
        {/* Grade Cards */}
        <div className="grade-cards-grid" id="grade-cards-grid">
          {allCards.map((g) => {
            const cs = GRADE_CARD_STYLES[g];
            const label = g === 'All' ? 'All Grades' : g;
            const active = currentGrade === g;
            return (
              <button
                type="button"
                key={g}
                className={`grade-card ${active ? 'active' : ''}`}
                onClick={() => handleGradeSwitch(g)}
                title={label}
              >
                <div className="grade-card-icon" style={{ background: cs.bg, color: cs.color }}>
                  <UsersIcon size={16} />
                </div>
                <div className="grade-card-body">
                  <div className="grade-card-label">{label}</div>
                  <div className="grade-card-count">{counts[g]}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Section Filter Pills */}
        {currentGrade !== 'All' && (
          <div className="section-filter-bar">
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginLeft: '0.5rem' }}>
              <button
                type="button"
                className={`section-pill ${currentSection === 'All' ? 'active' : ''}`}
                style={{ backgroundColor: currentSection === 'All' ? activePillBg : 'transparent' }}
                onClick={() => setCurrentSection('All')}
              >
                ALL SECTIONS
              </button>
              {currentSections.map((sec) => (
                <button
                  type="button"
                  key={sec}
                  className={`section-pill ${currentSection === sec ? 'active' : ''}`}
                  style={{ backgroundColor: activePillBg }}
                  onClick={() => setCurrentSection(sec)}
                >
                  {sec}
                </button>
              ))}
              <button
                type="button"
                className="section-pill"
                style={{ backgroundColor: '#fce4e4' }}
                onClick={() => {
                  setSectionMsg(null);
                  setNewSectionName('');
                  setSectionModalGrade(currentGrade);
                }}
              >
                + ADD SECTION
              </button>
            </div>
          </div>
        )}

        {error && <div className="msg-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div className="table-responsive">
          <table className="data-table data-table--green" id="dataTable" style={{ minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th>Full Name</th>
                <th>LRN</th>
                <th>School Year</th>
                <th>Grade Level</th>
                <th>Section</th>
                <th>Date of Birth</th>
                <th>Blood Type</th>
                <th>Status</th>
                <th>Home Address</th>
                <th>Allergies</th>
                <th>Medications</th>
                <th>Registered</th>
                <th>Primary Parent</th>
                <th>Secondary Parent</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2.5rem', fontStyle: 'italic' }}>
                    Loading...
                  </td>
                </tr>
              ) : displayedStudents.length === 0 ? (
                <tr>
                  <td colSpan={14} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    {isGraduated ? 'No graduates found.' : 'No active learners found.'}
                  </td>
                </tr>
              ) : (
                displayedStudents.map((s) => {
                  const status = s.status || 'Unknown / Not Indicated';
                  const badgeStyle = STUDENT_STATUS_BADGE_STYLES[status] || {
                    bg: '#f1f5f9',
                    color: '#475569',
                  };
                  return (
                    <tr key={s.id} className="clickable-row" onClick={() => void handleOpenView(s.id)}>
                      <td style={{ fontWeight: 500, color: 'var(--text-dark)' }}>{s.full_name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{s.lrn}</td>
                      <td>{s.school_year || ''}</td>
                      <td>{s.grade_level || s.grade_section || ''}</td>
                      <td>{s.section || ''}</td>
                      <td>{formatShortDate(s.date_of_birth)}</td>
                      <td>{s.blood_type || ''}</td>
                      <td>
                        <span className="status-pill" style={{ background: badgeStyle.bg, color: badgeStyle.color }}>
                          {status}
                        </span>
                      </td>
                      <td>{truncateText(s.home_address, 30, '…')}</td>
                      <td>{truncateText(s.allergies, 30, '…')}</td>
                      <td>{truncateText(s.medications, 30, '…')}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{formatShortDate(s.created_at)}</td>
                      <td>{s.primary_parent || ''}</td>
                      <td>{s.secondary_parent || ''}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Learner Modal */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add New Learner"
      >
        <form onSubmit={handleCreateSubmit}>
          <LearnerFormFields
            prefix="add"
            value={addForm}
            onChange={setAddForm}
            sectionsForGrade={sectionsMap[addForm.grade_level as GradeLevel] ?? []}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '2rem' }}>
            {addMsg && (
              <div className={addMsg.type === 'success' ? 'msg-success' : 'msg-error'} style={{ flex: 1 }}>
                {addMsg.text}
              </div>
            )}
            <button type="button" className="btn-cancel" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={addSaving}>
              {addSaving ? 'Saving...' : 'Save Learner Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Learner Modal */}
      <Modal
        isOpen={editId !== null}
        onClose={() => setEditId(null)}
        title="Edit Learner Record"
      >
        <form onSubmit={handleEditSubmit}>
          <LearnerFormFields
            prefix="edit"
            value={editForm}
            onChange={setEditForm}
            sectionsForGrade={sectionsMap[editForm.grade_level as GradeLevel] ?? []}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            {editMsg && (
              <div className={editMsg.type === 'success' ? 'msg-success' : 'msg-error'} style={{ flex: 1 }}>
                {editMsg.text}
              </div>
            )}
            <button type="button" className="btn-delete-soft" onClick={() => void handleSoftDelete()}>
              Delete Record
            </button>
            <button type="submit" className="submit-btn" disabled={editSaving}>
              {editSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Learner Modal */}
      <ViewLearnerModal
        learner={viewLearner}
        onClose={() => setViewLearner(null)}
        onEdit={handleOpenEditFromDetails}
      />

      {/* Add Section Modal */}
      <Modal
        isOpen={sectionModalGrade !== null}
        onClose={() => setSectionModalGrade(null)}
        title="Add New Section"
        maxWidth="400px"
      >
        <form onSubmit={handleAddSectionSubmit}>
          <div className="form-group full-width">
            <label htmlFor="new_section_name">Section Name ({sectionModalGrade})</label>
            <input
              type="text"
              id="new_section_name"
              className="form-control"
              placeholder="e.g. Ruby"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              required
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
            {sectionMsg && (
              <div className={sectionMsg.type === 'success' ? 'msg-success' : 'msg-error'} style={{ flex: 1, fontSize: '0.85rem' }}>
                {sectionMsg.text}
              </div>
            )}
            <button type="submit" className="submit-btn" disabled={sectionSaving}>
              {sectionSaving ? 'Adding...' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

