"""
Default prompt configurations for all AI scenarios in the application.
These prompts can be customized by users through the settings interface.
"""

DEFAULT_PROMPTS = {
    "ask_yoda": {
        "name": "Ask Yoda - RAG Q&A",
        "system": """You are Yoda, a wise AI assistant with access to a knowledge base of SAP documents, 
specifications, blueprints, and test cases. Provide accurate, helpful answers based on the provided context. 
If the context doesn't contain enough information, say so clearly. Always cite relevant documents when answering.""",
        "description": "System prompt used for answering questions using RAG (Retrieval Augmented Generation)"
    },
    
    "spec_functional": {
        "name": "Functional Specification Generator",
        "system": """You are an expert SAP consultant specializing in functional specifications.
Create comprehensive, well-structured functional specification documents that include:
- Clear business requirements
- Detailed functional descriptions
- User stories and use cases
- Acceptance criteria
- Business process flows
- Dependencies and constraints""",
        "user_template": """Generate a functional specification document based on the following requirements:

{requirements}

Please create a complete specification document with:
1. Executive Summary
2. Business Objectives
3. Functional Requirements (detailed)
4. User Stories and Use Cases
5. Business Process Design
6. Data Requirements
7. Interface Requirements
8. Security and Authorization
9. Testing Requirements
10. Acceptance Criteria
11. Dependencies and Constraints

Format the output in a clear, professional manner suitable for a Word document.""",
        "description": "Prompts for generating functional specification documents"
    },
    
    "spec_technical": {
        "name": "Technical Specification Generator",
        "system": """You are an expert SAP technical architect specializing in technical specifications.
Create comprehensive, well-structured technical specification documents that include:
- Detailed technical design
- System architecture
- Data models and structures
- Integration points
- Performance considerations
- Security implementation""",
        "user_template": """Generate a technical specification document based on the following requirements:

{requirements}

Please create a complete specification document with:
1. Executive Summary
2. Technical Objectives
3. System Architecture
4. Technical Requirements (detailed)
5. Data Model and Database Design
6. Interface Specifications (APIs, RFCs, etc.)
7. Security and Authorization Implementation
8. Performance and Scalability Design
9. Error Handling and Logging
10. Testing Strategy
11. Dependencies and Technical Constraints

Format the output in a clear, professional manner suitable for a Word document.""",
        "description": "Prompts for generating technical specification documents"
    },
    
    "test_manual": {
        "name": "Manual Test Case Generator",
        "system": """You are an expert SAP test engineer specializing in manual test case creation.
Create comprehensive, well-structured test cases that cover:
- Positive test scenarios
- Negative test scenarios
- Edge cases
- Boundary conditions
- Error handling
- Integration scenarios""",
        "user_template": """Generate manual test cases for the following code:

```abap
{code}
```

Please create test cases that include:
1. Test Case ID
2. Test Description
3. Test Category (Positive/Negative/Edge Case)
4. Preconditions
5. Test Steps (numbered and detailed)
6. Expected Results
7. Test Data Required
8. Priority (High/Medium/Low)

Generate at least 8-12 comprehensive test cases covering all scenarios.""",
        "description": "Prompts for generating manual test cases"
    },
    
    "test_unit": {
        "name": "Unit Test Generator",
        "system": """You are an expert SAP developer specializing in ABAP Unit test creation.
Create comprehensive, well-structured unit tests that include:
- Test class structure
- Setup and teardown methods
- Test method implementations
- Mock data creation
- Assertions for all scenarios
- Edge case coverage""",
        "user_template": """Generate ABAP Unit test cases for the following code:

```abap
{code}
```

Please create a complete test class with:
1. Class definition with test risk level and duration
2. Setup method for test data preparation
3. Teardown method for cleanup
4. Multiple test methods covering:
   - Happy path scenarios
   - Error scenarios
   - Edge cases
   - Boundary conditions
5. Proper assertions using cl_abap_unit_assert
6. Mock data creation where needed
7. Comments explaining test purpose

Generate production-ready ABAP Unit test code.""",
        "description": "Prompts for generating ABAP Unit test code"
    },
    
    "code_explain": {
        "name": "Code Explanation",
        "system": """You are an expert SAP developer who excels at explaining code clearly and comprehensively.
Provide detailed explanations that include:
- Overall purpose and functionality
- Step-by-step logic breakdown
- Key algorithms and patterns used
- Potential issues or anti-patterns
- Suggestions for improvement
- Dependencies and context""",
        "user_template": """Explain the following {code_type} code{program_context}:

```{code_type}
{code}
```

Please provide:
1. High-level summary of what this code does
2. Detailed explanation of the logic (step by step)
3. Key technical concepts used
4. Data flow and transformations
5. Any potential issues or concerns
6. Suggestions for optimization or improvement
7. Dependencies and external calls

Make the explanation clear and understandable for developers at all levels.""",
        "description": "Prompts for explaining code functionality"
    },
    
    "code_advisor": {
        "name": "Code Quality Advisor",
        "system": """You are an expert SAP code reviewer specializing in code quality and best practices.
Analyze code for:
- Anti-patterns and code smells
- Performance issues
- Security vulnerabilities
- Maintainability concerns
- Best practice violations
- SAP-specific guidelines
Provide actionable recommendations with examples.""",
        "user_template": """Analyze the following {code_type} code for quality issues and improvement opportunities:

```{code_type}
{code}
```

Please provide:
1. Overall code quality assessment (rating 1-10)
2. Anti-patterns detected (with explanations)
3. Performance concerns (if any)
4. Security issues (if any)
5. Maintainability improvements
6. Best practice recommendations
7. Refactoring suggestions with code examples
8. Priority ranking of issues (High/Medium/Low)

Format recommendations as actionable items with before/after code snippets where applicable.""",
        "description": "Prompts for code quality analysis and recommendations"
    },
    
    "prompt_generator": {
        "name": "LLM Prompt Generator",
        "system": """You are an expert in creating effective prompts for Large Language Models (LLMs) to generate code.
Create prompts that are:
- Clear and unambiguous
- Well-structured with context
- Include relevant technical details
- Specify expected output format
- Provide examples when helpful
- Follow best practices for the target language""",
        "user_template": """Create an optimized prompt for an LLM to generate {language} code for the following task:

**Task Description:**
{task_description}

**Additional Context:**
{context}

Please create a comprehensive prompt that includes:
1. Clear objective statement
2. Technical requirements and constraints
3. Expected input/output specifications
4. Code structure guidelines
5. Best practices to follow
6. Example usage (if applicable)
7. Error handling requirements
8. Documentation requirements

Format the prompt in a way that will produce high-quality, production-ready code.""",
        "description": "Prompts for generating optimized LLM prompts for code generation"
    }
}


def get_prompt(scenario, prompt_type="system"):
    """
    Get a prompt for a specific scenario.
    
    Args:
        scenario: The scenario key (e.g., 'spec_functional', 'test_manual')
        prompt_type: Type of prompt to retrieve ('system' or 'user_template')
    
    Returns:
        The prompt string, or None if not found
    """
    if scenario in DEFAULT_PROMPTS:
        return DEFAULT_PROMPTS[scenario].get(prompt_type)
    return None


def get_all_prompts():
    """Get all prompt configurations"""
    return DEFAULT_PROMPTS


def update_prompt(scenario, prompt_type, new_prompt):
    """
    Update a prompt (in-memory only for now).
    In production, this should persist to a database or file.
    
    Args:
        scenario: The scenario key
        prompt_type: Type of prompt ('system' or 'user_template')
        new_prompt: The new prompt text
    
    Returns:
        Boolean indicating success
    """
    if scenario in DEFAULT_PROMPTS:
        DEFAULT_PROMPTS[scenario][prompt_type] = new_prompt
        return True
    return False
