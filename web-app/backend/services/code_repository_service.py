"""
Service for managing user code snippets in the code repository.
"""

import uuid
import json
from datetime import datetime
from db import get_conn
import psycopg2.extras


class CodeRepositoryService:
    
    def save_code_snippet(self, user_id, title, code, code_type, description=None, analysis_data=None):
        """
        Save a code snippet to the user's repository.
        
        Args:
            user_id: User ID
            title: Title/name for the code snippet
            code: The actual code content
            code_type: Programming language (ABAP, Python, JavaScript, etc.)
            description: Optional description
            analysis_data: Optional analysis results (dict)
        
        Returns:
            dict: The created snippet with id
        """
        snippet_id = str(uuid.uuid4())
        
        conn = get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    INSERT INTO code_snippets 
                    (id, user_id, title, code, code_type, description, analysis_data, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING *
                """, (
                    snippet_id,
                    user_id,
                    title,
                    code,
                    code_type,
                    description,
                    json.dumps(analysis_data) if analysis_data else None,
                    datetime.now(),
                    datetime.now()
                ))
                result = cur.fetchone()
                conn.commit()
                
                # Convert to dict and handle datetime serialization
                snippet = dict(result)
                snippet['created_at'] = snippet['created_at'].isoformat() if snippet['created_at'] else None
                snippet['updated_at'] = snippet['updated_at'].isoformat() if snippet['updated_at'] else None
                
                return snippet
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def get_user_snippets(self, user_id, limit=100, offset=0):
        """
        Get all code snippets for a user.
        
        Args:
            user_id: User ID
            limit: Max number of snippets to return
            offset: Pagination offset
        
        Returns:
            list: List of code snippets
        """
        conn = get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT * FROM code_snippets
                    WHERE user_id = %s
                    ORDER BY created_at DESC
                    LIMIT %s OFFSET %s
                """, (user_id, limit, offset))
                results = cur.fetchall()
                
                snippets = []
                for row in results:
                    snippet = dict(row)
                    snippet['created_at'] = snippet['created_at'].isoformat() if snippet['created_at'] else None
                    snippet['updated_at'] = snippet['updated_at'].isoformat() if snippet['updated_at'] else None
                    snippets.append(snippet)
                
                return snippets
        finally:
            conn.close()
    
    def get_snippet_by_id(self, snippet_id, user_id):
        """
        Get a specific code snippet by ID (with user ownership check).
        
        Args:
            snippet_id: Snippet ID
            user_id: User ID (for ownership verification)
        
        Returns:
            dict: The snippet or None if not found/unauthorized
        """
        conn = get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT * FROM code_snippets
                    WHERE id = %s AND user_id = %s
                """, (snippet_id, user_id))
                result = cur.fetchone()
                
                if result:
                    snippet = dict(result)
                    snippet['created_at'] = snippet['created_at'].isoformat() if snippet['created_at'] else None
                    snippet['updated_at'] = snippet['updated_at'].isoformat() if snippet['updated_at'] else None
                    return snippet
                return None
        finally:
            conn.close()
    
    def update_snippet(self, snippet_id, user_id, title=None, code=None, description=None):
        """
        Update a code snippet.
        
        Args:
            snippet_id: Snippet ID
            user_id: User ID (for ownership verification)
            title: New title (optional)
            code: New code (optional)
            description: New description (optional)
        
        Returns:
            dict: Updated snippet or None if not found/unauthorized
        """
        conn = get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                updates = []
                params = []
                
                if title is not None:
                    updates.append("title = %s")
                    params.append(title)
                if code is not None:
                    updates.append("code = %s")
                    params.append(code)
                if description is not None:
                    updates.append("description = %s")
                    params.append(description)
                
                if not updates:
                    return self.get_snippet_by_id(snippet_id, user_id)
                
                updates.append("updated_at = %s")
                params.append(datetime.now())
                params.extend([snippet_id, user_id])
                
                cur.execute(f"""
                    UPDATE code_snippets
                    SET {', '.join(updates)}
                    WHERE id = %s AND user_id = %s
                    RETURNING *
                """, params)
                result = cur.fetchone()
                conn.commit()
                
                if result:
                    snippet = dict(result)
                    snippet['created_at'] = snippet['created_at'].isoformat() if snippet['created_at'] else None
                    snippet['updated_at'] = snippet['updated_at'].isoformat() if snippet['updated_at'] else None
                    return snippet
                return None
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def delete_snippet(self, snippet_id, user_id):
        """
        Delete a code snippet.
        
        Args:
            snippet_id: Snippet ID
            user_id: User ID (for ownership verification)
        
        Returns:
            bool: True if deleted, False if not found/unauthorized
        """
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM code_snippets
                    WHERE id = %s AND user_id = %s
                """, (snippet_id, user_id))
                deleted = cur.rowcount > 0
                conn.commit()
                return deleted
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def get_snippet_count(self, user_id):
        """
        Get total count of snippets for a user.
        
        Args:
            user_id: User ID
        
        Returns:
            int: Total count
        """
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT COUNT(*) FROM code_snippets
                    WHERE user_id = %s
                """, (user_id,))
                count = cur.fetchone()[0]
                return count
        finally:
            conn.close()
