<?php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Columns for faculty lists (Step 3, extended in Step 6 with the review flag). Photos are left out on purpose.
// Why staff_name only when completed: a cancelled request keeps assigned_to for history,
// and showing that name to faculty would be misleading.
$requestColumns = <<<SQL
    r.id,
    r.title,
    r.description,
    r.status,
    c.name AS category_name,
    l.name AS location_name,
    CASE WHEN r.status = 'completed' THEN s.name END AS staff_name,
    (rv.id IS NOT NULL) AS has_review,
    rv.rating AS review_rating,
    to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
    to_char(r.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
SQL;

// Columns and joins for the admin screens. Photos are left out of lists.
// Why: admins need the department and the assigned staff member, not only the category.
$adminColumns = <<<SQL
    r.id,
    r.title,
    r.description,
    r.status,
    c.name AS category_name,
    c.default_department_id AS suggested_department_id,
    l.name AS location_name,
    r.department_id,
    d.name AS department_name,
    r.assigned_to,
    u.name AS assigned_name,
    to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
    to_char(r.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
SQL;

$adminFrom = '
    FROM requests r
    JOIN categories c ON c.id = r.category_id
    JOIN locations  l ON l.id = r.location_id
    LEFT JOIN departments d ON d.id = r.department_id
    LEFT JOIN users       u ON u.id = r.assigned_to
';

// Stop with an error after undoing the open transaction.
// Why: one helper keeps every error path the same and avoids forgotten rollbacks.
function failAndRollBack(PDO $conn, int $status, string $message): void {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    sendResponse(['error' => $message], $status);
}

// Load one request in the admin shape. Used by detail and after each change.
function loadAdminRequest(PDO $conn, int $id, string $columns, string $from): ?array {
    $stmt = $conn->prepare("SELECT $columns $from WHERE r.id = ?");
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    return $row ?: null;
}

// ---------- POST create a request (faculty only) ----------
if ($method === 'POST' && $action === 'create') {
    $user = requireUser($conn, ['faculty']);
    $data = getJsonBody();

    $title       = trim((string) ($data['title'] ?? ''));
    $description = trim((string) ($data['description'] ?? ''));
    $categoryId  = $data['category_id'] ?? null;
    $locationId  = $data['location_id'] ?? null;
    $photo       = (string) ($data['before_photo'] ?? '');

    // Server-side checks. The browser checks too, but the server never trusts the browser.
    if (mb_strlen($title) < 3 || mb_strlen($title) > 80) {
        sendResponse(['error' => 'Title must be 3 to 80 characters'], 400);
    }
    if ($description === '' || mb_strlen($description) > 500) {
        sendResponse(['error' => 'Description is required (max 500 characters)'], 400);
    }
    if (!is_numeric($categoryId) || !is_numeric($locationId)) {
        sendResponse(['error' => 'Choose a category and a location'], 400);
    }
    if ($photo === '') {
        sendResponse(['error' => 'A before photo is required'], 400);
    }
    if (strlen($photo) > 4000000) {
        sendResponse(['error' => 'Photo is too large'], 400);
    }
    // The photo must be raw base64 (no "data:image/..." prefix).
    if (!preg_match('/^[A-Za-z0-9+\/=\r\n]+$/', $photo)) {
        sendResponse(['error' => 'Photo must be sent as base64'], 400);
    }

    // Make sure the category and location really exist.
    $catCheck = $conn->prepare('SELECT 1 FROM categories WHERE id = ?');
    $catCheck->execute([(int) $categoryId]);
    if ($catCheck->fetchColumn() === false) {
        sendResponse(['error' => 'Category not found'], 400);
    }

    $locCheck = $conn->prepare('SELECT 1 FROM locations WHERE id = ?');
    $locCheck->execute([(int) $locationId]);
    if ($locCheck->fetchColumn() === false) {
        sendResponse(['error' => 'Location not found'], 400);
    }

    // Write the request AND its first timeline row together, or neither.
    $conn->beginTransaction();
    try {
        $insert = $conn->prepare(
            'INSERT INTO requests (title, description, category_id, location_id, before_photo, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             RETURNING id'
        );
        $insert->execute([
            $title, $description, (int) $categoryId, (int) $locationId,
            $photo, 'submitted', $user['id'],
        ]);
        $newId = (int) $insert->fetchColumn();

        // Every status change writes a row to request_events (the timeline).
        $event = $conn->prepare(
            'INSERT INTO request_events (request_id, status, remark, changed_by)
             VALUES (?, ?, ?, ?)'
        );
        $event->execute([$newId, 'submitted', 'Request submitted', $user['id']]);

        $conn->commit();
    } catch (PDOException $e) {
        $conn->rollBack();
        error_log('Create request failed: ' . $e->getMessage());
        sendResponse(['error' => 'Could not submit the request'], 500);
    }

    sendResponse(['request' => ['id' => $newId, 'status' => 'submitted']], 201);
}

// ---------- GET my requests (faculty only) ----------
if ($method === 'GET' && $action === 'mine') {
    $user = requireUser($conn, ['faculty']);

    $stmt = $conn->prepare(
        'SELECT ' . $requestColumns . '
         FROM requests r
         JOIN categories c ON c.id = r.category_id
         JOIN locations  l ON l.id = r.location_id
         LEFT JOIN users   s  ON s.id = r.assigned_to
         LEFT JOIN reviews rv ON rv.request_id = r.id
         WHERE r.created_by = ?
         ORDER BY r.created_at DESC'
    );
    $stmt->execute([$user['id']]);

    sendResponse(['requests' => $stmt->fetchAll()], 200);
}

// ---------- GET queue: requests waiting for admin action (admin only) ----------
if ($method === 'GET' && $action === 'queue') {
    requireUser($conn, ['admin']);

    // submitted = needs a department and staff. assigned = can still be reassigned or cancelled.
    // awaiting_proof (Step 6) = staff sent proof, the admin must review it and mark completed.
    // Proof requests are listed first because someone is waiting on them.
    $stmt = $conn->prepare(
        "SELECT $adminColumns $adminFrom
         WHERE r.status IN ('submitted', 'assigned', 'awaiting_proof')
         ORDER BY (r.status = 'awaiting_proof') DESC, r.created_at DESC"
    );
    $stmt->execute();

    sendResponse(['requests' => $stmt->fetchAll()], 200);
}

// ---------- GET detail: one request with photos and timeline (admin only) ----------
if ($method === 'GET' && $action === 'detail') {
    requireUser($conn, ['admin']);

    $id = $_GET['id'] ?? '';
    if (!ctype_digit((string) $id)) {
        sendResponse(['error' => 'A request id is required'], 400);
    }

    // The detail view also needs both photos and the proof note.
    $stmt = $conn->prepare(
        "SELECT $adminColumns, r.before_photo, r.after_photo, r.proof_note $adminFrom
         WHERE r.id = ?"
    );
    $stmt->execute([(int) $id]);
    $request = $stmt->fetch();
    if (!$request) {
        sendResponse(['error' => 'Request not found'], 404);
    }

    // Timeline: every status change, oldest first. Nowdoc keeps the quotes simple.
    $events = $conn->prepare(<<<'SQL'
        SELECT e.status,
               e.remark,
               u.name AS changed_by_name,
               to_char(e.changed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS changed_at
        FROM request_events e
        JOIN users u ON u.id = e.changed_by
        WHERE e.request_id = ?
        ORDER BY e.changed_at, e.id
    SQL);
    $events->execute([(int) $id]);
    $request['events'] = $events->fetchAll();

    sendResponse(['request' => $request], 200);
}

// ---------- POST assign (or reassign) a request (admin only) ----------
if ($method === 'POST' && $action === 'assign') {
    $admin = requireUser($conn, ['admin']);
    $data  = getJsonBody();

    $requestId    = $data['request_id'] ?? null;
    $departmentId = $data['department_id'] ?? null;
    $staffId      = $data['staff_id'] ?? null;
    $remark       = trim((string) ($data['remark'] ?? ''));

    if (!is_numeric($requestId) || !is_numeric($departmentId) || !is_numeric($staffId)) {
        sendResponse(['error' => 'Choose a department and a staff member'], 400);
    }
    if (mb_strlen($remark) > 300) {
        sendResponse(['error' => 'Remark must be 300 characters or less'], 400);
    }
    $requestId    = (int) $requestId;
    $departmentId = (int) $departmentId;
    $staffId      = (int) $staffId;

    $conn->beginTransaction();
    try {
        // Lock the request row so two admins cannot change it at the same moment.
        $cur = $conn->prepare('SELECT status FROM requests WHERE id = ? FOR UPDATE');
        $cur->execute([$requestId]);
        $current = $cur->fetch();
        if (!$current) {
            failAndRollBack($conn, 404, 'Request not found');
        }
        if (!in_array($current['status'], ['submitted', 'assigned'], true)) {
            failAndRollBack($conn, 409, 'This request can no longer be assigned');
        }

        $deptCheck = $conn->prepare('SELECT 1 FROM departments WHERE id = ?');
        $deptCheck->execute([$departmentId]);
        if ($deptCheck->fetchColumn() === false) {
            failAndRollBack($conn, 400, 'Department not found');
        }

        // The chosen person must be staff, and must belong to the chosen department.
        $staffStmt = $conn->prepare('SELECT role, department_id FROM users WHERE id = ?');
        $staffStmt->execute([$staffId]);
        $staffRow = $staffStmt->fetch();
        if (!$staffRow || $staffRow['role'] !== 'staff') {
            failAndRollBack($conn, 400, 'Selected person is not a staff member');
        }
        if ((int) $staffRow['department_id'] !== $departmentId) {
            failAndRollBack($conn, 400, 'That staff member belongs to a different department');
        }

        // Early busy check. Excluding this request lets someone be reassigned to the same request.
        $busy = $conn->prepare(
            "SELECT 1 FROM requests
             WHERE assigned_to = ? AND id <> ?
               AND status IN ('assigned', 'in_progress', 'awaiting_proof')
             LIMIT 1"
        );
        $busy->execute([$staffId, $requestId]);
        if ($busy->fetchColumn() !== false) {
            failAndRollBack($conn, 409, 'Staff member is already busy');
        }

        $update = $conn->prepare(
            "UPDATE requests
             SET department_id = ?, assigned_to = ?, status = 'assigned', updated_at = now()
             WHERE id = ?"
        );
        $update->execute([$departmentId, $staffId, $requestId]);

        // Timeline row. The default remark says whether this was a first assignment or a reassignment.
        $defaultRemark = $current['status'] === 'assigned' ? 'Reassigned to staff' : 'Assigned to staff';
        $event = $conn->prepare(
            'INSERT INTO request_events (request_id, status, remark, changed_by)
             VALUES (?, ?, ?, ?)'
        );
        $event->execute([$requestId, 'assigned', $remark !== '' ? $remark : $defaultRemark, $admin['id']]);

        $conn->commit();
    } catch (PDOException $e) {
        // 23505 = unique violation. The one-job index caught two admins assigning at once.
        if ($e->getCode() === '23505') {
            failAndRollBack($conn, 409, 'Staff member is already busy');
        }
        error_log('Assign failed: ' . $e->getMessage());
        failAndRollBack($conn, 500, 'Could not assign the request');
    }

    sendResponse(['request' => loadAdminRequest($conn, $requestId, $adminColumns, $adminFrom)], 200);
}

// ---------- POST cancel a request (admin only, before work starts) ----------
if ($method === 'POST' && $action === 'cancel') {
    $admin = requireUser($conn, ['admin']);
    $data  = getJsonBody();

    $requestId = $data['request_id'] ?? null;
    $remark    = trim((string) ($data['remark'] ?? ''));

    if (!is_numeric($requestId)) {
        sendResponse(['error' => 'A request id is required'], 400);
    }
    if (mb_strlen($remark) > 300) {
        sendResponse(['error' => 'Remark must be 300 characters or less'], 400);
    }
    $requestId = (int) $requestId;

    $conn->beginTransaction();
    try {
        $cur = $conn->prepare('SELECT status FROM requests WHERE id = ? FOR UPDATE');
        $cur->execute([$requestId]);
        $current = $cur->fetch();
        if (!$current) {
            failAndRollBack($conn, 404, 'Request not found');
        }
        if (!in_array($current['status'], ['submitted', 'assigned'], true)) {
            failAndRollBack($conn, 409, 'This request can no longer be cancelled');
        }

        // assigned_to is kept for history. The one-job index ignores cancelled rows,
        // so the staff member becomes available again straight away.
        $update = $conn->prepare("UPDATE requests SET status = 'cancelled', updated_at = now() WHERE id = ?");
        $update->execute([$requestId]);

        $event = $conn->prepare(
            'INSERT INTO request_events (request_id, status, remark, changed_by)
             VALUES (?, ?, ?, ?)'
        );
        $event->execute([$requestId, 'cancelled', $remark !== '' ? $remark : 'Cancelled by admin', $admin['id']]);

        $conn->commit();
    } catch (PDOException $e) {
        error_log('Cancel failed: ' . $e->getMessage());
        failAndRollBack($conn, 500, 'Could not cancel the request');
    }

    sendResponse(['request' => loadAdminRequest($conn, $requestId, $adminColumns, $adminFrom)], 200);
}

// ---------- POST complete: awaiting_proof -> completed (admin only) ----------
if ($method === 'POST' && $action === 'complete') {
    $admin = requireUser($conn, ['admin']);
    $data  = getJsonBody();

    $requestId = $data['request_id'] ?? null;
    $remark    = trim((string) ($data['remark'] ?? ''));

    if (!is_numeric($requestId)) {
        sendResponse(['error' => 'A request id is required'], 400);
    }
    if (mb_strlen($remark) > 300) {
        sendResponse(['error' => 'Remark must be 300 characters or less'], 400);
    }
    $requestId = (int) $requestId;

    $conn->beginTransaction();
    try {
        // Lock the row so a double tap or a second admin cannot complete it twice.
        $cur = $conn->prepare('SELECT status FROM requests WHERE id = ? FOR UPDATE');
        $cur->execute([$requestId]);
        $current = $cur->fetch();
        if (!$current) {
            failAndRollBack($conn, 404, 'Request not found');
        }
        // Only proof that was sent can be approved.
        if ($current['status'] !== 'awaiting_proof') {
            failAndRollBack($conn, 409, 'Only a request that is awaiting proof can be completed');
        }

        // Leaving the active statuses frees the staff member through the one-job index.
        $update = $conn->prepare("UPDATE requests SET status = 'completed', updated_at = now() WHERE id = ?");
        $update->execute([$requestId]);

        $event = $conn->prepare(
            'INSERT INTO request_events (request_id, status, remark, changed_by)
             VALUES (?, ?, ?, ?)'
        );
        $event->execute([$requestId, 'completed', $remark !== '' ? $remark : 'Proof approved, marked completed', $admin['id']]);

        $conn->commit();
    } catch (PDOException $e) {
        error_log('Complete failed: ' . $e->getMessage());
        failAndRollBack($conn, 500, 'Could not complete the request');
    }

    sendResponse(['request' => loadAdminRequest($conn, $requestId, $adminColumns, $adminFrom)], 200);
}

// A known action sent with the wrong HTTP method gets 405. Anything else is unknown.
$knownActions = ['create', 'mine', 'queue', 'detail', 'assign', 'cancel', 'complete'];
if (in_array($action, $knownActions, true)) {
    sendResponse(['error' => 'Method not allowed'], 405);
}
sendResponse(['error' => 'Invalid action'], 400);
?>