#!/usr/bin/env node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

function usage() {
  console.log(`Usage:
  node scripts/issue-download-link.mjs --manifest <file> --db <database> [--remote|--local|--preview] [--site-url <url>] [--dry-run]

Manifest JSON shape:
{
  "jobReference": "2026-0042",
  "clientName": "Jane Citizen",
  "clientEmail": "jane@example.com",
  "notes": "Recovered family photos",
  "expiresAt": "2026-04-21T10:00:00Z",
  "files": [
    {
      "displayName": "Recovered Photos.zip",
      "r2Key": "recoveries/2026-0042/photos/recovered-photos.zip",
      "contentType": "application/zip",
      "sizeBytes": 1234567,
      "sha256": "optional"
    }
  ]
}

Notes:
- Use either expiresAt or expiresDays in the manifest.
- The script stores only a SHA-256 hash of the token in D1.
- The raw client URL is printed once after issuance.
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith('--')) continue;
    const key = part.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function q(value) {
  if (value == null) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function resolveExpiry(manifest) {
  if (manifest.expiresAt) {
    const iso = new Date(manifest.expiresAt).toISOString();
    if (Number.isNaN(Date.parse(iso))) throw new Error('Invalid expiresAt in manifest');
    return iso;
  }

  const days = Number(manifest.expiresDays ?? 7);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error('expiresDays must be a positive number');
  }

  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new Error('Manifest must be a JSON object');
  if (!manifest.jobReference || !manifest.clientName) {
    throw new Error('Manifest requires jobReference and clientName');
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new Error('Manifest requires at least one file');
  }
  for (const file of manifest.files) {
    if (!file.displayName || !file.r2Key) {
      throw new Error('Each file requires displayName and r2Key');
    }
  }
}

function buildSql(manifest, tokenHash, expiresAt) {
  const now = new Date().toISOString();
  const jobId = randomUUID();
  const tokenId = randomUUID();

  const statements = [
    'BEGIN TRANSACTION;',
    `INSERT INTO download_jobs (id, job_reference, client_name, client_email, notes, status, expires_at, created_at, updated_at, revoked_at) VALUES (${q(jobId)}, ${q(manifest.jobReference)}, ${q(manifest.clientName)}, ${q(manifest.clientEmail ?? null)}, ${q(manifest.notes ?? null)}, 'active', ${q(expiresAt)}, ${q(now)}, ${q(now)}, NULL);`,
    `INSERT INTO download_tokens (id, job_id, token_hash, status, expires_at, max_downloads, download_count, last_downloaded_at, created_at, revoked_at) VALUES (${q(tokenId)}, ${q(jobId)}, ${q(tokenHash)}, 'active', ${q(expiresAt)}, ${q(manifest.maxDownloads ?? null)}, 0, NULL, ${q(now)}, NULL);`,
  ];

  for (const file of manifest.files) {
    const fileId = randomUUID();
    statements.push(
      `INSERT INTO download_files (id, job_id, r2_key, display_name, content_type, size_bytes, sha256, created_at) VALUES (${q(fileId)}, ${q(jobId)}, ${q(file.r2Key)}, ${q(file.displayName)}, ${q(file.contentType ?? null)}, ${q(file.sizeBytes ?? null)}, ${q(file.sha256 ?? null)}, ${q(now)});`,
    );
  }

  statements.push('COMMIT;');
  return { sql: `${statements.join('\n')}\n`, jobId, tokenId };
}

async function runWrangler({ db, sqlFile, remote, local, preview }) {
  const args = ['wrangler', 'd1', 'execute', db, '--file', sqlFile, '--yes'];
  if (remote) args.push('--remote');
  if (local) args.push('--local');
  if (preview) args.push('--preview');

  await new Promise((resolve, reject) => {
    const child = spawn('npx', args, { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`wrangler d1 execute failed with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    usage();
    return;
  }

  const manifestPath = args.manifest;
  const db = args.db;
  const siteUrl = String(args['site-url'] ?? 'https://bloomwood.com.au').replace(/\/$/, '');
  const isRemote = Boolean(args.remote);
  const isLocal = Boolean(args.local);
  const isPreview = Boolean(args.preview);
  const isDryRun = Boolean(args['dry-run']);

  if (!manifestPath || !db) {
    usage();
    process.exitCode = 1;
    return;
  }

  if ([isRemote, isLocal, isPreview].filter(Boolean).length > 1) {
    throw new Error('Use only one of --remote, --local, or --preview');
  }

  const manifest = JSON.parse(await readFile(path.resolve(manifestPath), 'utf8'));
  validateManifest(manifest);
  const expiresAt = resolveExpiry(manifest);
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = sha256Hex(rawToken);
  const { sql, jobId, tokenId } = buildSql(manifest, tokenHash, expiresAt);

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'bloomwood-download-'));
  const sqlFile = path.join(tempDir, 'issue-download-link.sql');

  try {
    await writeFile(sqlFile, sql, 'utf8');

    if (isDryRun) {
      console.log('Dry run only. SQL written to:', sqlFile);
    } else {
      await runWrangler({ db, sqlFile, remote: isRemote, local: isLocal, preview: isPreview });
    }

    console.log('\nIssued client download link');
    console.log('---------------------------');
    console.log('Job ID:        ', jobId);
    console.log('Token ID:      ', tokenId);
    console.log('Reference:     ', manifest.jobReference);
    console.log('Client:        ', manifest.clientName);
    console.log('Expires at:    ', expiresAt);
    console.log('Files:         ', manifest.files.length);
    console.log('URL:           ', `${siteUrl}/solutions/download/${rawToken}`);
    console.log('\nKeep the raw URL secure. Only the token hash is stored in D1.');
  } finally {
    if (!isDryRun) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
