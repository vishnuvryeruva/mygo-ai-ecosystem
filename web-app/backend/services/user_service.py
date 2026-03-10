"""
User Management Service
Manages users, their roles, and credentials (backed by PostgreSQL)
"""

import uuid
import bcrypt
import datetime
import psycopg2
import psycopg2.extras

from db import get_conn


def _row_to_dict(row):
    """Convert a psycopg2 RealDictRow to a plain dict."""
    return dict(row) if row else None


def list_users(created_by=None):
    """
    List users with their roles.

    Args:
        created_by: Optional user ID to filter users created by a specific admin.

    Returns:
        List of user dicts.
    """
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if created_by:
                cur.execute(
                    """
                    SELECT id, name, email, role, created_by, created_at
                    FROM users
                    WHERE created_by = %s OR id = %s
                    ORDER BY created_at DESC
                    """,
                    (created_by, created_by),
                )
            else:
                cur.execute(
                    """
                    SELECT id, name, email, role, created_by, created_at
                    FROM users
                    ORDER BY created_at DESC
                    """
                )
            rows = cur.fetchall()
    finally:
        conn.close()

    users = []
    for row in rows:
        users.append(
            {
                "id": row["id"],
                "name": row["name"],
                "email": row["email"],
                "role": row["role"] or "Viewer",
                "status": "Active",
                "created_by": row.get("created_by"),
                "created_at": row["created_at"],
            }
        )
    return users


def get_user_by_id(user_id: str):
    """Get a user by ID."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, name, email, role, created_by, created_at FROM users WHERE id = %s",
                (user_id,),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if row:
        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "role": row["role"] or "Viewer",
            "created_by": row.get("created_by"),
            "created_at": row["created_at"],
        }
    return None


def get_user_by_email(email: str):
    """Get a user by email."""
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, name, email, role, password_hash, created_by, created_at FROM users WHERE email = %s",
                (email,),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if row:
        return {
            "id": row["id"],
            "name": row["name"],
            "email": row["email"],
            "role": row["role"] or "Viewer",
            "password_hash": row["password_hash"],
            "created_by": row.get("created_by"),
            "created_at": row["created_at"],
        }
    return None


def create_user(name: str, email: str, password: str, role: str = "Viewer", created_by: str = None):
    """Create a new user."""
    email = email.strip().lower()

    # Check if email already exists
    if get_user_by_email(email):
        raise ValueError("An account with this email already exists")

    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    user_id = str(uuid.uuid4())
    created_at = datetime.datetime.utcnow().isoformat()

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO users (id, name, email, password_hash, role, created_by, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, name, email, password_hash, role, created_by, created_at),
            )
        conn.commit()
    except psycopg2.errors.UniqueViolation:
        conn.rollback()
        raise ValueError("An account with this email already exists")
    finally:
        conn.close()

    return {
        "id": user_id,
        "name": name,
        "email": email,
        "role": role,
        "created_by": created_by,
        "created_at": created_at,
    }


def update_user(user_id: str, name: str = None, role: str = None):
    """Update a user's information."""
    updates = []
    params = []

    if name:
        updates.append("name = %s")
        params.append(name)

    if role:
        updates.append("role = %s")
        params.append(role)

    if not updates:
        return get_user_by_id(user_id)

    params.append(user_id)
    query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
        conn.commit()
    finally:
        conn.close()

    return get_user_by_id(user_id)


def delete_user(user_id: str):
    """Delete a user."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
            deleted = cur.rowcount > 0
        conn.commit()
    finally:
        conn.close()
    return deleted


def count_users():
    """Count total number of users."""
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM users")
            count = cur.fetchone()[0]
    finally:
        conn.close()
    return count
