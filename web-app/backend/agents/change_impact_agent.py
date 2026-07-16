"""
Change Impact Analysis Agent

Compares two SAP projects' documents and reports what is common to both, what is
new in the source project, and what has been removed in the comparison project.

The shape of the problem, and why it is built this way:

1. Pairing before comparing. "Compare project A with project B" is meaningless
   until you know which document lines up with which. Documents are grouped by
   (module, type) — an MM functional spec is only ever compared against another
   MM functional spec — and within a group they are paired by cosine similarity
   over the embeddings we already stored at ingest. Pairing therefore costs no
   API calls, and a rename in CALM does not break it the way filename matching
   would.

2. Comparing on design, not on words. A diff tells you a sentence moved. What a
   consultant needs is whether the *configuration and architecture* differ:
   org structure, master data, integrations, custom objects, process steps. The
   prompt asks for exactly that, and the model is told to ignore wording.
   Two documents that describe the same design in different prose must come back
   as common, not as changed.

Unpaired documents are reported rather than dropped: something in B with no
counterpart in A is 'new', and something in A with no counterpart in B is
'missing' — usually the most interesting cell in the whole report.
"""

import json
import math
import re
from concurrent.futures import ThreadPoolExecutor

from config.sap_modules import MODULE_LABELS, UNCLASSIFIED
from services.openai_service import OpenAIService

llm_service = OpenAIService()

# Pairs are compared concurrently: 12 sequential calls at ~8s each would exceed
# the 120s proxyTimeout in next.config.js. Held low enough to stay clear of
# provider rate limits — the win is latency, not throughput.
COMPARE_CONCURRENCY = 4

# Below this cosine, two documents in the same (module, type) bucket are not
# telling the same story, so pairing them would invent a comparison.
#
# Measured on text-embedding-3-small with two procurement specs describing the
# same design in deliberately different prose: they score 0.82, while the same
# spec against six unrelated documents peaks at 0.51. 0.72 sits in that gap with
# margin on both sides. Re-measure if the embedding model changes — this number
# is only meaningful relative to one model's similarity distribution.
PAIR_SIMILARITY_FLOOR = 0.72

# One LLM call per pair, so this bounds both latency and spend on a single run.
MAX_PAIRS_PER_RUN = 12

# Per document, per side. Enough for design intent; the rest is mostly boilerplate.
COMPARE_CHAR_LIMIT = 4000

DOC_TYPE_LABELS = {
    'NT': 'Note',
    'FS': 'Functional Spec',
    'TS': 'Technical Spec',
    'SD': 'Solution Document',
    'CD': 'Change Document',
    'DP': 'Decision Paper',
    'REQUIREMENT': 'Requirement',
}

COMPARE_SYSTEM_PROMPT = """You are an SAP solution architect performing a change impact analysis between two implementation projects.

You will be given the same type of document from two different projects. Compare them on SOLUTION DESIGN, not on wording.

What matters:
- Organizational structure (company codes, plants, storage locations, sales areas)
- Configuration decisions and their values
- Master data design
- Process steps and their sequence
- Integrations, interfaces, and system boundaries
- Custom objects, enhancements, and workarounds
- Assumptions and constraints that shape the design

What does NOT matter:
- Phrasing, formatting, section order, document templates
- Author, dates, version numbers
- Two documents describing the SAME design in different words are COMMON, not CHANGED.

Reply with JSON only:
{
  "common":  [{"point": "<what both projects do the same way>"}],
  "changed": [{"point": "<the design decision>", "project_a": "<how A does it>", "project_b": "<how B does it>"}],
  "new":     [{"point": "<what exists in B but has no counterpart in A>"}],
  "summary": "<one sentence a consultant could paste into a status report>"
}

Rules:
- Be specific and concrete. "Different plant configuration" is useless; "A uses one plant (1010), B uses two (1010, 1020)" is useful.
- Only state what the documents support. Never infer beyond them.
- An empty list is a valid and honest answer.
- JSON only. No prose outside the JSON."""


