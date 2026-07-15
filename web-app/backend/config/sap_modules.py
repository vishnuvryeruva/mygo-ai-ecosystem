"""
SAP functional module taxonomy.

Single source of truth for the module enum. The frontend label map and the
LLM classifier both derive from MODULES — nothing else should hardcode a code.
"""

# Ordered: drives display order on the dashboard.
MODULES = [
    ('FI', 'Financial Accounting'),
    ('CO', 'Controlling'),
    ('MM', 'Materials Management'),
    ('SD', 'Sales & Distribution'),
    ('PP', 'Production Planning'),
    ('QM', 'Quality Management'),
    ('PM', 'Plant Maintenance'),
    ('EWM', 'Extended Warehouse Management'),
    ('HCM', 'Human Capital Management'),
    ('PS', 'Project System'),
    ('TECH', 'Technical / Basis'),
    ('CROSS', 'Cross-functional'),
    ('UNCLASSIFIED', 'Unclassified'),
]

MODULE_CODES = [code for code, _ in MODULES]
MODULE_LABELS = dict(MODULES)

UNCLASSIFIED = 'UNCLASSIFIED'

# Codes the classifier is allowed to assign. UNCLASSIFIED is a fallback we set
# ourselves, never something a classifier should actively choose.
ASSIGNABLE_CODES = [c for c in MODULE_CODES if c != UNCLASSIFIED]

# Methods recorded in documents.sap_module_method
METHOD_SCOPE_MAP = 'scope_map'
METHOD_LLM = 'llm'
METHOD_VECTOR = 'vector'
METHOD_MANUAL = 'manual'

# Never recompute a module that was set this way.
STICKY_METHODS = {METHOD_MANUAL}

# An LLM guess below this confidence gets flagged for human review. Picked without
# data — revisit once there are real classification results to look at.
REVIEW_CONFIDENCE_THRESHOLD = 0.7


def is_valid_module(code) -> bool:
    return isinstance(code, str) and code.upper() in MODULE_CODES


def normalize_module(code):
    """Return the canonical code, or None if it is not in the taxonomy."""
    if not isinstance(code, str):
        return None
    candidate = code.strip().upper()
    return candidate if candidate in MODULE_CODES else None


# ── Scope name → module ────────────────────────────────────────────────────────
# CALM scope and solution-process names are free text, so we match on keywords.
# Checked longest-first so "accounts payable" wins over "accounts".
SCOPE_KEYWORD_MAP = {
    # FI
    'general ledger': 'FI',
    'accounts payable': 'FI',
    'accounts receivable': 'FI',
    'asset accounting': 'FI',
    'accounts': 'FI',
    'financial': 'FI',
    'finance': 'FI',
    'treasury': 'FI',
    'tax': 'FI',
    'billing': 'FI',
    # CO
    'cost center': 'CO',
    'profitability': 'CO',
    'controlling': 'CO',
    'product costing': 'CO',
    'internal order': 'CO',
    # MM
    'inventory management': 'MM',
    'materials management': 'MM',
    'procure to pay': 'MM',
    'procurement': 'MM',
    'purchasing': 'MM',
    'material': 'MM',
    'vendor': 'MM',
    'supplier': 'MM',
    'inventory': 'MM',
    # SD
    'sales and distribution': 'SD',
    'sales & distribution': 'SD',
    'order to cash': 'SD',
    'sell from stock': 'SD',
    'customer': 'SD',
    'sales': 'SD',
    'shipping': 'SD',
    'pricing': 'SD',
    # PP
    'production planning': 'PP',
    'manufacturing': 'PP',
    'production': 'PP',
    'mrp': 'PP',
    'bill of material': 'PP',
    # QM
    'quality management': 'QM',
    'quality': 'QM',
    'inspection': 'QM',
    # PM
    'plant maintenance': 'PM',
    'maintenance': 'PM',
    'asset management': 'PM',
    # EWM
    'extended warehouse': 'EWM',
    'warehouse management': 'EWM',
    'warehouse': 'EWM',
    'logistics execution': 'EWM',
    # HCM
    'human capital': 'HCM',
    'human resources': 'HCM',
    'successfactors': 'HCM',
    'payroll': 'HCM',
    'employee': 'HCM',
    # PS
    'project system': 'PS',
    'project management': 'PS',
    # TECH
    'basis': 'TECH',
    'security': 'TECH',
    'authorization': 'TECH',
    'integration': 'TECH',
    'technical': 'TECH',
    'migration': 'TECH',
    'infrastructure': 'TECH',
    # CROSS
    'master data': 'CROSS',
    'cross': 'CROSS',
    'reporting': 'CROSS',
    'analytics': 'CROSS',
}

_KEYWORDS_BY_LENGTH = sorted(SCOPE_KEYWORD_MAP, key=len, reverse=True)


def module_from_scope_name(scope_name):
    """Map a free-text CALM scope name onto a module code, or None."""
    if not scope_name:
        return None
    haystack = scope_name.strip().lower()
    for keyword in _KEYWORDS_BY_LENGTH:
        if keyword in haystack:
            return SCOPE_KEYWORD_MAP[keyword]
    return None


def taxonomy_payload():
    """Serializable taxonomy for the frontend."""
    return [{'code': code, 'label': label} for code, label in MODULES]
