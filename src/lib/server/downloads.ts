type D1Value = string | number | null;

type D1RunResult<T = unknown> = {
  results?: T[];
  success?: boolean;
  meta?: Record<string, unknown>;
};

type D1PreparedStatement = {
  bind: (...values: D1Value[]) => D1PreparedStatement;
  first<T = unknown>(column?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1RunResult<T>>;
  run(): Promise<D1RunResult>;
};

type D1DatabaseLike = {
  prepare: (query: string) => D1PreparedStatement;
};

type R2ObjectBodyLike = {
  body: ReadableStream | null;
  httpEtag?: string;
  size?: number;
  uploaded?: Date;
  writeHttpMetadata?: (headers: Headers) => void;
};

type R2BucketLike = {
  get: (key: string) => Promise<R2ObjectBodyLike | null>;
};

export type DownloadEnv = {
  CLIENT_DOWNLOADS_DB?: D1DatabaseLike;
  CLIENT_DOWNLOADS_BUCKET?: R2BucketLike;
};

export type DownloadJob = {
  id: string;
  jobReference: string;
  clientName: string;
  notes: string | null;
  expiresAt: string;
};

export type DownloadFile = {
  id: string;
  jobId: string;
  displayName: string;
  contentType: string | null;
  sizeBytes: number | null;
  r2Key: string;
};

export type DownloadTokenLookup = {
  tokenId: string;
  jobId: string;
  expiresAt: string;
  status: string;
  maxDownloads: number | null;
  downloadCount: number;
};

export type DownloadAccess = {
  token: DownloadTokenLookup;
  job: DownloadJob;
  files: DownloadFile[];
};

function requireDb(env: DownloadEnv): D1DatabaseLike {
  if (!env.CLIENT_DOWNLOADS_DB) {
    throw new Error('CLIENT_DOWNLOADS_DB binding is not configured');
  }
  return env.CLIENT_DOWNLOADS_DB;
}

export function requireBucket(env: DownloadEnv): R2BucketLike {
  if (!env.CLIENT_DOWNLOADS_BUCKET) {
    throw new Error('CLIENT_DOWNLOADS_BUCKET binding is not configured');
  }
  return env.CLIENT_DOWNLOADS_BUCKET;
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isExpired(iso: string): boolean {
  return Date.parse(iso) <= Date.now();
}

function canDownload(token: DownloadTokenLookup): boolean {
  return token.maxDownloads == null || token.downloadCount < token.maxDownloads;
}

export async function getDownloadAccess(env: DownloadEnv, rawToken: string): Promise<DownloadAccess | null> {
  const token = rawToken.trim();
  if (!token) return null;

  const db = requireDb(env);
  const tokenHash = await sha256Hex(token);

  const tokenRow = await db
    .prepare(`
      SELECT
        id AS tokenId,
        job_id AS jobId,
        expires_at AS expiresAt,
        status,
        max_downloads AS maxDownloads,
        download_count AS downloadCount
      FROM download_tokens
      WHERE token_hash = ?
      LIMIT 1
    `)
    .bind(tokenHash)
    .first<DownloadTokenLookup>();

  if (!tokenRow || tokenRow.status !== 'active' || isExpired(tokenRow.expiresAt) || !canDownload(tokenRow)) {
    return null;
  }

  const job = await db
    .prepare(`
      SELECT
        id,
        job_reference AS jobReference,
        client_name AS clientName,
        notes,
        expires_at AS expiresAt
      FROM download_jobs
      WHERE id = ?
      LIMIT 1
    `)
    .bind(tokenRow.jobId)
    .first<DownloadJob>();

  if (!job) return null;

  const filesResult = await db
    .prepare(`
      SELECT
        id,
        job_id AS jobId,
        display_name AS displayName,
        content_type AS contentType,
        size_bytes AS sizeBytes,
        r2_key AS r2Key
      FROM download_files
      WHERE job_id = ?
      ORDER BY display_name ASC
    `)
    .bind(job.id)
    .all<DownloadFile>();

  return {
    token: tokenRow,
    job,
    files: filesResult.results ?? [],
  };
}

export async function getDownloadFile(env: DownloadEnv, rawToken: string, fileId: string) {
  const access = await getDownloadAccess(env, rawToken);
  if (!access) return null;

  const file = access.files.find((entry) => entry.id === fileId);
  if (!file) return null;

  const bucket = requireBucket(env);
  const object = await bucket.get(file.r2Key);
  if (!object?.body) {
    throw new Error(`File missing in R2 for key: ${file.r2Key}`);
  }

  return { access, file, object };
}

export async function logDownloadEvent(
  env: DownloadEnv,
  args: {
    tokenId: string | null;
    jobId: string | null;
    fileId: string | null;
    eventType: string;
    ipHash?: string | null;
    userAgent?: string | null;
    country?: string | null;
    detail?: string | null;
  },
) {
  const db = requireDb(env);
  const id = crypto.randomUUID();
  await db
    .prepare(`
      INSERT INTO download_events (
        id,
        token_id,
        job_id,
        file_id,
        event_type,
        ip_hash,
        user_agent,
        country,
        created_at,
        detail
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      id,
      args.tokenId,
      args.jobId,
      args.fileId,
      args.eventType,
      args.ipHash ?? null,
      args.userAgent ?? null,
      args.country ?? null,
      new Date().toISOString(),
      args.detail ?? null,
    )
    .run();
}

export async function incrementDownloadCount(env: DownloadEnv, tokenId: string) {
  const db = requireDb(env);
  await db
    .prepare(`
      UPDATE download_tokens
      SET download_count = download_count + 1,
          last_downloaded_at = ?
      WHERE id = ?
    `)
    .bind(new Date().toISOString(), tokenId)
    .run();
}

export function formatBytes(sizeBytes: number | null): string {
  if (sizeBytes == null || Number.isNaN(sizeBytes)) return 'Unknown size';
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = sizeBytes;
  let unit = -1;
  do {
    size /= 1024;
    unit += 1;
  } while (size >= 1024 && unit < units.length - 1);

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unit]}`;
}
