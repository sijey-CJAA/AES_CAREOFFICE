#!/usr/bin/env node
/**
 * MySQL (phpMyAdmin) SQL Dump -> Supabase PostgreSQL Data Import Converter
 *
 * Safely parses `INSERT INTO ... VALUES ...` statements from a phpMyAdmin export
 * without modifying the source file, producing:
 *   1. PostgreSQL-compatible INSERT statements in foreign-key-safe order
 *   2. Stripped `admins` rows (id, email, created_at only — passwords excluded for Supabase Auth)
 *   3. Sanitized MySQL zero-dates ('0000-00-00' -> NULL) and backslash escapes
 *   4. Identity sequence resets (`setval`) for every migrated table
 *   5. Record-count verification queries
 *
 * Usage:
 *   node supabase/scripts/convert_mysql_dump.mjs <input-mysql-dump.sql> [output-postgres-import.sql]
 */

import fs from 'node:fs';
import path from 'node:path';

export const IMPORT_ORDER = [
  'admins',
  'students',
  'parents',
  'assessment_records',
  'case_register',
  'case_students',
  'cars_assessment_sessions',
  'cars_student_evaluations',
  'cars_norm_tables',
];

export const TABLE_COLUMNS = {
  admins: ['id', 'email', 'password', 'created_at'],
  students: [
    'id',
    'full_name',
    'lrn',
    'grade_section',
    'grade_level',
    'section',
    'school_year',
    'date_of_birth',
    'contact_number',
    'home_address',
    'blood_type',
    'allergies',
    'medications',
    'status',
    'created_at',
    'deleted_at',
  ],
  parents: [
    'id',
    'student_id',
    'parent_type',
    'full_name',
    'relationship',
    'home_address',
    'mobile_number',
    'telephone_number',
    'email_address',
    'workplace',
    'workplace_address',
    'emergency_contact_number',
    'created_at',
    'deleted_at',
  ],
  assessment_records: [
    'id',
    'student_id',
    'record_number',
    'school_year',
    'date',
    'grade_section',
    'contact_number',
    'status',
    'assessment_provider',
    'findings',
    'diagnosis',
    'recommendations',
    'created_at',
    'deleted_at',
  ],
  case_register: [
    'id',
    'case_number',
    'school_year',
    'date',
    'grade_section',
    'case_type',
    'brief_description',
    'actions_taken',
    'outcome_disposition',
    'created_at',
    'deleted_at',
  ],
  case_students: ['case_id', 'student_id'],
  cars_assessment_sessions: [
    'id',
    'academic_year',
    'grade_level',
    'section_name',
    'evaluator_id',
    'assessed_at',
    'created_at',
    'updated_at',
  ],
  cars_student_evaluations: [
    'id',
    'session_id',
    'student_id',
    'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8',
    'q9', 'q10', 'q11', 'q12', 'q13', 'q14', 'q15', 'q16',
    'q17', 'q18', 'q19', 'q20', 'q21', 'q22', 'q23', 'q24',
    'externalizing_score',
    'internalizing_score',
    'social_score',
    'academic_score',
    'total_raw_score',
    't_score',
    'percentile_rank',
    'risk_status',
    'tier_level',
    'created_at',
    'updated_at',
  ],
  cars_norm_tables: ['id', 'grade_group', 'raw_score', 't_score', 'percentile'],
};

const IDENTITY_TABLES = [
  'admins',
  'students',
  'parents',
  'assessment_records',
  'case_register',
  'cars_assessment_sessions',
  'cars_student_evaluations',
  'cars_norm_tables',
];

/**
 * Unescapes a MySQL single-quoted string literal (without outer quotes) into raw JS text.
 */
export function unescapeMySqlString(raw) {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '\\' && i + 1 < raw.length) {
      const next = raw[++i];
      switch (next) {
        case '0': out += '\0'; break;
        case 'b': out += '\b'; break;
        case 'n': out += '\n'; break;
        case 'r': out += '\r'; break;
        case 't': out += '\t'; break;
        case 'Z': out += '\x1A'; break;
        case "'": out += "'"; break;
        case '"': out += '"'; break;
        case '\\': out += '\\'; break;
        default: out += next; break;
      }
    } else if (ch === "'" && raw[i + 1] === "'") {
      out += "'";
      i++;
    } else {
      out += ch;
    }
  }
  return out;
}

