<?php
require 'config.php';

$stmt = $conn->prepare('SELECT id, name FROM categories ORDER BY id');
$stmt->execute();
$categories = $stmt->fetchAll();

sendResponse(['categories' => $categories], 200);
?>