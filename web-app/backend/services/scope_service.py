"""
Keeps the calm_scopes cache in sync with CALM.

documents.scope_id records which CALM scope a document belongs to, but not the
scope's name — so without this cache there is nothing for the classifier's
deterministic layer to map against.

Each scope's module is resolved from its name once on first sync. Admins can
correct it afterwards, and a correction survives later syncs.
"""

from datetime import datetime

from db import get_conn
from config.sap_modules import MODULE_LABELS, module_from_scope_name, normalize_module


class ScopeService:
    """CRUD over the calm_scopes cache."""

    def sync_scopes(self, project_id: str, scopes: list) -> dict:
        """Upsert scopes for a project.

        An admin-set module is never overwritten — we only fill in scopes whose
        module is still unresolved.
        """
        if not scopes:
            return {'synced': 0, 'mapped': 0, 'unmapped': []}

        now = datetime.now().isoformat()
        synced = 0
        mapped = 0
        unmapped = []

        conn = get_conn()
        try:
            for scope in scopes:
                scope_id = scope.get('id')
                if not scope_id:
                    continue
                name = scope.get('name') or ''
                resolved = module_from_scope_name(name)

                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT sap_module FROM calm_scopes WHERE id = %s",
                        (str(scope_id),),
                    )
                    existing = cur.fetchone()

                    if existing:
                        current = existing[0] if isinstance(existing, tuple) else existing['sap_module']
                        # Only fill gaps; never clobber a curated mapping.
                        module = current or resolved
                        cur.execute(
                            """
                            UPDATE calm_scopes
                            SET name = %s, project_id = %s, sap_module = %s, synced_at = %s
                            WHERE id = %s
                            """,
                            (name, str(project_id), module, now, str(scope_id)),
                        )
                    else:
                        module = resolved
                        cur.execute(
                            """
                            INSERT INTO calm_scopes (id, name, project_id, sap_module, synced_at)
                            VALUES (%s, %s, %s, %s, %s)
                            """,
                            (str(scope_id), name, str(project_id), module, now),
                        )

                synced += 1
                if module:
                    mapped += 1
                else:
                    unmapped.append({'id': str(scope_id), 'name': name})

            conn.commit()
        except Exception as e:
            conn.rollback()
            print(f"Error syncing scopes for project {project_id}: {e}")
            raise
        finally:
            conn.close()

        return {'synced': synced, 'mapped': mapped, 'unmapped': unmapped}

    def list_scopes(self, project_id: str = '') -> list:
        """All cached scopes, newest sync first. Unmapped ones surface for triage."""
        conn = get_conn()
        try:
            with conn.cursor() as cur:
                if project_id:
                    cur.execute(
                        """
                        SELECT id, name, project_id, sap_module, synced_at
                        FROM calm_scopes WHERE project_id = %s ORDER BY name
                        """,
                        (str(project_id),),
                    )
                else:
                    cur.execute(
                        """
                        SELECT id, name, project_id, sap_module, synced_at
                        FROM calm_scopes ORDER BY name
                        """
                    )
                rows = cur.fetchall()
        except Exception as e:
            print(f"Error listing cached scopes: {e}")
            return []
        finally:
            conn.close()

        result = []
        for row in rows:
            if isinstance(row, tuple):
                scope_id, name, proj, module, synced_at = row
            else:
                scope_id = row['id']
                name = row['name']
                proj = row['project_id']
                module = row['sap_module']
                synced_at = row['synced_at']
            result.append({
                'id': scope_id,
                'name': name,
                'projectId': proj,
                'sapModule': module,
                'sapModuleLabel': MODULE_LABELS.get(module) if module else None,
                'syncedAt': synced_at,
            })
        return result

    def set_scope_module(self, scope_id: str, module: str) -> bool:
        """Curate a scope's module by hand. Survives subsequent syncs."""
        normalized = normalize_module(module)
        if not normalized:
            raise ValueError(f"'{module}' is not a valid SAP module code")

        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE calm_scopes SET sap_module = %s WHERE id = %s",
                    (normalized, str(scope_id)),
                )
                updated = cur.rowcount
            conn.commit()
            return updated > 0
        except Exception as e:
            conn.rollback()
            print(f"Error setting module for scope {scope_id}: {e}")
            raise
        finally:
            conn.close()
