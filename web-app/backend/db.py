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
        if register_vec:
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
    conn = get_conn(register_vec=False)
    
    # Check if we are using SQLite (via proxy or direct)
    is_sqlite = isinstance(conn, SQLiteConnectionProxy) or isinstance(conn, sqlite3.Connection)
    
    try:
        with open(sql_path, "r") as f:
            sql = f.read()
        
        # SQL compatibility tweaks for SQLite
        if is_sqlite:
            # Remove Postgres-specific extensions and types
            sql = re.sub(r'CREATE EXTENSION.*?;', '', sql, flags=re.IGNORECASE | re.DOTALL)
            sql = sql.replace("embedding       vector(1536),", "embedding       BLOB,")
            sql = sql.replace("JSONB", "TEXT")
            # Remove any IVFFLAT index stuff which SQLite won't understand
            sql = re.sub(r'CREATE INDEX.*?USING ivfflat.*?;', '', sql, flags=re.IGNORECASE | re.DOTALL)
            # Replace %s with ? for SQLite placeholders in migrations if necessary, 
            # but init.sql usually has literal SQL.
        
        cur = conn.cursor()
        if is_sqlite:
            cur.executescript(sql)
        else:
            cur.execute(sql)
            
        conn.commit()
        
        if not is_sqlite:
            register_vector(conn)

        # Backfill schema changes for existing databases.
        for ddl in [
            ("ALTER TABLE users ADD COLUMN llm_provider TEXT NOT NULL DEFAULT 'openai'",
             "ALTER TABLE users ADD COLUMN IF NOT EXISTS llm_provider TEXT NOT NULL DEFAULT 'openai'"),
            ("ALTER TABLE users ADD COLUMN api_keys TEXT NOT NULL DEFAULT '{}'",
             "ALTER TABLE users ADD COLUMN IF NOT EXISTS api_keys TEXT NOT NULL DEFAULT '{}'"),
            ("ALTER TABLE users ADD COLUMN agent_providers TEXT NOT NULL DEFAULT '{}'",
             "ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_providers TEXT NOT NULL DEFAULT '{}'"),
        ]:
            try:
                cur = conn.cursor()
                cur.execute(ddl[0] if is_sqlite else ddl[1])
                conn.commit()
            except Exception:
                pass
            
        print(f"DEBUG: Database initialized successfully ({'SQLite' if is_sqlite else 'PostgreSQL'}).")
    except Exception as e:
        if not is_sqlite:
            conn.rollback()
        print(f"ERROR: Database initialization failed: {e}")
        # Don't raise if it's just a table already exists error in sqlite
        if not is_sqlite:
            raise
    finally:
        conn.close()
