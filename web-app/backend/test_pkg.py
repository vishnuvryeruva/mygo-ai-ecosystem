from services.sap_adt_mcp_service import ADTMCPRouter

router = ADTMCPRouter.from_source_config()
dc = router._adt.direct_client
dc.connect()
print("Connected. base_url:", dc.base_url)

headers = {
    "sap-client": dc.client,
    "X-sap-client": dc.client,
    "Accept": "application/xml, text/xml, */*",
    "X-CSRF-Token": dc.csrf_token,
    "Content-Type": "application/vnd.sap.adt.repository.nodestructure.v1+xml"
}

url = f"{dc.base_url}/repository/nodestructure"

# Try different POST payloads for ZDEV and ZCOMMON
payloads = [
    # Payload 1: standard asx:abap
    """<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA><PARENT_NAME>ZDEV</PARENT_NAME><PARENT_TYPE>DEVC/K</PARENT_TYPE></DATA></asx:values></asx:abap>""",
    # Payload 2: parent_name in lowercase or different parent_type
    """<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA><PARENT_NAME>ZCOMMON</PARENT_NAME><PARENT_TYPE>DEVC/K</PARENT_TYPE></DATA></asx:values></asx:abap>""",
    # Payload 3: standard ADT node structure XML
    """<?xml version="1.0" encoding="UTF-8"?><repository:nodestructureRequest xmlns:repository="http://www.sap.com/adt/repository"><parent name="ZDEV" type="DEVC/K"/></repository:nodestructureRequest>""",
]

for i, p in enumerate(payloads):
    res = dc.session.post(url, data=p, headers=headers)
    print(f"Payload {i+1} POST status: {res.status_code}, len: {len(res.text)}")
    print("  Snippet:", res.text[:300].replace('\n', ' '))
