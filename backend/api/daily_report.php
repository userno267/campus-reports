<?php
// daily_report.php: the admin's daily record of jobs (Feature: daily report, Part A).
//
// GET daily_report.php?date=YYYY-MM-DD   (admin only)
//
// A RECORD ONLY. No rankings, targets, averages or productivity scores.
// The day is midnight to midnight in Philippine time (UTC+8), converted to UTC for the queries.
// Photos are never returned (keeps the PDF small on phones).
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'GET') {
    sendResponse(['error' => 'Method not allowed'], 405);
}

$user = requireUser($conn, ['admin']);

// ---------- Day window ----------
// Why DateTimeZone: the Philippines has no daylight saving, but using the zone name
// keeps the code correct and readable, and avoids hand-written +8 hour maths.
$phZone = new DateTimeZone('Asia/Manila');
$utcZone = new DateTimeZone('UTC');

$dateInput = $_GET['date'] ?? '';
if ($dateInput === '') {
    $day = new DateTimeImmutable('now', $phZone);
    $dateInput = $day->format('Y-m-d');
}
if (!is_string($dateInput) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateInput)) {
    sendResponse(['error' => 'Date must look like 2026-11-05'], 400);
}
$dayStart = DateTimeImmutable::createFromFormat('!Y-m-d', $dateInput, $phZone);
// createFromFormat accepts 2026-02-30 and rolls it over. Refuse that, so the date shown matches the date asked for.
if (!$dayStart || $dayStart->format('Y-m-d') !== $dateInput) {
    sendResponse(['error' => 'Date is not a real calendar day'], 400);
}
$dayEnd = $dayStart->modify('+1 day');

// The same window in UTC, as SQL strings. The database stores UTC.
$fromUtc = $dayStart->setTimezone($utcZone)->format('Y-m-d H:i:s');
$toUtc   = $dayEnd->setTimezone($utcZone)->format('Y-m-d H:i:s');

// Output format for timestamps, same as the rest of the API.
$iso = fn(string $col) => "to_char($col AT TIME ZONE 'UTC', 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"')";

// ---------- Summary numbers ----------
// new_reports: a request whose FIRST event (status submitted) falls in the window.
// completed:   a request whose completed event falls in the window.
// cancelled:   a request whose cancelled event falls in the window.
// still_open:  a request with ANY event in the window that is not finished yet now.
$summaryStmt = $conn->prepare(<<<SQL
    SELECT
      (SELECT COUNT(*) FROM request_events e
         WHERE e.status = 'submitted' AND e.changed_at >= ? AND e.changed_at < ?) AS new_reports,
      (SELECT COUNT(DISTINCT e.request_id) FROM request_events e
         WHERE e.status = 'completed' AND e.changed_at >= ? AND e.changed_at < ?) AS completed,
      (SELECT COUNT(DISTINCT e.request_id) FROM request_events e
         WHERE e.status = 'cancelled' AND e.changed_at >= ? AND e.changed_at < ?) AS cancelled,
      (SELECT COUNT(DISTINCT r.id) FROM requests r
         WHERE r.status IN ('assigned', 'in_progress', 'awaiting_proof')
           AND EXISTS (SELECT 1 FROM request_events e
                         WHERE e.request_id = r.id AND e.changed_at >= ? AND e.changed_at < ?)
      ) AS still_open
SQL);
$summaryStmt->execute([
    $fromUtc, $toUtc,
    $fromUtc, $toUtc,
    $fromUtc, $toUtc,
    $fromUtc, $toUtc,
]);
$summaryRow = $summaryStmt->fetch();
$summary = [
    'new_reports' => (int) $summaryRow['new_reports'],
    'completed'   => (int) $summaryRow['completed'],
    'still_open'  => (int) $summaryRow['still_open'],
    'cancelled'   => (int) $summaryRow['cancelled'],
];

