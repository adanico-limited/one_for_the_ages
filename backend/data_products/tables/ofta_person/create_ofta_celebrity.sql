CREATE TABLE IF NOT EXISTS ofta_prod.ofta_person (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name           VARCHAR(255)    NOT NULL,
    date_of_birth       DATE            NOT NULL,
    star_sign           VARCHAR(50)     NOT NULL,
    primary_category    VARCHAR(100)    NOT NULL,
    secondary_category  VARCHAR(100),
    nationality         VARCHAR(100),
    gender              VARCHAR(50),
    popularity_score    NUMERIC(5,2)    NOT NULL DEFAULT 50.0,
    image_url           TEXT,
    image_license       VARCHAR(100),
    -- Generic attribute pairs (desc = label, value = array of values)
    -- Semantics vary by category — see data_products/docs/person_column_semantics.md
    attr_desc_1         VARCHAR(100),
    attr_value_1        TEXT[],
    attr_desc_2         VARCHAR(100),
    attr_value_2        TEXT[],
    attr_desc_3         VARCHAR(100),
    attr_value_3        TEXT[],
    attr_desc_4         VARCHAR(100),
    attr_value_4        TEXT[],
    attr_desc_5         VARCHAR(100),
    attr_value_5        TEXT[],
    attr_desc_6         VARCHAR(100),
    attr_value_6        TEXT[],
    attr_desc_7         VARCHAR(100),
    attr_value_7        TEXT[],
    hints_easy          JSONB           NOT NULL DEFAULT '[]'::jsonb,
    hints_medium        JSONB           NOT NULL DEFAULT '[]'::jsonb,
    hints_hard          JSONB           NOT NULL DEFAULT '[]'::jsonb,
    aliases             TEXT[]          NOT NULL DEFAULT '{}',
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at_tms      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at_tms      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ofta_person_category   ON ofta_prod.ofta_person(primary_category);
CREATE INDEX IF NOT EXISTS idx_ofta_person_active     ON ofta_prod.ofta_person(is_active);
CREATE INDEX IF NOT EXISTS idx_ofta_person_popularity ON ofta_prod.ofta_person(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_ofta_person_name       ON ofta_prod.ofta_person(full_name);

COMMENT ON TABLE ofta_prod.ofta_person IS 'Celebrities used as question subjects across all OFTA game modes';
