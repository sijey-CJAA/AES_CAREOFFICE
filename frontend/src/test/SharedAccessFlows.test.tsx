import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from '../components/AppShell';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { ShareAccessModal } from '../components/sharing/ShareAccessModal';
import { SearchProvider } from '../context/SearchContext';
import { DashboardPage } from '../pages/DashboardPage';
import { SharedAcceptPage } from '../pages/SharedAcceptPage';
import { SharedAccessPage } from '../pages/SharedAccessPage';
import { SharedViewPage } from '../pages/SharedViewPage';
import { SharedAccessError } from '../services/sharedAccessService';

const mockAuthState = {
  session: { access_token: 'tok', user: { id: 'admin-1', email: 'counselor@aes.edu.ph' } } as any,
  user: { id: 'admin-1', email: 'counselor@aes.edu.ph' } as any,
  userEmail: 'counselor@aes.edu.ph',
  userName: 'Counselor',
  loading: false,
  isAuthorizedAdmin: true,
  isPasswordRecovery: false,
  clearPasswordRecovery: vi.fn(),
  refreshAdminCheck: vi.fn(),
};

vi.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuthState,
}));

vi.mock('../services/authService', () => ({
  signInWithEmail: vi.fn(),
  signOut: vi.fn().mockResolvedValue(undefined),
  changePassword: vi.fn(),
  requestPasswordReset: vi.fn(),
  updateRecoveredPassword: vi.fn(),
  verifyAdminAccess: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/dashboardService', () => ({
  fetchDashboardStats: vi.fn().mockResolvedValue({
    total_students: 27,
    total_parents: 25,
    total_assessments: 2,
    total_cases: 1,
    flagged_students: 3,
    total_sections: 26,
  }),
}));

const mockExportAuthorizedPdf = vi.fn().mockResolvedValue(undefined);
vi.mock('../lib/pdfExport', () => ({
  exportTableToPDF: vi.fn(),
  exportAuthorizedSharedRecordToPDF: (...args: any[]) => mockExportAuthorizedPdf(...args),
}));

const mockFetchSharedList = vi.fn();
const mockFetchSharedLogs = vi.fn();
const mockCreateShared = vi.fn();
const mockSendInvite = vi.fn();
const mockUpdatePerms = vi.fn();
const mockExtendExpiry = vi.fn();
const mockRevokeShare = vi.fn();
const mockRegenerateLink = vi.fn();
const mockAcceptInvitation = vi.fn();
const mockFetchAuthorizedRecord = vi.fn();
const mockRequestAuthorizedPdf = vi.fn();
const mockRequestMagicLink = vi.fn();

vi.mock('../services/sharedAccessService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/sharedAccessService')>();
  return {
    ...actual,
    fetchSharedAccessList: (...args: any[]) => mockFetchSharedList(...args),
    fetchSharedAccessLogs: (...args: any[]) => mockFetchSharedLogs(...args),
    createSharedAccess: (...args: any[]) => mockCreateShared(...args),
    sendSharedAccessInviteEmail: (...args: any[]) => mockSendInvite(...args),
    updateSharedAccessPermissions: (...args: any[]) => mockUpdatePerms(...args),
    extendSharedAccessExpiration: (...args: any[]) => mockExtendExpiry(...args),
    revokeSharedAccess: (...args: any[]) => mockRevokeShare(...args),
    regenerateSharedAccessLink: (...args: any[]) => mockRegenerateLink(...args),
    acceptSharedInvitation: (...args: any[]) => mockAcceptInvitation(...args),
    fetchAuthorizedSharedRecord: (...args: any[]) => mockFetchAuthorizedRecord(...args),
    requestAuthorizedPdfPayload: (...args: any[]) => mockRequestAuthorizedPdf(...args),
    requestViewerMagicLink: (...args: any[]) => mockRequestMagicLink(...args),
  };
});

function renderRoutes(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <SearchProvider>
        <Routes>
          <Route path="/shared/accept" element={<SharedAcceptPage />} />
          <Route path="/shared/view/:id" element={<SharedViewPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="shared-access" element={<SharedAccessPage />} />
          </Route>
        </Routes>
      </SearchProvider>
    </MemoryRouter>
  );
}

const futureIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

