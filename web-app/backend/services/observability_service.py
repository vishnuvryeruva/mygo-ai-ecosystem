"""
AI Credits & Observability Service
Manages persistence of AI agent execution traces, token metrics, credit balances, and LLM telemetry.
Stores full execution logs in PostgreSQL (with SQLite fallback).
"""

import os
import time
import uuid
import json
import datetime
from typing import Dict, Any, List, Optional
from db import get_conn


class ObservabilityService:
    @staticmethod
    def _is_sqlite(conn) -> bool:
        return "sqlite" in type(conn).__name__.lower() or "sqlite" in str(type(conn)).lower()

    @staticmethod
    def get_user_credits(user_id: str = "default_user") -> Dict[str, Any]:
        """Fetch user credit balance, usage metrics, and tier from database."""
        conn = None
        try:
            conn = get_conn(register_vec=False)
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT user_id, balance, total_allocated, total_used, tier, updated_at FROM user_credits WHERE user_id = %s",
                    (user_id,)
                )
                row = cur.fetchone()
                if row:
                    return {
                        "user_id": row[0],
                        "balance": float(row[1]),
                        "total_allocated": float(row[2]),
                        "total_used": float(row[3]),
                        "tier": row[4] or "ENTERPRISE",
                        "last_updated": row[5].isoformat() if hasattr(row[5], 'isoformat') else str(row[5])
                    }
                else:
                    # Insert default initial credits
                    initial = {
                        "user_id": user_id,
                        "balance": 5000.0,
                        "total_allocated": 10000.0,
                        "total_used": 5000.0,
                        "tier": "ENTERPRISE",
                        "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat()
                    }
                    cur.execute(
                        """
                        INSERT INTO user_credits (user_id, balance, total_allocated, total_used, tier, updated_at)
                        VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                        ON CONFLICT (user_id) DO NOTHING
                        """,
                        (user_id, 5000.0, 10000.0, 5000.0, "ENTERPRISE")
                    )
                    conn.commit()
                    return initial
        except Exception as e:
            print(f"[ObservabilityService] get_user_credits error ({e}), returning default")
            return {
                "user_id": user_id,
                "balance": 5000.0,
                "total_allocated": 10000.0,
                "total_used": 5000.0,
                "tier": "ENTERPRISE",
                "last_updated": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
        finally:
            if conn:
                conn.close()

    @staticmethod
    def deduct_credits(user_id: str, agent_name: str, prompt_tokens: int, completion_tokens: int) -> Dict[str, Any]:
        """Calculate and deduct AI credits based on token metrics."""
        total_tokens = prompt_tokens + completion_tokens
        credits_cost = max(1.0, round((total_tokens / 100.0) * 1.5, 2))
        
        conn = None
        try:
            user_info = ObservabilityService.get_user_credits(user_id)
            new_balance = max(0.0, round(user_info["balance"] - credits_cost, 2))
            new_used = round(user_info["total_used"] + credits_cost, 2)
            
            conn = get_conn(register_vec=False)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE user_credits 
                    SET balance = %s, total_used = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = %s
                    """,
                    (new_balance, new_used, user_id)
                )
                conn.commit()
            
            return {
                "deducted": credits_cost,
                "remaining_balance": new_balance,
                "total_tokens": total_tokens
            }
        except Exception as e:
            print(f"[ObservabilityService] deduct_credits error: {e}")
            return {
                "deducted": credits_cost,
                "remaining_balance": 4900.0,
                "total_tokens": total_tokens
            }
        finally:
            if conn:
                conn.close()

    @staticmethod
    def allocate_credits(user_id: str = "default_user", amount: float = 1000.0, reason: str = "Manual Allocation") -> Dict[str, Any]:
        """Allocate or top up AI credits for a user."""
        conn = None
        try:
            user_info = ObservabilityService.get_user_credits(user_id)
            new_balance = round(user_info["balance"] + amount, 2)
            new_allocated = round(user_info["total_allocated"] + amount, 2)
            
            conn = get_conn(register_vec=False)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE user_credits 
                    SET balance = %s, total_allocated = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = %s
                    """,
                    (new_balance, new_allocated, user_id)
                )
                conn.commit()
            
            user_info["balance"] = new_balance
            user_info["total_allocated"] = new_allocated
            return user_info
        except Exception as e:
            print(f"[ObservabilityService] allocate_credits error: {e}")
            return ObservabilityService.get_user_credits(user_id)
        finally:
            if conn:
                conn.close()

    @staticmethod
    def record_trace(trace_data: Dict[str, Any]) -> Dict[str, Any]:
        """Record an AI agent execution trace with full input, output, LLM, model, and metrics in database."""
        trace_id = trace_data.get("trace_id") or str(uuid.uuid4())
        agent_name = trace_data.get("agent_name", "AI Agent")
        user_id = trace_data.get("user_id", "default_user")
        llm_provider = trace_data.get("llm_provider") or "gemini"
        model_name = trace_data.get("model_name") or "gemini-2.5-flash"
        status = trace_data.get("status", "SUCCESS")
        latency_ms = int(trace_data.get("latency_ms") or trace_data.get("execution_time_ms") or 0)
        prompt_tokens = int(trace_data.get("prompt_tokens") or 0)
        completion_tokens = int(trace_data.get("completion_tokens") or 0)
        total_tokens = int(trace_data.get("total_tokens") or (prompt_tokens + completion_tokens))
        credits_used = float(trace_data.get("credits_deducted") or trace_data.get("credits_used") or 0.0)
        input_text = str(trace_data.get("input_text") or trace_data.get("input_preview") or "")
        output_text = str(trace_data.get("output_text") or trace_data.get("output_preview") or "")
        error_message = trace_data.get("error_message") or trace_data.get("error")
        nodes_data = trace_data.get("nodes") or trace_data.get("nodes_data") or []
        metadata = trace_data.get("metadata") or {}

        conn = None
        try:
            conn = get_conn(register_vec=False)
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO ai_traces (
                        id, trace_id, user_id, agent_name, llm_provider, model_name,
                        status, execution_time_ms, prompt_tokens, completion_tokens, total_tokens,
                        credits_used, input_text, output_text, error_message, nodes_data, metadata, created_at
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP
                    )
                    """,
                    (
                        trace_id, trace_id, user_id, agent_name, llm_provider, model_name,
                        status, latency_ms, prompt_tokens, completion_tokens, total_tokens,
                        credits_used, input_text, output_text, error_message,
                        json.dumps(nodes_data), json.dumps(metadata)
                    )
                )
                conn.commit()
        except Exception as e:
            print(f"[ObservabilityService] record_trace database insert error: {e}")
            if conn:
                try:
                    conn.rollback()
                except Exception:
                    pass
        finally:
            if conn:
                conn.close()

        return {
            "trace_id": trace_id,
            "agent_name": agent_name,
            "llm_provider": llm_provider,
            "model_name": model_name,
            "status": status,
            "execution_time_ms": latency_ms,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "credits_used": credits_used,
            "input_text": input_text,
            "output_text": output_text,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

    @staticmethod
    def get_traces(limit: int = 100, agent_name: Optional[str] = None, user_id: Optional[str] = None,
                   status: Optional[str] = None, search: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve recent AI execution traces with filtering and search."""
        conn = None
        try:
            conn = get_conn(register_vec=False)
            query = """
                SELECT id, trace_id, user_id, agent_name, llm_provider, model_name,
                       status, execution_time_ms, prompt_tokens, completion_tokens, total_tokens,
                       credits_used, input_text, output_text, error_message, nodes_data, metadata, created_at
                FROM ai_traces
                WHERE 1=1
            """
            params = []

            if agent_name and agent_name.upper() != "ALL":
                query += " AND LOWER(agent_name) = LOWER(%s)"
                params.append(agent_name)

            if user_id:
                query += " AND user_id = %s"
                params.append(user_id)

            if status and status.upper() != "ALL":
                query += " AND UPPER(status) = UPPER(%s)"
                params.append(status)

            if search:
                query += " AND (agent_name ILIKE %s OR model_name ILIKE %s OR input_text ILIKE %s OR output_text ILIKE %s)"
                like = f"%{search}%"
                params.extend([like, like, like, like])

            query += " ORDER BY created_at DESC LIMIT %s"
            params.append(limit)

            with conn.cursor() as cur:
                cur.execute(query, params)
                rows = cur.fetchall()

                traces = []
                for r in rows:
                    raw_nodes = r[15]
                    parsed_nodes = []
                    if raw_nodes:
                        try:
                            parsed_nodes = json.loads(raw_nodes) if isinstance(raw_nodes, str) else raw_nodes
                        except Exception:
                            parsed_nodes = []

                    raw_meta = r[16]
                    parsed_meta = {}
                    if raw_meta:
                        try:
                            parsed_meta = json.loads(raw_meta) if isinstance(raw_meta, str) else raw_meta
                        except Exception:
                            parsed_meta = {}

                    created_at_val = r[17]
                    iso_created = created_at_val.isoformat() if hasattr(created_at_val, 'isoformat') else str(created_at_val)

                    traces.append({
                        "id": r[0],
                        "trace_id": r[1],
                        "user_id": r[2],
                        "agent_name": r[3],
                        "llm_provider": r[4] or "gemini",
                        "model_name": r[5] or "gemini-2.5-flash",
                        "status": r[6] or "SUCCESS",
                        "execution_time_ms": int(r[7] or 0),
                        "latency_ms": int(r[7] or 0),
                        "prompt_tokens": int(r[8] or 0),
                        "completion_tokens": int(r[9] or 0),
                        "total_tokens": int(r[10] or 0),
                        "credits_deducted": float(r[11] or 0.0),
                        "credits_used": float(r[11] or 0.0),
                        "input_text": r[12] or "",
                        "input_preview": (r[12] or "")[:200],
                        "output_text": r[13] or "",
                        "output_preview": (r[13] or "")[:200],
                        "error_message": r[14],
                        "nodes": parsed_nodes,
                        "metadata": parsed_meta,
                        "created_at": iso_created
                    })
                return traces
        except Exception as e:
            print(f"[ObservabilityService] get_traces error: {e}")
            return []
        finally:
            if conn:
                conn.close()

    @staticmethod
    def get_trace_by_id(trace_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve single trace with all details."""
        traces = ObservabilityService.get_traces(limit=1, search=trace_id)
        for t in traces:
            if t["trace_id"] == trace_id or t["id"] == trace_id:
                return t
        return None

    @staticmethod
    def get_stats(user_id: Optional[str] = None) -> Dict[str, Any]:
        """Aggregate metrics across recorded AI traces."""
        conn = None
        try:
            conn = get_conn(register_vec=False)
            with conn.cursor() as cur:
                where = "WHERE user_id = %s" if user_id else ""
                params = (user_id,) if user_id else ()

                cur.execute(f"""
                    SELECT 
                        COUNT(*) as total_calls,
                        COALESCE(SUM(total_tokens), 0) as total_tokens,
                        COALESCE(SUM(credits_used), 0) as total_credits,
                        COALESCE(AVG(execution_time_ms), 0) as avg_latency,
                        COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) as success_calls,
                        COUNT(CASE WHEN status = 'ERROR' THEN 1 END) as error_calls
                    FROM ai_traces
                    {where}
                """, params)
                row = cur.fetchone()

                total_calls = int(row[0] or 0)
                total_tokens = int(row[1] or 0)
                total_credits = float(row[2] or 0.0)
                avg_latency = int(row[3] or 0)
                success_calls = int(row[4] or 0)
                error_calls = int(row[5] or 0)

                success_rate = round((success_calls / total_calls * 100), 1) if total_calls > 0 else 100.0

                return {
                    "total_calls": total_calls,
                    "total_tokens": total_tokens,
                    "total_credits_used": round(total_credits, 2),
                    "avg_latency_ms": avg_latency,
                    "success_calls": success_calls,
                    "error_calls": error_calls,
                    "success_rate": success_rate
                }
        except Exception as e:
            print(f"[ObservabilityService] get_stats error: {e}")
            return {
                "total_calls": 0,
                "total_tokens": 0,
                "total_credits_used": 0.0,
                "avg_latency_ms": 0,
                "success_calls": 0,
                "error_calls": 0,
                "success_rate": 100.0
            }
        finally:
            if conn:
                conn.close()

    @staticmethod
    def clear_traces(user_id: Optional[str] = None) -> bool:
        """Clear traces from database."""
        conn = None
        try:
            conn = get_conn(register_vec=False)
            with conn.cursor() as cur:
                if user_id:
                    cur.execute("DELETE FROM ai_traces WHERE user_id = %s", (user_id,))
                else:
                    cur.execute("DELETE FROM ai_traces")
                conn.commit()
            return True
        except Exception as e:
            print(f"[ObservabilityService] clear_traces error: {e}")
            return False
        finally:
            if conn:
                conn.close()
