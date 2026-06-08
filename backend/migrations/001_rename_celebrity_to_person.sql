-- Migration 001: rename celebrity → person
-- Renames oft_prod.ofta_celebrity → oft_prod.ofta_person
-- Renames celebrity_id* columns in ofta_question_template → person_id*
-- Run once against the live DB; safe to re-check with the IS NOT NULL guards.

BEGIN;

-- 1. Rename the table
ALTER TABLE ofta_prod.ofta_celebrity RENAME TO ofta_person;

-- 2. Rename indexes on oft_person
ALTER INDEX IF EXISTS idx_ofta_celebrity_category   RENAME TO idx_ofta_person_category;
ALTER INDEX IF EXISTS idx_ofta_celebrity_active     RENAME TO idx_ofta_person_active;
ALTER INDEX IF EXISTS idx_ofta_celebrity_popularity RENAME TO idx_ofta_person_popularity;
ALTER INDEX IF EXISTS idx_ofta_celebrity_name       RENAME TO idx_ofta_person_name;
ALTER INDEX IF EXISTS idx_ofta_celebrity_career_status RENAME TO idx_ofta_person_career_status;

-- 3. Rename FK columns in ofta_question_template
ALTER TABLE ofta_prod.ofta_question_template
    RENAME COLUMN celebrity_id   TO person_id;

ALTER TABLE ofta_prod.ofta_question_template
    RENAME COLUMN celebrity_id_a TO person_id_a;

ALTER TABLE ofta_prod.ofta_question_template
    RENAME COLUMN celebrity_id_b TO person_id_b;

-- 4. Rename the index on the FK column
ALTER INDEX IF EXISTS idx_ofta_qt_celebrity RENAME TO idx_ofta_qt_person;

-- 5. Rename the check constraint
ALTER TABLE ofta_prod.ofta_question_template
    RENAME CONSTRAINT chk_ofta_qt_celebs TO chk_ofta_qt_persons;

-- 6. Update the table comment
COMMENT ON TABLE ofta_prod.ofta_person IS 'People used as question subjects across all OFTA game modes';

COMMIT;
