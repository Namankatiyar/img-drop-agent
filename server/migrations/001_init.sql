PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY,
  created_at  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'ready'
              CHECK (status IN ('ready', 'claimed')),
  claimed_at  TEXT,
  note        TEXT,
  client_key  TEXT UNIQUE,
  image_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  file_name  TEXT NOT NULL,
  mime       TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  UNIQUE (group_id, position)
);

CREATE INDEX IF NOT EXISTS idx_groups_status_id ON groups (status, id DESC);
