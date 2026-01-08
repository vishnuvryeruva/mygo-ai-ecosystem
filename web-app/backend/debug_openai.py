import os
from dotenv import load_dotenv
from openai import OpenAI

# Load .env explicitly from backend directory
basedir = os.path.abspath(os.path.dirname(__file__))
env_path = os.path.join(basedir, '.env')
print(f"Loading .env from: {env_path}")
load_dotenv(env_path)

api_key = os.getenv('OPENAI_API_KEY')

print(f"Loaded API Key: {api_key[:8]}...{api_key[-4:] if api_key else 'None'}")
print(f"Key length: {len(api_key) if api_key else 0}")

if not api_key:
    print("ERROR: No API key found in environment variables.")
    exit(1)

try:
    client = OpenAI(api_key=api_key)
    print("Attempting to generate chat completion with gpt-4o-mini...")
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": "Hello"}]
    )
    print("SUCCESS: Chat completion successful.")
    print(f"Response: {response.choices[0].message.content}")
except Exception as e:
    print("\nERROR: OpenAI API call failed.")
    print(e)
