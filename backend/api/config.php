<?php
// ---------- CORS and JSON headers (set first so every response has them) ----------
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ---------- Database configuration (PostgreSQL) ----------
define('DB_HOST', 'db');        // the service name in docker-compose.yaml
define('DB_PORT', '5432');
define('DB_USER', 'postgres');
define('DB_PASS', 'root123');
define('DB_NAME', 'campus_reports');

// The database container can take a few seconds to start, so retry the connection.
$maxRetries = 10;
$conn = null;
$lastError = '';

for ($i = 0; $i < $maxRetries; $i++) {
    try {
        $conn = new PDO(
            'pgsql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME,
            DB_USER,
            DB_PASS,
            [
                // Throw exceptions on SQL errors instead of failing silently.
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                // Return rows as associative arrays: ['id' => 1, 'name' => ...]
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]
        );
        break; // connected, stop retrying
    } catch (PDOException $e) {
        $lastError = $e->getMessage();
        if ($i < $maxRetries - 1) {
            sleep(1);
        }
    }
}

if ($conn === null) {
    http_response_code(500);
    die(json_encode(['error' => 'Database connection failed: ' . $lastError]));
}

// Show PHP errors in the log, not in the JSON response.
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Create tables if they do not exist, then seed demo data.
initializeDatabase($conn);

// ---------- Schema ----------
// PostgreSQL notes:
//  - GENERATED ALWAYS AS IDENTITY replaces MySQL's AUTO_INCREMENT.
//  - TEXT + CHECK replaces MySQL's ENUM.
//  - TIMESTAMP replaces DATETIME. The app still gets "YYYY-MM-DD HH:MM:SS" strings, like before.
//  - Tables are created in dependency order (categories and users before reports).
function initializeDatabase(PDO $conn): void {
    $statements = [
        "CREATE TABLE IF NOT EXISTS users (
            id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL CHECK (role IN ('faculty', 'admin', 'personnel')),
            xp INTEGER NOT NULL DEFAULT 0
        )",

        "CREATE TABLE IF NOT EXISTS categories (
            id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE
        )",

        "CREATE TABLE IF NOT EXISTS reports (
            id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            category_id INTEGER REFERENCES categories(id),
            description TEXT,
            photo TEXT,
            photo_taken_at TIMESTAMP,
            latitude NUMERIC(10, 8),
            longitude NUMERIC(11, 8),
            location_text VARCHAR(255),
            weather_note VARCHAR(255),
            priority VARCHAR(10) CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
            status VARCHAR(20) NOT NULL DEFAULT 'submitted'
                CHECK (status IN ('submitted', 'validated', 'tracked', 'closed')),
            routed_to INTEGER REFERENCES users(id),
            created_by INTEGER NOT NULL REFERENCES users(id),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",

        "CREATE TABLE IF NOT EXISTS status_history (
            id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            report_id INTEGER NOT NULL REFERENCES reports(id),
            status VARCHAR(20) NOT NULL CHECK (status IN ('submitted', 'validated', 'tracked', 'closed')),
            remark TEXT,
            changed_by INTEGER NOT NULL REFERENCES users(id),
            changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",

        "CREATE TABLE IF NOT EXISTS xp_log (
            id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id),
            report_id INTEGER REFERENCES reports(id),
            action VARCHAR(255) NOT NULL,
            xp INTEGER NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )",

        "CREATE TABLE IF NOT EXISTS user_badges (
            user_id INTEGER NOT NULL REFERENCES users(id),
            badge_code VARCHAR(255) NOT NULL,
            unlocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, badge_code)
        )",
    ];

    foreach ($statements as $sql) {
        try {
            $conn->exec($sql);
        } catch (PDOException $e) {
            error_log('SQL Error: ' . $e->getMessage());
        }
    }

    seedData($conn);
}

// Seed categories and demo users, but only if the categories table is empty.
function seedData(PDO $conn): void {
    $count = (int) $conn->query('SELECT COUNT(*) FROM categories')->fetchColumn();
    if ($count > 0) {
        return; // already seeded
    }

    $catStmt = $conn->prepare('INSERT INTO categories (name) VALUES (?) ON CONFLICT (name) DO NOTHING');
    foreach (['Facilities', 'IT', 'Classroom', 'Administrative'] as $cat) {
        $catStmt->execute([$cat]);
    }

    $userStmt = $conn->prepare(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?) ON CONFLICT (email) DO NOTHING'
    );
    $users = [
        ['Ana Reyes (Admin)',          'admin@campus.edu', 'admin'],
        ['Prof. Ben Cruz',             'ben@campus.edu',   'faculty'],
        ['Prof. Carla Santos',         'carla@campus.edu', 'faculty'],
        ['Dan Villanueva (Maintenance)', 'dan@campus.edu', 'personnel'],
        ['Ella Garcia (IT Support)',   'ella@campus.edu',  'personnel'],
    ];
    foreach ($users as [$name, $email, $role]) {
        // Same hash format the Angular app uses: sha256("email:password")
        $userStmt->execute([$name, $email, hashPassword($email, 'demo1234'), $role]);
    }
}

// ---------- Helpers ----------

// Must match the Angular utils/hash.ts format: sha256 of "lowercase-email:password".
function hashPassword($email, $password) {
    return hash('sha256', strtolower(trim($email)) . ':' . $password);
}

// Send JSON and stop the script.
function sendResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}
?>