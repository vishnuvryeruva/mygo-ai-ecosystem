"""
SAP ADT (ABAP Development Tools) direct connector.
Handles HTTP authentication, CSRF tokens, and source code retrieval directly from AS ABAP servers.

SAProuter Support:
    When a SAProuter string is provided (e.g. '/H/50.198.15.124/H/'),
    the HTTP connection is established TO the SAProuter's public IP,
    while the Host header points to the private SAP Application Server.
    This allows EC2 to reach internal SAP systems behind corporate firewalls.
"""

import os
import re
import socket
import urllib.parse
import requests
from typing import Dict, Any, Optional

# Disable self-signed SSL warnings in requests safely
try:
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
except ImportError:
    try:
        from requests.packages import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    except ImportError:
        pass


def _extract_saprouter_public_ip(router_string: str) -> Optional[str]:
    """
    Extract the first public-facing router IP from a SAProuter string.
    
    Example input:  '/H/50.198.15.124/H/' or '/H/50.198.15.124/S/3299/H/'
    Example output: '50.198.15.124'
    """
    if not router_string:
        return None
    # Match all /H/<ip-or-host>/ segments and return the first one
    matches = re.findall(r'/H/([^/]+)', router_string)
    return matches[0].strip() if matches else None


def _is_private_ip(host: str) -> bool:
    """Return True if host is a RFC-1918 private IP address."""
    try:
        ip = socket.gethostbyname(host)
        parts = list(map(int, ip.split('.')))
        return (
            parts[0] == 10 or
            (parts[0] == 172 and 16 <= parts[1] <= 31) or
            (parts[0] == 192 and parts[1] == 168) or
            parts[0] == 127
        )
    except Exception:
        return False


