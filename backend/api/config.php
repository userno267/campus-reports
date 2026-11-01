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

// Safety net: any error we did not expect still returns JSON, never an empty page.
// The real message goes to the log only, never to the client.
set_exception_handler(function (Throwable $e) {
    error_log('Unhandled error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Something went wrong. Please try again.']);
    exit;
});

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
    // Log the real reason. The client gets a generic message only.
    error_log('Database connection failed: ' . $lastError);
    http_response_code(500);
    die(json_encode(['error' => 'The database is unavailable. Please try again shortly.']));
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

// Read a text field from the JSON body. Missing or null gives ''.
// A value that is not text (an array, a number, true) is a 400, not a crash.
// Pass $trim = false for passwords and base64 photos, which must stay exact.
function textField(array $data, string $key, bool $trim = true): string {
    $value = $data[$key] ?? '';
    if (!is_string($value)) {
        sendResponse(['error' => "$key must be text"], 400);
    }
    return $trim ? trim($value) : $value;
}

// Turn a value into a positive whole number that fits an integer column.
// Letters, 1.5, 1e3, arrays, zero and huge numbers are all a 400 with $message.
function positiveInt($value, string $message): int {
    $n = filter_var($value, FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1, 'max_range' => 2147483647],
    ]);
    if ($n === false) {
        sendResponse(['error' => $message], 400);
    }
    return $n;
}

// Load the logged-in user from the X-User-Id header and check their role.
// Usage: $user = requireUser($conn, ['admin']);   (empty list = any logged-in user)
// NOTE: a real system would use signed tokens (JWT or sessions). The header is
// easy to fake, which is acceptable for this school demo only.
function requireUser(PDO $conn, array $allowedRoles = []): array {
    $userId = filter_var($_SERVER['HTTP_X_USER_ID'] ?? '', FILTER_VALIDATE_INT, [
        'options' => ['min_range' => 1, 'max_range' => 2147483647],
    ]);
    if ($userId === false) {
        sendResponse(['error' => 'Not logged in'], 401);
    }

    $stmt = $conn->prepare(
        'SELECT id, name, email, role, employee_id, department_id FROM users WHERE id = ?'
    );
    $stmt->execute([$userId]);
    $user = $stmt->fetch();   // false when no row matches

    if (!$user) {
        sendResponse(['error' => 'Not logged in'], 401);
    }
    if ($allowedRoles && !in_array($user['role'], $allowedRoles, true)) {
        sendResponse(['error' => 'You do not have permission to do this'], 403);
    }
    return $user;
}

// True for a real JSON number (int or float) that is finite. Strings like "10.5" are refused.
function isPlainNumber($value): bool {
    return (is_int($value) || is_float($value)) && is_finite((float) $value);
}

// Reads a GPS fix and a photo time from the JSON body. Used by the staff proof photo (C2).
// The field names are passed in, so each endpoint can use its own.
// $required = true means the location and the photo time must both be present.
// Returns [latitude, longitude, taken_at as UTC 'Y-m-d H:i:s'], with nulls when not sent.
// Stops with 400 when something is missing or wrong.
function readLocationFields(array $data, string $latKey, string $lngKey, string $timeKey, bool $required): array {
    $lat      = $data[$latKey] ?? null;
    $lng      = $data[$lngKey] ?? null;
    $takenRaw = $data[$timeKey] ?? null;

    if ($required && ($lat === null || $lng === null || $takenRaw === null)) {
        sendResponse(['error' => 'Location and photo time are required for proof'], 400);
    }

    $latitude  = null;
    $longitude = null;
    if ($lat !== null || $lng !== null) {
        // Both must be present, and both must be real numbers.
        if (!isPlainNumber($lat) || !isPlainNumber($lng)) {
            sendResponse(['error' => 'Send both latitude and longitude as numbers, or neither'], 400);
        }
        if ($lat < -90 || $lat > 90) {
            sendResponse(['error' => 'Latitude must be between -90 and 90'], 400);
        }
        if ($lng < -180 || $lng > 180) {
            sendResponse(['error' => 'Longitude must be between -180 and 180'], 400);
        }
        $latitude  = (float) $lat;
        $longitude = (float) $lng;
    }

    $takenAt = null;
    if ($takenRaw !== null) {
        if (!is_string($takenRaw) || trim($takenRaw) === '') {
            sendResponse(['error' => 'Photo time must be a date and time'], 400);
        }
        try {
            $taken = new DateTimeImmutable($takenRaw);
        } catch (Exception $e) {
            sendResponse(['error' => 'Photo time must be a date and time'], 400);
        }
        // A few minutes of clock difference between the phone and the server is allowed.
        if ($taken->getTimestamp() > time() + 300) {
            sendResponse(['error' => 'Photo time cannot be in the future'], 400);
        }
        // Stored as UTC, like every other timestamp in the database.
        $takenAt = $taken->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }

    return [$latitude, $longitude, $takenAt];
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