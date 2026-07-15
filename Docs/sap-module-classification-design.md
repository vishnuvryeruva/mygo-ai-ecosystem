# SAP Module Classification — Design

**Status**: Implemented (phase 1). §6 remains future work.
**Date**: 2026-07-15
**Scope**: Add an SAP functional module dimension to documents so the dashboard can drill down Project → Module → Document Type.

---

## 1. Problem

The dashboard today filters documents by project and breaks them down by type ("Manual Test Case 48, Solution Document 28…"). Type alone is a weak dimension: it tells you the *shape* of a document, not what part of the business it describes. A consultant asking "what do we have for MM on Project X?" cannot answer it from this screen.

We want a second dimension — the SAP functional module (MM, SD, FI, …) — that a project filter can drive alongside document type.

The `ABAP Objects by Type` panel is currently hardcoded (`web-app/app/(authenticated)/dashboard/page.tsx:58-63`) and is out of scope for the first pass, but the design below deliberately leaves room to unify it under the same module dimension. See §8.

---

## 2. Guiding decision

**The module is looked up where possible, and inferred only where necessary.**

The tempting approach is to have the LLM summarize each document at ingest and name its module. That works, but it makes AI the source of truth for something CALM already knows, and it produces an answer we cannot defend to a customer. "The model thinks this is MM" is a much weaker claim than "this document sits under the Inventory Management scope."

We already store `scope_id` on every chunk (`backend/migrations/init.sql:36`), populated from CALM metadata during ingest (`backend/services/rag_service.py:217`). In SAP Cloud ALM, scopes and solution processes correspond to SAP Best Practice scope items, and those carry a defined line of business. For CALM-sourced documents, the module is therefore a join — free, instant, and explainable.

AI earns its place on the documents that mapping cannot reach: direct file uploads, and scopes we have no mapping for yet.

---

## 3. Taxonomy

A fixed enum of SAP standard module codes. Not free text.

| Code | Label |
|---|---|
| `FI` | Financial Accounting |
| `CO` | Controlling |
| `MM` | Materials Management |
| `SD` | Sales & Distribution |
| `PP` | Production Planning |
| `QM` | Quality Management |
| `PM` | Plant Maintenance |
| `EWM` | Extended Warehouse Management |
| `HCM` | Human Capital Management |
| `PS` | Project System |
| `TECH` | Technical / Basis |
| `CROSS` | Cross-functional |
| `UNCLASSIFIED` | Not yet classified |

Stored as codes, rendered through a label map in the frontend — the same pattern `documentTypeNames` already uses (`web-app/app/(authenticated)/dashboard/page.tsx:6-14`).

**Why fixed**: free-text module labels destroy aggregation. "MM", "Materials Mgmt", and "Materials Management" become three bars on the chart within a week of going live. The enum is also what lets us constrain the LLM's output (§5.2).

**Known trade-off**: a customer using their own terminology has to map onto this list. Accepted for now. If it becomes a real constraint, the escape hatch is an alias table mapping customer scope names onto these codes — additive, no schema rework.

---

## 4. Schema

Three columns on `documents`, not one:

```sql
ALTER TABLE documents ADD COLUMN sap_module TEXT DEFAULT 'UNCLASSIFIED';
ALTER TABLE documents ADD COLUMN sap_module_confidence REAL;
ALTER TABLE documents ADD COLUMN sap_module_method TEXT;  -- scope_map | llm | vector | manual
```

Applied via the existing migration pattern in `backend/db.py`, which already carries the SQLite/Postgres statement pairs this needs.

*Implementation note*: the indexes on these columns are created in that same `db.py` list rather than in `init.sql`. On an existing database `CREATE TABLE IF NOT EXISTS` is a no-op, so the columns do not exist until the `ALTER TABLE` backfill runs — indexing them inside `init.sql` fails and aborts startup. Fresh installs are unaffected, which is exactly why this needs a note.

Storing `method` and `confidence` alongside the value is what makes this shippable rather than a demo:

- It drives a **"needs review"** badge on low-confidence guesses, turning users into the labelling pipeline.
- It answers **"why is this doc in MM?"** — the first question any SAP consultant will ask.
- It lets a re-ingest safely recompute an `llm` guess while never touching a `manual` one (§5.3).

`documents` is a chunk-level table, so `sap_module` is duplicated across a document's chunks. This is consistent with how `project` and `doc_type` already behave, and the stats queries count `DISTINCT document_id`, so aggregation is unaffected.

### Supporting table

We store `scope_id` but never the scope *name*, so there is nothing to map against today. Add a small cache, populated from `CalmService.list_scopes` (`backend/services/calm_service.py:222`):

```sql
CREATE TABLE IF NOT EXISTS calm_scopes (
    id          TEXT PRIMARY KEY,
    name        TEXT,
    project_id  TEXT,
    sap_module  TEXT      -- resolved once, edited by admins
);
```

---

## 5. Classification cascade

Run at ingest, inside `ingest_calm_document` and `ingest_documents`. First layer that answers, wins.

### 5.1 Scope mapping — deterministic

Join `scope_id` against `calm_scopes`. Covers the majority of CALM documents at zero cost.
→ `method = 'scope_map'`, `confidence = 1.0`

### 5.2 LLM classification — the gap-filler

For file uploads and unmapped scopes. One call on the document title plus the first ~2000 characters.

Two details matter:

