import sys
import os
import bcrypt
import datetime
import uuid

# Add the backend dir to path so we can import db
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from backend.db import get_conn

def add_default_admin(email="admin@mygo.com", password="admin"):
    print(f"Creating default admin with email: {email} / password: {password}")
    
    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_id = str(uuid.uuid4())
    created_at = datetime.datetime.utcnow().isoformat()
    role = 'Admin'

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (%s, %s, %s, %s, %s, %s)',
                (user_id, "Default Admin", email, password_hash, role, created_at)
            )
        conn.commit()
        print("Admin user created successfully!")
    except Exception as e:
        print(f"Failed to create admin: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    add_default_admin()
