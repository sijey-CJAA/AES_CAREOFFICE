import test from 'node:test';
import assert from 'node:assert/strict';
import { convertMySqlDump, parseMySqlTuples, toPostgresLiteral } from './convert_mysql_dump.mjs';

test('parseMySqlTuples handles escaped quotes, newlines, NULLs, and zero-dates', () => {
  const clause = `(1, 'O\\'Brien, Maria', '123456', NULL, '0000-00-00', 'Line 1\\nLine 2', '2026-01-10 08:00:00')`;
  const rows = parseMySqlTuples(clause);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0], [
    1,
    "O'Brien, Maria",
    '123456',
    null,
    '0000-00-00',
    'Line 1\nLine 2',
    '2026-01-10 08:00:00',
  ]);
  assert.equal(toPostgresLiteral(rows[0][1]), "'O''Brien, Maria'");
  assert.equal(toPostgresLiteral(rows[0][3]), 'NULL');
  assert.equal(toPostgresLiteral(rows[0][4]), 'NULL');
  assert.equal(toPostgresLiteral(rows[0][5]), "E'Line 1\\nLine 2'");
});

test('convertMySqlDump converts full multi-table dump cleanly and strips admin passwords', () => {
  const sampleDump = `
-- phpMyAdmin SQL Dump
INSERT INTO \`admins\` (\`id\`, \`email\`, \`password\`, \`created_at\`) VALUES
(1, 'counselor@aes.edu.ph', '$2y$10$secrethash', '2026-01-01 00:00:00');

INSERT INTO \`students\` (\`id\`, \`full_name\`, \`lrn\`, \`grade_section\`, \`grade_level\`, \`section\`, \`school_year\`, \`date_of_birth\`, \`contact_number\`, \`home_address\`, \`blood_type\`, \`allergies\`, \`medications\`, \`status\`, \`created_at\`, \`deleted_at\`) VALUES
(10, 'Juan Dela Cruz', '100020003000', NULL, 'Grade 4', 'Rose Quartz', '2025-2026', '0000-00-00', NULL, '123 Main St', 'O+', 'Peanuts', NULL, 'Currently Enrolled', '2026-01-02 09:30:00', NULL);

INSERT INTO \`parents\` (\`id\`, \`student_id\`, \`parent_type\`, \`full_name\`, \`relationship\`, \`home_address\`, \`mobile_number\`, \`telephone_number\`, \`email_address\`, \`workplace\`, \`workplace_address\`, \`emergency_contact_number\`, \`created_at\`, \`deleted_at\`) VALUES
(5, 10, 'Primary', 'Ana Dela Cruz', 'Mother', '123 Main St', '09171234567', NULL, 'ana@example.com', 'Clinic', NULL, '09171234567', '2026-01-02 09:30:00', NULL);

INSERT INTO \`case_register\` (\`id\`, \`case_number\`, \`school_year\`, \`date\`, \`grade_section\`, \`case_type\`, \`brief_description\`, \`actions_taken\`, \`outcome_disposition\`, \`created_at\`, \`deleted_at\`) VALUES
(3, 'AES-CR-003', '2025-2026', '2026-02-01', NULL, 'Behavioral Concern', 'Note with ; semicolon', 'Counseling', 'Ongoing', '2026-02-01 10:00:00', NULL);

INSERT INTO \`case_students\` (\`case_id\`, \`student_id\`) VALUES (3, 10);
`;

  const result = convertMySqlDump(sampleDump);
  assert.equal(result.counts.admins, 1);
  assert.equal(result.counts.students, 1);
  assert.equal(result.counts.parents, 1);
  assert.equal(result.counts.case_register, 1);
  assert.equal(result.counts.case_students, 1);
  assert.deepEqual(result.adminEmails, ['counselor@aes.edu.ph']);
  assert.ok(!result.sql.includes('$2y$10$secrethash'), 'Legacy password hash must NOT appear in output SQL');
  assert.ok(result.sql.includes('INSERT INTO public.admins (id, email, created_at)'));
  assert.ok(result.sql.includes("setval(pg_get_serial_sequence('public.students', 'id')"));
  assert.ok(result.sql.includes("'Note with ; semicolon'"));
});

