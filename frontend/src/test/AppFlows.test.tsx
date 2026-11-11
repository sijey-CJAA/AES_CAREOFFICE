import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../components/AppShell';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { SearchProvider } from '../context/SearchContext';
import { ArchivePage } from '../pages/ArchivePage';
import { AssessmentsPage } from '../pages/AssessmentsPage';
import { CasesPage } from '../pages/CasesPage';
import { DashboardPage } from '../pages/DashboardPage';
import { GraduatesPage } from '../pages/GraduatesPage';
import { LearnersPage } from '../pages/LearnersPage';
import { LoginPage } from '../pages/LoginPage';
import { ParentsPage } from '../pages/ParentsPage';

const mockAuthState = {
  session: { access_token: 'tok', user: { id: 'u1', email: 'maria.santos@aes.edu.ph' } } as any,
  user: { id: 'u1', email: 'maria.santos@aes.edu.ph' } as any,
  userEmail: 'maria.santos@aes.edu.ph',
  userName: 'Maria',
  loading: false,
  isAuthorizedAdmin: true,
  isPasswordRecovery: false,
  clearPasswordRecovery: vi.fn(),
  refreshAdminCheck: vi.fn(),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  getSupabaseClient: vi.fn(),
  supabase: null,
}));

const mockSignInWithEmail = vi.fn();
const mockSignOut = vi.fn();
const mockRequestPasswordReset = vi.fn();
vi.mock('../services/authService', () => ({
  signInWithEmail: (...args: any[]) => mockSignInWithEmail(...args),
  signOut: () => mockSignOut(),
  requestPasswordReset: (...args: any[]) => mockRequestPasswordReset(...args),
  changePassword: vi.fn(),
  updateRecoveredPassword: vi.fn(),
  verifyAdminAccess: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/dashboardService', () => ({
  fetchDashboardStats: vi.fn().mockResolvedValue({
    total_students: 42,
    total_parents: 60,
    total_assessments: 9,
    total_cases: 5,
  }),
}));

const mockFetchFilteredStudents = vi.fn();
const mockCreateLearner = vi.fn();
const mockFetchLearnerDetails = vi.fn();
vi.mock('../services/studentsService', () => ({
  fetchFilteredStudents: (...args: any[]) => mockFetchFilteredStudents(...args),
  fetchStudentGradeCounts: vi.fn().mockResolvedValue({
    All: 2,
    Kindergarten: 1,
    'Grade 1': 0,
    'Grade 2': 0,
    'Grade 3': 0,
    'Grade 4': 1,
    'Grade 5': 0,
    'Grade 6': 0,
  }),
  fetchAllStudentsSummary: vi.fn().mockResolvedValue([
    { id: 1, full_name: 'Juan Dela Cruz', lrn: '100020003001' },
    { id: 2, full_name: 'Ana Reyes', lrn: '100020003002' },
  ]),
  fetchLearnerDetails: (...args: any[]) => mockFetchLearnerDetails(...args),
  createLearner: (...args: any[]) => mockCreateLearner(...args),
  updateLearner: vi.fn(),
  fetchSectionsWithStudentsByGrade: vi.fn().mockResolvedValue(['Rose Quartz']),
  fetchStudentsBySection: vi.fn().mockResolvedValue([
    {
      id: 1,
      full_name: 'Juan Dela Cruz',
      lrn: '100020003001',
      status: 'Currently Enrolled',
      school_year: '2025-2026',
      contact_number: '09171234567',
    },
  ]),
}));

const mockAddGradeSection = vi.fn();
vi.mock('../services/sectionsService', () => ({
  fetchGradeSections: vi.fn().mockResolvedValue({
    Kindergarten: ['Platinum', 'Silver'],
    'Grade 1': ['Crystal'],
    'Grade 2': ['Rainstone'],
    'Grade 3': ['Opalite'],
    'Grade 4': ['Rose Quartz'],
    'Grade 5': ['Emerald'],
    'Grade 6': ['Amethyst'],
  }),
  addGradeSection: (...args: any[]) => mockAddGradeSection(...args),
}));

