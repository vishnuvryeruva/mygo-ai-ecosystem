from services.openai_service import OpenAIService

class PromptService:
    def __init__(self):
        self.openai_service = OpenAIService()
    
    def generate_prompt(self, language, task_description, context='', llm_provider='openai'):
        """Generate optimized prompts for LLM code generation"""
        
        system_prompt = """You are an expert prompt engineer specializing in creating optimized prompts for LLM code generation.
        Create prompts that are:
        - Clear and specific
        - Include necessary context
        - Specify output format
        - Include best practices for the target language
        - Optimized for code generation tasks"""
        
        user_prompt = f"""Create an optimized prompt for generating {language} code.

Task Description: {task_description}

{f'Additional Context: {context}' if context else ''}

Please create a comprehensive prompt that:
1. Clearly describes the task
2. Specifies the programming language ({language})
3. Includes relevant context and requirements
4. Specifies the expected output format
5. Includes best practices and coding standards for {language}
6. Is optimized for LLM code generation

Return only the optimized prompt, ready to use."""
        
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
        
        system_prompt = f"""You are an expert {language} developer who writes production-ready, clean, well-documented code.

When generating code:
- Follow {language} best practices and coding standards
- Include proper error handling
- Add clear inline comments explaining key logic
- Use meaningful variable and function names
- Structure the code logically with proper modularization
- Include necessary imports or declarations

Return your response in EXACTLY this format:

```{language.lower()}
<your generated code here>
```

**Explanation:**
<brief explanation of what the code does and key design decisions>"""

        user_prompt = f"""{prompt}

{f'Additional Context: {context}' if context else ''}

Generate production-ready {language} code that fulfills the above requirements."""

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


