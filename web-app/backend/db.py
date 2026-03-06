"""
Shared PostgreSQL connection module.

All services import get_conn() from here.
init_db() is called once at app startup to create tables.
"""

import os
import psycopg2
import psycopg2.extras
from pgvector.psycopg2 import register_vector

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/mygo_ai")


def get_conn(register_vec=True):
    """Return a new psycopg2 connection with RealDictCursor as default."""
    conn = psycopg2.connect(DATABASE_URL)
    # Register pgvector types on this connection (skip during init_db)
    if register_vec:
        register_vector(conn)
    return conn


def init_db():
    """
    Create all required tables if they don't exist.
    Run once on application startup.
    """
    sql_path = os.path.join(os.path.dirname(__file__), "migrations", "init.sql")
    # Connect WITHOUT registering vector first (extension may not exist yet)
    conn = get_conn(register_vec=False)
    try:
        with open(sql_path, "r") as f:
            sql = f.read()
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        # Now register vector for this connection after extension is created
        register_vector(conn)
        print("DEBUG: Database initialized successfully.")
    except Exception as e:
        conn.rollback()
        print(f"ERROR: Database initialization failed: {e}")
        raise
    finally:
        conn.close()
