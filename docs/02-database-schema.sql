-- ═══════════════════════════════════════════════════════════════
-- EDITH DATABASE SCHEMA v1.1
-- PostgreSQL 16 + pgvector 0.7
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ─────────────────────────────────────────
-- USERS & AUTH
-- ─────────────────────────────────────────
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clerk_id        TEXT UNIQUE NOT NULL,
    email           TEXT UNIQUE NOT NULL,
    name            TEXT,
    timezone        TEXT DEFAULT 'UTC',
    preferences     JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- CALENDAR
-- ─────────────────────────────────────────
CREATE TABLE calendar_integrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    provider        TEXT NOT NULL,          -- 'google' | 'outlook'
    access_token    TEXT,
    refresh_token   TEXT,
    expires_at      TIMESTAMPTZ,
    calendar_id     TEXT,
    synced_at       TIMESTAMPTZ
);

CREATE TABLE calendar_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    external_id     TEXT,
    title           TEXT NOT NULL,
    description     TEXT,
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    is_free_block   BOOLEAN DEFAULT FALSE,
    ai_category     TEXT,                   -- 'study' | 'project' | 'language' | 'rest'
    source          TEXT DEFAULT 'manual',  -- 'google' | 'outlook' | 'manual' | 'ai_scheduled'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- LANGUAGE LEARNING
-- ─────────────────────────────────────────
CREATE TABLE languages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    code            TEXT NOT NULL,          -- 'fr' | 'ar' | 'zh' | 'it' | 'es'
    name            TEXT NOT NULL,
    cefr_level      TEXT DEFAULT 'A1',      -- A1..C2
    status          TEXT DEFAULT 'active',  -- 'active' | 'planned' | 'paused'
    started_at      DATE,
    target_level    TEXT,
    daily_goal_mins INT DEFAULT 30
);

CREATE TABLE vocabulary_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language_id     UUID REFERENCES languages(id) ON DELETE CASCADE,
    word            TEXT NOT NULL,
    translation     TEXT NOT NULL,
    example         TEXT,
    pronunciation   TEXT,
    tags            TEXT[],
    difficulty      SMALLINT DEFAULT 1,     -- 1-5
    next_review     DATE,
    interval_days   INT DEFAULT 1,
    ease_factor     FLOAT DEFAULT 2.5,      -- SM-2 algorithm
    repetitions     INT DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE language_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language_id     UUID REFERENCES languages(id) ON DELETE CASCADE,
    session_type    TEXT NOT NULL,          -- 'vocabulary' | 'grammar' | 'speaking' | 'listening' | 'reading' | 'ai_conversation'
    duration_mins   INT,
    score           FLOAT,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE grammar_topics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language_id     UUID REFERENCES languages(id) ON DELETE CASCADE,
    topic           TEXT NOT NULL,
    explanation     TEXT,
    examples        JSONB,
    mastery_level   SMALLINT DEFAULT 0,     -- 0-5
    last_practiced  DATE
);

-- ─────────────────────────────────────────
-- RESEARCH PAPERS
-- ─────────────────────────────────────────
CREATE TABLE papers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    authors         TEXT[],
    abstract        TEXT,
    url             TEXT,
    arxiv_id        TEXT,
    semantic_id     TEXT,
    published_date  DATE,
    venue           TEXT,
    tags            TEXT[],
    status          TEXT DEFAULT 'unread',  -- 'unread' | 'reading' | 'read' | 'archived'
    priority        SMALLINT DEFAULT 3,
    rating          SMALLINT,
    storage_path    TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE paper_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id        UUID REFERENCES papers(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    note_type       TEXT DEFAULT 'general', -- 'general' | 'methodology' | 'dataset' | 'equation' | 'implementation'
    page_ref        INT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE paper_summaries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id        UUID REFERENCES papers(id) ON DELETE CASCADE,
    summary         TEXT,
    key_contributions TEXT[],
    methodology     TEXT,
    datasets        JSONB,
    equations       JSONB,
    implementation_roadmap TEXT,
    generated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- DSA — NEETCODE 150
-- ─────────────────────────────────────────
CREATE TABLE dsa_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,   -- 'Arrays & Hashing', 'Two Pointers', etc.
    order_index     INT,
    total_problems  INT                     -- NeetCode canonical count
);

