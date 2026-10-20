-- Mathify database (Cloudflare D1 / SQLite)

CREATE TABLE students (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT    NOT NULL,
  email           TEXT    NOT NULL UNIQUE COLLATE NOCASE,  -- student's Google login
  parent_email    TEXT    COLLATE NOCASE,                  -- parent can log in too
  phone           TEXT,                                    -- WhatsApp
  parent_name     TEXT,
  dob             TEXT,
  gender          TEXT,
  grade           TEXT,
  exams           TEXT,
  mode            TEXT,                                    -- Online / Offline
  hours_per_week  REAL,
  maths_level     INTEGER,                                 -- 1-10 self rating
  objective       TEXT,
  city            TEXT,
  country         TEXT,
  fee_per_hour    INTEGER NOT NULL DEFAULT 0,              -- INR
  schedule        TEXT    NOT NULL DEFAULT '{}',           -- JSON {"Mon":{"from":"17:00","to":"18:00"}, ...}
  notes           TEXT,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_students_parent_email ON students(parent_email);

CREATE TABLE attendance (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date        TEXT    NOT NULL,             -- YYYY-MM-DD (IST)
  start_time  TEXT    NOT NULL,             -- HH:MM
  end_time    TEXT,                         -- NULL while class is in progress
  hours       REAL    NOT NULL DEFAULT 0,   -- rounded to nearest 0.25
  is_present  INTEGER NOT NULL DEFAULT 1,
  rate        INTEGER NOT NULL DEFAULT 0,   -- fee per hour at the time (keeps history correct if rates change)
  note        TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_attendance_student_date ON attendance(student_id, date);

CREATE TABLE payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  billing_month TEXT    NOT NULL,           -- YYYY-MM
  amount        INTEGER NOT NULL,           -- INR received
  method        TEXT    NOT NULL,           -- Cash / UPI / Bank transfer
  paid_on       TEXT    NOT NULL,           -- YYYY-MM-DD
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, billing_month)
);

CREATE TABLE enquiries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  data        TEXT    NOT NULL,             -- JSON from the website enquiry form
  status      TEXT    NOT NULL DEFAULT 'new',  -- new / contacted / converted / closed
  student_id  INTEGER REFERENCES students(id) ON DELETE SET NULL
);
CREATE INDEX idx_enquiries_status ON enquiries(status, created_at);
