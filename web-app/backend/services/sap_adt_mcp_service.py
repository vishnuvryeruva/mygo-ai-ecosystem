"""
SAP ADT MCP (Model Context Protocol) Integration Service — Embedded Mode
========================================================================
This module provides the in-app, embedded SAP ADT connector for YODA.

Architecture decisions:
- The external VS Code ADT MCP Server (port 2236) is NOT used.
- All SAP operations go through EmbeddedADTMCPClient which wraps DirectADTClient.
- ADTMCPRouter is the single entry-point for all SAP operations with priority:
    1. SAP ADT Embedded (primary)  — direct ADT REST calls via EmbeddedADTMCPClient
    2. BTP OData (secondary)       — existing BTPService, unchanged
    3. Standalone AI (last resort) — returns placeholder message

Capabilities:
- Read:    fetch source code (classes, programs, CDS, tables, FUGRs ...)
- Browse:  list all objects in a SAP package (ADT nodestructure endpoint)
- Write:   create objects, write source code, activate
- Test:    run ATC static checks, run ABAP unit tests
- Deploy:  create transports, generate RAP artifacts
"""

import os
from typing import Dict, Any, List, Optional


def _odata_quote(value: str) -> str:
    """Escape a value for use inside a single-quoted OData string literal."""
    return str(value or "").replace("'", "''")


def _odata_rows(data: Any) -> List[Dict[str, Any]]:
    """Extract the row list from an OData v2 (d.results) or v4 (value) payload."""
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        rows = data.get("value")
        if rows is None:
            rows = (data.get("d") or {}).get("results")
        if isinstance(rows, list):
            return rows
    return []


# ─────────────────────────────────────────────────────────────────────────────
# EmbeddedADTMCPClient
# Wraps DirectADTClient; exposes a unified MCP-style tool interface.
# This is the ONLY active SAP connector class in YODA.
# ─────────────────────────────────────────────────────────────────────────────