-- Seed data for NeetCode 150 categories
INSERT INTO dsa_categories (name, order_index, total_problems) VALUES
('Arrays & Hashing', 1, 9),
('Two Pointers', 2, 5),
('Sliding Window', 3, 6),
('Stack', 4, 7),
('Binary Search', 5, 7),
('Linked List', 6, 11),
('Trees', 7, 15),
('Tries', 8, 3),
('Heap / Priority Queue', 9, 7),
('Backtracking', 10, 9),
('Graphs', 11, 13),
('Advanced Graphs', 12, 6),
('1-D Dynamic Programming', 13, 12),
('2-D Dynamic Programming', 14, 11),
('Greedy', 15, 8),
('Intervals', 16, 6),
('Math & Geometry', 17, 8),
('Bit Manipulation', 18, 7);

CREATE TABLE dsa_problems (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    leetcode_id     INT,                    -- LeetCode problem number
    leetcode_slug   TEXT,                   -- e.g. 'two-sum'
    neetcode_category_id UUID REFERENCES dsa_categories(id),
    title           TEXT NOT NULL,
    url             TEXT,
    difficulty      TEXT,                   -- 'Easy' | 'Medium' | 'Hard'
    is_neetcode_150 BOOLEAN DEFAULT FALSE,
    neetcode_order  INT,                    -- position within NeetCode roadmap
    status          TEXT DEFAULT 'unsolved',-- 'unsolved' | 'attempted' | 'solved' | 'needs_revision'
    solution_code   TEXT,
    solution_lang   TEXT DEFAULT 'python',
    time_complexity TEXT,
    space_complexity TEXT,
    time_taken_mins INT,
    notes           TEXT,
    next_revision   DATE,
    ease_factor     FLOAT DEFAULT 2.5,      -- SM-2
    repetitions     INT DEFAULT 0,
    interval_days   INT DEFAULT 1,
    solve_count     INT DEFAULT 0,
    last_solved_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dsa_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    problem_id      UUID REFERENCES dsa_problems(id),
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    outcome         TEXT,                   -- 'solved' | 'partial' | 'gave_up'
    notes           TEXT
);

-- ─────────────────────────────────────────
-- KNOWLEDGE VAULT
-- ─────────────────────────────────────────
CREATE TABLE knowledge_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    content         TEXT,
    item_type       TEXT NOT NULL,          -- 'note' | 'pdf' | 'link' | 'video' | 'article' | 'bookmark'
    source_url      TEXT,
    storage_path    TEXT,
    tags            TEXT[],
    collection      TEXT,
    embedding       vector(768),            -- nomic-embed-text via Ollama (768-dim, free)
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON knowledge_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ─────────────────────────────────────────
-- CAREER OS
-- ─────────────────────────────────────────
CREATE TABLE resumes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    version         TEXT NOT NULL,
    label           TEXT,
    storage_path    TEXT,
    is_active       BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE companies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    website         TEXT,
    industry        TEXT,
    size            TEXT,
    location        TEXT,
    notes           TEXT,
    fit_score       FLOAT,
    status          TEXT DEFAULT 'watching'
);

