"""
Refactor Code Agent
Refactors code to improve quality, readability, and performance.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.prompts import render_prompt
from services.openai_service import OpenAIService

TOOL_NAME = "refactor_code"
TOOL_DESCRIPTION = "Refactor code to improve quality, readability, and apply best practices"

def refactor_code_tool(code: str, language: str = "ABAP") -> str:
    """
    Refactor code to improve its quality.
    
    Args:
        code: The source code to refactor
        language: Programming language (default: ABAP)
    
    Returns:
        The refactored code with improvements applied
    """
    openai_service = OpenAIService()
    
    system_prompt = render_prompt(
        "refactor_code",
        "system",
        language=language,
    )
    user_prompt = render_prompt(
        "refactor_code",
        "user_template",
        language=language,
        language_lower=language.lower(),
        code=code,
    )

    refactored = openai_service.generate_text(
        user_prompt,
        system_prompt=system_prompt,
        temperature=0.2,
        max_tokens=3000
    )
    
    # Clean up markdown formatting if present
    refactored = refactored.strip()
    if refactored.startswith(f'```{language.lower()}'):
        refactored = refactored[len(f'```{language.lower()}'):]
    if refactored.startswith('```'):
        refactored = refactored[3:]
    if refactored.endswith('```'):
        refactored = refactored[:-3]
    
    return refactored.strip()


TOOL_SCHEMA = {
    "name": TOOL_NAME,
    "description": TOOL_DESCRIPTION,
    "parameters": {
        "type": "object",
        "properties": {
            "code": {
                "type": "string",
                "description": "The source code to refactor"
            },
            "language": {
                "type": "string",
                "description": "Programming language",
                "default": "ABAP"
            }
        },
        "required": ["code"]
    }
}
