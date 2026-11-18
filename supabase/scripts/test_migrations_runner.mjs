import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  extractProjectRef,
  listMigrationFiles,
  runMigrations,
  sha256,
} from './apply_migrations.mjs';

test('extractProjectRef reads SUPABASE_PROJECT_REF or derives from VITE_SUPABASE_URL', () => {
  assert.equal(
    extractProjectRef({ SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst' }),
    'abcdefghijklmnopqrst'
  );
  assert.equal(
    extractProjectRef({ VITE_SUPABASE_URL: 'https://demo12345.supabase.co' }),
    'demo12345'
  );
  assert.equal(extractProjectRef({}), '');
});

test('listMigrationFiles returns sorted .sql files only', () => {
  const files = listMigrationFiles(path.resolve('supabase/migrations'));
  assert.deepEqual(files, [
    '001_initial_schema.sql',
    '002_functions_and_rpcs.sql',
    '003_rls_policies.sql',
    '004_seed_sections.sql',
  ]);
});

test('runMigrations skips unchanged files and applies new or modified files', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aes-mig-'));
  try {
    const sql1 = 'CREATE TABLE IF NOT EXISTS public.t1 (id INT);';
    const sql2 = 'CREATE OR REPLACE FUNCTION public.f1() RETURNS INT LANGUAGE sql AS $$ SELECT 1; $$;';
    const sql3 = 'CREATE TABLE IF NOT EXISTS public.t2 (id INT);';
    fs.writeFileSync(path.join(tmpDir, '001_a.sql'), sql1, 'utf8');
    fs.writeFileSync(path.join(tmpDir, '002_b.sql'), sql2, 'utf8');
    fs.writeFileSync(path.join(tmpDir, '003_c.sql'), sql3, 'utf8');

    const executedQueries = [];
    const mockFetch = async (_url, init) => {
      const body = JSON.parse(init.body);
      executedQueries.push(body.query);

      if (body.query.startsWith('SELECT filename, sha256')) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify([
              { filename: '001_a.sql', sha256: sha256(sql1) }, // unchanged -> skip
              { filename: '002_b.sql', sha256: 'outdated-hash' }, // modified -> apply
            ]),
        };
      }
      return { ok: true, status: 201, text: async () => '[]' };
    };

    const result = await runMigrations({
      migrationsDir: tmpDir,
      projectRef: 'testprojectref123456',
      accessToken: 'sbp_test_token',
      fetchImpl: mockFetch,
      logger: { log: () => {} },
    });

    assert.deepEqual(result.skipped, ['001_a.sql']);
    assert.deepEqual(result.applied, ['002_b.sql', '003_c.sql']);
    assert.ok(executedQueries.some((q) => q.includes('CREATE TABLE IF NOT EXISTS public._applied_migrations')));
    assert.ok(executedQueries.includes(sql2));
    assert.ok(executedQueries.includes(sql3));
    assert.ok(!executedQueries.includes(sql1));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('runMigrations throws clearly when API returns SQL error', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aes-mig-err-'));
  try {
    fs.writeFileSync(path.join(tmpDir, '001_bad.sql'), 'SELECT * FROM nonexistent;', 'utf8');

    let call = 0;
    const mockFetch = async () => {
      call++;
      if (call <= 2) return { ok: true, status: 200, text: async () => '[]' };
      return {
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ message: 'relation "nonexistent" does not exist' }),
      };
    };

    await assert.rejects(
      () =>
        runMigrations({
          migrationsDir: tmpDir,
          projectRef: 'testprojectref123456',
          accessToken: 'sbp_test_token',
          fetchImpl: mockFetch,
          logger: { log: () => {} },
        }),
      /relation "nonexistent" does not exist/
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

