-- Client download MVP schema for Bloomwood

CREATE TABLE IF NOT EXISTS download_jobs (
  id TEXT PRIMARY KEY,
  job_reference TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE IF NOT EXISTS download_files (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER,
  sha256 TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (job_id) REFERENCES download_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_download_files_job_id ON download_files(job_id);

CREATE TABLE IF NOT EXISTS download_tokens (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TEXT NOT NULL,
  max_downloads INTEGER,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_downloaded_at TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (job_id) REFERENCES download_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_download_tokens_job_id ON download_tokens(job_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_status_expires_at ON download_tokens(status, expires_at);

CREATE TABLE IF NOT EXISTS download_events (
  id TEXT PRIMARY KEY,
  token_id TEXT,
  job_id TEXT,
  file_id TEXT,
  event_type TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  country TEXT,
  created_at TEXT NOT NULL,
  detail TEXT,
  FOREIGN KEY (token_id) REFERENCES download_tokens(id),
  FOREIGN KEY (job_id) REFERENCES download_jobs(id),
  FOREIGN KEY (file_id) REFERENCES download_files(id)
);

CREATE INDEX IF NOT EXISTS idx_download_events_job_id_created_at ON download_events(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_download_events_token_id_created_at ON download_events(token_id, created_at);
