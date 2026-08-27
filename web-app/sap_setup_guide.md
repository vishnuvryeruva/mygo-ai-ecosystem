# SAP ADT Integration Setup & Authorization Guide

This document contains step-by-step instructions for the **SAP Basis Administrator / ABAP Lead** to enable ABAP Development Tools (ADT) REST services inside SAP, assign necessary developer authorization roles, and provide the connection details required to integrate with MYGO AI.

---

## Part 1: SAP System Configuration (To Be Completed in SAP)

### Step 1: Activate ADT ICF Service Nodes in Transaction `SICF`
The SAP ADT REST services must be activated in the Internet Communication Framework (ICF) tree:

1. Log into your SAP system and open Transaction **`SICF`**.
2. Set Hierarchy Type to `SERVICE` and click **Execute (F8)**.
3. Navigate down the tree path:
   `default_host` $\rightarrow$ `sap` $\rightarrow$ `bc` $\rightarrow$ `adt`
4. Right-click on the **`adt`** node and select **Activate Service**.
5. Click **Yes** when prompted to activate all sub-nodes recursively.
6. Verify that the following sub-nodes are **Active** (text appears black, not grayed out):
   - `/sap/bc/adt/discovery` *(Discovery handshake & CSRF token)*
   - `/sap/bc/adt/oo/classes` *(ABAP Class source code & structures)*
   - `/sap/bc/adt/programs` *(ABAP Programs / Reports)*
   - `/sap/bc/adt/atc` *(ABAP Test Cockpit static checks & quickfixes)*
   - `/sap/bc/adt/abapunit` *(ABAP Unit testing execution)*
   - `/sap/bc/adt/repository` *(Object search & creation)*

---

### Step 2: Ensure HTTPS Service is Active in Transaction `SMICM`
1. Open Transaction **`SMICM`**.
2. Click **Goto** $\rightarrow$ **Services** (or press `Shift + F1`).
3. Ensure the **HTTPS** protocol service is in status `Active` and note the HTTPS port number (e.g. `44300` or `443`).

---

### Step 3: Grant User Authorization Roles in Transaction `SU01` / `PFCG`
The SAP user account provided for integration requires developer authorization for ADT REST services:

1. Assign the standard SAP role **`SAP_BC_YI_ADT_USER`** to the user in Transaction **`SU01`**.
2. If using a custom PFCG role, ensure the following authorization objects and values are granted:

| Authorization Object | Field | Value | Description |
| :--- | :--- | :--- | :--- |
| **`S_ADT_RES`** | `ADT_RES_ID` | `*` | ABAP Development Tools Services |
| | `ACTVT` | `02` (Change), `03` (Display), `16` (Execute) | Allows ADT inspection & execution |
| **`S_DEVELOP`** | `DEVCLASS`, `OBJTYPE` | `*` | Standard ABAP Workbench Access |
| **`S_TRANSPRT`** | `TTYPE` | `CUST`, `DTRA` | Transport Organizer Access |
| **`S_ATC_ADM`** | `ACTVT` | `16` (Execute) | ABAP Test Cockpit (ATC) & Quickfixes |

---

## Part 2: SAP Connection Parameters (To Be Sent Back to Requestor)

Please fill out the placeholders below and return this section to the requestor:

```txt
========================================================================
                   SAP CONNECTION DETAILS FOR MYGO AI
========================================================================

1. SAP Server Host URL / Endpoint (HTTPS):
   https://[INSERT_SAP_HOSTNAME_OR_IP]:[INSERT_HTTPS_PORT]
   (Example: https://sapdev.company.com:44300)

2. SAP Client ID:
   [INSERT_SAP_CLIENT_ID]
   (Example: 100)

3. SAP Developer Username:
   [INSERT_SAP_USERNAME]
   (Example: ABAP_DEV)

4. SAP Developer Password:
   [INSERT_SAP_PASSWORD]

========================================================================
```
