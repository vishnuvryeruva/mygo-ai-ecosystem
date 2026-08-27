"""
Verification test for LangChain Agent Engine, Observability Service & AI Credits
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from services.observability_service import ObservabilityService
from services.langchain_agent_service import LangGraphExecutionEngine, AgentState

def test_observability():
    print("=== Testing Observability & AI Credits Service ===")
    user_id = "test_user"
    credits = ObservabilityService.get_user_credits(user_id)
    print("Initial User Credits:", credits)
    
    # Test deduction
    deduction = ObservabilityService.deduct_credits(user_id, "AskYoda", prompt_tokens=150, completion_tokens=250)
    print("Credit Deduction Result:", deduction)
    
    # Test allocation
    topup = ObservabilityService.allocate_credits(user_id, 500.0, "Testing TopUp")
    print("TopUp Result:", topup)
    
    # Test LangGraph Execution Engine
    print("\n=== Testing LangGraph Execution Engine ===")
    def mock_agent_call():
        return "LangChain & LangGraph agent response generated successfully."

    output = LangGraphExecutionEngine.execute_agent_workflow(
        agent_name="AskYoda",
        user_prompt="Explain ABAP RAP CDS Views",
        system_prompt="You are Yoda SAP assistant",
        user_id=user_id,
        llm_provider="openai",
        execution_fn=mock_agent_call
    )
    print("Agent Workflow Output:", output)
    
    # Retrieve Traces
    traces = ObservabilityService.get_traces(user_id=user_id)
    print(f"Recorded Traces Count: {len(traces)}")
    if traces:
        t = traces[0]
        print("Trace ID:", t["trace_id"])
        print("Status:", t["status"])
        print("Latency (ms):", t["latency_ms"])
        print("Nodes Executed:", [n["node"] for n in t.get("nodes", [])])

if __name__ == "__main__":
    test_observability()
