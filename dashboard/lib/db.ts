import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync } from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'strategy.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS deals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_name TEXT NOT NULL,
      deal_size TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id INTEGER REFERENCES deals(id),
      variables_json TEXT NOT NULL,
      predicted_probability REAL NOT NULL,
      weights_used_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS outcomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deal_id INTEGER REFERENCES deals(id),
      actual_result INTEGER NOT NULL,
      closed_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      variable_id TEXT NOT NULL,
      weight_value REAL NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const count = (db.prepare('SELECT COUNT(*) as c FROM weights').get() as { c: number }).c;
  if (count === 0) {
    const defaults = [
      { id: 'decision_maker_access', value: 0.22 },
      { id: 'past_win_history', value: 0.15 },
      { id: 'price_competitiveness', value: 0.18 },
      { id: 'tech_differentiation', value: 0.13 },
      { id: 'lg_cns_threat', value: 0.14 },
      { id: 'samsung_sds_threat', value: 0.10 },
      { id: 'budget_confirmed', value: 0.08 },
    ];
    const insert = db.prepare(
      'INSERT INTO weights (variable_id, weight_value, version) VALUES (?, ?, 1)'
    );
    defaults.forEach(w => insert.run(w.id, w.value));
  }
}
