export type ReportStatus = 'submitted' | 'validated' | 'tracked' | 'closed';
export type Priority = 'low' | 'medium' | 'high' | 'urgent'; // label only, not a deadline

export interface Category {
  id: number;
  name: string;
}

export interface Report {
  id: number;
  title: string;
  category_id: number | null;
  description: string | null;
  photo: string | null;          // base64 (stamped with coordinates + time)
  photo_taken_at: string | null; // ISO string
  latitude: number | null;
  longitude: number | null;
  location_text: string | null;
  weather_note: string | null;
  priority: Priority | null;
  status: ReportStatus;
  routed_to: number | null;      // just a field, NOT a task assignment
  created_by: number;
  created_at: string;            // ISO string (UTC)
}

export interface StatusHistory {
  id: number;
  report_id: number;
  status: ReportStatus;
  remark: string | null;
  changed_by: number;
  changed_at: string;
}

export interface NewReportInput {
  title: string;
  category_id: number | null;
  description: string | null;
}