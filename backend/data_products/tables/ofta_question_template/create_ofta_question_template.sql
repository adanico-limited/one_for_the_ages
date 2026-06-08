CREATE TABLE IF NOT EXISTS ofta_prod.ofta_question_template (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    mode                VARCHAR(50)     NOT NULL,
    person_id        UUID            REFERENCES ofta_prod.ofta_person(id),
    person_id_a      UUID            REFERENCES ofta_prod.ofta_person(id),
    person_id_b      UUID            REFERENCES ofta_prod.ofta_person(id),
    difficulty          INTEGER         NOT NULL,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at_tms      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_tms      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_ofta_qt_mode CHECK (mode IN ('AGE_GUESS', 'WHO_OLDER', 'REVERSE_DOB', 'REVERSE_SIGN')),
    CONSTRAINT chk_ofta_qt_difficulty CHECK (difficulty BETWEEN 1 AND 5),
    CONSTRAINT chk_ofta_qt_celebs CHECK (
        (mode IN ('AGE_GUESS', 'REVERSE_DOB', 'REVERSE_SIGN') AND person_id IS NOT NULL)
        OR (mode = 'WHO_OLDER' AND person_id_a IS NOT NULL AND person_id_b IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_ofta_qt_mode        ON ofta_prod.ofta_question_template(mode);
CREATE INDEX IF NOT EXISTS idx_ofta_qt_difficulty  ON ofta_prod.ofta_question_template(difficulty);
CREATE INDEX IF NOT EXISTS idx_ofta_qt_active      ON ofta_prod.ofta_question_template(is_active);
CREATE INDEX IF NOT EXISTS idx_ofta_qt_person   ON ofta_prod.ofta_question_template(person_id);

COMMENT ON TABLE ofta_prod.ofta_question_template IS 'Generated game-mode questions referencing one or two celebrities';
