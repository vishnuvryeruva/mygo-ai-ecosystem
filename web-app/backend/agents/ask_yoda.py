"""
Ask Yoda Agent
RAG-based Q&A using uploaded documents for context.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.rag_service import RAGService

TOOL_NAME = "ask_yoda"
TOOL_DESCRIPTION = "Ask questions and get answers based on uploaded knowledge documents (RAG)"

def ask_yoda_tool(query: str) -> str:
    """
    Ask a question and get an answer based on uploaded documents.
    
    Args:
        query: The question to ask
    
    Returns:
        An answer based on the knowledge base
    """
    service = RAGService()
    return service.query(query)


TOOL_SCHEMA = {
    "name": TOOL_NAME,
    "description": TOOL_DESCRIPTION,
    "parameters": {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The question to ask"
            }
        },
        "required": ["query"]
    }
}
