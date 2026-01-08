"""
Solution Advisor Agent
Conversational advisor to gather requirements, explore existing solutions, and prepare for spec generation.
"""

from openai import OpenAI
import os

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


def gather_requirements(user_input: str) -> dict:
    """
    Step 1: Analyze user requirements and ask clarifying questions if needed.
    """
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": """You are a Solution Advisor helping users define their requirements clearly. 
Your task is to analyze the user's input and determine:
1. If the requirements are clear enough to proceed with solution design
2. If not, what clarifying questions should be asked

Respond in JSON format:
{
    "needs_clarification": true/false,
    "clarifications": "Your response or questions here",
    "summary": "A brief summary of the requirements understood so far"
}

Be friendly and helpful. Ask at most 2-3 clarifying questions at a time."""
            },
            {
                "role": "user",
                "content": user_input
            }
        ],
        response_format={"type": "json_object"}
    )
    
    import json
    result = json.loads(response.choices[0].message.content)
    return result


def generate_solution(requirements: str) -> dict:
    """
    Step 2: Generate a solution proposal based on requirements.
    """
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": """You are a Solution Architect helping design SAP/ABAP solutions.
Based on the requirements provided, generate a comprehensive solution proposal that includes:

1. **Solution Overview**: High-level description of the proposed approach
2. **Key Components**: Main modules/objects to be developed
3. **Technical Approach**: ABAP objects, tables, interfaces needed
4. **Integration Points**: External systems or existing modules to integrate with
5. **Considerations**: Any risks, dependencies, or special considerations

Format your response in clear markdown with headers."""
            },
            {
                "role": "user",
                "content": f"Requirements:\n{requirements}\n\nPlease generate a solution proposal."
            }
        ]
    )
    
    return {
        "solution": response.choices[0].message.content
    }


def refine_solution(requirements: str, current_solution: str, feedback: str) -> dict:
    """
    Refine the solution based on user feedback.
    """
    response = client.chat.completions.create(
        model=MODEL,
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
        ]
    )
    
    return {
        "solution": response.choices[0].message.content
    }


def search_similar_solutions(solution_summary: str, rag_service) -> dict:
    """
    Step 3: Search for similar solutions in the knowledge base using RAG.
    """
    # Use the RAG service to find similar documents
    try:
        results = rag_service.query(solution_summary, top_k=5)
        
        similar_solutions = []
        for result in results:
            similar_solutions.append({
                "title": result.get("metadata", {}).get("filename", "Unknown Document"),
                "summary": result.get("content", "")[:500] + "...",
                "relevance": result.get("score", 0.5)
            })
        
        return {
            "similar_solutions": similar_solutions,
            "count": len(similar_solutions)
        }
    except Exception as e:
        return {
            "similar_solutions": [],
            "count": 0,
            "error": str(e)
        }


def improvise_solution(requirements: str, current_solution: str, similar_solutions: list, user_input: str) -> dict:
    """
    Step 4: Improvise the solution by incorporating insights from similar solutions.
    """
    similar_context = "\n".join([f"- {s}" for s in similar_solutions]) if similar_solutions else "No similar solutions found."
    
    response = client.chat.completions.create(
        model=MODEL,
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
        ]
    )
    
    return {
        "final_solution": response.choices[0].message.content,
        "message": "I've incorporated the insights and finalized the solution. It's now ready for functional specification generation."
    }


def prepare_for_spec(final_solution: str) -> dict:
    """
    Step 5: Prepare the solution for handoff to Spec Assistant.
    """
    response = client.chat.completions.create(
        model=MODEL,
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
        ]
    )
    
    return {
        "spec_requirements": response.choices[0].message.content
    }
