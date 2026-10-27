<?php
// Database configuration
define('DB_HOST', 'db');
define('DB_USER', 'root');
define('DB_PASS', 'root123');
define('DB_NAME', 'campus_reports');

// Try to connect with retry logic
$maxRetries = 10;
$conn = null;

for ($i = 0; $i < $maxRetries; $i++) {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($conn->connect_error === null) {
        break;
    }
    
    if ($i < $maxRetries - 1) {
        sleep(1); // Wait 1 second before retrying
    }
}

// Check final connection
if ($conn->connect_error) {
    http_response_code(500);
    die(json_encode(['error' => 'Database connection failed: ' . $conn->connect_error]));
}

$conn->set_charset("utf8");

// Enable error reporting
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// CORS headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Initialize database schema if not exists
initializeDatabase($conn);

// Helper function to initialize database
function initializeDatabase($conn) {
    $sql = <<<SQL
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('faculty', 'admin', 'personnel') NOT NULL,
  xp INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS reports (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  category_id INT,
  description TEXT,
  photo LONGTEXT,
  photo_taken_at DATETIME,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  location_text VARCHAR(255),
  weather_note VARCHAR(255),
  priority ENUM('low', 'medium', 'high', 'urgent'),
  status ENUM('submitted', 'validated', 'tracked', 'closed') DEFAULT 'submitted',
  routed_to INT,
  created_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (routed_to) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS status_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  report_id INT NOT NULL,
  status ENUM('submitted', 'validated', 'tracked', 'closed') NOT NULL,
  remark TEXT,
  changed_by INT NOT NULL,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id),
  FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS xp_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  report_id INT,
  action VARCHAR(255) NOT NULL,
  xp INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (report_id) REFERENCES reports(id)
);

CREATE TABLE IF NOT EXISTS user_badges (
  user_id INT NOT NULL,
  badge_code VARCHAR(255) NOT NULL,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, badge_code),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
SQL;

    // Execute each statement separately
    $statements = array_filter(array_map('trim', explode(';', $sql)));
    foreach ($statements as $statement) {
        if (!empty($statement)) {
            if (!$conn->query($statement)) {
                error_log("SQL Error: " . $conn->error . " | Statement: " . $statement);
            }
        }
    }
    
    // Seed initial data
    seedData($conn);
}
function seedData($conn) {
    // Check if categories already exist
    $result = $conn->query('SELECT COUNT(*) as cnt FROM categories');
    $row = $result->fetch_assoc();
    
    if ($row['cnt'] > 0) {
        return; // Data already seeded
    }
    
    // Insert categories
    $categories = ['Facilities', 'IT', 'Classroom', 'Administrative'];
    $stmt = $conn->prepare('INSERT INTO categories (name) VALUES (?)');
    
    foreach ($categories as $cat) {
        $stmt->bind_param('s', $cat);
        if (!$stmt->execute()) {
            error_log("Error inserting category: " . $conn->error);
        }
    }
    $stmt->close();
    
    // Insert demo users
    $users = [
        ['Ana Reyes (Admin)', 'admin@campus.edu', 'admin'],
        ['Prof. Ben Cruz', 'ben@campus.edu', 'faculty'],
        ['Prof. Carla Santos', 'carla@campus.edu', 'faculty'],
        ['Dan Villanueva (Maintenance)', 'dan@campus.edu', 'personnel'],
        ['Ella Garcia (IT Support)', 'ella@campus.edu', 'personnel'],
    ];
    
    $stmt = $conn->prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
    
    foreach ($users as $u) {
        $name = $u[0];
        $email = $u[1];
        $role = $u[2];
        $password = $email . ':demo1234';
        $hash = hash('sha256', $password);
        
        $stmt->bind_param('ssss', $name, $email, $hash, $role);
        if (!$stmt->execute()) {
            error_log("Error inserting user: " . $conn->error);
        }
    }
    $stmt->close();
}

// Helper function to hash password
function hashPassword($email, $password) {
    return hash('sha256', strtolower(trim($email)) . ':' . $password);
}

// Helper function to send JSON response
function sendResponse($data, $status = 200) {
    http_response_code($status);
    echo json_encode($data);
    exit;
}
?>