CREATE TABLE applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    company_id      UUID REFERENCES companies(id),
    role            TEXT NOT NULL,
    type            TEXT,                   -- 'internship' | 'full_time' | 'research'
    status          TEXT DEFAULT 'draft',   -- 'draft' | 'applied' | 'screening' | 'interview' | 'offer' | 'rejected' | 'withdrawn'
    applied_at      DATE,
    deadline        DATE,
    resume_id       UUID REFERENCES resumes(id),
    cover_letter    TEXT,
    notes           TEXT,
    salary_range    TEXT,
    location        TEXT,
    remote          BOOLEAN,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE interviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID REFERENCES applications(id) ON DELETE CASCADE,
    round           INT DEFAULT 1,
    interview_type  TEXT,                   -- 'hr' | 'technical' | 'system_design' | 'behavioral'
    scheduled_at    TIMESTAMPTZ,
    duration_mins   INT,
    interviewer     TEXT,
    outcome         TEXT,
    notes           TEXT,
    feedback        TEXT
);

CREATE TABLE contacts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    company         TEXT,
    role            TEXT,
    email           TEXT,
    linkedin        TEXT,
    last_contacted  DATE,
    relationship    TEXT,
    notes           TEXT
);

-- ─────────────────────────────────────────
-- SKILL BUILDING & CERTIFICATIONS (M8)
-- ─────────────────────────────────────────
CREATE TABLE skill_resources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    resource_type   TEXT NOT NULL,          -- 'certification' | 'course' | 'book' | 'tutorial' | 'workshop'
    provider        TEXT,                   -- 'Coursera' | 'AWS' | 'Udemy' | 'fast.ai' | etc.
    url             TEXT,
    category        TEXT,                   -- 'AI/ML' | 'Cloud' | 'Backend' | 'DSA' | 'Business' | etc.
    status          TEXT DEFAULT 'planned', -- 'planned' | 'in_progress' | 'completed' | 'paused'
    priority        SMALLINT DEFAULT 3,
    progress_pct    SMALLINT DEFAULT 0,     -- 0-100
    current_section TEXT,                   -- current chapter / module / unit
    total_sections  INT,
    estimated_hours INT,
    actual_hours    INT DEFAULT 0,
    start_date      DATE,
    target_date     DATE,
    completed_date  DATE,
    notes           TEXT,
    key_takeaways   TEXT,
    certificate_url TEXT,                   -- URL to credential / badge
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE skills (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,          -- 'PyTorch' | 'Kubernetes' | 'FastAPI' | etc.
    category        TEXT,                   -- 'AI/ML' | 'DevOps' | 'Backend' | etc.
    level           TEXT DEFAULT 'beginner',-- 'beginner' | 'intermediate' | 'advanced' | 'expert'
    confidence      SMALLINT DEFAULT 1,     -- 1-5 self-assessment
    last_used       DATE,
    notes           TEXT,
    verified_by     TEXT,                   -- resource_id or 'project' or 'internship'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE study_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id     UUID REFERENCES skill_resources(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    duration_mins   INT,
    section_covered TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────
-- AI SYSTEM
-- ─────────────────────────────────────────
CREATE TABLE ai_conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    agent_type      TEXT NOT NULL,          -- 'orchestrator' | 'calendar' | 'language' | etc.
    model_used      TEXT,                   -- 'ollama/llama3' | 'claude-sonnet-4-6' | etc.
    module          TEXT,
    messages        JSONB DEFAULT '[]',
    context_snapshot JSONB,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE daily_briefings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    briefing_date   DATE NOT NULL,
    content         JSONB NOT NULL,
    raw_text        TEXT,
    model_used      TEXT,
    generated_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, briefing_date)
);

CREATE TABLE user_goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    category        TEXT,
    timeframe       TEXT,
    target_date     DATE,
    metric          TEXT,
    target_value    FLOAT,
    current_value   FLOAT DEFAULT 0,
    status          TEXT DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE streaks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    category        TEXT NOT NULL,          -- 'dsa' | 'language_fr' | 'research' | 'skills' | etc.
    current_streak  INT DEFAULT 0,
    longest_streak  INT DEFAULT 0,
    last_activity   DATE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, category)
);

CREATE TABLE activity_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    activity_type   TEXT NOT NULL,
    module          TEXT NOT NULL,
    reference_id    UUID,
    metadata        JSONB DEFAULT '{}',
    duration_mins   INT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