const mockCreateAssessment = vi.fn();
vi.mock('../services/assessmentsService', () => ({
  fetchActiveAssessments: vi.fn().mockResolvedValue([
    {
      id: 1,
      student_id: 1,
      student_name: 'Juan Dela Cruz',
      record_number: 'AES-AR-001',
      school_year: '2025-2026',
      date: '2026-02-10',
      grade_section: 'Grade 4 - Rose Quartz',
      contact_number: '09171234567',
      status: 'Currently Enrolled',
      assessment_provider: 'Care Center',
      findings: 'Attention support needed',
      diagnosis: 'ADHD',
      recommendations: 'Preferential seating',
      created_at: '2026-02-10T00:00:00Z',
      deleted_at: null,
    },
  ]),
  fetchNextAssessmentNumber: vi.fn().mockResolvedValue('AES-AR-002'),
  fetchAssessmentById: vi.fn(),
  createAssessment: (...args: any[]) => mockCreateAssessment(...args),
  updateAssessment: vi.fn(),
}));

const mockCreateCase = vi.fn();
vi.mock('../services/casesService', () => ({
  fetchActiveCases: vi.fn().mockResolvedValue([
    {
      id: 1,
      case_number: 'AES-CR-001',
      student_names: 'Juan Dela Cruz',
      student_ids: [1],
      school_year: '2025-2026',
      date: '2026-02-15',
      grade_section: null,
      case_type: 'Bullying',
      brief_description: 'Peer conflict',
      actions_taken: 'Counseling',
      outcome_disposition: 'Ongoing',
      created_at: '2026-02-15T00:00:00Z',
      deleted_at: null,
    },
  ]),
  fetchNextCaseNumber: vi.fn().mockResolvedValue('AES-CR-002'),
  fetchCaseById: vi.fn(),
  createCase: (...args: any[]) => mockCreateCase(...args),
  updateCase: vi.fn(),
}));

const mockRestoreRecord = vi.fn();
const mockSoftDeleteRecord = vi.fn();
vi.mock('../services/archiveService', () => ({
  fetchArchivedRecords: vi.fn().mockResolvedValue({
    students: [
      {
        id: 99,
        full_name: 'Deleted Learner',
        lrn: '999999',
        deleted_at: '2026-03-01T10:00:00Z',
      },
    ],
    parents: [],
    assessments: [],
    cases: [],
  }),
  restoreRecord: (...args: any[]) => mockRestoreRecord(...args),
  softDeleteRecord: (...args: any[]) => mockSoftDeleteRecord(...args),
}));

vi.mock('../services/parentsService', () => ({
  fetchActiveParents: vi.fn().mockResolvedValue([
    {
      id: 5,
      student_id: 1,
      parent_type: 'Primary',
      full_name: 'Ana Dela Cruz',
      relationship: 'Mother',
      home_address: '123 School Ave',
      mobile_number: '09171234567',
      telephone_number: null,
      email_address: 'ana@example.com',
      workplace: 'Hospital',
      workplace_address: 'Clinic Rd',
      emergency_contact_number: '09171234567',
      created_at: '2026-01-10T00:00:00Z',
      deleted_at: null,
      student_name: 'Juan Dela Cruz',
    },
  ]),
  fetchParentById: vi.fn(),
  createParentsForStudent: vi.fn(),
  updateParentRecord: vi.fn(),
}));

vi.mock('../lib/pdfExport', () => ({
  exportTableToPDF: vi.fn(),
}));

function renderWithRouter(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <SearchProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="learners" element={<LearnersPage />} />
            <Route path="graduates" element={<GraduatesPage />} />
            <Route path="parents" element={<ParentsPage />} />
            <Route path="assessments" element={<AssessmentsPage />} />
            <Route path="cases" element={<CasesPage />} />
            <Route path="archive" element={<ArchivePage />} />
          </Route>
        </Routes>
      </SearchProvider>
    </MemoryRouter>
  );
}

