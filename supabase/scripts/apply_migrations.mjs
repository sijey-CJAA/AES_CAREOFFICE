#!/usr/bin/env node
/**
 * Automated Supabase SQL Migration Runner (via Supabase Management API)
 *
 * Applies SQL files from `supabase/migrations/*.sql` in sorted filename order.
 * Tracks filename + SHA-256 checksum in `public._applied_migrations`:
 *   - Unchanged migrations are skipped automatically.
 *   - New migrations and modified idempotent migrations are applied automatically.
 *
 * Required environment variables:
 *   SUPABASE_ACCESS_TOKEN  - Supabase Personal Access Token (sbp_...)
 *   SUPABASE_PROJECT_REF   - 20-char Supabase project ref (or derived from VITE_SUPABASE_URL)
 *
 * Optional flags / env:
 *   --dry-run              - Print which migrations would run without executing SQL
 *   --force                - Re-run all migration files regardless of stored checksum
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TRACKING_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS public._applied_migrations (
    filename TEXT PRIMARY KEY,
    sha256 TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public._applied_migrations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public._applied_migrations FROM PUBLIC, anon, authenticated;
`;

export function sha256(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

export function extractProjectRef(env = process.env) {
  const direct = (env.SUPABASE_PROJECT_REF || env.SUPABASE_PROJECT_ID || '').trim();
  if (direct) return direct;

  const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim();
  const match = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match ? match[1] : '';
}

export function listMigrationFiles(migrationsDir) {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => name.toLowerCase().endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

export function escapeSqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export async function executeSupabaseSql({
  projectRef,
  accessToken,
  query,
  fetchImpl = fetch,
}) {
  const endpoint = `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/query`;
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    const detail =
      parsed && typeof parsed === 'object' && 'message' in parsed
        ? parsed.message
        : text || `HTTP ${response.status}`;
    throw new Error(`Supabase SQL API error (${response.status}): ${detail}`);
  }

  return parsed;
}

export async function runMigrations({
  migrationsDir = path.resolve('supabase/migrations'),
  projectRef,
  accessToken,
  dryRun = false,
  force = false,
  fetchImpl = fetch,
  logger = console,
}) {
  if (!projectRef) {
    throw new Error(
      'Missing SUPABASE_PROJECT_REF (or VITE_SUPABASE_URL). Set SUPABASE_PROJECT_REF in GitHub Secrets.'
    );
  }
  if (!accessToken) {
    throw new Error(
      'Missing SUPABASE_ACCESS_TOKEN. Create a Personal Access Token in Supabase Account Settings -> Access Tokens and add it to GitHub Secrets.'
    );
  }

  const files = listMigrationFiles(migrationsDir);
  if (files.length === 0) {
    logger.log('No SQL migration files found.');
    return { applied: [], skipped: [] };
  }

  const exec = (query) =>
    executeSupabaseSql({ projectRef, accessToken, query, fetchImpl });

  let appliedMap = new Map();
  if (!dryRun) {
    await exec(TRACKING_TABLE_SQL);
    const existingRows = await exec(
      'SELECT filename, sha256 FROM public._applied_migrations;'
    );
    if (Array.isArray(existingRows)) {
      for (const row of existingRows) {
        if (row && typeof row.filename === 'string') {
          appliedMap.set(row.filename, row.sha256);
        }
      }
    }
  }

  const applied = [];
  const skipped = [];

  for (const filename of files) {
    const fullPath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(fullPath, 'utf8');
    const hash = sha256(sql);
    const prevHash = appliedMap.get(filename);

    if (!force && prevHash === hash) {
      logger.log(`[skip] ${filename} (unchanged)`);
      skipped.push(filename);
      continue;
    }

    const reason = prevHash ? 'updated' : 'new';
    if (dryRun) {
      logger.log(`[dry-run] would apply ${filename} (${reason})`);
      applied.push(filename);
      continue;
    }

    logger.log(`[apply] ${filename} (${reason})...`);
    await exec(sql);
    await exec(`
      INSERT INTO public._applied_migrations (filename, sha256, applied_at)
      VALUES (${escapeSqlLiteral(filename)}, ${escapeSqlLiteral(hash)}, now())
      ON CONFLICT (filename) DO UPDATE
      SET sha256 = EXCLUDED.sha256, applied_at = now();
    `);
    logger.log(`[done] ${filename}`);
    applied.push(filename);
  }

  logger.log(
    `Migration summary: ${applied.length} applied, ${skipped.length} skipped.`
  );
  return { applied, skipped };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');
  const force = args.has('--force');

  const projectRef = extractProjectRef(process.env);
  const accessToken = (process.env.SUPABASE_ACCESS_TOKEN || '').trim();

  await runMigrations({
    migrationsDir: path.resolve('supabase/migrations'),
    projectRef,
    accessToken,
    dryRun,
    force,
  });
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}

