<?php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Load one user in the shape the frontend sees. The password hash is NEVER selected here.
function fetchPublicUser(PDO $conn, int $id): array {
    $stmt = $conn->prepare(
        'SELECT u.id, u.name, u.email, u.role, u.employee_id, u.department_id,
                d.name AS department_name
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE u.id = ?'
    );
    $stmt->execute([$id]);
    return $stmt->fetch();
}

// ---------- LOGIN ----------
if ($method === 'POST' && $action === 'login') {
    $data = getJsonBody();
    // Lowercase the email so it matches how accounts are stored.
    $email    = strtolower(textField($data, 'email'));
    $password = textField($data, 'password', false);

    if ($email === '' || $password === '') {
        sendResponse(['error' => 'Email and password required'], 400);
    }
    // bcrypt only uses the first 72 bytes, and register refuses longer passwords,
    // so a longer one can never match. Answer the same way as a wrong password.
    if (strlen($password) > 72 || strlen($email) > 255) {
        sendResponse(['error' => 'Invalid email or password'], 401);
    }

    // This is the only place the hash is read. It stays inside PHP.
    $stmt = $conn->prepare('SELECT id, password_hash FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $row = $stmt->fetch(); // false when no row matches

    // Same message for "no such email" and "wrong password" so attackers learn nothing.
    if (!$row || !password_verify($password, $row['password_hash'])) {
        sendResponse(['error' => 'Invalid email or password'], 401);
    }

    sendResponse(['user' => fetchPublicUser($conn, (int) $row['id'])], 200);
}

// ---------- REGISTER (faculty or staff only; admin accounts are seeded) ----------
if ($method === 'POST' && $action === 'register') {
    $data       = getJsonBody();
    $name       = textField($data, 'name');
    $email      = strtolower(textField($data, 'email'));
    $employeeId = textField($data, 'employee_id');
    $password   = textField($data, 'password', false);
    $role       = $data['role'] ?? '';
    $deptId     = $data['department_id'] ?? null;

    if ($name === '' || $email === '' || $employeeId === '' || $password === '') {
        sendResponse(['error' => 'Name, email, employee ID and password are required'], 400);
    }
    // Lengths match the database columns, so a long value is a clear 400, not a 500.
    if (mb_strlen($name) > 255) {
        sendResponse(['error' => 'Name must be 255 characters or less'], 400);
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 255) {
        sendResponse(['error' => 'Please enter a valid email'], 400);
    }
    if (mb_strlen($employeeId) > 50) {
        sendResponse(['error' => 'Employee ID must be 50 characters or less'], 400);
    }
    if (strlen($password) < 6) {
        sendResponse(['error' => 'Password must be at least 6 characters'], 400);
    }
    // bcrypt ignores everything after 72 bytes, so refuse rather than truncate silently.
    if (strlen($password) > 72) {
        sendResponse(['error' => 'Password is too long (maximum 72 bytes)'], 400);
    }
    // Admin is deliberately NOT allowed here, even if someone edits the request by hand.
    if (!in_array($role, ['faculty', 'staff'], true)) {
        sendResponse(['error' => 'Role must be faculty or staff'], 400);
    }

    if ($role === 'staff') {
        $deptId = positiveInt($deptId, 'Staff must choose a department');
        $check = $conn->prepare('SELECT 1 FROM departments WHERE id = ?');
        $check->execute([$deptId]);
        if ($check->fetchColumn() === false) {
            sendResponse(['error' => 'Department not found'], 400);
        }
    } else {
        $deptId = null; // faculty do not belong to a department
    }

    try {
        $stmt = $conn->prepare(
            'INSERT INTO users (name, email, password_hash, role, employee_id, department_id)
             VALUES (?, ?, ?, ?, ?, ?)
             RETURNING id'
        );
        // password_hash() adds its own random salt; the plain password is never stored.
        $stmt->execute([$name, $email, password_hash($password, PASSWORD_DEFAULT),
                        $role, $employeeId, $deptId]);
        $newId = (int) $stmt->fetchColumn();
    } catch (PDOException $e) {
        // SQLSTATE 23505 = unique_violation. The message names the constraint that failed.
        if ($e->getCode() === '23505') {
            if (str_contains($e->getMessage(), 'employee_id')) {
                sendResponse(['error' => 'Employee ID already registered'], 409);
            }
            sendResponse(['error' => 'Email already registered'], 409);
        }
        error_log('Register failed: ' . $e->getMessage());
        sendResponse(['error' => 'Registration failed'], 500);
    }

    // Return the new user so the app can log them in without a second request.
    sendResponse(['user' => fetchPublicUser($conn, $newId)], 201);
}

// ---------- ME (who am I? used to restore a saved session) ----------
if ($method === 'GET' && $action === 'me') {
    $user = requireUser($conn);   // 401 if the X-User-Id header is missing or unknown
    sendResponse(['user' => fetchPublicUser($conn, (int) $user['id'])], 200);
}

// A known action sent with the wrong HTTP method gets 405. Anything else is unknown.
if (in_array($action, ['login', 'register', 'me'], true)) {
    sendResponse(['error' => 'Method not allowed'], 405);
}
sendResponse(['error' => 'Invalid action'], 400);
?>