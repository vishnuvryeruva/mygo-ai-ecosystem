from services.btp_service import BTPService

t6_config = {
    "apiEndpoint": "https://mygo-consulting-inc-mygo-bas-4e8bz4sk-mygo-bas-btp-service-srv.cfapps.us10-001.hana.ondemand.com/odata/v4/catalog/objectsSet?$filter=Object eq 'ZABAPGIT_STANDALONE_GG'",
    "tokenUrl": "https://mygo-bas-4e8bz4sk.authentication.us10.hana.ondemand.com/oauth/token",
    "clientId": "sb-btp-service!t212186",
    "clientSecret": "8822c2b1-ad09-4c38-89e1-3dd0c3490d0f$txtY_9w5ZUAHkvZ9fgRxpMZDVfZhkgQgdmy3wfkn0Cs=",
    "authType": "OAuth 2.0"
}

srv = BTPService(t6_config, use_env_fallback=False)

try:
    print("Testing with entity_set=''")
    data = srv.fetch_data(entity_set='', top=50)
    print("Fetch Success.")
    import json
    with open('/tmp/test_empty_entityset.json', 'w') as f:
        json.dump(data, f, indent=2)
    print("Keys:", data.keys())
    if "value" in data:
        print("Value length:", len(data["value"]))
except Exception as e:
    print(f"Error: {e}")
