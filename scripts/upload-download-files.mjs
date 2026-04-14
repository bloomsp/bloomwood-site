#!/usr/bin/env node
import { stat, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';

function usage() {
  console.log(`Usage:
  node scripts/upload-download-files.mjs \
    --source <file-or-directory> \
    --bucket <bucket> \
    --job-reference <ref> \
    --client-name <name> \
    [--client-email <email>] \
    [--notes <text>] \
    [--prefix <r2-prefix>] \
    [--expires-days <days>] \
    [--manifest-out <file>] \
    [--remote|--local]

What it does:
- walks a local file or directory
- uploads files to R2 via Wrangler
- computes sha256 + size for each file
- writes a manifest JSON ready for scripts/issue-download-link.mjs

Examples:
  node scripts/upload-download-files.mjs \
    --source ./recovery-2026-0042 \
    --bucket bloomwood-client-downloads \
    --job-reference 2026-0042 \
    --client-name "Jane Citizen" \
    --client-email jane@example.com \
    --notes "Recovered family photos" \
    --remote
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

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function sanitizeSegment(value) {
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'file';
}

async function collectFiles(sourcePath) {
  const resolved = path.resolve(sourcePath);
  const sourceStat = await stat(resolved);

  if (sourceStat.isFile()) {
    return [{ absolutePath: resolved, relativePath: path.basename(resolved) }];
  }

  if (!sourceStat.isDirectory()) {
    throw new Error('Source must be a file or directory');
  }

  const files = [];

  async function walk(current, base) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath, base);
        continue;
      }
      if (!entry.isFile()) continue;
      files.push({
        absolutePath: fullPath,
        relativePath: path.relative(base, fullPath),
      });
    }
  }

  await walk(resolved, resolved);
  return files;
}

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.zip': 'application/zip',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.json': 'application/json',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.tar': 'application/x-tar',
    '.gz': 'application/gzip',
    '.7z': 'application/x-7z-compressed',
  };
  return map[ext] ?? 'application/octet-stream';
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function runWranglerPut({ bucket, key, filePath, contentType, remote, local }) {
  const args = ['wrangler', 'r2', 'object', 'put', `${bucket}/${key}`, '--file', filePath, '--content-type', contentType, '--force'];
  if (remote) args.push('--remote');
  if (local) args.push('--local');

  await new Promise((resolve, reject) => {
    const child = spawn('npx', args, { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`wrangler r2 object put failed with code ${code}`));
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

  const source = args.source;
  const bucket = args.bucket;
  const jobReference = args['job-reference'];
  const clientName = args['client-name'];
  const clientEmail = args['client-email'];
  const notes = args.notes;
  const prefix = args.prefix;
  const manifestOut = args['manifest-out'];
  const expiresDays = Number(args['expires-days'] ?? 7);
  const remote = Boolean(args.remote);
  const local = Boolean(args.local);
  const dryRun = Boolean(args['dry-run']);

  if (!source || !bucket || !jobReference || !clientName) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (remote && local) {
    throw new Error('Use only one of --remote or --local');
  }

  const files = await collectFiles(source);
  if (files.length === 0) {
    throw new Error('No files found to upload');
  }

  const safeRef = sanitizeSegment(jobReference);
  const basePrefix = prefix ? prefix.replace(/^\/+|\/+$/g, '') : `recoveries/${safeRef}`;
  const manifest = {
    jobReference,
    clientName,
    clientEmail: clientEmail ?? undefined,
    notes: notes ?? undefined,
    expiresDays,
    files: [],
  };

  for (const file of files) {
    const stats = await stat(file.absolutePath);
    const relativePath = toPosix(file.relativePath);
    const r2Key = `${basePrefix}/${relativePath}`;
    const contentType = guessContentType(file.absolutePath);
    const sha256 = await sha256File(file.absolutePath);

    if (!dryRun) {
      await runWranglerPut({
        bucket,
        key: r2Key,
        filePath: file.absolutePath,
        contentType,
        remote,
        local,
      });
    }

    manifest.files.push({
      displayName: relativePath,
      r2Key,
      contentType,
      sizeBytes: stats.size,
      sha256,
    });
  }

  const defaultManifestOut = path.resolve(`client-download-${safeRef}.json`);
  const outPath = path.resolve(manifestOut ?? defaultManifestOut);
  await writeFile(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log('\nUpload helper complete');
  console.log('----------------------');
  console.log('Files processed:', manifest.files.length);
  console.log('Manifest:       ', outPath);
  console.log('Bucket:         ', bucket);
  console.log('Prefix:         ', basePrefix);

  if (dryRun) {
    console.log('Mode:           dry-run (no R2 upload performed)');
  }

  console.log('\nNext step:');
  console.log(`npm run downloads:issue -- --manifest ${JSON.stringify(outPath)} --db CLIENT_DOWNLOADS_DB --remote`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
