"""
Verification test for SAP ADT MCP Integration Service
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from services.sap_adt_mcp_service import ADTMCPClient, ADTMCPService

def test_adt_mcp():
    print("=== Testing SAP ADT MCP Service Initialization ===")
    client = ADTMCPClient(endpoint_url="http://localhost:2236/mcp")
    print(f"Base URL: {client.base_url}")
    print(f"Headers: {client.headers}")
    
    # Test tool payload construction
    res = client.call_tool("abap_lists_destinations", {})
    print("Tool call result:", res)

if __name__ == "__main__":
    test_adt_mcp()