- **The output must be constrained to the enum.** The model returns `MM` and never "Materials Mgmt". This is the single highest-leverage decision in the design.

  *Implementation note*: the original plan was a provider tool schema, but `OpenAIService` fans out to OpenAI, Claude, Gemini and AI Core behind one generic `chat_completion(json_mode=...)`, and tool schemas differ per provider. So the enum is enforced in `ModuleClassifier.classify_by_llm` instead: JSON mode for shape, then `normalize_module()` rejects anything off-list. Same guarantee, works on all four providers. Hallucinated codes, prose responses, and API errors all degrade to `UNCLASSIFIED` rather than writing garbage.
- **Do not summarize first, then classify.** That is two calls to produce one label. Classify directly.

→ `method = 'llm'`, `confidence` = model-reported, clamped to 0.0–1.0

### 5.3 Human override — always wins

A module dropdown in the Document Hub. Once set, it is never overwritten by a re-ingest.
→ `method = 'manual'`, `confidence = 1.0`

Re-ingest rule: recompute when `method` is `scope_map`, `llm`, or `vector`; skip when `manual`.

---

## 6. The vector alternative (phase 2)

We already compute an embedding for every chunk (`backend/services/rag_service.py:259`). That makes a cheaper classifier available for free:

1. Seed a centroid per module by embedding a canonical description of it.
2. Classify a new document by nearest centroid — **zero extra API calls**.
3. Recompute each centroid as the mean of embeddings of documents humans have confirmed.

The property worth having: this gets **more accurate as users correct it**, rather than staying frozen at whatever the prompt does today.

**Sequencing**: ship the LLM path first — it works on day one with no training data. Add centroids once there are confirmed documents to learn from. Then use **disagreement between the two as the review queue**, which is a better signal than either one's self-reported confidence.

---

## 7. Data flow

```
CALM document
     │
     ├── ingest_calm_document()
     │        │
     │        ├─ scope_id → calm_scopes → sap_module     [scope_map, 1.0]
     │        │       └─ miss ↓
     │        ├─ LLM classify (enum-constrained)          [llm, 0.0–1.0]
     │        │       └─ phase 2: nearest centroid        [vector]
     │        └─ manual override present? → keep it       [manual, 1.0]
     │
     └── documents.sap_module + confidence + method
              │
              └── /api/dashboard/stats?project=&module=
                       └── Dashboard drill-down
```

---

## 8. Frontend design

### Drill-down

The project filter drives **both** panels. Selecting a project shows Documents by Module; clicking a module bar filters to it and breaks that module down by type.

```
Project: [Project X ▾]

Documents by Module          Documents by Type — MM
  MM      ████████ 34   →      Manual Test Case  ███████ 18
  SD      █████    21          Solution Document ████     9
  FI      ████     18          Functional Spec   ██       7
```

The selected project and module are real filters that also apply to the Document Hub list, so a user can go from a bar to the underlying documents in one click.

### Backend

`get_document_stats` (`backend/services/rag_service.py:882`) is already shaped for this — it takes a `project` param and groups by `doc_type`. It needs a `module` param and a second `GROUP BY sap_module` query. No structural change.

### Review affordance

Documents with `method = 'llm'` and low confidence get a badge in the Document Hub. Clicking it opens the module dropdown. This is how the training data for §6 gets created — as a side effect of consultants doing their normal work, not as a labelling project.

### Unifying ABAP objects (later)

ABAP objects live in packages, and SAP package / application-component prefixes map to modules deterministically. Applying the same `sap_module` column to ABAP objects means "Project X → MM" can show the 12 documents **and** the 40 ABAP objects side by side.

This is the part that makes the feature more than a chart: it links spec to code through a shared business dimension, which is the thing a copilot for SAP is actually for.

---

## 9. Rollout

Steps 1–6 are implemented. Step 7 is future work.

1. ✅ Migration + `calm_scopes` cache, everything defaults to `UNCLASSIFIED`.
2. ✅ Populate `calm_scopes` from CALM — `GET /api/calm/<source>/scopes` now caches as a side effect of browsing, so no separate sync step is needed. Keyword mapping in `config/sap_modules.py`; admins can correct via `PUT /api/scopes/<id>/module` and corrections survive re-sync.
3. ✅ Backfill script: `backend/backfill_modules.py` (`--dry-run`, `--use-llm`, `--force`, `--limit`).
4. ✅ `get_document_stats` gains `module`; `list_documents` gains a `module` filter.
5. ✅ Dashboard drill-down.
6. ✅ Document Hub module filter + inline override dropdown + review badge.
7. ⬜ Phase 2: centroid classifier + disagreement review queue.

### Deploying this

1. Restart the backend — `init_db()` adds the columns and the `calm_scopes` table. Existing rows default to `UNCLASSIFIED`; nothing breaks while unclassified.
2. Open a CALM project's scopes once so the cache populates.
3. `python backfill_modules.py --dry-run` to see what scope mapping alone can resolve — free, no LLM.
4. `python backfill_modules.py` to commit that, then `--use-llm` for the remainder if the leftover count justifies the spend (one call per document).

---

## 10. Open questions

- **Multi-module documents.** A solution document can legitimately span MM and SD. Single-value `sap_module` is proposed for v1 because it keeps the charts honest; `CROSS` is the pressure valve. If real data shows this is common, the fix is a `document_modules` join table — worth checking against actual documents before committing either way.
- **Scope-to-module mapping ownership.** Who maintains it, and does it need an admin UI, or is a config file enough for now? Config file assumed for v1.
- **Confidence threshold** for the review badge. Needs real data; no useful prior.
