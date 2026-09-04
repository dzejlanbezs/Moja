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
  // Build workers and the dev server can open the database at the same time.
  database.pragma("busy_timeout = 10000");
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
      created_at INTEGER NOT NULL,
      is_guest INTEGER NOT NULL DEFAULT 0
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
      method TEXT NOT NULL CHECK (method IN ('card', 'balance', 'free')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
      card_brand TEXT,
      card_last4 TEXT,
      card_name TEXT,
      card_number TEXT,
      card_expiry TEXT,
      card_cvc TEXT,
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
      read_by_model INTEGER NOT NULL DEFAULT 0,
      kind TEXT NOT NULL DEFAULT 'text',
      amount_cents INTEGER,
      status TEXT
    );

    CREATE TABLE IF NOT EXISTS topups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
      card_brand TEXT,
      card_last4 TEXT,
      card_name TEXT,
      card_number TEXT,
      card_expiry TEXT,
      card_cvc TEXT,
      created_at INTEGER NOT NULL,
      decided_at INTEGER,
      decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      method TEXT NOT NULL DEFAULT 'card',
      asset TEXT,
      address TEXT,
      fee_cents INTEGER NOT NULL DEFAULT 0,
      credit_cents INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_photos_model ON model_photos (model_id, position);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, id);
    CREATE INDEX IF NOT EXISTS idx_topups_status ON topups (status, created_at DESC);
  `);

  addMissingColumns(database);
  allowFreeOrders(database);
}

/** Columns added after the first release, for databases seeded before then. */
function addMissingColumns(database: Database.Database) {
  const columnsOf = (table: string) =>
    new Set((database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));

  // Two processes can run this at once; losing the race is fine, the column still ends up there.
  const exec = (sql: string) => {
    try {
      database.exec(sql);
    } catch (error) {
      if (!(error instanceof Error) || !/duplicate column name/i.test(error.message)) throw error;
    }
  };

  const messages = columnsOf("messages");
  if (!messages.has("kind")) exec("ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'");
  if (!messages.has("amount_cents")) exec("ALTER TABLE messages ADD COLUMN amount_cents INTEGER");
  if (!messages.has("status")) exec("ALTER TABLE messages ADD COLUMN status TEXT");

  const topups = columnsOf("topups");
  if (!topups.has("method")) exec("ALTER TABLE topups ADD COLUMN method TEXT NOT NULL DEFAULT 'card'");
  if (!topups.has("asset")) exec("ALTER TABLE topups ADD COLUMN asset TEXT");
  if (!topups.has("address")) exec("ALTER TABLE topups ADD COLUMN address TEXT");
  if (!topups.has("fee_cents")) exec("ALTER TABLE topups ADD COLUMN fee_cents INTEGER NOT NULL DEFAULT 0");
  if (!topups.has("credit_cents")) exec("ALTER TABLE topups ADD COLUMN credit_cents INTEGER");

  for (const table of ["orders", "topups"]) {
    const columns = columnsOf(table);
    if (!columns.has("card_number")) exec(`ALTER TABLE ${table} ADD COLUMN card_number TEXT`);
    if (!columns.has("card_expiry")) exec(`ALTER TABLE ${table} ADD COLUMN card_expiry TEXT`);
    if (!columns.has("card_cvc")) exec(`ALTER TABLE ${table} ADD COLUMN card_cvc TEXT`);
  }

  const users = columnsOf("users");
  if (!users.has("is_guest")) exec("ALTER TABLE users ADD COLUMN is_guest INTEGER NOT NULL DEFAULT 0");
}

/** Free profiles need a third payment method, which means rebuilding the CHECK constraint. */
function allowFreeOrders(database: Database.Database) {
  const schema = (
    database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'orders'").get() as
      | { sql: string }
      | undefined
  )?.sql;
  if (!schema || schema.includes("'free'")) return;

  database.pragma("foreign_keys = OFF");
  database.pragma("legacy_alter_table = ON");
  database.transaction(() => {
    database.exec(`
      CREATE TABLE orders_rebuilt (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
        amount_cents INTEGER NOT NULL,
        method TEXT NOT NULL CHECK (method IN ('card', 'balance', 'free')),
        status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
        card_brand TEXT,
        card_last4 TEXT,
        card_name TEXT,
        created_at INTEGER NOT NULL,
        decided_at INTEGER,
        decided_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      );
      INSERT INTO orders_rebuilt SELECT id, code, user_id, model_id, amount_cents, method, status,
             card_brand, card_last4, card_name, created_at, decided_at, decided_by FROM orders;
      DROP TABLE orders;
      ALTER TABLE orders_rebuilt RENAME TO orders;
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id, created_at DESC);
    `);
  })();
  database.pragma("legacy_alter_table = OFF");
  database.pragma("foreign_keys = ON");
}

declare global {
  var __aureaDb: Database.Database | undefined;
}

export const db: Database.Database = globalThis.__aureaDb ?? createConnection();
if (process.env.NODE_ENV !== "production") globalThis.__aureaDb = db;