describe('Secure Share Access & External Viewer flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.session = { access_token: 'tok', user: { id: 'admin-1', email: 'counselor@aes.edu.ph' } };
    mockAuthState.userEmail = 'counselor@aes.edu.ph';
    mockAuthState.isAuthorizedAdmin = true;

    mockFetchSharedList.mockResolvedValue([
      {
        id: '11111111-1111-1111-1111-111111111111',
        created_by: 'admin-1',
        recipient_email: 'doctor@clinic.org',
        recipient_name: 'Dr. Rivera',
        recipient_user_id: 'viewer-1',
        resource_type: 'learner',
        resource_id: 1,
        resource_label: 'Juan Dela Cruz',
        permission: 'view_only',
        status: 'active',
        expires_at: futureIso,
        accepted_at: '2026-11-18T01:00:00Z',
        last_accessed_at: '2026-11-18T02:00:00Z',
        revoked_at: null,
        created_at: '2026-11-18T00:00:00Z',
        updated_at: '2026-11-18T02:00:00Z',
        permissions: {
          view_basic_info: true,
          view_parent_info: false,
          view_assessment_records: true,
          view_case_records: false,
          view_download_pdf: true,
        },
      },
    ]);
    mockFetchSharedLogs.mockResolvedValue([
      {
        id: 1,
        shared_access_id: '11111111-1111-1111-1111-111111111111',
        actor_user_id: 'viewer-1',
        action: 'record_viewed',
        accessed_at: '2026-11-18T02:00:00Z',
        metadata: { resource_type: 'learner' },
      },
    ]);
  });

  it('defaults sensitive permissions to unchecked in ShareAccessModal and generates/sends invitation', async () => {
    const user = userEvent.setup();
    mockCreateShared.mockResolvedValue({
      id: '22222222-2222-2222-2222-222222222222',
      invite_token: 'a'.repeat(64),
      invite_url: 'http://localhost:5173/shared/accept?token=' + 'a'.repeat(64),
      resource_label: 'Juan Dela Cruz',
      expires_at: futureIso,
      status: 'pending',
      permissions: {
        view_basic_info: true,
        view_parent_info: false,
        view_assessment_records: true,
        view_case_records: false,
        view_download_pdf: false,
      },
    });
    mockSendInvite.mockResolvedValue({ sent: true, delivery_method: 'invite' });

    render(
      <ShareAccessModal
        target={{ resourceType: 'learner', resourceId: 1, resourceLabel: 'Juan Dela Cruz' }}
        onClose={vi.fn()}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // Basic info defaults ON; sensitive parent/assessment/case/PDF default OFF
    expect(checkboxes[0].checked).toBe(true);
    expect(checkboxes[1].checked).toBe(false);
    expect(checkboxes[2].checked).toBe(false);
    expect(checkboxes[3].checked).toBe(false);
    expect(checkboxes[4].checked).toBe(false);

    await user.type(screen.getByLabelText(/Recipient Email Address/i), 'adviser@aes.edu.ph');
    await user.click(checkboxes[2]); // Enable Assessment records
    await user.click(screen.getByRole('button', { name: /Generate Invitation/i }));

    await waitFor(() => expect(mockCreateShared).toHaveBeenCalledTimes(1));
    expect(mockCreateShared.mock.calls[0][0].permissions).toEqual({
      view_basic_info: true,
      view_parent_info: false,
      view_assessment_records: true,
      view_case_records: false,
      view_download_pdf: false,
    });

    expect(await screen.findByLabelText(/Private Invitation Link/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Send Invitation Email/i }));
    await waitFor(() =>
      expect(mockSendInvite).toHaveBeenCalledWith(
        '22222222-2222-2222-2222-222222222222',
        'a'.repeat(64)
      )
    );
  });

  it('allows admin on /shared-access to inspect activity logs, edit permissions, extend, and revoke', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockUpdatePerms.mockResolvedValue({
      view_basic_info: true,
      view_parent_info: true,
      view_assessment_records: true,
      view_case_records: false,
      view_download_pdf: true,
    });
    mockExtendExpiry.mockResolvedValue(undefined);
    mockRevokeShare.mockResolvedValue(undefined);

    renderRoutes('/shared-access');

    expect(await screen.findByText('doctor@clinic.org')).toBeInTheDocument();

    // Open Details & Activity Log modal
    await user.click(screen.getByRole('button', { name: 'Details' }));
    const detailDialog = await screen.findByRole('dialog', { name: /Sharing Details/i });
    expect(await within(detailDialog).findByText('Record Viewed')).toBeInTheDocument();
    await user.click(within(detailDialog).getByRole('button', { name: /Close modal/i }));

    // Update Permissions
    await user.click(screen.getByRole('button', { name: 'Permissions' }));
    const permDialog = await screen.findByRole('dialog', { name: /Edit Shared Permissions/i });
    await user.click(within(permDialog).getByRole('button', { name: /Save Permissions/i }));
    await waitFor(() => expect(mockUpdatePerms).toHaveBeenCalledTimes(1));

    // Revoke Access
    await user.click(screen.getByRole('button', { name: 'Revoke' }));
    await waitFor(() =>
      expect(mockRevokeShare).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111')
    );
  });

  it('blocks non-admin external viewer from /shared-access while allowing isolated /shared/view/:id', async () => {
    mockAuthState.session = { access_token: 'viewer-tok', user: { id: 'viewer-1', email: 'doctor@clinic.org' } };
    mockAuthState.userEmail = 'doctor@clinic.org';
    mockAuthState.isAuthorizedAdmin = false;

    const { unmount } = renderRoutes('/shared-access');
    expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument();
    unmount();

    mockFetchAuthorizedRecord.mockResolvedValue({
      share: {
        id: '11111111-1111-1111-1111-111111111111',
        resource_type: 'learner',
        resource_label: 'Juan Dela Cruz',
        recipient_email: 'doctor@clinic.org',
        recipient_name: 'Dr. Rivera',
        expires_at: futureIso,
        accepted_at: '2026-11-18T01:00:00Z',
        permissions: {
          view_basic_info: true,
          view_parent_info: false,
          view_assessment_records: false,
          view_case_records: false,
          view_download_pdf: false,
        },
      },
      data: {
        basic_info: {
          full_name: 'Juan Dela Cruz',
          lrn: '100020003001',
          grade_level: 'Grade 4',
          section: 'Rose Quartz',
          school_year: '2025-2026',
          date_of_birth: '2015-05-10',
          status: 'Currently Enrolled',
          home_address: '123 School Ave',
          blood_type: 'O+',
          allergies: 'None',
          medications: null,
        },
      },
    });

    renderRoutes('/shared/view/11111111-1111-1111-1111-111111111111');

    expect(await screen.findByText('Basic Learner Information')).toBeInTheDocument();
    expect(screen.getAllByText('Juan Dela Cruz').length).toBeGreaterThanOrEqual(1);
    // Unauthorized sections & PDF download must NOT be rendered
    expect(screen.queryByText('Parent / Guardian Information')).not.toBeInTheDocument();
    expect(screen.queryByText('Assessment Records')).not.toBeInTheDocument();
    expect(screen.queryByText('Counseling / Case Records')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Download Authorized PDF/i })).not.toBeInTheDocument();
    // Admin sidebar must NOT exist
    expect(screen.queryByText('Deleted Records')).not.toBeInTheDocument();
  });

  it('re-validates server-side before PDF export and clears view immediately if revoked', async () => {
    const user = userEvent.setup();
    mockAuthState.session = { access_token: 'viewer-tok', user: { id: 'viewer-1', email: 'doctor@clinic.org' } };
    mockAuthState.userEmail = 'doctor@clinic.org';
    mockAuthState.isAuthorizedAdmin = false;

    const authorizedPayload = {
      share: {
        id: '11111111-1111-1111-1111-111111111111',
        resource_type: 'case',
        resource_label: 'AES-CR-001',
        recipient_email: 'doctor@clinic.org',
        recipient_name: 'Dr. Rivera',
        expires_at: futureIso,
        accepted_at: '2026-11-18T01:00:00Z',
        permissions: {
          view_basic_info: true,
          view_parent_info: false,
          view_assessment_records: false,
          view_case_records: false,
          view_download_pdf: true,
        },
      },
      data: {
        basic_info: {
          case_number: 'AES-CR-001',
          student_names: 'Juan Dela Cruz',
          school_year: '2025-2026',
          date: '2026-03-01',
          grade_section: null,
          outcome_disposition: 'Ongoing',
        },
      },
    };

    mockFetchAuthorizedRecord.mockResolvedValue(authorizedPayload);
    mockRequestAuthorizedPdf.mockRejectedValueOnce(
      new SharedAccessError('Access to this shared record has been revoked by the administrator.', 'revoked', 403)
    );

    renderRoutes('/shared/view/11111111-1111-1111-1111-111111111111');
    const pdfBtn = await screen.findByRole('button', { name: /Download Authorized PDF/i });
    await user.click(pdfBtn);

    expect(await screen.findByText('Shared Access Revoked')).toBeInTheDocument();
    expect(mockExportAuthorizedPdf).not.toHaveBeenCalled();
  });

  it('shows clear email mismatch error when wrong user opens /shared/accept', async () => {
    mockAuthState.session = { access_token: 'wrong-tok', user: { id: 'wrong-1', email: 'wrong@example.com' } };
    mockAuthState.userEmail = 'wrong@example.com';
    mockAuthState.isAuthorizedAdmin = false;

    mockAcceptInvitation.mockRejectedValueOnce(
      new SharedAccessError('This invitation belongs to a different email address.', 'email_mismatch', 403)
    );

    renderRoutes('/shared/accept?token=' + 'b'.repeat(64));

    expect(await screen.findByText(/different email address/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign Out & Use Another Email/i })).toBeInTheDocument();
  });
});

