"""
Matrix Analytics Agent
Translates natural-language analytics requests into document stats queries
and project-vs-project comparisons using existing dashboard aggregates.
"""

import json
import re
from services.openai_service import OpenAIService

llm_service = OpenAIService()

DOC_TYPE_LABELS = {
    'NT': 'Note',
    'FS': 'Functional Spec',
    'TS': 'Technical Spec',
    'SD': 'Solution Document',
    'CD': 'Change Document',
    'DP': 'Decision Paper',
    'REQUIREMENT': 'Requirement',
}

INTENT_SYSTEM_PROMPT = """You are Matrix, an analytics intent parser for SAP project document statistics.

Given the user's natural-language request and the list of available project names, return ONLY a JSON object with these keys:
  "mode": "single" or "compare"
  "project": project name for single-project mode, or null
  "project_a": first project for compare mode, or null
  "project_b": second project for compare mode, or null
  "view": "overview" | "by_module" | "by_type"
  "clarification": plain-text question if project names are missing/ambiguous, otherwise empty string

Rules:
- Match project names to the provided list (case-insensitive / fuzzy). Always return the exact name from the list when matched.
- mode "compare" only when the user clearly wants project vs project comparison.
- If compare is requested but one or both projects cannot be resolved, set clarification and leave project_a/project_b null when unknown.
- If single mode and no project can be resolved, set clarification asking which project (mention available options briefly).
- Prefer "by_module" when the user mentions modules/SAP areas; "by_type" when they mention document types/specs; otherwise "overview".
- Never invent project names that are not in the list.
"""


def _extract_json(text: str) -> dict:
    text = re.sub(r'^```(?:json)?\s*', '', text.strip(), flags=re.MULTILINE)
    text = re.sub(r'```\s*$', '', text.strip(), flags=re.MULTILINE)
    text = text.strip()

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find('{')
    if start == -1:
        raise ValueError(f"No JSON object found in response: {text[:200]}")

    depth = 0
    in_string = False
    escape_next = False

    for i, ch in enumerate(text[start:], start=start):
        if escape_next:
            escape_next = False
            continue
        if ch == '\\' and in_string:
            escape_next = True
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

    raise ValueError(f"Incomplete JSON object in response: {text[:200]}")


def _resolve_project(name: str | None, projects: list[str]) -> str | None:
    if not name or not projects:
        return None
    needle = name.strip().lower()
    for p in projects:
        if p.lower() == needle:
            return p
    for p in projects:
        if needle in p.lower() or p.lower() in needle:
            return p
    return None


def _type_bars(stats: dict) -> list[dict]:
    bars = []
    for item in stats.get('documents_by_type') or []:
        raw = item.get('type') or 'Unknown'
        bars.append({
            'label': DOC_TYPE_LABELS.get(raw, raw),
            'count': int(item.get('count') or 0),
        })
    return bars


def _module_bars(stats: dict) -> list[dict]:
    bars = []
    for item in stats.get('documents_by_module') or []:
        bars.append({
            'label': item.get('label') or item.get('module') or 'Unclassified',
            'count': int(item.get('count') or 0),
        })
    return bars


def _charts_for_stats(project_label: str, stats: dict, view: str) -> list[dict]:
    charts = []
    if view in ('overview', 'by_module'):
        charts.append({
            'title': f'{project_label} — Documents by Module',
            'bars': _module_bars(stats),
        })
    if view in ('overview', 'by_type'):
        charts.append({
            'title': f'{project_label} — Documents by Type',
            'bars': _type_bars(stats),
        })
    return charts


def _summarize_single(project: str | None, stats: dict, view: str) -> str:
    total = int(stats.get('total_documents') or 0)
    needs_review = int(stats.get('needs_review') or 0)
    scope = f'**{project}**' if project else '**all projects**'

    if view == 'by_module':
        modules = _module_bars(stats)
        top = modules[0] if modules else None
        top_line = f" Top module: **{top['label']}** ({top['count']})." if top else ''
        return f"{scope} has **{total}** documents across modules.{top_line} **{needs_review}** need module review."
    if view == 'by_type':
        types = _type_bars(stats)
        top = types[0] if types else None
        top_line = f" Most common type: **{top['label']}** ({top['count']})." if top else ''
        return f"{scope} has **{total}** documents by type.{top_line} **{needs_review}** need module review."
    return (
        f"{scope} has **{total}** documents. "
        f"**{needs_review}** documents need SAP module review."
    )


