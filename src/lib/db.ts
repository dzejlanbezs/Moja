import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_PATH = path.join(DATA_DIR, "app.db");

function createConnection() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const database = new Database(DB_PATH);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  migrate(database);
  return database;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'model', 'admin')),
      balance_cents INTEGER NOT NULL DEFAULT 0,
      avatar_url TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      tagline TEXT NOT NULL,
      bio TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      height_cm INTEGER NOT NULL,
      languages TEXT NOT NULL,
      interests TEXT NOT NULL,
      zodiac TEXT NOT NULL,
      hair TEXT NOT NULL,
      eyes TEXT NOT NULL,
      response_time TEXT NOT NULL,
      rating REAL NOT NULL DEFAULT 5,
      reviews_count INTEGER NOT NULL DEFAULT 0,
      is_online INTEGER NOT NULL DEFAULT 0,
      is_verified INTEGER NOT NULL DEFAULT 1,
      is_featured INTEGER NOT NULL DEFAULT 0,
      accent TEXT NOT NULL DEFAULT '#e8407a',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS model_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      position INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      method TEXT NOT NULL CHECK (method IN ('card', 'balance')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
      card_brand TEXT,
      card_last4 TEXT,
      card_name TEXT,
      created_at INTEGER NOT NULL,
      decided_at INTEGER,
      decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      kind TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
      order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      last_message_at INTEGER NOT NULL,
      UNIQUE (user_id, model_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'model')),
      body TEXT,
      image_url TEXT,
      created_at INTEGER NOT NULL,
      read_by_user INTEGER NOT NULL DEFAULT 0,
      read_by_model INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_photos_model ON model_photos (model_id, position);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, id);
  `);
}

declare global {
  var __aureaDb: Database.Database | undefined;
}

export const db: Database.Database = globalThis.__aureaDb ?? createConnection();
if (process.env.NODE_ENV !== "production") globalThis.__aureaDb = db;
