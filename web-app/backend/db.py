"""
Shared PostgreSQL connection module.

All services import get_conn() from here.
init_db() is called once at app startup to create tables.
"""

import os
import re
import psycopg2
import psycopg2.extras
import sqlite3
from pgvector.psycopg2 import register_vector
from dotenv import load_dotenv

# Load .env before reading DATABASE_URL — db.py may be imported before app.py calls load_dotenv()
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/mygo_ai")

# Set during init_db(); None until first PostgreSQL init probe.
PGVECTOR_AVAILABLE = None


def _probe_pgvector(conn) -> bool:
    try:
        cur = conn.cursor()
        cur.execute("SELECT 1 FROM pg_extension WHERE extname = %s;", ("vector",))
        return cur.fetchone() is not None
    except Exception:
        return False


def pgvector_available() -> bool:
    """True when PostgreSQL has the pgvector extension (False for SQLite)."""
    if PGVECTOR_AVAILABLE is not None:
        return PGVECTOR_AVAILABLE
    return False


def _sql_without_pgvector(sql: str) -> str:
    """Schema DDL for hosts without pgvector (e.g. managed RDS without the extension)."""
    sql = re.sub(r'CREATE EXTENSION[^;]*;', '', sql, flags=re.IGNORECASE)
    sql = sql.replace("embedding       vector(1536),", "embedding       BYTEA,")
    sql = re.sub(r'CREATE INDEX.*?USING ivfflat.*?;', '', sql, flags=re.IGNORECASE | re.DOTALL)
    return sql


class SQLiteCursorProxy:
    def __init__(self, cursor):
        self.cursor = cursor

    def execute(self, query, vars=None):
        # Translate Postgres %s placeholders to SQLite ? placeholders
        if vars:
            query = query.replace('%s', '?')
        return self.cursor.execute(query, vars or [])

    def fetchone(self):
        return self.cursor.fetchone()

    def fetchall(self):
        return self.cursor.fetchall()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass

    def __getattr__(self, name):
        return getattr(self.cursor, name)


class SQLiteConnectionProxy:
    def __init__(self, conn):
        self.conn = conn

    def cursor(self, cursor_factory=None):
        return SQLiteCursorProxy(self.conn.cursor())

    def commit(self):
        return self.conn.commit()

    def rollback(self):
        try:
            return self.conn.rollback()
        except:
            pass

    def close(self):
        return self.conn.close()

    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.rollback()
        self.close()


def get_conn(register_vec=True):
    """Return a new connection. Falls back to SQLite if PostgreSQL fails."""
    try:
        conn = psycopg2.connect(DATABASE_URL)
        # Register pgvector types on this connection (skip during init_db)
        if register_vec and pgvector_available():
            try:
                register_vector(conn)
            except Exception as e:
                print(f"WARNING: Could not register pgvector: {e}")
        return conn
    except Exception as e:
        print(f"WARNING: PostgreSQL connection failed ({e}).")
        print(f"WARNING: DATABASE_URL={DATABASE_URL!r}")
        print("WARNING: Falling back to SQLite — data will NOT persist across restarts. Set DATABASE_URL env var to fix this.")
        sqlite_path = os.path.join(os.path.dirname(__file__), "users.db")
        conn = sqlite3.connect(sqlite_path)
        # SQLite Row factory to mimic RealDictCursor behavior
        conn.row_factory = sqlite3.Row
        return SQLiteConnectionProxy(conn)

