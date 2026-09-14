-- =============================================================================
-- Migration: Split `grade_section` into `grade_level` + `section`
-- Database : aes
-- Table    : students
-- Run in   : phpMyAdmin or `mysql -u root aes < migration_grade_section.sql`
-- =============================================================================

-- Step 1: Add the two new columns (safe to run again — IF NOT EXISTS guard)
ALTER TABLE `students`
    ADD COLUMN IF NOT EXISTS `grade_level` VARCHAR(20) NOT NULL DEFAULT '' AFTER `grade_section`,
    ADD COLUMN IF NOT EXISTS `section`     VARCHAR(100) NOT NULL DEFAULT '' AFTER `grade_level`;

-- Step 2: Backfill grade_level and section from the existing grade_section column.
--         Expected format: "Grade X - SectionName" (split on first " - ").
--         Rows that do NOT match the pattern are left with empty strings and
--         can be identified by running the SELECT at the bottom.

UPDATE `students`
SET
    `grade_level` = TRIM(SUBSTRING_INDEX(`grade_section`, ' - ', 1)),
    `section`     = TRIM(SUBSTRING(`grade_section`,
                          LOCATE(' - ', `grade_section`) + 3))
WHERE `grade_section` LIKE '% - %'
  AND (`grade_level` = '' OR `section` = '');

-- Step 3: Diagnostic — rows that did NOT match the "Grade X - Section" pattern.
--         Review these manually and update grade_level / section by hand if needed.
--         (This SELECT is safe to run at any time as a health-check.)
SELECT id, full_name, grade_section, grade_level, `section`
FROM `students`
WHERE `grade_section` NOT LIKE '% - %'
   OR `section` = ''
ORDER BY id;

-- =============================================================================
-- NOTE: The old `grade_section` column is intentionally KEPT in the table.
--       The application code has been updated to stop writing to it going forward.
--       You may DROP it in a future migration once you are confident it is safe.
-- =============================================================================
