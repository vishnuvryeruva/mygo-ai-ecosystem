from services.sap_adt_mcp_service import ADTMCPRouter
import xml.etree.ElementTree as ET

router = ADTMCPRouter.from_source_config()
dc = router._adt.direct_client
dc.connect()

url = f"{dc.base_url}/repository/informationsystem/search"
headers = {
    "X-CSRF-Token": dc.csrf_token,
    "Accept": "application/xml, text/xml, */*"
}

for q in ["*COMMON*", "*CUSTOM*", "ZCOMMON*", "ZCUSTOM*", "Z*COMMON*", "Z*CUSTOM*", "Z*PROG*"]:
    params = {"operation": "quickSearch", "query": q, "maxResults": 15}
    res = dc.session.get(url, params=params, headers=headers)
    if res.status_code == 200:
        root = ET.fromstring(res.text)
        objs = [f"{o.get('{http://www.sap.com/adt/core}name')} ({o.get('{http://www.sap.com/adt/core}type')}) in {o.get('{http://www.sap.com/adt/core}packageName')}"
                for o in root.findall(".//{http://www.sap.com/adt/core}objectReference")]
        print(f"Query: {q} -> Found {len(objs)}")
        for o in objs[:5]:
            print("  ", o)
    else:
        print(f"Query: {q} -> Error {res.status_code}")
