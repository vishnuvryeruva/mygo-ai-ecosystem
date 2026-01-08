from services.openai_service import OpenAIService
import json

class AdvisorService:
    def __init__(self):
        self.openai_service = OpenAIService()
    
    def analyze_code(self, code, code_type='ABAP'):
        """Analyze ABAP code for anti-patterns and provide improvement recommendations"""
        
        system_prompt = """You are an expert ABAP code reviewer specializing in identifying anti-patterns and code quality issues.
        Analyze code and provide:
        - Specific anti-patterns found
        - Improvement recommendations
        - Best practices suggestions
        - Performance optimization opportunities
        - Code quality issues"""
        
        user_prompt = f"""Analyze the following {code_type} code for anti-patterns and provide improvement recommendations:

```{code_type.lower()}
{code}
```

Please provide your analysis in the following JSON format:
{{
  "anti_patterns": [
    {{
      "line": <line_number>,
      "pattern": "<anti-pattern name>",
      "description": "<description>",
      "severity": "ERROR|WARNING|INFO",
      "suggestion": "<improvement suggestion>"
    }}
  ],
  "suggestions": [
    {{
      "line": <line_number>,
      "type": "PERFORMANCE|READABILITY|MAINTAINABILITY|BEST_PRACTICE",
      "current": "<current code>",
      "suggested": "<suggested code>",
      "reason": "<explanation>"
    }}
  ],
  "improvements": [
    {{
      "category": "<category>",
      "description": "<description>",
      "priority": "HIGH|MEDIUM|LOW"
    }}
  ]
}}

Focus on:
1. ABAP anti-patterns (SELECT *, nested loops, missing error handling, etc.)
2. Performance issues
3. Code readability and maintainability
4. Modern ABAP syntax opportunities
5. Best practices violations

Return ONLY valid JSON, no additional text."""
        
        response = self.openai_service.generate_text(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.2,
            max_tokens=3000
        )
        
        # Parse JSON response
        try:
            # Clean response (remove markdown code blocks if present)
            cleaned_response = response.strip()
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.startswith('```'):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()
            
            analysis = json.loads(cleaned_response)
            return analysis
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return {
                "anti_patterns": [],
                "suggestions": [],
                "improvements": [{
                    "category": "Analysis",
                    "description": response,
                    "priority": "MEDIUM"
                }]
            }

