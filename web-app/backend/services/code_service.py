from services.openai_service import OpenAIService
from config.prompts import get_prompt, render_prompt

class CodeService:
    def __init__(self):
        self.openai_service = OpenAIService()
    
    def explain_code(self, code, code_type='ABAP', program_name='', llm_provider='openai'):
        """Explain what ABAP code does"""

        system_prompt = get_prompt('code_explain', 'system')
        program_line = f"Program/Class Name: {program_name}" if program_name else ""
        user_prompt = render_prompt(
            'code_explain',
            'user_template',
            code_type=code_type,
            code_type_lower=code_type.lower(),
            program_line=program_line,
            code=code,
        )
        
        explanation = self.openai_service.generate_text(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=1500,
            provider=llm_provider
        )
        
        return explanation
    
    def fetch_code_from_sap(self, program_name, code_type='ABAP'):
        """Placeholder for SAP code fetching - would integrate with SAP system"""
        # This would typically connect to SAP system via RFC or OData
        # For now, return a placeholder message
        return f"Code fetching from SAP for {program_name} would be implemented here. " \
               f"This requires SAP system connection (RFC, OData, or ADT)."

