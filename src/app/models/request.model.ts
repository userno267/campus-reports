// Types for the request screens. Names match the API JSON keys exactly.
// Kept separate from report.model.ts so the old admin screen still compiles until Step 4.

// Status values match the CHECK constraint in init.sql.
export type RequestStatus =
  | 'submitted'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_proof'
  | 'completed'
  | 'cancelled';

// A campus location (Room 101, Library, ...). Faculty pick one from a list.
export interface CampusLocation {
  id: number;
  name: string;
}

// A problem category. default_department_id is the suggested department (admin can change it).
export interface RequestCategory {
  id: number;
  name: string;
  default_department_id: number;
}

// One row in "My Requests". Photos are not included in lists.
// Timestamps are ISO strings in UTC, for example "2026-10-30T12:34:56Z".
export interface RequestSummary {
  id: number;
  title: string;
  description: string;
  category_name: string;
  location_name: string;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
}

// What the New Report form sends. before_photo is raw base64 (no "data:" prefix).
export interface CreateRequestPayload {
  title: string;
  category_id: number;
  location_id: number;
  description: string;
  before_photo: string;
}