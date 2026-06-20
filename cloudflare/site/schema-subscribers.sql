CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  email TEXT NOT NULL,
  consent INTEGER DEFAULT 0,
  code TEXT,
  granted INTEGER DEFAULT 0,   -- 1 if a valid access code was supplied
  app TEXT,
  ua TEXT
);

-- One row per email (re-signups update the latest values).
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers (email);