/**
 * Formats a JS value (or null) as a standard PostgreSQL SQL literal.
 */
export function toPostgresLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const str = String(value);
  if (str === '0000-00-00' || str === '0000-00-00 00:00:00') return 'NULL';
  // Standard SQL single-quote escaping; use E'...' if control chars remain
  if (/[\n\r\t\0]/.test(str)) {
    const escaped = str
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "''")
      .replace(/\0/g, '')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    return `E'${escaped}'`;
  }
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Parses tuple list `(...), (...)` from an INSERT VALUES clause.
 * Returns array of parsed value arrays where NULL -> null, numbers -> number, strings -> string.
 */
export function parseMySqlTuples(valuesClause) {
  const rows = [];
  let i = 0;
  const len = valuesClause.length;

  const skipWs = () => {
    while (i < len && /[\s,]/.test(valuesClause[i])) i++;
  };

  while (i < len) {
    skipWs();
    if (i >= len || valuesClause[i] === ';') break;
    if (valuesClause[i] !== '(') {
      i++;
      continue;
    }
    i++; // consume '('
    const row = [];
    while (i < len) {
      while (i < len && /\s/.test(valuesClause[i])) i++;
      if (valuesClause[i] === ')') {
        i++;
        break;
      }
      if (valuesClause[i] === "'") {
        i++; // consume opening quote
        let raw = '';
        while (i < len) {
          const ch = valuesClause[i];
          if (ch === '\\' && i + 1 < len) {
            raw += ch + valuesClause[i + 1];
            i += 2;
          } else if (ch === "'" && valuesClause[i + 1] === "'") {
            raw += "''";
            i += 2;
          } else if (ch === "'") {
            i++;
            break;
          } else {
            raw += ch;
            i++;
          }
        }
        row.push(unescapeMySqlString(raw));
      } else {
        let token = '';
        while (i < len && valuesClause[i] !== ',' && valuesClause[i] !== ')') {
          token += valuesClause[i++];
        }
        token = token.trim();
        if (/^null$/i.test(token)) {
          row.push(null);
        } else if (/^-?\d+(\.\d+)?$/.test(token)) {
          row.push(Number(token));
        } else {
          row.push(token);
        }
      }
      while (i < len && /\s/.test(valuesClause[i])) i++;
      if (valuesClause[i] === ',') i++;
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Extracts all INSERT INTO statements cleanly from a MySQL dump string,
 * handling quotes and comments.
 */
export function extractInsertStatements(sqlText) {
  const statements = [];
  let i = 0;
  const len = sqlText.length;

  while (i < len) {
    // Skip single-line comments (-- or #)
    if ((sqlText[i] === '-' && sqlText[i + 1] === '-') || sqlText[i] === '#') {
      while (i < len && sqlText[i] !== '\n') i++;
      continue;
    }
    // Skip block comments /* ... */
    if (sqlText[i] === '/' && sqlText[i + 1] === '*') {
      i += 2;
      while (i < len && !(sqlText[i] === '*' && sqlText[i + 1] === '/')) i++;
      i += 2;
      continue;
    }

    // Look for INSERT [IGNORE] INTO at a token boundary
    if (
      (i === 0 || /[\s;]/.test(sqlText[i - 1])) &&
      /^INSERT\s+(?:IGNORE\s+)?INTO\b/i.test(sqlText.slice(i, i + 25))
    ) {
      const start = i;
      let inQuote = false;
      while (i < len) {
        const ch = sqlText[i];
        if (inQuote) {
          if (ch === '\\' && i + 1 < len) {
            i += 2;
            continue;
          }
          if (ch === "'" && sqlText[i + 1] === "'") {
            i += 2;
            continue;
          }
          if (ch === "'") {
            inQuote = false;
          }
          i++;
        } else {
          if (ch === "'") {
            inQuote = true;
            i++;
          } else if (ch === ';') {
            i++;
            break;
          } else {
            i++;
          }
        }
      }
      statements.push(sqlText.slice(start, i));
    } else {
      i++;
    }
  }
  return statements;
}

/**
 * Converts a MySQL phpMyAdmin SQL dump into PostgreSQL import SQL + report summary.
 */
export function convertMySqlDump(mysqlSql) {
  const inserts = extractInsertStatements(mysqlSql);
  const tableData = new Map(IMPORT_ORDER.map((t) => [t, []]));
  const adminEmails = [];
  const skippedTables = new Set();

  for (const stmt of inserts) {
    const match = stmt.match(
      /^INSERT\s+(?:IGNORE\s+)?INTO\s+(?:`?[\w]+`?\.)?`?(\w+)`?\s*(?:\(([^)]+)\))?\s+VALUES\s*([\s\S]+);?\s*$/i
    );
    if (!match) continue;

    const table = match[1].toLowerCase();
    const rawCols = match[2];
    const valuesClause = match[3];

    if (!tableData.has(table)) {
      skippedTables.add(table);
      continue;
    }

    const cols = rawCols
      ? rawCols.split(',').map((c) => c.replace(/[`\s]/g, '').toLowerCase())
      : TABLE_COLUMNS[table];

    const parsedRows = parseMySqlTuples(valuesClause);
    for (const vals of parsedRows) {
      const record = {};
      cols.forEach((col, idx) => {
        record[col] = idx < vals.length ? vals[idx] : null;
      });
      tableData.get(table).push(record);
    }
  }

  const lines = [
    '-- ============================================================================',
    '-- AES CareOffice — Phase 2 Data Import (Generated from MySQL Dump)',
    '-- Run AFTER 001_initial_schema.sql, 002_functions_and_rpcs.sql,',
    '-- 003_rls_policies.sql, and 004_seed_sections.sql.',
    '-- ============================================================================',
    '',
    'BEGIN;',
    '',
  ];

  const counts = {};

  for (const table of IMPORT_ORDER) {
    const rows = tableData.get(table);
    counts[table] = rows.length;
    if (rows.length === 0) continue;

    if (table === 'admins') {
      lines.push('-- Migrating authorized admin emails (legacy bcrypt password hashes excluded; use Supabase Auth)');
      for (const r of rows) {
        if (r.email) adminEmails.push(r.email);
        lines.push(
          `INSERT INTO public.admins (id, email, created_at) VALUES (${toPostgresLiteral(r.id)}, ${toPostgresLiteral(r.email)}, ${toPostgresLiteral(r.created_at ?? new Date().toISOString())}) ON CONFLICT (email) DO NOTHING;`
        );
      }
      lines.push('');
      continue;
    }

    const targetCols = TABLE_COLUMNS[table];
    lines.push(`-- Table: ${table} (${rows.length} row${rows.length === 1 ? '' : 's'})`);
    for (const r of rows) {
      const colList = targetCols.map((c) => `"${c}"`).join(', ');
      const valList = targetCols.map((c) => {
        const val = r[c] !== undefined ? r[c] : null;
        return toPostgresLiteral(val);
      }).join(', ');
      lines.push(`INSERT INTO public.${table} (${colList}) VALUES (${valList});`);
    }
    lines.push('');
  }

  lines.push('-- Reset PostgreSQL identity sequences to match imported primary keys');
  for (const table of IDENTITY_TABLES) {
    lines.push(
      `SELECT setval(pg_get_serial_sequence('public.${table}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.${table};`
    );
  }
  lines.push('');
  lines.push('COMMIT;');
  lines.push('');
  lines.push('-- Verification query (compare counts against original MySQL database):');
  lines.push(
    IMPORT_ORDER.map((t) => `SELECT '${t}' AS table_name, COUNT(*) AS row_count FROM public.${t}`).join('\nUNION ALL\n') + ';'
  );

  return {
    sql: lines.join('\n'),
    counts,
    adminEmails: [...new Set(adminEmails)],
    skippedTables: [...skippedTables],
  };
}

// CLI execution when run directly
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
if (isMain) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node supabase/scripts/convert_mysql_dump.mjs <input-mysql.sql> [output-postgres.sql]');
    process.exit(1);
  }

  const outputPath = process.argv[3] || path.join(path.dirname(inputPath), '005_data_import.sql');
  const rawSql = fs.readFileSync(inputPath, 'utf8');
  const result = convertMySqlDump(rawSql);
  fs.writeFileSync(outputPath, result.sql, 'utf8');

  console.log(`Generated PostgreSQL import script: ${outputPath}`);
  console.log('Migrated row counts:', result.counts);
  if (result.adminEmails.length > 0) {
    console.log('Admin emails to provision in Supabase Auth:', result.adminEmails);
  }
  if (result.skippedTables.length > 0) {
    console.log('Skipped unrecognized tables:', result.skippedTables);
  }
}
