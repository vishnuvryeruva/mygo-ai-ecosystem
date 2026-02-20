from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import io
from dotenv import load_dotenv
from services.openai_service import OpenAIService
from services.rag_service import RAGService
from services.spec_service import SpecService
from services.prompt_service import PromptService
from services.code_service import CodeService
from services.test_service import TestService
from services.advisor_service import AdvisorService
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
CORS(app)

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
        format_type = data.get('format', 'excel')  # excel, word, jira, preview
        
        # For preview, return raw text for inline display
        if format_type == 'preview':
            test_content = test_service.generate_test_cases(code, test_type, 'text')
            return jsonify({
                "test_cases": test_content,
                "test_type": test_type,
                "format": "preview"
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
    """List documents from Cloud ALM"""
    try:
        process_id = request.args.get('processId')
        doc_type = request.args.get('type')
        project_id = request.args.get('projectId')
        
        source = source_config_service.get_source(source_id)
        if not source:
            return jsonify({"error": "Source not found"}), 404
        
        service = get_calm_service(source.get('config'))
        result = service.list_documents(  # Returns {documents, isDemo, error?}
            process_id=process_id,
            document_type=doc_type,
            project_id=project_id
        )
        return jsonify(result)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ============================================================================
# Document Sync Endpoints
# ============================================================================

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
            for doc in documents:
                try:
                    # Add placeholder to RAG service
                    result = rag_service.add_placeholder_document(doc)
                    results.append({
                        "documentId": doc.get('id'),
                        "status": result.get('status'),
                        "message": result.get('message', ''),
                        "error": result.get('error')
                    })
                except Exception as e:
                    results.append({
                        "documentId": doc.get('id'),
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


@app.route('/api/calm/<source_id>/push-spec', methods=['POST'])
def push_spec_to_calm(source_id):
    """Push a specification document to Cloud ALM"""
    try:
        data = request.json
        name = data.get('name')
        content = data.get('content')
        process_id = data.get('processId')
        doc_type = data.get('documentType', 'functional_spec')
        
        if not all([name, content, process_id]):
            return jsonify({"error": "name, content, and processId are required"}), 400
        
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
            process_id=process_id
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
    """Push test cases to Cloud ALM"""
    try:
        data = request.json
        name = data.get('name')
        content = data.get('content')
        process_id = data.get('processId')
        
        if not all([name, content, process_id]):
            return jsonify({"error": "name, content, and processId are required"}), 400
        
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
            document_type='test_case',
            process_id=process_id
        )
        
        return jsonify({
            "message": "Test cases pushed successfully",
            "document": result
        })
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
    app.run(debug=True, port=port, host='0.0.0.0')