class DirectADTClient:
    def __init__(self, api_endpoint: str, client: str = "300", username: str = "", password: str = "",
                 sap_router: Optional[str] = None, btp_proxy_config: Optional[Dict[str, Any]] = None):
        """
        Initialize the ADT Client.
        
        Args:
            api_endpoint: Full URL (e.g. 'https://192.168.171.43:44300', 'http://mygohanafun2:8000') or hostname
            client: SAP Client ID (e.g. '300')
            username: SAP developer username
            password: SAP developer password
            sap_router: Optional SAProuter string (e.g. '/H/50.198.15.124/H/')
            btp_proxy_config: Optional BTP Cloud Connector / Connectivity Proxy credentials dict
        """
        self.client = client.strip() or '300'
        self.username = username.strip()
        self.password = password
        self.sap_router = sap_router.strip() if sap_router else None
        self.btp_proxy_config = btp_proxy_config or {}
        self.connectivity_token = None
        
        # Parse host, port, use_ssl from api_endpoint
        url = api_endpoint.strip()
        if not url.startswith(('http://', 'https://')):
            url = 'https://' + url
            
        parsed = urllib.parse.urlparse(url)
        self.host = parsed.hostname or ''
        
        # Determine port and scheme
        self.use_ssl = (parsed.scheme == 'https')
        self.port = parsed.port
        if not self.port:
            self.port = 443 if self.use_ssl else 80

        router_public_ip = _extract_saprouter_public_ip(self.sap_router or '')
        target_host_is_private = _is_private_ip(self.host)

        # Always use the user-configured host for HTTP/HTTPS ADT communication.
        self.effective_host = self.host
        self.routing_note = f"Direct -> {self.host}:{self.port}"

        protocol = "https" if self.use_ssl else "http"
        # base_url uses the user-configured host
        self.base_url = f"{protocol}://{self.effective_host}:{self.port}/sap/bc/adt"
        self.original_target = f"{protocol}://{self.host}:{self.port}/sap/bc/adt"

        self.session = requests.Session()
        self.session.auth = (self.username, self.password)
        # Disable SSL certificate verification (dev SAP systems often use self-signed certs)
        self.session.verify = False
        if self.client:
            self.session.cookies.set("sap-usercontext", f"sap-client={self.client}")
        if router_public_ip and target_host_is_private:
            self.session.headers.update({"Host": f"{self.host}:{self.port}"})
        
        # Setup BTP Cloud Connector / Connectivity Proxy if configured
        proxy_host = (self.btp_proxy_config.get("connectivity_host") or os.getenv("BTP_CONNECTIVITY_HOST", "")).strip()
        proxy_port = (self.btp_proxy_config.get("connectivity_port") or os.getenv("BTP_CONNECTIVITY_PORT", "20003")).strip()
        scc_loc_id = (self.btp_proxy_config.get("scc_location_id") or os.getenv("BTP_SCC_LOCATION_ID", "")).strip()
        
        if proxy_host:
            self.is_btp_proxy = True
            token = self._refresh_connectivity_token()
            proxy_url = f"http://{proxy_host}:{proxy_port}"
            self.session.proxies = {
                "http": proxy_url,
                "https": proxy_url
            }
            if token:
                self.session.headers["Proxy-Authorization"] = f"Bearer {token}"
            if scc_loc_id:
                self.session.headers["SAP-Connectivity-SCC-Location_ID"] = scc_loc_id
            self.routing_note = f"BTP Cloud Connector Tunnel -> {proxy_url} -> {self.host}:{self.port}"
        else:
            self.is_btp_proxy = False
            
        self.csrf_token = None
        print(f"DEBUG ADTClient: Initialized. client={self.client}, user={self.username}, routing={self.routing_note}, base_url={self.base_url}")

    def _refresh_connectivity_token(self) -> Optional[str]:
        """Fetch or refresh OAuth token from BTP Connectivity Service XSUAA."""
        token_url = (self.btp_proxy_config.get("connectivity_token_url") or os.getenv("BTP_CONNECTIVITY_TOKEN_URL", "")).strip()
        client_id = (self.btp_proxy_config.get("connectivity_client_id") or os.getenv("BTP_CONNECTIVITY_CLIENT_ID", "")).strip()
        client_secret = (self.btp_proxy_config.get("connectivity_client_secret") or os.getenv("BTP_CONNECTIVITY_CLIENT_SECRET", "")).strip()

        if not (token_url and client_id and client_secret):
            return None

        # Ensure token_url has /oauth/token if raw instance URL was provided
        if not token_url.endswith("/oauth/token"):
            token_url = token_url.rstrip("/") + "/oauth/token"

        try:
            print(f"DEBUG ADTClient: Fetching BTP Connectivity OAuth token from {token_url}...")
            resp = requests.post(
                token_url,
                auth=(client_id, client_secret),
                data={"grant_type": "client_credentials"},
                timeout=15
            )
            resp.raise_for_status()
            self.connectivity_token = resp.json().get("access_token")
            if self.connectivity_token and hasattr(self, "session"):
                self.session.headers["Proxy-Authorization"] = f"Bearer {self.connectivity_token}"
            return self.connectivity_token
        except Exception as e:
            print(f"ERROR ADTClient: Failed to fetch BTP Connectivity token: {e}")
            return None


    def connect(self) -> bool:
        """
        Connect to SAP ADT and fetch a CSRF token.
        
        Returns:
            True if connection was successful and authenticated.
        """
        if not self.host or not self.username or not self.password:
            raise ValueError("Incomplete SAP ADT Configuration: API Endpoint, Username, and Password are required.")
            
        headers = {
            "sap-client": self.client,
            "X-sap-client": self.client,
            "X-Client": self.client,
            "X-CSRF-Token": "Fetch",
            "Accept": "application/vnd.sap.adt.discovery.v1+xml, application/xml, text/xml, */*"
        }
        
        try:
            url = f"{self.base_url}/discovery"
            params = {"sap-client": self.client} if self.client else {}
            print(f"DEBUG ADTClient: Connecting to {url} (routing: {self.routing_note})")
            # Timeout increased to 45s — SAProuter and VPN links can be slow to establish
            response = self.session.get(url, params=params, headers=headers, timeout=45)
            
            print(f"DEBUG ADTClient: Response status={response.status_code}")
            
            if response.status_code == 200:
                self.csrf_token = response.headers.get("X-CSRF-Token")
                print(f"DEBUG ADTClient: Successfully authenticated. CSRF Token: {self.csrf_token}")
                return True
            elif response.status_code == 401:
                print(f"DEBUG ADTClient: Server reachable but credentials rejected (HTTP 401). Check username/password/client.")
                raise Exception(f"SAP credentials rejected (HTTP 401 Unauthorized) for user '{self.username}' on client {self.client}. Please check username, password, or client ID.")
            else:
                print(f"DEBUG ADTClient: Unexpected response (status {response.status_code}). Body: {response.text[:300]}")
                raise Exception(f"SAP server returned HTTP {response.status_code}: {response.text[:200]}")
        except requests.exceptions.ConnectTimeout:
            raise Exception(
                f"Connection timed out reaching {self.effective_host}:{self.port}. "
                f"Ensure the SAP server host and port are reachable over your VPN."
            )
        except requests.exceptions.ReadTimeout:
            raise Exception(
                f"Read timed out from {self.effective_host}:{self.port} after 45s. "
                f"The SAP server connected but did not respond — check VPN/SAProuter connectivity."
            )
        except requests.exceptions.SSLError as e:
            raise Exception(f"SSL certificate error connecting to SAP: {str(e)}. Try using HTTP instead of HTTPS.")
        except requests.exceptions.ConnectionError as e:
            raise Exception(
                f"Cannot reach SAP at {self.effective_host}:{self.port}. "
                f"Routing: {self.routing_note}. Error: {str(e)}"
            )
        except Exception as e:
            print(f"ERROR ADTClient: Connection failed: {e}")
            raise Exception(f"Failed to connect to SAP: {str(e)}")

    def fetch_abap_class_code(self, class_name: str) -> Optional[str]:
        """
        Fetch class source code from ADT.
        
        Args:
            class_name: Name of the ABAP class (e.g. 'ZCL_MY_CLASS')
        """
        # ADT oo classes endpoint requires lowercase and specific structure
        name_clean = class_name.strip().upper()
        url = f"{self.base_url}/oo/classes/{urllib.parse.quote(name_clean.lower())}/source/main"
        
        headers = {
            "sap-client": self.client,
            "X-sap-client": self.client,
            "X-Client": self.client,
            "Accept": "*/*"
        }
        params = {"sap-client": self.client} if self.client else {}
        
        try:
            print(f"DEBUG ADTClient: Fetching class source from {url}")
            response = self.session.get(url, params=params, headers=headers, timeout=15)
            if response.status_code == 200:
                return response.text
            else:
                print(f"DEBUG ADTClient: Fetch class code failed. status={response.status_code}, response={response.text[:200]}")
                return None
        except Exception as e:
            print(f"ERROR ADTClient: Failed to fetch class code: {e}")
            return None

    def fetch_abap_program_code(self, program_name: str) -> Optional[str]:
        """
        Fetch program/report source code from ADT.
        
        Args:
            program_name: Name of the ABAP program or include
        """
        name_clean = program_name.strip().upper()
        url = f"{self.base_url}/programs/programs/{urllib.parse.quote(name_clean.lower())}/source"
        
        headers = {
            "sap-client": self.client,
            "X-sap-client": self.client,
            "X-Client": self.client,
            "Accept": "*/*"
        }
        params = {"sap-client": self.client} if self.client else {}
        
        try:
            print(f"DEBUG ADTClient: Fetching program source from {url}")
            response = self.session.get(url, params=params, headers=headers, timeout=15)
            if response.status_code == 200:
                return response.text
            else:
                print(f"DEBUG ADTClient: Fetch program code failed. status={response.status_code}, response={response.text[:200]}")
                return None
        except Exception as e:
            print(f"ERROR ADTClient: Failed to fetch program code: {e}")
            return None

    def run_unit_tests(self, class_name: str) -> Dict[str, Any]:
        """
        Trigger ABAP Unit tests for a class and parse results.
        
        Args:
            class_name: Name of the ABAP class containing unit tests
        """
        # Ensure we have a valid CSRF token
        if not self.csrf_token:
            self.connect()
            
        url = f"{self.base_url}/abapunit/testruns"
        name_clean = class_name.strip().upper()
        
        payload = f"""<?xml version="1.0" encoding="UTF-8"?>
<aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">
    <aunit:options/>
    <aunit:portfolioref URI="/sap/bc/adt/oo/classes/{name_clean.lower()}"/>
</aunit:runConfiguration>"""

        headers = {
            "Content-Type": "application/vnd.sap.adt.abapunit.testruns.config.v2+xml",
            "X-CSRF-Token": self.csrf_token or "",
            "sap-client": self.client,
            "X-sap-client": self.client,
            "X-Client": self.client,
            "Accept": "application/vnd.sap.adt.abapunit.testruns.result.v2+xml"
        }
        params = {"sap-client": self.client} if self.client else {}
        
        try:
            print(f"DEBUG ADTClient: Running unit tests via {url}")
            response = self.session.post(url, data=payload, headers=headers, timeout=20)
            if response.status_code == 200:
                # Returns XML results
                return {
                    "success": True,
                    "xml_results": response.text
                }
            else:
                print(f"DEBUG ADTClient: Run unit tests failed. status={response.status_code}, response={response.text[:200]}")
                return {
                    "success": False,
                    "error": f"SAP server returned status code {response.status_code}"
                }
        except Exception as e:
            print(f"ERROR ADTClient: Failed to run unit tests: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def run_atc(self, object_name: str) -> Dict[str, Any]:
        """
        Run ABAP Test Cockpit (ATC) static analysis for an object.
        
        Args:
            object_name: Name of the ABAP class or program
        """
        if not self.csrf_token:
            self.connect()
            
        url = f"{self.base_url}/atc/runs"
        name_clean = object_name.strip().upper()
        is_class = name_clean.startswith(('ZCL_', 'CL_', 'IF_', 'ZIF_'))
        obj_uri = f"/sap/bc/adt/oo/classes/{name_clean.lower()}" if is_class else f"/sap/bc/adt/programs/programs/{name_clean.lower()}"
        
        payload = f"""<?xml version="1.0" encoding="UTF-8"?>
<atc:runConfiguration xmlns:atc="http://www.sap.com/adt/atc">
    <atc:objectSet>
        <atc:object uri="{obj_uri}"/>
    </atc:objectSet>
</atc:runConfiguration>"""

        headers = {
            "Content-Type": "application/vnd.sap.adt.atc.run.config.v1+xml",
            "X-CSRF-Token": self.csrf_token or "",
            "sap-client": self.client,
            "X-sap-client": self.client,
            "X-Client": self.client,
            "Accept": "application/vnd.sap.adt.atc.worklist.v1+xml"
        }
        params = {"sap-client": self.client} if self.client else {}
        
        try:
            print(f"DEBUG ADTClient: Running ATC via {url}")
            response = self.session.post(url, data=payload, headers=headers, timeout=25)
            if response.status_code in (200, 201):
                return {
                    "success": True,
                    "xml_results": response.text,
                    "object_name": name_clean
                }
            else:
                print(f"DEBUG ADTClient: Run ATC returned status {response.status_code}: {response.text[:200]}")
                return {
                    "success": False,
                    "error": f"SAP returned status code {response.status_code}",
                    "details": response.text[:300]
                }
        except Exception as e:
            print(f"ERROR ADTClient: Failed to run ATC: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    # ──────────────────────────────────────────────────────────────────────────
    # Helper: resolve ADT REST path for a given object type
    # ──────────────────────────────────────────────────────────────────────────

    CODE_BEARING_TYPES = {
        "CLAS", "INTF", "PROG", "INCL", "FUGR", "TABL", "VIEW",
        "DTEL", "DOMA", "DDLS", "MSAG", "SRVD", "BDEF"
    }

    NON_CODE_TYPES = {
        "DEVC", "LRCC", "WDCC", "IWMO", "IWSG", "SRVB", "OA2S",
        "HTTP", "SICF", "WAPA", "TRAN", "SUSO", "SUSH", "TOBJ"
    }

    def _object_type_to_source_path(self, object_name: str, object_type: str) -> str:
        """
        Return the ADT REST source path for the given object type.
        object_type uses SAP short codes: CLAS, INTF, PROG, INCL, FUGR, TABL,
        VIEW, DTEL, DOMA, MSAG, DDLS (CDS), SRVD, BDEF.
        """
        t = (object_type or "").strip().upper()
        n = object_name.strip().lower()

        # Immediately return empty for known non-code metadata types
        if t in self.NON_CODE_TYPES:
            return ""

        type_map = {
            "CLAS": f"/oo/classes/{n}/source/main",
            "INTF": f"/oo/interfaces/{n}/source/main",
            "PROG": f"/programs/programs/{n}/source",
            "INCL": f"/programs/includes/{n}/source/main",
            "FUGR": f"/functions/groups/{n}/includes/main/source",
            "TABL": f"/ddic/tables/{n}/source/main",
            "VIEW": f"/ddic/views/{n}/source/main",
            "DTEL": f"/ddic/dataelements/{n}/source/main",
            "DOMA": f"/ddic/domains/{n}/source/main",
            "DDLS": f"/ddic/ddl/sources/{n}/source/main",   # CDS view
            "MSAG": f"/messageclass/{n}/source/main",
        }
        if t in type_map:
            return type_map[t]

        # Auto-detect common prefixes
        name_upper = object_name.strip().upper()
        if name_upper.startswith(("ZCL_", "CL_")):
            return f"/oo/classes/{n}/source/main"
        elif name_upper.startswith(("ZIF_", "IF_")):
            return f"/oo/interfaces/{n}/source/main"
        elif t in self.CODE_BEARING_TYPES:
            return f"/programs/programs/{n}/source"

        # Not a known code-bearing type
        return ""

    # --------------------------------------------------------------------------
    # Package / Repository Browsing
    # --------------------------------------------------------------------------

    def fetch_package_contents(self, package_name: str, max_depth: int = 2) -> Dict[str, Any]:
        """
        Fetch all objects inside an ABAP package using the ADT nodestructure API.
        """
        if not self.csrf_token:
            self.connect()

        url = f"{self.base_url}/repository/nodestructure"
        pkg_clean = package_name.strip().upper()
        pkg_variants = [pkg_clean]
        if pkg_clean.startswith("$"):
            pkg_variants.append(pkg_clean[1:])
        elif pkg_clean == "TMP":
            pkg_variants.append("$TMP")

        objects = []
        last_error = ""

        headers = {
            "sap-client": self.client,
            "X-sap-client": self.client,
            "Accept": "application/xml, text/xml, */*",
            "Content-Type": "application/vnd.sap.adt.repository.nodestructure.v1+xml"
        }
        if self.csrf_token:
            headers["X-CSRF-Token"] = self.csrf_token

        xml_body = """<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA></DATA></asx:values></asx:abap>"""

        import xml.etree.ElementTree as ET

        for variant in pkg_variants:
            query_url = f"{url}?parent_name={variant}&parent_type=DEVC/K&parent_tech_name={variant}&sap-client={self.client}"
            try:
                print(f"DEBUG ADTClient: Fetching package contents for variant {variant} via {query_url}")
                response = self.session.post(query_url, data=xml_body, headers=headers, timeout=30)

                if response.status_code == 200 and len(response.text) > 0:
                    try:
                        root = ET.fromstring(response.text)
                        # 1. Primary S/4HANA format: <SEU_ADT_REPOSITORY_OBJ_NODE>
                        for node in root.findall(".//SEU_ADT_REPOSITORY_OBJ_NODE"):
                            obj_name = (node.findtext("OBJECT_NAME") or node.findtext("TECH_NAME") or '').strip().upper()
                            raw_type = (node.findtext("OBJECT_TYPE") or '').strip().upper()
                            if not obj_name or obj_name == variant:
                                continue

                            # Normalize short type code
                            if raw_type == 'PROG/I':
                                type_code = 'INCL'
                            elif '/' in raw_type:
                                type_code = raw_type.split('/')[0]
                            else:
                                type_code = raw_type

                            obj_desc = (node.findtext("DESCRIPTION") or '').strip()
                            obj_uri = (node.findtext("OBJECT_URI") or '').strip()
                            objects.append({
                                "name": obj_name,
                                "type": type_code,
                                "raw_type": raw_type,
                                "description": obj_desc,
                                "package": variant,
                                "uri": obj_uri
                            })

                        # 2. Alternative ADT core format: <objectReference> or <node>
                        if not objects:
                            for elem in root.iter():
                                tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                                if tag in ('objectReference', 'adtcore:objectReference', 'node'):
                                    obj_name = (
                                        elem.get('name') or
                                        elem.get('{http://www.sap.com/adt/core}name') or ''
                                    ).strip().upper()
                                    raw_type = (
                                        elem.get('type') or
                                        elem.get('{http://www.sap.com/adt/core}type') or ''
                                    ).strip().upper()
                                    obj_desc = (
                                        elem.get('description') or
                                        elem.get('{http://www.sap.com/adt/core}description') or ''
                                    ).strip()
                                    type_code = raw_type.split('/')[0] if '/' in raw_type else raw_type
                                    if obj_name and obj_name != variant:
                                        objects.append({
                                            "name": obj_name,
                                            "type": type_code,
                                            "raw_type": raw_type,
                                            "description": obj_desc,
                                            "package": variant
                                        })

                        if objects:
                            print(f"DEBUG ADTClient: Found {len(objects)} objects for variant {variant}")
                            return {
                                "success": True,
                                "package": pkg_clean,
                                "objects": objects,
                                "total": len(objects)
                            }
                    except ET.ParseError as pe:
                        print(f"DEBUG ADTClient: XML parse warning: {pe}")
                else:
                    last_error = f"SAP returned status {response.status_code}"
            except Exception as e:
                last_error = str(e)

        # 3. Fallback: If 0 objects found via nodestructure, search SAP repository for matching pattern
        if not objects and pkg_clean:
            print(f"DEBUG ADTClient: Nodestructure returned 0 objects, falling back to search for '{pkg_clean}*'")
            search_res = self.search_objects(f"{pkg_clean}*", max_results=100)
            if search_res.get("success") and search_res.get("objects"):
                return {
                    "success": True,
                    "package": pkg_clean,
                    "objects": search_res.get("objects", []),
                    "total": len(search_res.get("objects", [])),
                    "searchFallback": True
                }

        return {
            "success": True,
            "package": pkg_clean,
            "objects": objects,
            "total": len(objects),
            "notice": last_error if not objects else None
        }

    def list_all_packages(self) -> List[Dict[str, str]]:
        """
        List all development packages from the SAP system via root nodestructure.
        Returns a list of dicts with 'name' and 'type', prioritizing custom (Z*/Y*) packages.
        """
        if not self.csrf_token:
            self.connect()

        url = f"{self.base_url}/repository/nodestructure"
        headers = {
            "sap-client": self.client,
            "X-sap-client": self.client,
            "Accept": "application/xml, text/xml, */*",
            "Content-Type": "application/vnd.sap.adt.repository.nodestructure.v1+xml"
        }
        if self.csrf_token:
            headers["X-CSRF-Token"] = self.csrf_token

        xml_body = """<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA></DATA></asx:values></asx:abap>"""
        packages = []
        try:
            res = self.session.post(url, data=xml_body, headers=headers, timeout=25)
            if res.status_code == 200:
                import xml.etree.ElementTree as ET
                root = ET.fromstring(res.text)
                seen = set()
                custom_pkgs = []
                standard_pkgs = []
                for node in root.findall(".//SEU_ADT_REPOSITORY_OBJ_NODE"):
                    name = (node.findtext("OBJECT_NAME") or "").strip().upper()
                    desc = (node.findtext("DESCRIPTION") or "").strip()
                    if name and name not in seen:
                        seen.add(name)
                        item = {"name": name, "description": desc}
                        if name.startswith(("Z", "Y")):
                            custom_pkgs.append(item)
                        else:
                            standard_pkgs.append(item)
                packages = sorted(custom_pkgs, key=lambda x: x["name"]) + sorted(standard_pkgs, key=lambda x: x["name"])
        except Exception as e:
            print(f"DEBUG ADTClient: list_all_packages error: {e}")

        return packages

    # ──────────────────────────────────────────────────────────────────────────
    # Repository Information System / Search
    # ──────────────────────────────────────────────────────────────────────────

    def search_objects(self, query: str, max_results: int = 20) -> Dict[str, Any]:
        """
        Search for ABAP development objects across the SAP system using ADT quickSearch.
        Supports wildcards (e.g. 'Z*', 'CL_*', 'ORDER*', '*VBAK*').

        Args:
            query: Search pattern or keyword
            max_results: Maximum objects to return (default 20)

        Returns:
            {"success": True, "query": query, "objects": [...], "total": int}
        """
        if not self.csrf_token:
            self.connect()

        url = f"{self.base_url}/repository/informationsystem/search"
        params = {
            "operation": "quickSearch",
            "query": query.strip(),
            "maxResults": str(max_results),
            "sap-client": self.client
        }
        headers = {
            "sap-client": self.client,
            "X-sap-client": self.client,
            "Accept": "application/xml, text/xml, */*"
        }

        try:
            print(f"DEBUG ADTClient: quickSearch '{query}' via {url}")
            response = self.session.get(url, params=params, headers=headers, timeout=20)
            if response.status_code == 200:
                import xml.etree.ElementTree as ET
                objects = []
                try:
                    root = ET.fromstring(response.text)
                    for elem in root.iter():
                        tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                        if tag in ('objectReference', 'adtcore:objectReference'):
                            name = (elem.get('name') or elem.get('{http://www.sap.com/adt/core}name') or '').strip().upper()
                            raw_type = (elem.get('type') or elem.get('{http://www.sap.com/adt/core}type') or '').strip().upper()
                            pkg = (elem.get('packageName') or elem.get('{http://www.sap.com/adt/core}packageName') or '').strip().upper()
                            desc = (elem.get('description') or elem.get('{http://www.sap.com/adt/core}description') or '').strip()
                            uri = (elem.get('uri') or elem.get('{http://www.sap.com/adt/core}uri') or '').strip()

                            # Simplify type shortcode (e.g. CLAS/OC -> CLAS, PROG/P -> PROG)
                            type_code = raw_type.split('/')[0] if '/' in raw_type else raw_type

                            if name:
                                objects.append({
                                    "name": name,
                                    "type": type_code,
                                    "raw_type": raw_type,
                                    "package": pkg,
                                    "description": desc,
                                    "uri": uri
                                })
                    print(f"DEBUG ADTClient: quickSearch found {len(objects)} objects for '{query}'")
                    return {
                        "success": True,
                        "query": query,
                        "objects": objects,
                        "total": len(objects)
                    }
                except Exception as pe:
                    print(f"DEBUG ADTClient: XML parse error in search: {pe}")
                    return {"success": False, "error": f"Failed to parse search XML: {pe}", "query": query, "objects": []}
            else:
                return {
                    "success": False,
                    "error": f"SAP returned status {response.status_code}",
                    "query": query,
                    "objects": []
                }
        except Exception as e:
            print(f"ERROR ADTClient: search_objects failed: {e}")
            return {"success": False, "error": str(e), "query": query, "objects": []}


    # ──────────────────────────────────────────────────────────────────────────
    # Source Code Read (type-aware, any ABAP object)
    # ──────────────────────────────────────────────────────────────────────────

    def fetch_source_code(self, object_name: str, object_type: str = "CLAS") -> Dict[str, Any]:
        """
        Fetch full ABAP source text for any object type.
        Supports ADT REST endpoints with automatic include/program cross-fallback,
        and secondary fallback to SAP Gateway OData sourcecodeSet service.

        Args:
            object_name: SAP object name (e.g. ZCL_SALES_ORDER)
            object_type: SAP object type short code (CLAS, PROG, TABL, DDLS, etc.)

        Returns:
            {"success": True, "source_code": "<abap text>", "object_name": "...", "object_type": "..."}
        """
        import html

        # 1. Clean object_name (strip any appended type suffix like " (DDLS)" or " (CLAS)")
        clean_name = re.sub(r'\s*\([A-Z0-9_]+\)$', '', object_name or '').strip().upper()
        
        # 2. Normalize object_type
        type_labels = {
            'ABAP CLASS': 'CLAS', 'CLASS': 'CLAS',
            'ABAP INTERFACE': 'INTF', 'INTERFACE': 'INTF',
            'ABAP PROGRAM': 'PROG', 'PROGRAM': 'PROG', 'REPORT': 'PROG',
            'ABAP INCLUDE': 'INCL', 'INCLUDE': 'INCL',
            'FUNCTION GROUP': 'FUGR', 'FUNCTION MODULE': 'FUNC',
            'CDS VIEW': 'DDLS',
            'DATABASE TABLE': 'TABL', 'TABLE': 'TABL',
            'DATABASE VIEW': 'VIEW',
            'DATA ELEMENT': 'DTEL', 'DOMAIN': 'DOMA',
            'MESSAGE CLASS': 'MSAG',
            'SERVICE DEFINITION': 'SRVD', 'BEHAVIOR DEFINITION': 'BDEF',
            'PACKAGE': 'DEVC'
        }
        clean_type = type_labels.get((object_type or '').strip().upper(), (object_type or 'CLAS').strip().upper())

        path = self._object_type_to_source_path(clean_name, clean_type)
        headers = {
            "sap-client": self.client,
            "X-sap-client": self.client,
            "X-Client": self.client,
            "Accept": "text/plain, application/vnd.sap.adt.abapsource+xml, */*"
        }
        params = {"sap-client": self.client} if self.client else {}

        # 3. Attempt ADT REST primary path
        if path:
            url = self.base_url + path
            try:
                print(f"DEBUG ADTClient: fetch_source_code {clean_name} ({clean_type}) -> {url}")
                response = self.session.get(url, params=params, headers=headers, timeout=20)
                if response.status_code == 200 and response.text.strip():
                    source = response.text
                    print(f"DEBUG ADTClient: Got {len(source)} chars for {clean_name} via ADT REST")
                    return {
                        "success": True,
                        "source_code": source,
                        "object_name": clean_name,
                        "object_type": clean_type,
                        "url": url,
                        "source": "SAP_ADT"
                    }
                elif response.status_code == 404:
                    # Alternative ADT path for PROG <-> INCL
                    alt_path = None
                    n_lower = clean_name.lower()
                    if clean_type == 'PROG':
                        alt_path = f"/programs/includes/{n_lower}/source/main"
                    elif clean_type == 'INCL':
                        alt_path = f"/programs/programs/{n_lower}/source"

                    if alt_path:
                        alt_url = self.base_url + alt_path
                        print(f"DEBUG ADTClient: Retrying alternative ADT path -> {alt_url}")
                        alt_res = self.session.get(alt_url, params=params, headers=headers, timeout=20)
                        if alt_res.status_code == 200 and alt_res.text.strip():
                            source = alt_res.text
                            print(f"DEBUG ADTClient: Got {len(source)} chars via alternative ADT path")
                            return {
                                "success": True,
                                "source_code": source,
                                "object_name": clean_name,
                                "object_type": clean_type,
                                "url": alt_url,
                                "source": "SAP_ADT"
                            }
            except Exception as e:
                print(f"DEBUG ADTClient: ADT REST fetch exception: {e}")

        # 4. Fallback to SAP Gateway OData sourcecodeSet
        protocol = "https" if self.use_ssl else "http"
        odata_base = f"{protocol}://{self.effective_host}:{self.port}/sap/opu/odata/sap/ZABAP_GIT_OBJECTS_SRV"
        odata_headers = {
            "sap-client": self.client,
            "X-sap-client": self.client,
            "X-Client": self.client,
            "Accept": "application/json"
        }

        # Attempt 4a: OData Entity single read
        try:
            entity_url = f"{odata_base}/sourcecodeSet(ObjectType='{clean_type}',ObjectName='{clean_name}')?$format=json"
            print(f"DEBUG ADTClient: Attempting SAP OData entity read -> {entity_url}")
            odata_res = self.session.get(entity_url, params=params, headers=odata_headers, timeout=15)
            if odata_res.status_code == 200:
                payload = odata_res.json()
                line = payload.get('d', {}).get('Line')
                if line:
                    print(f"DEBUG ADTClient: Got source code for {clean_name} via SAP OData Entity")
                    return {
                        "success": True,
                        "source_code": line,
                        "object_name": clean_name,
                        "object_type": clean_type,
                        "url": entity_url,
                        "source": "SAP_ODATA"
                    }
        except Exception as odata_err:
            print(f"DEBUG ADTClient: OData entity read error: {odata_err}")

        # Attempt 4b: OData EntitySet query with filter
        try:
            filter_url = f"{odata_base}/sourcecodeSet?$filter=ObjectType eq '{clean_type}' and ObjectName eq '{clean_name}'&$format=json"
            print(f"DEBUG ADTClient: Attempting SAP OData entityset filter -> {filter_url}")
            odata_res2 = self.session.get(filter_url, params=params, headers=odata_headers, timeout=15)
            if odata_res2.status_code == 200:
                payload2 = odata_res2.json()
                results = payload2.get('d', {}).get('results', [])
                if results:
                    lines = [str(r.get('Line') or r.get('line') or r.get('Content') or '') for r in results]
                    combined = '\n'.join(lines)
                    if combined.strip():
                        print(f"DEBUG ADTClient: Got {len(lines)} lines for {clean_name} via SAP OData Filter")
                        return {
                            "success": True,
                            "source_code": combined,
                            "object_name": clean_name,
                            "object_type": clean_type,
                            "url": filter_url,
                            "source": "SAP_ODATA"
                        }
        except Exception as odata_err2:
            print(f"DEBUG ADTClient: OData filter read error: {odata_err2}")

        # Attempt 4c: OData EntitySet query with ObjectName only
        try:
            filter_url2 = f"{odata_base}/sourcecodeSet?$filter=ObjectName eq '{clean_name}'&$format=json"
            odata_res3 = self.session.get(filter_url2, params=params, headers=odata_headers, timeout=15)
            if odata_res3.status_code == 200:
                payload3 = odata_res3.json()
                results3 = payload3.get('d', {}).get('results', [])
                if results3:
                    lines = [str(r.get('Line') or r.get('line') or r.get('Content') or '') for r in results3]
                    combined = '\n'.join(lines)
                    if combined.strip():
                        print(f"DEBUG ADTClient: Got {len(lines)} lines for {clean_name} via SAP OData ObjectName Filter")
                        return {
                            "success": True,
                            "source_code": combined,
                            "object_name": clean_name,
                            "object_type": clean_type,
                            "url": filter_url2,
                            "source": "SAP_ODATA"
                        }
        except Exception:
            pass

        return {
            "success": False,
            "source_code": None,
            "error": f"Source code for '{clean_name}' ({clean_type}) not found in SAP ADT or OData.",
            "object_name": clean_name,
            "object_type": clean_type
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Source Code Write (PUT to ADT REST)
    # ──────────────────────────────────────────────────────────────────────────

    def write_source_code(self, object_name: str, object_type: str, source_code: str,
                          transport_request: str = "") -> dict:
        """
        Write (PUT) ABAP source code back to the SAP system via ADT REST.
        Requires a valid CSRF token — call connect() first.

        Args:
            object_name:  SAP object name (e.g. ZCL_SALES_ORDER)
            object_type:  SAP object type short code (CLAS, PROG, TABL, DDLS …)
            source_code:  Full ABAP / DDL source text to write
            transport_request: Optional CTS transport request number

        Returns:
            {"success": True, "object_name": "...", "bytes_written": N}
        """
        if not self.csrf_token:
            self.connect()

        path = self._object_type_to_source_path(object_name, object_type)
        url = self.base_url + path
        headers = {
            "Content-Type": "text/plain; charset=utf-8",
            "X-CSRF-Token": self.csrf_token or "",
            "sap-client": self.client,
            "X-sap-client": self.client,
            "X-Client": self.client,
            "Accept": "*/*"
        }
        params = {"sap-client": self.client} if self.client else {}
        if transport_request:
            params["corrNr"] = transport_request

        try:
            print(f"DEBUG ADTClient: write_source_code {object_name} ({object_type}) -> PUT {url}")
            response = self.session.put(
                url,
                data=source_code.encode("utf-8"),
                headers=headers,
                params=params,
                timeout=30
            )

            if response.status_code in (200, 201, 204):
                print(f"DEBUG ADTClient: Source written successfully for {object_name} ({response.status_code})")
                return {
                    "success": True,
                    "object_name": object_name.strip().upper(),
                    "object_type": object_type,
                    "bytes_written": len(source_code.encode("utf-8")),
                    "status_code": response.status_code
                }
            else:
                print(f"DEBUG ADTClient: write_source_code failed. status={response.status_code}, body={response.text[:300]}")
                return {
                    "success": False,
                    "error": f"SAP returned status {response.status_code}",
                    "details": response.text[:400]
                }
        except Exception as e:
            print(f"ERROR ADTClient: write_source_code exception: {e}")
            return {"success": False, "error": str(e)}

    # ──────────────────────────────────────────────────────────────────────────
    # CDS View / DDL Source
    # ──────────────────────────────────────────────────────────────────────────

    def fetch_cds_view_code(self, view_name: str) -> Optional[str]:
        """
        Fetch a CDS view (DDL source) from ADT.

        Args:
            view_name: Name of the CDS view / DDL source (e.g. ZI_SALES_ORDER)
        """
        result = self.fetch_source_code(view_name, "DDLS")
        return result.get("source_code") if result.get("success") else None

    # ──────────────────────────────────────────────────────────────────────────
    # Function Group Source
    # ──────────────────────────────────────────────────────────────────────────

    def fetch_function_group_code(self, fugr_name: str) -> Optional[str]:
        """
        Fetch a function group's main include source from ADT.

        Args:
            fugr_name: Name of the function group (e.g. ZFUGR_SALES)
        """
        result = self.fetch_source_code(fugr_name, "FUGR")
        return result.get("source_code") if result.get("success") else None

    # ──────────────────────────────────────────────────────────────────────────
    # Transport Requests
    # ──────────────────────────────────────────────────────────────────────────

    def list_transports(self, user: str = "") -> Dict[str, Any]:
        """
        List open transport requests from SAP CTS via ADT REST.

        Args:
            user: Filter by owner (SAP username). Defaults to the connected user.

        Returns:
            {"success": True, "transports": [{"id": "DEVKnnnnnn", "description": "...", "status": "D"}, ...]}
        """
        if not self.csrf_token:
            self.connect()

        owner = (user or self.username).strip().upper()
        url = f"{self.base_url}/cts/transports"
        params = {
            "user": owner,
            "target": "",
            "sap-client": self.client
        }
        headers = {
            "sap-client": self.client,
            "X-sap-client": self.client,
            "Accept": "application/vnd.sap.adt.cts.transports.v1+xml, application/xml, */*"
        }

        try:
            print(f"DEBUG ADTClient: Listing transports for user={owner}")
            response = self.session.get(url, params=params, headers=headers, timeout=15)

            if response.status_code != 200:
                return {"success": False, "error": f"SAP returned status {response.status_code}"}

            import xml.etree.ElementTree as ET
            transports = []
            try:
                root = ET.fromstring(response.text)
                for elem in root.iter():
                    tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                    if tag in ('workbenchRequest', 'transport', 'cts:workbenchRequest'):
                        tr_id = (elem.get('id') or elem.get('{http://www.sap.com/adt/cts}id') or '').strip()
                        tr_desc = (elem.get('description') or elem.get('{http://www.sap.com/adt/cts}description') or '').strip()
                        tr_status = (elem.get('status') or elem.get('{http://www.sap.com/adt/cts}status') or 'D').strip()
                        if tr_id:
                            transports.append({"id": tr_id, "description": tr_desc, "status": tr_status})
            except ET.ParseError as pe:
                print(f"DEBUG ADTClient: Transport XML parse warning: {pe}")

            return {"success": True, "transports": transports, "total": len(transports)}
        except Exception as e:
            print(f"ERROR ADTClient: Failed to list transports: {e}")
            return {"success": False, "error": str(e)}

    # ──────────────────────────────────────────────────────────────────────────
    # Object Creation (ADT REST direct — used by EmbeddedADTMCPClient)
    # ──────────────────────────────────────────────────────────────────────────

    def create_abap_object(self, object_type: str, object_name: str,
                           package_name: str = "$TMP", description: str = "",
                           transport_request: str = "") -> Dict[str, Any]:
        """
        Create an ABAP object skeleton on the SAP system via ADT REST POST.

        Args:
            object_type:        SAP short code: CLAS, PROG, TABL, DDLS, INTF …
            object_name:        Name of the new object (e.g. ZCL_NEW_CLASS)
            package_name:       Target package (default $TMP for local)
            description:        Short description for the object
            transport_request:  Transport request number (leave empty for $TMP)

        Returns:
            {"success": True, "object_name": "...", "object_uri": "..."}
        """
        if not self.csrf_token:
            self.connect()

        name_upper = object_name.strip().upper()
        name_lower = name_upper.lower()

        # ADT endpoint and XML payload vary by object type
        type_config = {
            "CLAS": {
                "url": f"{self.base_url}/oo/classes",
                "content_type": "application/vnd.sap.adt.oo.class.v4+xml",
                "xml": f"""<?xml version="1.0" encoding="UTF-8"?>
<class:abapClass xmlns:class="http://www.sap.com/adt/oo/class"
                 xmlns:adtcore="http://www.sap.com/adt/core"
                 adtcore:responsible="{self.username.upper()}"
                 adtcore:masterLanguage="EN"
                 adtcore:name="{name_upper}"
                 adtcore:description="{description}">
  <adtcore:packageRef adtcore:name="{package_name.upper()}"/>
</class:abapClass>"""
            },
            "PROG": {
                "url": f"{self.base_url}/programs/programs",
                "content_type": "application/vnd.sap.adt.programs.program.v2+xml",
                "xml": f"""<?xml version="1.0" encoding="UTF-8"?>
<program:abapProgram xmlns:program="http://www.sap.com/adt/programs/program"
                     xmlns:adtcore="http://www.sap.com/adt/core"
                     adtcore:name="{name_upper}"
                     adtcore:description="{description}">
  <adtcore:packageRef adtcore:name="{package_name.upper()}"/>
</program:abapProgram>"""
            },
            "INTF": {
                "url": f"{self.base_url}/oo/interfaces",
                "content_type": "application/vnd.sap.adt.oo.interface.v4+xml",
                "xml": f"""<?xml version="1.0" encoding="UTF-8"?>
<interface:abapInterface xmlns:interface="http://www.sap.com/adt/oo/interface"
                          xmlns:adtcore="http://www.sap.com/adt/core"
                          adtcore:name="{name_upper}"
                          adtcore:description="{description}">
  <adtcore:packageRef adtcore:name="{package_name.upper()}"/>
</interface:abapInterface>"""
            },
        }

        config = type_config.get(object_type)
        if not config:
            # Generic fallback — create as program
            config = type_config["PROG"]

        headers = {
            "Content-Type": config["content_type"],
            "X-CSRF-Token": self.csrf_token or "",
            "sap-client": self.client,
            "X-sap-client": self.client,
            "Accept": "*/*"
        }
        params = {"sap-client": self.client}
        if transport_request:
            params["corrNr"] = transport_request

        try:
            print(f"DEBUG ADTClient: Creating {object_type} object {name_upper} in {package_name}")
            response = self.session.post(
                config["url"],
                data=config["xml"].encode("utf-8"),
                headers=headers,
                params=params,
                timeout=20
            )
            if response.status_code in (200, 201):
                obj_uri = response.headers.get("Location", "")
                print(f"DEBUG ADTClient: Created {name_upper}. URI: {obj_uri}")
                return {
                    "success": True,
                    "object_name": name_upper,
                    "object_type": object_type,
                    "object_uri": obj_uri,
                    "package": package_name.upper()
                }
            else:
                print(f"DEBUG ADTClient: Create object failed. status={response.status_code}, body={response.text[:300]}")
                return {
                    "success": False,
                    "error": f"SAP returned status {response.status_code}",
                    "details": response.text[:400]
                }
        except Exception as e:
            print(f"ERROR ADTClient: create_abap_object exception: {e}")
            return {"success": False, "error": str(e)}

    # ──────────────────────────────────────────────────────────────────────────
    # Object Activation
    # ──────────────────────────────────────────────────────────────────────────

    def activate_objects(self, object_uris: list) -> Dict[str, Any]:
        """
        Activate a list of ABAP objects via the ADT activation endpoint.

        Args:
            object_uris: List of ADT object URIs
                         e.g. ["/sap/bc/adt/oo/classes/zcl_my_class"]

        Returns:
            {"success": True, "activated": [...uris...]}
        """
        if not self.csrf_token:
            self.connect()

        url = f"{self.base_url}/activation/activate"

        # Build activation XML
        obj_refs = "\n".join(
            f'  <adtcore:objectReference adtcore:uri="{uri}"/>'
            for uri in object_uris
        )
        payload = f"""<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
{obj_refs}
</adtcore:objectReferences>"""

        headers = {
            "Content-Type": "application/vnd.sap.adt.activation.request.v2+xml",
            "X-CSRF-Token": self.csrf_token or "",
            "sap-client": self.client,
            "X-sap-client": self.client,
            "Accept": "application/vnd.sap.adt.activation.result.v1+xml, */*"
        }
        params = {"method": "activate", "sap-client": self.client}

        try:
            print(f"DEBUG ADTClient: Activating {len(object_uris)} object(s)")
            response = self.session.post(url, data=payload.encode("utf-8"), headers=headers, params=params, timeout=30)

            if response.status_code in (200, 201):
                # Check for syntax error messages inside the activation response XML
                if '<adtcore:message' in response.text and ('type="E"' in response.text or 'severity="E"' in response.text or 'type="error"' in response.text.lower()):
                    import xml.etree.ElementTree as ET
                    err_msgs = []
                    try:
                        root = ET.fromstring(response.text)
                        for elem in root.iter():
                            if elem.tag.endswith('message'):
                                msg_text = elem.attrib.get('text') or elem.text or ''
                                if msg_text:
                                    err_msgs.append(msg_text)
                    except:
                        pass
                    msg_summary = "; ".join(err_msgs) if err_msgs else "Syntax error during SAP activation"
                    print(f"DEBUG ADTClient: Activation contains compiler errors: {msg_summary}")
                    return {
                        "success": False,
                        "error": msg_summary,
                        "details": response.text[:400]
                    }

                print(f"DEBUG ADTClient: Activation successful for {object_uris}")
                return {"success": True, "activated": object_uris, "response": response.text[:300]}
            else:
                print(f"DEBUG ADTClient: Activation failed. status={response.status_code}, body={response.text[:300]}")
                return {
                    "success": False,
                    "error": f"Activation returned status {response.status_code}",
                    "details": response.text[:400]
                }
        except Exception as e:
            print(f"ERROR ADTClient: activate_objects exception: {e}")
            return {"success": False, "error": str(e)}

