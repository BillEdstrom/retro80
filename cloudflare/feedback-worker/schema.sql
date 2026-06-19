CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  app TEXT,
  version TEXT,
  os TEXT,
  type TEXT,
  message TEXT NOT NULL,
  email TEXT,
  consent INTEGER DEFAULT 0
);

-- Quick lookup of everyone who opted into the news/tips list.
CREATE INDEX IF NOT EXISTS idx_consent_email ON submissions (consent, email);
