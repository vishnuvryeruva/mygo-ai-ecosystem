"""
Analyze Code Agent
Analyzes code for anti-patterns, issues, and improvement opportunities.
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.advisor_service import AdvisorService

# Tool definition for MCP
TOOL_NAME = "analyze_code"
TOOL_DESCRIPTION = "Analyze code for anti-patterns, issues, and improvement suggestions"

def analyze_code_tool(code: str, language: str = "ABAP") -> dict:
    """
    Analyze code for issues and improvements.
    
    Args:
        code: The source code to analyze
        language: Programming language (default: ABAP)
    
    Returns:
        Analysis results with anti_patterns, suggestions, and improvements
    """
    service = AdvisorService()
    return service.analyze_code(code, language)


# Schema for MCP tool registration
TOOL_SCHEMA = {
    "name": TOOL_NAME,
    "description": TOOL_DESCRIPTION,
    "parameters": {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "The source code to analyze"
            },
            "language": {
                "type": "string",
                "description": "Programming language (e.g., ABAP, Python)",
                "default": "ABAP"
            }
        },
        "required": ["code"]
    }
}
