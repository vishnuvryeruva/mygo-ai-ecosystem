import os
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
env_path = os.path.join(basedir, '.env')
print(f"Loading .env from: {env_path}")
print(f"File exists: {os.path.exists(env_path)}")

load_dotenv(env_path)
api_key = os.getenv('OPENAI_API_KEY')
print(f"API Key: {api_key[:8] if api_key else 'None'}... (length: {len(api_key) if api_key else 0})")
