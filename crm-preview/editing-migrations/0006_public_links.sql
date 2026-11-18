ALTER TABLE deliveries ADD COLUMN token_hash TEXT;
ALTER TABLE deliveries ADD COLUMN public_downloads INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX delivery_token_hash ON deliveries(token_hash) WHERE token_hash IS NOT NULL;
