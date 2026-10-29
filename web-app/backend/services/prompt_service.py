from services.openai_service import OpenAIService
from config.prompts import get_prompt, render_prompt

class PromptService:
    def __init__(self):
        self.openai_service = OpenAIService()
    
    def generate_prompt(self, language, task_description, context='', llm_provider='openai'):
        """Generate optimized prompts for LLM code generation"""

        system_prompt = get_prompt('prompt_generator', 'system')
        context_section = f"Additional Context: {context}" if context else ""
        user_prompt = render_prompt(
            'prompt_generator',
            'user_template',
            language=language,
            task_description=task_description,
            context_section=context_section,
        )
        
        prompt = self.openai_service.generate_text(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.5,
            max_tokens=1500,
            provider=llm_provider
        )
        
        return prompt

    def generate_code(self, language, prompt, context='', llm_provider='openai'):
        """Generate actual code from an optimized prompt.
        
        Args:
            language: Target programming language (ABAP, Python, etc.)
            prompt: The optimized prompt (typically from generate_prompt)
            context: Optional additional context
            
        Returns:
            dict with 'code', 'explanation', and 'language'
        """
        
        system_prompt = render_prompt(
            'code_generator',
            'system',
            language=language,
            language_lower=language.lower(),
        )
        context_section = f"Additional Context: {context}" if context else ""
        user_prompt = render_prompt(
            'code_generator',
            'user_template',
            prompt=prompt,
            context_section=context_section,
            language=language,
        )

        result = self.openai_service.generate_text(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=4000,
            provider=llm_provider
        )
        
        # Parse the response to separate code and explanation
        code = result
        explanation = ''
        
        # Try to extract code block and explanation
        if '```' in result:
            parts = result.split('```')
            if len(parts) >= 3:
                # Code is in the second part (between first and second ```)
                code_block = parts[1]
                # Remove language identifier from first line if present
                code_lines = code_block.split('\n')
                if code_lines and code_lines[0].strip().lower() in [
                    language.lower(), 'abap', 'python', 'javascript', 'typescript',
                    'java', 'abap_rap', 'cap_nodejs', 'cap_java', 'js', 'ts'
                ]:
                    code = '\n'.join(code_lines[1:]).strip()
                else:
                    code = code_block.strip()
                
                # Everything after the code block is explanation
                remaining = '```'.join(parts[2:]).strip()
                if remaining:
                    # Remove "Explanation:" prefix if present
                    explanation = remaining
                    for prefix in ['**Explanation:**', 'Explanation:', '**Explanation**']:
                        if explanation.startswith(prefix):
                            explanation = explanation[len(prefix):].strip()
                            break
        
        return {
            'code': code,
            'explanation': explanation,
            'language': language
        }


