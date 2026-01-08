import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

class OpenAIService:
    def __init__(self):
        import openai
        print(f"DEBUG: OpenAI Version: {openai.__version__}")
        
        api_key = os.getenv('OPENAI_API_KEY')
        print(f"DEBUG: Loaded API Key: {api_key[:8]}...{api_key[-4:] if api_key else 'None'}")
        print(f"DEBUG: Key length: {len(api_key) if api_key else 0}")
        print(f"DEBUG: Org ID: {os.getenv('OPENAI_ORG_ID')}")
        print(f"DEBUG: Project ID: {os.getenv('OPENAI_PROJECT_ID')}")
        
        if not api_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        # Use longer timeout for slow network connections
        self.client = OpenAI(
            api_key=api_key,
            timeout=120.0  # 120 second timeout instead of default 10s
        )
        self.model = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')
    
    def chat_completion(self, messages, temperature=0.3, max_tokens=2000):
        """Generic chat completion method"""
        try:
            print(f"DEBUG: OpenAI Request - Model: {self.model}, Max Tokens: {max_tokens}")
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens
            )
            print("DEBUG: OpenAI Response received successfully")
            return response.choices[0].message.content
        except Exception as e:
            raise Exception(f"OpenAI API error: {str(e)}")
    
    def generate_text(self, prompt, system_prompt=None, temperature=0.3, max_tokens=2000):
        """Generate text from a prompt"""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        return self.chat_completion(messages, temperature, max_tokens)

