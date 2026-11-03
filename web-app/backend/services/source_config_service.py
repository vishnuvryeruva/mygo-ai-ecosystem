"""
Source Configuration Service
Manages data source configurations for CALM, SharePoint, SolMan
"""

import os
import json
import uuid
from typing import List, Dict, Optional
from datetime import datetime

# Storage file path
SOURCES_FILE = os.path.join(os.path.dirname(__file__), '..', 'config', 'sources.json')


def _load_sources() -> List[Dict]:
    """Load sources from JSON file"""
    try:
        if os.path.exists(SOURCES_FILE):
            with open(SOURCES_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading sources: {e}")
    return []


def _save_sources(sources: List[Dict]) -> bool:
    """Save sources to JSON file"""
    try:
        # Ensure directory exists
        os.makedirs(os.path.dirname(SOURCES_FILE), exist_ok=True)
        
        with open(SOURCES_FILE, 'w') as f:
            json.dump(sources, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving sources: {e}")
        return False


def list_sources() -> List[Dict]:
    """
    List all configured sources
    
    Returns:
        List of source configurations
    """
    sources = _load_sources()
    
    # If no sources, return default CALM source
    if not sources:
        default_source = {
            'id': 'default-calm',
            'name': 'Mygo Cloud ALM (Env)',
            'type': 'CALM',
            'status': 'connected',
            'lastSync': None,
            'config': {
                'apiEndpoint': os.getenv('CALM_API_ENDPOINT', ''),
                'tokenUrl': os.getenv('CALM_TOKEN_URL', ''),
                'clientId': os.getenv('CALM_CLIENT_ID', ''),
                # Don't expose client secret
            }
        }
        return [default_source]
    
    # Remove sensitive data from response
    for source in sources:
        if 'config' in source:
            source['config'].pop('clientSecret', None)
            source['config'].pop('password', None)
    
    return sources


def get_source(source_id: str) -> Optional[Dict]:
    """
    Get a specific source by ID
    
    Args:
        source_id: Source ID
        
    Returns:
        Source configuration or None
    """
    sources = _load_sources()
    
    # Check for default source
    if source_id == 'default-calm':
        return {
            'id': 'default-calm',
            'name': 'Mygo Cloud ALM (Env)',
            'type': 'CALM',
            'status': 'connected',
            'lastSync': None,
            'config': {
                'apiEndpoint': os.getenv('CALM_API_ENDPOINT', ''),
                'tokenUrl': os.getenv('CALM_TOKEN_URL', ''),
                'clientId': os.getenv('CALM_CLIENT_ID', ''),
                'clientSecret': os.getenv('CALM_CLIENT_SECRET', '')
            }
        }
    
    for source in sources:
        if source.get('id') == source_id:
            return source
    
    return None


def create_source(data: Dict) -> Dict:
    """
    Create a new source configuration
    
    Args:
        data: Source configuration data
        
    Returns:
        Created source
    """
    sources = _load_sources()
    
    source_name = data.get('name') or data.get('sourceName') or 'New Source'
    source_type = data.get('type') or data.get('sourceType') or 'CALM'
    
    # Extract config with support for multiple source types (CALM, BTP, SAP_ADT, SAP_ADT_MCP)
    config = {
        'apiEndpoint': data.get('apiEndpoint') or data.get('sapHost') or '',
        'sapHost': data.get('sapHost') or data.get('apiEndpoint') or '',
        'tokenUrl': data.get('tokenUrl', ''),
        'clientId': data.get('clientId') or data.get('username') or '',
        'username': data.get('username') or data.get('clientId') or '',
        'clientSecret': data.get('clientSecret') or data.get('password') or '',
        'password': data.get('password') or data.get('clientSecret') or '',
        'authType': data.get('authType', 'OAuth 2.0'),
        'sapClient': data.get('sapClient', '300' if 'ADT' in source_type.upper() else '100'),
        'sapRouter': data.get('sapRouter') or data.get('saprouterString') or '',
        'saprouterString': data.get('saprouterString') or data.get('sapRouter') or '',
        'systemId': data.get('systemId', ''),
        'instanceNo': data.get('instanceNo', ''),
        'httpsPort': data.get('httpsPort', ''),
        'appServer': data.get('appServer', ''),
        'destination': data.get('destination', ''),
        'mode': data.get('mode', 'DIRECT_SAP' if 'ADT' in source_type.upper() else 'ODATA'),
        'description': data.get('description', '')
    }
    
    new_source = {
        'id': str(uuid.uuid4()),
        'name': source_name,
        'type': source_type,
        'status': 'disconnected',
        'lastSync': None,
        'createdAt': datetime.now().isoformat(),
        'config': config
    }
    
    sources.append(new_source)
    _save_sources(sources)
    
    # Remove sensitive data from response
    response = new_source.copy()
    response['config'] = {k: v for k, v in new_source['config'].items() if k not in ('clientSecret', 'password')}
    
    return response


def update_source(source_id: str, data: Dict) -> Optional[Dict]:
    """
    Update an existing source
    
    Args:
        source_id: Source ID
        data: Updated configuration data
        
    Returns:
        Updated source or None if not found
    """
    sources = _load_sources()
    
    for i, source in enumerate(sources):
        if source.get('id') == source_id:
            # Update fields
            if data.get('name') or data.get('sourceName'):
                source['name'] = data.get('name') or data.get('sourceName')
            if data.get('type') or data.get('sourceType'):
                source['type'] = data.get('type') or data.get('sourceType')
            
            if 'config' not in source:
                source['config'] = {}
            
            # Common updates
            for key in ('apiEndpoint', 'sapHost', 'tokenUrl', 'clientId', 'username',
                        'authType', 'sapClient', 'sapRouter', 'saprouterString',
                        'systemId', 'instanceNo', 'httpsPort', 'appServer',
                        'destination', 'mode', 'description'):
                if key in data and data[key] is not None:
                    source['config'][key] = data[key]
            
            # If sapHost or apiEndpoint updated, sync both
            if data.get('apiEndpoint') and not data.get('sapHost'):
                source['config']['sapHost'] = data['apiEndpoint']
            elif data.get('sapHost') and not data.get('apiEndpoint'):
                source['config']['apiEndpoint'] = data['sapHost']
                
            # If username or clientId updated, sync both
            if data.get('username') and not data.get('clientId'):
                source['config']['clientId'] = data['username']
            elif data.get('clientId') and not data.get('username'):
                source['config']['username'] = data['clientId']
            
            # Only update secret/password if provided with a non-empty value
            secret_val = data.get('clientSecret') or data.get('password')
            if secret_val:
                source['config']['clientSecret'] = secret_val
                source['config']['password'] = secret_val
            
            sources[i] = source
            _save_sources(sources)
            
            # Remove sensitive data from response
            response = source.copy()
            response['config'] = {k: v for k, v in source['config'].items() if k not in ('clientSecret', 'password')}
            return response
    
    return None


def delete_source(source_id: str) -> bool:
    """
    Delete a source configuration
    
    Args:
        source_id: Source ID
        
    Returns:
        True if deleted, False if not found
    """
    sources = _load_sources()
    original_length = len(sources)
    
    sources = [s for s in sources if s.get('id') != source_id]
    
    if len(sources) < original_length:
        _save_sources(sources)
        return True
    
    return False


def update_source_status(source_id: str, status: str) -> bool:
    """
    Update source connection status
    
    Args:
        source_id: Source ID
        status: New status (connected, disconnected, error)
        
    Returns:
        True if updated
    """
    sources = _load_sources()
    
    for source in sources:
        if source.get('id') == source_id:
            source['status'] = status
            _save_sources(sources)
            return True
    
    return False


def update_last_sync(source_id: str) -> bool:
    """
    Update last sync timestamp for a source
    
    Args:
        source_id: Source ID
        
    Returns:
        True if updated
    """
    sources = _load_sources()
    
    for source in sources:
        if source.get('id') == source_id:
            source['lastSync'] = datetime.now().isoformat()
            _save_sources(sources)
            return True
    
    return False


def test_connection(source_id: str) -> Dict:
    """
    Test connection for a source
    
    Args:
        source_id: Source ID
        
    Returns:
        Connection test result
    """
    from services.calm_service import CALMService
    from services.btp_service import BTPService
    
    source = get_source(source_id)
    if not source:
        return {'success': False, 'error': 'Source not found'}
    
    if source['type'] == 'CALM':
        try:
            service = CALMService(source.get('config', {}))
            service.test_connection()
            
            update_source_status(source_id, 'connected')
            return {'success': True, 'message': 'Connection successful'}
                
        except Exception as e:
            update_source_status(source_id, 'error')
            return {'success': False, 'error': str(e)}
            
    elif source['type'] == 'BTP':
        try:
            service = BTPService(source.get('config', {}))
            service.test_connection()
            
            update_source_status(source_id, 'connected')
            return {'success': True, 'message': 'Connection successful'}
                
        except Exception as e:
            update_source_status(source_id, 'error')
            return {'success': False, 'error': str(e)}
            
    elif source['type'] in ('SAP_ADT', 'SAP_ADT_MCP'):
        try:
            from services.sap_adt_service import DirectADTClient
            config = source.get('config', {})
            client = DirectADTClient(
                api_endpoint=config.get('apiEndpoint') or config.get('sapHost', ''),
                client=config.get('sapClient', '300'),
                username=config.get('clientId') or config.get('username', ''),
                password=config.get('clientSecret') or config.get('password', ''),
                sap_router=config.get('sapRouter') or config.get('saprouterString') or config.get('routerString', '')
            )
            success = client.connect()
            if success:
                update_source_status(source_id, 'connected')
                return {'success': True, 'message': f'Connection successful to {client.host}!'}
            else:
                update_source_status(source_id, 'error')
                return {'success': False, 'error': f'Failed to authenticate with SAP system at {client.host}'}
        except Exception as e:
            update_source_status(source_id, 'error')
            return {'success': False, 'error': str(e)}
    
    # For other source types
    return {'success': False, 'error': f'Source type {source["type"]} not yet implemented'}
