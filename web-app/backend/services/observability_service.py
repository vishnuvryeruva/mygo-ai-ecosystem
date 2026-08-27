"""
AI Credits & LangGraph Observability Service
Manages user credit balances, token metrics, credit deductions, and LangGraph trace persistence.
"""

import time
import uuid
import datetime
from typing import Dict, Any, List, Optional

# Global in-memory storage fallback (backed by database when connected)
_CREDITS_STORE: Dict[str, Dict[str, Any]] = {
    "default_user": {
        "user_id": "default_user",
        "balance": 5000.0,
        "total_allocated": 10000.0,
        "total_used": 5000.0,
        "tier": "ENTERPRISE",
        "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat()
    }
}

_TRACES_STORE: List[Dict[str, Any]] = []

class ObservabilityService:
    @staticmethod
    def get_user_credits(user_id: str = "default_user") -> Dict[str, Any]:
        """Fetch user credit balance, usage metrics, and tier."""
        if user_id not in _CREDITS_STORE:
            _CREDITS_STORE[user_id] = {
                "user_id": user_id,
                "balance": 5000.0,
                "total_allocated": 10000.0,
                "total_used": 5000.0,
                "tier": "PRO",
                "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
        return _CREDITS_STORE[user_id]

    @staticmethod
    def deduct_credits(user_id: str, agent_name: str, prompt_tokens: int, completion_tokens: int, cost_per_1k: float = 0.002) -> Dict[str, Any]:
        """Calculate and deduct AI credits based on token metrics."""
        user_info = ObservabilityService.get_user_credits(user_id)
        total_tokens = prompt_tokens + completion_tokens
        
        # Credit rate formula: 1 credit per 100 tokens (minimum 1 credit)
        credits_cost = max(1.0, round((total_tokens / 100.0) * 1.5, 2))
        
        user_info["balance"] = max(0.0, round(user_info["balance"] - credits_cost, 2))
        user_info["total_used"] = round(user_info["total_used"] + credits_cost, 2)
        user_info["last_updated"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        return {
            "deducted": credits_cost,
            "remaining_balance": user_info["balance"],
            "total_tokens": total_tokens
        }

    @staticmethod
    def allocate_credits(user_id: str = "default_user", amount: float = 1000.0, reason: str = "Manual Allocation") -> Dict[str, Any]:
        """Allocate or top up AI credits for a user."""
        user_info = ObservabilityService.get_user_credits(user_id)
        user_info["balance"] = round(user_info["balance"] + amount, 2)
        user_info["total_allocated"] = round(user_info["total_allocated"] + amount, 2)
        user_info["last_updated"] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        return user_info

    @staticmethod
    def record_trace(trace_data: Dict[str, Any]) -> Dict[str, Any]:
        """Record a LangGraph execution trace with step graph and metrics."""
        trace_id = trace_data.get("trace_id") or str(uuid.uuid4())
        trace_record = {
            "trace_id": trace_id,
            "agent_name": trace_data.get("agent_name", "UnknownAgent"),
            "user_id": trace_data.get("user_id", "default_user"),
            "status": trace_data.get("status", "SUCCESS"),
            "prompt_tokens": trace_data.get("prompt_tokens", 0),
            "completion_tokens": trace_data.get("completion_tokens", 0),
            "total_tokens": trace_data.get("prompt_tokens", 0) + trace_data.get("completion_tokens", 0),
            "credits_deducted": trace_data.get("credits_deducted", 0.0),
            "latency_ms": trace_data.get("latency_ms", 0),
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "nodes": trace_data.get("nodes", []),
            "input_preview": str(trace_data.get("input_preview", ""))[:200],
            "output_preview": str(trace_data.get("output_preview", ""))[:200]
        }
        
        _TRACES_STORE.insert(0, trace_record)
        # Cap traces store at 100 entries
        if len(_TRACES_STORE) > 100:
            _TRACES_STORE.pop()
            
        return trace_record

    @staticmethod
    def get_traces(limit: int = 50, agent_name: Optional[str] = None, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve recent LangGraph execution traces."""
        filtered = _TRACES_STORE
        if agent_name:
            filtered = [t for t in filtered if t.get("agent_name", "").lower() == agent_name.lower()]
        if user_id:
            filtered = [t for t in filtered if t.get("user_id") == user_id]
        return filtered[:limit]

    @staticmethod
    def get_trace_by_id(trace_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve detailed LangGraph trace by trace_id."""
        for t in _TRACES_STORE:
            if t.get("trace_id") == trace_id:
                return t
        return None
