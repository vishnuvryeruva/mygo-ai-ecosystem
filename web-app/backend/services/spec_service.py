from services.openai_service import OpenAIService
from docx import Document
import io

class SpecService:
    def __init__(self):
        self.openai_service = OpenAIService()
    
    def generate_spec(self, spec_type, requirements, format_type='docx', custom_prompt=None):
        """Generate functional or technical specification document"""
        
        # Use custom prompt if provided, otherwise load from config
        if custom_prompt:
            system_prompt = custom_prompt
        else:
            try:
                from config.prompts import get_prompt
                prompt_key = f'spec_{spec_type}'
                system_prompt = get_prompt(prompt_key, 'system')
                user_template = get_prompt(prompt_key, 'user_template')
                
                if not system_prompt:
                    # Fallback to default
                    system_prompt = f"""You are an expert SAP consultant specializing in {spec_type} specifications.
                    Create comprehensive, well-structured {spec_type} specification documents."""
            except Exception as e:
                print(f"Error loading prompts from config: {e}")
                system_prompt = f"""You are an expert SAP consultant specializing in {spec_type} specifications.
                Create comprehensive, well-structured {spec_type} specification documents that include:
                - Clear requirements
                - Detailed descriptions
                - Technical/Functional details
                - Acceptance criteria
                - Dependencies and constraints"""
        
        # Check if we have a template to use
        try:
            from config.prompts import get_prompt
            prompt_key = f'spec_{spec_type}'
            user_template = get_prompt(prompt_key, 'user_template')
            if user_template:
                user_prompt = user_template.format(requirements=requirements)
            else:
                raise ValueError("No template found")
        except:
            user_prompt = f"""Generate a {spec_type} specification document based on the following requirements:

{requirements}

Please create a complete specification document with:
1. Executive Summary
2. Objectives
3. Requirements (detailed)
4. Technical/Functional Design
5. Data Model (if applicable)
6. Interfaces (if applicable)
7. Security Considerations
8. Testing Requirements
9. Acceptance Criteria
10. Dependencies and Constraints

Format the output in a clear, professional manner suitable for a Word document."""
        
        spec_content = self.openai_service.generate_text(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.4,
            max_tokens=3000
        )
        
        if format_type == 'docx':
            return self._create_docx(spec_content, spec_type)
        else:
            return spec_content
    
    def _create_docx(self, content, spec_type):
        """Create a DOCX document from content with proper markdown formatting"""
        from services.markdown_utils import convert_markdown_to_docx
        
        doc = Document()
        
        # Convert markdown content to Word document with proper formatting
        title = f'{spec_type.capitalize()} Specification'
        convert_markdown_to_docx(doc, content, title=title)
        
        # Save to bytes
        doc_bytes = io.BytesIO()
        doc.save(doc_bytes)
        doc_bytes.seek(0)
        
        return doc_bytes.getvalue()

