from services.btp_service import BTPService

# Test 6 = 4ef42463-f86b-475a-aa77-758208f43b6e
# Test 8 = 5a835d4f-e950-4fb4-b98c-fdc8e39e7d14

import json
with open('config/sources.json', 'r') as f:
    sources = json.load(f)

t6 = next(s for s in sources if s['id'] == '4ef42463-f86b-475a-aa77-758208f43b6e')
t8 = next(s for s in sources if s['id'] == '5a835d4f-e950-4fb4-b98c-fdc8e39e7d14')

print(f"Test 6 apiEndpoint: {t6['config']['apiEndpoint']}")
print(f"Test 8 apiEndpoint: {t8['config']['apiEndpoint']}")

srv6 = BTPService(t6['config'], use_env_fallback=False)
srv8 = BTPService(t8['config'], use_env_fallback=False)

def test_fetch_url(srv, entity_set=None, filter_query=None, skip=None, top=None):
    if entity_set:
        base_url = srv.get_service_root()
        full_url = base_url + entity_set.lstrip('/')
    else:
        full_url = srv.api_endpoint
        
    query_params = []
    if filter_query:
        clean_filter = filter_query.replace('$filter=', '').strip()
        if clean_filter:
            encoded_filter = clean_filter.replace(' ', '%20')
            query_params.append(f"$filter={encoded_filter}")
    if skip and str(skip) != '0':
        clean_skip = str(skip).replace('$skip=', '').strip()
        query_params.append(f"$skip={clean_skip}")
    if top:
        clean_top = str(top).replace('$top=', '').strip()
        query_params.append(f"$top={clean_top}")
    if "$format=json" not in full_url:
        query_params.append("$format=json")
    if query_params:
        separator = '&' if '?' in full_url else '?'
        full_url += separator + "&".join(query_params)
    return full_url

print("\n--- Test 6 ---")
print("Root:", srv6.get_service_root())
print("Default (app.py args):", test_fetch_url(srv6, entity_set='ObjlistSet', top='50', skip='0'))

print("\n--- Test 8 ---")
print("Root:", srv8.get_service_root())
print("Default (app.py args):", test_fetch_url(srv8, entity_set='ObjlistSet', top='50', skip='0'))

