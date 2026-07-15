"""
Assigns an SAP functional module to a document.

Layers run in order and the first one that answers wins:

  1. scope_map — join the document's CALM scope_id to the calm_scopes cache.
     Free, exact, and explainable ("it sits under the Inventory Management scope").
  2. llm       — classify title + opening text. Only reached for file uploads and
     scopes we have no mapping for.
  3. UNCLASSIFIED — no guess rather than a bad guess.

A module set by a human (method='manual') is never recomputed; callers check
should_reclassify() before re-running this on an existing document.
"""

import json

from config.sap_modules import (
    ASSIGNABLE_CODES,
    METHOD_LLM,
    METHOD_SCOPE_MAP,
    MODULE_LABELS,
    STICKY_METHODS,
    UNCLASSIFIED,
    module_from_scope_name,
    normalize_module,
)

# Enough of the document for the module to be obvious; more just costs tokens.
CLASSIFY_CHAR_LIMIT = 2000

_TAXONOMY_LINES = "\n".join(
    f"- {code}: {MODULE_LABELS[code]}" for code in ASSIGNABLE_CODES
)

CLASSIFIER_SYSTEM_PROMPT = f"""You are an SAP solution architect. Classify a document into exactly one SAP functional module.

Allowed modules:
{_TAXONOMY_LINES}

Rules:
- Reply with JSON only: {{"module": "<CODE>", "confidence": <0.0-1.0>}}
- "module" MUST be one of the codes listed above, copied exactly.
- Use CROSS when the document genuinely spans several modules (e.g. master data).
- Use TECH for Basis, security, authorizations, integration or migration content.
- confidence is your own honest estimate: 1.0 means certain, below 0.5 means guessing.
- Never invent a module code. Never explain. JSON only."""


def should_reclassify(current_method) -> bool:
    """False when a human has set the module by hand."""
    return current_method not in STICKY_METHODS


class ModuleClassifier:
    """Resolves (module, confidence, method) for a document."""

    def __init__(self, openai_service=None):
        # Injected so callers can share one OpenAIService instance. Built on first
        # use rather than here, so the scope-mapping layer stays usable with no
        # LLM provider configured (e.g. a scope-only backfill).
        self._openai_service = openai_service

    @property
    def openai_service(self):
        if self._openai_service is None:
            from services.openai_service import OpenAIService
            self._openai_service = OpenAIService()
        return self._openai_service

    # ── Layer 1: scope mapping ────────────────────────────────────────────────

    def classify_by_scope(self, scope_id, conn=None):
        """Look the scope up in the cache. Returns a module code or None."""
        if not scope_id:
            return None

        own_conn = conn is None
        if own_conn:
            from db import get_conn
            conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT sap_module, name FROM calm_scopes WHERE id = %s LIMIT 1",
                    (str(scope_id),),
                )
                row = cur.fetchone()
        except Exception as e:
            print(f"MODULE_CLASSIFIER: scope lookup failed for {scope_id}: {e}")
            return None
        finally:
            if own_conn:
                conn.close()

        if not row:
            return None

        # Row shape differs between RealDictCursor and sqlite3.Row; both index by name.
        stored_module = normalize_module(row['sap_module'] if not isinstance(row, tuple) else row[0])
        if stored_module:
            return stored_module

        # Cached scope exists but was never mapped — try its name.
        name = row['name'] if not isinstance(row, tuple) else row[1]
        return module_from_scope_name(name)

    # ── Layer 2: LLM ──────────────────────────────────────────────────────────

    def classify_by_llm(self, title, text, llm_provider='openai'):
        """Classify from content. Returns (module_code, confidence) or (None, 0.0).

        The provider layer only exposes a generic json_mode flag, so the enum is
        enforced here: anything off-list is discarded rather than stored.
        """
        excerpt = (text or '').strip()[:CLASSIFY_CHAR_LIMIT]
        if not excerpt and not title:
            return None, 0.0

        user_prompt = f"Document title: {title or 'Untitled'}\n\nDocument content:\n{excerpt}"

        try:
            raw = self.openai_service.chat_completion(
                [
                    {"role": "system", "content": CLASSIFIER_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0,
                max_tokens=50,
                provider=llm_provider,
                json_mode=True,
            )
        except Exception as e:
            print(f"MODULE_CLASSIFIER: LLM call failed: {e}")
            return None, 0.0

        try:
            parsed = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            print(f"MODULE_CLASSIFIER: non-JSON response discarded: {raw!r}")
            return None, 0.0

        module = normalize_module(parsed.get('module'))
        if not module or module == UNCLASSIFIED:
            print(f"MODULE_CLASSIFIER: off-taxonomy module discarded: {parsed.get('module')!r}")
            return None, 0.0

        try:
            confidence = float(parsed.get('confidence', 0.0))
        except (TypeError, ValueError):
            confidence = 0.0

        return module, max(0.0, min(1.0, confidence))

    # ── The cascade ───────────────────────────────────────────────────────────

    def classify(self, title='', text='', scope_id=None, conn=None,
                 llm_provider='openai', use_llm=True):
        """Resolve a document's module.

        Returns (module_code, confidence, method). Always returns a usable
        triple — classification must never break ingest.
        """
        try:
            scope_module = self.classify_by_scope(scope_id, conn=conn)
            if scope_module:
                return scope_module, 1.0, METHOD_SCOPE_MAP

            if use_llm:
                llm_module, confidence = self.classify_by_llm(
                    title, text, llm_provider=llm_provider
                )
                if llm_module:
                    return llm_module, confidence, METHOD_LLM
        except Exception as e:
            print(f"MODULE_CLASSIFIER: classification failed for {title!r}: {e}")

        return UNCLASSIFIED, 0.0, None
