from services.sap_adt_mcp_service import ADTMCPRouter
import xml.etree.ElementTree as ET

router = ADTMCPRouter.from_source_config()
dc = router._adt.direct_client
dc.connect()

res = dc.session.get(f"{dc.base_url}/discovery", headers={"X-CSRF-Token": dc.csrf_token})
root = ET.fromstring(res.text)

print("Available ADT collection links with search / repository / programs:")
for coll in root.findall(".//{http://www.w3.org/2007/app}collection"):
    href = coll.get("href")
    title = coll.findtext("{http://www.w3.org/2005/Atom}title") or ""
    if any(k in href.lower() for k in ['search', 'repos', 'pack', 'nodestr', 'prog', 'source']):
        print(f"  {href} -> {title}")
