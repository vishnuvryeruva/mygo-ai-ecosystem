"""
BTP Service
Handles interactions with SAP BTP OData services
"""

import requests
import json
from typing import Dict, Any, Optional

class BTPService:
    def __init__(self, config: Dict[str, Any], use_env_fallback: bool = True):
        self.api_endpoint = config.get('apiEndpoint', '').strip()
        self.token_url = config.get('tokenUrl', '').strip()
        self.client_id = config.get('clientId', '').strip()
        self.client_secret = config.get('clientSecret', '').strip()
        self.auth_type = config.get('authType', 'OAuth 2.0').strip()
        
        if not all([self.api_endpoint, self.token_url, self.client_id, self.client_secret]):
            raise ValueError("Incomplete BTP configuration. Required fields: apiEndpoint, tokenUrl, Username/clientId, Password/clientSecret")
            
        self.access_token = None

    def _get_token(self) -> str:
        """Fetch OAuth token using Client Credentials flow"""
        if self.access_token:
            return self.access_token
            
        try:
            auth = (self.client_id, self.client_secret)
            data = {'grant_type': 'client_credentials'}
            
            response = requests.post(
                self.token_url,
                auth=auth,
                data=data,
                timeout=10
            )
            response.raise_for_status()
            
            token_data = response.json()
            self.access_token = token_data.get('access_token')
            
            if not self.access_token:
                raise ValueError("No access token in response")
                
            return self.access_token
        except Exception as e:
            raise Exception(f"Failed to get BTP access token: {str(e)}")

    def test_connection(self) -> bool:
        """Test connection to BTP by fetching token and making a test call to the endpoint"""
        try:
            token = self._get_token()
            headers = {
                'Authorization': f'Bearer {token}',
                'Accept': 'application/json'
            }
            response = requests.get(
                self.api_endpoint,
                headers=headers,
                timeout=10
            )
            
            if response.status_code not in [200, 201, 204, 404]:
                response.raise_for_status()
                
            return True
        except Exception as e:
            raise Exception(f"BTP Connection failed: {str(e)}")
            
    def fetch_data(self) -> Dict[str, Any]:
        """Fetch data from the configured BTP endpoint"""
        try:
            token = self._get_token()
            headers = {
                'Authorization': f'Bearer {token}',
                'Accept': 'application/json'
            }
            response = requests.get(
                self.api_endpoint,
                headers=headers,
                timeout=30
            )
                
            response.raise_for_status()
            
            return response.json()
        except Exception as e:
            raise Exception(f"Failed to fetch data from BTP: {str(e)}")
