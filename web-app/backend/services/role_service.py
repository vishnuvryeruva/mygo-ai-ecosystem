"""
Role Service
Manages user roles and permissions
"""

import os
import json
import uuid
from typing import List, Dict, Optional
from datetime import datetime

ROLES_FILE = os.path.join(os.path.dirname(__file__), '..', 'config', 'roles.json')


def _load_roles() -> List[Dict]:
    """Load roles from JSON file"""
    try:
        if os.path.exists(ROLES_FILE):
            with open(ROLES_FILE, 'r') as f:
                return json.load(f)
    except Exception as e:
        print(f"Error loading roles: {e}")
    return []


def _save_roles(roles: List[Dict]) -> bool:
    """Save roles to JSON file"""
    try:
        os.makedirs(os.path.dirname(ROLES_FILE), exist_ok=True)
        
        with open(ROLES_FILE, 'w') as f:
            json.dump(roles, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving roles: {e}")
        return False


def list_roles() -> List[Dict]:
    """
    List all roles
    
    Returns:
        List of role configurations
    """
    roles = _load_roles()
    return roles


def get_role(role_id: str) -> Optional[Dict]:
    """
    Get a specific role by ID
    
    Args:
        role_id: Role ID
        
    Returns:
        Role configuration or None
    """
    roles = _load_roles()
    
    for role in roles:
        if role.get('id') == role_id:
            return role
    
    return None


def create_role(data: Dict) -> Dict:
    """
    Create a new role
    
    Args:
        data: Role data
        
    Returns:
        Created role
    """
    roles = _load_roles()
    
    new_role = {
        'id': str(uuid.uuid4()),
        'name': data.get('name', 'New Role'),
        'permissions': data.get('permissions', ['Read']),
        'createdAt': datetime.now().isoformat()
    }
    
    roles.append(new_role)
    _save_roles(roles)
    
    return new_role


def update_role(role_id: str, data: Dict) -> Optional[Dict]:
    """
    Update an existing role
    
    Args:
        role_id: Role ID
        data: Updated role data
        
    Returns:
        Updated role or None if not found
    """
    roles = _load_roles()
    
    for i, role in enumerate(roles):
        if role.get('id') == role_id:
            role['name'] = data.get('name', role['name'])
            role['permissions'] = data.get('permissions', role['permissions'])
            role['updatedAt'] = datetime.now().isoformat()
            
            roles[i] = role
            _save_roles(roles)
            return role
    
    return None


def delete_role(role_id: str) -> bool:
    """
    Delete a role
    
    Args:
        role_id: Role ID
        
    Returns:
        True if deleted, False if not found
    """
    roles = _load_roles()
    original_length = len(roles)
    
    roles = [r for r in roles if r.get('id') != role_id]
    
    if len(roles) < original_length:
        _save_roles(roles)
        return True
    
    return False
