<?php
require 'config.php';

// Table names are fixed in this list (no user input), so building the query is safe.
$counts = [];
foreach (['departments', 'locations', 'categories', 'users'] as $table) {
    $counts[$table] = (int) $conn->query("SELECT COUNT(*) FROM $table")->fetchColumn();
}

sendResponse([
    'status'   => 'ok',
    'database' => 'connected',
    'time'     => gmdate('c'),   // ISO string, UTC
    'counts'   => $counts,
], 200);
?>