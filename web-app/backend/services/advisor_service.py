from services.openai_service import OpenAIService
from config.prompts import get_prompt, render_prompt
import json

class AdvisorService:
    def __init__(self):
        self.openai_service = OpenAIService()
    
    def analyze_code(self, code, code_type='ABAP', llm_provider='openai'):
        """Analyze ABAP code for anti-patterns and provide improvement recommendations"""

        system_prompt = get_prompt('code_advisor', 'system')
        user_prompt = render_prompt(
            'code_advisor',
            'user_template',
            code_type=code_type,
            code_type_lower=code_type.lower(),
            code=code,
        )
        
        response = self.openai_service.generate_text(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.2,
            max_tokens=3000,
            provider=llm_provider
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

