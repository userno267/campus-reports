<?php
require 'config.php';

// Public on purpose: the register form needs this list BEFORE anyone is logged in.
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendResponse(['error' => 'Method not allowed'], 405);
}

$stmt = $conn->prepare('SELECT id, name FROM departments ORDER BY name');
$stmt->execute();

sendResponse(['departments' => $stmt->fetchAll()], 200);
?>