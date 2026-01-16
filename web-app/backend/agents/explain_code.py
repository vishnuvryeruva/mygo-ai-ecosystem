"""
Explain Code Agent
Explains what a piece of code does in simple terms.
"""
from typing import Optional
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.code_service import CodeService

# Tool definition for MCP
TOOL_NAME = "explain_code"
TOOL_DESCRIPTION = "Explain what a piece of code does in simple, clear terms"

def explain_code_tool(code: str, language: str = "ABAP", program_name: str = "") -> str:
    """
    Explain what a piece of code does.
    
    Args:
        code: The source code to explain
        language: Programming language (default: ABAP)
        program_name: Optional program/class name for context
    
    Returns:
        A clear explanation of what the code does
    """
    service = CodeService()
    return service.explain_code(code, language, program_name)


# Schema for MCP tool registration
TOOL_SCHEMA = {
    "name": TOOL_NAME,
    "description": TOOL_DESCRIPTION,
    "parameters": {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "The source code to explain"
            },
            "language": {
                "type": "string",
                "description": "Programming language (e.g., ABAP, Python, JavaScript)",
                "default": "ABAP"
            },
            "program_name": {
                "type": "string",
                "description": "Optional program or class name for context",
                "default": ""
            }
        },
        "required": ["code"]
    }
}
