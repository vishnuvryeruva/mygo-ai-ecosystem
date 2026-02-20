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
    
    new_source = {
        'id': str(uuid.uuid4()),
        'name': data.get('name', 'New Source'),
        'type': data.get('type', 'CALM'),
        'status': 'disconnected',
        'lastSync': None,
        'createdAt': datetime.now().isoformat(),
        'config': {
            'apiEndpoint': data.get('apiEndpoint', ''),
            'tokenUrl': data.get('tokenUrl', ''),
            'clientId': data.get('clientId', ''),
            'clientSecret': data.get('clientSecret', '')
        }
    }
    
    sources.append(new_source)
    _save_sources(sources)
    
    # Remove sensitive data from response
    response = new_source.copy()
    response['config'] = {k: v for k, v in new_source['config'].items() if k != 'clientSecret'}
    
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
            source['name'] = data.get('name', source['name'])
            source['type'] = data.get('type', source['type'])
            
            if 'config' not in source:
                source['config'] = {}
            
            source['config']['apiEndpoint'] = data.get('apiEndpoint', source['config'].get('apiEndpoint', ''))
            source['config']['tokenUrl'] = data.get('tokenUrl', source['config'].get('tokenUrl', ''))
            source['config']['clientId'] = data.get('clientId', source['config'].get('clientId', ''))
            
            # Only update secret if provided
            if data.get('clientSecret'):
                source['config']['clientSecret'] = data['clientSecret']
            
            sources[i] = source
            _save_sources(sources)
            
            # Remove sensitive data from response
            response = source.copy()
            response['config'] = {k: v for k, v in source['config'].items() if k != 'clientSecret'}
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
    
    # For other source types
    return {'success': False, 'error': f'Source type {source["type"]} not yet implemented'}
