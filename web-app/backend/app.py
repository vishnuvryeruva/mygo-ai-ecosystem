from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import io
import sqlite3
import uuid
import jwt
import bcrypt
import datetime
from functools import wraps
from dotenv import load_dotenv
from services.openai_service import OpenAIService
from services.rag_service import RAGService
from services.spec_service import SpecService
from services.prompt_service import PromptService
from services.code_service import CodeService
from services.test_service import TestService
from services.advisor_service import AdvisorService
from services import role_service
from services import user_service
from config.prompts import get_all_prompts, get_prompt, update_prompt

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
    print("DEBUG: Startup - Attempting chat completion...")
    client.chat.completions.create(
        model="gpt-4o-mini",
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

# ── SQLite user database ────────────────────────────────────────────────────
DB_PATH = os.path.join(basedir, 'users.db')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'Admin',
            created_by TEXT,
            created_at TEXT NOT NULL
        )
    ''')
    
    # Add role column if it doesn't exist (for existing databases)
    try:
        conn.execute('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "Admin"')
        conn.commit()
    except sqlite3.OperationalError:
        pass
    
    # Add created_by column if it doesn't exist
    try:
        conn.execute('ALTER TABLE users ADD COLUMN created_by TEXT')
        conn.commit()
    except sqlite3.OperationalError:
        pass
    
    # Update all existing users without a role to Admin
    conn.execute("UPDATE users SET role = 'Admin' WHERE role IS NULL OR role = '' OR role = 'Viewer'")
    conn.commit()
    conn.close()

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

# Initialize services
openai_service = OpenAIService()
rag_service = RAGService()
spec_service = SpecService()
prompt_service = PromptService()
code_service = CodeService()
test_service = TestService()
advisor_service = AdvisorService()

@app.before_request
def log_request_info():
    print(f"DEBUG: Incoming Request: {request.method} {request.url}")
    if request.is_json:
        print(f"DEBUG: Request Body: {request.json}")


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok"})

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
    
    # All users who sign up through the registration flow get Admin role by default
    role = 'Admin'

    try:
        conn = get_db()
        conn.execute(
            'INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            (user_id, name, email, password_hash, role, created_at)
        )
        conn.commit()
        conn.close()
    except sqlite3.IntegrityError:
        return jsonify({'error': 'An account with this email already exists'}), 409

    token = create_token(user_id, email)
    return jsonify({
        'token': token,
        'user': {'id': user_id, 'name': name, 'email': email, 'role': role}
    }), 201


@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = (data.get('email') or '').strip().lower()
    password = (data.get('password') or '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    conn = get_db()
    row = conn.execute('SELECT * FROM users WHERE email = ?', (email,)).fetchone()
    conn.close()

    if not row or not bcrypt.checkpw(password.encode('utf-8'), row['password_hash'].encode('utf-8')):
        return jsonify({'error': 'Invalid email or password'}), 401

    token = create_token(row['id'], row['email'])
    return jsonify({
        'token': token,
        'user': {'id': row['id'], 'name': row['name'], 'email': row['email'], 'role': row['role'] or 'Viewer'}
    })


@app.route('/api/auth/me', methods=['GET'])
@token_required
def me():
    payload = request.current_user
    conn = get_db()
    row = conn.execute('SELECT id, name, email, role, created_at FROM users WHERE id = ?', (payload['sub'],)).fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({'id': row['id'], 'name': row['name'], 'email': row['email'], 'role': row['role'] or 'Viewer', 'created_at': row['created_at']})

# Ask Yoda - RAG-based Q&A
@app.route('/api/ask-yoda', methods=['POST'])
def ask_yoda():
    try:
        data = request.json
        query = data.get('query', '')
        
        if not query:
            return jsonify({"error": "Query is required"}), 400
        
        # Use RAG to get relevant context and generate answer
        answer = rag_service.query(query)
        
        return jsonify({
            "answer": answer,
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

# List documents
@app.route('/api/documents', methods=['GET'])
def list_documents():
    try:
        documents = rag_service.list_documents()
        return jsonify({"documents": documents})
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
    return jsonify({
    "format": "preview",
    "spec": "# Functional Specification Document for Coding Practices\n\n## 1. Executive Summary\nThis document outlines the functional specifications for the development of a comprehensive guide on coding practices. The purpose of this guide is to standardize coding practices across the organization, improve code quality, enhance maintainability, and foster collaboration among development teams. The guide will serve as a reference for developers, ensuring adherence to best practices and reducing technical debt.\n\n## 2. Business Objectives\n- Establish a standardized coding practice across all development teams.\n- Improve code quality and maintainability.\n- Enhance collaboration and communication among developers.\n- Reduce the incidence of bugs and technical debt.\n- Facilitate onboarding of new developers through clear guidelines.\n\n## 3. Functional Requirements\n### 3.1 Coding Standards\n- Define naming conventions for variables, functions, classes, and files.\n- Specify formatting guidelines (indentation, line length, whitespace).\n- Establish rules for commenting and documentation.\n\n### 3.2 Best Practices\n- Outline best practices for error handling and logging.\n- Provide guidelines for code reviews and peer programming.\n- Recommend design patterns and architectural styles.\n\n### 3.3 Tools and Technologies\n- List recommended development tools (IDEs, linters, version control systems).\n- Specify tools for automated testing and continuous integration.\n\n### 3.4 Training and Resources\n- Provide links to training resources and workshops.\n- Include a glossary of terms and concepts related to coding practices.\n\n## 4. User Stories and Use Cases\n### User Stories\n1. **As a developer**, I want to access the coding practices guide so that I can write code that adheres to organizational standards.\n2. **As a team lead**, I want to ensure that my team follows the coding standards so that we can maintain high code quality.\n3. **As a new hire**, I want to review the coding practices guide to understand the coding standards of the organization.\n\n### Use Cases\n- **Use Case 1: Accessing the Coding Practices Guide**\n  - **Actors:** Developer\n  - **Preconditions:** Developer has access to the internal documentation portal.\n  - **Postconditions:** Developer can view and navigate the coding practices guide.\n  - **Main Flow:**\n    1. Developer logs into the documentation portal.\n    2. Developer selects the coding practices section.\n    3. Developer reads the guidelines.\n\n## 5. Business Process Design\n### Process Flow\n1. **Initiation:** Identify the need for coding practices.\n2. **Development:** Collaborate with stakeholders to draft the guide.\n3. **Review:** Conduct peer reviews and incorporate feedback.\n4. **Approval:** Obtain final approval from management.\n5. **Publication:** Publish the guide on the internal documentation portal.\n6. **Training:** Conduct training sessions for developers.\n\n## 6. Data Requirements\n- The guide will be stored in a content management system (CMS).\n- Version control to track changes and updates to the guide.\n- Analytics to monitor usage and access patterns.\n\n## 7. Interface Requirements\n- The guide should be accessible via a web interface.\n- Search functionality to allow users to find specific topics quickly.\n- Responsive design to ensure usability across devices (desktop, tablet, mobile).\n\n## 8. Security and Authorization\n- Access to the coding practices guide will be restricted to internal employees.\n- Role-based access control to ensure that only authorized personnel can edit the guide.\n- Regular audits to ensure compliance with security policies.\n\n## 9. Testing Requirements\n- User acceptance testing (UAT) to validate the usability of the guide.\n- Functional testing to ensure all links, search functions, and formatting are working correctly.\n- Performance testing to ensure the guide loads quickly and efficiently.\n\n## 10. Acceptance Criteria\n- The coding practices guide is published and accessible to all developers.\n- All sections of the guide are reviewed and approved by relevant stakeholders.\n- The guide includes a feedback mechanism for continuous improvement.\n- Training sessions are conducted, and feedback is collected for future iterations.\n\n## 11. Dependencies and Constraints\n- Dependency on the availability of resources for content creation and review.\n- Constraints related to the timeline for development and publication.\n- Potential resistance to change from developers accustomed to previous practices.\n\n---\n\nThis functional specification document serves as a comprehensive guide for the development of coding practices within the organization. It outlines the necessary requirements, processes, and criteria to ensure successful implementation and adherence to best practices.",
    "type": "functional"
    }), 200
    try:
        data = request.json
        spec_type = data.get('type', 'functional')  # functional or technical
        requirements = data.get('requirements', '')
        format_type = data.get('format', 'docx')  # docx, pdf, or preview
        
        # For preview, return raw text for inline display
        if format_type == 'preview':
            spec_content = spec_service.generate_spec(spec_type, requirements, 'text')
            return jsonify({
                "spec": spec_content,
                "type": spec_type,
                "format": "preview"
            })
        
        spec_doc = spec_service.generate_spec(spec_type, requirements, format_type)
        
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
def generate_prompt():
    try:
        data = request.json
        language = data.get('language', 'ABAP')
        task_description = data.get('task', '')
        context = data.get('context', '')
        
        prompt = prompt_service.generate_prompt(language, task_description, context)
        
        return jsonify({
            "prompt": prompt,
            "language": language
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# Explain Code
@app.route('/api/explain-code', methods=['POST'])
def explain_code():
    try:
        data = request.json
        code = data.get('code', '')
        code_type = data.get('code_type', 'ABAP')  # ABAP, Python, etc.
        program_name = data.get('program_name', '')
        
        explanation = code_service.explain_code(code, code_type, program_name)
        
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
        data = request.json
        code = data.get('code', '')
        test_type = data.get('test_type', 'manual')  # manual or unit
        format_type = data.get('format', 'excel')  # excel, word, jira, preview, calm
        
        # For preview, return raw text for inline display
        if format_type == 'preview':
            test_content = test_service.generate_test_cases(code, test_type, 'text')
            return jsonify({
                "test_cases": test_content,
                "test_type": test_type,
                "format": "preview"
            })
        
        # For CALM format, return structured JSON
        if format_type == 'calm':
            test_cases = test_service.generate_test_cases(code, test_type, 'calm')
            return jsonify({
                "test_cases": test_cases,
                "test_type": test_type,
                "format": "calm"
            })
        
        test_cases = test_service.generate_test_cases(code, test_type, format_type)
        
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
        data = request.json
        code = data.get('code', '')
        code_type = data.get('code_type', 'ABAP')
        
        analysis = advisor_service.analyze_code(code, code_type)
        
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
        
        result = solution_advisor.gather_requirements(requirements)
        
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
        
        result = solution_advisor.generate_solution(requirements)
        
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
        
        result = solution_advisor.refine_solution(requirements, current_solution, feedback)
        
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
        
        result = solution_advisor.search_similar_solutions(solution_summary, rag_service)
        
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
        
        result = solution_advisor.improvise_solution(
            requirements, current_solution, similar_solutions, user_input
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
        
        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404
        
        service = get_calm_service(source.get('config'))
        
        # Fetch documents
        result = service.list_documents(  # Returns {documents, isDemo, error?}
            process_id=process_id,
            document_type=doc_type,
            project_id=project_id
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
    Return the stored HTML content for a CALM document.
    First checks the local vector store (saved during sync).
    If not found locally, falls back to fetching live from CALM.
    """
    try:
        # 1. Try local vector store first
        html_content = rag_service.get_document_html(document_id)

        if html_content:
            return jsonify({"documentId": document_id, "content": html_content, "source": "local"})

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
        calm_doc = service.get_document(document_id)
        html_content = calm_doc.get('content') or calm_doc.get('htmlContent') or calm_doc.get('text') or ''

        if not html_content:
            return jsonify({"error": "Document has no displayable content"}), 404

        return jsonify({"documentId": document_id, "content": html_content, "source": "live"})

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
            for doc in documents:
                try:
                    # Normalize document structure to handle both old and new API formats
                    normalized_doc = _normalize_document_structure(doc)
                    doc_id = normalized_doc.get('id')

                    # Try to fetch real document content from CALM
                    html_content = None
                    try:
                        calm_doc = calm_service_instance.get_document(doc_id)
                        html_content = calm_doc.get('content') or calm_doc.get('htmlContent') or calm_doc.get('text')
                    except Exception as fetch_err:
                        print(f"Could not fetch content for document {doc_id}: {fetch_err}")

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
    }
    
    # Extract and normalize fields
    doc_id = doc.get('uuid') or doc.get('id')
    doc_name = doc.get('title') or doc.get('name')
    doc_type_code = doc.get('documentTypeCode') or doc.get('type')
    doc_type = doc_type_names.get(doc_type_code, doc_type_code) if doc_type_code else 'Document'
    
    # Build normalized document
    normalized = {
        'id': doc_id,
        'name': doc_name,
        'type': doc_type,
        'metadata': doc.get('metadata', {})
    }
    
    # Merge all original fields into metadata for preservation
    normalized['metadata'].update({
        'uuid': doc.get('uuid'),
        'title': doc.get('title'),
        'displayId': doc.get('displayId'),
        'documentTypeCode': doc.get('documentTypeCode'),
        'projectId': doc.get('projectId'),
        'scopeId': doc.get('scopeId'),
        'statusCode': doc.get('statusCode'),
        'priorityCode': doc.get('priorityCode'),
        'sourceCode': doc.get('sourceCode'),
        'createdAt': doc.get('createdAt'),
        'modifiedAt': doc.get('modifiedAt'),
        'content': doc.get('content'),
        'tags': doc.get('tags', []),
        'source': doc.get('metadata', {}).get('source') if 'metadata' in doc else doc.get('source'),
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
        
        # Convert content to bytes if string
        if isinstance(content, str):
            content = content.encode('utf-8')
        
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


if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5001))
    print(f"DEBUG: Starting Flask app on port {port}")
    print(f"MCP Endpoints available at /mcp/tools and /mcp/execute")
    print(f"Available MCP tools: {list(TOOLS.keys())}")
    print(f"Cloud ALM endpoints available at /api/calm/<source_id>/...")
    print(f"Source configuration endpoints available at /api/sources")
    app.run(debug=True, port=port, host='0.0.0.0', threaded=True)