// ---------- Completed jobs ----------
// One row per request completed in the window. Times come from request_events:
// MIN(changed_at) per status, so a job sent back and redone still shows its first times.
// The completed time is the completed event inside the window (the job may have had an
// earlier completed event only if it was reopened, which the system does not allow).
$completedStmt = $conn->prepare(<<<SQL
    SELECT
      r.id,
      r.title,
      r.description,
      r.priority,
      c.name  AS category_name,
      l.name  AS location_name,
      r.latitude,
      r.longitude,
      d.name  AS department_name,
      s.id    AS staff_id,
      s.name  AS staff_name,
      s.employee_id AS staff_employee_id,
      f.name  AS reporter_name,
      a.name  AS approved_by_name,
      r.proof_note,
      rv.rating,
      rv.comment AS review_comment,
      rvr.name AS reviewer_name,
      {$iso('MIN(CASE WHEN e.status = \'submitted\' THEN e.changed_at END)')} AS reported_at,
      {$iso('MIN(CASE WHEN e.status = \'assigned\' THEN e.changed_at END)')} AS assigned_at,
      {$iso('MIN(CASE WHEN e.status = \'in_progress\' THEN e.changed_at END)')} AS started_at,
      {$iso('MIN(CASE WHEN e.status = \'awaiting_proof\' THEN e.changed_at END)')} AS proof_sent_at,
      {$iso('MAX(CASE WHEN e.status = \'completed\' THEN e.changed_at END)')} AS completed_at,
      (SELECT COUNT(*) FROM request_events x
         WHERE x.request_id = r.id AND x.status = 'in_progress'
           AND x.changed_at > (SELECT MIN(y.changed_at) FROM request_events y
                                WHERE y.request_id = r.id AND y.status = 'awaiting_proof')
      ) AS send_back_count,
      (SELECT x.remark FROM request_events x
         WHERE x.request_id = r.id AND x.status = 'completed'
         ORDER BY x.changed_at DESC LIMIT 1) AS admin_remark
    FROM requests r
    JOIN request_events e ON e.request_id = r.id
    JOIN categories c ON c.id = r.category_id
    JOIN locations  l ON l.id = r.location_id
    LEFT JOIN departments d ON d.id = r.department_id
    LEFT JOIN users s  ON s.id  = r.assigned_to
    LEFT JOIN users f  ON f.id  = r.created_by
    LEFT JOIN users a  ON a.id  = (
        SELECT x.changed_by FROM request_events x
         WHERE x.request_id = r.id AND x.status = 'completed'
         ORDER BY x.changed_at DESC LIMIT 1)
    LEFT JOIN reviews rv ON rv.request_id = r.id
    LEFT JOIN users rvr  ON rvr.id = rv.created_by
    WHERE r.id IN (
        SELECT e2.request_id FROM request_events e2
         WHERE e2.status = 'completed' AND e2.changed_at >= ? AND e2.changed_at < ?
    )
    GROUP BY r.id, c.name, l.name, d.name, s.id, s.name, s.employee_id,
             f.name, a.name, rv.rating, rv.comment, rvr.name
    ORDER BY completed_at ASC, r.id ASC
SQL);
$completedStmt->execute([$fromUtc, $toUtc]);
$completed = $completedStmt->fetchAll();

// Turn the numeric columns into real numbers / null so the app gets clean JSON.
foreach ($completed as &$job) {
    $job['id']               = (int) $job['id'];
    $job['staff_id']         = $job['staff_id'] === null ? null : (int) $job['staff_id'];
    $job['send_back_count']  = (int) $job['send_back_count'];
    $job['latitude']         = $job['latitude'] === null ? null : (float) $job['latitude'];
    $job['longitude']        = $job['longitude'] === null ? null : (float) $job['longitude'];
    $job['rating']           = $job['rating'] === null ? null : (int) $job['rating'];
}
unset($job);

// ---------- Still open jobs ----------
// Requests with activity in the window that are not finished now.
// Current status is shown, so the admin sees where each one is.
$openStmt = $conn->prepare(<<<SQL
    SELECT
      r.id,
      r.title,
      r.priority,
      r.status,
      c.name AS category_name,
      l.name AS location_name,
      d.name AS department_name,
      s.name AS staff_name,
      s.employee_id AS staff_employee_id,
      f.name AS reporter_name,
      {$iso('MIN(CASE WHEN e.status = \'submitted\' THEN e.changed_at END)')} AS reported_at
    FROM requests r
    JOIN request_events e ON e.request_id = r.id
    JOIN categories c ON c.id = r.category_id
    JOIN locations  l ON l.id = r.location_id
    LEFT JOIN departments d ON d.id = r.department_id
    LEFT JOIN users s ON s.id = r.assigned_to
    LEFT JOIN users f ON f.id = r.created_by
    WHERE r.status IN ('assigned', 'in_progress', 'awaiting_proof')
      AND r.id IN (
        SELECT e2.request_id FROM request_events e2
         WHERE e2.changed_at >= ? AND e2.changed_at < ?
    )
    GROUP BY r.id, r.title, r.priority, r.status, c.name, l.name, d.name,
             s.name, s.employee_id, f.name
    ORDER BY reported_at ASC, r.id ASC
SQL);
$openStmt->execute([$fromUtc, $toUtc]);
$stillOpen = $openStmt->fetchAll();

foreach ($stillOpen as &$job) {
    $job['id'] = (int) $job['id'];
}
unset($job);

// ---------- Who did what (one row per completed job) ----------
// Built from the completed list, so it cannot disagree with the job blocks.
$whoDidWhat = [];
foreach ($completed as $job) {
    $whoDidWhat[] = [
        'request_id'    => $job['id'],
        'staff_name'    => $job['staff_name'],
        'location_name' => $job['location_name'],
        'completed_at'  => $job['completed_at'],
    ];
}

sendResponse([
    'date'         => $dateInput,
    'timezone'     => 'Asia/Manila',
    'window'       => [
        'from_utc' => $fromUtc,
        'to_utc'   => $toUtc,
    ],
    'generated_at' => (new DateTimeImmutable('now', $utcZone))->format('Y-m-d\TH:i:s\Z'),
    'generated_by' => ['id' => (int) $user['id'], 'name' => $user['name']],
    'summary'      => $summary,
    'completed'    => $completed,
    'still_open'   => $stillOpen,
    'who_did_what' => $whoDidWhat,
], 200);