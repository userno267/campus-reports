<?php
require 'config.php';

$stmt = $conn->prepare('SELECT id, name, email, role, xp FROM users WHERE role = ? ORDER BY name');
$stmt->execute(['personnel']);
$personnel = $stmt->fetchAll();

sendResponse(['personnel' => $personnel], 200);
?>