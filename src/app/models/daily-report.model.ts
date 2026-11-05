// Types for the admin daily report. Names match the API JSON keys from backend/api/daily_report.php.
// Timestamps are ISO strings in UTC, shown in Philippine time by the page and the PDF.
// A RECORD ONLY: there are no rankings, targets, averages or scores in this file.

import { RequestPriority } from './request.model';

// Counts for the top of the report.
export interface DailyReportSummary {
  new_reports: number;
  completed: number;
  still_open: number;
  cancelled: number;
}

// One job completed on the report day. Null means "not recorded" (for example no GPS fix, or no review).
export interface DailyReportCompletedJob {
  id: number;
  title: string;
  description: string;
  priority: RequestPriority | null;
  category_name: string;
  location_name: string;
  latitude: number | null;
  longitude: number | null;
  department_name: string | null;
  staff_id: number | null;
  staff_name: string | null;
  staff_employee_id: string | null;
  reporter_name: string | null;
  approved_by_name: string | null;
  proof_note: string | null;
  rating: number | null;
  review_comment: string | null;
  reviewer_name: string | null;
  reported_at: string | null;
  assigned_at: string | null;
  started_at: string | null;
  proof_sent_at: string | null;
  completed_at: string | null;
  send_back_count: number;
  admin_remark: string | null;
}

// One job that had activity on the report day but is not finished yet.
export interface DailyReportOpenJob {
  id: number;
  title: string;
  priority: RequestPriority | null;
  status: 'assigned' | 'in_progress' | 'awaiting_proof';
  category_name: string;
  location_name: string;
  department_name: string | null;
  staff_name: string | null;
  staff_employee_id: string | null;
  reporter_name: string | null;
  reported_at: string | null;
}

// The "Who did what" table row.
export interface DailyReportWhoRow {
  request_id: number;
  staff_name: string | null;
  location_name: string;
  completed_at: string | null;
}

// Whole response from daily_report.php.
export interface DailyReport {
  date: string;              // YYYY-MM-DD in Philippine time
  timezone: string;          // always "Asia/Manila"
  window: { from_utc: string; to_utc: string };
  generated_at: string;      // UTC ISO time the server built the report
  generated_by: { id: number; name: string };
  summary: DailyReportSummary;
  completed: DailyReportCompletedJob[];
  still_open: DailyReportOpenJob[];
  who_did_what: DailyReportWhoRow[];
}