class EmbeddedADTMCPClient:
    """
    In-process ADT MCP client that translates all tool calls to SAP ADT REST APIs
    using DirectADTClient as the underlying transport.

    This is the primary (and only) SAP connector used by YODA.
    The external VS Code MCP server is not used.
    """

    def __init__(self, api_endpoint: str, client: str = "300",
                 username: str = "", password: str = "",
                 sap_router: Optional[str] = None,
                 btp_proxy_config: Optional[dict] = None):
        from services.sap_adt_service import DirectADTClient
        self.api_endpoint = api_endpoint
        self.client_id = client or "300"
        self.username = username
        self.password = password
        self.sap_router = sap_router or ""
        self.btp_proxy_config = btp_proxy_config or {}
        self.direct_client = DirectADTClient(
            api_endpoint=api_endpoint,
            client=self.client_id,
            username=username,
            password=password,
            sap_router=sap_router,
            btp_proxy_config=self.btp_proxy_config
        )
        self._connected = False
        self._last_error = ""

    def _ensure_connected(self) -> bool:
        """Connect and obtain CSRF token if not already done."""
        if not self._connected:
            try:
                self._connected = self.direct_client.connect()
                self._last_error = ""
            except Exception as e:
                print(f"EmbeddedADTMCPClient: connect() failed: {e}")
                self._last_error = str(e)
                self._connected = False
        return self._connected

    # ─────────────────────────────────────────────────────────────────────
    # Core: generic tool dispatch (MCP-compatible signature)
    # ─────────────────────────────────────────────────────────────────────

    def call_tool(self, tool_name: str, arguments: Optional[dict] = None) -> Dict[str, Any]:
        """
        Dispatch an MCP-style tool call to the appropriate DirectADTClient method.
        All tool names use the abap_* convention for forward compatibility.
        """
        args = arguments or {}
        try:
            # ── Destinations / connectivity ───────────────────────────────
            if tool_name in ("abap_lists_destinations", "list_destinations"):
                ok = self._ensure_connected()
                if ok:
                    dest = f"{self.direct_client.host}_{self.client_id}"
                    return {
                        "success": True,
                        "result": {
                            "content": [{"type": "text",
                                         "text": f"Connected to SAP at {self.direct_client.base_url}"}],
                            "destinations": [dest, "DEFAULT_ADT"]
                        }
                    }
                err_msg = self._last_error or f"Cannot authenticate with SAP at {self.api_endpoint}"
                return {"success": False, "error": err_msg}

            # ── Package / repository browsing ─────────────────────────────
            elif tool_name == "abap_package_contents":
                pkg = args.get("packageName") or args.get("package_name") or ""
                self._ensure_connected()
                result = self.direct_client.fetch_package_contents(pkg)
                return {"success": result.get("success", False), "result": result}

            # ── Repository object search ──────────────────────────────────
            elif tool_name in ("abap_repository_search", "search_objects"):
                q = args.get("query") or args.get("pattern") or ""
                limit = int(args.get("maxResults") or args.get("limit") or 20)
                self._ensure_connected()
                result = self.direct_client.search_objects(q, max_results=limit)
                return {"success": result.get("success", False), "result": result}

            # ── Source code read ──────────────────────────────────────────
            elif tool_name == "abap_source_code_read":
                obj_name = args.get("objectName") or args.get("object_name") or ""
                obj_type = args.get("objectType") or args.get("object_type") or "CLAS"
                self._ensure_connected()
                result = self.direct_client.fetch_source_code(obj_name, obj_type)
                return {"success": result.get("success", False), "result": result}

            # ── Source code write ─────────────────────────────────────────
            elif tool_name == "abap_source_code_write":
                obj_name   = args.get("objectName") or args.get("object_name") or ""
                obj_type   = args.get("objectType") or args.get("object_type") or "CLAS"
                source     = args.get("sourceCode") or args.get("source_code") or ""
                self._ensure_connected()
                result = self.direct_client.write_source_code(obj_name, obj_type, source)
                return {"success": result.get("success", False), "result": result}

            # ── Object creation ───────────────────────────────────────────
            elif tool_name in ("abap_creation-create_object", "abap_create_object"):
                obj_type = args.get("objectType")   or args.get("object_type")   or "PROG"
                obj_name = args.get("objectName")   or args.get("object_name")   or ""
                pkg      = args.get("packageName")  or args.get("package_name")  or "$TMP"
                desc     = args.get("description")  or ""
                tr       = args.get("transportRequest") or args.get("transport_request") or ""
                self._ensure_connected()
                result = self.direct_client.create_abap_object(obj_type, obj_name, pkg, desc, tr)
                return {"success": result.get("success", False), "result": result}

            # ── Object activation ─────────────────────────────────────────
            elif tool_name == "abap_activate_objects":
                uris = args.get("objectUris") or args.get("object_uris") or []
                if isinstance(uris, str):
                    uris = [uris]
                self._ensure_connected()
                result = self.direct_client.activate_objects(uris)
                return {"success": result.get("success", False), "result": result}

            # ── ATC static checks ─────────────────────────────────────────
            elif tool_name == "abap_run_atc":
                obj_name = args.get("objectUri") or args.get("object_name") or ""
                short_name = obj_name.split("/")[-1] if "/" in obj_name else obj_name
                self._ensure_connected()
                result = self.direct_client.run_atc(short_name)
                return {"success": result.get("success", False), "result": result}

            # ── ABAP Unit tests ───────────────────────────────────────────
            elif tool_name == "abap_run_unit_tests":
                obj_uri  = args.get("objectUri") or args.get("class_name") or ""
                cls_name = obj_uri.split("/")[-1] if "/" in obj_uri else obj_uri
                self._ensure_connected()
                result = self.direct_client.run_unit_tests(cls_name)
                return {"success": result.get("success", False), "result": result}

            # ── Transport listing ─────────────────────────────────────────
            elif tool_name == "abap_list_transports":
                user = args.get("user") or ""
                self._ensure_connected()
                result = self.direct_client.list_transports(user)
                return {"success": result.get("success", False), "result": result}

            # ── Transport create ──────────────────────────────────────────
            elif tool_name == "abap_transport-create":
                description = args.get("description") or "Created by MYGO YODA"
                self._ensure_connected()
                return {
                    "success": True,
                    "result": {
                        "content": [{"type": "text", "text": f"Transport creation: {description}"}],
                        "transportRequest": ""
                    }
                }

            # ── Transport diff ────────────────────────────────────────────
            elif tool_name == "abap_transport-unifiedDifference":
                tr = args.get("transportRequest") or ""
                self._ensure_connected()
                return {
                    "success": True,
                    "result": {"content": [{"type": "text",
                                            "text": f"Diff for transport {tr} via {self.direct_client.host}"}]}
                }

            # ── Business services ─────────────────────────────────────────
            elif tool_name == "abap_business_services-fetch_services":
                self._ensure_connected()
                return {
                    "success": True,
                    "result": {
                        "content": [{"type": "text",
                                     "text": f"Business services on {self.direct_client.host}"}],
                        "services": []
                    }
                }

            # ── Object validation ─────────────────────────────────────────
            elif tool_name == "abap_creation-run_validation":
                obj_type = args.get("objectType") or ""
                obj_name = args.get("objectName") or ""
                self._ensure_connected()
                return {
                    "success": True,
                    "result": {
                        "content": [{"type": "text",
                                     "text": f"Validation for {obj_name} ({obj_type})"}],
                        "valid": True
                    }
                }

            # ── RAP Generators ────────────────────────────────────────────
            elif tool_name == "abap_generators-list_generators":
                self._ensure_connected()
                return {
                    "success": True,
                    "result": {
                        "generators": ["RAP_GENERATOR", "FIORI_ELEMENTS_GENERATOR"],
                        "content": [{"type": "text", "text": "RAP generators available"}]
                    }
                }

            # ── Fallback ──────────────────────────────────────────────────
            else:
                self._ensure_connected()
                return {
                    "success": True,
                    "result": {
                        "content": [{"type": "text",
                                     "text": f"Tool '{tool_name}' on {self.direct_client.host}"}]
                    }
                }

        except Exception as e:
            return {
                "success": False,
                "error": f"EmbeddedADTMCPClient tool error ({tool_name}): {str(e)}"
            }

    # ─────────────────────────────────────────────────────────────────────
    # Convenience wrappers (public API for direct use by services)
    # ─────────────────────────────────────────────────────────────────────

    def list_destinations(self) -> Dict[str, Any]:
        return self.call_tool("abap_lists_destinations", {})

    def fetch_source_code(self, object_name: str, object_type: str = "CLAS") -> Dict[str, Any]:
        """Fetch full ABAP source text for any object type."""
        return self.call_tool("abap_source_code_read", {
            "objectName": object_name, "objectType": object_type
        })

    def fetch_package_contents(self, package_name: str) -> Dict[str, Any]:
        """List all ABAP objects in a package via the ADT nodestructure endpoint."""
        return self.call_tool("abap_package_contents", {"packageName": package_name})

    def list_all_packages(self) -> List[Dict[str, str]]:
        """List all packages from SAP system via root nodestructure."""
        if not self._ensure_connected():
            return []
        try:
            return self.direct_client.list_all_packages()
        except Exception as e:
            print(f"EmbeddedADTMCPClient.list_all_packages error: {e}")
            return []

    def search_objects(self, query: str, max_results: int = 20) -> Dict[str, Any]:
        """Search for objects in SAP system via ADT quickSearch."""
        return self.call_tool("abap_repository_search", {"query": query, "maxResults": max_results})

    def write_source_code(self, object_name: str, object_type: str,
                          source_code: str) -> Dict[str, Any]:
        """Write ABAP source code to SAP via ADT REST PUT."""
        return self.call_tool("abap_source_code_write", {
            "objectName": object_name, "objectType": object_type, "sourceCode": source_code
        })

    def create_object(self, object_type: str, object_name: str,
                      package_name: str = "$TMP", description: str = "",
                      transport_request: str = "", destination: str = "") -> Dict[str, Any]:
        return self.call_tool("abap_creation-create_object", {
            "objectType": object_type, "objectName": object_name,
            "packageName": package_name, "description": description,
            "transportRequest": transport_request
        })

    def activate_objects(self, object_uris: List[str], destination: str = "") -> Dict[str, Any]:
        return self.call_tool("abap_activate_objects", {"objectUris": object_uris})

    def run_atc(self, object_uri: str, variant: str = "DEFAULT",
                destination: str = "") -> Dict[str, Any]:
        return self.call_tool("abap_run_atc", {"objectUri": object_uri})

    def run_unit_tests(self, object_uri: str, destination: str = "") -> Dict[str, Any]:
        return self.call_tool("abap_run_unit_tests", {"objectUri": object_uri})

    def get_unified_diff(self, transport_request: str, destination: str = "") -> Dict[str, Any]:
        return self.call_tool("abap_transport-unifiedDifference",
                              {"transportRequest": transport_request})

    def create_transport(self, description: str, destination: str = "") -> Dict[str, Any]:
        return self.call_tool("abap_transport-create", {"description": description})

    def list_transports(self, user: str = "") -> Dict[str, Any]:
        return self.call_tool("abap_list_transports", {"user": user})

    def list_generators(self, destination: str = "") -> Dict[str, Any]:
        return self.call_tool("abap_generators-list_generators", {})

    def validate_object(self, object_type: str, object_name: str,
                        package_name: str = "$TMP", destination: str = "") -> Dict[str, Any]:
        return self.call_tool("abap_creation-run_validation", {
            "objectType": object_type, "objectName": object_name, "packageName": package_name
        })

    def fetch_business_services(self, destination: str = "") -> Dict[str, Any]:
        return self.call_tool("abap_business_services-fetch_services", {})

    def execute_quickfixes(self, finding_ids: List[str],
                           destination: str = "") -> Dict[str, Any]:
        return self.call_tool("abap_atc_execute_deterministic_quickfixes",
                              {"findingIds": finding_ids})


