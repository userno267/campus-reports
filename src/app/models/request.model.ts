// Types for the request screens. Names match the API JSON keys exactly.

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

// ===== ADMIN (Step 4) =====

// One row in the admin queue (submitted and assigned requests). No photos.
export interface AdminRequestRow {
  id: number;
  title: string;
  description: string;
  status: RequestStatus;
  category_name: string;
  location_name: string;
  suggested_department_id: number;      // from the category default
  department_id: number | null;         // set by admin on review
  department_name: string | null;
  assigned_to: number | null;
  assigned_name: string | null;
  created_at: string;
  updated_at: string;
}

// One timeline row (every status change).
export interface RequestEvent {
  status: RequestStatus;
  remark: string | null;
  changed_by_name: string;
  changed_at: string;
}

// The detail view: the queue row plus both photos, the proof note, and the timeline.
export interface AdminRequestDetail extends AdminRequestRow {
  before_photo: string;                 // raw base64
  after_photo: string | null;           // filled in Step 5
  proof_note: string | null;            // filled in Step 5
  events: RequestEvent[];
}

// A staff member as the assign screen sees them.
export interface StaffMember {
  id: number;
  name: string;
  employee_id: string;
  department_id: number;
  department_name: string;
  is_available: boolean;                // false while they have an active job
  active_request_id: number | null;
}

// What the assign call sends. The server re-checks everything.
export interface AssignRequestPayload {
  request_id: number;
  department_id: number;
  staff_id: number;
  remark: string;                       // empty string when none
}

// What the cancel call sends.
export interface CancelRequestPayload {
  request_id: number;
  remark: string;
}

// ===== STAFF JOBS (Step 5) =====

// The one job a staff member is working on. Includes both photos and the proof note.
export interface StaffJob {
  id: number;
  title: string;
  description: string;
  status: RequestStatus;
  category_name: string;
  location_name: string;
  before_photo: string;                 // raw base64
  after_photo: string | null;           // raw base64, set when proof is sent
  proof_note: string | null;
  created_at: string;
  updated_at: string;
}

// What the proof call sends. proof_note is null when the staff member leaves it empty.
export interface SubmitProofPayload {
  request_id: number;
  after_photo: string;
  proof_note: string | null;
}