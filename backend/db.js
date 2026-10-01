// ============================================================
// db.js — SQLite via Node.js 22 built-in node:sqlite
// Không cần cài package nào, không cần Visual Studio.
// Yêu cầu: Node.js >= 22.5.0
// Chạy với flag: node --experimental-sqlite server.js
// ============================================================
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'phancong.db');
const db = new DatabaseSync(DB_PATH);

// WAL mode + foreign keys
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// ============================================================
// Schema
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    username    TEXT UNIQUE NOT NULL,
    email       TEXT NOT NULL DEFAULT '',
    password    TEXT NOT NULL,
    fullname    TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('admin','director','manager','employee')),
    department  TEXT NOT NULL DEFAULT '',
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  -- Bảng junction: 1 user thuộc nhiều phòng ban
  -- (user_id, department) là phòng ban user có quyền truy cập (full CRUD)
  -- is_primary = 1 nếu là phòng "chính" (hiển thị mặc định)
  CREATE TABLE IF NOT EXISTS user_departments (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    department  TEXT NOT NULL,
    is_primary  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, department)
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id              TEXT PRIMARY KEY,
    code            TEXT UNIQUE,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    department      TEXT NOT NULL DEFAULT '',
    collab_depts    TEXT NOT NULL DEFAULT '[]',
    assignee_id     TEXT REFERENCES users(id),
    created_by      TEXT NOT NULL,
    start_date      TEXT NOT NULL DEFAULT '',
    end_date        TEXT NOT NULL DEFAULT '',
    progress        INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'not_started',
    priority        TEXT NOT NULL DEFAULT 'medium',
    results         TEXT NOT NULL DEFAULT '',
    notes           TEXT NOT NULL DEFAULT '',
    tags            TEXT NOT NULL DEFAULT '[]',
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id          TEXT PRIMARY KEY,
    task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    assignee_id TEXT REFERENCES users(id),
    start_date  TEXT NOT NULL DEFAULT '',
    end_date    TEXT NOT NULL DEFAULT '',
    progress    INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'not_started',
    priority    TEXT NOT NULL DEFAULT 'medium',
    results     TEXT NOT NULL DEFAULT '',
    notes       TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '[]',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS daily_logs (
    id          TEXT PRIMARY KEY,
    subtask_id  TEXT NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
    log_date    TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    result      TEXT NOT NULL DEFAULT '',
    obstacle    TEXT NOT NULL DEFAULT '',
    progress    INTEGER NOT NULL DEFAULT 0,
    user_id     TEXT REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE TABLE IF NOT EXISTS history (
    id          TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id   TEXT NOT NULL,
    action      TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    user_name   TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  -- ============================================================
  -- 4-tier model: Dự án → Giai đoạn → Hạng mục giao → Đầu việc
  -- ============================================================

  -- Tầng 1: Dự án xây dựng
  CREATE TABLE IF NOT EXISTS construction_projects (
    id              TEXT PRIMARY KEY,
    code            TEXT UNIQUE NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    address         TEXT NOT NULL DEFAULT '',
    project_manager_id TEXT REFERENCES users(id),
    target_start    TEXT NOT NULL DEFAULT '',
    target_end      TEXT NOT NULL DEFAULT '',
    actual_end      TEXT,
    status          TEXT NOT NULL DEFAULT 'planning'
                    CHECK(status IN ('planning','in_progress','completed','cancelled')),
    budget          REAL,
    created_by      TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  -- Tầng 2: Giai đoạn dự án
  CREATE TABLE IF NOT EXISTS project_phases (
    id              TEXT PRIMARY KEY,
    project_id      TEXT NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    sequence        INTEGER NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    target_start    TEXT NOT NULL DEFAULT '',
    target_end      TEXT NOT NULL DEFAULT '',
    actual_start    TEXT,
    actual_end      TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','in_progress','completed')),
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    UNIQUE(project_id, sequence)
  );

  -- Tầng 3: Hạng mục giao (Bundle) — đơn vị giao BGĐ → TP
  CREATE TABLE IF NOT EXISTS assignment_bundles (
    id                    TEXT PRIMARY KEY,
    code                  TEXT UNIQUE,
    name                  TEXT NOT NULL,
    description           TEXT NOT NULL DEFAULT '',
    project_id            TEXT NOT NULL REFERENCES construction_projects(id) ON DELETE CASCADE,
    phase_id              TEXT REFERENCES project_phases(id) ON DELETE SET NULL,
    owner_id              TEXT NOT NULL REFERENCES users(id),
    department            TEXT NOT NULL,
    start_date            TEXT NOT NULL DEFAULT '',
    due_date              TEXT NOT NULL DEFAULT '',
    status                TEXT NOT NULL DEFAULT 'assigned'
                          CHECK(status IN ('assigned','in_progress','blocked','completed','closed')),
    progress              INTEGER NOT NULL DEFAULT 0,
    priority              TEXT NOT NULL DEFAULT 'medium',
    notes                 TEXT NOT NULL DEFAULT '',
    tags                  TEXT NOT NULL DEFAULT '[]',
    budget                REAL,
    collaborating_depts   TEXT NOT NULL DEFAULT '[]',
    block_reason          TEXT,
    created_by            TEXT NOT NULL,
    created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_bundles_project ON assignment_bundles(project_id);
  CREATE INDEX IF NOT EXISTS idx_bundles_phase ON assignment_bundles(phase_id);
  CREATE INDEX IF NOT EXISTS idx_bundles_owner ON assignment_bundles(owner_id);
  CREATE INDEX IF NOT EXISTS idx_phases_project ON project_phases(project_id);
  CREATE INDEX IF NOT EXISTS idx_projects_manager ON construction_projects(project_manager_id);
`);

// ============================================================
// Safe migration: thêm cột tags vào DB đã tồn tại (nếu thiếu)
// SQLite không có IF NOT EXISTS cho ADD COLUMN, nên dùng try/catch.
// ============================================================
try { db.exec("ALTER TABLE tasks ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'"); } catch {}
try { db.exec("ALTER TABLE subtasks ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT ''"); } catch {}

// 4-tier model — ALTER tasks để thêm project_id, bundle_id
// (nullable cho backward compat với data cũ)
try { db.exec("ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES construction_projects(id) ON DELETE SET NULL"); } catch {}
try { db.exec("ALTER TABLE tasks ADD COLUMN bundle_id  TEXT REFERENCES assignment_bundles(id)  ON DELETE SET NULL"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id)"); } catch {}
try { db.exec("CREATE INDEX IF NOT EXISTS idx_tasks_bundle  ON tasks(bundle_id)");  } catch {}

// ============================================================
// Safe migration: chuyển users.department cũ vào user_departments
// (chỉ chạy 1 lần — sau đó trigger bằng unique để tránh duplicate)
// ============================================================
try {
  const oldUsers = db.prepare('SELECT id, department FROM users WHERE department != ""').all();
  const insertUd = db.prepare('INSERT OR IGNORE INTO user_departments (user_id, department, is_primary) VALUES (?, ?, 1)');
  for (const u of oldUsers) insertUd.run(u.id, u.department);
} catch {}

// ============================================================
// Helper: bọc node:sqlite API giống better-sqlite3
// để các route file không cần thay đổi
// ============================================================
const dbWrapper = {
  /**
   * Trả về object có .run() và .get() và .all()
   * giống better-sqlite3's db.prepare()
   */
  prepare(sql) {
    return {
      run(...params) {
        const stmt = db.prepare(sql);
        return stmt.run(...params);
      },
      get(...params) {
        const stmt = db.prepare(sql);
        return stmt.get(...params);
      },
      all(...params) {
        const stmt = db.prepare(sql);
        return stmt.all(...params);
      },
    };
  },

  exec(sql) {
    return db.exec(sql);
  },

  pragma(str) {
    db.exec(`PRAGMA ${str}`);
  },
};

module.exports = dbWrapper;
