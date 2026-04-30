"""
Solution Advisor Agent
Conversational advisor to gather requirements, explore existing solutions, and prepare for spec generation.
"""

import json
import re
from services.openai_service import OpenAIService

llm_service = OpenAIService()

REQUIREMENTS_SYSTEM_PROMPT = """You are an expert SAP Solution Architect helping users design solutions.
Your PRIMARY goal is to PROVIDE ANSWERS AND SOLUTIONS, not to ask questions.

When a user describes their requirements:
1. Acknowledge their requirements and provide a concise initial solution approach (3-5 sentences)
2. Include specific SAP recommendations: modules, transactions, BAPIs, or function modules
3. ONLY set needs_clarification to true if a CRITICAL piece of information is missing that would fundamentally change the solution

RULES:
- If requirements are at least 60% clear, proceed with a solution and note assumptions
- If you must ask, ask only ONE critical question
- Keep the response concise — the full detailed solution is generated in the next step
- Default to needs_clarification: false

You MUST return a JSON object with these three keys:
  "needs_clarification": a boolean, true or false
  "clarifications": plain text only — your concise solution approach or clarifying question. NEVER put JSON, code blocks, or markdown fences inside this field.
  "summary": plain text only — one sentence describing the requirement"""


def _extract_json(text: str) -> dict:
    """
    Parse JSON from LLM response text.
    Handles markdown fences and extracts the first valid JSON object.
    """
    # Strip markdown fences
    text = re.sub(r'^```(?:json)?\s*', '', text.strip(), flags=re.MULTILINE)
    text = re.sub(r'```\s*$', '', text.strip(), flags=re.MULTILINE)
    text = text.strip()

    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Find and extract first complete JSON object using brace matching
    start = text.find('{')
    if start == -1:
        raise ValueError(f"No JSON object found in response: {text[:200]}")

    depth = 0
    in_string = False
    escape_next = False

    for i, ch in enumerate(text[start:], start=start):
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return json.loads(text[start:i + 1])

    raise ValueError(f"Incomplete JSON object in response: {text[:200]}")


def gather_requirements(user_input: str, llm_provider: str = "openai") -> dict:
    """
    Step 1: Analyze user requirements and return a structured JSON response.
    Uses json_mode=True for OpenAI to guarantee valid JSON output.
    """
    response_text = llm_service.chat_completion(
        messages=[
            {"role": "system", "content": REQUIREMENTS_SYSTEM_PROMPT},
            {"role": "user", "content": user_input},
        ],
        temperature=0.2,
        max_tokens=1000,
        provider=llm_provider,
        json_mode=(llm_provider not in ("claude", "gemini")),
    )

    try:
        result = _extract_json(response_text)

        clarifications = str(result.get("clarifications", "") or "")
        summary = str(result.get("summary", "") or "")

        # Guard: if clarifications contains an embedded JSON blob, extract the
        # inner "clarifications" value from it so the field is always plain text.
        if clarifications.strip().startswith("{") or "```" in clarifications:
            try:
                inner = _extract_json(clarifications)
                clarifications = str(inner.get("clarifications", clarifications) or clarifications)
                if not summary:
                    summary = str(inner.get("summary", "") or "")
            except Exception:
                # Strip any fences and keep whatever text remains
                clarifications = re.sub(r'```(?:json)?', '', clarifications).strip()

        return {
            "needs_clarification": bool(result.get("needs_clarification", False)),
            "clarifications": clarifications or response_text,
            "summary": summary,
        }
    except Exception:
        # Last-resort fallback: treat the raw text as the clarification
        return {
            "needs_clarification": False,
            "clarifications": response_text,
            "summary": "Generated requirement guidance.",
        }


