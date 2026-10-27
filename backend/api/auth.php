<?php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'POST' && $action === 'login') {
    $data = json_decode(file_get_contents('php://input'), true);
    $email = $data['email'] ?? '';
    $password = $data['password'] ?? '';

    if (!$email || !$password) {
        sendResponse(['error' => 'Email and password required'], 400);
    }

    $hash = hashPassword($email, $password);
    $stmt = $conn->prepare('SELECT id, name, email, role, xp FROM users WHERE email = ? AND password_hash = ?');
    $stmt->bind_param('ss', $email, $hash);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    $stmt->close();

    if (!$user) {
        sendResponse(['error' => 'Invalid email or password'], 401);
    }

    sendResponse(['user' => $user], 200);
}

if ($method === 'POST' && $action === 'register') {
    $data = json_decode(file_get_contents('php://input'), true);
    $name = $data['name'] ?? '';
    $email = $data['email'] ?? '';
    $password = $data['password'] ?? '';

    if (!$name || !$email || !$password) {
        sendResponse(['error' => 'All fields required'], 400);
    }

    if (strlen($password) < 6) {
        sendResponse(['error' => 'Password must be at least 6 characters'], 400);
    }

    $hash = hashPassword($email, $password);
    $stmt = $conn->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
    $role = 'faculty';
    $stmt->bind_param('ssss', $name, $email, $hash, $role);

    if (!$stmt->execute()) {
        sendResponse(['error' => 'Email already registered'], 400);
    }

    $stmt->close();
    sendResponse(['message' => 'Account created'], 201);
}

sendResponse(['error' => 'Invalid action'], 400);
?>