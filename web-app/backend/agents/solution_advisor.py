"""
Solution Advisor Agent
Conversational advisor to gather requirements, explore existing solutions, and prepare for spec generation.
"""

import json
from services.openai_service import OpenAIService

llm_service = OpenAIService()


def gather_requirements(user_input: str, llm_provider: str = "openai") -> dict:
    """
    Step 1: Analyze user requirements and provide a preliminary solution approach.
    Only ask clarifying questions if critical information is missing.
    """
    response_text = llm_service.chat_completion(
        messages=[
            {
                "role": "system",
                "content": """You are an expert SAP Solution Architect helping users design solutions.
Your PRIMARY goal is to PROVIDE ANSWERS AND SOLUTIONS, not to ask questions.

When a user describes their requirements:
1. FIRST, acknowledge their requirements and provide an initial solution approach
2. Include specific recommendations, SAP modules, function modules, or technical approaches
3. ONLY ask a clarifying question if there is a CRITICAL piece of information missing that would fundamentally change the solution

IMPORTANT GUIDELINES:
- Be proactive and provide value immediately
- If requirements are at least 60% clear, proceed with a solution and note any assumptions
- Avoid asking multiple questions - if you must ask, ask only ONE critical question
- Include specific SAP technical recommendations (tables, BAPIs, function modules, transactions)
- Provide actionable insights, not generic responses

Respond in JSON format:
{
    "needs_clarification": true/false,
    "clarifications": "Your solution approach, recommendations, and any single critical question if needed",
    "summary": "A brief summary of the requirements and proposed approach"
}

Default to needs_clarification: false unless critical information is missing."""
            },
            {
                "role": "user",
                "content": user_input
            }
        ],
        temperature=0.2,
        max_tokens=2000,
        provider=llm_provider
    )
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        return {
            "needs_clarification": False,
            "clarifications": response_text,
            "summary": "Generated requirement guidance."
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
Format your response in clear markdown with headers."""
            },
            {
                "role": "user",
                "content": f"Requirements:\n{requirements}\n\nPlease generate a detailed SAP solution proposal."
            }
        ],
        temperature=0.3,
        max_tokens=4000,
        provider=llm_provider
    )
    
    return {
        "solution": response_text
    }


def refine_solution(requirements: str, current_solution: str, feedback: str, llm_provider: str = "openai") -> dict:
    """
    Refine the solution based on user feedback.
    """
    response_text = llm_service.chat_completion(
        messages=[
            {
                "role": "system",
                "content": """You are a Solution Architect. The user has provided feedback on a solution proposal.
Update the solution based on their feedback while maintaining the overall structure."""
            },
            {
                "role": "user",
                "content": f"""Original Requirements:
{requirements}

Current Solution:
{current_solution}

User Feedback:
{feedback}

Please update the solution based on the feedback."""
            }
        ],
        temperature=0.3,
        max_tokens=3500,
        provider=llm_provider
    )
    
    return {
        "solution": response_text
    }


def search_similar_solutions(solution_summary: str, rag_service, llm_provider: str = "openai") -> dict:
    """
    Step 3: Search for similar solutions in the knowledge base using RAG.
    """
    # Use the RAG service to find similar documents
    try:
        result = rag_service.query(solution_summary, top_k=5, llm_provider=llm_provider)
        
        # Build similar solutions from references
        similar_solutions = []
        for ref in result.get("references", []):
            similar_solutions.append({
                "title": ref.get("document_name", "Unknown Document"),
                "summary": f"Source: {ref.get('source', 'N/A')}, Project: {ref.get('project', 'N/A')}, Type: {ref.get('doc_type', 'Document')}",
                "relevance": 0.5
            })
        
        return {
            "similar_solutions": similar_solutions,
            "count": len(similar_solutions),
            "analysis": result.get("answer", "")
        }
    except Exception as e:
        return {
            "similar_solutions": [],
            "count": 0,
            "error": str(e)
        }


def improvise_solution(requirements: str, current_solution: str, similar_solutions: list, user_input: str, llm_provider: str = "openai") -> dict:
    """
    Step 4: Improvise the solution by incorporating insights from similar solutions.
    """
    similar_context = "\n".join([f"- {s}" for s in similar_solutions]) if similar_solutions else "No similar solutions found."
    
    response_text = llm_service.chat_completion(
        messages=[
            {
                "role": "system",
                "content": """You are a Solution Architect. The user wants to incorporate insights from existing solutions.
Review the current solution, similar solutions from the knowledge base, and user input.
Provide an improved final solution that combines the best of all sources."""
            },
            {
                "role": "user",
                "content": f"""Requirements:
{requirements}

Current Solution:
{current_solution}

Similar Solutions Found:
{similar_context}

User Input:
{user_input}

Please provide an improved and finalized solution."""
            }
        ],
        temperature=0.3,
        max_tokens=3500,
        provider=llm_provider
    )
    
    return {
        "final_solution": response_text,
        "message": "I've incorporated the insights and finalized the solution. It's now ready for functional specification generation."
    }


def prepare_for_spec(final_solution: str, llm_provider: str = "openai") -> dict:
    """
    Step 5: Prepare the solution for handoff to Spec Assistant.
    """
    response_text = llm_service.chat_completion(
        messages=[
            {
                "role": "system",
                "content": """Convert the solution proposal into a format suitable for functional specification generation.
Extract and organize:
1. Business Requirements
2. Functional Requirements
3. Technical Requirements
4. Scope boundaries
5. Assumptions"""
            },
            {
                "role": "user",
                "content": f"Solution:\n{final_solution}"
            }
        ],
        temperature=0.2,
        max_tokens=2500,
        provider=llm_provider
    )
    
    return {
        "spec_requirements": response_text
    }
