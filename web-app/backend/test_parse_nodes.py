from services.sap_adt_mcp_service import ADTMCPRouter
import xml.etree.ElementTree as ET

router = ADTMCPRouter.from_source_config()
dc = router._adt.direct_client
dc.connect()

headers = {
    "sap-client": dc.client,
    "X-sap-client": dc.client,
    "Accept": "application/xml, text/xml, */*",
    "X-CSRF-Token": dc.csrf_token,
    "Content-Type": "application/vnd.sap.adt.repository.nodestructure.v1+xml"
}

for pkg in ['ZDEV', 'ZABAP_MCP', 'Z001']:
    req_url = f"{dc.base_url}/repository/nodestructure?parent_name={pkg}&parent_type=DEVC/K&parent_tech_name={pkg}"
    xml_empty = """<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA></DATA></asx:values></asx:abap>"""
    res = dc.session.post(req_url, data=xml_empty, headers=headers)
    root = ET.fromstring(res.text)
    
    parsed = []
    for node in root.findall(".//SEU_ADT_REPOSITORY_OBJ_NODE"):
        name = node.findtext("OBJECT_NAME") or node.findtext("TECH_NAME") or ""
        raw_type = node.findtext("OBJECT_TYPE") or ""
        # Filter out folder categories like DEVC/DD or the parent package itself
        if name == pkg or not name:
            continue
        # Split type like CLAS/OC -> CLAS
        main_type = raw_type.split("/")[0] if "/" in raw_type else raw_type
        desc = node.findtext("DESCRIPTION") or ""
        parsed.append({"name": name, "type": main_type, "raw_type": raw_type, "description": desc})
        
    print(f"=== Package {pkg}: {len(parsed)} objects ===")
    for o in parsed[:10]:
        print(" ", o)
