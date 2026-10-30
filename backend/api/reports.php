<?php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$userId = $_GET['user_id'] ?? null;

// ---------- GET all reports (admin), optional ?status= filter ----------
if ($method === 'GET' && $action === 'all') {
    $status = $_GET['status'] ?? null;

    $sql = 'SELECT r.*, c.name AS category_name, u.name AS created_by_name, u2.name AS routed_to_name
            FROM reports r
            LEFT JOIN categories c ON r.category_id = c.id
            LEFT JOIN users u ON r.created_by = u.id
            LEFT JOIN users u2 ON r.routed_to = u2.id';
    $params = [];

    if ($status) {
        $sql .= ' WHERE r.status = ?';
        $params[] = $status;
    }
    $sql .= ' ORDER BY r.created_at DESC';

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    sendResponse(['reports' => $stmt->fetchAll()], 200);
}

// ---------- GET reports for one user (faculty), optional ?status= filter ----------
if ($method === 'GET' && $action === 'user' && $userId) {
    $status = $_GET['status'] ?? null;

    $sql = 'SELECT r.*, c.name AS category_name
            FROM reports r
            LEFT JOIN categories c ON r.category_id = c.id
            WHERE r.created_by = ?';
    $params = [(int) $userId]; // cast so PostgreSQL gets an integer

    if ($status) {
        $sql .= ' AND r.status = ?';
        $params[] = $status;
    }
    $sql .= ' ORDER BY r.created_at DESC';

    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    sendResponse(['reports' => $stmt->fetchAll()], 200);
}

// ---------- POST create a report ----------
if ($method === 'POST' && $action === 'create') {
    $data = json_decode(file_get_contents('php://input'), true);
    $title = trim($data['title'] ?? '');
    $categoryId = $data['category_id'] ?? null;
    $description = $data['description'] ?? null;
    $userId = $data['user_id'] ?? null;

    if (!$title || !$userId) {
        sendResponse(['error' => 'Title and user_id required'], 400);
    }

    // A transaction makes sure the report and its first status row are saved together.
    try {
        $conn->beginTransaction();

        // RETURNING id gives us the new report's id (replaces MySQL's insert_id).
        $stmt = $conn->prepare(
            'INSERT INTO reports (title, category_id, description, created_by, created_at)
             VALUES (?, ?, ?, ?, NOW()) RETURNING id'
        );
        $stmt->execute([$title, $categoryId, $description, $userId]);
        $reportId = (int) $stmt->fetchColumn();

        $stmt = $conn->prepare(
            "INSERT INTO status_history (report_id, status, changed_by, changed_at)
             VALUES (?, 'submitted', ?, NOW())"
        );
        $stmt->execute([$reportId, $userId]);

        $conn->commit();
    } catch (PDOException $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        error_log('Create report failed: ' . $e->getMessage());
        sendResponse(['error' => 'Failed to create report'], 400);
    }

    sendResponse(['id' => $reportId, 'message' => 'Report created'], 201);
}

// ---------- PUT update category, priority, or routing ----------
if ($method === 'PUT' && $action === 'update') {
    $data = json_decode(file_get_contents('php://input'), true);
    $reportId = $data['id'] ?? null;
    $categoryId = $data['category_id'] ?? null;
    $priority = $data['priority'] ?? null;
    $routedTo = $data['routed_to'] ?? null;

    if (!$reportId) {
        sendResponse(['error' => 'Report ID required'], 400);
    }

    $updates = [];
    $params = [];

    if ($categoryId !== null) {
        $updates[] = 'category_id = ?';
        $params[] = $categoryId;
    }
    if ($priority !== null) {
        $updates[] = 'priority = ?';   // the CHECK constraint rejects invalid values
        $params[] = $priority;
    }
    if ($routedTo !== null) {
        $updates[] = 'routed_to = ?';
        $params[] = $routedTo;
    }

    if (empty($updates)) {
        sendResponse(['error' => 'No fields to update'], 400);
    }

    $params[] = $reportId;

    try {
        $stmt = $conn->prepare('UPDATE reports SET ' . implode(', ', $updates) . ' WHERE id = ?');
        $stmt->execute($params);
    } catch (PDOException $e) {
        error_log('Update report failed: ' . $e->getMessage());
        sendResponse(['error' => 'Failed to update report'], 400);
    }

    sendResponse(['message' => 'Report updated'], 200);
}

sendResponse(['error' => 'Invalid action'], 400);
?>