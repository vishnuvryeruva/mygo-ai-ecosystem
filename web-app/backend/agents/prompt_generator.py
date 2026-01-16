"""
Prompt Generator Agent
Generates optimized prompts for LLMs based on task description.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.prompt_service import PromptService

TOOL_NAME = "generate_prompt"
TOOL_DESCRIPTION = "Generate optimized LLM prompts for coding tasks"

def generate_prompt_tool(task: str, language: str = "ABAP", context: str = "") -> str:
    """
    Generate an optimized prompt for an LLM to complete a coding task.
    
    Args:
        task: Description of the task to accomplish
        language: Target programming language
        context: Optional additional context
    
    Returns:
        An optimized prompt for the LLM
    """
    service = PromptService()
    return service.generate_prompt(language, task, context)


TOOL_SCHEMA = {
    "name": TOOL_NAME,
    "description": TOOL_DESCRIPTION,
    "parameters": {
        "type": "object",
        "properties": {
            "task": {
                "type": "string",
                "description": "Description of the coding task"
            },
            "language": {
                "type": "string",
                "description": "Target programming language",
                "default": "ABAP"
            },
            "context": {
                "type": "string",
                "description": "Optional additional context or requirements",
                "default": ""
            }
        },
        "required": ["task"]
    }
}
