// Types for the request screens. Names match the API JSON keys exactly.

// Status values match the CHECK constraint in init.sql.
export type RequestStatus =
  | 'submitted'
  | 'assigned'
  | 'in_progress'
  | 'awaiting_proof'
  | 'completed'
  | 'cancelled';

// Priority is only a label set by the admin when assigning. Matches the CHECK in init.sql.
// null means the request has not been assigned yet (or was assigned before priority existed).
export type RequestPriority = 'low' | 'medium' | 'high' | 'urgent';

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
  priority: RequestPriority | null;     // Feature 3: set by the admin at assign time
  staff_name: string | null;            // Step 6: only set when the request is completed
  has_review: boolean;                  // Step 6: true once the faculty member has rated it
  review_rating: number | null;         // Step 6: 1 to 5, or null when not rated
  created_at: string;
  updated_at: string;
}

// What the New Report form sends. before_photo is raw base64 (no "data:" prefix).
// Feature 4: latitude, longitude and photo_taken_at are null when the device could not provide them.
// The coordinates are always both set or both null.
export interface CreateRequestPayload {
  title: string;
  category_id: number;
  location_id: number;
  description: string;
  before_photo: string;
  latitude: number | null;
  longitude: number | null;
  photo_taken_at: string | null;        // ISO string (UTC), or null
}

// ===== ADMIN (Step 4) =====

// One row in the admin queue (submitted and assigned requests). No photos.
export interface AdminRequestRow {
  id: number;
  title: string;
  description: string;
  status: RequestStatus;
  priority: RequestPriority | null;     // Feature 3
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

// The faculty rating for one request, as the admin sees it (Step 8).
export interface RequestReview {
  rating: number;                       // 1 to 5
  comment: string | null;
  reviewer_name: string;                // the faculty member who rated
  created_at: string;
}

// The detail view: the queue row plus both photos, the proof note, the GPS fix, and the timeline.
export interface AdminRequestDetail extends AdminRequestRow {
  before_photo: string;                 // raw base64
  after_photo: string | null;           // set when staff send proof (Step 5)
  proof_note: string | null;            // set when staff send proof (Step 5)
  latitude: number | null;              // Feature 4
  longitude: number | null;             // Feature 4
  photo_taken_at: string | null;        // Feature 4
  after_latitude: number | null;        // B2: where the proof photo was taken
  after_longitude: number | null;       // B2
  after_photo_taken_at: string | null;  // B2: when the proof photo was taken (ISO UTC)
  events: RequestEvent[];
  review?: RequestReview | null;        // Step 8: null until the faculty member rates it
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
  priority: RequestPriority;            // Feature 3: required
  remark: string;                       // empty string when none
}

// What the cancel call sends.
export interface CancelRequestPayload {
  request_id: number;
  remark: string;
}

// ===== STAFF JOBS (Step 5) =====

// The one job a staff member is working on. Includes both photos, the proof note,
// the problem's location, and (once sent) the proof's location and photo time.
export interface StaffJob {
  id: number;
  title: string;
  description: string;
  status: RequestStatus;
  priority: RequestPriority | null;     // Feature 3
  category_name: string;
  location_name: string;
  before_photo: string;                 // raw base64
  after_photo: string | null;           // raw base64, set when proof is sent
  proof_note: string | null;
  rejected_remark: string | null;       // set when the admin sent the proof back (in_progress only)
  latitude: number | null;              // Feature 4: where the problem was reported
  longitude: number | null;             // Feature 4
  after_latitude: number | null;        // C2: where the proof photo was taken
  after_longitude: number | null;       // C2
  after_photo_taken_at: string | null;  // C2: when the proof photo was taken (ISO UTC)
  created_at: string;
  updated_at: string;
}

// What the proof call sends. The location and photo time are required by the server.
export interface SubmitProofPayload {
  request_id: number;
  after_photo: string;
  proof_note: string | null;
  after_latitude: number;
  after_longitude: number;
  after_photo_taken_at: string;         // ISO string (UTC)
}

// The location and time captured with a proof photo, before it is sent.
// Any field can be null while the phone is still getting its GPS fix.
export interface ProofCapture {
  latitude: number | null;
  longitude: number | null;
  takenAt: string | null;
}

// ===== REVIEWS (Step 6) =====

// What the rating call sends. comment is null when the faculty member leaves it empty.
export interface CreateReviewPayload {
  request_id: number;
  rating: number;                       // 1 to 5
  comment: string | null;
}

// ===== REQUEST DETAILS (Feature 2) =====

// One rating as the faculty member sees it on their own request.
export interface FacultyReview {
  rating: number;                       // 1 to 5
  comment: string | null;
  created_at: string;
}

// The faculty detail view: one of my own requests, with both photos, the GPS fix, the timeline and the rating.
export interface FacultyRequestDetail extends RequestSummary {
  before_photo: string;                 // raw base64
  after_photo: string | null;           // raw base64, set when staff send proof
  proof_note: string | null;
  latitude: number | null;              // Feature 4
  longitude: number | null;             // Feature 4
  photo_taken_at: string | null;        // Feature 4
  after_latitude: number | null;        // B2: where the proof photo was taken
  after_longitude: number | null;       // B2
  after_photo_taken_at: string | null;  // B2: when the proof photo was taken (ISO UTC)
  events: RequestEvent[];
  review: FacultyReview | null;         // null until the faculty member rates it
}

// ===== STAFF REVIEWS (Step 7) =====

// One review about the logged-in staff member.
export interface StaffReview {
  id: number;
  request_id: number;
  rating: number;                       // 1 to 5
  comment: string | null;
  title: string;                        // the request title
  location_name: string;
  reviewer_name: string;                // the faculty member who rated
  created_at: string;
}

// The reviews plus a plain count and average. average is null when there are no reviews.
export interface StaffReviewList {
  reviews: StaffReview[];
  summary: { count: number; average: number | null };
}