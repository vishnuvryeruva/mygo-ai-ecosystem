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

# Root nodestructure returns all root packages!
req_url = f"{dc.base_url}/repository/nodestructure"
xml_body = """<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA></DATA></asx:values></asx:abap>"""
res = dc.session.post(req_url, data=xml_body, headers=headers)
root = ET.fromstring(res.text)

z_packages = []
all_packages = []
for node in root.findall(".//SEU_ADT_REPOSITORY_OBJ_NODE"):
    name = node.findtext("OBJECT_NAME") or ""
    typ = node.findtext("OBJECT_TYPE") or ""
    all_packages.append(name)
    if name.startswith("Z") or "COMMON" in name.upper() or "CUSTOM" in name.upper():
        z_packages.append((name, typ))

print(f"Total root packages in SAP system: {len(all_packages)}")
print(f"Packages matching Z* or COMMON/CUSTOM ({len(z_packages)}):")
for p in z_packages:
    print(" ", p)
