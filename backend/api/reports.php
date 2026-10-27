<?php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$userId = $_GET['user_id'] ?? null;

if ($method === 'GET' && $action === 'all') {
    $status = $_GET['status'] ?? null;
    
    $sql = 'SELECT r.*, c.name AS category_name, u.name AS created_by_name, u2.name AS routed_to_name 
            FROM reports r 
            LEFT JOIN categories c ON r.category_id = c.id 
            LEFT JOIN users u ON r.created_by = u.id 
            LEFT JOIN users u2 ON r.routed_to = u2.id';
    
    if ($status) {
        $sql .= ' WHERE r.status = ?';
        $stmt = $conn->prepare($sql . ' ORDER BY r.created_at DESC');
        $stmt->bind_param('s', $status);
    } else {
        $stmt = $conn->prepare($sql . ' ORDER BY r.created_at DESC');
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    $reports = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    sendResponse(['reports' => $reports], 200);
}

if ($method === 'GET' && $action === 'user' && $userId) {
    $status = $_GET['status'] ?? null;
    
    $sql = 'SELECT r.*, c.name AS category_name 
            FROM reports r 
            LEFT JOIN categories c ON r.category_id = c.id 
            WHERE r.created_by = ?';
    
    if ($status) {
        $sql .= ' AND r.status = ?';
        $stmt = $conn->prepare($sql . ' ORDER BY r.created_at DESC');
        $stmt->bind_param('is', $userId, $status);
    } else {
        $stmt = $conn->prepare($sql . ' ORDER BY r.created_at DESC');
        $stmt->bind_param('i', $userId);
    }
    
    $stmt->execute();
    $result = $stmt->get_result();
    $reports = $result->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    
    sendResponse(['reports' => $reports], 200);
}

if ($method === 'POST' && $action === 'create') {
    $data = json_decode(file_get_contents('php://input'), true);
    $title = $data['title'] ?? '';
    $categoryId = $data['category_id'] ?? null;
    $description = $data['description'] ?? null;
    $userId = $data['user_id'] ?? null;

    if (!$title || !$userId) {
        sendResponse(['error' => 'Title and user_id required'], 400);
    }

    $stmt = $conn->prepare('INSERT INTO reports (title, category_id, description, created_by, created_at) VALUES (?, ?, ?, ?, NOW())');
    $stmt->bind_param('sisi', $title, $categoryId, $description, $userId);
    
    if (!$stmt->execute()) {
        sendResponse(['error' => 'Failed to create report'], 400);
    }

    $reportId = $stmt->insert_id;
    $stmt->close();

    // Insert into status_history
    $status = 'submitted';
    $stmt = $conn->prepare('INSERT INTO status_history (report_id, status, changed_by, changed_at) VALUES (?, ?, ?, NOW())');
    $stmt->bind_param('isi', $reportId, $status, $userId);
    $stmt->execute();
    $stmt->close();

    sendResponse(['id' => $reportId, 'message' => 'Report created'], 201);
}

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
    $types = '';
    $values = [];

    if ($categoryId !== null) {
        $updates[] = 'category_id = ?';
        $types .= 'i';
        $values[] = $categoryId;
    }
    if ($priority !== null) {
        $updates[] = 'priority = ?';
        $types .= 's';
        $values[] = $priority;
    }
    if ($routedTo !== null) {
        $updates[] = 'routed_to = ?';
        $types .= 'i';
        $values[] = $routedTo;
    }

    if (empty($updates)) {
        sendResponse(['error' => 'No fields to update'], 400);
    }

    $sql = 'UPDATE reports SET ' . implode(', ', $updates) . ' WHERE id = ?';
    $types .= 'i';
    $values[] = $reportId;

    $stmt = $conn->prepare($sql);
    $stmt->bind_param($types, ...$values);
    
    if (!$stmt->execute()) {
        sendResponse(['error' => 'Failed to update report'], 400);
    }

    $stmt->close();
    sendResponse(['message' => 'Report updated'], 200);
}

sendResponse(['error' => 'Invalid action'], 400);
?>