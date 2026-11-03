from services.sap_adt_mcp_service import ADTMCPRouter
router = ADTMCPRouter()
client = router._adt.client
client.connect()
url = f"{client.base_url}/repository/nodestructure"
for pkg in ['ZDEV', 'ZCOMMON', 'ZCOOMON', 'ZCUSTOM', 'ZCOSTUM', '$TMP']:
    params = {"parent_name": pkg, "parent_tech_name": pkg, "parent_type": "DEVC/K", "sap-client": client.client}
    headers = {"sap-client": client.client, "X-sap-client": client.client, "Accept": "application/xml, text/xml, */*", "X-CSRF-Token": client.csrf_token}
    res = client.session.get(url, params=params, headers=headers)
    print(pkg, "GET status:", res.status_code, "len:", len(res.text))
    if res.text:
        print("GET text snippet:", res.text[:300].replace('\n', ' '))
    # Also test POST
    post_headers = {**headers, "Content-Type": "application/vnd.sap.adt.repository.nodestructure.v1+xml"}
    xml_body = f"""<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA><PARENT_NAME>{pkg}</PARENT_NAME><PARENT_TYPE>DEVC/K</PARENT_TYPE></DATA></asx:values></asx:abap>"""
    res_post = client.session.post(url, data=xml_body, headers=post_headers)
    print(pkg, "POST status:", res_post.status_code, "len:", len(res_post.text))
    if res_post.text:
        print("POST text snippet:", res_post.text[:300].replace('\n', ' '))
    print("="*40)
