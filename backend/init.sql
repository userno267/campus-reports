-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('faculty', 'admin', 'personnel') NOT NULL,
  xp INT DEFAULT 0
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL UNIQUE
);

-- Create reports table
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

-- Create status_history table
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

-- Create xp_log table
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

-- Create user_badges table
CREATE TABLE IF NOT EXISTS user_badges (
  user_id INT NOT NULL,
  badge_code VARCHAR(255) NOT NULL,
  unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, badge_code),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Seed categories
INSERT IGNORE INTO categories (id, name) VALUES
(1, 'Facilities'),
(2, 'IT'),
(3, 'Classroom'),
(4, 'Administrative');

-- Seed demo users
INSERT IGNORE INTO users (id, name, email, password_hash, role) VALUES
(1, 'Ana Reyes (Admin)', 'admin@campus.edu', SHA2(CONCAT('admin@campus.edu', 'demo1234'), 256), 'admin'),
(2, 'Prof. Ben Cruz', 'ben@campus.edu', SHA2(CONCAT('ben@campus.edu', 'demo1234'), 256), 'faculty'),
(3, 'Prof. Carla Santos', 'carla@campus.edu', SHA2(CONCAT('carla@campus.edu', 'demo1234'), 256), 'faculty'),
(4, 'Dan Villanueva (Maintenance)', 'dan@campus.edu', SHA2(CONCAT('dan@campus.edu', 'demo1234'), 256), 'personnel'),
(5, 'Ella Garcia (IT Support)', 'ella@campus.edu', SHA2(CONCAT('ella@campus.edu', 'demo1234'), 256), 'personnel');