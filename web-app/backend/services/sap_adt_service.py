"""
SAP ADT (ABAP Development Tools) direct connector.
Handles HTTP authentication, CSRF tokens, and source code retrieval directly from AS ABAP servers.
"""

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


class DirectADTClient:
    def __init__(self, api_endpoint: str, client: str, username: str, password: str):
        """
        Initialize the ADT Client.
        
        Args:
            api_endpoint: Full URL (e.g. 'https://sapdev.company.com:44300') or hostname
            client: SAP Client ID (e.g. '100')
            username: SAP developer username
            password: SAP developer password
        """
        self.client = client.strip() or '100'
        self.username = username.strip()
        self.password = password
        
        # Parse host, port, use_ssl from api_endpoint
        url = api_endpoint.strip()
        if not url.startswith(('http://', 'https://')):
            # Default to https
            url = 'https://' + url
            
        parsed = urllib.parse.urlparse(url)
        self.host = parsed.hostname or ''
        
        # Determine port and scheme
        self.use_ssl = (parsed.scheme == 'https')
        self.port = parsed.port
        if not self.port:
            self.port = 443 if self.use_ssl else 80
            
        protocol = "https" if self.use_ssl else "http"
        self.base_url = f"{protocol}://{self.host}:{self.port}/sap/bc/adt"
        
        self.session = requests.Session()
        self.session.auth = (self.username, self.password)
        # Disable SSL certificate verification since many dev SAP systems use self-signed certs
        self.session.verify = False
        
        self.csrf_token = None
        print(f"DEBUG ADTClient: Initialized with base_url={self.base_url}, client={self.client}, user={self.username}")

    def connect(self) -> bool:
        """
        Connect to SAP ADT and fetch a CSRF token.
        
        Returns:
            True if connection was successful and authenticated.
        """
        if not self.host or not self.username or not self.password:
            raise ValueError("Incomplete SAP ADT Configuration: API Endpoint, Username, and Password are required.")
            
        headers = {
            "X-Client": self.client,
            "X-CSRF-Token": "Fetch",
            "Accept": "application/vnd.sap.adt.discovery.v1+xml"
        }
        
        try:
            url = f"{self.base_url}/discovery"
            print(f"DEBUG ADTClient: Sending GET to {url} with headers {headers}")
            response = self.session.get(url, headers=headers, timeout=15)
            
            # Print response info for debugging
            print(f"DEBUG ADTClient: Connection response status={response.status_code}")
            
            if response.status_code == 200:
                self.csrf_token = response.headers.get("X-CSRF-Token")
                print(f"DEBUG ADTClient: Successfully connected. CSRF Token: {self.csrf_token}")
                return True
            else:
                print(f"DEBUG ADTClient: Connection failed. Body: {response.text[:200]}")
                return False
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
            "X-Client": self.client,
            "Accept": "*/*"
        }
        
        try:
            print(f"DEBUG ADTClient: Fetching class source from {url}")
            response = self.session.get(url, headers=headers, timeout=15)
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
            "X-Client": self.client,
            "Accept": "*/*"
        }
        
        try:
            print(f"DEBUG ADTClient: Fetching program source from {url}")
            response = self.session.get(url, headers=headers, timeout=15)
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
            "X-Client": self.client,
            "Accept": "application/vnd.sap.adt.abapunit.testruns.result.v2+xml"
        }
        
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
