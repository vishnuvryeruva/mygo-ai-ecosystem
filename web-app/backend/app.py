import os
import json
def _setup_database_url_from_vcap():
    vcap = os.environ.get('VCAP_SERVICES')
    if not vcap:
        return
    try:
        services = json.loads(vcap)
        # Try common service offering names for BTP Postgres
        pg_services = (
            services.get('postgresql-db')
            or services.get('postgresql')
            or services.get('hyperscaler-postgresql')
            or []
        )
        if not pg_services:
            return
        creds = pg_services[0].get('credentials', {})
        
        # Build URI from credentials
        if creds.get('uri'):
            db_url = creds['uri']
        else:
            db_url = (
                f"postgresql://{creds['username']}:{creds['password']}"
                f"@{creds['hostname']}:{creds['port']}/{creds['dbname']}"
            )
        
        # Normalize postgres:// to postgresql://
        if db_url.startswith('postgres://'):
            db_url = db_url.replace('postgres://', 'postgresql://', 1)
        
        # Add sslmode=require if missing
        if 'sslmode' not in db_url:
            sep = '&' if '?' in db_url else '?'
            db_url = f"{db_url}{sep}sslmode=require"
        
        os.environ['DATABASE_URL'] = db_url
        print(f"DEBUG: DATABASE_URL set from VCAP_SERVICES (host: {creds.get('hostname', 'unknown')})")
    except Exception as e:
        print(f"DEBUG: Failed to parse VCAP_SERVICES: {e}")

_setup_database_url_from_vcap()

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import io
import json
import uuid
import jwt
import bcrypt
import datetime
from functools import wraps
from typing import Optional
from dotenv import load_dotenv
import psycopg2
import psycopg2.extras
import psycopg2.errorcodes
import sqlite3
from db import get_conn, init_db
from services.openai_service import OpenAIService
from services.rag_service import RAGService
from services.spec_service import SpecService
from services.prompt_service import PromptService
from services.code_service import CodeService
from services.test_service import TestService
from services.advisor_service import AdvisorService
from services.code_repository_service import CodeRepositoryService
from services.btp_service import BTPService, BtpODataError
from services import role_service
from services import user_service
from services.github_service import GitHubService
from services.scope_service import ScopeService
from config.prompts import get_all_prompts, get_prompt, update_prompt
from config.sap_modules import normalize_module, taxonomy_payload

# Import MCP tools
from mcp_server import list_tools, execute_tool, TOOLS

# Load .env from backend directory explicitly
basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

# Debug API Key
api_key = os.getenv('OPENAI_API_KEY')
print(f"DEBUG: App startup - API Key length: {len(api_key) if api_key else 0}")
print(f"DEBUG: App startup - API Key start: {api_key[:8] if api_key else 'None'}")

# Startup Test
try:
    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    startup_model = os.getenv('OPENAI_MODEL', 'gpt-4.1')
    print(f"DEBUG: Startup - Attempting chat completion with {startup_model}...")
    client.chat.completions.create(
        model=startup_model,
        messages=[{"role": "user", "content": "Startup test"}]
    )
    print("DEBUG: Startup - Chat completion SUCCESS")
except Exception as e:
    print(f"DEBUG: Startup - Chat completion FAILED: {e}")

app = Flask(__name__)
CORS(app, supports_credentials=True)

JWT_SECRET = os.getenv('JWT_SECRET', 'mygo-yoda-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRY_DAYS = 7

# ── PostgreSQL user database (via db.py) ────────────────────────────────────
init_db()

# ── JWT helper ──────────────────────────────────────────────────────────────
def create_token(user_id: str, email: str) -> str:
    payload = {
        'sub': user_id,
        'email': email,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(days=JWT_EXPIRY_DAYS),
        'iat': datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str):
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]
        if not token:
            return jsonify({'error': 'Token missing'}), 401
        try:
            payload = decode_token(token)
            request.current_user = payload
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


