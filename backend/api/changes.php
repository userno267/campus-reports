<?php
// changes.php: "has anything changed?" for live updates (polling).
// The app calls this every few seconds while a screen is open. The answer is a tiny token.
// When the token differs from the last one, the app reloads that screen's data.
// This endpoint never returns request data and never returns photos.
//
// GET ?action=check&target=...   (any logged-in user, the target depends on the role)
//   faculty: target=list            my requests and the ratings on them
//            target=request&id=N    one of my requests (the details page)
//   admin:   target=list            every request and every rating
//   staff:   target=job             the requests assigned to me
//            target=reviews         the ratings written about me
require 'config.php';

// The answer must never come from a cache, or the screen would never see a change.
header('Cache-Control: no-store');

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'GET' && $action === 'check') {
    $user   = requireUser($conn);   // any logged-in user. The role decides which targets are allowed.
    $target = $_GET['target'] ?? '';

    $allowedTargets = [
        'faculty' => ['list', 'request'],
        'admin'   => ['list'],
        'staff'   => ['job', 'reviews'],
    ];
    if (!is_string($target) || !in_array($target, $allowedTargets[$user['role']] ?? [], true)) {
        sendResponse(['error' => 'Invalid target'], 400);
    }

    // Every status change sets requests.updated_at, and every new request or rating adds a row.
    // So the row count plus the latest timestamps change whenever something a screen shows changes.
    // CAST to text keeps the full microsecond precision of the timestamps.
    if ($target === 'list' && $user['role'] === 'faculty') {
        $stmt = $conn->prepare(
            'SELECT COUNT(r.id) AS n,
                    CAST(MAX(r.updated_at) AS text) AS last_change,
                    CAST(MAX(rv.created_at) AS text) AS last_review
             FROM requests r
             LEFT JOIN reviews rv ON rv.request_id = r.id
             WHERE r.created_by = ?'
        );
        $stmt->execute([$user['id']]);
    } elseif ($target === 'list') {
        // admin: everything
        $stmt = $conn->prepare(
            'SELECT COUNT(r.id) AS n,
                    CAST(MAX(r.updated_at) AS text) AS last_change,
                    CAST(MAX(rv.created_at) AS text) AS last_review
             FROM requests r
             LEFT JOIN reviews rv ON rv.request_id = r.id'
        );
        $stmt->execute();
    } elseif ($target === 'request') {
        // faculty details page. The owner check is in the SQL, like my_detail in reports.php.
        $id = positiveInt($_GET['id'] ?? null, 'A request id is required');
        $stmt = $conn->prepare(
            'SELECT COUNT(r.id) AS n,
                    CAST(MAX(r.updated_at) AS text) AS last_change,
                    CAST(MAX(rv.created_at) AS text) AS last_review
             FROM requests r
             LEFT JOIN reviews rv ON rv.request_id = r.id
             WHERE r.id = ? AND r.created_by = ?'
        );
        $stmt->execute([$id, $user['id']]);
    } elseif ($target === 'job') {
        $stmt = $conn->prepare(
            'SELECT COUNT(id) AS n,
                    CAST(MAX(updated_at) AS text) AS last_change,
                    NULL AS last_review
             FROM requests
             WHERE assigned_to = ?'
        );
        $stmt->execute([$user['id']]);
    } else {
        // staff: reviews
        $stmt = $conn->prepare(
            'SELECT COUNT(id) AS n,
                    NULL AS last_change,
                    CAST(MAX(created_at) AS text) AS last_review
             FROM reviews
             WHERE staff_id = ?'
        );
        $stmt->execute([$user['id']]);
    }
    $row = $stmt->fetch();

    // A request that is not the caller's (or does not exist) is the same 404 as in my_detail.
    if ($target === 'request' && (int) $row['n'] === 0) {
        sendResponse(['error' => 'Request not found'], 404);
    }

    // md5 only makes the token short. It is not a security measure.
    $token = md5(implode('|', [$row['n'], $row['last_change'] ?? '', $row['last_review'] ?? '']));
    sendResponse(['token' => $token], 200);
}

// A known action sent with the wrong HTTP method gets 405. Anything else is unknown.
if ($action === 'check') {
    sendResponse(['error' => 'Method not allowed'], 405);
}
sendResponse(['error' => 'Invalid action'], 400);
?>