def generate_solution(requirements: str, llm_provider: str = "openai") -> dict:
    """
    Step 2: Generate a comprehensive solution proposal based on requirements.
    """
    response_text = llm_service.chat_completion(
        messages=[
            {
                "role": "system",
                "content": """You are a Senior SAP Solution Architect with deep expertise in ABAP development, Fiori apps, and SAP integrations.

Generate a comprehensive, actionable solution proposal that includes:

1. **Solution Overview**: Clear description of the proposed approach
2. **Recommended SAP Modules**: Specific SAP modules involved (PP, MM, SD, etc.)
3. **Technical Components**:
   - Custom tables (Z-tables) with suggested field structures
   - ABAP programs/reports needed
   - Function modules or BAPIs to use
   - Relevant SAP standard transactions
4. **Fiori App Design** (if applicable):
   - App type (Transactional, Analytical, Factsheet)
   - OData services needed
   - UI5 components
5. **Data Flow & Process**: Step-by-step process outline
6. **Integration Points**: External systems, IDocs, RFCs
7. **Standard Function Modules**: List specific SAP FM/BAPIs like:
   - CS_BOM_EXPL_MAT_V2 for BOM explosion
   - BAPI_MATERIAL_SAVEDATA for material creation
   - CSAP_MAT_BOM_CREATE for BOM creation
   - CPCC_S_OPER_MODIFY for routing operations
8. **Implementation Considerations**: Risks, dependencies, timeline estimates

Be specific and technical. Provide actual SAP object names, not generic placeholders.
Format your response in clear markdown with headers.""",
            },
            {
                "role": "user",
                "content": f"Requirements:\n{requirements}\n\nPlease generate a detailed SAP solution proposal.",
            },
        ],
        temperature=0.3,
        max_tokens=4000,
        provider=llm_provider,
    )

    return {"solution": response_text}


def refine_solution(requirements: str, current_solution: str, feedback: str, llm_provider: str = "openai") -> dict:
    """
    Refine the solution based on user feedback.
    """
    response_text = llm_service.chat_completion(
        messages=[
            {
                "role": "system",
                "content": "You are a Solution Architect. The user has provided feedback on a solution proposal. Update the solution based on their feedback while maintaining the overall structure.",
            },
            {
                "role": "user",
                "content": f"Original Requirements:\n{requirements}\n\nCurrent Solution:\n{current_solution}\n\nUser Feedback:\n{feedback}\n\nPlease update the solution based on the feedback.",
            },
        ],
        temperature=0.3,
        max_tokens=3500,
        provider=llm_provider,
    )

    return {"solution": response_text}


def search_similar_solutions(solution_summary: str, rag_service, llm_provider: str = "openai") -> dict:
    """
    Step 3: Search for similar solutions in the knowledge base using RAG.
    """
    try:
        result = rag_service.query(solution_summary, top_k=5, llm_provider=llm_provider)

        similar_solutions = []
        for ref in result.get("references", []):
            similar_solutions.append({
                "title": ref.get("document_name", "Unknown Document"),
                "summary": f"Source: {ref.get('source', 'N/A')}, Project: {ref.get('project', 'N/A')}, Type: {ref.get('doc_type', 'Document')}",
                "relevance": 0.5,
            })

        return {
            "similar_solutions": similar_solutions,
            "count": len(similar_solutions),
            "analysis": result.get("answer", ""),
        }
    except Exception as e:
        return {"similar_solutions": [], "count": 0, "error": str(e)}


def improvise_solution(requirements: str, current_solution: str, similar_solutions: list, user_input: str, llm_provider: str = "openai") -> dict:
    """
    Step 4: Improvise the solution by incorporating insights from similar solutions.
    """
    similar_context = "\n".join([f"- {s}" for s in similar_solutions]) if similar_solutions else "No similar solutions found."

    response_text = llm_service.chat_completion(
        messages=[
            {
                "role": "system",
                "content": "You are a Solution Architect. The user wants to incorporate insights from existing solutions. Review the current solution, similar solutions from the knowledge base, and user input. Provide an improved final solution that combines the best of all sources.",
            },
            {
                "role": "user",
                "content": f"Requirements:\n{requirements}\n\nCurrent Solution:\n{current_solution}\n\nSimilar Solutions Found:\n{similar_context}\n\nUser Input:\n{user_input}\n\nPlease provide an improved and finalized solution.",
            },
        ],
        temperature=0.3,
        max_tokens=3500,
        provider=llm_provider,
    )

    return {
        "final_solution": response_text,
        "message": "I've incorporated the insights and finalized the solution. It's now ready for functional specification generation.",
    }


def prepare_for_spec(final_solution: str, llm_provider: str = "openai") -> dict:
    """
    Step 5: Prepare the solution for handoff to Spec Assistant.
    """
    response_text = llm_service.chat_completion(
        messages=[
            {
                "role": "system",
                "content": "Convert the solution proposal into a format suitable for functional specification generation. Extract and organize: 1. Business Requirements 2. Functional Requirements 3. Technical Requirements 4. Scope boundaries 5. Assumptions",
            },
            {"role": "user", "content": f"Solution:\n{final_solution}"},
        ],
        temperature=0.2,
        max_tokens=2500,
        provider=llm_provider,
    )

    return {"spec_requirements": response_text}
