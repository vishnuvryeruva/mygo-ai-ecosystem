"""
Generate Tests Agent
Generates test cases for code (manual or unit tests).
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.test_service import TestService

TOOL_NAME = "generate_tests"
TOOL_DESCRIPTION = "Generate test cases for code - either manual test scenarios or unit tests"

def generate_tests_tool(code: str, test_type: str = "manual") -> str:
    """
    Generate test cases for the given code.
    
    Args:
        code: The source code to generate tests for
        test_type: Type of tests - 'manual' or 'unit'
    
    Returns:
        Generated test cases as formatted text
    """
    service = TestService()
    # Return as text format for MCP (not file download)
    return service.generate_test_cases(code, test_type, 'text')


TOOL_SCHEMA = {
    "name": TOOL_NAME,
    "description": TOOL_DESCRIPTION,
    "parameters": {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "The source code to generate tests for"
            },
            "test_type": {
                "type": "string",
                "enum": ["manual", "unit"],
                "description": "Type of tests: 'manual' for test scenarios, 'unit' for unit tests",
                "default": "manual"
            }
        },
        "required": ["code"]
    }
}
