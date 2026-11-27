CREATE TABLE oauth_states(hash TEXT PRIMARY KEY,actor TEXT NOT NULL,expires_at INTEGER NOT NULL) STRICT;
CREATE TABLE connection(id INTEGER PRIMARY KEY CHECK(id=1),encrypted_tokens TEXT NOT NULL,expires_at INTEGER NOT NULL,tenant_id TEXT NOT NULL,tenant_name TEXT NOT NULL,refresh_lock TEXT,lock_until INTEGER NOT NULL DEFAULT 0) STRICT;
