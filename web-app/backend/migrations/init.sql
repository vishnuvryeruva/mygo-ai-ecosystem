-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Users table (replaces SQLite users.db) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role        TEXT DEFAULT 'Admin',
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
    scope_id        TEXT
);

-- Cosine similarity index for fast nearest-neighbour search
-- (requires at least one row to exist before IVFFlat can be built;
--  index creation is skipped if table is empty and added lazily by Postgres)
CREATE INDEX IF NOT EXISTS documents_embedding_idx
    ON documents USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
