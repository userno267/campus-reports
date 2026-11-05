// Builds the daily report as an A4 portrait PDF on the device.
// Record only: no charts, no rankings, no averages, no scores.
//
// Font note: the built-in PDF font covers Western letters only. Emoji and non-Latin scripts
// print as "?" in the PDF. The on-screen preview shows them normally.
//
// Times are shown in Philippine time (Asia/Manila) on every device, so the PDF and the preview match.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DailyReport, DailyReportCompletedJob, DailyReportOpenJob } from '../models/daily-report.model';

const PH_ZONE = 'Asia/Manila';

// Page layout in millimetres (A4 portrait is 210 x 297).
const MARGIN = 15;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Palette from the app (dark green for titles, muted grey for secondary text).
const GREEN: [number, number, number] = [41, 72, 61];
const MUTED: [number, number, number] = [96, 110, 102];
const RULE: [number, number, number] = [200, 210, 200];

// "5 Nov 2026, 2:30 PM" in Philippine time. Returns "-" for empty times.
export function formatPh(iso: string | null): string {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: PH_ZONE,
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso));
}

// Only the time part, for the "Who did what" table where the date is the same for every row.
export function formatPhTime(iso: string | null): string {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: PH_ZONE,
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(new Date(iso));
}

// "3 h 20 min" between two ISO times. A plain fact (a duration), not a deadline or a score.
export function formatDuration(fromIso: string | null, toIso: string | null): string {
  if (!fromIso || !toIso) return '-';
  const minutes = Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000);
  if (minutes < 0) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}

// Long text is cut to a sensible length for the table cell. The full text stays in the preview.
function clip(text: string | null | undefined, max: number): string {
  if (!text) return '-';
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

// Keeps text printable with the built-in font (drops characters it cannot draw).
// The "…" and bullets are already in the font. Other symbols become "?".
function safe(text: string): string {
  return text.replace(/[^\x00-\x7F\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2026\u2022]/g, '?');
}

// Writes a labelled line and moves the cursor down. Returns the new y position.
function writeLine(doc: jsPDF, label: string, value: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(safe(label), MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  const lines = doc.splitTextToSize(safe(value), CONTENT_WIDTH - 40);
  doc.text(lines, MARGIN + 40, y);
  return y + Math.max(1, lines.length) * 4.6;
}

// Starts a new page when the next block would not fit. Returns the y to continue from.
function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_HEIGHT - 25) {
    doc.addPage();
    return MARGIN + 6;
  }
  return y;
}

// A section title with a thin rule under it.
function sectionTitle(doc: jsPDF, title: string, y: number): number {
  y = ensureSpace(doc, y, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...GREEN);
  doc.text(safe(title), MARGIN, y);
  doc.setDrawColor(...RULE);
  doc.line(MARGIN, y + 2, PAGE_WIDTH - MARGIN, y + 2);
  doc.setTextColor(0, 0, 0);
  return y + 8;
}

// One completed job block: request, people, timeline, work done.
function writeCompletedJob(doc: jsPDF, job: DailyReportCompletedJob, y: number): number {
  y = ensureSpace(doc, y, 60);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...GREEN);
  doc.text(safe(`#${job.id}  ${clip(job.title, 90)}`), MARGIN, y);
  doc.setTextColor(0, 0, 0);
  y += 6;

  y = writeLine(doc, 'Problem', clip(job.description, 600), y);
  y = writeLine(doc, 'Category', job.category_name, y);
  y = writeLine(doc, 'Location', job.location_name, y);
  if (job.latitude !== null && job.longitude !== null) {
    y = writeLine(doc, 'Coordinates', `${job.latitude.toFixed(5)}, ${job.longitude.toFixed(5)}`, y);
  }
  y = writeLine(doc, 'Department', job.department_name ?? '-', y);
  y = writeLine(doc, 'Priority', job.priority ?? 'Not set', y);
  y = writeLine(doc, 'Reported by', job.reporter_name ?? '-', y);
  y = writeLine(
    doc,
    'Done by',
    job.staff_name
      ? `${job.staff_name}${job.staff_employee_id ? ` (ID ${job.staff_employee_id})` : ''}`
      : '-',
    y,
  );
  y = writeLine(doc, 'Approved by', job.approved_by_name ?? '-', y);

  // Timeline: each step is a plain time, not a target.
  y = writeLine(doc, 'Reported', formatPh(job.reported_at), y);
  y = writeLine(doc, 'Assigned', formatPh(job.assigned_at), y);
  y = writeLine(doc, 'Started', formatPh(job.started_at), y);
  y = writeLine(doc, 'Proof sent', formatPh(job.proof_sent_at), y);
  y = writeLine(doc, 'Completed', formatPh(job.completed_at), y);
  y = writeLine(doc, 'Time to complete', formatDuration(job.reported_at, job.completed_at), y);

  if (job.send_back_count > 0) {
    y = writeLine(
      doc,
      'Sent back',
      `${job.send_back_count} time${job.send_back_count === 1 ? '' : 's'}`,
      y,
    );
  }

  y = writeLine(doc, 'Work done', job.proof_note ?? 'No note written.', y);
  if (job.admin_remark) {
    y = writeLine(doc, 'Admin remark', job.admin_remark, y);
  }

  if (job.rating !== null) {
    const who = job.reviewer_name ? ` by ${job.reviewer_name}` : '';
    y = writeLine(doc, 'Rating', `${job.rating} / 5${who}`, y);
    if (job.review_comment) {
      y = writeLine(doc, 'Comment', job.review_comment, y);
    }
  } else {
    y = writeLine(doc, 'Rating', 'Not rated yet', y);
  }

  // Thin separator between jobs.
  doc.setDrawColor(...RULE);
  doc.line(MARGIN, y + 1, PAGE_WIDTH - MARGIN, y + 1);
  return y + 6;
}

