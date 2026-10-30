-- Campus Facilities Work Request System: schema + static seed data.
-- Runs ONCE, the first time the postgres volume is empty.
-- Demo USERS are not seeded here: their passwords must be hashed with PHP's
-- password_hash(), so config.php seeds them.

-- Store and return all timestamps in UTC.
ALTER DATABASE campus_reports SET timezone TO 'UTC';

CREATE TABLE departments (
    id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE users (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('faculty', 'admin', 'staff')),
    employee_id   VARCHAR(50)  NOT NULL UNIQUE,
    department_id INTEGER REFERENCES departments(id),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    -- Staff must belong to a department; faculty and admin must not.
    CONSTRAINT staff_needs_department CHECK (
        (role = 'staff' AND department_id IS NOT NULL)
        OR (role <> 'staff' AND department_id IS NULL)
    )
);

CREATE TABLE locations (
    id   INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE categories (
    id                    INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL UNIQUE,
    default_department_id INTEGER NOT NULL REFERENCES departments(id)
);

CREATE TABLE requests (
    id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    title         VARCHAR(255) NOT NULL,
    description   TEXT NOT NULL,
    category_id   INTEGER NOT NULL REFERENCES categories(id),
    location_id   INTEGER NOT NULL REFERENCES locations(id),
    department_id INTEGER REFERENCES departments(id),   -- set by admin on review
    before_photo  TEXT NOT NULL,                        -- base64
    after_photo   TEXT,                                 -- base64, uploaded by staff
    proof_note    TEXT,
    status        VARCHAR(20) NOT NULL DEFAULT 'submitted'
                  CHECK (status IN ('submitted', 'assigned', 'in_progress',
                                    'awaiting_proof', 'completed', 'cancelled')),
    created_by    INTEGER NOT NULL REFERENCES users(id),
    assigned_to   INTEGER REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ONE-JOB RULE: a staff member can have at most one active request.
CREATE UNIQUE INDEX one_active_job_per_staff
    ON requests (assigned_to)
    WHERE status IN ('assigned', 'in_progress', 'awaiting_proof');

CREATE INDEX idx_requests_status     ON requests (status);
CREATE INDEX idx_requests_created_by ON requests (created_by);

-- Timeline: one row for every status change.
CREATE TABLE request_events (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id INTEGER NOT NULL REFERENCES requests(id),
    status     VARCHAR(20) NOT NULL
               CHECK (status IN ('submitted', 'assigned', 'in_progress',
                                 'awaiting_proof', 'completed', 'cancelled')),
    remark     TEXT,
    changed_by INTEGER NOT NULL REFERENCES users(id),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One review per completed request, about the staff member.
CREATE TABLE reviews (
    id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id INTEGER NOT NULL UNIQUE REFERENCES requests(id),
    staff_id   INTEGER NOT NULL REFERENCES users(id),
    rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Seed data ----------
INSERT INTO departments (name) VALUES ('Auxiliary'), ('IT');

INSERT INTO locations (name) VALUES
    ('Room 101'), ('Room 204'), ('Library'), ('Gym'), ('Cafeteria');

-- Each category has a default department (the admin can change it per request).
INSERT INTO categories (name, default_department_id) VALUES
    ('Facilities',     (SELECT id FROM departments WHERE name = 'Auxiliary')),
    ('IT',             (SELECT id FROM departments WHERE name = 'IT')),
    ('Classroom',      (SELECT id FROM departments WHERE name = 'Auxiliary')),
    ('Administrative', (SELECT id FROM departments WHERE name = 'Auxiliary'));