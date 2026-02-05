"""
Cloud ALM Service
Handles integration with SAP Cloud ALM APIs for document management
"""

import os
import requests
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import json

class CALMService:
    """Service for interacting with SAP Cloud ALM APIs"""
    
    def __init__(self, config: Optional[Dict] = None):
        """
        Initialize CALM Service with configuration
        
        Args:
            config: Optional configuration dict. If not provided, uses environment variables.
        """
        if config:
            self.api_endpoint = config.get('apiEndpoint', '')
            self.token_url = config.get('tokenUrl', '')
            self.client_id = config.get('clientId', '')
            self.client_secret = config.get('clientSecret', '')
        else:
            # Load from environment
            self.api_endpoint = os.getenv('CALM_API_ENDPOINT', '')
            self.token_url = os.getenv('CALM_TOKEN_URL', '')
            self.client_id = os.getenv('CALM_CLIENT_ID', '')
            self.client_secret = os.getenv('CALM_CLIENT_SECRET', '')
        
        self._access_token = None
        self._token_expiry = None
        self._using_demo_data = False  # Track if using demo data
        self._last_error = None  # Track last connection error
    
    def _get_access_token(self) -> str:
        """
        Get OAuth 2.0 access token using client credentials flow
        
        Returns:
            Access token string
        """
        # Check if we have a valid cached token
        if self._access_token and self._token_expiry and datetime.now() < self._token_expiry:
            return self._access_token
        
        if not self.token_url or not self.client_id or not self.client_secret:
            raise ValueError("CALM credentials not configured")
        
        try:
            response = requests.post(
                self.token_url,
                data={
                    'grant_type': 'client_credentials',
                    'client_id': self.client_id,
                    'client_secret': self.client_secret
                },
                headers={
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout=30
            )
            response.raise_for_status()
            
            token_data = response.json()
            self._access_token = token_data.get('access_token')
            
            # Calculate token expiry (with 5 minute buffer)
            expires_in = token_data.get('expires_in', 3600)
            self._token_expiry = datetime.now() + timedelta(seconds=expires_in - 300)
            
            return self._access_token
            
        except requests.exceptions.RequestException as e:
            print(f"Error getting CALM access token: {e}")
            raise
    
    def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict:
        """
        Make authenticated request to CALM API
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            **kwargs: Additional request arguments
            
        Returns:
            Response JSON data
        """
        token = self._get_access_token()
        
        headers = kwargs.pop('headers', {})
        headers['Authorization'] = f'Bearer {token}'
        headers['Content-Type'] = 'application/json'
        
        url = f"{self.api_endpoint}{endpoint}"
        
        response = requests.request(
            method,
            url,
            headers=headers,
            timeout=60,
            **kwargs
        )
        response.raise_for_status()
        
        return response.json() if response.content else {}
    
    def test_connection(self) -> bool:
        """
        Test connection to CALM API
        
        Returns:
            True if connection successful
        """
        try:
            self._get_access_token()
            return True
        except Exception as e:
            print(f"CALM connection test failed: {e}")
            return False
    
    # =========================================================================
    # Project API
    # =========================================================================
    
    def list_projects(self) -> Dict:
        """
        List all projects from Cloud ALM
        
        Returns:
            Dict with 'projects' list and 'isDemo' boolean
        """
        try:
            self._using_demo_data = False
            response = self._make_request('GET', '/api/calm-projects/v1/projects')
            projects = response.get('value', response.get('projects', []))
            return {'projects': projects, 'isDemo': False}
        except Exception as e:
            self._using_demo_data = True
            self._last_error = str(e)
            print(f"Error listing projects (using demo data): {e}")
            return {'projects': self._get_demo_projects(), 'isDemo': True, 'error': str(e)}
    
    def get_project(self, project_id: str) -> Dict:
        """
        Get a specific project by ID
        
        Args:
            project_id: Project ID
            
        Returns:
            Project object
        """
        try:
            response = self._make_request('GET', f'/api/calm-projects/v1/projects/{project_id}')
            return response
        except Exception as e:
            print(f"Error getting project: {e}")
            return {}
    
    # =========================================================================
    # Scope API
    # =========================================================================
    
    def list_scopes(self, project_id: str) -> List[Dict]:
        """
        List scopes for a project
        
        Args:
            project_id: Parent project ID
            
        Returns:
            List of scope objects
        """
        try:
            response = self._make_request(
                'GET', 
                '/api/calm-processscopes/v1/scopes',
                params={'projectId': project_id}
            )
            return response.get('value', response.get('scopes', []))
        except Exception as e:
            print(f"Error listing scopes: {e}")
            return self._get_demo_scopes(project_id)
    
    # =========================================================================
    # Solution Process API
    # =========================================================================
    
    def list_solution_processes(self, scope_id: str) -> List[Dict]:
        """
        List solution processes for a scope
        
        Args:
            scope_id: Parent scope ID
            
        Returns:
            List of solution process objects
        """
        try:
            response = self._make_request(
                'GET',
                '/api/calm-processscopes/v1/solutionProcesses',
                params={'scopeId': scope_id}
            )
            return response.get('value', response.get('processes', []))
        except Exception as e:
            print(f"Error listing solution processes: {e}")
            return self._get_demo_processes(scope_id)
    
    # =========================================================================
    # Document API
    # =========================================================================
    
    def list_documents(
        self, 
        process_id: Optional[str] = None,
        document_type: Optional[str] = None,
        project_id: Optional[str] = None
    ) -> Dict:
        """
        List documents with optional filters
        
        Args:
            process_id: Filter by solution process ID
            document_type: Filter by document type
            project_id: Filter by project ID
            
        Returns:
            Dict with 'documents' list and 'isDemo' boolean
        """
        try:
            self._using_demo_data = False
            params = {}
            if process_id:
                params['solutionProcessId'] = process_id
            if document_type and document_type != 'all':
                params['documentType'] = document_type
            if project_id:
                params['projectId'] = project_id
            
            response = self._make_request(
                'GET',
                '/api/calm-documents/v1/documents',
                params=params
            )
            documents = response.get('value', response.get('documents', []))
            return {'documents': documents, 'isDemo': False}
        except Exception as e:
            self._using_demo_data = True
            self._last_error = str(e)
            print(f"Error listing documents (using demo data): {e}")
            return {'documents': self._get_demo_documents(), 'isDemo': True, 'error': str(e)}
    
    def get_document_content(self, document_id: str) -> bytes:
        """
        Download document content
        
        Args:
            document_id: Document ID
            
        Returns:
            Document content as bytes
        """
        try:
            token = self._get_access_token()
            
            response = requests.get(
                f"{self.api_endpoint}/api/calm-documents/v1/documents/{document_id}/content",
                headers={'Authorization': f'Bearer {token}'},
                timeout=120
            )
            response.raise_for_status()
            
            return response.content
        except Exception as e:
            print(f"Error downloading document: {e}")
            raise
    
    def push_document(
        self,
        name: str,
        content: bytes,
        document_type: str,
        process_id: str,
        description: Optional[str] = None
    ) -> Dict:
        """
        Upload a document to Cloud ALM
        
        Args:
            name: Document name
            content: Document content as bytes
            document_type: Type of document (functional_spec, technical_spec, etc.)
            process_id: Solution process ID to attach to
            description: Optional description
            
        Returns:
            Created document object
        """
        try:
            token = self._get_access_token()
            
            # First, create the document metadata
            metadata = {
                'name': name,
                'documentType': document_type,
                'solutionProcessId': process_id,
                'description': description or ''
            }
            
            response = requests.post(
                f"{self.api_endpoint}/api/calm-documents/v1/documents",
                headers={
                    'Authorization': f'Bearer {token}',
                    'Content-Type': 'application/json'
                },
                json=metadata,
                timeout=30
            )
            response.raise_for_status()
            
            doc_data = response.json()
            doc_id = doc_data.get('id')
            
            # Then, upload the content
            if doc_id and content:
                upload_response = requests.put(
                    f"{self.api_endpoint}/api/calm-documents/v1/documents/{doc_id}/content",
                    headers={
                        'Authorization': f'Bearer {token}',
                        'Content-Type': 'application/octet-stream'
                    },
                    data=content,
                    timeout=120
                )
                upload_response.raise_for_status()
            
            return doc_data
            
        except Exception as e:
            print(f"Error pushing document: {e}")
            raise
    
    # =========================================================================
    # Demo Data (for development/testing)
    # =========================================================================
    
    def _get_demo_projects(self) -> List[Dict]:
        """Return demo project data"""
        return [
            {
                'id': 'proj-1',
                'name': 'S/4HANA Implementation Wave 2',
                'description': 'Main implementation project for S/4HANA migration'
            },
            {
                'id': 'proj-2',
                'name': 'Finance Transformation',
                'description': 'Core finance module implementation'
            },
            {
                'id': 'proj-3',
                'name': 'Supply Chain Optimization',
                'description': 'SCM process improvements and automation'
            }
        ]
    
    def _get_demo_scopes(self, project_id: str) -> List[Dict]:
        """Return demo scope data"""
        scopes = {
            'proj-1': [
                {'id': 'scope-1', 'name': 'Core Finance & Supply Chain', 'projectId': project_id},
                {'id': 'scope-2', 'name': 'Human Resources', 'projectId': project_id},
                {'id': 'scope-3', 'name': 'Manufacturing', 'projectId': project_id}
            ],
            'proj-2': [
                {'id': 'scope-4', 'name': 'General Ledger', 'projectId': project_id},
                {'id': 'scope-5', 'name': 'Accounts Payable', 'projectId': project_id},
                {'id': 'scope-6', 'name': 'Accounts Receivable', 'projectId': project_id}
            ],
            'proj-3': [
                {'id': 'scope-7', 'name': 'Inventory Management', 'projectId': project_id},
                {'id': 'scope-8', 'name': 'Warehouse Management', 'projectId': project_id}
            ]
        }
        return scopes.get(project_id, [])
    
    def _get_demo_processes(self, scope_id: str) -> List[Dict]:
        """Return demo solution process data"""
        processes = {
            'scope-1': [
                {'id': 'proc-1', 'name': 'Order to Cash (O2C)', 'scopeId': scope_id},
                {'id': 'proc-2', 'name': 'Procure to Pay (P2P)', 'scopeId': scope_id},
                {'id': 'proc-3', 'name': 'Record to Report (R2R)', 'scopeId': scope_id}
            ],
            'scope-2': [
                {'id': 'proc-4', 'name': 'Hire to Retire', 'scopeId': scope_id},
                {'id': 'proc-5', 'name': 'Payroll Processing', 'scopeId': scope_id}
            ],
            'scope-3': [
                {'id': 'proc-6', 'name': 'Plan to Produce', 'scopeId': scope_id},
                {'id': 'proc-7', 'name': 'Quality Management', 'scopeId': scope_id}
            ]
        }
        return processes.get(scope_id, [
            {'id': 'proc-default', 'name': 'Default Process', 'scopeId': scope_id}
        ])
    
    def _get_demo_documents(self) -> List[Dict]:
        """Return demo document data"""
        return [
            {
                'id': 'doc-1',
                'name': 'FIN_FSpec_GeneralLedger_V1.2.docx',
                'type': 'Functional Spec',
                'size': '1.4 MB',
                'lastUpdated': '2026-01-20'
            },
            {
                'id': 'doc-2',
                'name': 'SCM_TSpec_InventoryManagement_API.pdf',
                'type': 'Technical Spec',
                'size': '850 KB',
                'lastUpdated': '2026-01-19'
            },
            {
                'id': 'doc-3',
                'name': 'O2C_ProcessFlow_Diagram_V4.drawio',
                'type': 'Process Flow',
                'size': '3.2 MB',
                'lastUpdated': '2026-01-18'
            },
            {
                'id': 'doc-4',
                'name': 'HR_FSpec_PayrollProcessing.docx',
                'type': 'Functional Spec',
                'size': '1.8 MB',
                'lastUpdated': '2026-01-17'
            },
            {
                'id': 'doc-5',
                'name': 'CRM_TSpec_CustomerDataIntegration.pdf',
                'type': 'Technical Spec',
                'size': '620 KB',
                'lastUpdated': '2026-01-15'
            },
            {
                'id': 'doc-6',
                'name': 'FitGap_CoreFinance_Analysis.xlsx',
                'type': 'Fit/Gap',
                'size': '245 KB',
                'lastUpdated': '2026-01-14'
            }
        ]


# Singleton instance with default config
_default_service = None

def get_calm_service(config: Optional[Dict] = None) -> CALMService:
    """
    Get CALM service instance
    
    Args:
        config: Optional configuration dict
        
    Returns:
        CALMService instance
    """
    global _default_service
    
    if config:
        return CALMService(config)
    
    if _default_service is None:
        _default_service = CALMService()
    
    return _default_service
