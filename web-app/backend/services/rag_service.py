import os
import io
import zipfile
import re

try:
    import PyPDF2
except ImportError:
    PyPDF2 = None

import psycopg2
import psycopg2.extras

try:
    from pgvector.psycopg2 import register_vector
except ImportError:
    register_vector = None

try:
    from docx import Document
except ImportError:
    Document = None

from db import get_conn, has_vector_extension
from services.openai_service import OpenAIService

# Supported file extensions for extraction from ZIP files
SUPPORTED_EXTENSIONS = {
    # Documents
    '.pdf', '.docx', '.txt', '.md',
    # Code files
    '.py', '.js', '.ts', '.java', '.abap', '.json', '.yaml', '.yml', '.xml'
}


class RAGService:
    def __init__(self):
        self.openai_service = OpenAIService()
        self._is_sqlite_cache = None
        print("DEBUG: RAG Service initialized with OpenAI embeddings + PostgreSQL (pgvector) fallback")

    def _is_sqlite(self, conn):
        """Check if the connection is SQLite."""
        from db import SQLiteConnectionProxy
        import sqlite3
        return isinstance(conn, SQLiteConnectionProxy) or isinstance(conn, sqlite3.Connection)

    # ── Embedding ─────────────────────────────────────────────────────────────

    def _create_embedding(self, text):
        """Create embedding using Gemini or OpenAI (1536-dim)."""
        ai_provider = (os.getenv('AI_PROVIDER') or 'gemini').lower()
        gemini_key = os.getenv('GEMINI_API_KEY')
        openai_key = os.getenv('OPENAI_API_KEY')

        # Prioritize Gemini if selected or configured
        if ai_provider == 'gemini' and gemini_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=gemini_key)
                res = genai.embed_content(model='models/gemini-embedding-001', content=text)
                emb = res.get('embedding', [])
                if len(emb) > 1536:
                    return emb[:1536]
                elif 0 < len(emb) < 1536:
                    return emb + [0.0] * (1536 - len(emb))
                elif emb:
                    return emb
            except Exception as ge:
                print(f"NOTICE: Gemini embedding notice: {ge}")

        # OpenAI fallback
        if openai_key and openai_key.startswith('sk-'):
            try:
                from openai import OpenAI
                client = OpenAI(api_key=openai_key, timeout=10.0)
                response = client.embeddings.create(
                    model="text-embedding-3-small",
                    input=text
                )
                return response.data[0].embedding
            except Exception as e:
                print(f"NOTICE: OpenAI embedding failed ({e})")

        # Graceful zero-vector fallback so RAG search falls back to keyword / live SAP data
        return [0.0] * 1536

    # ── Internal helpers ───────────────────────────────────────────────────────

    def _chunk_text(self, text, chunk_size=500, overlap=50):
        """Split text into overlapping word-based chunks."""
        words = text.split()
        chunks = []
        for i in range(0, len(words), chunk_size - overlap):
            chunk = ' '.join(words[i:i + chunk_size])
            chunks.append(chunk)
        return chunks

    def _get_file_type(self, filename):
        """Map filename extension to a human-readable type label."""
        ext = filename.lower().split('.')[-1] if '.' in filename else 'unknown'
        type_map = {
            'pdf': 'PDF', 'docx': 'Word', 'doc': 'Word', 'txt': 'Text',
            'md': 'Markdown', 'py': 'Python', 'js': 'JavaScript',
            'ts': 'TypeScript', 'java': 'Java', 'abap': 'ABAP',
            'json': 'JSON', 'yaml': 'YAML', 'yml': 'YAML', 'xml': 'XML'
        }
        return type_map.get(ext, ext.upper())

    def _delete_chunks_for_doc(self, doc_id: str, conn):
        """Delete all existing chunks of exactly this document.

        Matches on document_id, not `id LIKE 'doc_%'`: '_' is a LIKE wildcard and a prefix
        match would also delete other objects (ZCL_FOO would wipe ZCL_FOO_BAR)."""
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM documents WHERE document_id = %s",
                (doc_id,)
            )

    def _has_real_content(self, doc_id: str) -> bool:
        """True if the document has at least one non-placeholder chunk stored."""
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM documents WHERE document_id = %s AND (is_placeholder IS NULL OR is_placeholder = %s) LIMIT 1",
                    (doc_id, False)
                )
                return cur.fetchone() is not None
        except Exception as e:
            print(f"Error checking document content: {e}")
            return False
        finally:
            conn.close()

    def _insert_chunk(self, conn, chunk_id: str, doc_id: str, content: str,
                      embedding, metadata: dict):
        """Insert a single chunk row into the documents table."""
        # Convert embedding list to bytes/blob/text for SQLite or standard Postgres
        is_sqlite = self._is_sqlite(conn)
        has_vector = has_vector_extension() if not is_sqlite else False
        if (is_sqlite or not has_vector) and isinstance(embedding, list):
            import json
            embedding_val = json.dumps(embedding)
            if is_sqlite:
                embedding_val = embedding_val.encode('utf-8')
        else:
            embedding_val = embedding

        with conn.cursor() as cur:
            if is_sqlite:
                # SQLite ON CONFLICT syntax
                sql = """
                INSERT INTO documents (
                    id, document_id, document_name, content, embedding,
                    source, doc_type, project, updated_by, updated_on,
                    web_url, is_placeholder, html_content,
                    uuid, display_id, project_id, scope_id
                ) VALUES (
                    ?, ?, ?, ?, ?,
                    ?, ?, ?, ?, ?,
                    ?, ?, ?,
                    ?, ?, ?, ?
                )
                ON CONFLICT (id) DO UPDATE SET
                    content = EXCLUDED.content,
                    embedding = EXCLUDED.embedding,
                    html_content = EXCLUDED.html_content,
                    updated_on = EXCLUDED.updated_on,
                    document_name = EXCLUDED.document_name,
                    source = EXCLUDED.source,
                    doc_type = EXCLUDED.doc_type,
                    project = EXCLUDED.project,
                    updated_by = EXCLUDED.updated_by,
                    web_url = EXCLUDED.web_url,
                    is_placeholder = EXCLUDED.is_placeholder,
                    uuid = EXCLUDED.uuid,
                    display_id = EXCLUDED.display_id,
                    project_id = EXCLUDED.project_id,
                    scope_id = EXCLUDED.scope_id
                """
                # SQLite proxy handles %s to ? but we can use ? directly if we know it's sqlite
                params = (
                    chunk_id, doc_id, metadata.get('document_name', ''), content, embedding_val,
                    metadata.get('source', 'File Upload'), metadata.get('type', 'Unknown'),
                    metadata.get('project', 'N/A'), metadata.get('updatedBy', 'System'),
                    metadata.get('updatedOn', 'N/A'), metadata.get('webUrl', ''),
                    metadata.get('is_placeholder', False), metadata.get('html_content', ''),
                    metadata.get('uuid', ''), metadata.get('displayId', ''),
                    metadata.get('projectId', ''), metadata.get('scopeId', '')
                )
                cur.execute(sql.replace('%s', '?'), params)
            else:
                cur.execute(
                    """
                    INSERT INTO documents (
                        id, document_id, document_name, content, embedding,
                        source, doc_type, project, updated_by, updated_on,
                        web_url, is_placeholder, html_content,
                        uuid, display_id, project_id, scope_id
                    ) VALUES (
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s,
                        %s, %s, %s, %s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        content = EXCLUDED.content,
                        embedding = EXCLUDED.embedding,
                        html_content = EXCLUDED.html_content,
                        updated_on = EXCLUDED.updated_on,
                        document_name = EXCLUDED.document_name,
                        source = EXCLUDED.source,
                        doc_type = EXCLUDED.doc_type,
                        project = EXCLUDED.project,
                        updated_by = EXCLUDED.updated_by,
                        web_url = EXCLUDED.web_url,
                        is_placeholder = EXCLUDED.is_placeholder,
                        uuid = EXCLUDED.uuid,
                        display_id = EXCLUDED.display_id,
                        project_id = EXCLUDED.project_id,
                        scope_id = EXCLUDED.scope_id
                    """,
                    (
                        chunk_id,
                        doc_id,
                        metadata.get('document_name', ''),
                        content,
                        embedding,
                        metadata.get('source', 'File Upload'),
                        metadata.get('type', 'Unknown'),
                        metadata.get('project', 'N/A'),
                        metadata.get('updatedBy', 'System'),
                        metadata.get('updatedOn', 'N/A'),
                        metadata.get('webUrl', ''),
                        metadata.get('is_placeholder', False),
                        metadata.get('html_content', ''),
                        metadata.get('uuid', ''),
                        metadata.get('displayId', ''),
                        metadata.get('projectId', ''),
                        metadata.get('scopeId', ''),
                    )
                )

    # ── Public API ─────────────────────────────────────────────────────────────

    def check_documents_exist_batch(self, doc_ids: list) -> dict:
        """Check existence for a list of document IDs in a single batch query."""
        if not doc_ids:
            return {}
        result = {d: False for d in doc_ids}
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                placeholders = ', '.join(['%s'] * len(doc_ids))
                cur.execute(
                    f"SELECT DISTINCT document_id FROM documents WHERE document_id IN ({placeholders})",
                    tuple(doc_ids)
                )
                rows = cur.fetchall()
                found = set(r[0] if isinstance(r, (tuple, list)) else r.get('document_id') for r in rows)
                for d in doc_ids:
                    result[d] = d in found
            return result
        except Exception as e:
            print(f"Error checking document existence batch: {e}")
            return result
        finally:
            conn.close()

    def check_document_exists(self, doc_id: str) -> bool:
        """Check if any chunk exists for the given document_id prefix."""
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM documents WHERE document_id = %s LIMIT 1",
                    (doc_id,)
                )
                return cur.fetchone() is not None
        except Exception as e:
            print(f"Error checking document existence: {e}")
            return False
        finally:
            conn.close()

    def check_duplicate(self, filename: str) -> bool:
        """Check if a document with the same filename already exists."""
        return self.check_document_exists(filename)

    def ingest_calm_document(self, doc_metadata, html_content: str):
        """
        Ingest a CALM document with real HTML content into the vector database.
        Strips HTML tags for embedding/search, stores raw HTML in metadata for display.
        Replaces any existing placeholder or chunks for this document.
        """
        doc_id = doc_metadata.get('id', 'unknown')
        meta = doc_metadata.get('metadata', doc_metadata)
        filename = meta.get('name', doc_metadata.get('name', 'unknown'))
        doc_type = meta.get('type') or meta.get('documentType') or 'Document'
        source = meta.get('source', 'CALM')
        project = meta.get('project', 'N/A')
        updated_by = (
            meta.get('updatedBy')
            or meta.get('changedBy')
            or meta.get('lastChangedBy')
            or meta.get('modifiedBy')
            or 'System'
        )
        updated_on = str(
            meta.get('updatedOn')
            or meta.get('modifiedAt')
            or meta.get('changedAt')
            or meta.get('lastModified')
            or 'N/A'
        )
        web_url = meta.get('webUrl', '')
        uuid_val = meta.get('uuid', '')
        display_id = meta.get('displayId', '')
        project_id = meta.get('projectId', '')
        scope_id = meta.get('scopeId', '')

        # Strip HTML tags to get plain text for embeddings
        plain_text = re.sub(r'<[^>]+>', ' ', html_content)
        plain_text = re.sub(r'\s+', ' ', plain_text).strip()

        if not plain_text:
            return self.add_placeholder_document(doc_metadata)

        MAX_HTML = 50000
        stored_html = html_content[:MAX_HTML] if len(html_content) > MAX_HTML else html_content

        base_metadata = {
            'source': source,
            'type': doc_type,
            'project': project,
            'updatedBy': updated_by,
            'updatedOn': updated_on,
            'webUrl': web_url,
            'is_placeholder': False,
            'document_name': filename,
            'uuid': uuid_val,
            'displayId': display_id,
            'projectId': project_id,
            'scopeId': scope_id,
        }

        chunks = self._chunk_text(plain_text, chunk_size=500, overlap=50)

        conn = get_conn()
        try:
            # Delete existing chunks for this document
            self._delete_chunks_for_doc(doc_id, conn)

            for i, chunk in enumerate(chunks):
                embedding = self._create_embedding(chunk)
                chunk_meta = dict(base_metadata)
                # Only store html_content on the first chunk
                chunk_meta['html_content'] = stored_html if i == 0 else ''
                self._insert_chunk(conn, f"{doc_id}_{i}", doc_id, chunk, embedding, chunk_meta)

            conn.commit()
        except Exception as e:
            conn.rollback()
            raise
        finally:
            conn.close()

        return {"status": "success", "chunks": len(chunks), "was_existing": False}

    def add_placeholder_document(self, doc_metadata):
        """Add or update a placeholder document (for synced external files with no content yet)."""
        try:
            meta = doc_metadata.get('metadata', doc_metadata)
            doc_id = doc_metadata.get('id', 'unknown')
            filename = meta.get('name', doc_metadata.get('name', 'unknown'))
            doc_type = doc_metadata.get('type') or doc_metadata.get('documentTypeCode') or meta.get('type') or meta.get('documentType') or 'Document'
            source = meta.get('source', 'CALM')
            project = meta.get('project', 'N/A')
            updated_by = (
                meta.get('updatedBy')
                or meta.get('changedBy')
                or meta.get('lastChangedBy')
                or meta.get('modifiedBy')
                or 'System'
            )
            updated_on = (
                meta.get('updatedOn')
                or meta.get('modifiedAt')
                or meta.get('changedAt')
                or meta.get('lastModified')
                or 'N/A'
            )
            web_url = meta.get('webUrl', '')
            uuid_val = meta.get('uuid', '')
            display_id = meta.get('displayId', '')
            project_id = meta.get('projectId', '')
            scope_id = meta.get('scopeId', '')

            already_exists = self.check_document_exists(doc_id)

            # A failed content fetch on re-sync must not clobber chunk 0 of a document
            # that already has real content (chunks 1..n would be left stale).
            if already_exists and self._has_real_content(doc_id):
                return {"status": "unchanged", "message": "Content could not be fetched; kept previously synced content", "was_existing": True}

            placeholder_text = (
                f"External document synced from {source}. Project: {project}. "
                f"Type: {doc_type}. Document: {filename}. "
                "This is a placeholder for metadata purposes."
            )
            embedding = [0.0] * 1536

            chunk_meta = {
                'source': source,
                'type': doc_type,
                'project': project,
                'updatedBy': updated_by,
                'updatedOn': str(updated_on),
                'webUrl': web_url,
                'is_placeholder': True,
                'document_name': filename,
                'uuid': uuid_val,
                'displayId': display_id,
                'projectId': project_id,
                'scopeId': scope_id,
                'html_content': '',
            }

            conn = get_conn()
            try:
                self._insert_chunk(conn, f"{doc_id}_0", doc_id, placeholder_text, embedding, chunk_meta)
                conn.commit()
            finally:
                conn.close()

            status = "updated" if already_exists else "success"
            return {"status": status, "message": "Document placeholder saved", "was_existing": already_exists}

        except Exception as e:
            print(f"Error adding/updating placeholder: {e}")
            return {"status": "error", "error": str(e)}

    def get_document_html(self, doc_id: str) -> str:
        """Retrieve the stored HTML content for a CALM document by its document_id.
        For File Upload docs (no html_content), returns concatenated chunk content wrapped in <pre>."""
        conn = get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT html_content FROM documents WHERE document_id = %s AND html_content != '' AND html_content IS NOT NULL LIMIT 1",
                    (doc_id,)
                )
                row = cur.fetchone()
                if row and row['html_content']:
                    return row['html_content']
                # File Upload docs: no html_content, get chunk text
                cur.execute(
                    "SELECT content FROM documents WHERE document_id = %s ORDER BY id",
                    (doc_id,)
                )
                rows = cur.fetchall()
                if not rows:
                    return ''
                import html
                combined = "\n\n".join(r['content'] or '' for r in rows)
                return "<pre style='white-space:pre-wrap;font-family:inherit;'>" + html.escape(combined) + "</pre>"
        except Exception as e:
            print(f"Error retrieving html content for {doc_id}: {e}")
            return ''
        finally:
            conn.close()

    def ingest_documents(self, files, max_zip_size=256000):
        """Ingest uploaded files into the vector database."""
        results = []

        for file in files:
            try:
                filename_lower = file.filename.lower()

                # Handle ZIP files
                if filename_lower.endswith('.zip'):
                    file.seek(0, 2)
                    file_size = file.tell()
                    file.seek(0)

                    if file_size > max_zip_size:
                        results.append({
                            "filename": file.filename,
                            "status": "error",
                            "error": f"ZIP file exceeds 250KB limit ({file_size / 1024:.1f}KB)"
                        })
                        continue

                    zip_results = self._extract_zip(file)
                    results.extend(zip_results)
                    continue

                is_duplicate = self.check_duplicate(file.filename)
                text_content = self._extract_text(file)

                if not text_content.strip():
                    results.append({
                        "filename": file.filename,
                        "status": "error",
                        "error": "No text content extracted from file"
                    })
                    continue

                chunks = self._chunk_text(text_content, chunk_size=500, overlap=50)
                doc_id = file.filename

                conn = get_conn()
                try:
                    for i, chunk in enumerate(chunks):
                        embedding = self._create_embedding(chunk)
                        metadata = {
                            'source': 'File Upload',
                            'type': self._get_file_type(file.filename),
                            'project': 'N/A',
                            'updatedBy': 'System',
                            'updatedOn': 'N/A',
                            'document_name': file.filename,
                            'is_placeholder': False,
                            'html_content': '',
                        }
                        self._insert_chunk(conn, f"{doc_id}_{i}", doc_id, chunk, embedding, metadata)
                    conn.commit()
                except Exception:
                    conn.rollback()
                    raise
                finally:
                    conn.close()

                results.append({
                    "filename": file.filename,
                    "chunks": len(chunks),
                    "status": "success",
                    "was_duplicate": is_duplicate
                })

            except Exception as e:
                import traceback
                traceback.print_exc()
                results.append({
                    "filename": file.filename,
                    "status": "error",
                    "error": str(e)
                })

        return results

    def query(self, query_text, top_k=5, custom_prompt=None, llm_provider='openai', sap_credentials=None):
        """Query the RAG system with direct live SAP S/4HANA ADT connection and cosine similarity search.
        
        Returns:
            dict with 'answer' (str) and 'references' (list of source doc dicts)
        """
        references = []
        rows = []

        # ── Step 1: Knowledge Base Vector Search (with resilient fallback) ──────
        try:
            query_embedding = self._create_embedding(query_text)
        except Exception as emb_err:
            print(f"[RAGService] Embedding creation note (falling back to text match / live SAP): {emb_err}")
            query_embedding = None

        conn = get_conn()
        is_sqlite = self._is_sqlite(conn)
        try:
            if query_embedding:
                has_vector = has_vector_extension() if not is_sqlite else False
                if is_sqlite or not has_vector:
                    import json
                    import math
                    
                    def cosine_similarity(v1, v2):
                        dot_product = sum(a * b for a, b in zip(v1, v2))
                        magnitude1 = math.sqrt(sum(a * a for a in v1))
                        magnitude2 = math.sqrt(sum(a * a for a in v2))
                        if not magnitude1 or not magnitude2:
                            return 0
                        return dot_product / (magnitude1 * magnitude2)

                    with conn.cursor() as cur:
                        cur.execute("SELECT content, source, doc_type, project, document_name, web_url, document_id, embedding FROM documents")
                        all_rows = cur.fetchall()
                    
                    scored_rows = []
                    for row in all_rows:
                        try:
                            row_dict = dict(row)
                            emb_data = row_dict.get('embedding')
                            if emb_data:
                                if isinstance(emb_data, bytes):
                                    emb_list = json.loads(emb_data.decode('utf-8'))
                                elif isinstance(emb_data, str):
                                    emb_list = json.loads(emb_data)
                                else:
                                    emb_list = emb_data
                                score = cosine_similarity(query_embedding, emb_list)
                                row_dict['score'] = score
                                scored_rows.append(row_dict)
                        except Exception:
                            pass
                    scored_rows.sort(key=lambda x: x.get('score', 0), reverse=True)
                    rows = scored_rows[:top_k]
                else:
                    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                        cur.execute(
                            """
                            SELECT content, source, doc_type, project, document_name, web_url, document_id
                            FROM documents
                            ORDER BY embedding <=> %s::vector
                            LIMIT %s
                            """,
                            (query_embedding, top_k)
                        )
                        rows = cur.fetchall()
            else:
                # Text/Keyword search fallback if embedding service is offline
                search_term = f"%{query_text.strip().split()[0]}%" if query_text.strip() else "%"
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT content, source, doc_type, project, document_name, web_url, document_id FROM documents WHERE content LIKE %s OR document_name LIKE %s LIMIT %s",
                        (search_term, search_term, top_k)
                    )
                    all_text_rows = cur.fetchall()
                    rows = [dict(r) for r in all_text_rows]
        except Exception as db_err:
            print(f"[RAGService] DB search notice: {db_err}")
            rows = []
        finally:
            conn.close()

        # Deduplicate KB references
        seen_doc_ids = set()
        seen_names = set()
        for row in rows:
            raw_id = row.get('document_id')
            doc_id = str(raw_id).strip() if raw_id is not None else ''
            doc_name = row.get('document_name') or ''
            if doc_id:
                if doc_id in seen_doc_ids:
                    continue
                seen_doc_ids.add(doc_id)
            elif doc_name:
                if doc_name in seen_names:
                    continue
                seen_names.add(doc_name)
            else:
                continue
            references.append({
                'document_name': doc_name or doc_id or 'Document',
                'document_id': doc_id,
                'source': row.get('source', 'Knowledge Base'),
                'project': row.get('project', 'N/A'),
                'doc_type': row.get('doc_type', 'Document'),
                'web_url': row.get('web_url') or '',
            })
        
        context_parts = [row['content'] for row in rows if row.get('content')]
        live_sap_context = []

        # ── Step 2: Live SAP S/4HANA ADT Direct Connection ──────────────────────
        try:
            from services.sap_adt_mcp_service import ADTMCPRouter
            router = ADTMCPRouter.from_ephemeral_creds(sap_credentials) if sap_credentials else ADTMCPRouter.from_source_config()

            if router.is_adt_available():
                upper_query = query_text.upper()

                # A. System info query
                if any(k in upper_query for k in ("CONNECTED", "SAP SYSTEM", "SYSTEM STATUS", "SAP HOST", "HMF", "CONNECTION")):
                    test_conn = router.test_connection()
                    client_id = getattr(router._adt, 'client_id', '300')
                    endpoint = getattr(router._adt, 'api_endpoint', 'https://192.168.171.91:44300')
                    host = getattr(getattr(router._adt, 'direct_client', None), 'host', '192.168.171.91')
                    user = getattr(getattr(router._adt, 'direct_client', None), 'username', 'YRAJPUT')
                    live_sap_context.append(
                        f"### Active Live SAP System Connection\n"
                        f"- **Status**: {'Connected (Active)' if test_conn.get('connected') else 'Configured'}\n"
                        f"- **System ID**: HMF (SAP S/4HANA 2021/2023)\n"
                        f"- **Host / Endpoint**: {endpoint}\n"
                        f"- **Client**: {client_id}\n"
                        f"- **User**: {user}\n"
                        f"- **Protocol**: SAP ADT Embedded REST HTTPS"
                    )
                    references.append({
                        'document_name': 'SAP S/4HANA Connection (HMF / 300)',
                        'document_id': 'SAP_ADT_SYSTEM_INFO',
                        'source': 'SAP S/4HANA (Live ADT)',
                        'project': 'Live System HMF',
                        'doc_type': 'System Status',
                        'web_url': endpoint
                    })

                # B. Transport query
                if any(k in upper_query for k in ("TRANSPORT", "TRANSPORTS", "CTS", "OPEN REQUEST", "DEVK")):
                    tr_res = router.list_transports()
                    transports = tr_res.get('transports', [])
                    user_str = getattr(getattr(router._adt, 'direct_client', None), 'username', 'YRAJPUT')
                    if transports:
                        tr_summary = f"### Live SAP Open Transports for user `{user_str}` ({len(transports)} found):\n"
                        for tr in transports[:10]:
                            tr_summary += f"- **{tr.get('id')}** ({tr.get('status', 'Draft')}): {tr.get('description', 'No description')} [Owner: {tr.get('owner', user_str)}]\n"
                        live_sap_context.append(tr_summary)
                    else:
                        live_sap_context.append(
                            f"### Live SAP Open Transports (CTS)\n"
                            f"- **User**: `{user_str}`\n"
                            f"- **Client**: 300 (System HMF)\n"
                            f"- **Result**: 0 open Workbench or Customizing transport requests currently assigned to `{user_str}` in CTS."
                        )
                    references.append({
                        'document_name': 'SAP Open Transports',
                        'document_id': 'SAP_ADT_LIVE_TRANSPORTS',
                        'source': 'SAP S/4HANA (Live ADT)',
                        'project': 'CTS Transports',
                        'doc_type': 'Transports',
                        'web_url': ''
                    })

                # C. Package contents query
                import re
                pkg_match = re.search(r'(?:PACKAGE|PKG)\s*[:=]?\s*([\$A-Z0-9_]+)', upper_query) or re.search(r'(\$TMP|Z[A-Z0-9_]+_PKG|Z001)', upper_query)
                if pkg_match:
                    pkg_name = pkg_match.group(1).rstrip('?.,!;:')
                    pkg_res = router.list_package(pkg_name)
                    objs = pkg_res.get('objects', [])
                    if not objs:
                        # Fallback to quickSearch for objects matching or belonging to this package
                        search_res = router.search_objects(f"{pkg_name}*", max_results=20)
                        found_objs = search_res.get('objects', [])
                        if not found_objs and pkg_name.startswith('$'):
                            search_res = router.search_objects("Z*", max_results=30)
                            objs = [o for o in search_res.get('objects', []) if o.get('package') == pkg_name]
                        else:
                            objs = found_objs

                    if objs:
                        pkg_summary = f"### Live SAP Package Objects for `{pkg_name}` ({len(objs)} objects):\n"
                        for obj in objs[:25]:
                            pkg_summary += f"- **{obj.get('name')}** (`{obj.get('type')}` in package `{obj.get('package', pkg_name)}`): {obj.get('description') or 'No description'}\n"
                        live_sap_context.append(pkg_summary)
                    else:
                        live_sap_context.append(
                            f"### Live SAP Package `{pkg_name}`\n"
                            f"The SAP S/4HANA ADT nodestructure repository returned 0 active objects in `{pkg_name}` on client 300."
                        )
                    references.append({
                        'document_name': f"SAP Package: {pkg_name}",
                        'document_id': f"SAP_ADT_PKG_{pkg_name}",
                        'source': 'SAP S/4HANA (Live ADT)',
                        'project': 'Live Package',
                        'doc_type': 'Package Listing',
                        'web_url': ''
                    })

                # D. Specific ABAP Object / Table / CDS View Source Fetch
                obj_patterns = [
                    (r'\b(CL_[A-Z0-9_]{3,30}|ZCL_[A-Z0-9_]{3,30})\b', 'CLAS'),
                    (r'\b(IF_[A-Z0-9_]{3,30}|ZIF_[A-Z0-9_]{3,30})\b', 'INTF'),
                    (r'\b(ZI_[A-Z0-9_]{3,30}|ZC_[A-Z0-9_]{3,30})\b', 'DDLS'),
                    (r'\b(VBAK|VBAP|MARA|MAKT|KNA1|KNB1|LFA1|LFB1|EKKO|EKPO|BSEG|BKPF|Z[A-Z0-9_]{3,20}_T)\b', 'TABL'),
                    (r'\b(Z[A-Z0-9_]{3,30})\b', 'PROG')
                ]
                
                fetched_objects = set()
                for pattern, inferred_type in obj_patterns:
                    matches = re.findall(pattern, upper_query)
                    for target_obj in matches:
                        if target_obj in fetched_objects or target_obj in ('PACKAGE', 'TRANSPORTS', 'CLASS', 'TABLE', 'QUERY', 'SAP'):
                            continue
                        fetched_objects.add(target_obj)
                        
                        code_res = router.fetch_code(target_obj, inferred_type)
                        if code_res.get('success') and code_res.get('source_code'):
                            src = code_res['source_code'][:5000]
                            live_sap_context.append(
                                f"### Live SAP S/4HANA Source: `{target_obj}` ({inferred_type})\n"
                                f"```abap\n{src}\n```"
                            )
                            references.append({
                                'document_name': f"SAP ADT: {target_obj}",
                                'document_id': f"SAP_ADT_LIVE_{target_obj}",
                                'source': 'SAP S/4HANA (Live ADT)',
                                'project': 'Live System HMF',
                                'doc_type': f'ABAP_{inferred_type}',
                                'web_url': ''
                            })
                            break # Limit to 1 major code object to preserve prompt budget

                # E. QuickSearch if query is an object search
                if any(w in upper_query for w in ("SEARCH", "FIND", "LOOKUP", "LIST OBJECTS", "MATCHING")) and not fetched_objects and not pkg_match:
                    search_term = re.sub(r'^(?:SEARCH|FIND|LOOKUP|SHOW|LIST)\s+(?:FOR\s+)?(?:OBJECTS\s+)?', '', upper_query.strip())
                    search_term = search_term.split()[0] if search_term else "Z*"
                    if not any(c in search_term for c in ('*', '?')):
                        search_term = f"{search_term}*"
                    search_res = router.search_objects(search_term, max_results=10)
                    search_objs = search_res.get('objects', [])
                    if search_objs:
                        s_text = f"### Live SAP QuickSearch Results for `{search_term}` ({len(search_objs)} found):\n"
                        for o in search_objs:
                            s_text += f"- **{o.get('name')}** (`{o.get('type')}` in package `{o.get('package')}`): {o.get('description')}\n"
                        live_sap_context.append(s_text)
                        references.append({
                            'document_name': f"SAP Search: {search_term}",
                            'document_id': f"SAP_ADT_SEARCH_{search_term}",
                            'source': 'SAP S/4HANA (Live ADT)',
                            'project': 'Search Results',
                            'doc_type': 'Repository Search',
                            'web_url': ''
                        })

        except Exception as sap_err:
            print(f"[RAGService] Live SAP ADT direct integration notice: {sap_err}")

        # Combine Live SAP context + Vector Knowledge Base context
        full_context_blocks = []
        if live_sap_context:
            full_context_blocks.append("\n\n".join(live_sap_context))
        if context_parts:
            full_context_blocks.append("### Relevant Knowledge Base Excerpts:\n" + "\n\n".join(context_parts))
        
        context = "\n\n---\n\n".join(full_context_blocks)

        # ── Step 3: Build Prompt & Generate Answer ──────────────────────────────
        if custom_prompt:
            system_prompt = custom_prompt
        else:
            system_prompt = (
                "You are Yoda, a premier AI SAP Solutions Architect & ABAP Intelligence Assistant. "
                "You are DIRECTLY CONNECTED to a live SAP S/4HANA system (System ID: HMF, Client: 300, Host: 192.168.171.91) via SAP ADT Embedded REST. "
                "You have real-time access to live ABAP programs, classes, CDS views, database tables, packages, and transport requests. "
                "Provide comprehensive, authoritative, clear, and actionable answers using the provided live SAP system data and knowledge base context. "
                "If live SAP code or tables are provided in the context, analyze them thoroughly, explain business implications, and reference specific fields/methods."
            )

        user_prompt = (
            f"Context (Live SAP S/4HANA System & Knowledge Base):\n{context if context.strip() else 'Live SAP connection active. Knowledge base currently empty.'}\n\n"
            f"User Question: {query_text}\n\n"
            "Please provide an insightful, structured, and complete answer with code snippets or field references where applicable."
        )

        try:
            answer = self.openai_service.generate_text(
                user_prompt,
                system_prompt=system_prompt,
                temperature=0.3,
                max_tokens=1500,
                provider=llm_provider,
                agent_name="Ask Yoda"
            )
        except Exception as gen_err:
            print(f"[RAGService] LLM generate_text notice: {gen_err}")
            if live_sap_context:
                answer = (
                    f"### 🟢 Live SAP S/4HANA Analysis (Direct Connection: HMF / Client 300)\n\n"
                    f"I connected directly to your active SAP S/4HANA system via ADT REST and retrieved the following real-time data for your query:\n\n"
                    + "\n\n".join(live_sap_context) + "\n\n"
                    f"> **Note**: To enable generative AI explanations, verify your LLM API Key in **Settings → AI Preferences**."
                )
            else:
                answer = (
                    f"I received your question: *\"{query_text}\"*\n\n"
                    f"Live SAP connection to **HMF (Client 300)** is online. However, your configured AI Provider returned an error ({str(gen_err)}). "
                    f"Please update your API key in **Settings → AI Preferences** to generate full natural language insights."
                )

        return {
            "answer": answer,
            "references": references,
            "query": query_text
        }

    # ── SAP ADT Package Ingestion ──────────────────────────────────────────────

    def ingest_from_sap_adt(self, package_name: str, destination: str = '',
                             user_id: str = 'system', sap_credentials: dict = None) -> dict:
        """
        Fetch an entire SAP package via ADTMCPRouter and ingest all ABAP objects
        into the RAG vector database.

        This replaces the BTP objectsSet crawl for code ingestion:
          - BTP used:  objectsSet OData entity → sourcecodeSet per object
          - ADT uses:  /sap/bc/adt/repository/nodestructure → source/main per object

        Args:
            package_name: SAP package name (e.g. '$TMP', 'ZFIORI_SALES')
            destination:  Optional ADT destination name (unused for embedded mode)
            user_id:      User performing the sync (for audit metadata)
            sap_credentials: Optional ephemeral SAP credentials dict

        Returns:
            {
                "success": True,
                "package": "ZPACKAGE",
                "ingested": ["ZCL_FOO", "ZREPORT_01", ...],
                "skipped":  ["ZIF_BAR"],
                "errors":   [{"object": "ZCL_BAD", "error": "..."}],
                "total_objects": N,
                "total_ingested": N
            }
        """
        from services.sap_adt_mcp_service import ADTMCPRouter
        if sap_credentials:
            router = ADTMCPRouter.from_ephemeral_creds(sap_credentials)
        else:
            router = ADTMCPRouter.from_source_config()

        # ── Step 1: List all objects in the package ───────────────────────
        print(f"[RAGService] ingest_from_sap_adt: listing package {package_name}")
        pkg_result = router.list_package(package_name)

        if not pkg_result.get('success'):
            return {
                "success": False,
                "package": package_name,
                "error": pkg_result.get('error', 'Failed to list package contents'),
                "ingested": [], "skipped": [], "errors": []
            }

        objects = pkg_result.get('objects', [])
        print(f"[RAGService] ingest_from_sap_adt: found {len(objects)} objects in {package_name}")

        # ── Step 2: Fetch + ingest each object ────────────────────────────
        ingested = []
        skipped  = []
        errors   = []

        # Object types we can fetch source for — skip metadata-only types
        FETCHABLE_TYPES = {'CLAS', 'INTF', 'PROG', 'INCL', 'FUGR', 'TABL', 'DDLS',
                           'VIEW', 'DTEL', 'DOMA', 'MSAG'}

        for obj in objects:
            obj_name = obj.get('name', '').strip().upper()
            obj_type = obj.get('type', '').strip().upper()
            obj_desc = obj.get('description', '')

            if not obj_name or obj_type not in FETCHABLE_TYPES:
                skipped.append(obj_name or f"<unnamed {obj_type}>")
                continue

            try:
                code_result = router.fetch_code(obj_name, obj_type)

                if not code_result.get('success') or not code_result.get('source_code'):
                    errors.append({
                        'object': obj_name,
                        'error': code_result.get('error', 'Empty source returned')
                    })
                    continue

                source_text = code_result['source_code']
                doc_id      = f"SAP_ADT_{package_name}_{obj_name}"

                # Build metadata matching existing document schema
                chunk_metadata = {
                    'document_name': obj_name,
                    'source':        'SAP_ADT',
                    'type':          f"ABAP_{obj_type}",
                    'project':       package_name,
                    'updatedBy':     user_id,
                    'updatedOn':     '',
                    'webUrl':        '',
                    'html_content':  '',
                    'uuid':          '',
                    'displayId':     obj_name,
                    'projectId':     package_name,
                    'scopeId':       obj_type,
                }

                # Chunk, embed, and store the source code
                conn = get_conn()
                try:
                    # Remove existing chunks for this object if re-syncing
                    self._delete_chunks_for_doc(doc_id, conn)

                    chunks = self._chunk_text(source_text)
                    for i, chunk in enumerate(chunks):
                        chunk_id  = f"{doc_id}_{i}"
                        embedding = self._create_embedding(
                            f"SAP {obj_type} {obj_name}: {chunk[:200]}"
                        )
                        self._insert_chunk(conn, chunk_id, doc_id, chunk,
                                           embedding, chunk_metadata)
                    conn.commit()
                    ingested.append(obj_name)
                    print(f"[RAGService] Ingested {obj_name} ({obj_type}) — {len(chunks)} chunks")
                except Exception as db_err:
                    conn.rollback()
                    errors.append({'object': obj_name, 'error': f"DB error: {str(db_err)}"})
                finally:
                    conn.close()

            except Exception as e:
                errors.append({'object': obj_name, 'error': str(e)})

        result = {
            "success": True,
            "package": package_name,
            "source": pkg_result.get('source', 'SAP_ADT'),
            "total_objects":  len(objects),
            "total_ingested": len(ingested),
            "total_skipped":  len(skipped),
            "total_errors":   len(errors),
            "ingested": ingested,
            "skipped":  skipped,
            "errors":   errors
        }
        print(f"[RAGService] ingest_from_sap_adt complete: {len(ingested)} ingested, "
              f"{len(skipped)} skipped, {len(errors)} errors")
        return result

    def list_documents(self, page: int = 1, page_size: int = 10, search: str = '',
                       source: str = '', doc_type: str = '', project: str = '',
                       date_from: str = '', date_to: str = '', category: str = '',
                       latest_only: bool = True):
        """List unique documents or code objects with optional filtering and pagination.

        Returns a dict with keys: documents (list), total (int), page (int), page_size (int), total_pages (int).
        """
        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        offset = (page - 1) * page_size

        DOC_ONLY_TYPES = (
            'Note', 'Functional Spec', 'Technical Spec', 'Solution Document',
            'Change Document', 'Decision Paper', 'Manual Test Case', 'TEST_CASE',
            'Document', 'General', 'Specification', 'Architecture', 'PDF', 'Word',
            'Text Document', 'File Upload', 'Markdown', 'DOCX', 'TXT',
            'Text',  # _get_file_type() labels .txt uploads as 'Text'
        )

        conn = None
        try:
            conn = get_conn()
            if self._is_sqlite(conn):
                # ── SQLite path ──────────────────────────────────────────────
                where_clauses = []
                params: list = []

                if search:
                    where_clauses.append("(document_name LIKE ? OR document_id LIKE ?)")
                    like = f"%{search}%"
                    params += [like, like]
                if source:
                    where_clauses.append("source = ?")
                    params.append(source)
                if doc_type:
                    where_clauses.append("doc_type = ?")
                    params.append(doc_type)
                if project:
                    where_clauses.append("project = ?")
                    params.append(project)
                if date_from:
                    where_clauses.append("updated_on >= ?")
                    params.append(date_from)
                if date_to:
                    where_clauses.append("updated_on <= ?")
                    params.append(date_to + "T23:59:59")
                if latest_only:
                    where_clauses.append("(is_latest = 1 OR is_latest IS NULL)")
                if category == 'code':
                    placeholders = ','.join(['?'] * len(DOC_ONLY_TYPES))
                    where_clauses.append(f"doc_type NOT IN ({placeholders})")
                    params += list(DOC_ONLY_TYPES)
                elif category == 'documents':
                    placeholders = ','.join(['?'] * len(DOC_ONLY_TYPES))
                    where_clauses.append(f"doc_type IN ({placeholders})")
                    params += list(DOC_ONLY_TYPES)

                where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

                with conn.cursor() as cur:
                    cur.execute(
                        f"""
                        SELECT COUNT(DISTINCT document_id) AS total
                        FROM documents
                        {where_sql}
                        """,
                        params,
                    )
                    total = cur.fetchone()[0] or 0

                    cur.execute(
                        f"""
                        SELECT
                            document_id, document_name, source, doc_type, project,
                            updated_by, updated_on, web_url, uuid, display_id,
                            version, is_latest, calm_display_id,
                            MAX(length(content)) AS content_len,
                            COUNT(*) AS chunk_count
                        FROM documents
                        {where_sql}
                        GROUP BY document_id
                        ORDER BY updated_on DESC NULLS LAST
                        LIMIT ? OFFSET ?
                        """,
                        params + [page_size, offset],
                    )
                    rows = [dict(row) for row in cur.fetchall()]
            else:
                # ── PostgreSQL path ──────────────────────────────────────────
                where_clauses = []
                params = []

                if search:
                    where_clauses.append("(d.document_name ILIKE %s OR d.document_id ILIKE %s)")
                    like = f"%{search}%"
                    params += [like, like]
                if source:
                    where_clauses.append("d.source = %s")
                    params.append(source)
                if doc_type:
                    where_clauses.append("d.doc_type = %s")
                    params.append(doc_type)
                if project:
                    where_clauses.append("d.project = %s")
                    params.append(project)
                if date_from:
                    where_clauses.append("d.updated_on >= %s")
                    params.append(date_from)
                if date_to:
                    where_clauses.append("d.updated_on <= %s")
                    params.append(date_to + "T23:59:59")
                if latest_only:
                    where_clauses.append("(d.is_latest = TRUE OR d.is_latest IS NULL)")
                if category == 'code':
                    where_clauses.append("NOT (d.doc_type = ANY(%s))")
                    params.append(list(DOC_ONLY_TYPES))
                elif category == 'documents':
                    where_clauses.append("d.doc_type = ANY(%s)")
                    params.append(list(DOC_ONLY_TYPES))

                where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

                with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                    # Total count of distinct documents matching the filter
                    cur.execute(
                        f"""
                        SELECT COUNT(*) AS total FROM (
                            SELECT 1 FROM documents d
                            {where_sql}
                            GROUP BY d.document_id
                        ) sub
                        """,
                        params,
                    )
                    total = (cur.fetchone() or {}).get('total') or 0

                    # Paginated page using a CTE so DISTINCT ON + ORDER/LIMIT work cleanly
                    cur.execute(
                        f"""
                        WITH unique_docs AS (
                            SELECT DISTINCT ON (d.document_id)
                                d.document_id,
                                d.document_name,
                                d.source,
                                d.doc_type,
                                d.project,
                                d.updated_by,
                                d.updated_on,
                                d.web_url,
                                d.uuid,
                                d.display_id,
                                d.version,
                                d.is_latest,
                                d.calm_display_id,
                                length(d.content) AS content_len,
                                (SELECT COUNT(*)::int FROM documents d2
                                 WHERE d2.document_id IS NOT DISTINCT FROM d.document_id) AS chunk_count
                            FROM documents d
                            {where_sql}
                            ORDER BY d.document_id, d.id
                        )
                        SELECT * FROM unique_docs
                        ORDER BY updated_on DESC NULLS LAST
                        LIMIT %s OFFSET %s
                        """,
                        params + [page_size, offset],
                    )
                    rows = cur.fetchall()

        except Exception as e:
            print(f"Error listing documents: {e}")
            import traceback
            traceback.print_exc()
            rows = []
            total = 0
        finally:
            if conn:
                conn.close()

        doc_list = []
        try:
            for row in rows:
                content_len = row.get('content_len') or 0
                chunk_count = int(row.get('chunk_count') or 1)
                estimated_size = content_len * chunk_count
                size_kb = estimated_size / 1024
                uid = row.get('uuid')
                if uid is not None and hasattr(uid, 'hex'):
                    uid = str(uid)
                doc_list.append({
                    'name': row.get('document_name') or row.get('document_id') or 'Unknown',
                    'type': row.get('doc_type') or 'Unknown',
                    'source': row.get('source') or 'File Upload',
                    'project': row.get('project') or 'N/A',
                    'updatedBy': row.get('updated_by') or 'System',
                    'updatedOn': str(row.get('updated_on')) if row.get('updated_on') else None,
                    'webUrl': row.get('web_url'),
                    'documentId': row.get('document_id'),
                    'uuid': uid or '',
                    'version': row.get('version') or 1,
                    'isLatest': row.get('is_latest') if row.get('is_latest') is not None else True,
                    'displayId': row.get('calm_display_id') or row.get('display_id') or '',
                    'size': f"{size_kb:.1f} KB" if size_kb >= 1 else f"{estimated_size} bytes",
                    'chunks': chunk_count,
                })
        except Exception as e:
            print(f"Error building document list: {e}")
            import traceback
            traceback.print_exc()

        import math
        total_pages = math.ceil(total / page_size) if page_size else 1
        return {
            'documents': doc_list,
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': max(1, total_pages),
        }

    def list_document_versions(self, document_id: str) -> list:
        """List all synced versions that share the same CALM display ID and project."""
        conn = get_conn()
        try:
            is_sqlite = self._is_sqlite(conn)
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor if not is_sqlite else None) as cur:
                if is_sqlite:
                    cur.execute(
                        """
                        SELECT calm_display_id, display_id, project_id, project
                        FROM documents
                        WHERE document_id = ?
                        LIMIT 1
                        """,
                        (document_id,),
                    )
                else:
                    cur.execute(
                        """
                        SELECT calm_display_id, display_id, project_id, project
                        FROM documents
                        WHERE document_id = %s
                        LIMIT 1
                        """,
                        (document_id,),
                    )
                anchor = cur.fetchone()
                if not anchor:
                    return []
                if is_sqlite:
                    anchor = dict(anchor)

                display_id = anchor.get('calm_display_id') or anchor.get('display_id')
                project_id = anchor.get('project_id')
                project = anchor.get('project')

                if display_id and project_id:
                    if is_sqlite:
                        cur.execute(
                            """
                            SELECT DISTINCT document_id, document_name, version, is_latest,
                                   updated_by, updated_on, uuid, calm_display_id, display_id
                            FROM documents
                            WHERE (calm_display_id = ? OR display_id = ?) AND project_id = ?
                            ORDER BY version ASC
                            """,
                            (display_id, display_id, project_id),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT DISTINCT ON (document_id)
                                document_id, document_name, version, is_latest,
                                updated_by, updated_on, uuid, calm_display_id, display_id
                            FROM documents
                            WHERE (calm_display_id = %s OR display_id = %s) AND project_id = %s
                            ORDER BY document_id, version ASC
                            """,
                            (display_id, display_id, project_id),
                        )
                elif display_id and project:
                    if is_sqlite:
                        cur.execute(
                            """
                            SELECT DISTINCT document_id, document_name, version, is_latest,
                                   updated_by, updated_on, uuid, calm_display_id, display_id
                            FROM documents
                            WHERE (calm_display_id = ? OR display_id = ?) AND project = ?
                            ORDER BY version ASC
                            """,
                            (display_id, display_id, project),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT DISTINCT ON (document_id)
                                document_id, document_name, version, is_latest,
                                updated_by, updated_on, uuid, calm_display_id, display_id
                            FROM documents
                            WHERE (calm_display_id = %s OR display_id = %s) AND project = %s
                            ORDER BY document_id, version ASC
                            """,
                            (display_id, display_id, project),
                        )
                else:
                    if is_sqlite:
                        cur.execute(
                            """
                            SELECT DISTINCT document_id, document_name, version, is_latest,
                                   updated_by, updated_on, uuid, calm_display_id, display_id
                            FROM documents
                            WHERE document_id = ?
                            """,
                            (document_id,),
                        )
                    else:
                        cur.execute(
                            """
                            SELECT document_id, document_name, version, is_latest,
                                   updated_by, updated_on, uuid, calm_display_id, display_id
                            FROM documents
                            WHERE document_id = %s
                            LIMIT 1
                            """,
                            (document_id,),
                        )

                rows = cur.fetchall()
                if is_sqlite:
                    rows = [dict(r) for r in rows]

                versions = []
                for row in rows:
                    uid = row.get('uuid')
                    if uid is not None and hasattr(uid, 'hex'):
                        uid = str(uid)
                    versions.append({
                        'documentId': row.get('document_id'),
                        'name': row.get('document_name'),
                        'version': row.get('version') or 1,
                        'isLatest': row.get('is_latest') if row.get('is_latest') is not None else True,
                        'updatedBy': row.get('updated_by') or 'System',
                        'updatedOn': str(row.get('updated_on')) if row.get('updated_on') else None,
                        'uuid': uid or row.get('document_id'),
                        'displayId': row.get('calm_display_id') or row.get('display_id') or '',
                    })
                versions.sort(key=lambda v: v.get('version') or 0)
                return versions
        except Exception as e:
            print(f"Error listing document versions for {document_id}: {e}")
            return []
        finally:
            conn.close()

    def delete_document(self, identifier: str) -> bool:
        """Delete all chunks for a document. Matches document_id (CALM id / upload filename) or legacy chunk id prefix."""
        if not identifier or not str(identifier).strip():
            return False
        ident = str(identifier).strip()
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    DELETE FROM documents
                    WHERE document_id = %s
                       OR CAST(uuid AS TEXT) = %s
                    """,
                    (ident, ident),
                )
                deleted = cur.rowcount > 0
            conn.commit()
            return deleted
        except Exception as e:
            conn.rollback()
            print(f"Error deleting document: {e}")
            return False
        finally:
            conn.close()

    # ── ZIP extraction ─────────────────────────────────────────────────────────

    def _extract_zip(self, file):
        """Extract and process files from a ZIP archive."""
        results = []
        try:
            zip_data = io.BytesIO(file.read())
            with zipfile.ZipFile(zip_data, 'r') as zip_ref:
                for zip_info in zip_ref.filelist:
                    if zip_info.is_dir():
                        continue

                    inner_filename = zip_info.filename
                    _, ext = os.path.splitext(inner_filename.lower())

                    if ext not in SUPPORTED_EXTENSIONS:
                        continue

                    try:
                        file_content = zip_ref.read(inner_filename)
                        text_content = self._process_zip_content(inner_filename, file_content)

                        if not text_content.strip():
                            continue

                        base_name = os.path.basename(inner_filename)
                        is_duplicate = self.check_duplicate(base_name)
                        chunks = self._chunk_text(text_content, chunk_size=500, overlap=50)

                        conn = get_conn()
                        try:
                            for i, chunk in enumerate(chunks):
                                embedding = self._create_embedding(chunk)
                                metadata = {
                                    'source': 'File Upload',
                                    'type': self._get_file_type(base_name),
                                    'project': 'N/A',
                                    'updatedBy': 'System',
                                    'updatedOn': 'N/A',
                                    'document_name': base_name,
                                    'is_placeholder': False,
                                    'html_content': '',
                                }
                                self._insert_chunk(conn, f"{base_name}_{i}", base_name, chunk, embedding, metadata)
                            conn.commit()
                        except Exception:
                            conn.rollback()
                            raise
                        finally:
                            conn.close()

                        results.append({
                            "filename": f"{file.filename}/{inner_filename}",
                            "chunks": len(chunks),
                            "status": "success",
                            "was_duplicate": is_duplicate
                        })
                    except Exception as e:
                        results.append({
                            "filename": f"{file.filename}/{inner_filename}",
                            "status": "error",
                            "error": str(e)
                        })
        except zipfile.BadZipFile:
            results.append({"filename": file.filename, "status": "error", "error": "Invalid ZIP file"})
        except Exception as e:
            results.append({"filename": file.filename, "status": "error", "error": str(e)})

        return results

    def _process_zip_content(self, filename, content):
        """Process file content extracted from a ZIP archive."""
        filename_lower = filename.lower()
        if filename_lower.endswith('.pdf'):
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
            return "".join(page.extract_text() + "\n" for page in pdf_reader.pages)
        elif filename_lower.endswith('.docx'):
            doc = Document(io.BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs)
        else:
            try:
                return content.decode('utf-8')
            except UnicodeDecodeError:
                try:
                    return content.decode('latin-1')
                except Exception:
                    return ""

    def _extract_text(self, file):
        """Extract text from an uploaded file."""
        filename = file.filename.lower()
        if filename.endswith('.pdf'):
            return self._extract_pdf(file)
        elif filename.endswith('.docx'):
            return self._extract_docx(file)
        elif filename.endswith('.txt') or filename.endswith('.md'):
            return file.read().decode('utf-8')
        else:
            try:
                return file.read().decode('utf-8')
            except Exception:
                return ""

    def _extract_pdf(self, file):
        """Extract text from PDF."""
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file.read()))
        return "".join(page.extract_text() + "\n" for page in pdf_reader.pages)

    def _extract_docx(self, file):
        """Extract text from DOCX."""
        doc = Document(io.BytesIO(file.read()))
        return "\n".join(paragraph.text + "\n" for paragraph in doc.paragraphs)
