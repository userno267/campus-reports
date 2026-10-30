<?php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ---------- LOGIN ----------
if ($method === 'POST' && $action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    // Lowercase the email so it matches how accounts are stored.
    $email = strtolower(trim($data['email'] ?? ''));
    $password = $data['password'] ?? '';

    if (!$email || !$password) {
        sendResponse(['error' => 'Email and password required'], 400);
    }

    $hash = hashPassword($email, $password);

    $stmt = $conn->prepare('SELECT id, name, email, role, xp FROM users WHERE email = ? AND password_hash = ?');
    $stmt->execute([$email, $hash]);
    $user = $stmt->fetch(); // false when no row matches

    if (!$user) {
        sendResponse(['error' => 'Invalid email or password'], 401);
    }

    sendResponse(['user' => $user], 200);
}

// ---------- REGISTER (always creates a faculty account) ----------
if ($method === 'POST' && $action === 'register') {
    $data = json_decode(file_get_contents('php://input'), true);
    $name = trim($data['name'] ?? '');
    $email = strtolower(trim($data['email'] ?? ''));
    $password = $data['password'] ?? '';

    if (!$name || !$email || !$password) {
        sendResponse(['error' => 'All fields required'], 400);
    }

    if (strlen($password) < 6) {
        sendResponse(['error' => 'Password must be at least 6 characters'], 400);
    }

    $hash = hashPassword($email, $password);
    $role = 'faculty';

    try {
        $stmt = $conn->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
        $stmt->execute([$name, $email, $hash, $role]);
    } catch (PDOException $e) {
        // SQLSTATE 23505 = unique_violation (email already exists in PostgreSQL)
        if ($e->getCode() === '23505') {
            sendResponse(['error' => 'Email already registered'], 400);
        }
        error_log('Register failed: ' . $e->getMessage());
        sendResponse(['error' => 'Registration failed'], 500);
    }

    sendResponse(['message' => 'Account created'], 201);
}

sendResponse(['error' => 'Invalid action'], 400);
?>