describe('AES CareOffice migrated routes and flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.session = { access_token: 'tok', user: { id: 'u1', email: 'maria.santos@aes.edu.ph' } };
    mockAuthState.isAuthorizedAdmin = true;
    mockFetchFilteredStudents.mockResolvedValue([
      {
        id: 1,
        full_name: 'Juan Dela Cruz',
        lrn: '100020003001',
        grade_section: null,
        grade_level: 'Grade 4',
        section: 'Rose Quartz',
        school_year: '2025-2026',
        date_of_birth: '2015-05-10',
        contact_number: null,
        home_address: '123 School Ave',
        blood_type: 'O+',
        allergies: 'None',
        medications: null,
        status: 'Currently Enrolled',
        created_at: '2026-01-10T00:00:00Z',
        deleted_at: null,
        primary_parent: 'Ana Dela Cruz',
        secondary_parent: null,
      },
    ]);
  });

  it('redirects unauthenticated visitors to login and submits credentials', async () => {
    mockAuthState.session = null;
    const user = userEvent.setup();
    renderWithRouter('/');

    expect(await screen.findByText(/Log In To Your Account/i)).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Email Address'), 'admin@aes.edu.ph');
    await user.type(screen.getByPlaceholderText('Password'), 'SecurePass123');
    await user.click(screen.getByRole('button', { name: /Login/i }));

    expect(mockSignInWithEmail).toHaveBeenCalledWith('admin@aes.edu.ph', 'SecurePass123');
  });

  it('blocks authenticated non-admin accounts from accessing dashboard', () => {
    mockAuthState.isAuthorizedAdmin = false;
    renderWithRouter('/');
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
  });

  it('renders Dashboard greeting and KPI stats', async () => {
    renderWithRouter('/');
    expect(await screen.findByText('Welcome, Maria!')).toBeInTheDocument();
    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders Learners directory, switches grade tabs, adds section, and opens view modal', async () => {
    const user = userEvent.setup();
    mockAddGradeSection.mockResolvedValue(['Rose Quartz', 'Amethyst']);
    mockFetchLearnerDetails.mockResolvedValue({
      id: 1,
      full_name: 'Juan Dela Cruz',
      lrn: '100020003001',
      grade_level: 'Grade 4',
      section: 'Rose Quartz',
      school_year: '2025-2026',
      date_of_birth: '2015-05-10',
      home_address: '123 School Ave',
      blood_type: 'O+',
      allergies: 'None',
      medications: null,
      status: 'Currently Enrolled',
      parents: [],
      assessments: [],
      cases: [],
    });

    renderWithRouter('/learners');
    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument();

    await user.click(screen.getByTitle('Grade 4'));
    expect(await screen.findByRole('button', { name: 'Rose Quartz' })).toBeInTheDocument();
    expect(mockFetchFilteredStudents).toHaveBeenCalledWith({
      graduated: false,
      gradeLevel: 'Grade 4',
      section: 'All',
    });

    await user.click(screen.getByRole('button', { name: '+ ADD SECTION' }));
    await user.type(screen.getByPlaceholderText('e.g. Ruby'), 'Amethyst');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => {
      expect(mockAddGradeSection).toHaveBeenCalledWith('Grade 4', 'Amethyst');
    });

    await user.click(screen.getByText('Juan Dela Cruz'));
    expect(await screen.findByText('Learner Full Information')).toBeInTheDocument();
  });

  it('completes 2-step Assessment drill-down and submits new assessment', async () => {
    const user = userEvent.setup();
    mockCreateAssessment.mockResolvedValue(undefined);
    renderWithRouter('/assessments');

    expect(await screen.findByText('AES-AR-001')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add New Assessment' }));

    const dialog = screen.getByRole('dialog');
    const selects = await within(dialog).findAllByRole('combobox');
    await user.selectOptions(selects[0], 'Grade 4');
    const secSelects = await within(dialog).findAllByRole('combobox');
    await user.selectOptions(secSelects[1], 'Rose Quartz');

    expect(await within(dialog).findByText('Juan Dela Cruz')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Select' }));

    expect(await within(dialog).findByDisplayValue('AES-AR-002')).toBeInTheDocument();
    expect(within(dialog).getByDisplayValue('09171234567')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Save Record' }));

    await waitFor(() => {
      expect(mockCreateAssessment).toHaveBeenCalledTimes(1);
    });
  });

  it('renders Graduates and Parents routes and filters via global search', async () => {
    const user = userEvent.setup();
    renderWithRouter('/graduates');
    expect(await screen.findByRole('heading', { name: 'Graduates' })).toBeInTheDocument();
    expect(mockFetchFilteredStudents).toHaveBeenCalledWith({
      graduated: true,
      gradeLevel: 'All',
      section: 'All',
    });

    const { unmount } = renderWithRouter('/parents');
    expect(await screen.findByText('Ana Dela Cruz')).toBeInTheDocument();
    const searchInputs = screen.getAllByPlaceholderText('Search');
    await user.type(searchInputs[searchInputs.length - 1], 'NonExistentParent');
    expect(screen.getByText('No active parents found.')).toBeInTheDocument();
    unmount();
  });

  it('renders Cases analytics and filters by outcome card', async () => {
    const user = userEvent.setup();
    renderWithRouter('/cases');

    expect(await screen.findByText('AES-CR-001')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Closed \/ Resolved/i }));
    expect(screen.queryByText('AES-CR-001')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Total Cases/i }));
    expect(screen.getByText('AES-CR-001')).toBeInTheDocument();
  });

  it('renders Archive tabs and invokes restoreRecord on confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockRestoreRecord.mockResolvedValue(undefined);

    renderWithRouter('/archive');
    expect(await screen.findByText('Deleted Learner')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Restore' }));

    await waitFor(() => {
      expect(mockRestoreRecord).toHaveBeenCalledWith('students', 99);
    });
  });

  it('submits Add Learner modal and triggers soft delete from Edit Learner modal', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockCreateLearner.mockResolvedValue(10);
    mockSoftDeleteRecord.mockResolvedValue(undefined);
    mockFetchLearnerDetails.mockResolvedValue({
      id: 1,
      full_name: 'Juan Dela Cruz',
      lrn: '100020003001',
      grade_level: 'Grade 4',
      section: 'Rose Quartz',
      school_year: '2023-2024',
      date_of_birth: '2015-05-10',
      home_address: '123 School Ave',
      blood_type: 'O+',
      allergies: 'None',
      medications: null,
      status: 'Currently Enrolled',
      parents: [],
      assessments: [{ id: 1, record_number: 'AES-AR-001', date: '2026-01-01', school_year: '2025-2026', status: 'Ongoing', assessment_provider: 'Care Center' }],
      cases: [],
    });

    renderWithRouter('/learners');
    expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument();

    // Open Add Learner modal and submit
    await user.click(screen.getByRole('button', { name: '+ Add New Learner' }));
    const addDialog = screen.getByRole('dialog');
    await user.type(within(addDialog).getByLabelText("Learner's Full Name"), 'Pedro Penduko');
    await user.selectOptions(within(addDialog).getByLabelText('Grade Level'), 'Grade 4');
    await user.selectOptions(within(addDialog).getByLabelText('Section'), 'Rose Quartz');
    await user.click(within(addDialog).getByRole('button', { name: 'Save Learner Record' }));

    await waitFor(() => {
      expect(mockCreateLearner).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: 'Pedro Penduko',
          grade_level: 'Grade 4',
          section: 'Rose Quartz',
        })
      );
    });

    // Close Add modal, open View -> Past Guidance Records -> Edit -> Soft Delete
    await user.click(within(addDialog).getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByText('Juan Dela Cruz'));
    const viewDialog = await screen.findByRole('dialog');
    expect(within(viewDialog).getByText('Past Guidance Records')).toBeInTheDocument();
    await user.click(within(viewDialog).getByRole('button', { name: 'Edit Details' }));

    const editDialog = await screen.findByRole('dialog');
    expect(within(editDialog).getByDisplayValue('2023-2024')).toBeInTheDocument();
    await user.click(within(editDialog).getByRole('button', { name: 'Delete Record' }));

    await waitFor(() => {
      expect(mockSoftDeleteRecord).toHaveBeenCalledWith('students', 1);
    });
  });

  it('completes 2-step Add Case modal with custom Other values', async () => {
    const user = userEvent.setup();
    mockCreateCase.mockResolvedValue(2);
    renderWithRouter('/cases');

    expect(await screen.findByText('AES-CR-001')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add New Case' }));
    const dialog = screen.getByRole('dialog');

    // Step 1: pick 1 student via SearchableSelect
    const searchInput = within(dialog).getByPlaceholderText('-- Search by Name or LRN --');
    await user.click(searchInput);
    await user.click(await within(dialog).findByText('Juan Dela Cruz (LRN: 100020003001)'));
    await user.click(within(dialog).getByRole('button', { name: 'Proceed to Case Details' }));

    // Step 2: select Other for case type & submit
    const selects = within(dialog).getAllByRole('combobox');
    await user.selectOptions(selects[1], 'Other');
    await user.type(within(dialog).getByPlaceholderText('Specify case type...'), 'Attendance Concern');
    await user.click(within(dialog).getByRole('button', { name: 'Save Record' }));

    await waitFor(() => {
      expect(mockCreateCase).toHaveBeenCalledWith(
        expect.objectContaining({
          case_number: 'AES-CR-002',
          case_type: 'Attendance Concern',
          student_ids: [1],
        })
      );
    });
  });

  it('persists sidebar collapse, validates Change Password mismatch, and supports Forgot Password', async () => {
    const user = userEvent.setup();
    mockRequestPasswordReset.mockResolvedValue(undefined);
    localStorage.removeItem('aes_sidebar_collapsed');

    const { unmount } = renderWithRouter('/');
    expect(await screen.findByText('Welcome, Maria!')).toBeInTheDocument();

    // Collapse sidebar
    await user.click(screen.getByRole('button', { name: 'Toggle sidebar' }));
    expect(localStorage.getItem('aes_sidebar_collapsed')).toBe('1');

    // Open Change Password modal via profile menu and verify mismatch check
    await user.click(screen.getByText('Maria'));
    await user.click(screen.getByRole('button', { name: 'Change Password' }));
    const cpDialog = screen.getByRole('dialog');
    await user.type(within(cpDialog).getByLabelText('Current Password'), 'oldpass123');
    await user.type(within(cpDialog).getByLabelText('New Password'), 'newpass123');
    await user.type(within(cpDialog).getByLabelText('Confirm New Password'), 'different123');
    await user.click(within(cpDialog).getByRole('button', { name: 'Update Password' }));
    expect(within(cpDialog).getByText('New passwords do not match!')).toBeInTheDocument();
    unmount();

    // Test Forgot Password flow on LoginPage
    mockAuthState.session = null;
    renderWithRouter('/login');
    await user.click(await screen.findByRole('button', { name: 'Forgot Password?' }));
    const fpDialog = screen.getByRole('dialog');
    await user.type(within(fpDialog).getByLabelText('Email Address'), 'maria.santos@aes.edu.ph');
    await user.click(within(fpDialog).getByRole('button', { name: 'Send Recovery Email' }));

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('maria.santos@aes.edu.ph');
    });
  });
});
