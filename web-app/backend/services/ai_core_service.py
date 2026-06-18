"""
SAP AI Core (Generative AI Hub / Orchestration) client.

Uses OAuth2 client credentials from environment variables:
  AI_CORE_CLIENTID, AI_CORE_CLIENT_SECRET, AI_CORE_URL, AI_CORE_API_URL

Optional:
  AI_CORE_RESOURCE_GROUP (default: default)
  AI_CORE_DEPLOYMENT_ID (auto-discovered from /v2/lm/deployments if unset)
  AI_CORE_MODEL (default: gpt-4o)
  AI_CORE_MODEL_VERSION (default: latest)
"""

import base64
import os
import time
from typing import Any, Dict, List, Optional

import requests
from dotenv import load_dotenv

load_dotenv()


class AICoreService:
    def __init__(self):
        self.client_id = os.getenv("AI_CORE_CLIENTID", "").strip()
        self.client_secret = (
            os.getenv("AI_CORE_CLIENT_SECRET", "").strip()
            or os.getenv("AI_CORE_CLIENTSECRET", "").strip()
        )
        self.auth_url = os.getenv("AI_CORE_URL", "").strip().rstrip("/")
        self.api_url = os.getenv("AI_CORE_API_URL", "").strip().rstrip("/")
        self.resource_group = os.getenv("AI_CORE_RESOURCE_GROUP", "default").strip() or "default"
        self.deployment_id = os.getenv("AI_CORE_DEPLOYMENT_ID", "").strip()
        self.completion_path = (
            os.getenv("AI_CORE_COMPLETION_PATH", "v2/completion").strip().lstrip("/")
            or "v2/completion"
        )
        self.model_name = os.getenv("AI_CORE_MODEL", "gpt-4o").strip() or "gpt-4o"
        self.model_version = os.getenv("AI_CORE_MODEL_VERSION", "latest").strip() or "latest"

        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0
        self._cached_deployment_id: Optional[str] = None

    def is_configured(self) -> bool:
        return bool(self.client_id and self.client_secret and self.auth_url and self.api_url)

    def config_status(self) -> Dict[str, Any]:
        """Non-secret summary for logging / diagnostics."""
        return {
            "configured": self.is_configured(),
            "client_id_set": bool(self.client_id),
            "client_secret_set": bool(self.client_secret),
            "auth_url_set": bool(self.auth_url),
            "api_url_set": bool(self.api_url),
            "auth_url": self.auth_url or None,
            "api_url": self.api_url or None,
            "resource_group": self.resource_group,
            "deployment_id_env": self.deployment_id or None,
            "model": f"{self.model_name}@{self.model_version}",
        }

    def _log(self, message: str):
        print(f"AI_CORE: {message}")

    def _get_access_token(self, force_refresh: bool = False) -> str:
        if not self.is_configured():
            raise RuntimeError(
                "SAP AI Core is not configured. Set AI_CORE_CLIENTID, "
                "AI_CORE_CLIENT_SECRET, AI_CORE_URL, and AI_CORE_API_URL."
            )

        now = time.time()
        if not force_refresh and self._access_token and now < self._token_expires_at - 60:
            return self._access_token

        credentials = base64.b64encode(
            f"{self.client_id}:{self.client_secret}".encode("utf-8")
        ).decode("ascii")
        token_url = f"{self.auth_url}/oauth/token"
        self._log(f"Requesting OAuth token from {token_url}")

        response = requests.post(
            token_url,
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
            timeout=30,
        )

        if response.status_code != 200:
            self._log(f"OAuth failed status={response.status_code} body={response.text[:500]}")
            raise RuntimeError(
                f"SAP AI Core OAuth failed ({response.status_code}): {response.text[:300]}"
            )

        payload = response.json()
        token = payload.get("access_token")
        if not token:
            self._log(f"OAuth response missing access_token keys={list(payload.keys())}")
            raise RuntimeError("SAP AI Core OAuth response did not include access_token")

        expires_in = int(payload.get("expires_in", 3600))
        self._access_token = token
        self._token_expires_at = now + expires_in
        self._log(f"OAuth token obtained expires_in={expires_in}s")
        return token

    def _api_headers(self, token: str) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {token}",
            "AI-Resource-Group": self.resource_group,
            "Content-Type": "application/json",
        }

    def _resolve_deployment_id(self, token: str) -> str:
        if self.deployment_id:
            return self.deployment_id
        if self._cached_deployment_id:
            return self._cached_deployment_id

        url = f"{self.api_url}/v2/lm/deployments"
        self._log(f"Listing deployments GET {url}")
        response = requests.get(url, headers=self._api_headers(token), timeout=60)
        if response.status_code != 200:
            self._log(f"List deployments failed status={response.status_code} body={response.text[:500]}")
            raise RuntimeError(
                f"Failed to list SAP AI Core deployments ({response.status_code}): "
                f"{response.text[:300]}"
            )

        data = response.json()
        resources = data.get("resources") or data.get("deployments") or []
        if isinstance(data, list):
            resources = data

        running: list = []
        pending: list = []
        for item in resources:
            if not isinstance(item, dict):
                continue
            dep_id = item.get("id") or item.get("deploymentId")
            if not dep_id:
                continue
            scenario_id = (item.get("scenarioId") or item.get("scenario_id") or "")
            status = (item.get("status") or item.get("deploymentStatus") or "UNKNOWN").upper()
            entry = {"id": dep_id, "scenarioId": scenario_id, "status": status}
            if status == "RUNNING":
                running.append(entry)
            else:
                pending.append(entry)

        deployment_id = None
        for entry in running:
            if "orchestration" in entry["scenarioId"].lower():
                deployment_id = entry["id"]
                break
        if not deployment_id and running:
            deployment_id = running[0]["id"]
            self._log(
                f"No orchestration deployment running; using {running[0]['scenarioId']} "
                f"({deployment_id})"
            )

        if not deployment_id:
            summary = {
                "running": running,
                "not_running": pending,
            }
            raise RuntimeError(
                "No RUNNING SAP AI Core deployment found. Deploy the Generative AI Hub "
                "orchestration scenario (recommended) or wait for your deployment to finish "
                f"starting. Deployments: {summary}"
            )

        self._cached_deployment_id = deployment_id
        self._log(f"Using deployment_id={deployment_id}")
        return deployment_id

    def _messages_to_template(self, messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
        template = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                template.append({"role": "system", "content": content})
            elif role == "assistant":
                template.append({"role": "assistant", "content": content})
            else:
                template.append({"role": "user", "content": content})
        return template

    def _extract_completion_text(self, payload: Dict[str, Any]) -> str:
        final_result = payload.get("final_result") or payload
        choices = final_result.get("choices") or []
        if choices:
            message = choices[0].get("message") or {}
            content = message.get("content")
            if content:
                return str(content).strip()

        # Orchestration may nest assistant output differently
        for key in ("output", "content", "text"):
            val = final_result.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()

        raise RuntimeError(
            f"SAP AI Core response had no assistant content. keys={list(payload.keys())}"
        )

    def chat_completion(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.3,
        max_tokens: int = 2000,
        json_mode: bool = False,
    ) -> str:
        token = self._get_access_token()
        deployment_id = self._resolve_deployment_id(token)
        endpoint = (
            f"{self.api_url}/v2/inference/deployments/{deployment_id}/{self.completion_path}"
        )

        prompt_config: Dict[str, Any] = {
            "template": self._messages_to_template(messages),
        }
        if json_mode:
            prompt_config["response_format"] = {"type": "json_object"}

        body = {
            "config": {
                "modules": {
                    "prompt_templating": {
                        "prompt": prompt_config,
                        "model": {
                            "name": self.model_name,
                            "version": self.model_version,
                            "params": {
                                "temperature": temperature,
                                "max_tokens": max_tokens,
                            },
                        },
                    }
                }
            }
        }

        self._log(
            f"POST completion deployment={deployment_id} model={self.model_name} "
            f"messages={len(messages)} max_tokens={max_tokens}"
        )
        response = requests.post(
            endpoint,
            headers=self._api_headers(token),
            json=body,
            timeout=120,
        )

        if response.status_code != 200:
            self._log(f"Completion failed status={response.status_code} body={response.text[:800]}")
            raise RuntimeError(
                f"SAP AI Core completion failed ({response.status_code}): "
                f"{response.text[:400]}"
            )

        payload = response.json()
        text = self._extract_completion_text(payload)
        usage = (payload.get("final_result") or {}).get("usage") or {}
        if usage:
            self._log(f"Token usage: {usage}")
        return text

    def verify_connection(self) -> Dict[str, Any]:
        """Lightweight connectivity check for diagnostics."""
        status = self.config_status()
        if not status["configured"]:
            status["ok"] = False
            status["error"] = "Missing required environment variables"
            return status

        try:
            token = self._get_access_token(force_refresh=True)
            status["oauth_ok"] = True
            deployment_id = self._resolve_deployment_id(token)
            status["deployment_id"] = deployment_id
            status["ok"] = True
        except Exception as exc:
            status["ok"] = False
            status["error"] = str(exc)
            self._log(f"verify_connection failed: {exc}")

        return status