def init_db():
    """
    Create all required tables if they don't exist.
    Run once on application startup.
    """
    sql_path = os.path.join(os.path.dirname(__file__), "migrations", "init.sql")
    global PGVECTOR_AVAILABLE

    conn = get_conn(register_vec=False)
    
    is_sqlite = isinstance(conn, SQLiteConnectionProxy) or isinstance(conn, sqlite3.Connection)
    
    try:
        with open(sql_path, "r") as f:
            sql = f.read()
        
        if is_sqlite:
            PGVECTOR_AVAILABLE = False
            # SQLite compatibility tweaks
            sql = _sql_without_pgvector(sql)
            sql = sql.replace("BYTEA,", "BLOB,")
            sql = sql.replace("JSONB", "TEXT")
            
            cur = conn.cursor()
            cur.executescript(sql)
            conn.commit()
        else:
            # PostgreSQL: extract CREATE EXTENSION statements and run them separately
            # so a permission error on one doesn't roll back the whole schema.
            extension_statements = re.findall(r'CREATE EXTENSION[^;]*;', sql, flags=re.IGNORECASE)
            sql_without_extensions = re.sub(r'CREATE EXTENSION[^;]*;', '', sql, flags=re.IGNORECASE)
            
            # Try extensions individually — tolerate insufficient privilege
            # (the extension may already be installed by another app on shared DB)
            for ext_sql in extension_statements:
                try:
                    cur = conn.cursor()
                    cur.execute(ext_sql)
                    conn.commit()
                    print(f"DEBUG: Executed extension: {ext_sql.strip()}")
                except psycopg2.errors.InsufficientPrivilege:
                    conn.rollback()
                    # Check if it's already installed — if so, we're fine
                    ext_name_match = re.search(r'CREATE EXTENSION(?:\s+IF\s+NOT\s+EXISTS)?\s+"?(\w+)"?', ext_sql, re.IGNORECASE)
                    if ext_name_match:
                        ext_name = ext_name_match.group(1)
                        cur = conn.cursor()
                        cur.execute("SELECT 1 FROM pg_extension WHERE extname = %s;", (ext_name,))
                        if cur.fetchone():
                            print(f"DEBUG: Extension '{ext_name}' already installed — continuing")
                            conn.commit()
                        else:
                            print(f"WARNING: Extension '{ext_name}' not installed and we lack privilege to install it. App may fail when it tries to use it.")
                            conn.commit()
                except Exception as e:
                    conn.rollback()
                    print(f"WARNING: Could not execute extension SQL: {e}")

            PGVECTOR_AVAILABLE = _probe_pgvector(conn)
            if not PGVECTOR_AVAILABLE:
                print(
                    "WARNING: pgvector extension unavailable — using BYTEA embeddings "
                    "and in-app cosine similarity (suitable for managed Postgres without vector)."
                )
                sql_without_extensions = _sql_without_pgvector(sql)
            
            # Now run the rest of the schema (tables, indexes, etc.)
            cur = conn.cursor()
            cur.execute(sql_without_extensions)
            conn.commit()
            
            if PGVECTOR_AVAILABLE:
                try:
                    register_vector(conn)
                except Exception as e:
                    print(f"WARNING: Could not register pgvector types: {e}")

        # Backfill schema changes for existing databases.
        for ddl in [
            ("ALTER TABLE users ADD COLUMN llm_provider TEXT NOT NULL DEFAULT 'openai'",
             "ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_provider TEXT NOT NULL DEFAULT 'openai'"),
            ("ALTER TABLE users ADD COLUMN api_keys TEXT NOT NULL DEFAULT '{}'",
             "ALTER TABLE users ADD COLUMN IF NOT EXISTS api_keys TEXT NOT NULL DEFAULT '{}'"),
            ("ALTER TABLE users ADD COLUMN agent_providers TEXT NOT NULL DEFAULT '{}'",
             "ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_providers TEXT NOT NULL DEFAULT '{}'"),
            ("ALTER TABLE documents ADD COLUMN version INTEGER DEFAULT 1",
             "ALTER TABLE documents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1"),
            ("ALTER TABLE documents ADD COLUMN is_latest BOOLEAN DEFAULT 1",
             "ALTER TABLE documents ADD COLUMN IF NOT EXISTS is_latest BOOLEAN DEFAULT TRUE"),
            ("ALTER TABLE documents ADD COLUMN calm_display_id TEXT",
             "ALTER TABLE documents ADD COLUMN IF NOT EXISTS calm_display_id TEXT"),
        ]:
            try:
                cur = conn.cursor()
                cur.execute(ddl[0] if is_sqlite else ddl[1])
                conn.commit()
            except Exception:
                try:
                    conn.rollback()
                except:
                    pass
            
        print(f"DEBUG: Database initialized successfully ({'SQLite' if is_sqlite else 'PostgreSQL'}).")
    except Exception as e:
        if not is_sqlite:
            try:
                conn.rollback()
            except:
                pass
        print(f"ERROR: Database initialization failed: {e}")
        if not is_sqlite:
            raise
    finally:
        conn.close()