import os
from typing import Optional
from dotenv import load_dotenv
from openai import OpenAI
from anthropic import Anthropic
import google.generativeai as genai

load_dotenv()


class OpenAIService:
    """
    Backward-compatible AI service.
    Despite the historical name, this service can route to OpenAI, Claude, or Gemini.
    """

    VALID_PROVIDERS = {"openai", "claude", "gemini"}

    def __init__(self):
        self.openai_model = os.getenv("OPENAI_MODEL", "gpt-4.1")
        self.claude_model = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
        # 1.5-pro is often unavailable for some keys/projects; use a broadly available default.
        self.gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

        self.openai_client = None
        openai_key = os.getenv("OPENAI_API_KEY")
        if openai_key:
            self.openai_client = OpenAI(api_key=openai_key, timeout=120.0)

        self.claude_client = None
        claude_key = os.getenv("CLAUDE_API_KEY")
        if claude_key:
            self.claude_client = Anthropic(api_key=claude_key, timeout=120.0)

        gemini_key = os.getenv("GEMINI_API_KEY")
        if gemini_key:
            genai.configure(api_key=gemini_key)
        self._resolved_gemini_model = None

    def _normalize_provider(self, provider: Optional[str]) -> str:
        normalized = (provider or "openai").strip().lower()
        return normalized if normalized in self.VALID_PROVIDERS else "openai"

    def _log_model_selection(self, provider: str, model: str):
        print(f"LLM_ROUTER: provider={provider} model={model}")

    def _log_provider_failure(self, provider: str, model: str, error: Exception):
        print(f"LLM_ROUTER_ERROR: provider={provider} model={model} error={str(error)}")

    def _get_openai_response(self, messages, temperature=0.3, max_tokens=2000, json_mode=False):
        if not self.openai_client:
            raise Exception("OpenAI is selected but OPENAI_API_KEY is not configured.")
        self._log_model_selection("openai", self.openai_model)
        kwargs = dict(
            model=self.openai_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        response = self.openai_client.chat.completions.create(**kwargs)
        return response.choices[0].message.content

    def _resolve_gemini_model(self):
        if self._resolved_gemini_model:
            return self._resolved_gemini_model
        preferred = self.gemini_model
        # First, try preferred as-is.
        try:
            genai.GenerativeModel(preferred)
            self._resolved_gemini_model = preferred
            return self._resolved_gemini_model
        except Exception:
            pass

        # Then choose from models available to this key.
        candidates = []
        try:
            for m in genai.list_models():
                methods = getattr(m, "supported_generation_methods", []) or []
                if "generateContent" in methods:
                    name = getattr(m, "name", "")
                    if name:
                        candidates.append(name.replace("models/", ""))
        except Exception:
            # If listing models fails, keep configured fallback.
            self._resolved_gemini_model = preferred
            return self._resolved_gemini_model

        priority_order = [
            preferred,
            "gemini-1.5-flash",
            "gemini-1.5-pro",
            "gemini-2.0-flash",
            "gemini-2.5-flash",
            "gemini-pro",
        ]
        for p in priority_order:
            if p in candidates:
                self._resolved_gemini_model = p
                return self._resolved_gemini_model

        self._resolved_gemini_model = candidates[0] if candidates else preferred
        return self._resolved_gemini_model

    def chat_completion(self, messages, temperature=0.3, max_tokens=2000, provider="openai", json_mode=False):
        """Generic chat completion method across supported providers."""
        resolved_provider = self._normalize_provider(provider)

        if resolved_provider == "claude":
            if not self.claude_client:
                raise Exception("Claude is selected but CLAUDE_API_KEY is not configured.")
            try:
                self._log_model_selection("claude", self.claude_model)
                system_text = ""
                claude_messages = []
                for msg in messages:
                    role = msg.get("role")
                    content = msg.get("content", "")
                    if role == "system":
                        system_text = f"{system_text}\n\n{content}".strip() if system_text else content
                    elif role in ("user", "assistant"):
                        claude_messages.append({"role": role, "content": content})
                response = self.claude_client.messages.create(
                    model=self.claude_model,
                    system=system_text or None,
                    messages=claude_messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                text_parts = [block.text for block in response.content if getattr(block, "type", "") == "text"]
                return "\n".join(text_parts).strip()
            except Exception as e:
                self._log_provider_failure("claude", self.claude_model, e)
                print("LLM_ROUTER_FALLBACK: from=claude to=openai")
                return self._get_openai_response(messages, temperature=temperature, max_tokens=max_tokens, json_mode=json_mode)

        if resolved_provider == "gemini":
            model_name = self._resolve_gemini_model()
            try:
                self._log_model_selection("gemini", model_name)
                model = genai.GenerativeModel(model_name)
                merged_prompt = []
                for msg in messages:
                    role = msg.get("role")
                    content = msg.get("content", "")
                    if role == "system":
                        merged_prompt.append(f"System instruction:\n{content}")
                    elif role == "assistant":
                        merged_prompt.append(f"Assistant:\n{content}")
                    else:
                        merged_prompt.append(f"User:\n{content}")
                response = model.generate_content(
                    "\n\n".join(merged_prompt),
                    generation_config=genai.types.GenerationConfig(
                        temperature=temperature,
                        max_output_tokens=max_tokens,
                    ),
                )
                return (response.text or "").strip()
            except Exception as e:
                self._log_provider_failure("gemini", model_name, e)
                print("LLM_ROUTER_FALLBACK: from=gemini to=openai")
                return self._get_openai_response(messages, temperature=temperature, max_tokens=max_tokens, json_mode=json_mode)

        # Default OpenAI path
        return self._get_openai_response(messages, temperature=temperature, max_tokens=max_tokens, json_mode=json_mode)

    def generate_text(self, prompt, system_prompt=None, temperature=0.3, max_tokens=2000, provider="openai"):
        """Generate text from a prompt."""
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        return self.chat_completion(messages, temperature, max_tokens, provider=provider)

