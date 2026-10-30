<?php
require 'config.php';

// Only GET is allowed here.
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendResponse(['error' => 'Method not allowed'], 405);
}

// Any logged-in user may read the list (faculty use it on the New Report form).
requireUser($conn);

$stmt = $conn->prepare('SELECT id, name FROM locations ORDER BY name');
$stmt->execute();

sendResponse(['locations' => $stmt->fetchAll()], 200);
?>