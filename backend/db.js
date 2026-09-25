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
    password    TEXT NOT NULL,
    fullname    TEXT NOT NULL,
    role        TEXT NOT NULL CHECK(role IN ('admin','director','manager','employee')),
    department  TEXT NOT NULL DEFAULT '',
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
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
`);

// ============================================================
// Safe migration: thêm cột tags vào DB đã tồn tại (nếu thiếu)
// SQLite không có IF NOT EXISTS cho ADD COLUMN, nên dùng try/catch.
// ============================================================
try { db.exec("ALTER TABLE tasks ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'"); } catch {}
try { db.exec("ALTER TABLE subtasks ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'"); } catch {}

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
