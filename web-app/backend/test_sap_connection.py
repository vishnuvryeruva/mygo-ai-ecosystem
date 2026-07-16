"""
Simple verification script for Direct SAP ADT Client.
Run with: python backend/test_sap_connection.py
"""

import os
import sys

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.sap_adt_service import DirectADTClient


def main():
    print("=== Direct SAP ADT Connection Verification ===")
    
    # Read settings from env or prompt
    host = os.getenv("SAP_HOST") or input("Enter SAP Host (e.g. sapdev.company.com): ").strip()
    port = os.getenv("SAP_PORT") or input("Enter SAP ADT Port (default 443): ").strip() or "443"
    client_id = os.getenv("SAP_CLIENT") or input("Enter SAP Client (default 100): ").strip() or "100"
    username = os.getenv("SAP_USER") or input("Enter SAP Username: ").strip()
    password = os.getenv("SAP_PASSWORD") or input("Enter SAP Password: ").strip()
    
    api_endpoint = f"{host}:{port}"
    print(f"\nAttempting to connect to: {api_endpoint} (Client {client_id}) as user {username}...")
    
    try:
        client = DirectADTClient(
            api_endpoint=api_endpoint,
            client=client_id,
            username=username,
            password=password
        )
        
        success = client.connect()
        if success:
            print("\n✅ CONNECTION SUCCESSFUL!")
            print(f"Acquired CSRF Token: {client.csrf_token}")
            
            # Ask if user wants to fetch an object code
            object_name = input("\nEnter name of a class or program to fetch (or press Enter to skip): ").strip()
            if object_name:
                print(f"Fetching source for {object_name}...")
                if object_name.upper().startswith(('ZCL_', 'CL_')):
                    code = client.fetch_abap_class_code(object_name)
                else:
                    code = client.fetch_abap_program_code(object_name)
                    
                if code:
                    print("\n✅ SOURCE FETCH SUCCESSFUL!")
                    print("--- Source Preview (first 15 lines) ---")
                    lines = code.splitlines()
                    for line in lines[:15]:
                        print(line)
                    print(f"... and {len(lines) - 15} more lines.")
                else:
                    print(f"❌ Failed to fetch code for {object_name}. Verify it exists.")
        else:
            print("\n❌ CONNECTION FAILED: Server returned unsuccessful auth status.")
            
    except Exception as e:
        print(f"\n❌ ERROR OCCURRED: {e}")


if __name__ == "__main__":
    main()
