"""
Classify documents that predate the SAP module column.

    python backfill_modules.py --dry-run     # report what would change
    python backfill_modules.py               # scope mapping only (free, no LLM)
    python backfill_modules.py --use-llm     # also classify what scope mapping misses

Safe to re-run: documents whose module a human set by hand are always skipped,
and by default so is anything already classified (--force overrides that).

Run a --dry-run first — with --use-llm this makes one LLM call per unclassified
document, so on a large corpus it is worth knowing the count in advance.
"""

import argparse
import sys

from db import get_conn
from config.sap_modules import METHOD_MANUAL, UNCLASSIFIED
from services.module_classifier import ModuleClassifier


def fetch_candidates(conn, force: bool):
    """One row per document: the module inputs, plus text from its first chunk."""
    where = "WHERE (sap_module_method IS DISTINCT FROM %s OR sap_module_method IS NULL)"
    params = [METHOD_MANUAL]
    if not force:
        where += " AND (sap_module = %s OR sap_module IS NULL)"
        params.append(UNCLASSIFIED)

    # SQLite has no IS DISTINCT FROM.
    from db import SQLiteConnectionProxy
    if isinstance(conn, SQLiteConnectionProxy):
        where = where.replace("IS DISTINCT FROM %s", "!= %s")

    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT document_id, MIN(document_name) AS document_name,
                   MIN(scope_id) AS scope_id, MIN(content) AS content
            FROM documents
            {where}
            GROUP BY document_id
            """,
            params,
        )
        return cur.fetchall()


def main():
    parser = argparse.ArgumentParser(description="Backfill documents.sap_module")
    parser.add_argument('--dry-run', action='store_true', help="report only, write nothing")
    parser.add_argument('--use-llm', action='store_true',
                        help="classify by content when scope mapping misses (costs one call per doc)")
    parser.add_argument('--force', action='store_true',
                        help="also reclassify documents that already have a module")
    parser.add_argument('--limit', type=int, default=0, help="stop after N documents")
    args = parser.parse_args()

    classifier = ModuleClassifier()
    conn = get_conn()
    try:
        rows = fetch_candidates(conn, args.force)
        if args.limit:
            rows = rows[:args.limit]

        if not rows:
            print("Nothing to backfill.")
            return

        print(f"{len(rows)} document(s) to classify"
              f"{' (dry run)' if args.dry_run else ''}"
              f"{' with LLM fallback' if args.use_llm else ' — scope mapping only'}\n")

        counts = {}
        for row in rows:
            if isinstance(row, tuple):
                doc_id, name, scope_id, content = row
            else:
                doc_id, name, scope_id, content = (
                    row['document_id'], row['document_name'],
                    row['scope_id'], row['content'],
                )

            module, confidence, method, summary = classifier.classify(
                title=name or '', text=content or '', scope_id=scope_id,
                conn=conn, use_llm=args.use_llm,
            )
            counts[method or 'unclassified'] = counts.get(method or 'unclassified', 0) + 1
            print(f"  {(name or doc_id)[:52]:54} {module:14} {method or '-':10} {confidence:.2f}")

            if not args.dry_run:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE documents
                        SET sap_module = %s, sap_module_confidence = %s, sap_module_method = %s,
                            summary = COALESCE(%s, summary)
                        WHERE document_id = %s
                        """,
                        (module, confidence, method, summary or None, doc_id),
                    )

        if not args.dry_run:
            conn.commit()

        print("\nBy method: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
        print("Dry run — nothing written." if args.dry_run else "Backfill committed.")
    except Exception as e:
        conn.rollback()
        print(f"ERROR: backfill failed: {e}", file=sys.stderr)
        raise
    finally:
        conn.close()


if __name__ == '__main__':
    main()