def _summarize_compare(project_a: str, stats_a: dict, project_b: str, stats_b: dict, view: str) -> str:
    total_a = int(stats_a.get('total_documents') or 0)
    total_b = int(stats_b.get('total_documents') or 0)
    diff = total_a - total_b
    if diff > 0:
        delta = f"**{project_a}** has **{diff}** more documents than **{project_b}**."
    elif diff < 0:
        delta = f"**{project_b}** has **{abs(diff)}** more documents than **{project_a}**."
    else:
        delta = f"**{project_a}** and **{project_b}** have the same document count."

    view_note = ''
    if view == 'by_module':
        view_note = ' Showing module breakdowns below.'
    elif view == 'by_type':
        view_note = ' Showing document-type breakdowns below.'

    return (
        f"**{project_a}**: {total_a} docs · **{project_b}**: {total_b} docs. "
        f"{delta}{view_note}"
    )


def parse_intent(query: str, projects: list[str], llm_provider: str = 'openai') -> dict:
    project_list = '\n'.join(f'- {p}' for p in projects) if projects else '(none)'
    user_prompt = (
        f"Available projects:\n{project_list}\n\n"
        f"User request:\n{query}\n\n"
        "Return the intent JSON."
    )

    response_text = llm_service.chat_completion(
        messages=[
            {'role': 'system', 'content': INTENT_SYSTEM_PROMPT},
            {'role': 'user', 'content': user_prompt},
        ],
        temperature=0.1,
        max_tokens=800,
        provider=llm_provider,
        json_mode=(llm_provider not in ('claude', 'gemini')),
    )

    try:
        raw = _extract_json(response_text)
    except Exception:
        return {
            'mode': 'single',
            'project': None,
            'project_a': None,
            'project_b': None,
            'view': 'overview',
            'clarification': (
                'I could not parse that request. Try something like '
                '"Show document stats for Project X" or '
                '"Compare Project A vs Project B".'
            ),
        }

    mode = (raw.get('mode') or 'single').strip().lower()
    if mode not in ('single', 'compare'):
        mode = 'single'

    view = (raw.get('view') or 'overview').strip().lower()
    if view not in ('overview', 'by_module', 'by_type'):
        view = 'overview'

    clarification = str(raw.get('clarification') or '').strip()

    return {
        'mode': mode,
        'project': _resolve_project(raw.get('project'), projects),
        'project_a': _resolve_project(raw.get('project_a'), projects),
        'project_b': _resolve_project(raw.get('project_b'), projects),
        'view': view,
        'clarification': clarification,
    }


def handle_query(query: str, rag_service, llm_provider: str = 'openai') -> dict:
    """Parse NL query, fetch stats, return answer + bar chart payloads."""
    base = rag_service.get_document_stats()
    projects = list(base.get('projects') or [])

    if not query or not query.strip():
        return {'answer': 'Ask me for project document stats or to compare two projects.', 'charts': []}

    intent = parse_intent(query.strip(), projects, llm_provider=llm_provider)
    mode = intent['mode']
    view = intent['view']
    clarification = intent.get('clarification') or ''

    if mode == 'compare':
        project_a = intent.get('project_a')
        project_b = intent.get('project_b')
        if not project_a or not project_b:
            options = ', '.join(projects[:12]) if projects else 'none available yet'
            msg = clarification or (
                f'Which two projects should I compare? Available projects: {options}.'
            )
            return {'answer': msg, 'charts': [], 'intent': intent}

        if project_a == project_b:
            return {
                'answer': f'Pick two different projects to compare. **{project_a}** was specified twice.',
                'charts': [],
                'intent': intent,
            }

        stats_a = rag_service.get_document_stats(project=project_a)
        stats_b = rag_service.get_document_stats(project=project_b)
        charts = (
            _charts_for_stats(project_a, stats_a, view)
            + _charts_for_stats(project_b, stats_b, view)
        )
        return {
            'answer': _summarize_compare(project_a, stats_a, project_b, stats_b, view),
            'charts': charts,
            'intent': intent,
        }

    # Single-project (or all projects) mode
    project = intent.get('project')
    if not project and clarification:
        return {'answer': clarification, 'charts': [], 'intent': intent}

    # If user named something we couldn't resolve and no clarification, ask
    if not project and projects and _looks_like_named_project(query, projects):
        options = ', '.join(projects[:12])
        return {
            'answer': clarification or f'Which project did you mean? Available: {options}.',
            'charts': [],
            'intent': intent,
        }

    stats = rag_service.get_document_stats(project=project or '')
    label = project or 'All Projects'
    return {
        'answer': _summarize_single(project, stats, view),
        'charts': _charts_for_stats(label, stats, view),
        'intent': intent,
    }


def _looks_like_named_project(query: str, projects: list[str]) -> bool:
    """Heuristic: query mentions 'project' or a fragment that almost matches."""
    q = query.lower()
    if 'project' in q or 'compare' in q:
        return True
    for p in projects:
        # Partial token overlap without full resolve (already failed resolve)
        tokens = [t for t in re.split(r'\W+', p.lower()) if len(t) > 2]
        if any(t in q for t in tokens):
            return True
    return False
