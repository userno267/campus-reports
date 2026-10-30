<?php
// personnel.php: staff list for the admin assign screen.
// Admin only. Each staff member includes whether they are free to take a job.
require 'config.php';

// Only admins may see the staff list. This also rejects missing or unknown users.
requireUser($conn, ['admin']);

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendResponse(['error' => 'Method not allowed'], 405);
}

// Optional filter: ?department_id=1 returns only that department's staff.
$params = [];
$where  = "WHERE u.role = 'staff'";
if (isset($_GET['department_id']) && $_GET['department_id'] !== '') {
    if (!ctype_digit((string) $_GET['department_id'])) {
        sendResponse(['error' => 'department_id must be a number'], 400);
    }
    $where   .= ' AND u.department_id = ?';
    $params[] = (int) $_GET['department_id'];
}

// Find an active request for each staff member. The status list matches the
// one-job partial index. The index guarantees at most one active request per
// person, so LIMIT 1 is safe.
$sql = "
    SELECT u.id,
           u.name,
           u.employee_id,
           u.department_id,
           d.name AS department_name,
           (SELECT r.id
              FROM requests r
             WHERE r.assigned_to = u.id
               AND r.status IN ('assigned', 'in_progress', 'awaiting_proof')
             LIMIT 1) AS active_request_id
    FROM users u
    JOIN departments d ON d.id = u.department_id
    $where
    ORDER BY u.name
";
$stmt = $conn->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

// Build the shape the frontend expects. Convert ids to real integers.
$personnel = [];
foreach ($rows as $row) {
    $active = $row['active_request_id'];
    $personnel[] = [
        'id'                => (int) $row['id'],
        'name'              => $row['name'],
        'employee_id'       => $row['employee_id'],
        'department_id'     => (int) $row['department_id'],
        'department_name'   => $row['department_name'],
        'is_available'      => $active === null,
        'active_request_id' => $active === null ? null : (int) $active,
    ];
}

sendResponse(['personnel' => $personnel], 200);
?>