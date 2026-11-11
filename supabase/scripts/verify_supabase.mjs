#!/usr/bin/env node
/**
 * Verifies live Supabase connection, schema migration status, and RLS enforcement
 * using public client credentials from frontend/.env.local (or root .env).
 */

import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const env = {
  ...loadEnvFile(path.resolve('.env')),
  ...loadEnvFile(path.resolve('frontend/.env.local')),
};

const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in frontend/.env.local');
  process.exit(1);
}

console.log(`Checking Supabase project: ${url}`);

const authRes = await fetch(`${url}/auth/v1/health`, {
  headers: { apikey: key },
});
const authText = await authRes.text();
console.log(`1. Auth API health: ${authRes.status} ${authText}`);

const restRes = await fetch(`${url}/rest/v1/students?select=id&limit=1`, {
  headers: { apikey: key },
});
const restText = await restRes.text();
console.log(`2. Table check (public.students as anon): ${restRes.status} ${restText}`);

const rpcRes = await fetch(`${url}/rest/v1/rpc/get_dashboard_stats`, {
  method: 'POST',
  headers: {
    apikey: key,
    'Content-Type': 'application/json',
  },
  body: '{}',
});
const rpcText = await rpcRes.text();
console.log(`3. RPC check (get_dashboard_stats as anon): ${rpcRes.status} ${rpcText}`);

if (restRes.status === 404 && restText.includes('PGRST205')) {
  console.log('\nStatus: Connected to Supabase, but SQL migrations (001-004) have NOT been executed yet.');
} else if ((restRes.status === 401 || restRes.status === 403) && (rpcRes.status === 400 || rpcRes.status === 401 || rpcRes.status === 403)) {
  console.log('\nStatus: Connected, schema & RPCs exist, and anonymous access is securely blocked by RLS.');
} else {
  console.log('\nStatus: Review the responses above to confirm migrations and RLS policies.');
}

