-- ================================================
-- ONE FOR THE AGES - DATABASE SCHEMA
-- PostgreSQL 14+
-- Schema: da_prod (shared)
-- Tables: ofta_* prefix
-- Views: v_ofta_* prefix
-- ================================================

-- ================================================
-- USER ACCOUNT
-- ================================================
CREATE TABLE IF NOT EXISTS da_prod.ofta_user_account (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid    TEXT UNIQUE,
    display_name    TEXT,
    email           TEXT,
    country         TEXT,
    device_os       TEXT,
    auth_provider   TEXT DEFAULT 'anonymous',
    is_banned       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    last_active_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ofta_user_firebase_uid ON da_prod.ofta_user_account(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_ofta_user_created ON da_prod.ofta_user_account(created_at DESC);

-- ================================================
-- CELEBRITY
-- ================================================
CREATE TABLE IF NOT EXISTS da_prod.ofta_person (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name           TEXT NOT NULL,
    date_of_birth       DATE NOT NULL,
    star_sign           TEXT NOT NULL,
    primary_category    TEXT NOT NULL,
    secondary_category  TEXT,
    nationality         TEXT,
    gender              TEXT,
    popularity_score    FLOAT DEFAULT 50.0,
    image_url           TEXT,
    image_license       TEXT,
    hints_easy          JSONB DEFAULT '[]'::jsonb,
    hints_medium        JSONB DEFAULT '[]'::jsonb,
    hints_hard          JSONB DEFAULT '[]'::jsonb,
    aliases             TEXT[] DEFAULT '{}',
    is_active           BOOLEAN DEFAULT TRUE,
    career_status       TEXT NOT NULL DEFAULT 'active' CHECK (career_status IN ('active','retired','deceased')),
    data_period         SMALLINT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ofta_person_category ON da_prod.ofta_person(primary_category);
CREATE INDEX IF NOT EXISTS idx_ofta_person_active ON da_prod.ofta_person(is_active);
CREATE INDEX IF NOT EXISTS idx_ofta_person_popularity ON da_prod.ofta_person(popularity_score DESC);
CREATE INDEX IF NOT EXISTS idx_ofta_person_name ON da_prod.ofta_person(full_name);
CREATE INDEX IF NOT EXISTS idx_ofta_person_career_status ON da_prod.ofta_person(career_status);

-- ================================================
-- QUESTION TEMPLATE
-- ================================================
CREATE TABLE IF NOT EXISTS da_prod.ofta_question_template (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mode            TEXT NOT NULL CHECK (mode IN (
                        'AGE_GUESS', 'WHO_OLDER', 'REVERSE_DOB', 'REVERSE_SIGN'
                    )),
    person_id    UUID REFERENCES da_prod.ofta_person(id),
    person_id_a  UUID REFERENCES da_prod.ofta_person(id),
    person_id_b  UUID REFERENCES da_prod.ofta_person(id),
    difficulty      INT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    -- AGE_GUESS/REVERSE: person_id required
    -- WHO_OLDER: person_id_a + person_id_b required
    CONSTRAINT chk_ofta_mode_persons CHECK (
        (mode IN ('AGE_GUESS', 'REVERSE_DOB', 'REVERSE_SIGN') AND person_id IS NOT NULL)
        OR
        (mode = 'WHO_OLDER' AND person_id_a IS NOT NULL AND person_id_b IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_ofta_qt_mode ON da_prod.ofta_question_template(mode);
CREATE INDEX IF NOT EXISTS idx_ofta_qt_difficulty ON da_prod.ofta_question_template(difficulty);
CREATE INDEX IF NOT EXISTS idx_ofta_qt_active ON da_prod.ofta_question_template(is_active);
CREATE INDEX IF NOT EXISTS idx_ofta_qt_celebrity ON da_prod.ofta_question_template(person_id);

-- ================================================
-- DAILY PACK
-- ================================================
CREATE TABLE IF NOT EXISTS da_prod.ofta_daily_pack (
    pack_date       DATE PRIMARY KEY,
    pack_json_url   TEXT NOT NULL,
    pack_hash       TEXT NOT NULL,
    question_count  INT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ofta_pack_date ON da_prod.ofta_daily_pack(pack_date DESC);

-- ================================================
-- GAME SESSION
-- ================================================
CREATE TABLE IF NOT EXISTS da_prod.ofta_game_session (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES da_prod.ofta_user_account(id),
    mode            TEXT NOT NULL,
    pack_date       DATE,
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    total_score     INT DEFAULT 0,
    questions_count INT DEFAULT 0,
    correct_count   INT DEFAULT 0,
    best_streak     INT DEFAULT 0,
    device_os       TEXT,
    client_version  TEXT
);

CREATE INDEX IF NOT EXISTS idx_ofta_session_user ON da_prod.ofta_game_session(user_id);
CREATE INDEX IF NOT EXISTS idx_ofta_session_date ON da_prod.ofta_game_session(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ofta_session_pack ON da_prod.ofta_game_session(pack_date);

-- ================================================
-- QUESTION ATTEMPT
-- ================================================
CREATE TABLE IF NOT EXISTS da_prod.ofta_question_attempt (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID NOT NULL REFERENCES da_prod.ofta_game_session(id) ON DELETE CASCADE,
    question_template_id    UUID NOT NULL REFERENCES da_prod.ofta_question_template(id),
    question_index          INT NOT NULL,
    shown_at                TIMESTAMPTZ,
    answered_at             TIMESTAMPTZ,
    response_time_ms        INT,
    user_answer             JSONB NOT NULL,
    is_correct              BOOLEAN NOT NULL,
    error_value             FLOAT,
    hints_used              INT DEFAULT 0,
    score_awarded           INT NOT NULL DEFAULT 0,
    streak_at_time          INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_ofta_attempt_session ON da_prod.ofta_question_attempt(session_id);
CREATE INDEX IF NOT EXISTS idx_ofta_attempt_question ON da_prod.ofta_question_attempt(question_template_id);

-- ================================================
-- DAILY LEADERBOARD
-- ================================================
CREATE TABLE IF NOT EXISTS da_prod.ofta_leaderboard_daily (
    pack_date       DATE NOT NULL,
    user_id         UUID NOT NULL REFERENCES da_prod.ofta_user_account(id),
    score           INT NOT NULL,
    rank            INT,
    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (pack_date, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ofta_lb_daily_score ON da_prod.ofta_leaderboard_daily(pack_date, score DESC);
CREATE INDEX IF NOT EXISTS idx_ofta_lb_daily_user ON da_prod.ofta_leaderboard_daily(user_id);

-- ================================================
-- USER STATS (Aggregated)
-- ================================================
CREATE TABLE IF NOT EXISTS da_prod.ofta_user_stats (
    user_id             UUID PRIMARY KEY REFERENCES da_prod.ofta_user_account(id),
    lifetime_score      BIGINT DEFAULT 0,
    best_streak         INT DEFAULT 0,
    current_streak      INT DEFAULT 0,
    games_played        INT DEFAULT 0,
    total_correct       INT DEFAULT 0,
    total_questions     INT DEFAULT 0,
    accuracy_pct        FLOAT DEFAULT 0.0,
    favourite_category  TEXT,
    daily_challenges    INT DEFAULT 0,
    last_daily_date     DATE,
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ofta_stats_lifetime ON da_prod.ofta_user_stats(lifetime_score DESC);
CREATE INDEX IF NOT EXISTS idx_ofta_stats_streak ON da_prod.ofta_user_stats(best_streak DESC);

-- ================================================
-- ACHIEVEMENTS
-- ================================================
CREATE TABLE IF NOT EXISTS da_prod.ofta_achievement (
    id              TEXT PRIMARY KEY,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    icon            TEXT,
    condition_type  TEXT NOT NULL,
    condition_value INT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS da_prod.ofta_user_achievement (
    user_id         UUID NOT NULL REFERENCES da_prod.ofta_user_account(id),
    achievement_id  TEXT NOT NULL REFERENCES da_prod.ofta_achievement(id),
    unlocked_at     TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_ofta_user_ach_user ON da_prod.ofta_user_achievement(user_id);

-- ================================================
-- TELEMETRY EVENTS
-- ================================================
CREATE TABLE IF NOT EXISTS da_prod.ofta_telemetry_event (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID,
    event_type      TEXT NOT NULL,
    event_data      JSONB,
    client_ts       TIMESTAMPTZ,
    server_ts       TIMESTAMPTZ DEFAULT NOW(),
    device_os       TEXT,
    app_version     TEXT
);

CREATE INDEX IF NOT EXISTS idx_ofta_telemetry_type ON da_prod.ofta_telemetry_event(event_type);
CREATE INDEX IF NOT EXISTS idx_ofta_telemetry_time ON da_prod.ofta_telemetry_event(server_ts DESC);
CREATE INDEX IF NOT EXISTS idx_ofta_telemetry_user ON da_prod.ofta_telemetry_event(user_id);

-- ================================================
-- APP CONFIG (feature flags, versioning)
-- ================================================
CREATE TABLE IF NOT EXISTS da_prod.ofta_app_config (
    key             TEXT PRIMARY KEY,
    value           JSONB NOT NULL,
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- SEED INITIAL DATA
-- ================================================

-- Insert default achievements
INSERT INTO da_prod.ofta_achievement (id, title, description, icon, condition_type, condition_value)
VALUES
    ('first_game', 'Welcome to the Game', 'Complete your first game', '🎮', 'games_played', 1),
    ('streak_5', 'On Fire 🔥', 'Get a streak of 5 correct answers', '🔥', 'best_streak', 5),
    ('streak_10', 'Unstoppable', 'Get a streak of 10 correct answers', '⚡', 'best_streak', 10),
    ('perfect_daily', 'Perfect Day', 'Score 100% on a daily challenge', '💯', 'daily_accuracy', 100),
    ('century_club', 'Century Club', 'Play 100 games', '💯', 'games_played', 100)
ON CONFLICT (id) DO NOTHING;

-- Insert default app config
INSERT INTO da_prod.ofta_app_config (key, value)
VALUES
    ('min_client_version', '{"ios": "1.0.0", "android": "1.0.0"}'::jsonb),
    ('feature_flags', '{"reverse_mode": true, "leaderboard": true, "daily_challenge": true}'::jsonb),
    ('maintenance_mode', 'false'::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ================================================
-- HELPER FUNCTIONS
-- ================================================

-- Function to calculate current age from DOB
CREATE OR REPLACE FUNCTION da_prod.ofta_calculate_age(dob DATE)
RETURNS INT AS $$
BEGIN
    RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, dob));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update user stats after game
CREATE OR REPLACE FUNCTION da_prod.ofta_update_user_stats_after_game()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO da_prod.ofta_user_stats (user_id)
    VALUES (NEW.user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    UPDATE da_prod.ofta_user_stats
    SET
        games_played = games_played + 1,
        lifetime_score = lifetime_score + NEW.total_score,
        best_streak = GREATEST(best_streak, NEW.best_streak),
        total_questions = total_questions + NEW.questions_count,
        total_correct = total_correct + NEW.correct_count,
        accuracy_pct = CASE 
            WHEN total_questions + NEW.questions_count > 0 
            THEN ((total_correct + NEW.correct_count)::FLOAT / (total_questions + NEW.questions_count)::FLOAT) * 100
            ELSE 0
        END,
        updated_at = NOW()
    WHERE user_id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update user stats when game ends
CREATE TRIGGER ofta_trigger_update_user_stats
    AFTER UPDATE OF ended_at ON da_prod.ofta_game_session
    FOR EACH ROW
    WHEN (NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL)
    EXECUTE FUNCTION da_prod.ofta_update_user_stats_after_game();

-- ================================================
-- COMPLETE
-- ================================================
SELECT 'OFTA Database Schema Created Successfully!' AS status;
