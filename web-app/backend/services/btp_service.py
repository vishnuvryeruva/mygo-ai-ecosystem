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
        
        # DO NOT strip query strings here - allow direct full-URL configuration
        # However, keep the trailing slash strip if no query is present
        if '?' not in self.api_endpoint and self.api_endpoint.endswith('/'):
            self.api_endpoint = self.api_endpoint.rstrip('/')
        
        if not all([self.api_endpoint, self.token_url, self.client_id, self.client_secret]):
            raise ValueError("Incomplete BTP configuration. Required fields: apiEndpoint, tokenUrl, Username/clientId, Password/clientSecret")
            
        self.access_token = None

    def _get_token(self) -> str:
        """Fetch OAuth token using Client Credentials flow"""
        if self.access_token:
            return self.access_token
            
        try:
            # Try both Basic Auth and Body-based credentials as some SAP systems are picky
            auth = (self.client_id, self.client_secret)
            data = {
                'grant_type': 'client_credentials',
                'client_id': self.client_id,
                'client_secret': self.client_secret
            }
            
            response = requests.post(
                self.token_url,
                auth=auth, # Basic Auth header
                data=data, # Also in body
                timeout=15
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
            
    def get_service_root(self):
        """Extract the base service root URL from the configuration."""
        root = self.api_endpoint
        if '?' in root:
            root = root.split('?')[0]
            
        # Clean trailing slashes
        root = root.rstrip('/')
        
        # Strip common entity set suffixes to find the catalog base
        for s in ['objectsSet', 'ObjlistSet', 'sourcecodeSet']:
            if root.endswith(f"/{s}"):
                root = root[:-len(s)].rstrip('/')
        
        if not root.endswith('/'):
            root += '/'
        return root

    def fetch_data(self, entity_set=None, filter_query=None, skip=None, top=None):
        """
        Rebuilt BTP Data Fetch Logic (Pure JSON)
        """
        try:
            token = self._get_token()
            
            # Use Service Root + UI Entity Set if provided, otherwise use api_endpoint
            if entity_set:
                base_url = self.get_service_root()
                full_url = base_url + entity_set.lstrip('/')
            else:
                full_url = self.api_endpoint
                
            query_params = []
            
            # Handle $filter
            if filter_query:
                clean_filter = filter_query.replace('$filter=', '').strip()
                if clean_filter:
                    encoded_filter = clean_filter.replace(' ', '%20')
                    query_params.append(f"$filter={encoded_filter}")
            
            # Handle $skip
            if skip and str(skip) != '0':
                clean_skip = str(skip).replace('$skip=', '').strip()
                query_params.append(f"$skip={clean_skip}")
            
            # Handle $top
            if top:
                clean_top = str(top).replace('$top=', '').strip()
                query_params.append(f"$top={clean_top}")
            
            # Always request JSON format unless already in URL
            if "$format=json" not in full_url:
                query_params.append("$format=json")
            
            if query_params:
                separator = '&' if '?' in full_url else '?'
                full_url += separator + "&".join(query_params)
            
            print(f"[BTP-FETCH] Final URL: {full_url}")
            
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            
            response = requests.get(
                full_url,
                headers=headers,
                timeout=60
            )
            
            if response.status_code != 200:
                print(f"[BTP-FETCH] Error ({response.status_code}): {response.text[:500]}")
                raise Exception(f"BTP OData Error: {response.status_code}")
            
            return response.json()
                
        except Exception as e:
            print(f"[BTP-FETCH] Failed: {str(e)}")
            raise Exception(f"Failed to fetch BTP data: {str(e)}")

    def fetch_object_content(self, entity_set: str, object_key: str) -> str:
        """Attempt to fetch the raw content/$value for a specific object with multiple fallback patterns"""
        try:
            token = self._get_token()
            headers = {
                'Authorization': f'Bearer {token}',
                'Accept': 'application/json, text/plain, */*'
            }
            
            base_url = self.api_endpoint
            if not base_url.endswith('/'):
                base_url += '/'
            
            # Expanded pattern list to cover various SAP OData version and implementation styles
            # We try quoted, unquoted, property-named keys, and both with/without $value
            patterns = [
                f"{entity_set}('{object_key}')/$value",
                f"{entity_set}('{object_key}')",
                f"{entity_set}({object_key})/$value",
                f"{entity_set}({object_key})",
                # Common property-named keys in SAP services
                f"{entity_set}(Object='{object_key}')/$value",
                f"{entity_set}(Object='{object_key}')",
                f"{entity_set}(Objname='{object_key}')/$value",
                f"{entity_set}(Objname='{object_key}')",
                f"{entity_set}(ObjectName='{object_key}')/$value",
                f"{entity_set}(ObjectName='{object_key}')",
                f"{entity_set}(ObjectId='{object_key}')/$value",
                f"{entity_set}(ObjectId='{object_key}')",
                f"{entity_set}(ID='{object_key}')/$value",
                f"{entity_set}(ID='{object_key}')",
                f"{entity_set}(id='{object_key}')/$value",
                f"{entity_set}(id='{object_key}')",
                f"{entity_set}(key='{object_key}')/$value",
                f"{entity_set}(key='{object_key}')",
                f"{entity_set}(Name='{object_key}')/$value",
                f"{entity_set}(Name='{object_key}')",
                f"{entity_set}(uuid='{object_key}')/$value",
                f"{entity_set}(uuid='{object_key}')"
            ]
            
            # Fallback logic: if it's a common metadata set, also try sourcecodeSet
            search_sets = [entity_set]
            if entity_set.lower() in ['objectsset', 'objlistset']:
                search_sets.append('sourcecodeSet')
            
            status_codes = []
            
            for s_set in search_sets:
                for path_template in patterns:
                    # Replace entity set in pattern
                    path = path_template.replace(f"{entity_set}", s_set)
                    url = base_url + '/' + path.lstrip('/')
                    
                    try:
                        print(f"[BTP] Trying content fetch: {url}")
                        response = requests.get(
                            url, 
                            headers={**headers, 'Accept': 'application/json;odata.metadata=minimal'}, 
                            timeout=12
                        )
                        status_codes.append(f"{path} -> {response.status_code}")
                        
                        if response.status_code == 200:
                            data = response.json()
                            
                            # Handle OData value arrays (common for line-by-line source code)
                            if isinstance(data, dict):
                                items = data.get('value', [])
                                if 'd' in data:
                                    d_data = data['d']
                                    if isinstance(d_data, dict) and 'results' in d_data:
                                        items = d_data['results']
                                    elif isinstance(d_data, list):
                                        items = d_data
                                
                                if isinstance(items, list) and len(items) > 0:
                                    # Check if these are code lines
                                    if 'Line' in items[0] or 'line' in items[0]:
                                        lines = [str(item.get('Line', item.get('line', ''))) for item in items]
                                        return "\n".join(lines)
                                    
                                    # If not code lines, maybe it's a single object in a list
                                    data = items[0]
                            
                            # Handle single object
                            if isinstance(data, dict):
                                content_fields = ['Content', 'content', 'Source', 'SourceCode', 'sourceCode', 
                                                 'Value', 'rawContent', 'Script', 'Data', 'ScriptContent', 'Line', 'line']
                                for field in content_fields:
                                    if field in data and data[field]:
                                        return str(data[field])
                                
                                return json.dumps(data, indent=2)
                            
                            return response.text
                    except Exception as e:
                        status_codes.append(f"{path} -> Error: {str(e)}")
                        continue
            
            # If we reached here, try a direct filter on sourcecodeSet as a last resort
            try:
                print(f"[BTP] Last resort: filtering sourcecodeSet for Object='{object_key}'")
                fallback_url = base_url + f"/sourcecodeSet?$filter=Object eq '{object_key}'"
                resp = requests.get(fallback_url, headers=headers, timeout=15)
                if resp.status_code == 200:
                    data = resp.json()
                    items = data.get('value', data.get('d', {}).get('results', []))
                    if isinstance(items, list) and len(items) > 0:
                        lines = [str(item.get('Line', item.get('line', ''))) for item in items]
                        return "\n".join(lines)
            except:
                pass

            # If all else fails
            detailed_error = "Tried patterns:\n" + "\n".join(status_codes)
            raise Exception(f"Object content not found. Checked multiple sets and patterns.\n{detailed_error}")
            
        except Exception as e:
            raise Exception(f"BTP Content Fetch Error: {str(e)}")



