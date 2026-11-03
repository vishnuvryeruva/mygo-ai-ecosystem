"""
Verification script for SAP ADT Connection via BTP Cloud Connector (No VPN Required).
Run on EC2 or locally with: python test_btp_scc_connection.py
"""

import os
import sys
from dotenv import load_dotenv

# Load backend/.env
backend_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(backend_dir, '.env'))

sys.path.insert(0, backend_dir)

from services.sap_adt_service import DirectADTClient


def main():
    print("=" * 70)
    print("  SAP ADT via BTP Cloud Connector Verification (NO VPN REQUIRED)")
    print("=" * 70)

    # 1. Read SAP and Proxy settings
    virtual_proto = os.getenv("SAP_VIRTUAL_PROTOCOL", "http").strip()
    virtual_host = os.getenv("SAP_VIRTUAL_HOST", "mygohanafun2").strip()
    virtual_port = os.getenv("SAP_VIRTUAL_PORT", "8000").strip()
    client_id = os.getenv("SAP_CLIENT", "300").strip()
    username = os.getenv("SAP_USERNAME", "").strip()
    password = os.getenv("SAP_PASSWORD", "").strip()

    proxy_host = os.getenv("BTP_CONNECTIVITY_HOST", "").strip()
    proxy_port = os.getenv("BTP_CONNECTIVITY_PORT", "20003").strip()
    conn_client_id = os.getenv("BTP_CONNECTIVITY_CLIENT_ID", "").strip()
    conn_client_secret = os.getenv("BTP_CONNECTIVITY_CLIENT_SECRET", "").strip()
    conn_token_url = os.getenv("BTP_CONNECTIVITY_TOKEN_URL", "").strip()
    scc_loc_id = os.getenv("BTP_SCC_LOCATION_ID", "").strip()

    print(f"Target Virtual Endpoint : {virtual_proto}://{virtual_host}:{virtual_port}")
    print(f"SAP Client ID           : {client_id}")
    print(f"SAP Developer Username  : {username}")
    print(f"BTP Connectivity Host   : {proxy_host or '[NOT SET]'}:{proxy_port}")
    print(f"BTP Token URL           : {conn_token_url or '[NOT SET]'}")
    print(f"BTP SCC Location ID     : {scc_loc_id or '(Default/None)'}")
    print("-" * 70)

    if not proxy_host or not conn_client_id or not conn_client_secret or not conn_token_url:
        print("\n⚠️  BTP Connectivity Service credentials are not yet populated in backend/.env!")
        print("Please fill in the following placeholders in backend/.env:")
        print("  - BTP_CONNECTIVITY_HOST")
        print("  - BTP_CONNECTIVITY_PORT (typically 20003 or 443)")
        print("  - BTP_CONNECTIVITY_CLIENT_ID")
        print("  - BTP_CONNECTIVITY_CLIENT_SECRET")
        print("  - BTP_CONNECTIVITY_TOKEN_URL")
        print("\nOnce populated, re-run: python test_btp_scc_connection.py")
        return

    btp_proxy = {
        "connectivity_host": proxy_host,
        "connectivity_port": proxy_port,
        "connectivity_client_id": conn_client_id,
        "connectivity_client_secret": conn_client_secret,
        "connectivity_token_url": conn_token_url,
        "scc_location_id": scc_loc_id
    }

    target_url = f"{virtual_proto}://{virtual_host}:{virtual_port}"
    print(f"\nStep 1: Initializing ADT Client with BTP Cloud Connector Tunnel...")
    client = DirectADTClient(
        api_endpoint=target_url,
        client=client_id,
        username=username,
        password=password,
        btp_proxy_config=btp_proxy
    )

    print(f"\nStep 2: Connecting through BTP tunnel to {target_url}/sap/bc/adt/discovery ...")
    try:
        ok = client.connect()
        if ok:
            print("\n" + "=" * 70)
            print("  🎉 SUCCESS! Connected to SAP ADT through BTP Cloud Connector!")
            print("=" * 70)
            print(f"  CSRF Token Acquired : {client.csrf_token}")
            print(f"  Routing Method      : {client.routing_note}")
            print(f"  Status              : Online & Authenticated (NO VPN NEEDED!)")
            print("=" * 70)

            # Optional test code fetch
            test_obj = input("\nOptional: Enter a Class or Program name to test fetch (e.g., ZCL_TEST or press Enter to skip): ").strip()
            if test_obj:
                print(f"Fetching source code for '{test_obj}'...")
                if test_obj.upper().startswith(('ZCL_', 'CL_')):
                    code = client.fetch_abap_class_code(test_obj)
                else:
                    code = client.fetch_abap_program_code(test_obj)

                if code:
                    print("\n✅ Source code successfully retrieved!")
                    print("--- First 15 lines ---")
                    for line in code.splitlines()[:15]:
                        print(line)
                else:
                    print(f"Object '{test_obj}' not found or empty response.")
        else:
            print("\n❌ Connection returned false without exception.")
    except Exception as e:
        print(f"\n❌ Connection Error: {e}")
        print("\nTroubleshooting tips:")
        print("1. In SAP Cloud Connector (Mygo_BAS), make sure 'Resources' includes `/sap/bc/adt` with 'Path and all sub-paths'.")
        print("2. Ensure the Virtual Host matches exactly what you configured in SCC (e.g. 'mygohanafun2:8000').")
        print("3. Check that BTP Connectivity Service instance credentials are valid.")


if __name__ == "__main__":
    main()
