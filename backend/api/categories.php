<?php
require 'config.php';

$stmt = $conn->prepare('SELECT id, name FROM categories ORDER BY id');
$stmt->execute();
$result = $stmt->get_result();
$categories = $result->fetch_all(MYSQLI_ASSOC);
$stmt->close();

sendResponse(['categories' => $categories], 200);
?>