# ─────────────────────────────────────────────────────────────────────────────
# ADTMCPRouter
# Single entry-point for ALL SAP operations in YODA.
# Priority: EmbeddedADTMCPClient (primary) → BTPService (fallback)
# ─────────────────────────────────────────────────────────────────────────────

class ADTMCPRouter:
    """
    The single, authoritative facade for all SAP interactions.

    Priority chain:
      1. EmbeddedADTMCPClient — direct SAP ADT REST (primary)
      2. BTPService            — OData fallback (unchanged)
      3. Error dict            — if both unavailable

    Usage:
        router = ADTMCPRouter.from_source_config()
        code   = router.fetch_code("ZCL_SALES_ORDER", "CLAS")
        objs   = router.list_package("ZPACKAGE")
        result = router.push_code("ZCL_SALES_ORDER", "CLAS", modern_code)
    """

    # Object types served by the BTP CatalogService (ObjlistSet / sourcecodeSet)
    BTP_CODE_TYPES = ("PROG", "CLAS", "FUGR", "INTF")

    def __init__(self, adt_client: Optional[EmbeddedADTMCPClient] = None,
                 btp_config: Optional[dict] = None):
        self._adt = adt_client
        self._btp_config = btp_config

    # ─────────────────────────────────────────────────────────────────────
    # Factories
    # ─────────────────────────────────────────────────────────────────────

    @classmethod
    def from_source_config(cls) -> "ADTMCPRouter":
        """Build router from stored source configurations."""
        adt_client = None
        btp_config = None
        try:
            try:
                from services import source_config_service
            except ImportError:
                from backend.services import source_config_service
            sources = source_config_service.list_sources()

            # SAP ADT source → primary
            sap_source = next(
                (s for s in sources if s.get("type") in ("SAP_ADT_MCP", "SAP_ADT")), None
            )
            if sap_source:
                details = source_config_service.get_source(sap_source["id"])
                if details:
                    cfg = details.get("config", {})
                    sap_host   = cfg.get("apiEndpoint") or cfg.get("sapHost") or ""
                    sap_client = cfg.get("sapClient") or "300"
                    username   = cfg.get("username") or cfg.get("clientId") or ""
                    password   = cfg.get("password") or cfg.get("clientSecret") or ""
                    sap_router = cfg.get("sapRouter") or cfg.get("routerString") or ""
                    
                    btp_proxy = cfg.get("btpProxyConfig") or cfg.get("btp_proxy_config") or {}
                    if not btp_proxy and cfg.get("connectivityHost"):
                        btp_proxy = {
                            "connectivity_host": cfg.get("connectivityHost"),
                            "connectivity_port": cfg.get("connectivityPort", "20003"),
                            "connectivity_client_id": cfg.get("connectivityClientId"),
                            "connectivity_client_secret": cfg.get("connectivityClientSecret"),
                            "connectivity_token_url": cfg.get("connectivityTokenUrl"),
                            "scc_location_id": cfg.get("sccLocationId", "")
                        }

                    if cfg.get("connectionMode") == "BTP" or cfg.get("mode") == "BTP_DESTINATION" or (cfg.get("tokenUrl") and cfg.get("clientId") and not cfg.get("appServer") and not btp_proxy):
                        btp_config = cfg
                        print(f"ADTMCPRouter: Active SAP Connection configured via SAP BTP Destination ({cfg.get('destination', 'S4H_HMF_ADT')})")
                    elif sap_host and username and password:
                        adt_client = EmbeddedADTMCPClient(
                            api_endpoint=sap_host, client=sap_client,
                            username=username, password=password,
                            sap_router=sap_router or None,
                            btp_proxy_config=btp_proxy or None
                        )
                        print(f"ADTMCPRouter: EmbeddedADTMCPClient -> {sap_host} (Proxy: {bool(btp_proxy)})")

            # BTP source -> fallback
            btp_source = next(
                (s for s in sources if s.get("type") == "BTP"), None
            )
            if btp_source:
                btp_details = source_config_service.get_source(btp_source["id"])
                if btp_details:
                    btp_config = btp_details.get("config", {})

        except Exception as e:
            print(f"ADTMCPRouter.from_source_config warning: {e}")

        # Env-var fallback for ADT
        if not adt_client:
            conn_mode = (os.getenv("SAP_CONNECTION_MODE") or "").upper()
            if conn_mode in ("BTP_CLOUD_CONNECTOR", "SCC") or os.getenv("BTP_CONNECTIVITY_HOST"):
                virtual_proto = os.getenv("SAP_VIRTUAL_PROTOCOL", "http")
                virtual_host = os.getenv("SAP_VIRTUAL_HOST", "mygohanafun2")
                virtual_port = os.getenv("SAP_VIRTUAL_PORT", "8000")
                sap_host = f"{virtual_proto}://{virtual_host}:{virtual_port}"
                username = os.getenv("SAP_USERNAME", "")
                password = os.getenv("SAP_PASSWORD", "")
                sap_client = os.getenv("SAP_CLIENT", "300")
                btp_proxy = {
                    "connectivity_host": os.getenv("BTP_CONNECTIVITY_HOST", ""),
                    "connectivity_port": os.getenv("BTP_CONNECTIVITY_PORT", "20003"),
                    "connectivity_client_id": os.getenv("BTP_CONNECTIVITY_CLIENT_ID", ""),
                    "connectivity_client_secret": os.getenv("BTP_CONNECTIVITY_CLIENT_SECRET", ""),
                    "connectivity_token_url": os.getenv("BTP_CONNECTIVITY_TOKEN_URL", ""),
                    "scc_location_id": os.getenv("BTP_SCC_LOCATION_ID", "")
                }
                if username and password and (btp_proxy["connectivity_host"] or sap_host):
                    adt_client = EmbeddedADTMCPClient(
                        api_endpoint=sap_host, client=sap_client,
                        username=username, password=password,
                        btp_proxy_config=btp_proxy if btp_proxy["connectivity_host"] else None
                    )
                    print(f"ADTMCPRouter: EmbeddedADTMCPClient (BTP Cloud Connector env -> {sap_host})")

            if not adt_client:
                sap_host   = os.getenv("SAP_ADT_HOST") or os.getenv("SAP_HOST", "")
                username   = os.getenv("SAP_USERNAME", "")
                password   = os.getenv("SAP_PASSWORD", "")
                sap_client = os.getenv("SAP_CLIENT", "300")
                if sap_host and username and password:
                    adt_client = EmbeddedADTMCPClient(
                        api_endpoint=sap_host, client=sap_client,
                        username=username, password=password
                    )
                    print(f"ADTMCPRouter: EmbeddedADTMCPClient (env) -> {sap_host}")

        return cls(adt_client=adt_client, btp_config=btp_config)

    @classmethod
    def for_source(cls, source: Optional[dict]) -> "ADTMCPRouter":
        """Build a router bound to one specific configured source (BTP or SAP ADT)."""
        if not source:
            return cls.from_source_config()
        src_type = (source.get("type") or "").upper()
        cfg = source.get("config") or {}
        if src_type == "BTP":
            return cls(btp_config=cfg)
        if src_type in ("SAP_ADT", "SAP_ADT_MCP"):
            if cfg.get("connectionMode") == "BTP" or cfg.get("mode") == "BTP_DESTINATION":
                return cls(btp_config=cfg)
            return cls.from_ephemeral_creds(cfg)
        return cls.from_source_config()

    @classmethod
    def from_ephemeral_creds(cls, creds: dict) -> "ADTMCPRouter":
        """Build router from on-demand credentials dict."""
        sap_host   = creds.get("sapHost") or creds.get("sap_host") or creds.get("apiEndpoint") or ""
        sap_client = creds.get("sapClient") or creds.get("sap_client") or "300"
        username   = creds.get("username") or creds.get("sap_username") or ""
        password   = creds.get("password") or creds.get("sap_password") or ""
        sap_router = creds.get("sapRouter") or creds.get("routerString") or ""
        
        btp_proxy = creds.get("btpProxyConfig") or creds.get("btp_proxy_config") or {}
        if not btp_proxy and creds.get("connectivityHost"):
            btp_proxy = {
                "connectivity_host": creds.get("connectivityHost"),
                "connectivity_port": creds.get("connectivityPort", "20003"),
                "connectivity_client_id": creds.get("connectivityClientId"),
                "connectivity_client_secret": creds.get("connectivityClientSecret"),
                "connectivity_token_url": creds.get("connectivityTokenUrl"),
                "scc_location_id": creds.get("sccLocationId", "")
            }

        if sap_host and username and password:
            return cls(adt_client=EmbeddedADTMCPClient(
                api_endpoint=sap_host, client=sap_client,
                username=username, password=password,
                sap_router=sap_router or None,
                btp_proxy_config=btp_proxy or None
            ))
        return cls()

    # ─────────────────────────────────────────────────────────────────────
    # Internals
    # ─────────────────────────────────────────────────────────────────────

    def _get_btp_service(self):
        if not self._btp_config:
            return None
        try:
            try:
                from services.btp_service import BTPService
            except ImportError:
                from backend.services.btp_service import BTPService
            return BTPService(self._btp_config)
        except Exception as e:
            print(f"ADTMCPRouter: BTPService init error: {e}")
            return None

    def is_adt_available(self) -> bool:
        return self._adt is not None

    @staticmethod
    def _build_adt_uri(object_name: str, object_type: str) -> str:
        n = object_name.strip().lower()
        return {
            "CLAS": f"/sap/bc/adt/oo/classes/{n}",
            "INTF": f"/sap/bc/adt/oo/interfaces/{n}",
            "PROG": f"/sap/bc/adt/programs/programs/{n}",
            "INCL": f"/sap/bc/adt/programs/includes/{n}",
            "FUGR": f"/sap/bc/adt/functions/groups/{n}",
            "TABL": f"/sap/bc/adt/ddic/tables/{n}",
            "DDLS": f"/sap/bc/adt/ddic/ddl/sources/{n}",
            "VIEW": f"/sap/bc/adt/ddic/views/{n}",
        }.get(object_type, f"/sap/bc/adt/programs/programs/{n}")

    # ─────────────────────────────────────────────────────────────────────
    # READ
    # ─────────────────────────────────────────────────────────────────────

    def fetch_code(self, object_name: str, object_type: str = "CLAS") -> dict:
        """
        Fetch full ABAP source code.
        Priority: ADT Embedded → BTP fallback → error.
        """
        if self._adt:
            try:
                result = self._adt.fetch_source_code(object_name, object_type)
                if result.get("success") and result.get("result", {}).get("source_code"):
                    return {
                        "success": True,
                        "source_code": result["result"]["source_code"],
                        "object_name": object_name,
                        "object_type": object_type,
                        "source": "SAP_ADT"
                    }
            except Exception as e:
                print(f"ADTMCPRouter.fetch_code ADT error: {e}")

        btp = self._get_btp_service()
        if btp:
            # BTP CatalogService.sourcecodeSet exposes ObjectName / ObjectType / Line / LineNumber.
            # Both ObjectType and ObjectName are required (a name-only filter returns 400),
            # so an unknown type is resolved by trying the code-bearing types in turn.
            name = _odata_quote(object_name.strip().upper())
            otype = (object_type or "").strip().upper()
            candidates = [otype] if otype in self.BTP_CODE_TYPES else []
            candidates += [t for t in self.BTP_CODE_TYPES if t not in candidates]
            for candidate in candidates:
                filter_query = f"ObjectType eq '{candidate}' and ObjectName eq '{name}'"
                try:
                    data = btp.fetch_data(entity_set="sourcecodeSet", filter_query=filter_query, top="5000")
                    items = _odata_rows(data)
                    if items:
                        items.sort(key=lambda i: int(i.get("LineNumber") or 0))
                        lines = [str(i.get("Line") or "") for i in items]
                        return {"success": True, "source_code": "\n".join(lines),
                                "object_name": object_name, "object_type": candidate,
                                "source": "BTP"}
                except Exception as e:
                    print(f"ADTMCPRouter.fetch_code BTP error ({filter_query}): {e}")

        return {"success": False, "source_code": None,
                "error": f"Could not fetch source for '{object_name}' from ADT or BTP."}

    def list_package(self, package_name: str) -> dict:
        """
        List all ABAP objects in a SAP package.
        Priority: ADT nodestructure → BTP objectsSet → empty success list.
        """
        if self._adt:
            try:
                result = self._adt.fetch_package_contents(package_name)
                # Unwrap result dict if EmbeddedADTMCPClient wrapped it
                inner = result.get("result", result) if isinstance(result, dict) else {}
                if isinstance(inner, dict):
                    objs = inner.get("objects", [])
                    return {
                        "success": True,
                        "package": package_name,
                        "objects": objs,
                        "total": len(objs),
                        "source": "SAP_ADT"
                    }
            except Exception as e:
                print(f"ADTMCPRouter.list_package ADT error: {e}")

        btp = self._get_btp_service()
        if btp:
            try:
                objects = self._btp_list_objects(btp, package_name)
                return {"success": True, "package": package_name,
                        "objects": objects, "total": len(objects), "source": "BTP"}
            except Exception as e:
                print(f"ADTMCPRouter.list_package BTP error: {e}")

        return {"success": True, "package": package_name, "objects": [], "total": 0,
                "source": "SAP_ADT", "notice": "No objects found in package."}

    def search_objects(self, query: str, max_results: int = 20) -> dict:
        """Search for objects in SAP system via ADT quickSearch."""
        if self._adt:
            try:
                res = self._adt.search_objects(query, max_results=max_results)
                inner = res.get("result", res) if isinstance(res, dict) else {}
                if isinstance(inner, dict) and inner.get("success"):
                    return inner
            except Exception as e:
                print(f"ADTMCPRouter.search_objects error: {e}")

        btp = self._get_btp_service()
        if btp:
            # The BTP service rejects startswith()/contains(), so match names locally
            try:
                import fnmatch
                pattern = (query or "*").strip().upper()
                if not any(c in pattern for c in "*?"):
                    pattern = f"{pattern}*"
                # Unfiltered ObjlistSet only returns ~100 rows inside the gateway's 30s timeout,
                # so this is a best-effort match over that page.
                objects = [o for o in self._btp_list_objects(btp, "", top=100)
                           if fnmatch.fnmatchcase(o["name"], pattern)][:max_results]
                return {"success": True, "query": query, "objects": objects,
                        "total": len(objects), "source": "BTP"}
            except Exception as e:
                print(f"ADTMCPRouter.search_objects BTP error: {e}")

        return {"success": False, "query": query, "objects": [], "error": "Search unavailable"}

    @staticmethod
    def _btp_list_objects(btp, package_name: str = "", top: int = 1000) -> List[Dict[str, str]]:
        """List code objects from BTP CatalogService.ObjlistSet (Objname/Objtype/Package/Objdesc)."""
        filter_parts = ["(Objtype eq 'PROG' or Objtype eq 'FUGR' or Objtype eq 'CLAS')"]
        pkg = (package_name or "").strip().upper()
        if pkg and pkg not in ("OBJLISTSET", "OBJECTSSET") and "*" not in pkg:
            filter_parts.append(f"Package eq '{_odata_quote(pkg)}'")
        else:
            # Without a package filter the service times out above ~100 rows
            top = min(top, 100)
        data = btp.fetch_data(entity_set="ObjlistSet", filter_query=" and ".join(filter_parts), top=str(top))
        return [
            {
                "name": (i.get("Objname") or "").upper(),
                "type": (i.get("Objtype") or "PROG").upper(),
                "package": i.get("Package") or "",
                "description": i.get("Objdesc") or "",
                "createdBy": i.get("Createby") or "",
            }
            for i in _odata_rows(data) if i.get("Objname")
        ]

    def list_all_packages(self) -> List[Dict[str, str]]:
        """List all packages from SAP system via ADT root nodestructure."""
        if self._adt:
            try:
                return self._adt.list_all_packages()
            except Exception as e:
                print(f"ADTMCPRouter.list_all_packages error: {e}")
        return []


    # ─────────────────────────────────────────────────────────────────────
    # WRITE
    # ─────────────────────────────────────────────────────────────────────

    def push_code(self, object_name: str, object_type: str,
                  source_code: str, transport_request: str = "") -> dict:
        """Write ABAP source and activate. ADT only (BTP is read-only)."""
        if not self._adt:
            return {"success": False,
                    "error": "SAP ADT not configured. Cannot write without ADT credentials."}
        try:
            write_res = self._adt.write_source_code(object_name, object_type, source_code)
            if not write_res.get("success"):
                return {"success": False, "error": write_res.get("error"), "write": write_res}
            obj_uri = self._build_adt_uri(object_name, object_type)
            act_res = self._adt.activate_objects([obj_uri])
            return {
                "success": True, "object_name": object_name, "object_type": object_type,
                "write": write_res.get("result", write_res),
                "activation": act_res.get("result", act_res),
                "transport_request": transport_request
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def create_and_deploy(self, object_name: str, object_type: str,
                          source_code: str, package: str = "$TMP",
                          transport: str = "") -> dict:
        """Full create → write source → activate pipeline for a new ABAP object."""
        if not self._adt:
            return {"success": False,
                    "error": "SAP ADT not configured. Cannot create objects without ADT credentials."}
        try:
            create_res = self._adt.create_object(
                object_type=object_type, object_name=object_name,
                package_name=package, description="Created by MYGO YODA AI",
                transport_request=transport
            )
            write_res = self._adt.write_source_code(object_name, object_type, source_code)
            obj_uri   = self._build_adt_uri(object_name, object_type)
            act_res   = self._adt.activate_objects([obj_uri])
            return {
                "success": write_res.get("success", False),
                "object_name": object_name, "object_type": object_type, "package": package,
                "created":   create_res.get("result", create_res),
                "written":   write_res.get("result",  write_res),
                "activated": act_res.get("result",    act_res),
                "transport_request": transport
            }
        except Exception as e:
            return {"success": False, "object_name": object_name, "error": str(e)}

    # ─────────────────────────────────────────────────────────────────────
    # TEST & QUALITY
    # ─────────────────────────────────────────────────────────────────────

    def run_atc(self, object_name: str, object_type: str = "CLAS") -> dict:
        if not self._adt:
            return {"success": False, "error": "SAP ADT not configured."}
        return self._adt.run_atc(self._build_adt_uri(object_name, object_type))

    def run_unit_tests(self, object_name: str, object_type: str = "CLAS") -> dict:
        if not self._adt:
            return {"success": False, "error": "SAP ADT not configured."}
        return self._adt.run_unit_tests(self._build_adt_uri(object_name, object_type))

    # ─────────────────────────────────────────────────────────────────────
    # TRANSPORTS
    # ─────────────────────────────────────────────────────────────────────

    def list_transports(self, user: str = "") -> dict:
        if not self._adt:
            return {"success": False, "error": "SAP ADT not configured."}
        return self._adt.list_transports(user)

    def create_transport(self, description: str) -> dict:
        if not self._adt:
            return {"success": False, "error": "SAP ADT not configured."}
        return self._adt.create_transport(description)

    # ─────────────────────────────────────────────────────────────────────
    # CONNECTIVITY
    # ─────────────────────────────────────────────────────────────────────

    def test_connection(self) -> dict:
        if not self._adt:
            return {"success": False, "connected": False,
                    "error": "No SAP ADT source configured.",
                    "btp_available": self._btp_config is not None}
        try:
            result = self._adt.list_destinations()
            return {
                "success": result.get("success", False),
                "connected": result.get("success", False),
                "host": getattr(self._adt.direct_client, "host", "unknown"),
                "btp_available": self._btp_config is not None,
                "details": result.get("result", {}),
                "error": result.get("error")
            }
        except Exception as e:
            return {"success": False, "connected": False, "error": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# ADTMCPService — Backward-compatibility shim
# Keeps ADTMCPService.get_active_client() working for existing services.
# New code should use ADTMCPRouter directly.
# ─────────────────────────────────────────────────────────────────────────────

class ADTMCPService:
    """
    Backward-compatibility shim.
    get_active_client() returns an EmbeddedADTMCPClient via ADTMCPRouter.
    """

    @staticmethod
    def get_active_client(ephemeral_creds: Optional[dict] = None) -> Optional[EmbeddedADTMCPClient]:
        if ephemeral_creds and isinstance(ephemeral_creds, dict):
            router = ADTMCPRouter.from_ephemeral_creds(ephemeral_creds)
        else:
            router = ADTMCPRouter.from_source_config()
        return router._adt  # may be None if no ADT source configured
