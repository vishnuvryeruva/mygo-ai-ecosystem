"""
Provision a text-embedding-3-small deployment in SAP AI Core (Generative AI Hub),
so Yoda's embedding fallback can route through AI Core when OpenAI is unavailable.

Why text-embedding-3-small specifically: the entire document corpus is already
embedded with that model. Deploying the SAME model means the existing 189
documents stay searchable with no re-embedding — AI Core just becomes a second
gateway to the same vector space. A different model would force a full re-embed,
which is why RAGService refuses anything else.

Prerequisites (the same creds the app already uses for AI Core chat):
    AI_CORE_CLIENTID, AI_CORE_CLIENT_SECRET, AI_CORE_URL, AI_CORE_API_URL
    AI_CORE_RESOURCE_GROUP   (optional, default "default")

Run it where those are set (locally with a .env, or `cf ssh` into the app):
    python provision_aicore_embedding.py

It is idempotent: re-running finds the existing config/deployment instead of
making duplicates. On success it prints the deployment id to set as
AI_CORE_EMBEDDING_DEPLOYMENT_ID.
"""

import base64
import os
import sys
import time

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

MODEL_NAME = "text-embedding-3-small"      # MUST match the corpus model
MODEL_VERSION = "latest"
SCENARIO_ID = "foundation-models"          # Gen AI Hub scenario for hosted models
EXECUTABLE_ID = "azure-openai"             # executable serving OpenAI models
CONFIG_NAME = "yoda-text-embedding-3-small"

CLIENT_ID = os.getenv("AI_CORE_CLIENTID", "").strip()
CLIENT_SECRET = (
    os.getenv("AI_CORE_CLIENT_SECRET", "").strip()
    or os.getenv("AI_CORE_CLIENTSECRET", "").strip()
)
AUTH_URL = os.getenv("AI_CORE_URL", "").strip().rstrip("/")
API_URL = os.getenv("AI_CORE_API_URL", "").strip().rstrip("/")
RESOURCE_GROUP = os.getenv("AI_CORE_RESOURCE_GROUP", "default").strip() or "default"


def fail(msg):
    print(f"ERROR: {msg}")
    sys.exit(1)


def token():
    if not (CLIENT_ID and CLIENT_SECRET and AUTH_URL and API_URL):
        fail("Missing AI_CORE_CLIENTID / AI_CORE_CLIENT_SECRET / AI_CORE_URL / AI_CORE_API_URL")
    creds = base64.b64encode(f"{CLIENT_ID}:{CLIENT_SECRET}".encode()).decode()
    r = requests.post(
        f"{AUTH_URL}/oauth/token",
        headers={"Authorization": f"Basic {creds}",
                 "Content-Type": "application/x-www-form-urlencoded"},
        data={"grant_type": "client_credentials"},
        timeout=30,
    )
    if r.status_code != 200:
        fail(f"OAuth failed ({r.status_code}): {r.text[:300]}")
    return r.json()["access_token"]


def headers(tok):
    return {
        "Authorization": f"Bearer {tok}",
        "AI-Resource-Group": RESOURCE_GROUP,
        "Content-Type": "application/json",
    }


def find_existing_deployment(tok):
    """Return a running/pending deployment id already serving MODEL_NAME, else None."""
    r = requests.get(f"{API_URL}/v2/lm/deployments", headers=headers(tok), timeout=60)
    if r.status_code != 200:
        return None
    for d in (r.json().get("resources") or []):
        details = (d.get("details") or {}).get("resources", {}).get("backend_details", {})
        model = (details.get("model") or {}).get("name", "")
        # Model name isn't always echoed; fall back to matching our config's scenario.
        if model == MODEL_NAME and d.get("status") in ("RUNNING", "PENDING", "UNKNOWN"):
            return d.get("id")
    return None


def find_or_create_config(tok):
    r = requests.get(f"{API_URL}/v2/lm/configurations", headers=headers(tok), timeout=60)
    if r.status_code == 200:
        for c in (r.json().get("resources") or []):
            if c.get("name") == CONFIG_NAME:
                print(f"  reusing configuration {c['id']}")
                return c["id"]

    body = {
        "name": CONFIG_NAME,
        "executableId": EXECUTABLE_ID,
        "scenarioId": SCENARIO_ID,
        "parameterBindings": [
            {"key": "modelName", "value": MODEL_NAME},
            {"key": "modelVersion", "value": MODEL_VERSION},
        ],
        "inputArtifactBindings": [],
    }
    r = requests.post(f"{API_URL}/v2/lm/configurations", headers=headers(tok), json=body, timeout=60)
    if r.status_code not in (200, 201):
        fail(
            f"Create configuration failed ({r.status_code}): {r.text[:400]}\n"
            "If it complains about executableId/modelName, open AI Launchpad → "
            "Generative AI Hub → Models and confirm the exact executable and model "
            "name available in your account, then adjust the constants at the top."
        )
    cid = r.json()["id"]
    print(f"  created configuration {cid}")
    return cid


def create_deployment(tok, config_id):
    r = requests.post(
        f"{API_URL}/v2/lm/deployments",
        headers=headers(tok),
        json={"configurationId": config_id},
        timeout=60,
    )
    if r.status_code not in (200, 201):
        fail(f"Create deployment failed ({r.status_code}): {r.text[:400]}")
    did = r.json()["id"]
    print(f"  created deployment {did}")
    return did


def wait_running(tok, deployment_id, minutes=10):
    print(f"  waiting for deployment {deployment_id} to reach RUNNING...")
    deadline = time.time() + minutes * 60
    while time.time() < deadline:
        r = requests.get(
            f"{API_URL}/v2/lm/deployments/{deployment_id}",
            headers=headers(tok), timeout=30,
        )
        status = r.json().get("status") if r.status_code == 200 else f"HTTP {r.status_code}"
        print(f"    status={status}")
        if status == "RUNNING":
            return True
        if status in ("DEAD", "STOPPED"):
            fail(f"Deployment entered {status}. Check AI Launchpad for the reason.")
        time.sleep(20)
    print("  still not RUNNING after the wait; it may just be slow — check AI Launchpad.")
    return False


def main():
    tok = token()
    print(f"Authenticated to AI Core (resource group: {RESOURCE_GROUP})")

    existing = find_existing_deployment(tok)
    if existing:
        print(f"A deployment for {MODEL_NAME} already exists: {existing}")
        deployment_id = existing
    else:
        config_id = find_or_create_config(tok)
        deployment_id = create_deployment(tok, config_id)
        wait_running(tok, deployment_id)

    print("\n" + "=" * 68)
    print("Set these on the backend, then restage:")
    print(f"  cf set-env mygo-backend AI_CORE_EMBEDDING_DEPLOYMENT_ID {deployment_id}")
    print(f"  cf set-env mygo-backend AI_CORE_EMBEDDING_MODEL {MODEL_NAME}")
    print("  cf restage mygo-backend")
    print("=" * 68)


if __name__ == "__main__":
    main()