// Builds the PDF and returns it as a Blob. The caller decides how to save or share it.
export function buildDailyReportPdf(report: DailyReport): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  // ---------- Page 1 header ----------
  let y = MARGIN + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...GREEN);
  doc.text('Daily Report', MARGIN, y);
  y += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Date: ${report.date} (Philippine time)`, MARGIN, y); y += 5;
  doc.text(`Generated on: ${formatPh(report.generated_at)}`, MARGIN, y); y += 5;
  doc.text(`Generated by: ${safe(report.generated_by.name)}`, MARGIN, y); y += 6;

  doc.setDrawColor(...RULE);
  doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
  y += 7;

  // ---------- Summary ----------
  y = sectionTitle(doc, 'Summary', y);
  y = writeLine(doc, 'Completed', String(report.summary.completed), y);
  y = writeLine(doc, 'Still open', String(report.summary.still_open), y);
  y = writeLine(doc, 'New reports', String(report.summary.new_reports), y);
  y = writeLine(doc, 'Cancelled', String(report.summary.cancelled), y);
  y += 4;

  // ---------- Who did what ----------
  y = sectionTitle(doc, 'Who did what', y);
  if (report.who_did_what.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('No jobs completed on this date.', MARGIN, y);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Staff', 'Request', 'Location', 'Completed']],
      body: report.who_did_what.map((row) => [
        safe(row.staff_name ?? '-'),
        `#${row.request_id}`,
        safe(clip(row.location_name, 40)),
        formatPhTime(row.completed_at),
      ]),
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [232, 239, 227], textColor: GREEN, fontStyle: 'bold' },
    });
    // autoTable stores where its table ended on the document.
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // ---------- Completed jobs ----------
  if (report.completed.length > 0) {
    y = sectionTitle(doc, 'Completed jobs', y);
    for (const job of report.completed) {
      y = writeCompletedJob(doc, job, y);
    }
  }

  // ---------- Still open ----------
  y = sectionTitle(doc, 'Still open', y);
  if (report.still_open.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('No open jobs with activity on this date.', MARGIN, y);
    y += 8;
  } else {
    for (const job of report.still_open as DailyReportOpenJob[]) {
      y = ensureSpace(doc, y, 22);
      y = writeLine(
        doc,
        `#${job.id}`,
        `${safe(clip(job.title, 90))} | ${job.status.replace('_', ' ')} | ` +
          `${job.staff_name ?? 'No staff yet'} | Reported ${formatPh(job.reported_at)}`,
        y,
      );
      y += 2;
    }
  }

  // ---------- Sign-off (printed copy) ----------
  y = ensureSpace(doc, y, 36);
  y += 10;
  doc.setDrawColor(0, 0, 0);
  doc.line(MARGIN, y, MARGIN + 70, y);
  doc.line(PAGE_WIDTH - MARGIN - 70, y, PAGE_WIDTH - MARGIN, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Prepared by', MARGIN, y + 5);
  doc.text('Approved by', PAGE_WIDTH - MARGIN - 70, y + 5);

  // ---------- Footer on every page: "Page X of Y" ----------
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(
      `Page ${page} of ${pageCount}`,
      PAGE_WIDTH / 2,
      PAGE_HEIGHT - 8,
      { align: 'center' },
    );
    doc.setTextColor(0, 0, 0);
  }

  return doc.output('blob');
}

// File name for the download, for example "daily-report-2026-11-05.pdf".
export function dailyReportFileName(report: DailyReport): string {
  return `daily-report-${report.date}.pdf`;
}