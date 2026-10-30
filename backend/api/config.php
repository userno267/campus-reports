<?php
// ---------- CORS and JSON headers (set first so every response has them) ----------
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
// X-User-Id must be allowed or the browser blocks our authorization header.
header('Access-Control-Allow-Headers: Content-Type, X-User-Id');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Show PHP errors in the log, not in the JSON response.
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// ---------- Database configuration (PostgreSQL) ----------
define('DB_HOST', 'db');        // the service name in docker-compose.yaml
define('DB_PORT', '5432');
define('DB_USER', 'postgres');
define('DB_PASS', 'root123');
define('DB_NAME', 'campus_reports');

// The database container can take a few seconds to start, so retry the connection.
$maxRetries = 10;
$conn = null;
$lastError = '';

for ($i = 0; $i < $maxRetries; $i++) {
    try {
        $conn = new PDO(
            'pgsql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME,
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,   // throw on SQL errors
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,         // rows as arrays
            ]
        );
        break;
    } catch (PDOException $e) {
        $lastError = $e->getMessage();
        if ($i < $maxRetries - 1) {
            sleep(1);
        }
    }
}

if ($conn === null) {
    http_response_code(500);
    die(json_encode(['error' => 'Database connection failed: ' . $lastError]));
}

// Make sure this session also uses UTC (timestamps are ISO strings in UTC).
$conn->exec("SET TIME ZONE 'UTC'");

// ---------- Helpers ----------

// Send JSON and stop the script.
function sendResponse($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

// Read the JSON request body as an array. Empty body gives []; bad JSON gives 400.
function getJsonBody(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        sendResponse(['error' => 'Invalid JSON body'], 400);
    }
    return $data;
}

// Load the logged-in user from the X-User-Id header and check their role.
// Usage: $user = requireUser($conn, ['admin']);   (empty list = any logged-in user)
// NOTE: a real system would use signed tokens (JWT or sessions). The header is
// easy to fake, which is acceptable for this school demo only.
function requireUser(PDO $conn, array $allowedRoles = []): array {
    $id = $_SERVER['HTTP_X_USER_ID'] ?? '';
    if (!ctype_digit($id)) {
        sendResponse(['error' => 'Not logged in'], 401);
    }

    $stmt = $conn->prepare(
        'SELECT id, name, email, role, employee_id, department_id FROM users WHERE id = ?'
    );
    $stmt->execute([(int) $id]);
    $user = $stmt->fetch();   // false when no row matches

    if (!$user) {
        sendResponse(['error' => 'Not logged in'], 401);
    }
    if ($allowedRoles && !in_array($user['role'], $allowedRoles, true)) {
        sendResponse(['error' => 'You do not have permission to do this'], 403);
    }
    return $user;
}

// ---------- Demo user seeding ----------
// Users are seeded here (not in init.sql) because password_hash() runs in PHP.
// Only runs when the users table is empty. All demo passwords are "demo1234".
function seedDemoUsers(PDO $conn): void {
    if ($conn->query('SELECT 1 FROM users LIMIT 1')->fetchColumn() !== false) {
        return; // already seeded
    }

    $deptStmt = $conn->prepare('SELECT id FROM departments WHERE name = ?');
    $insert = $conn->prepare(
        'INSERT INTO users (name, email, password_hash, role, employee_id, department_id)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (email) DO NOTHING'
    );

    // [name, email, role, employee_id, department name or null]
    $users = [
        ['Ana Reyes',          'admin@campus.edu', 'admin',   'ADM-001', null],
        ['Prof. Ben Cruz',     'ben@campus.edu',   'faculty', 'FAC-001', null],
        ['Prof. Carla Santos', 'carla@campus.edu', 'faculty', 'FAC-002', null],
        ['Dan Villanueva',     'dan@campus.edu',   'staff',   'STF-001', 'Auxiliary'],
        ['Ella Garcia',        'ella@campus.edu',  'staff',   'STF-002', 'IT'],
    ];

    foreach ($users as [$name, $email, $role, $employeeId, $deptName]) {
        $deptId = null;
        if ($deptName !== null) {
            $deptStmt->execute([$deptName]);
            $deptId = $deptStmt->fetchColumn();
        }
        // password_hash() adds its own random salt; never store plain text.
        $insert->execute([$name, $email, password_hash('demo1234', PASSWORD_DEFAULT),
                          $role, $employeeId, $deptId]);
    }
}

try {
    seedDemoUsers($conn);
} catch (PDOException $e) {
    error_log('Seeding failed: ' . $e->getMessage());
    sendResponse(['error' => 'Database not initialised. Reset the volume (docker compose down -v) and start again.'], 500);
}
?>