<?php
require 'config.php';

$stmt = $conn->prepare('SELECT id, name, email, role, xp FROM users WHERE role = ? ORDER BY name');
$role = 'personnel';
$stmt->bind_param('s', $role);
$stmt->execute();
$result = $stmt->get_result();
$personnel = $result->fetch_all(MYSQLI_ASSOC);
$stmt->close();

sendResponse(['personnel' => $personnel], 200);
?>