def jwt_or_api_key_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')

        # Accept API key in either X-API-Key or Authorization: ApiKey <key>
        request_api_key = request.headers.get('X-API-Key', '')
        if not request_api_key and auth_header.startswith('ApiKey '):
            request_api_key = auth_header.split(' ', 1)[1]

        expected_api_key = os.getenv('SECURE_API_KEY', '')
        if expected_api_key and request_api_key and request_api_key == expected_api_key:
            return f(*args, **kwargs)

        token = None
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]

        # Self-healing dev fallback: if JWT_SECRET is default, DATABASE_URL is missing, or running on localhost/127.0.0.1
        host = request.headers.get('Host', '') or request.host or ''
        is_dev = (
            'localhost' in host or 
            '127.0.0.1' in host or 
            os.getenv('JWT_SECRET', 'mygo-yoda-secret-key-change-in-production') == 'mygo-yoda-secret-key-change-in-production' or 
            not os.getenv('DATABASE_URL')
        )

        if not token:
            if is_dev:
                print("JWT_AUTH_DEBUG: Token missing in headers. Falling back to Mock Guest User in development.")
                request.current_user = {'sub': 'guest-user-id', 'email': 'guest@example.com'}
                return f(*args, **kwargs)
            print("JWT_AUTH_DEBUG: Token or API key missing in headers")
            return jsonify({'error': 'Token or API key missing'}), 401
        try:
            payload = decode_token(token)
            request.current_user = payload
        except jwt.ExpiredSignatureError:
            if is_dev:
                print("JWT_AUTH_DEBUG: Token expired. Falling back to Mock Guest User in development.")
                request.current_user = {'sub': 'guest-user-id', 'email': 'guest@example.com'}
                return f(*args, **kwargs)
            print("JWT_AUTH_DEBUG: Token expired")
            return jsonify({'error': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            if is_dev:
                print("JWT_AUTH_DEBUG: Invalid token. Falling back to Mock Guest User in development.")
                request.current_user = {'sub': 'guest-user-id', 'email': 'guest@example.com'}
                return f(*args, **kwargs)
            print("JWT_AUTH_DEBUG: Invalid token")
            return jsonify({'error': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


def get_optional_current_user_id():
    """Read user ID from bearer token if provided; otherwise return None."""
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    token = auth_header.split(' ', 1)[1]
    try:
        payload = decode_token(token)
        return payload.get('sub')
    except Exception:
        return None


def get_llm_provider_for_user(user_id: Optional[str], agent_id: Optional[str] = None):
    """Resolve user's preferred LLM provider, optionally for a specific agent."""
    if not user_id:
        return 'openai'
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT llm_provider, agent_providers FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    if not row:
        return 'openai'
    try:
        default_provider = (row.get('llm_provider') or 'openai').lower()
    except Exception:
        default_provider = 'openai'
    if agent_id:
        try:
            agent_providers = json.loads(row.get('agent_providers') or '{}')
            agent_specific = agent_providers.get(agent_id, '').lower()
            if agent_specific in ('openai', 'claude', 'gemini', 'ai_core'):
                print(f"LLM_PREF: user_id={user_id} agent={agent_id} provider={agent_specific} (agent-specific)")
                return agent_specific
        except Exception:
            pass
    print(f"LLM_PREF: user_id={user_id or 'anonymous'} provider={default_provider}")
    return default_provider

# Initialize services
openai_service = OpenAIService()
rag_service = RAGService()
spec_service = SpecService()
prompt_service = PromptService()
code_service = CodeService()
test_service = TestService()
advisor_service = AdvisorService()
scope_service = ScopeService()

@app.before_request
def log_request_info():
    print(f"DEBUG: Incoming Request: {request.method} {request.url}")
    if request.is_json:
        print(f"DEBUG: Request Body: {request.json}")


@app.route('/api/health', methods=['GET'])
def health():
    """Diagnostic endpoint — shows DB type, doc count, and env var presence."""
    from db import DATABASE_URL, SQLiteConnectionProxy
    import sqlite3 as _sqlite3

    # Test DB connection and identify type
    db_type = 'unknown'
    db_url_hint = ''
    doc_count = 0
    db_error = None
    try:
        conn = get_conn()
        is_sqlite = isinstance(conn, SQLiteConnectionProxy) or isinstance(conn, _sqlite3.Connection)
        db_type = 'sqlite (FALLBACK — PostgreSQL unreachable)' if is_sqlite else 'postgresql'
        if not is_sqlite:
            # Show sanitised URL (hide password)
            import re as _re
            db_url_hint = _re.sub(r':([^@]+)@', ':***@', DATABASE_URL)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM documents")
            row = cur.fetchone()
            doc_count = row[0] if row else 0
        conn.close()
    except Exception as e:
        db_error = str(e)

    return jsonify({
        "status": "ok",
        "db_type": db_type,
        "db_url": db_url_hint,
        "document_count": doc_count,
        "db_error": db_error,
        "env": {
            "DATABASE_URL_set": bool(os.getenv("DATABASE_URL")),
            "OPENAI_API_KEY_set": bool(os.getenv("OPENAI_API_KEY")),
            "NEXT_PUBLIC_BACKEND_URL": os.getenv("NEXT_PUBLIC_BACKEND_URL", "not set"),
            "PORT": os.getenv("PORT", "5000 (default)"),
        }
    })

# ── Auth endpoints ──────────────────────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = (data.get('name') or '').strip()
    email = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '')

    if not name or not email or not password:
        return jsonify({'error': 'Name, email and password are required'}), 400

    password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user_id = str(uuid.uuid4())
    created_at = datetime.datetime.utcnow().isoformat()
    
    # Default role for new signups
    role = 'Viewer'

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'INSERT INTO users (id, name, email, password_hash, role, llm_provider, created_at) VALUES (%s, %s, %s, %s, %s, %s, %s)',
                (user_id, name, email, password_hash, role, 'openai', created_at)
            )
        conn.commit()
    except (psycopg2.errors.UniqueViolation, sqlite3.IntegrityError):
        conn.rollback()
        return jsonify({'error': 'An account with this email already exists'}), 409
    finally:
        conn.close()

    token = create_token(user_id, email)
    return jsonify({
        'token': token,
        'user': {'id': user_id, 'name': name, 'email': email, 'role': role, 'llm_provider': 'openai'}
    }), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json or {}
    email = (data.get('email') or '').strip().lower()
    password = data.get('password') or ''

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('SELECT id, name, email, password_hash, role, llm_provider FROM users WHERE lower(email) = %s', (email,))
            user = cur.fetchone()
    finally:
        conn.close()

    if not user or not bcrypt.checkpw(password.encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = create_token(user['id'], user['email'])
    return jsonify({
        'token': token,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'role': user.get('role') or 'Viewer',
            'llm_provider': user['llm_provider'] if 'llm_provider' in user and user['llm_provider'] else 'openai'
        }
    }), 200


@app.route('/api/auth/me', methods=['GET'])
@token_required
def me():
    payload = request.current_user
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('SELECT id, name, email, role, llm_provider, api_keys, agent_providers, created_at FROM users WHERE id = %s', (payload['sub'],))
            row = cur.fetchone()
    finally:
        conn.close()
    if not row:
        return jsonify({'error': 'User not found'}), 404

    # Parse JSON columns; mask stored API key values (show last 4 chars only)
    try:
        raw_keys = json.loads(row.get('api_keys') or '{}')
    except Exception:
        raw_keys = {}
    masked_keys = {k: ('•••••••••••' + v[-4:] if v and len(v) > 4 else '') for k, v in raw_keys.items()}

    try:
        agent_providers = json.loads(row.get('agent_providers') or '{}')
    except Exception:
        agent_providers = {}

    return jsonify({
        'id': row['id'],
        'name': row['name'],
        'email': row['email'],
        'role': row['role'] or 'Viewer',
        'llm_provider': row['llm_provider'] if row.get('llm_provider') else 'openai',
        'api_keys': masked_keys,
        'agent_providers': agent_providers,
        'created_at': row['created_at']
    })


@app.route('/api/auth/preferences', methods=['PUT'])
@token_required
def update_user_preferences():
    data = request.get_json() or {}
    allowed_providers = {'openai', 'claude', 'gemini', 'ai_core'}

    llm_provider = (data.get('llm_provider') or '').strip().lower()
    if llm_provider not in allowed_providers:
        return jsonify({'error': 'llm_provider must be one of: openai, claude, gemini, ai_core'}), 400

    # Validate and sanitise agent_providers map
    raw_agent_providers = data.get('agent_providers') or {}
    agent_providers = {
        k: v for k, v in raw_agent_providers.items()
        if isinstance(k, str) and isinstance(v, str) and v in allowed_providers
    }

    # Merge incoming api_keys with the existing stored ones so that a masked
    # placeholder value (sent back by /me) does NOT overwrite the real key.
    user_id = request.current_user['sub']
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT api_keys FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
        stored_keys = json.loads((row or {}).get('api_keys') or '{}')
    except Exception:
        stored_keys = {}
    finally:
        conn.close()

    incoming_keys = data.get('api_keys') or {}
    for provider in ('openai', 'claude', 'gemini'):
        val = incoming_keys.get(provider, '')
        if val and not val.startswith('•'):  # real key, not masked placeholder
            stored_keys[provider] = val.strip()

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET llm_provider = %s, api_keys = %s, agent_providers = %s WHERE id = %s",
                (llm_provider, json.dumps(stored_keys), json.dumps(agent_providers), user_id)
            )
        conn.commit()
    finally:
        conn.close()

    return jsonify({'message': 'Preferences updated successfully', 'llm_provider': llm_provider})

def _log_ai_core_diagnostics(llm_provider: str, agent_id: str = 'ask-yoda'):
    """Console diagnostics for SAP AI Core env credentials (ask-yoda and similar)."""
    if llm_provider != 'ai_core':
        return
    try:
        from services.ai_core_service import AICoreService
        svc = AICoreService()
        status = svc.config_status()
        print(f"ASK_YODA_AI_CORE: agent={agent_id} provider=ai_core config={status}")
        verify = svc.verify_connection()
        if verify.get('ok'):
            print(
                f"ASK_YODA_AI_CORE: connection_ok deployment_id={verify.get('deployment_id')} "
                f"model={status.get('model')}"
            )
        else:
            print(f"ASK_YODA_AI_CORE: connection_failed error={verify.get('error')}")
    except Exception as exc:
        print(f"ASK_YODA_AI_CORE: diagnostic_error={exc}")


# Ask Yoda - RAG-based Q&A
@app.route('/api/ask-yoda', methods=['POST'])
def ask_yoda():
    try:
        user_id = get_optional_current_user_id()
        llm_provider = get_llm_provider_for_user(user_id, agent_id='ask-yoda')
        print(f"ASK_YODA: user_id={user_id or 'anonymous'} llm_provider={llm_provider}")
        _log_ai_core_diagnostics(llm_provider, agent_id='ask-yoda')

        data = request.json
        query = data.get('query', '')
        
        if not query:
            return jsonify({"error": "Query is required"}), 400
        
        # Use RAG to get relevant context and generate answer
        result = rag_service.query(query, llm_provider=llm_provider)
        if llm_provider == 'ai_core':
            print(f"ASK_YODA_AI_CORE: query_completed answer_length={len(result.get('answer') or '')}")
        
        return jsonify({
            "answer": result["answer"],
            "references": result.get("references", []),
            "query": query
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Upload documents for RAG
@app.route('/api/upload-documents', methods=['POST'])
def upload_documents():
    try:
        if 'files' not in request.files:
            return jsonify({"error": "No files provided"}), 400
        
        files = request.files.getlist('files')
        results = rag_service.ingest_documents(files)
        
        return jsonify({
            "message": "Documents uploaded successfully",
            "results": results
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload-text-document', methods=['POST'])
def upload_text_document():
    """Upload text content to Document Hub (DMS / knowledge base)."""
    try:
        data = request.json or {}
        name = data.get('name')
        content = data.get('content')
        doc_type = data.get('documentType', 'Document')
        source = data.get('source', 'DMS Upload')
        project = data.get('project', 'N/A')

        if not name or not content:
            return jsonify({'error': 'name and content are required'}), 400

        result = rag_service.ingest_text_document(
            name=name,
            content=content,
            doc_type=doc_type,
            source=source,
            project=project,
        )

        return jsonify({
            'message': 'Document uploaded to DMS successfully',
            'document': result,
        })
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# List documents
@app.route('/api/documents', methods=['GET'])
def list_documents():
    try:
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 10))
        search = request.args.get('search', '').strip()
        source = request.args.get('source', '').strip()
        doc_type = request.args.get('type', '').strip()
        project = request.args.get('project', '').strip()
        module = request.args.get('module', '').strip()
        date_from = request.args.get('date_from', '').strip()
        date_to = request.args.get('date_to', '').strip()
        latest_only = request.args.get('latest_only', 'true').lower() != 'false'

        if module and not normalize_module(module):
            return jsonify({"error": f"Unknown SAP module '{module}'"}), 400

        result = rag_service.list_documents(
            page=page,
            page_size=page_size,
            search=search,
            source=source,
            doc_type=doc_type,
            project=project,
            module=module,
            date_from=date_from,
            date_to=date_to,
            latest_only=latest_only,
        )
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/dashboard/stats', methods=['GET'])
def dashboard_stats():
    """Document analytics for the dashboard (optionally filtered by project/module)."""
    try:
        project = request.args.get('project', '').strip()
        module = request.args.get('module', '').strip()
        latest_only = request.args.get('latest_only', 'true').lower() != 'false'

        if module and not normalize_module(module):
            return jsonify({"error": f"Unknown SAP module '{module}'"}), 400

        result = rag_service.get_document_stats(
            project=project, module=module, latest_only=latest_only
        )
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/matrix', methods=['POST'])
def matrix_agent():
    """Natural-language document analytics and project-vs-project comparison."""
    try:
        from agents import matrix_agent as matrix_agent_mod

        data = request.json or {}
        query = (data.get('query') or '').strip()
        if not query:
            return jsonify({"error": "Query is required"}), 400

        user_id = get_optional_current_user_id()
        llm_provider = get_llm_provider_for_user(user_id, agent_id='matrix')
        result = matrix_agent_mod.handle_query(query, rag_service, llm_provider=llm_provider)
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/sap-modules', methods=['GET'])
def list_sap_modules():
    """The module taxonomy, so the frontend never hardcodes the enum."""
    return jsonify({'modules': taxonomy_payload()})


@app.route('/api/documents/<path:document_id>/module', methods=['PUT'])
def set_document_module(document_id):
    """Override a document's SAP module. Marks it manual so ingest won't undo it."""
    try:
        data = request.json or {}
        module = (data.get('module') or '').strip()
        if not module:
            return jsonify({"error": "module is required"}), 400

        updated = rag_service.set_document_module(document_id, module)
        if not updated:
            return jsonify({"error": f"Document {document_id} not found"}), 404

        return jsonify({
            "message": "Module updated",
            "documentId": document_id,
            "sapModule": normalize_module(module),
            "sapModuleMethod": "manual",
        })
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/scopes', methods=['GET'])
def list_cached_scopes():
    """Cached CALM scopes and their module mapping. Unmapped ones need triage."""
    try:
        project_id = request.args.get('projectId', '').strip()
        return jsonify({'scopes': scope_service.list_scopes(project_id)})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/scopes/<path:scope_id>/module', methods=['PUT'])
def set_scope_module(scope_id):
    """Curate a scope's module mapping. Survives later syncs."""
    try:
        data = request.json or {}
        module = (data.get('module') or '').strip()
        if not module:
            return jsonify({"error": "module is required"}), 400

        updated = scope_service.set_scope_module(scope_id, module)
        if not updated:
            return jsonify({"error": f"Scope {scope_id} not found"}), 404

        return jsonify({"message": "Scope module updated", "scopeId": scope_id,
                        "sapModule": normalize_module(module)})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Delete document
@app.route('/api/documents/<path:filename>', methods=['DELETE'])
def delete_document(filename):
    try:
        success = rag_service.delete_document(filename)
        if success:
            return jsonify({"message": f"Document {filename} deleted successfully"})
        else:
            return jsonify({"error": f"Document {filename} not found"}), 404
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Spec Assistant
@app.route('/api/generate-spec', methods=['POST'])
def generate_spec():
    try:
        llm_provider = get_llm_provider_for_user(get_optional_current_user_id())
        data = request.json
        spec_type = data.get('type', 'functional')  # functional or technical
        requirements = data.get('requirements', '')
        format_type = data.get('format', 'docx')  # docx, pdf, or preview
        
        # For preview, return raw text for inline display
        if format_type == 'preview':
            spec_content = spec_service.generate_spec(spec_type, requirements, 'text', llm_provider=llm_provider)
            return jsonify({
                "spec": spec_content,
                "type": spec_type,
                "format": "preview"
            })
        
        spec_doc = spec_service.generate_spec(spec_type, requirements, format_type, llm_provider=llm_provider)
        
        # For docx, return as downloadable file
        if format_type == 'docx':
            return send_file(
                io.BytesIO(spec_doc),
                mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                as_attachment=True,
                download_name=f'{spec_type}_specification.docx'
            )
        else:
            return jsonify({
                "message": "Specification generated successfully",
                "spec": spec_doc,
                "format": format_type
            })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Prompt Generator
@app.route('/api/generate-prompt', methods=['POST'])
@jwt_or_api_key_required
def generate_prompt():
    try:
        llm_provider = get_llm_provider_for_user(get_optional_current_user_id())
        data = request.json
        language = data.get('language', 'ABAP')
        task_description = data.get('task', '')
        context = data.get('context', '')
        
        prompt = prompt_service.generate_prompt(language, task_description, context, llm_provider=llm_provider)
        
        return jsonify({
            "prompt": prompt,
            "language": language
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Code Generator (from optimized prompt)
@app.route('/api/generate-code', methods=['POST'])
def generate_code_from_prompt():
    try:
        llm_provider = get_llm_provider_for_user(get_optional_current_user_id())
        data = request.json
        language = data.get('language', 'ABAP')
        prompt = data.get('prompt', '')
        context = data.get('context', '')
        
        if not prompt:
            return jsonify({"error": "Prompt is required"}), 400
        
        result = prompt_service.generate_code(language, prompt, context, llm_provider=llm_provider)
        
        return jsonify({
            "code": result['code'],
            "explanation": result['explanation'],
            "language": result['language']
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Explain Code
@app.route('/api/explain-code', methods=['POST'])
def explain_code():
    try:
        llm_provider = get_llm_provider_for_user(get_optional_current_user_id())
        data = request.json
        code = data.get('code', '')
        code_type = data.get('code_type', 'ABAP')  # ABAP, Python, etc.
        program_name = data.get('program_name', '')
        
        explanation = code_service.explain_code(code, code_type, program_name, llm_provider=llm_provider)
        
        return jsonify({
            "explanation": explanation,
            "code_type": code_type
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Test Case Generator
@app.route('/api/generate-test-cases', methods=['POST'])
def generate_test_cases():
    try:
        llm_provider = get_llm_provider_for_user(get_optional_current_user_id())
        data = request.json
        code = data.get('code', '')
        test_type = data.get('test_type', 'manual')  # manual or unit
        format_type = data.get('format', 'excel')  # excel, word, jira, preview, calm
        
        # For preview, return raw text for inline display
        if format_type == 'preview':
            test_content = test_service.generate_test_cases(code, test_type, 'text', llm_provider=llm_provider)
            return jsonify({
                "test_cases": test_content,
                "test_type": test_type,
                "format": "preview"
            })
        
        # For CALM format, return structured JSON
        if format_type == 'calm':
            test_cases = test_service.generate_test_cases(code, test_type, 'calm', llm_provider=llm_provider)
            return jsonify({
                "test_cases": test_cases,
                "test_type": test_type,
                "format": "calm"
            })
        
        test_cases = test_service.generate_test_cases(code, test_type, format_type, llm_provider=llm_provider)
        
        # For excel/word, return as downloadable file
        if format_type == 'excel':
            return send_file(
                io.BytesIO(test_cases),
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                as_attachment=True,
                download_name='test_cases.xlsx'
            )
        elif format_type == 'word':
            return send_file(
                io.BytesIO(test_cases),
                mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                as_attachment=True,
                download_name='test_cases.docx'
            )
        else:
            return jsonify({
                "test_cases": test_cases,
                "test_type": test_type,
                "format": format_type
            })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Code Advisor
@app.route('/api/analyze-code', methods=['POST'])
def analyze_code():
    try:
        llm_provider = get_llm_provider_for_user(get_optional_current_user_id())
        data = request.json
        code = data.get('code', '')
        code_type = data.get('code_type', 'ABAP')
        
        analysis = advisor_service.analyze_code(code, code_type, llm_provider=llm_provider)
        
        return jsonify({
            "suggestions": analysis['suggestions'],
            "anti_patterns": analysis['anti_patterns'],
            "improvements": analysis['improvements']
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================================
# Solution Advisor Endpoints
# Multi-step conversational advisor for requirements gathering and solution design
# ============================================================================

from agents import solution_advisor

@app.route('/api/solution-advisor/requirements', methods=['POST'])
def solution_advisor_requirements():
    """Step 1: Gather and clarify requirements"""
    try:
        data = request.json
        requirements = data.get('requirements', '')
        
        llm_provider = get_llm_provider_for_user(get_optional_current_user_id())
        result = solution_advisor.gather_requirements(requirements, llm_provider=llm_provider)
        
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/solution-advisor/generate', methods=['POST'])
def solution_advisor_generate():
    """Step 2: Generate solution proposal"""
    try:
        data = request.json
        requirements = data.get('requirements', '')
        
        llm_provider = get_llm_provider_for_user(get_optional_current_user_id())
        result = solution_advisor.generate_solution(requirements, llm_provider=llm_provider)
        
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/solution-advisor/refine', methods=['POST'])
def solution_advisor_refine():
    """Refine solution based on user feedback"""
    try:
        data = request.json
        requirements = data.get('requirements', '')
        current_solution = data.get('current_solution', '')
        feedback = data.get('feedback', '')
        
        llm_provider = get_llm_provider_for_user(get_optional_current_user_id())
        result = solution_advisor.refine_solution(requirements, current_solution, feedback, llm_provider=llm_provider)
        
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/solution-advisor/search-similar', methods=['POST'])
def solution_advisor_search_similar():
    """Step 3: Search for similar solutions in knowledge base"""
    try:
        data = request.json
        solution_summary = data.get('solution_summary', '')
        
        llm_provider = get_llm_provider_for_user(get_optional_current_user_id())
        result = solution_advisor.search_similar_solutions(solution_summary, rag_service, llm_provider=llm_provider)
        
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/solution-advisor/improvise', methods=['POST'])
def solution_advisor_improvise():
    """Step 4: Improvise solution with insights from similar solutions"""
    try:
        data = request.json
        requirements = data.get('requirements', '')
        current_solution = data.get('current_solution', '')
        similar_solutions = data.get('similar_solutions', [])
        user_input = data.get('user_input', '')
        
        llm_provider = get_llm_provider_for_user(get_optional_current_user_id())
        result = solution_advisor.improvise_solution(
            requirements, current_solution, similar_solutions, user_input, llm_provider=llm_provider
        )
        
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# Prompt Management
@app.route('/api/prompts', methods=['GET'])
def get_prompts():
    """Get all prompt configurations"""
    try:
        prompts = get_all_prompts()
        return jsonify({"prompts": prompts})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/prompts/<scenario>', methods=['GET'])
def get_scenario_prompt(scenario):
    """Get prompt for a specific scenario"""
    try:
        prompt_data = get_all_prompts().get(scenario)
        if prompt_data:
            return jsonify(prompt_data)
        else:
            return jsonify({"error": "Scenario not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/prompts/<scenario>', methods=['PUT'])
def update_scenario_prompt(scenario):
    """Update prompt for a specific scenario"""
    try:
        data = request.json
        prompt_type = data.get('prompt_type', 'system')  # 'system' or 'user_template'
        new_prompt = data.get('prompt', '')
        
        success = update_prompt(scenario, prompt_type, new_prompt)
        if success:
            return jsonify({"message": "Prompt updated successfully"})
        else:
            return jsonify({"error": "Scenario not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Document Duplicate Check
@app.route('/api/check-duplicate/<filename>', methods=['GET'])
def check_duplicate(filename):
    """Check if a document already exists"""
    try:
        is_duplicate = rag_service.check_duplicate(filename)
        return jsonify({"is_duplicate": is_duplicate, "filename": filename})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================================
# MCP (Model Context Protocol) Endpoints
# These endpoints allow any HTTP client to call MCP tools
# ============================================================================

@app.route('/mcp/tools', methods=['GET'])
def mcp_list_tools():
    """List all available MCP tools with their schemas"""
    try:
        tools = list_tools()
        return jsonify({
            "tools": tools,
            "count": len(tools),
            "server": "ABAP AI Ecosystem MCP Server"
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/mcp/tools/<tool_name>', methods=['GET'])
def mcp_get_tool(tool_name):
    """Get schema for a specific MCP tool"""
    try:
        if tool_name in TOOLS:
            return jsonify(TOOLS[tool_name]["schema"])
        else:
            return jsonify({
                "error": f"Tool '{tool_name}' not found",
                "available": list(TOOLS.keys())
            }), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/mcp/execute', methods=['POST'])
def mcp_execute_tool():
    """
    Execute an MCP tool
    
    Request body:
    {
        "tool": "explain_code",
        "inputs": {
            "code": "...",
            "language": "ABAP"
        }
    }
    """
    try:
        data = request.json
        tool_name = data.get('tool')
        inputs = data.get('inputs', {})
        
        if not tool_name:
            return jsonify({
                "error": "Missing 'tool' parameter",
                "available": list(TOOLS.keys())
            }), 400
        
        print(f"MCP Execute: tool={tool_name}, inputs={list(inputs.keys())}")
        
        result = execute_tool(tool_name, inputs)
        
        return jsonify({
            "tool": tool_name,
            "result": result,
            "success": True
        })
    except ValueError as e:
        return jsonify({"error": str(e), "success": False}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e), "success": False}), 500


@app.route('/mcp/health', methods=['GET'])
def mcp_health():
    """Health check for MCP server"""
    return jsonify({
        "status": "ok",
        "server": "ABAP AI Ecosystem MCP Server",
        "tools_available": len(TOOLS),
        "tools": list(TOOLS.keys())
    })


# ============================================================================
# Source Configuration Endpoints
# ============================================================================

from services import source_config_service
from services.calm_service import get_calm_service
from services.markdown_utils import markdown_to_html
from html import unescape
import re


def _normalize_document_html_for_view(raw_content: str) -> str:
    """
    Normalize raw document content into renderable HTML for the UI viewer.
    Handles escaped HTML, markdown, and plain text.
    """
    if not raw_content:
        return ""

    # Some CALM responses return escaped HTML entities.
    unescaped = unescape(str(raw_content)).strip()
    if not unescaped:
        return ""

    # If content already looks like HTML, return as-is.
    has_html_tags = bool(re.search(r'<\s*(p|h[1-6]|ul|ol|li|div|br|pre|table|span|strong|em)\b', unescaped, re.IGNORECASE))
    if has_html_tags:
        return unescaped

    # Fallback: convert markdown/plain text to semantic HTML.
    return markdown_to_html(unescaped)

@app.route('/api/sources', methods=['GET'])
def list_sources():
    """List all configured sources"""
    try:
        sources = source_config_service.list_sources()
        return jsonify({"sources": sources})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/sources', methods=['POST'])
def create_source():
    """Create a new source configuration"""
    try:
        data = request.json
        source = source_config_service.create_source(data)
        return jsonify({"source": source, "message": "Source created successfully"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/sources/<source_id>', methods=['GET'])
def get_source(source_id):
    """Get a specific source"""
    try:
        source = source_config_service.get_source(source_id)
        if source:
            return jsonify(source)
        return jsonify({"error": "Source not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/sources/<source_id>', methods=['PUT'])
def update_source(source_id):
    """Update a source configuration"""
    try:
        data = request.json
        source = source_config_service.update_source(source_id, data)
        if source:
            return jsonify({"source": source, "message": "Source updated successfully"})
        return jsonify({"error": "Source not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/sources/<source_id>', methods=['DELETE'])
def delete_source(source_id):
    """Delete a source configuration"""
    try:
        success = source_config_service.delete_source(source_id)
        if success:
            return jsonify({"message": "Source deleted successfully"})
        return jsonify({"error": "Source not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/sources/<source_id>/test', methods=['POST'])
def test_source_connection(source_id):
    """Test connection for a source"""
    try:
        result = source_config_service.test_connection(source_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/sources/test-connection', methods=['POST'])
def test_new_connection():
    """Test connection with provided credentials (before saving)"""
    try:
        data = request.json
        from services.calm_service import CALMService
        from services.btp_service import BTPService, BtpODataError
        
        if data.get('type') == 'CALM':
            # Validate required fields
            api_endpoint = data.get('apiEndpoint', '').strip()
            token_url = data.get('tokenUrl', '').strip()
            client_id = data.get('clientId', '').strip()
            client_secret = data.get('clientSecret', '').strip()
            
            if not all([api_endpoint, token_url, client_id, client_secret]):
                return jsonify({"success": False, "error": "All fields are required"})
            
            # Create service with explicit config (no env fallback for testing)
            service = CALMService({
                'apiEndpoint': api_endpoint,
                'tokenUrl': token_url,
                'clientId': client_id,
                'clientSecret': client_secret
            }, use_env_fallback=False)
            
            # Test connection - will raise exception if it fails
            service.test_connection()
            return jsonify({"success": True, "message": "Connection successful"})
            
        elif data.get('type') == 'BTP':
            api_endpoint = data.get('apiEndpoint', '').strip()
            token_url = data.get('tokenUrl', '').strip()
            client_id = data.get('clientId', '').strip()
            client_secret = data.get('clientSecret', '').strip()
            auth_type = data.get('authType', '').strip()
            
            if not all([api_endpoint, token_url, client_id, client_secret]):
                return jsonify({"success": False, "error": "All fields are required including Token URL"})
                
            service = BTPService({
                'apiEndpoint': api_endpoint,
                'tokenUrl': token_url,
                'clientId': client_id,
                'clientSecret': client_secret,
                'authType': auth_type
            }, use_env_fallback=False)
            
            service.test_connection()
            return jsonify({"success": True, "message": "Connection successful"})
        
        return jsonify({"success": False, "error": "Unsupported source type"})
    except Exception as e:
        error_msg = str(e)
        # Provide more specific error messages
        if "credentials not configured" in error_msg.lower():
            error_msg = "Invalid credentials provided"
        elif "connection" in error_msg.lower() or "timeout" in error_msg.lower():
            error_msg = "Unable to connect to the endpoint"
        elif "401" in error_msg or "unauthorized" in error_msg.lower():
            error_msg = "Authentication failed - invalid credentials"
        elif "404" in error_msg or "not found" in error_msg.lower():
            error_msg = "Endpoint not found - check the URL"
        
        return jsonify({"success": False, "error": error_msg}), 500


# ============================================================================
# Role Management Endpoints
# ============================================================================

@app.route('/api/roles', methods=['GET'])
def list_roles():
    """List all roles"""
    try:
        roles = role_service.list_roles()
        return jsonify({"roles": roles})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/roles', methods=['POST'])
def create_role():
    """Create a new role"""
    try:
        data = request.json
        role = role_service.create_role(data)
        return jsonify({"role": role, "message": "Role created successfully"})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

    
@app.route('/api/roles/<role_id>', methods=['GET'])
def get_role(role_id):
    """Get a specific role"""
    try:
        role = role_service.get_role(role_id)
        if role:
            return jsonify(role)
        return jsonify({"error": "Role not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/roles/<role_id>', methods=['PUT'])
def update_role(role_id):
    """Update a role"""
    try:
        data = request.json
        role = role_service.update_role(role_id, data)
        if role:
            return jsonify({"role": role, "message": "Role updated successfully"})
        return jsonify({"error": "Role not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/roles/<role_id>', methods=['DELETE'])
def delete_role(role_id):
    """Delete a role"""
    try:
        success = role_service.delete_role(role_id)
        if success:
            return jsonify({"message": "Role deleted successfully"})
        return jsonify({"error": "Role not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================================
# User Management Endpoints (Admin only)
# ============================================================================

def admin_required(f):
    """Decorator to require admin role"""
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        user_id = request.current_user['sub']
        user = user_service.get_user_by_id(user_id)
        if not user or user['role'] != 'Admin':
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated


@app.route('/api/users', methods=['GET'])
@admin_required
def list_users():
    """List users created by current admin (Admin only)"""
    try:
        current_user_id = request.current_user['sub']
        users = user_service.list_users(created_by=current_user_id)
        return jsonify({"users": users})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/users', methods=['POST'])
@admin_required
def create_user():
    """Create a new user (Admin only)"""
    try:
        data = request.json
        name = data.get('name', '').strip()
        email = data.get('email', '').strip()
        password = data.get('password', '')
        role = data.get('role', 'Viewer')
        
        if not name or not email or not password:
            return jsonify({"error": "Name, email, and password are required"}), 400
        
        # Set the current admin as the creator
        current_user_id = request.current_user['sub']
        user = user_service.create_user(name, email, password, role, created_by=current_user_id)
        return jsonify({"user": user, "message": "User created successfully"})
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>', methods=['PUT'])
@admin_required
def update_user(user_id):
    """Update a user (Admin only)"""
    try:
        data = request.json
        name = data.get('name')
        role = data.get('role')
        
        user = user_service.update_user(user_id, name, role)
        if user:
            return jsonify({"user": user, "message": "User updated successfully"})
        return jsonify({"error": "User not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/users/<user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    """Delete a user (Admin only)"""
    try:
        current_user_id = request.current_user['sub']
        
        # Get the user to be deleted
        user_to_delete = user_service.get_user_by_id(user_id)
        
        if not user_to_delete:
            return jsonify({"error": "User not found"}), 404
        
        # Prevent admin from deleting themselves
        if user_id == current_user_id:
            return jsonify({"error": "You cannot delete your own account"}), 400
        
        # Prevent deleting Admin users
        if user_to_delete['role'] == 'Admin':
            return jsonify({"error": "Cannot delete Admin users"}), 403
        
        # Verify the user was created by the current admin
        if user_to_delete.get('created_by') != current_user_id:
            return jsonify({"error": "You can only delete users you created"}), 403
        
        success = user_service.delete_user(user_id)
        if success:
            return jsonify({"message": "User deleted successfully"})
        return jsonify({"error": "User not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ============================================================================
# Cloud ALM Browser Endpoints
# ============================================================================

@app.route('/api/calm/<source_id>/projects', methods=['GET'])
def calm_list_projects(source_id):
    """List projects from Cloud ALM"""
    try:
        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404
        
        service = get_calm_service(source.get('config'))
        result = service.list_projects()  # Returns {projects, isDemo, error?}
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/calm/<source_id>/scopes', methods=['GET'])
def calm_list_scopes(source_id):
    """List scopes for a project"""
    try:
        project_id = request.args.get('projectId')
        if not project_id:
            return jsonify({"error": "projectId is required"}), 400
        
        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404
        
        service = get_calm_service(source.get('config'))
        scopes = service.list_scopes(project_id)

        # Cache them so the classifier's deterministic layer has something to map
        # against. Best-effort: a cache miss degrades classification, not this call.
        try:
            scope_service.sync_scopes(project_id, scopes)
        except Exception as e:
            print(f"WARNING: scope cache sync failed for project {project_id}: {e}")

        return jsonify({"scopes": scopes})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/calm/<source_id>/solution-processes', methods=['GET'])
def calm_list_solution_processes(source_id):
    """List solution processes for a scope"""
    try:
        scope_id = request.args.get('scopeId')
        if not scope_id:
            return jsonify({"error": "scopeId is required"}), 400
        
        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404
        
        service = get_calm_service(source.get('config'))
        processes = service.list_solution_processes(scope_id)
        return jsonify({"processes": processes})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/calm/<source_id>/documents', methods=['GET'])
def calm_list_documents(source_id):
    """List documents and test cases from Cloud ALM"""
    try:
        process_id = request.args.get('processId')
        doc_type = request.args.get('type')
        project_id = request.args.get('projectId')
        scope_id = request.args.get('scopeId')
        include_test_cases = request.args.get('includeTestCases', 'false').lower() == 'true'
        latest_only = request.args.get('latestOnly', 'true').lower() != 'false'
        
        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404
        
        service = get_calm_service(source.get('config'))
        
        # Fetch documents
        result = service.list_documents(  # Returns {documents, isDemo, error?}
            process_id=process_id,
            document_type=doc_type,
            project_id=project_id,
            latest_only=latest_only,
        )
        
        # Fetch test cases if requested
        test_cases = []
        if include_test_cases and project_id:
            print(f"DEBUG: Fetching test cases for project_id={project_id}, scope_id={scope_id}")
            try:
                test_cases = service.list_manual_test_cases(
                    project_id=project_id,
                    scope_id=scope_id
                )
                print(f"DEBUG: Fetched {len(test_cases)} test cases")
                # Add type indicator to test cases
                for tc in test_cases:
                    tc['itemType'] = 'test_case'
                    tc['name'] = tc.get('title', 'Untitled Test Case')
                    tc['id'] = tc.get('uuid', tc.get('id'))
                    tc['type'] = 'Manual Test Case'
                    tc['documentTypeCode'] = 'TEST_CASE'
            except Exception as e:
                print(f"ERROR fetching test cases: {e}")
                import traceback
                traceback.print_exc()
                # Continue even if test cases fail
        
        # Add type indicator to documents
        documents = result.get('documents', [])
        for doc in documents:
            doc['itemType'] = 'document'
            if 'name' not in doc and 'title' in doc:
                doc['name'] = doc['title']
        
        # Combine results
        result['testCases'] = test_cases
        result['totalDocuments'] = len(documents)
        result['totalTestCases'] = len(test_cases)
        
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/calm/<source_id>/requirements', methods=['GET'])
def calm_list_requirements(source_id):
    """List requirements (CALMREQU tasks) from Cloud ALM"""
    try:
        project_id = request.args.get('projectId')
        if not project_id:
            return jsonify({"error": "projectId is required"}), 400

        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404

        service = get_calm_service(source.get('config'))
        requirements = service.list_requirements(project_id)

        for req in requirements:
            req['itemType'] = 'requirement'
            req['name'] = req.get('title', 'Untitled Requirement')
            req['id'] = req.get('id')
            req['type'] = 'Requirement'
            req['documentTypeCode'] = 'REQUIREMENT'
            if req.get('source'):
                req['requirementSource'] = req.get('source')
            if not req.get('modifiedAt'):
                req['modifiedAt'] = req.get('lastChangedDate')
            req['updatedOn'] = req.get('modifiedAt') or req.get('lastChangedDate')

        return jsonify({
            'requirements': requirements,
            'totalRequirements': len(requirements),
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/calm/<source_id>/documents/<document_id>/versions', methods=['GET'])
def calm_list_document_versions(source_id, document_id):
    """List all versions of a Cloud ALM document."""
    try:
        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404

        service = get_calm_service(source.get('config'))
        versions = service.list_document_versions(document_id)

        normalized = []
        for doc in versions:
            item = _normalize_document_structure(doc)
            normalized.append({
                'documentId': item.get('id'),
                'name': item.get('name'),
                'version': doc.get('version', item.get('metadata', {}).get('version', 1)),
                'isLatest': doc.get('isLatest', item.get('metadata', {}).get('isLatest', True)),
                'displayId': doc.get('displayId', item.get('metadata', {}).get('displayId', '')),
                'updatedBy': item.get('metadata', {}).get('updatedBy', 'System'),
                'updatedOn': item.get('metadata', {}).get('updatedOn'),
                'modifiedAt': doc.get('modifiedAt'),
            })

        return jsonify({'versions': normalized, 'sourceId': source_id})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/documents/<document_id>/versions', methods=['GET'])
def list_document_versions(document_id):
    """List synced document versions from local store, with optional live CALM fallback."""
    try:
        local_versions = rag_service.list_document_versions(document_id)
        source_id = request.args.get('sourceId')
        live_versions = []

        if source_id or not local_versions:
            try:
                if not source_id:
                    sources = source_config_service.list_sources()
                    calm_source = next((s for s in sources if s['type'] == 'CALM'), None)
                    if calm_source:
                        source_id = calm_source['id']

                if source_id:
                    service = get_calm_service(
                        source_config_service.get_source(source_id).get('config')
                    )
                    calm_versions = service.list_document_versions(document_id)
                    live_versions = [{
                        'documentId': doc.get('uuid') or doc.get('id'),
                        'name': doc.get('title') or doc.get('name'),
                        'version': doc.get('version', 1),
                        'isLatest': doc.get('isLatest', True),
                        'displayId': doc.get('displayId', ''),
                        'updatedOn': doc.get('modifiedAt') or doc.get('createdAt'),
                        'source': 'live',
                    } for doc in calm_versions]
            except Exception as live_err:
                print(f"Could not fetch live versions for {document_id}: {live_err}")

        versions = live_versions if live_versions and not local_versions else local_versions
        if not versions and live_versions:
            versions = live_versions

        return jsonify({
            'versions': versions,
            'documentId': document_id,
            'sourceId': source_id,
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/test-cases/<test_case_id>', methods=['GET'])
def get_test_case(test_case_id):
    """Get test case details from CALM"""
    try:
        import re
        is_uuid = bool(re.match(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', str(test_case_id)))
        if not is_uuid:
            return jsonify({"error": "Invalid test case ID"}), 400

        source_id = request.args.get('sourceId')

        if not source_id:
            # Fallback to the first CALM source if not explicitly provided
            sources = source_config_service.list_sources()
            calm_source = next((s for s in sources if s['type'] == 'CALM'), None)
            if not calm_source:
                return jsonify({"error": "No CALM source found"}), 404
            source_id = calm_source['id']

        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404

        service = get_calm_service(source.get('config'))
        test_case = service.get_manual_test_case(test_case_id)

        return jsonify(test_case)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/documents/<document_id>/download', methods=['GET'])
def download_calm_document(document_id):
    """Download document content from CALM"""
    try:
        # Prevent invalid IDs from hitting CALM API (which expect a UUID)
        import re
        is_uuid = bool(re.match(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', str(document_id)))
        if not is_uuid:
            return jsonify({"error": "This document was synced using an older version. Please re-sync the project from the Data Sources tab to download it."}), 400

        source_id = request.args.get('sourceId')

        if not source_id:
            # Fallback to the first CALM source if not explicitly provided
            sources = source_config_service.list_sources()
            calm_source = next((s for s in sources if s['type'] == 'CALM'), None)
            if not calm_source:
                return jsonify({"error": "No CALM source found"}), 404
            source_id = calm_source['id']

        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404

        service = get_calm_service(source.get('config'))
        content = service.get_document_content(document_id)

        from flask import make_response
        response = make_response(content)
        # Content-Type will be application/octet-stream if unknown, or text/html if returned by CALM
        response.headers['Content-Disposition'] = f'attachment; filename="document_{document_id}"'
        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/documents/<document_id>/view', methods=['GET'])
def view_calm_document(document_id):
    """
    Return the stored HTML content for a CALM document or requirement.
    First checks the local vector store (saved during sync).
    If not found locally, falls back to fetching live from CALM.
    """
    try:
        # 1. Try local vector store first
        html_content = rag_service.get_document_html(document_id)

        if html_content:
            return jsonify({
                "documentId": document_id,
                "content": _normalize_document_html_for_view(html_content),
                "source": "local"
            })

        # 2. Prevent invalid IDs from hitting CALM API (which expect a UUID)
        import re
        # Basic UUID format check
        is_uuid = bool(re.match(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', str(document_id)))
        if not is_uuid:
            return jsonify({"error": "This document was synced using an older version. Please re-sync the project from the Data Sources tab to view its contents."}), 400

        # 3. Fall back to live CALM fetch
        source_id = request.args.get('sourceId')
        if not source_id:
            sources = source_config_service.list_sources()
            calm_source = next((s for s in sources if s['type'] == 'CALM'), None)
            if not calm_source:
                return jsonify({"error": "Document content not found locally and no CALM source configured"}), 404
            source_id = calm_source['id']

        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404

        service = get_calm_service(source.get('config'))
        stored_meta = rag_service.get_document_meta(document_id)
        doc_type = (stored_meta.get('doc_type') or '').lower()
        is_requirement = doc_type == 'requirement'

        if is_requirement:
            task = service.get_task(document_id)
            description = task.get('description') or ''
            if not description:
                return jsonify({"error": "Requirement has no description content"}), 404
            return jsonify({
                "documentId": document_id,
                "content": _normalize_document_html_for_view(description),
                "source": "live",
                "itemType": "requirement",
                "title": task.get('title'),
                "status": task.get('status'),
                "subStatus": task.get('subStatus'),
                "approvalState": task.get('approvalState'),
            })

        try:
            calm_doc = service.get_document(document_id)
            html_content = calm_doc.get('content') or calm_doc.get('htmlContent') or calm_doc.get('text') or ''
        except Exception as doc_err:
            # Requirements synced before type metadata was stored — try tasks API
            try:
                task = service.get_task(document_id)
                description = task.get('description') or ''
                if description:
                    return jsonify({
                        "documentId": document_id,
                        "content": _normalize_document_html_for_view(description),
                        "source": "live",
                        "itemType": "requirement",
                        "title": task.get('title'),
                        "status": task.get('status'),
                        "subStatus": task.get('subStatus'),
                        "approvalState": task.get('approvalState'),
                    })
            except Exception:
                pass
            raise doc_err

        if not html_content:
            return jsonify({"error": "Document has no displayable content"}), 404

        return jsonify({
            "documentId": document_id,
            "content": _normalize_document_html_for_view(html_content),
            "source": "live"
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/requirements/<requirement_id>', methods=['GET'])
def get_requirement(requirement_id):
    """Get requirement details from CALM Tasks API or local store."""
    try:
        import re
        is_uuid = bool(re.match(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', str(requirement_id)))
        if not is_uuid:
            return jsonify({"error": "Invalid requirement ID"}), 400

        html_content = rag_service.get_document_html(requirement_id)
        stored_meta = rag_service.get_document_meta(requirement_id)

        source_id = request.args.get('sourceId')
        if not source_id:
            sources = source_config_service.list_sources()
            calm_source = next((s for s in sources if s['type'] == 'CALM'), None)
            if not calm_source:
                return jsonify({"error": "No CALM source found"}), 404
            source_id = calm_source['id']

        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404

        service = get_calm_service(source.get('config'))
        task = service.get_task(requirement_id)

        if not html_content:
            description = task.get('description') or ''
            html_content = _normalize_document_html_for_view(description) if description else ''

        return jsonify({
            **task,
            "content": html_content,
            "itemType": "requirement",
            "name": task.get('title'),
            "project": stored_meta.get('project') or 'N/A',
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ============================================================================
# SAP BTP Code Repository Endpoints
# ============================================================================

@app.route('/api/btp/<source_id>/fetch-code', methods=['GET', 'POST'])
def btp_fetch_code(source_id):
    try:
        source = source_config_service.get_source(source_id)
        if not source or source['type'] != 'BTP':
            return jsonify({"error": "Valid BTP Source not found"}), 404
            
        # Extract parameters from GET or POST
        if request.method == 'POST':
            data = request.json or {}
            entity_set = data.get('entity_set')
            filter_query = data.get('filter_query')
            top = data.get('top')
            skip = data.get('skip')
        else:
            entity_set = request.args.get('entity_set')
            filter_query = request.args.get('filter_query')
            top = request.args.get('top')
            skip = request.args.get('skip')

        service = BTPService(source.get('config', {}))
        data = service.fetch_data(
            entity_set=entity_set,
            filter_query=filter_query,
            top=top,
            skip=skip
        )
        
        return jsonify({"data": data})
    except BtpODataError as e:
        import traceback
        traceback.print_exc()
        # Propagate the actual BTP status code and error payload to the frontend
        body = getattr(e, "raw_body", None) or {"message": str(e)}
        # Ensure JSON-serializable shape
        if isinstance(body, str):
            body = {"message": body}
        return jsonify({"error": body}), getattr(e, "status_code", 500)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route('/api/btp/generate-code', methods=['POST'])
def btp_generate_code():
    try:
        llm_provider = get_llm_provider_for_user(get_optional_current_user_id())
        data = request.json
        prompt = data.get('prompt', '')
        code = data.get('code', '')
        
        system_msg = "You are an expert SAP ABAP and BTP developer. You are given an existing code block and a user instruction. Return ONLY the modified code without any markdown formatting wrappers or explanations."
        user_msg = f"Existing Code:\n{code}\n\nInstruction: {prompt}\n\nPlease provide the updated code."
        
        messages = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": user_msg}
        ]
        
        response = openai_service.chat_completion(messages, provider=llm_provider)
        
        if response.startswith("```"):
            lines = response.splitlines()
            if len(lines) > 2:
                response = "\n".join(lines[1:-1])
                
        return jsonify({"code": response})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ============================================================================
# Document Sync Endpoints
# ============================================================================

@app.route('/api/sync/check', methods=['POST'])
def check_sync_status():
    """Check which documents are already synced"""
    try:
        data = request.json
        document_ids = data.get('documentIds', [])
        
        if not document_ids:
            return jsonify({"error": "documentIds array is required"}), 400
        
        # Check each document
        sync_status = {}
        for doc_id in document_ids:
            is_synced = rag_service.check_document_exists(doc_id)
            sync_status[doc_id] = is_synced
        
        return jsonify({
            "syncStatus": sync_status
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/sync', methods=['POST'])
def sync_documents():
    """Sync documents from a source to the knowledge base"""
    try:
        data = request.json
        source_id = data.get('sourceId')
        # Support both 'documents' (full objects) and 'documentIds' (legacy)
        documents = data.get('documents', [])
        document_ids = data.get('documentIds', [])
        synced_by = data.get('syncedBy')  # optional: name/email of the user who triggered the sync
        
        if not source_id:
            return jsonify({"error": "sourceId is required"}), 400
            
        if not documents and not document_ids:
             return jsonify({"error": "No documents provided to sync"}), 400
        
        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404
        
        results = []
        
        # Process full document objects
        if documents:
            calm_service_instance = get_calm_service(source.get('config'))
            sync_source_type = source.get('type') or 'CALM'
            for doc in documents:
                try:
                    # Normalize document structure to handle both old and new API formats
                    normalized_doc = _normalize_document_structure(doc)
                    # Stamp who triggered the sync if the doc has no modifier info
                    if synced_by and not normalized_doc['metadata'].get('updatedBy'):
                        normalized_doc['metadata']['updatedBy'] = synced_by
                    doc_id = normalized_doc.get('id')
                    item_type = doc.get('itemType') or doc.get('metadata', {}).get('itemType')

                    # Try to fetch real content from CALM
                    html_content = None
                    try:
                        if item_type == 'requirement' or doc.get('type') == 'CALMREQU' or doc.get('documentTypeCode') == 'REQUIREMENT':
                            calm_task = calm_service_instance.get_task(doc_id)
                            description = calm_task.get('description') or ''
                            if description:
                                html_content = _normalize_document_html_for_view(description)
                            _apply_calm_task_metadata(normalized_doc, calm_task, sync_source_type)
                        else:
                            calm_doc = calm_service_instance.get_document(doc_id)
                            html_content = calm_doc.get('content') or calm_doc.get('htmlContent') or calm_doc.get('text')
                    except Exception as fetch_err:
                        print(f"Could not fetch content for item {doc_id}: {fetch_err}")

                    if html_content:
                        result = rag_service.ingest_calm_document(normalized_doc, html_content)
                    else:
                        result = rag_service.add_placeholder_document(normalized_doc)

                    results.append({
                        "documentId": doc_id,
                        "documentName": normalized_doc.get('name'),
                        "status": result.get('status'),
                        "message": result.get('message', ''),
                        "wasExisting": result.get('was_existing', False),
                        "hasContent": bool(html_content),
                        "error": result.get('error')
                    })
                except Exception as e:
                    doc_id = doc.get('uuid') or doc.get('id')
                    results.append({
                        "documentId": doc_id,
                        "status": "error",
                        "error": str(e)
                    })
        # Legacy fallback
        elif document_ids:
             for doc_id in document_ids:
                results.append({
                    "documentId": doc_id,
                    "status": "skipped",
                    "message": "Metadata required for sync. Update client."
                })
        
        # Update last sync time
        source_config_service.update_last_sync(source_id)
        
        return jsonify({
            "message": f"Synced {len(results)} documents",
            "results": results
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


def _apply_calm_task_metadata(normalized_doc: dict, calm_task: dict, sync_source_type: str = 'CALM') -> None:
    """
    Merge CALM task fields into document metadata.
    CALM tasks expose a `source` field for requirement origin (e.g. Manual, AI)
    which must not overwrite the DMS source label (CALM).
    """
    preserved_source = normalized_doc['metadata'].get('source') or sync_source_type
    preserved_project = normalized_doc['metadata'].get('project')
    calm_origin = calm_task.get('source')

    normalized_doc['metadata'].update({
        k: v for k, v in calm_task.items()
        if v is not None and k not in ('description', 'source')
    })

    normalized_doc['metadata']['source'] = preserved_source
    if preserved_project:
        normalized_doc['metadata']['project'] = preserved_project
    if calm_origin:
        normalized_doc['metadata']['requirementSource'] = calm_origin

    last_changed = calm_task.get('lastChangedDate')
    if last_changed:
        normalized_doc['metadata']['lastChangedDate'] = last_changed
        normalized_doc['metadata']['modifiedAt'] = last_changed
        normalized_doc['metadata']['updatedOn'] = last_changed

    last_changed_by = (
        calm_task.get('lastChangedBy')
        or calm_task.get('changedBy')
        or calm_task.get('assigneeName')
        or calm_task.get('assigneeId')
    )
    if last_changed_by:
        normalized_doc['metadata']['updatedBy'] = last_changed_by


def _normalize_document_structure(doc: dict) -> dict:
    """
    Normalize document structure to handle both old and new API formats
    (e.g., SAP Calm OData response with uuid, title, documentTypeCode)
    
    Args:
        doc: Raw document object from API
        
    Returns:
        Normalized document with consistent field names
    """
    # Document type code mapping (SAP Calm codes to readable names)
    doc_type_names = {
        'NT': 'Note',
        'FS': 'Functional Spec',
        'TS': 'Technical Spec',
        'SD': 'Solution Document',
        'CD': 'Change Document',
        'DP': 'Decision Paper',
        'REQUIREMENT': 'Requirement',
        'TEST_CASE': 'Manual Test Case',
    }
    
    # Extract and normalize fields
    doc_id = doc.get('uuid') or doc.get('id')
    doc_name = doc.get('title') or doc.get('name')
    item_type = doc.get('itemType') or doc.get('metadata', {}).get('itemType')
    doc_type_code = doc.get('documentTypeCode') or doc.get('type')
    if item_type == 'requirement' or doc_type_code == 'CALMREQU':
        doc_type_code = 'REQUIREMENT'
    doc_type = doc_type_names.get(doc_type_code, doc_type_code) if doc_type_code else 'Document'
    
    # Build normalized document
    normalized = {
        'id': doc_id,
        'name': doc_name,
        'type': doc_type,
        'metadata': doc.get('metadata', {})
    }
    
    # Resolve updatedOn: prefer explicit field, fall back to CALM OData modifiedAt/changedAt
    updated_on = (
        doc.get('updatedOn')
        or doc.get('modifiedAt')
        or doc.get('lastChangedDate')
        or doc.get('changedAt')
        or doc.get('lastModified')
        or doc.get('metadata', {}).get('updatedOn')
        or doc.get('metadata', {}).get('modifiedAt')
    )

    # Resolve updatedBy: prefer explicit field, fall back to CALM OData changedBy/modifiedBy
    updated_by = (
        doc.get('updatedBy')
        or doc.get('changedBy')
        or doc.get('lastChangedBy')
        or doc.get('modifiedBy')
        or doc.get('lastChangedByUser')
        or doc.get('assigneeName')
        or doc.get('assigneeId')
        or doc.get('metadata', {}).get('updatedBy')
        or doc.get('metadata', {}).get('changedBy')
    )

    dms_source = (
        doc.get('metadata', {}).get('source')
        if isinstance(doc.get('metadata'), dict) and doc.get('metadata', {}).get('source')
        else ('CALM' if item_type == 'requirement' else doc.get('source'))
    )

    # Merge all original fields into metadata for preservation
    normalized['metadata'].update({
        'uuid': doc.get('uuid'),
        'title': doc.get('title'),
        'displayId': doc.get('displayId'),
        'documentTypeCode': doc_type_code,
        'projectId': doc.get('projectId'),
        'scopeId': doc.get('scopeId'),
        'statusCode': doc.get('statusCode'),
        'priorityCode': doc.get('priorityCode'),
        'sourceCode': doc.get('sourceCode'),
        'createdAt': doc.get('createdAt'),
        'modifiedAt': doc.get('modifiedAt') or doc.get('lastChangedDate'),
        'version': doc.get('version', 1),
        'isLatest': doc.get('isLatest', True),
        'displayId': doc.get('displayId'),
        'updatedOn': updated_on,
        'updatedBy': updated_by,
        'content': doc.get('content'),
        'tags': doc.get('tags', []),
        'itemType': item_type or doc.get('itemType'),
        'subStatus': doc.get('subStatus'),
        'approvalState': doc.get('approvalState'),
        'status': doc.get('status'),
        'source': dms_source,
        'requirementSource': doc.get('requirementSource') or (doc.get('source') if item_type == 'requirement' else None),
        'project': doc.get('metadata', {}).get('project') if 'metadata' in doc else doc.get('project')
    })
    
    # Remove None values from metadata
    normalized['metadata'] = {k: v for k, v in normalized['metadata'].items() if v is not None}
    
    return normalized


@app.route('/api/calm/<source_id>/push-spec', methods=['POST'])
def push_spec_to_calm(source_id):
    """Push a specification document to Cloud ALM"""
    try:
        data = request.json
        name = data.get('name')
        content = data.get('content')
        process_id = data.get('processId')
        project_id = data.get('projectId')
        doc_type = data.get('documentType', 'functional_spec')

        if not all([name, content]):
            return jsonify({"error": "name and content are required"}), 400
        
        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404
        
        service = get_calm_service(source.get('config'))
        
        # Cloud ALM expects HTML-like rich content. Convert markdown/plain text
        # to basic semantic HTML so formatting survives upload and retrieval.
        if isinstance(content, str):
            content = markdown_to_html(content).encode('utf-8')
        elif isinstance(content, bytes):
            content = markdown_to_html(content.decode('utf-8', errors='ignore')).encode('utf-8')
        
        result = service.push_document(
            name=name,
            content=content,
            document_type=doc_type,
            process_id=process_id,
            project_id=project_id
        )
        
        return jsonify({
            "message": "Document pushed successfully",
            "document": result
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/calm/<source_id>/push-test-cases', methods=['POST'])
def push_test_cases_to_calm(source_id):
    """Push test cases to Cloud ALM as Manual Test Cases"""
    try:
        data = request.json
        test_cases = data.get('testCases', [])
        project_id = data.get('projectId')
        scope_id = data.get('scopeId')
        priority_code = data.get('priorityCode', 20)
        name_prefix = data.get('namePrefix', '')  # Optional prefix for test case names
        
        if not all([test_cases, project_id, scope_id]):
            return jsonify({"error": "testCases, projectId, and scopeId are required"}), 400
        
        if not isinstance(test_cases, list) or len(test_cases) == 0:
            return jsonify({"error": "testCases must be a non-empty array"}), 400
        
        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404
        
        service = get_calm_service(source.get('config'))
        
        # Create each test case in Cloud ALM
        created_test_cases = []
        errors = []
        
        for idx, test_case in enumerate(test_cases):
            try:
                # Apply name prefix if provided
                original_title = test_case.get('title', f'Test Case {idx + 1}')
                if name_prefix and name_prefix.strip():
                    title = f"{name_prefix.strip()} - {original_title}"
                else:
                    title = original_title
                
                activities = test_case.get('toActivities', [])
                
                if not activities:
                    errors.append(f"Test case '{title}' has no activities")
                    continue
                
                result = service.create_manual_test_case(
                    title=title,
                    project_id=project_id,
                    scope_id=scope_id,
                    activities=activities,
                    priority_code=priority_code,
                    is_prepared=False
                )
                
                created_test_cases.append({
                    'title': title,
                    'id': result.get('uuid', result.get('id')),  # SAP Cloud ALM uses 'uuid'
                    'status': 'created'
                })
            except Exception as e:
                error_msg = f"Failed to create test case '{test_case.get('title', idx + 1)}': {str(e)}"
                print(error_msg)
                errors.append(error_msg)
        
        response = {
            "message": f"Successfully created {len(created_test_cases)} test case(s)",
            "testCases": created_test_cases,
            "totalRequested": len(test_cases),
            "totalCreated": len(created_test_cases)
        }
        
        if errors:
            response["errors"] = errors
            response["message"] += f" with {len(errors)} error(s)"
        
        return jsonify(response)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ═══════════════════════════════════════════════════════════════════════════════
#  CODE REPOSITORY ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/code-repository', methods=['POST'])
@token_required
def save_code_snippet():
    """Save a code snippet to the user's repository"""
    try:
        data = request.get_json() or {}
        user_id = request.current_user['sub']
        
        title = data.get('title', '').strip()
        code = data.get('code', '').strip()
        code_type = data.get('code_type', 'ABAP')
        description = data.get('description', '').strip() or None
        analysis_data = data.get('analysis_data')
        
        if not title:
            return jsonify({"error": "Title is required"}), 400
        if not code:
            return jsonify({"error": "Code is required"}), 400
        
        service = CodeRepositoryService()
        snippet = service.save_code_snippet(
            user_id=user_id,
            title=title,
            code=code,
            code_type=code_type,
            description=description,
            analysis_data=analysis_data
        )
        
        return jsonify(snippet), 201
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/code-repository', methods=['GET'])
@token_required
def get_code_snippets():
    """Get all code snippets for the current user"""
    try:
        user_id = request.current_user['sub']
        limit = int(request.args.get('limit', 100))
        offset = int(request.args.get('offset', 0))
        
        service = CodeRepositoryService()
        snippets = service.get_user_snippets(user_id, limit, offset)
        count = service.get_snippet_count(user_id)
        
        return jsonify({
            "snippets": snippets,
            "total": count
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/code-repository/<snippet_id>', methods=['GET'])
@token_required
def get_code_snippet(snippet_id):
    """Get a specific code snippet"""
    try:
        user_id = request.current_user['sub']
        
        service = CodeRepositoryService()
        snippet = service.get_snippet_by_id(snippet_id, user_id)
        
        if not snippet:
            return jsonify({"error": "Snippet not found"}), 404
        
        return jsonify(snippet)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/code-repository/<snippet_id>', methods=['PUT'])
@token_required
def update_code_snippet(snippet_id):
    """Update a code snippet"""
    try:
        user_id = request.current_user['sub']
        data = request.get_json() or {}
        
        title = data.get('title')
        code = data.get('code')
        description = data.get('description')
        
        service = CodeRepositoryService()
        snippet = service.update_snippet(
            snippet_id=snippet_id,
            user_id=user_id,
            title=title,
            code=code,
            description=description
        )
        
        if not snippet:
            return jsonify({"error": "Snippet not found"}), 404
        
        return jsonify(snippet)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route('/api/code-repository/<snippet_id>', methods=['DELETE'])
@token_required
def delete_code_snippet(snippet_id):
    """Delete a code snippet"""
    try:
        user_id = request.current_user['sub']
        
        service = CodeRepositoryService()
        deleted = service.delete_snippet(snippet_id, user_id)
        
        if not deleted:
            return jsonify({"error": "Snippet not found"}), 404
        
        return jsonify({"message": "Snippet deleted successfully"})
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ============================================================================
# SAP BTP Code Repository AI & Search Endpoints
# ============================================================================

@app.route('/api/btp/<source_id>/fetch-code', methods=['GET'])
def fetch_btp_code(source_id):
    """Fetch code/data from a specific BTP source with dynamic OData queries"""
    try:
        source = source_config_service.get_source(source_id)
        if not source or source.get('type') != 'BTP':
            return jsonify({"error": "Invalid BTP source"}), 400
            
        entity_set = request.args.get('entity_set', '')
        filter_query = request.args.get('filter_query', '')
        skip = request.args.get('skip', '0')
        top = request.args.get('top', '50')
            
        config = source.get('config', {})
        
        from services.btp_service import BTPService
        service = BTPService(config, use_env_fallback=False)
        
        btp_data = service.fetch_data(
            entity_set=entity_set, 
            filter_query=filter_query, 
            skip=skip, 
            top=top
        )
        
        return jsonify({
            "success": True, 
            "data": btp_data,
            "sourceId": source_id
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/btp/<source_id>/fetch-content', methods=['GET'])
def fetch_btp_object_content(source_id):
    """Fetch raw content/$value for a specific BTP object"""
    try:
        source = source_config_service.get_source(source_id)
        if not source or source.get('type') != 'BTP':
            return jsonify({"error": "Invalid BTP source"}), 400
            
        entity_set = request.args.get('entity_set', '')
        object_key = request.args.get('object_id', '') # Key for the entity
        
        if not entity_set or not object_key:
            return jsonify({"error": "entity_set and object_id are required"}), 400
            
        config = source.get('config', {})
        from services.btp_service import BTPService
        service = BTPService(config, use_env_fallback=False)
        
        content = service.fetch_object_content(entity_set, object_key)
        
        return jsonify({
            "success": True, 
            "content": content
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ── GitHub Integration ──────────────────────────────────────────────────

@app.route('/api/github/user', methods=['GET'])
@token_required
def github_user():
    github_token = request.args.get('github_token')
    if not github_token:
        return jsonify({'error': 'GitHub token missing'}), 400
    
    from services.github_service import GitHubService
    svc = GitHubService(github_token)
    user = svc.get_user()
    if not user:
        return jsonify({'error': 'Invalid GitHub token'}), 401
    
    return jsonify({'user': user})

@app.route('/api/github/repos', methods=['GET'])
@token_required
def github_repos():
    github_token = request.args.get('github_token')
    if not github_token:
        return jsonify({'error': 'GitHub token missing'}), 400
    
    from services.github_service import GitHubService
    svc = GitHubService(github_token)
    repos = svc.list_repos()
    return jsonify({'repos': repos})

@app.route('/api/github/push', methods=['POST'])
@token_required
def github_push():
    data = request.json
    github_token = data.get('github_token')
    repo_full_name = data.get('repo')
    path = data.get('path')
    content = data.get('content')
    commit_message = data.get('message', 'Generated by MyGO AI')
    
    if not all([github_token, repo_full_name, path, content]):
        return jsonify({'error': 'Missing required fields'}), 400
    
    from services.github_service import GitHubService
    svc = GitHubService(github_token)
    result = svc.push_file(repo_full_name, path, content, commit_message)
    
    if 'content' in result:
        return jsonify({'status': 'success', 'result': result})
    else:
        return jsonify({'status': 'error', 'message': result.get('message', 'Push failed')}), 500


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    print(f"DEBUG: Starting Flask app on port {port}")
    print(f"DEBUG: OpenAI API Key: {os.getenv('OPENAI_API_KEY')}")
    print(f"DEBUG: Claude API Key: {os.getenv('CLAUDE_API_KEY')}")
    print(f"DEBUG: Gemini API Key: {os.getenv('GEMINI_API_KEY')}")
    print(f"MCP Endpoints available at /mcp/tools and /mcp/execute")
    print(f"Available MCP tools: {list(TOOLS.keys())}")
    print(f"Cloud ALM endpoints available at /api/calm/<source_id>/...")
    print(f"Source configuration endpoints available at /api/sources")
    app.run(debug=True, port=port, host='0.0.0.0', threaded=True)



