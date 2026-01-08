from services.openai_service import OpenAIService

class PromptService:
    def __init__(self):
        self.openai_service = OpenAIService()
    
    def generate_prompt(self, language, task_description, context=''):
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
            max_tokens=1500
        )
        
        return prompt

