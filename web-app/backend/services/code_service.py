from services.openai_service import OpenAIService

class CodeService:
    def __init__(self):
        self.openai_service = OpenAIService()
    
    def explain_code(self, code, code_type='ABAP', program_name=''):
        """Explain what ABAP code does"""
        
        system_prompt = """You are an expert SAP ABAP developer and educator.
        Explain code in simple, clear terms that help developers understand what the code does.
        Focus on functionality, not implementation details."""
        
        user_prompt = f"""Explain what the following {code_type} code does.
        
{f'Program/Class Name: {program_name}' if program_name else ''}

Code:
```{code_type.lower()}
{code}
```

Please provide:
1. A brief overview (2-3 sentences)
2. Main functionality
3. Key components and their purpose
4. Any important patterns or practices used

Keep the explanation clear and concise, suitable for developers at various skill levels."""
        
        explanation = self.openai_service.generate_text(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=1500
        )
        
        return explanation
    
    def fetch_code_from_sap(self, program_name, code_type='ABAP'):
        """Placeholder for SAP code fetching - would integrate with SAP system"""
        # This would typically connect to SAP system via RFC or OData
        # For now, return a placeholder message
        return f"Code fetching from SAP for {program_name} would be implemented here. " \
               f"This requires SAP system connection (RFC, OData, or ADT)."

