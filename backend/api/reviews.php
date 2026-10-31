<?php
// reviews.php: ratings for finished jobs.
// Step 6: create (POST), faculty only. Rate the staff member after a request is completed.
// Step 7: for_staff (GET), staff only. The reviews written about the logged-in staff member.
// Reviews are final: there is no update and no delete.
require 'config.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Stop with an error after undoing the open transaction.
function failAndRollBack(PDO $conn, int $status, string $message): void {
    if ($conn->inTransaction()) {
        $conn->rollBack();
    }
    sendResponse(['error' => $message], $status);
}

// ---------- POST create: one rating for one completed request ----------
if ($method === 'POST' && $action === 'create') {
    $user = requireUser($conn, ['faculty']);
    $data = getJsonBody();

    $requestId = $data['request_id'] ?? null;
    $rating    = $data['rating'] ?? null;
    $comment   = trim((string) ($data['comment'] ?? ''));

    if (!is_numeric($requestId)) {
        sendResponse(['error' => 'A request id is required'], 400);
    }
    // FILTER_VALIDATE_INT rejects 3.5 and "abc"; the range check keeps it to 1..5.
    $ratingInt = filter_var($rating, FILTER_VALIDATE_INT);
    if ($ratingInt === false || $ratingInt < 1 || $ratingInt > 5) {
        sendResponse(['error' => 'Rating must be a whole number from 1 to 5'], 400);
    }
    if (mb_strlen($comment) > 300) {
        sendResponse(['error' => 'Comment must be 300 characters or less'], 400);
    }
    $requestId = (int) $requestId;

    $conn->beginTransaction();
    try {
        // Lock the request row so a double tap cannot create two reviews.
        $cur = $conn->prepare('SELECT status, created_by, assigned_to FROM requests WHERE id = ? FOR UPDATE');
        $cur->execute([$requestId]);
        $request = $cur->fetch();
        if (!$request) {
            failAndRollBack($conn, 404, 'Request not found');
        }
        // Only the faculty member who reported it may rate it.
        if ((int) $request['created_by'] !== (int) $user['id']) {
            failAndRollBack($conn, 403, 'You can only rate your own requests');
        }
        if ($request['status'] !== 'completed') {
            failAndRollBack($conn, 409, 'Only a completed request can be rated');
        }
        if ($request['assigned_to'] === null) {
            // A completed request always has staff. This guards against bad data.
            failAndRollBack($conn, 409, 'This request has no staff member to rate');
        }

        // Friendly message for the normal case. The UNIQUE constraint below is the real guard.
        $exists = $conn->prepare('SELECT 1 FROM reviews WHERE request_id = ?');
        $exists->execute([$requestId]);
        if ($exists->fetchColumn() !== false) {
            failAndRollBack($conn, 409, 'This request has already been reviewed');
        }

        $insert = $conn->prepare(
            'INSERT INTO reviews (request_id, staff_id, rating, comment, created_by)
             VALUES (?, ?, ?, ?, ?)
             RETURNING id'
        );
        $insert->execute([
            $requestId,
            (int) $request['assigned_to'],
            $ratingInt,
            $comment !== '' ? $comment : null,
            $user['id'],
        ]);
        $newId = (int) $insert->fetchColumn();

        $conn->commit();
    } catch (PDOException $e) {
        // 23505 = unique violation on reviews.request_id: someone reviewed at the same moment.
        if ($e->getCode() === '23505') {
            failAndRollBack($conn, 409, 'This request has already been reviewed');
        }
        error_log('Create review failed: ' . $e->getMessage());
        failAndRollBack($conn, 500, 'Could not save the review');
    }

    sendResponse(['review' => ['id' => $newId, 'request_id' => $requestId, 'rating' => $ratingInt]], 201);
}

// ---------- GET for_staff: reviews about me (staff only) ----------
if ($method === 'GET' && $action === 'for_staff') {
    $user = requireUser($conn, ['staff']);

    // staff_id comes from the logged-in user, never from the URL,
    // so one staff member cannot read another's reviews.
    $stmt = $conn->prepare(<<<'SQL'
        SELECT rv.id,
               rv.request_id,
               rv.rating,
               rv.comment,
               r.title,
               l.name AS location_name,
               f.name AS reviewer_name,
               to_char(rv.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
        FROM reviews rv
        JOIN requests r  ON r.id = rv.request_id
        JOIN locations l ON l.id = r.location_id
        JOIN users f     ON f.id = rv.created_by
        WHERE rv.staff_id = ?
        ORDER BY rv.created_at DESC, rv.id DESC
    SQL);
    $stmt->execute([$user['id']]);
    $reviews = $stmt->fetchAll();

    // Plain count and average of the ratings above. No charts, no targets.
    $sum = $conn->prepare('SELECT COUNT(*) AS total, AVG(rating) AS average FROM reviews WHERE staff_id = ?');
    $sum->execute([$user['id']]);
    $row = $sum->fetch();

    sendResponse([
        'reviews' => $reviews,
        'summary' => [
            'count'   => (int) $row['total'],
            'average' => $row['average'] === null ? null : round((float) $row['average'], 1),
        ],
    ], 200);
}

// A known action sent with the wrong HTTP method gets 405. Anything else is unknown.
if (in_array($action, ['create', 'for_staff'], true)) {
    sendResponse(['error' => 'Method not allowed'], 405);
}
sendResponse(['error' => 'Invalid action'], 400);
?>