def _cosine(v1, v2) -> float:
    if not v1 or not v2:
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    m1 = math.sqrt(sum(a * a for a in v1))
    m2 = math.sqrt(sum(b * b for b in v2))
    if not m1 or not m2:
        return 0.0
    return dot / (m1 * m2)


def _type_label(doc_type: str) -> str:
    return DOC_TYPE_LABELS.get(doc_type, doc_type or 'Unknown')


def _module_label(code: str) -> str:
    return MODULE_LABELS.get(code, code or UNCLASSIFIED)


def _extract_json(text: str) -> dict:
    """Providers differ: some honour json_mode, some wrap JSON in fences."""
    text = re.sub(r'^```(?:json)?\s*', '', (text or '').strip(), flags=re.MULTILINE)
    text = re.sub(r'```\s*$', '', text.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    start = text.find('{')
    if start == -1:
        raise ValueError(f"No JSON object in response: {text[:160]}")
    depth = 0
    in_string = False
    escape = False
    for i, ch in enumerate(text[start:], start=start):
        if escape:
            escape = False
            continue
        if ch == '\\' and in_string:
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                return json.loads(text[start:i + 1])
    raise ValueError(f"Incomplete JSON in response: {text[:160]}")


def _bucket(docs: list) -> dict:
    """Group documents by (module, type) — the only axis on which comparing is meaningful."""
    out = {}
    for d in docs:
        out.setdefault((d.get('module') or UNCLASSIFIED, d.get('type') or 'Unknown'), []).append(d)
    return out


def build_coverage_table(docs_a: list, docs_b: list) -> list:
    """Counts per module and document type on both sides.

    This is what lets a consultant choose what to analyse instead of comparing a
    whole project blind: see that MM has 12 test cases here and 9 there, then run
    the analysis on that cell alone. It is pure counting — no LLM calls — so the
    table can render immediately while the comparison is still a click away.
    """
    rows = {}
    for side, docs in (('a', docs_a), ('b', docs_b)):
        for d in docs:
            key = (d.get('module') or UNCLASSIFIED, d.get('type') or 'Unknown')
            row = rows.setdefault(key, {
                'module': key[0],
                'moduleLabel': _module_label(key[0]),
                'type': key[1],
                'typeLabel': _type_label(key[1]),
                'countA': 0,
                'countB': 0,
            })
            row['count' + side.upper()] += 1

    table = list(rows.values())
    for row in table:
        # Surfaced so the UI can flag one-sided cells without recomputing them.
        row['onlyInA'] = row['countB'] == 0
        row['onlyInB'] = row['countA'] == 0
    table.sort(key=lambda r: (r['moduleLabel'], r['typeLabel']))
    return table


def pair_documents(docs_a: list, docs_b: list) -> dict:
    """Match A's documents to B's within each (module, type) bucket.

    Greedy nearest-neighbour on the embeddings we already have: take the highest
    similarity available, consume both sides, repeat. Greedy rather than optimal
    because a bucket holds a handful of documents, and a consultant can re-pair
    by eye far more cheaply than we can justify a Hungarian solver here.

    Returns {'pairs': [...], 'missing': [...A-only...], 'new': [...B-only...]}.
    """
    buckets_a = _bucket(docs_a)
    buckets_b = _bucket(docs_b)

    pairs = []
    missing = []
    new = []

    for key in set(buckets_a) | set(buckets_b):
        module, doc_type = key
        side_a = list(buckets_a.get(key, []))
        side_b = list(buckets_b.get(key, []))

        if not side_a:
            new.extend(side_b)
            continue
        if not side_b:
            missing.extend(side_a)
            continue

        scored = sorted(
            (
                (_cosine(a.get('embedding'), b.get('embedding')), ia, ib)
                for ia, a in enumerate(side_a)
                for ib, b in enumerate(side_b)
            ),
            key=lambda t: t[0],
            reverse=True,
        )

        used_a, used_b = set(), set()
        for score, ia, ib in scored:
            if ia in used_a or ib in used_b or score < PAIR_SIMILARITY_FLOOR:
                continue
            used_a.add(ia)
            used_b.add(ib)
            pairs.append({
                'module': module,
                'moduleLabel': _module_label(module),
                'type': doc_type,
                'typeLabel': _type_label(doc_type),
                'similarity': round(score, 3),
                'a': side_a[ia],
                'b': side_b[ib],
            })

        missing.extend(d for i, d in enumerate(side_a) if i not in used_a)
        new.extend(d for i, d in enumerate(side_b) if i not in used_b)

    # Strongest matches first: they are the ones worth spending a call on.
    pairs.sort(key=lambda p: p['similarity'], reverse=True)
    return {'pairs': pairs, 'missing': missing, 'new': new}


def compare_pair(pair: dict, project_a: str, project_b: str, llm_provider: str = 'openai') -> dict:
    """One LLM call for one document pair. Never raises — a failed comparison is
    reported in place so one bad pair cannot sink the whole report."""
    user_prompt = (
        f"Document type: {pair['typeLabel']}   |   SAP module: {pair['moduleLabel']}\n\n"
        f"=== PROJECT A: {project_a} — \"{pair['a']['name']}\" ===\n"
        f"{(pair['a'].get('text') or '')[:COMPARE_CHAR_LIMIT]}\n\n"
        f"=== PROJECT B: {project_b} — \"{pair['b']['name']}\" ===\n"
        f"{(pair['b'].get('text') or '')[:COMPARE_CHAR_LIMIT]}\n\n"
        "Return the fit-gap JSON."
    )
    try:
        raw = llm_service.chat_completion(
            messages=[
                {'role': 'system', 'content': COMPARE_SYSTEM_PROMPT},
                {'role': 'user', 'content': user_prompt},
            ],
            temperature=0.1,
            max_tokens=1500,
            provider=llm_provider,
            # Claude and Gemini go through a text path; _extract_json handles fences.
            json_mode=(llm_provider not in ('claude', 'gemini')),
        )
        parsed = _extract_json(raw)
    except Exception as e:
        print(f"CHANGE_IMPACT: comparison failed for {pair['a']['name']} vs {pair['b']['name']}: {e}")
        return {'error': str(e), 'common': [], 'changed': [], 'new': [],
                'summary': 'Comparison unavailable for this pair.'}

    def rows(key):
        val = parsed.get(key)
        return val if isinstance(val, list) else []

    return {
        'common': rows('common'),
        'changed': rows('changed'),
        'new': rows('new'),
        'summary': str(parsed.get('summary') or '').strip(),
    }


def _doc_ref(d: dict) -> dict:
    """A document in a gap section.

    The summary is the point: a filename like "RICEF DOC3" tells a consultant
    nothing about what is missing, so the stored summary carries the answer. It
    falls back to an excerpt of the content when a document predates summaries
    rather than showing a bare name.
    """
    summary = (d.get('summary') or '').strip()
    if not summary:
        text = (d.get('text') or '').strip()
        summary = (text[:280] + '…') if len(text) > 280 else text
    return {
        'documentId': d.get('documentId'),
        'name': d.get('name'),
        'type': d.get('type'),
        'typeLabel': _type_label(d.get('type')),
        'module': d.get('module'),
        'moduleLabel': _module_label(d.get('module')),
        'summary': summary,
    }


def run_change_impact(project_a: str, project_b: str, rag_service,
                      project_a_id: str = '', project_b_id: str = '',
                      module: str = '', doc_type: str = '',
                      llm_provider: str = 'openai',
                      table_only: bool = False,
                      max_pairs: int = MAX_PAIRS_PER_RUN) -> dict:
    """Compare a source project against a comparison project.

    project_a is the source, project_b the comparison. Results come back in three
    sections: common to both, new in the source, and removed in the comparison.

    table_only returns just the coverage table — counts per module and type, no
    LLM calls. That is the first screen: pick the cell worth analysing, then run
    the analysis narrowed to it, instead of paying for a whole-project sweep.
    """
    docs_a = rag_service.get_documents_for_comparison(
        project_id=project_a_id, project='' if project_a_id else project_a, module=module)
    docs_b = rag_service.get_documents_for_comparison(
        project_id=project_b_id, project='' if project_b_id else project_b, module=module)

    # Narrowing to a section ("just the test cases") happens here rather than in
    # SQL so the coverage table above it still reflects the whole project.
    if doc_type:
        docs_a = [d for d in docs_a if d.get('type') == doc_type]
        docs_b = [d for d in docs_b if d.get('type') == doc_type]

    coverage = build_coverage_table(docs_a, docs_b)
    base = {
        'projectA': project_a,
        'projectB': project_b,
        'module': module or '',
        'docType': doc_type or '',
        'coverage': coverage,
        'commonToBoth': [],
        'newInSource': [],
        'removedInComparison': [],
        'stats': {
            'documentsA': len(docs_a), 'documentsB': len(docs_b),
            'paired': 0, 'compared': 0, 'truncated': False,
        },
    }

    if table_only:
        base['summary'] = (
            f"**{project_a}** has **{len(docs_a)}** document(s) with content, "
            f"**{project_b}** has **{len(docs_b)}**. Pick a module and document type to analyse."
        )
        return base

    if not docs_a and not docs_b:
        base['summary'] = (
            'Neither project has documents with content in the Document Hub. '
            'Sync them from CALM first.'
        )
        return base

    if not docs_a or not docs_b:
        empty_side = project_a if not docs_a else project_b
        filled = docs_b if not docs_a else docs_a
        base['newInSource'] = [_doc_ref(d) for d in (docs_a or [])]
        base['removedInComparison'] = [_doc_ref(d) for d in (docs_b or [])]
        base['summary'] = (
            f'**{empty_side}** has no documents with content in the Document Hub, so there '
            f'is nothing to compare against. The other project has {len(filled)}. '
            'Sync it from CALM to run a real analysis.'
        )
        return base

    matched = pair_documents(docs_a, docs_b)
    pairs = matched['pairs']
    truncated = len(pairs) > max_pairs

    selected = pairs[:max_pairs]
    with ThreadPoolExecutor(max_workers=COMPARE_CONCURRENCY) as pool:
        verdicts = list(pool.map(
            lambda p: compare_pair(p, project_a, project_b, llm_provider=llm_provider),
            selected,
        ))

    comparisons = [
        {
            'module': pair['module'],
            'moduleLabel': pair['moduleLabel'],
            'type': pair['type'],
            'typeLabel': pair['typeLabel'],
            'similarity': pair['similarity'],
            'documentA': _doc_ref(pair['a']),
            'documentB': _doc_ref(pair['b']),
            **verdict,
        }
        for pair, verdict in zip(selected, verdicts)
    ]

    total_common = sum(len(c['common']) for c in comparisons)
    total_changed = sum(len(c['changed']) for c in comparisons)
    total_new = sum(len(c['new']) for c in comparisons)

    bits = [
        f"Compared **{len(comparisons)}** document pair(s) between **{project_a}** and **{project_b}**.",
        f"**{total_common}** common, **{total_changed}** changed, **{total_new}** new design points.",
    ]
    if matched['missing']:
        bits.append(f"**{len(matched['missing'])}** document(s) in {project_a} are not in {project_b}.")
    if matched['new']:
        bits.append(f"**{len(matched['new'])}** document(s) in {project_b} are not in {project_a}.")
    if truncated:
        bits.append(f"Showing the {max_pairs} closest pairs of {len(pairs)}.")

    base.update({
        'commonToBoth': comparisons,
        # Source-only: the source project has these, the comparison does not.
        'newInSource': [_doc_ref(d) for d in matched['missing']],
        # Comparison-only: present there, absent from the source.
        'removedInComparison': [_doc_ref(d) for d in matched['new']],
        'summary': ' '.join(bits),
        'stats': {
            'documentsA': len(docs_a),
            'documentsB': len(docs_b),
            'paired': len(pairs),
            'compared': len(comparisons),
            'truncated': truncated,
        },
    })
    return base
