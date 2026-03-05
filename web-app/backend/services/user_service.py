"""
User Management Service
Manages users, their roles, and credentials
"""

import sqlite3
import uuid
import bcrypt
import datetime
import os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'users.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def list_users(created_by=None):
    """
    List users with their roles
    
    Args:
        created_by: Optional user ID to filter users created by a specific admin
    
    Returns:
        List of users
    """
    conn = get_db()
    
    if created_by:
        # Show only users created by this admin, plus the admin themselves
        rows = conn.execute('''
            SELECT id, name, email, role, created_by, created_at 
            FROM users 
            WHERE created_by = ? OR id = ?
            ORDER BY created_at DESC
        ''', (created_by, created_by)).fetchall()
    else:
        rows = conn.execute('''
            SELECT id, name, email, role, created_by, created_at 
            FROM users 
            ORDER BY created_at DESC
        ''').fetchall()
    
    conn.close()
    
    users = []
    for row in rows:
        users.append({
            'id': row['id'],
            'name': row['name'],
            'email': row['email'],
            'role': row['role'] or 'Viewer',
            'status': 'Active',
            'created_by': row['created_by'] if 'created_by' in row.keys() else None,
            'created_at': row['created_at']
        })
    
    return users


def get_user_by_id(user_id: str):
    """Get a user by ID"""
    conn = get_db()
    row = conn.execute('SELECT id, name, email, role, created_by, created_at FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    
    if row:
        return {
            'id': row['id'],
            'name': row['name'],
            'email': row['email'],
            'role': row['role'] or 'Viewer',
            'created_by': row['created_by'] if 'created_by' in row.keys() else None,
            'created_at': row['created_at']
        }
    return None


def get_user_by_email(email: str):
    """Get a user by email"""
    conn = get_db()
    row = conn.execute('SELECT id, name, email, role, created_by, created_at FROM users WHERE email = ?', (email,)).fetchone()
    conn.close()
    
    if row:
        return {
            'id': row['id'],
            'name': row['name'],
            'email': row['email'],
            'role': row['role'] or 'Viewer',
            'created_by': row['created_by'] if 'created_by' in row.keys() else None,
            'created_at': row['created_at']
        }
    return None


def create_user(name: str, email: str, password: str, role: str = 'Viewer', created_by: str = None):
    """Create a new user"""
    email = email.strip().lower()
    
    # Check if email already exists
    if get_user_by_email(email):
        raise ValueError('An account with this email already exists')
    
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_id = str(uuid.uuid4())
    created_at = datetime.datetime.utcnow().isoformat()
    
    conn = get_db()
    conn.execute(
        'INSERT INTO users (id, name, email, password_hash, role, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        (user_id, name, email, password_hash, role, created_by, created_at)
    )
    conn.commit()
    conn.close()
    
    return {
        'id': user_id,
        'name': name,
        'email': email,
        'role': role,
        'created_by': created_by,
        'created_at': created_at
    }


def update_user(user_id: str, name: str = None, role: str = None):
    """Update a user's information"""
    conn = get_db()
    
    updates = []
    params = []
    
    if name:
        updates.append('name = ?')
        params.append(name)
    
    if role:
        updates.append('role = ?')
        params.append(role)
    
    if not updates:
        conn.close()
        return get_user_by_id(user_id)
    
    params.append(user_id)
    query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
    
    conn.execute(query, params)
    conn.commit()
    conn.close()
    
    return get_user_by_id(user_id)


def delete_user(user_id: str):
    """Delete a user"""
    conn = get_db()
    cursor = conn.execute('DELETE FROM users WHERE id = ?', (user_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    
    return deleted


def count_users():
    """Count total number of users"""
    conn = get_db()
    count = conn.execute('SELECT COUNT(*) as count FROM users').fetchone()['count']
    conn.close()
    return count
