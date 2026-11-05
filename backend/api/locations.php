<?php
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// ---------- LIST (any logged-in user) ----------
// Faculty use it on the New Report form. Unchanged from before.
if ($method === 'GET' && $action === '') {
    requireUser($conn);

    $stmt = $conn->prepare('SELECT id, name FROM locations ORDER BY name');
    $stmt->execute();

    sendResponse(['locations' => $stmt->fetchAll()], 200);
}

// ---------- ADD A NEW LOCATION (faculty and admin) ----------
// Faculty who cannot find their room can add it while making a report.
// If a location with the same name already exists (ignoring case and extra spaces),
// the existing one is returned, so the list never gets two "Room 101"s.
if ($method === 'POST' && $action === 'create') {
    requireUser($conn, ['faculty', 'admin']);

    $data = getJsonBody();
    $raw = textField($data, 'name');

    // Tidy the name: one space between words, no leading or trailing spaces.
    $name = preg_replace('/\s+/u', ' ', trim($raw));

    if ($name === '') {
        sendResponse(['error' => 'Please type a location name.'], 400);
    }
    if (mb_strlen($name) < 2) {
        sendResponse(['error' => 'The location name is too short.'], 400);
    }
    if (mb_strlen($name) > 100) {
        sendResponse(['error' => 'The location name must be 100 characters or less.'], 400);
    }
    // Letters, numbers, spaces and a few common punctuation marks only.
    if (!preg_match('/^[\p{L}\p{N} .\-\'#\/()&,]+$/u', $name)) {
        sendResponse(['error' => "Use only letters, numbers and simple punctuation (. - ' # / ( ) & ,)."], 400);
    }

    try {
        // Reuse an existing location with the same name, ignoring case.
        $find = $conn->prepare('SELECT id, name FROM locations WHERE LOWER(name) = LOWER(?) LIMIT 1');
        $find->execute([$name]);
        $existing = $find->fetch();
        if ($existing) {
            sendResponse(['location' => $existing, 'created' => false], 200);
        }

        try {
            $insert = $conn->prepare('INSERT INTO locations (name) VALUES (?) RETURNING id, name');
            $insert->execute([$name]);
            $row = $insert->fetch();
            sendResponse(['location' => $row, 'created' => true], 201);
        } catch (PDOException $e) {
            // 23505 = unique violation: someone added the same name a moment ago. Use that one.
            if ($e->getCode() !== '23505') {
                throw $e;
            }
            $find->execute([$name]);
            $existing = $find->fetch();
            sendResponse(['location' => $existing, 'created' => false], 200);
        }
    } catch (PDOException $e) {
        error_log('LOCATION CREATE ERROR: ' . $e->getMessage());
        sendResponse(['error' => 'Could not add the location. Please try again.'], 500);
    }
}

// A known action with the wrong method is 405. Anything else is an unknown action.
if ($action === 'create' || $action === '') {
    sendResponse(['error' => 'Method not allowed'], 405);
}
sendResponse(['error' => 'Invalid action'], 400);
?>