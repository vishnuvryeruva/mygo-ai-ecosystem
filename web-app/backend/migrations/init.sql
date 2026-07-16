-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Users table (replaces SQLite users.db) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role        TEXT DEFAULT 'Admin',
    llm_provider TEXT NOT NULL DEFAULT 'openai',
    created_by  TEXT,
    created_at  TEXT NOT NULL
);

-- ── Documents table (replaces ChromaDB vector_db) ───────────────────────────
-- Each row is one text chunk + its embedding.
-- Multiple rows share the same document_id (one doc → many chunks).
CREATE TABLE IF NOT EXISTS documents (
    id              TEXT PRIMARY KEY,      -- e.g. "filename_0", "docid_1"
    document_id     TEXT,                  -- logical grouping key (base doc id)
    document_name   TEXT,
    content         TEXT,                  -- plain-text chunk for retrieval
    embedding       vector(1536),          -- OpenAI text-embedding-3-small (1536-dim)
    source          TEXT DEFAULT 'File Upload',
    doc_type        TEXT,
    project         TEXT DEFAULT 'N/A',
    updated_by      TEXT DEFAULT 'System',
    updated_on      TEXT DEFAULT 'N/A',
    web_url         TEXT,
    is_placeholder  BOOLEAN DEFAULT FALSE,
    html_content    TEXT DEFAULT '',       -- raw HTML stored on first chunk only
    uuid            TEXT,
    display_id      TEXT,
    project_id      TEXT,
    scope_id        TEXT,
    version         INTEGER DEFAULT 1,
    is_latest       BOOLEAN DEFAULT TRUE,
    calm_display_id TEXT,
    sap_module      TEXT DEFAULT 'UNCLASSIFIED',
    sap_module_confidence REAL,
    sap_module_method     TEXT,  -- scope_map | llm | vector | manual
    -- When Yoda ingested this row. Distinct from updated_on, which is the
    -- document's last-changed date in the *source system*. A document last
    -- touched in CALM two years ago but synced today is new to us, and the
    -- Document Hub has to be able to say so — sorting on updated_on buries
    -- freshly synced projects pages deep and reads as "sync is broken".
    synced_on       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- AI summary of the document's design intent, written once at ingest.
    summary         TEXT
);

-- Cosine similarity index for fast nearest-neighbour search
-- (requires at least one row to exist before IVFFlat can be built;
--  index creation is skipped if table is empty and added lazily by Postgres)
CREATE INDEX IF NOT EXISTS documents_embedding_idx
    ON documents USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- NOTE: the indexes for sap_module/project are created in db.py's migration
-- list, not here. On an existing database CREATE TABLE IF NOT EXISTS is a no-op,
-- so those columns only appear after the ALTER TABLE backfill that runs later —
-- indexing them at this point would fail and abort startup.

-- ── CALM scopes cache ───────────────────────────────────────────────────────
-- documents.scope_id carries the CALM scope but not its name, so there is
-- nothing to map against without this. Populated from CalmService.list_scopes;
-- sap_module is resolved from the name once and is admin-editable thereafter.
CREATE TABLE IF NOT EXISTS calm_scopes (
    id          TEXT PRIMARY KEY,
    name        TEXT,
    project_id  TEXT,
    sap_module  TEXT,
    synced_at   TEXT
);

CREATE INDEX IF NOT EXISTS calm_scopes_project_id_idx ON calm_scopes(project_id);

-- ── Code Snippets table (user's saved code repository) ────────────────────────
CREATE TABLE IF NOT EXISTS code_snippets (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    title           TEXT NOT NULL,
    code            TEXT NOT NULL,
    code_type       TEXT NOT NULL,
    description     TEXT,
    analysis_data   JSONB,          -- Store the analysis results (suggestions, anti-patterns, etc.)
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index for faster user-specific queries
CREATE INDEX IF NOT EXISTS code_snippets_user_id_idx ON code_snippets(user_id);
CREATE INDEX IF NOT EXISTS code_snippets_created_at_idx ON code_snippets(created_at DESC);
