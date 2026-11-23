import type {
  AuthorizedSharedResponse,
  SharedAssessmentData,
  SharedCaseData,
  SharedLearnerData,
  SharedReportData,
} from '../types/database';
import { formatDateTime, formatLongDate, formatShortDate } from './formatters';

export interface PdfExportOptions {
  filename: string;
  title?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

export async function exportTableToPDF({
  filename,
  title,
  headers,
  rows,
}: PdfExportOptions): Promise<void> {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const heading = title || `${filename.replace(/\.pdf$/i, '').toUpperCase()} REPORT`;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(heading, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });

  autoTable(doc, {
    startY: 22,
    head: [headers],
    body: rows.map((r) =>
      r.map((cell) => (cell === null || cell === undefined ? '' : String(cell)))
    ),
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [221, 221, 221],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
    },
    margin: { top: 20, left: 10, right: 10 },
  });

  doc.save(filename);
}

/**
 * Generates a strictly permission-filtered PDF for an external viewer.
 * Never reuses unrestricted admin table exports and only renders sections
 * explicitly present in the server-authorized payload.
 */
export async function exportAuthorizedSharedRecordToPDF(
  payload: AuthorizedSharedResponse
): Promise<void> {
  if (!payload.share.permissions.view_download_pdf) {
    throw new Error('PDF download is not permitted for this shared record.');
  }

  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 135, 90);
  doc.text('AES CARE OFFICE — AUTHORIZED SHARED RECORD', pageWidth / 2, 16, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Shared with: ${payload.share.recipient_email} | Access expires: ${formatDateTime(payload.share.expires_at)}`,
    pageWidth / 2,
    22,
    { align: 'center' }
  );

  let cursorY = 28;
  const addSection = (title: string, headers: string[], body: string[][]) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(title, 14, cursorY);
    autoTable(doc, {
      startY: cursorY + 3,
      head: [headers],
      body,
      styles: { fontSize: 8.5, cellPadding: 2.5, lineColor: [226, 232, 240], lineWidth: 0.2 },
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });
    const lastY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
    cursorY = (lastY ?? cursorY + 20) + 8;
  };

  if (payload.share.resource_type === 'learner') {
    const data = payload.data as SharedLearnerData;
    if (payload.share.permissions.view_basic_info && data.basic_info) {
      const b = data.basic_info;
      addSection('Basic Learner Information', ['Field', 'Value'], [
        ['Full Name', b.full_name || 'N/A'],
        ['LRN', b.lrn || 'N/A'],
        ['Grade & Section', `${b.grade_level || ''} ${b.section ? `- ${b.section}` : ''}`.trim() || 'N/A'],
        ['School Year', b.school_year || 'N/A'],
        ['Date of Birth', formatLongDate(b.date_of_birth)],
        ['Status', b.status || 'Unknown / Not Indicated'],
        ['Home Address', b.home_address || 'N/A'],
        ['Blood Type', b.blood_type || 'N/A'],
        ['Allergies', b.allergies || 'None'],
        ['Medications', b.medications || 'None'],
      ]);
    }
    if (payload.share.permissions.view_parent_info && data.parents) {
      addSection(
        'Parent / Guardian Information',
        ['Type', 'Full Name', 'Relationship', 'Mobile', 'Emergency Contact', 'Address'],
        data.parents.length > 0
          ? data.parents.map((p) => [
              p.parent_type || '',
              p.full_name || 'N/A',
              p.relationship || 'N/A',
              p.mobile_number || 'N/A',
              p.emergency_contact_number || 'N/A',
              p.home_address || 'N/A',
            ])
          : [['—', 'No parent records available', '', '', '', '']]
      );
    }
    if (payload.share.permissions.view_assessment_records && data.assessments) {
      addSection(
        'Assessment Records',
        ['Record #', 'Date', 'Provider', 'Diagnosis', 'Findings', 'Recommendations'],
        data.assessments.length > 0
          ? data.assessments.map((a) => [
              a.record_number || 'N/A',
              formatShortDate(a.date),
              a.assessment_provider || 'N/A',
              a.diagnosis || 'N/A',
              a.findings || 'N/A',
              a.recommendations || 'N/A',
            ])
          : [['—', 'No assessment records available', '', '', '', '']]
      );
    }
    if (payload.share.permissions.view_case_records && data.cases) {
      addSection(
        'Counseling / Case Records',
        ['Case #', 'Date', 'Type', 'Outcome', 'Description', 'Actions Taken'],
        data.cases.length > 0
          ? data.cases.map((c) => [
              c.case_number || 'N/A',
              formatShortDate(c.date),
              c.case_type || 'N/A',
              c.outcome_disposition || 'N/A',
              c.brief_description || 'N/A',
              c.actions_taken || 'N/A',
            ])
          : [['—', 'No case records available', '', '', '', '']]
      );
    }
  } else if (payload.share.resource_type === 'assessment') {
    const data = payload.data as SharedAssessmentData;
    if (payload.share.permissions.view_basic_info && data.basic_info) {
      const b = data.basic_info;
      addSection('Assessment Summary', ['Field', 'Value'], [
        ['Record Number', b.record_number || 'N/A'],
        ['Learner Name', b.student_name || 'N/A'],
        ['Date', formatLongDate(b.date)],
        ['School Year', b.school_year || 'N/A'],
        ['Grade & Section', b.grade_section || 'N/A'],
        ['Status', b.status || 'N/A'],
      ]);
    }
    if (payload.share.permissions.view_parent_info && data.parent_contact) {
      addSection('Parent Contact', ['Field', 'Value'], [
        ['Parent Contact Number', data.parent_contact.contact_number || 'N/A'],
      ]);
    }
    if (payload.share.permissions.view_assessment_records && data.assessment_details) {
      const d = data.assessment_details;
      addSection('Assessment Findings & Recommendations', ['Field', 'Details'], [
        ['Assessment Provider', d.assessment_provider || 'N/A'],
        ['Diagnosis', d.diagnosis || 'N/A'],
        ['Findings', d.findings || 'N/A'],
        ['Recommendations', d.recommendations || 'N/A'],
      ]);
    }
  } else if (payload.share.resource_type === 'case') {
    const data = payload.data as SharedCaseData;
    if (payload.share.permissions.view_basic_info && data.basic_info) {
      const b = data.basic_info;
      addSection('Case Register Summary', ['Field', 'Value'], [
        ['Case Number', b.case_number || 'N/A'],
        ['Student(s) Involved', b.student_names || 'N/A'],
        ['Date', formatLongDate(b.date)],
        ['School Year', b.school_year || 'N/A'],
        ['Outcome / Disposition', b.outcome_disposition || 'N/A'],
      ]);
    }
    if (payload.share.permissions.view_case_records && data.case_details) {
      const d = data.case_details;
      addSection('Counseling / Case Details', ['Field', 'Details'], [
        ['Case Type', d.case_type || 'N/A'],
        ['Brief Description', d.brief_description || 'N/A'],
        ['Actions Taken', d.actions_taken || 'N/A'],
      ]);
    }
  } else if (payload.share.resource_type === 'report') {
    const data = payload.data as SharedReportData;
    const summary = data.summary;
    const cases = data.cases ?? [];

    let dateRangeText = 'All Dates';
    if (summary?.date_from && summary?.date_to) {
      dateRangeText = `${formatShortDate(summary.date_from)} to ${formatShortDate(summary.date_to)}`;
    } else if (summary?.date_from) {
      dateRangeText = `From ${formatShortDate(summary.date_from)}`;
    } else if (summary?.date_to) {
      dateRangeText = `Until ${formatShortDate(summary.date_to)}`;
    }

    const summaryRows: string[][] = [
      ['Total Cases Shared', String(summary?.total_cases ?? cases.length)],
      ['Date Range', dateRangeText],
    ];
    if (summary?.school_year) summaryRows.push(['School Year Filter', summary.school_year]);
    if (summary?.case_type) summaryRows.push(['Case Type Filter', summary.case_type]);
    if (summary?.outcome) summaryRows.push(['Outcome Filter', summary.outcome]);

    addSection('Report Parameters', ['Filter', 'Value'], summaryRows);

    if (payload.share.permissions.view_basic_info) {
      const headers = ['Case #', 'Date', 'Student(s)', 'School Year', 'Grade & Section', 'Outcome'];
      if (payload.share.permissions.view_case_records) {
        headers.push('Case Type', 'Brief Description', 'Actions Taken');
      }

      const caseRows = cases.map((c) => {
        const row = [
          c.case_number || 'N/A',
          formatShortDate(c.date),
          c.student_names || 'Unknown',
          c.school_year || 'N/A',
          c.grade_section || 'N/A',
          c.outcome_disposition || 'N/A',
        ];
        if (payload.share.permissions.view_case_records) {
          row.push(
            c.case_type || 'N/A',
            c.brief_description || 'N/A',
            c.actions_taken || 'N/A'
          );
        }
        return row;
      });

      addSection(
        `Case Register (${cases.length} records)`,
        headers,
        caseRows.length > 0 ? caseRows : [['—', 'No case records found', '', '', '', '']]
      );
    }
  }

  const safeSlug = (payload.share.resource_label || payload.share.resource_type)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);
  doc.save(`shared_${payload.share.resource_type}_${safeSlug || 'record'}.pdf`);
}
