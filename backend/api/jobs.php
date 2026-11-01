<?php
// jobs.php: the staff member's work on their own job (Step 5).
// Staff only. Actions: current (GET), start (POST), proof (POST).
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Columns sent to the staff screen. Timestamps are ISO UTC strings, like the other endpoints.
// Photos are included here because the staff member needs the problem photo and their own proof.
// The problem's coordinates tell staff where to go. The proof's coordinates and time are
// returned once the proof has been sent (C2).
$jobColumns = <<<SQL
    r.id,
    r.title,
    r.description,
    r.status,
    r.priority,
    c.name AS category_name,
    l.name AS location_name,
    r.before_photo,
    r.after_photo,
    r.proof_note,
    r.latitude,
    r.longitude,
    r.after_latitude,
    r.after_longitude,
    to_char(r.after_photo_taken_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS after_photo_taken_at,
    -- The admin's reason when proof was sent back. Only while the job is in progress.
    -- A reason is an in_progress timeline row written by an admin (staff never write admin rows).
    CASE WHEN r.status = 'in_progress' THEN (
        SELECT e.remark
        FROM request_events e
        JOIN users a ON a.id = e.changed_by AND a.role = 'admin'
        WHERE e.request_id = r.id AND e.status = 'in_progress'
        ORDER BY e.id DESC
        LIMIT 1
    ) END AS rejected_remark,
    to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
    to_char(r.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
SQL;

$jobFrom = '
    FROM requests r
    JOIN categories c ON c.id = r.category_id
    JOIN locations  l ON l.id = r.location_id
';

// Stop with an error after undoing the open transaction.
function failAndRollBack(PDO $conn, int $status, string $message): void {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    sendResponse(['error' => $message], $status);
}

// Load one job in the staff shape. Used after each change.
function loadJob(PDO $conn, int $id, string $columns, string $from): ?array {
    $stmt = $conn->prepare("SELECT $columns $from WHERE r.id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

// Read the request id from the body. Stops with 400 when it is missing or not a whole number.
function requireRequestId(array $data): int {
    return positiveInt($data['request_id'] ?? null, 'A request id is required');
}

// Lock the request row and check it is this staff member's job.
// Why FOR UPDATE: a double tap must not start or send proof twice.
// Returns the current status. Stops with 404 or 403 otherwise.
function lockOwnJob(PDO $conn, int $requestId, int $staffId): string {
    $stmt = $conn->prepare('SELECT status, assigned_to FROM requests WHERE id = ? FOR UPDATE');
    $stmt->execute([$requestId]);
    $row = $stmt->fetch();
    if (!$row) {
        failAndRollBack($conn, 404, 'Job not found');
    }
    if ((int) $row['assigned_to'] !== $staffId) {
        failAndRollBack($conn, 403, 'This job is not assigned to you');
    }
    return $row['status'];
}

// ---------- GET current: the staff member's one active job (or null) ----------
if ($method === 'GET' && $action === 'current') {
    $user = requireUser($conn, ['staff']);

    // The one-job index guarantees at most one row, so LIMIT 1 is safe.
    $stmt = $conn->prepare(
        "SELECT $jobColumns $jobFrom
         WHERE r.assigned_to = ?
           AND r.status IN ('assigned', 'in_progress', 'awaiting_proof')
         LIMIT 1"
    );
    $stmt->execute([$user['id']]);
    $job = $stmt->fetch();

    sendResponse(['job' => $job ?: null], 200);
}

// ---------- POST start: assigned -> in_progress ----------
// Note: start does not change assigned_to, so it cannot hit the one-job index (no 23505 branch needed).
if ($method === 'POST' && $action === 'start') {
    $user      = requireUser($conn, ['staff']);
    $requestId = requireRequestId(getJsonBody());

    $conn->beginTransaction();
    try {
        $status = lockOwnJob($conn, $requestId, (int) $user['id']);
        if ($status !== 'assigned') {
            failAndRollBack(
                $conn,
                409,
                $status === 'in_progress' ? 'You already started this job' : 'This job cannot be started'
            );
        }

        $update = $conn->prepare(
            "UPDATE requests SET status = 'in_progress', updated_at = now() WHERE id = ?"
        );
        $update->execute([$requestId]);

        $event = $conn->prepare(
            'INSERT INTO request_events (request_id, status, remark, changed_by)
             VALUES (?, ?, ?, ?)'
        );
        $event->execute([$requestId, 'in_progress', 'Work started', $user['id']]);

        $conn->commit();
    } catch (PDOException $e) {
        error_log('Start job failed: ' . $e->getMessage());
        failAndRollBack($conn, 500, 'Could not start the job');
    }

    sendResponse(['job' => loadJob($conn, $requestId, $jobColumns, $jobFrom)], 200);
}

// ---------- POST proof: in_progress -> awaiting_proof (photo, GPS, photo time, optional note) ----------
if ($method === 'POST' && $action === 'proof') {
    $user      = requireUser($conn, ['staff']);
    $data      = getJsonBody();
    $requestId = requireRequestId($data);
    $photo     = textField($data, 'after_photo', false);
    $note      = textField($data, 'proof_note');

    // Same photo rules as the before photo: raw base64, size limit.
    if ($photo === '') {
        sendResponse(['error' => 'A photo of the finished work is required'], 400);
    }
    if (strlen($photo) > 4000000) {
        sendResponse(['error' => 'Photo is too large'], 400);
    }
    if (!preg_match('/^[A-Za-z0-9+\/=\r\n]+$/', $photo)) {
        sendResponse(['error' => 'Photo must be sent as base64'], 400);
    }
    if (mb_strlen($note) > 300) {
        sendResponse(['error' => 'Note must be 300 characters or less'], 400);
    }

    // C2: proof needs the location and the photo time. Checked here, before any database work.
    [$latitude, $longitude, $takenAt] = readLocationFields(
        $data, 'after_latitude', 'after_longitude', 'after_photo_taken_at', true
    );

    $conn->beginTransaction();
    try {
        $status = lockOwnJob($conn, $requestId, (int) $user['id']);
        if ($status !== 'in_progress') {
            failAndRollBack(
                $conn,
                409,
                $status === 'assigned'
                    ? 'Start the job before sending proof'
                    : 'Proof can only be sent while the job is in progress'
            );
        }

        // Store the proof, its location and its time, and move the job forward in one step.
        $update = $conn->prepare(
            "UPDATE requests
             SET after_photo = ?, proof_note = ?,
                 after_latitude = ?, after_longitude = ?, after_photo_taken_at = ?,
                 status = 'awaiting_proof', updated_at = now()
             WHERE id = ?"
        );
        $update->execute([
            $photo, $note === '' ? null : $note,
            $latitude, $longitude, $takenAt,
            $requestId,
        ]);

        $event = $conn->prepare(
            'INSERT INTO request_events (request_id, status, remark, changed_by)
             VALUES (?, ?, ?, ?)'
        );
        $event->execute([$requestId, 'awaiting_proof', 'Proof uploaded', $user['id']]);

        $conn->commit();
    } catch (PDOException $e) {
        error_log('Proof upload failed: ' . $e->getMessage());
        failAndRollBack($conn, 500, 'Could not send the proof');
    }

    sendResponse(['job' => loadJob($conn, $requestId, $jobColumns, $jobFrom)], 200);
}

// Known action with the wrong HTTP method: 405. Anything else: unknown action.
$knownActions = ['current', 'start', 'proof'];
if (in_array($action, $knownActions, true)) {
    sendResponse(['error' => 'Method not allowed'], 405);
}
sendResponse(['error' => 'Invalid action'], 400);
?>