import json
import urllib.request
import urllib.error

# Assuming backend is running on port 5000
try:
    # First get sources
    req = urllib.request.Request('http://localhost:5000/api/sources')
    with urllib.request.urlopen(req) as response:
        sources_data = json.loads(response.read().decode())
        sources = sources_data.get('sources', [])
        
    calm_source = next((s for s in sources if s['type'] == 'CALM'), None)
    if not calm_source:
        print("No CALM source found")
        exit(1)
        
    source_id = calm_source['id']
    print(f"Found CALM source: {source_id}")
    
    # Get projects to find the exact project ID
    req = urllib.request.Request(f'http://localhost:5000/api/calm/{source_id}/projects')
    with urllib.request.urlopen(req) as response:
        projects_data = json.loads(response.read().decode())
        projects = projects_data.get('projects', [])
        
    env_project = next((p for p in projects if 'Demo Environement' in p.get('name', '') or 'Cloud ALM Demo Environment' in p.get('name', '')), None)
    
    if not env_project:
        # Just use the first one if we can't find the specific one
        env_project = projects[0] if projects else None
        
    if not env_project:
        print("No projects found")
        exit(1)
        
    project_id = env_project['id']
    print(f"Testing with project: {env_project.get('name')} ({project_id})")
    
    # Get documents
    url = f'http://localhost:5000/api/calm/{source_id}/documents?projectId={project_id}'
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        docs_data = json.loads(response.read().decode())
        docs = docs_data.get('documents', [])
        
    print(f"Found {len(docs)} documents.")
    if docs:
        print("\nRaw structure of the first document:")
        print(json.dumps(docs[0], indent=2))
        
        print("\nNames mapping of first 5 documents:")
        for i, d in enumerate(docs[:5]):
            print(f"{i+1}. id={d.get('id', d.get('uuid'))}, title={d.get('title')}, name={d.get('name')}, originalName={d.get('originalName')}, fileName={d.get('fileName')}")

except urllib.error.URLError as e:
    print(f"Error connecting to backend: {e}")
except json.JSONDecodeError as e:
    print(f"Error parsing JSON: {e}")
except Exception as e:
    import traceback
    traceback.print_exc()
