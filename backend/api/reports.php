<?php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Columns sent to the frontend. Timestamps become ISO strings in UTC.
// Photos are left out on purpose: they are large, and list screens do not need them.
$requestColumns = <<<SQL
    r.id,
    r.title,
    r.description,
    r.status,
    c.name AS category_name,
    l.name AS location_name,
    to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
    to_char(r.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
SQL;

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
         WHERE r.created_by = ?
         ORDER BY r.created_at DESC'
    );
    $stmt->execute([$user['id']]);

    sendResponse(['requests' => $stmt->fetchAll()], 200);
}

sendResponse(['error' => 'Invalid action'], 400);
?>