"""
Spec Assistant Agent
Generates functional or technical specifications from requirements.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.spec_service import SpecService

TOOL_NAME = "generate_spec"
TOOL_DESCRIPTION = "Generate functional or technical specification documents from requirements"

def generate_spec_tool(requirements: str, spec_type: str = "functional") -> str:
    """
    Generate a specification document from requirements.
    
    Args:
        requirements: The requirements or description to base the spec on
        spec_type: Type of specification - 'functional' or 'technical'
    
    Returns:
        Generated specification as formatted text
    """
    service = SpecService()
    # Return as text format for MCP (not file download)
    return service.generate_spec(spec_type, requirements, 'text')


TOOL_SCHEMA = {
    "name": TOOL_NAME,
    "description": TOOL_DESCRIPTION,
    "parameters": {
        "type": "object",
        "properties": {
            "requirements": {
                "type": "string",
                "description": "The requirements or description to generate a spec from"
            },
            "spec_type": {
                "type": "string",
                "enum": ["functional", "technical"],
                "description": "Type of specification to generate",
                "default": "functional"
            }
        },
        "required": ["requirements"]
    }
}
