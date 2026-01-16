"""
MCP (Model Context Protocol) Server for ABAP AI Ecosystem

This server exposes AI agents as MCP tools that can be consumed by:
- Web App
- Eclipse Plugin  
- Any MCP-compatible client

Run with: python mcp_server.py
Or via MCP Inspector: mcp dev mcp_server.py
"""
import os
import sys
import json
from typing import Any

# Ensure the backend directory is in the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Import agent tools
from agents.explain_code import explain_code_tool, TOOL_SCHEMA as EXPLAIN_SCHEMA
from agents.analyze_code import analyze_code_tool, TOOL_SCHEMA as ANALYZE_SCHEMA
from agents.refactor_code import refactor_code_tool, TOOL_SCHEMA as REFACTOR_SCHEMA
from agents.generate_tests import generate_tests_tool, TOOL_SCHEMA as TESTS_SCHEMA
from agents.spec_assistant import generate_spec_tool, TOOL_SCHEMA as SPEC_SCHEMA
from agents.prompt_generator import generate_prompt_tool, TOOL_SCHEMA as PROMPT_SCHEMA
from agents.ask_yoda import ask_yoda_tool, TOOL_SCHEMA as YODA_SCHEMA

# Registry of all available tools
TOOLS = {
    "explain_code": {
        "function": explain_code_tool,
        "schema": EXPLAIN_SCHEMA
    },
    "analyze_code": {
        "function": analyze_code_tool,
        "schema": ANALYZE_SCHEMA
    },
    "refactor_code": {
        "function": refactor_code_tool,
        "schema": REFACTOR_SCHEMA
    },
    "generate_tests": {
        "function": generate_tests_tool,
        "schema": TESTS_SCHEMA
    },
    "generate_spec": {
        "function": generate_spec_tool,
        "schema": SPEC_SCHEMA
    },
    "generate_prompt": {
        "function": generate_prompt_tool,
        "schema": PROMPT_SCHEMA
    },
    "ask_yoda": {
        "function": ask_yoda_tool,
        "schema": YODA_SCHEMA
    }
}


def list_tools() -> list:
    """Return list of available tools with their schemas"""
    return [tool["schema"] for tool in TOOLS.values()]


def execute_tool(tool_name: str, inputs: dict) -> Any:
    """Execute a tool by name with given inputs"""
    if tool_name not in TOOLS:
        raise ValueError(f"Unknown tool: {tool_name}. Available: {list(TOOLS.keys())}")
    
    tool_func = TOOLS[tool_name]["function"]
    return tool_func(**inputs)


def get_tool_schema(tool_name: str) -> dict:
    """Get schema for a specific tool"""
    if tool_name not in TOOLS:
        raise ValueError(f"Unknown tool: {tool_name}")
    return TOOLS[tool_name]["schema"]


# FastMCP server setup (optional - for native MCP protocol)
try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import Tool, TextContent
    
    app = Server("abap-ai-ecosystem")
    
    @app.list_tools()
    async def handle_list_tools():
        """List available MCP tools"""
        tools = []
        for name, tool_data in TOOLS.items():
            schema = tool_data["schema"]
            tools.append(Tool(
                name=schema["name"],
                description=schema["description"],
                inputSchema=schema["parameters"]
            ))
        return tools
    
    @app.call_tool()
    async def handle_call_tool(name: str, arguments: dict):
        """Execute an MCP tool"""
        try:
            result = execute_tool(name, arguments)
            # Convert result to string if needed
            if isinstance(result, dict):
                result = json.dumps(result, indent=2)
            return [TextContent(type="text", text=str(result))]
        except Exception as e:
            return [TextContent(type="text", text=f"Error: {str(e)}")]
    
    async def main():
        """Run the MCP server"""
        async with stdio_server() as (read_stream, write_stream):
            await app.run(read_stream, write_stream, app.create_initialization_options())
    
    MCP_AVAILABLE = True
    
except ImportError:
    MCP_AVAILABLE = False
    print("Note: MCP SDK not installed. HTTP endpoints still available.")
    print("Install with: pip install mcp")


if __name__ == "__main__":
    if MCP_AVAILABLE:
        import asyncio
        print("Starting ABAP AI Ecosystem MCP Server...")
        print(f"Available tools: {list(TOOLS.keys())}")
        asyncio.run(main())
    else:
        print("MCP SDK not installed. Use HTTP endpoints via Flask app instead.")
        print("Available tools:", list(TOOLS.keys()))
