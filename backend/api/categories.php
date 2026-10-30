<?php
require 'config.php';

// Any logged-in user may read the list (the New Report form and the Account tab use it).
requireUser($conn);

// default_department_id is sent so the admin screen (Step 4) can suggest a department.
$stmt = $conn->prepare('SELECT id, name, default_department_id FROM categories ORDER BY id');
$stmt->execute();

sendResponse(['categories' => $stmt->fetchAll()], 200);
?>