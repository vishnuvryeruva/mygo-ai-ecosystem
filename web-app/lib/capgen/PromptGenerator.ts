function _toKebab(s: string) {
    return s.toLowerCase().replace(/_/g, "-");
}

function _toPascalCase(s: string) {
    return s.split(/[\s_\-]+/).map(function (w) {
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    }).join("");
}

function _toScopeId(s: string) {
    return s.replace(/[^a-zA-Z0-9]/g, "_");
}

export const PromptGenerator = {
    generate: function (oData: any) {
        const aSelected = oData.selectedEntities || [];
        const oBackend = oData.backend || {};
        const oMta = oData.mta || {};
        const oServices = oData.services || {};
        const oEntityFields = oData.entityFields || {};
        const oEntityActions = oData.entityActions || {};

        const sServiceName = (oData.serviceName || "MY_ODATA_SERVICE_SRV").trim();
        const sMainEntity = aSelected[0] || "MainEntity";
        const aRelated = aSelected.slice(1);

        const sProjectName = (oMta.id || "my-cap-project").trim();
        const sFileBase = _toKebab(sServiceName);
        const sServiceFile = sFileBase + "-service";
        const sImplFile = sFileBase + "-service";
        const sCAPService = _toPascalCase(sServiceName.replace(/_SRV$/i, "").replace(/_/g, " ")) + "Service";
        const sRemoteAlias = sServiceName;
        const sLogName = sFileBase;

        const sDestName = (oBackend.destinationName || "MY_BACKEND_DEST").trim();
        const sProxyType = oBackend.proxyType || "Internet";
        const sAuthType = oBackend.authType || "BasicAuthentication";
        const sBaseUrl = (oBackend.baseUrl || "https://your-sap-backend.example.com").trim();
        const sLocationId = (oBackend.locationId || "").trim();
        const sUser = (oBackend.user || "TECHNICAL_USER").trim();
        const sPassword = (oBackend.password || "<YOUR_PASSWORD>").trim();
        const sServicePath = (oBackend.servicePath || "/sap/opu/odata/sap/" + sServiceName + "/").trim();
        const sSapClient = (oBackend.sapClient || "").trim();

        const bOnPremise = (sProxyType === "OnPremise");
        const aLines: string[] = [];
        const p = function (s?: string | number) { aLines.push(s !== undefined ? String(s) : ""); };
        const hr = function () { p("--------------------------------------------------"); };

        p("Prompt for Generating SAP CAP Application from EDMX");
        p("(Backend-Only, Production-Ready, Reusable for Any SAP OData API with Full CRUD Proxy, Security, Destination Setup, and Deployment Guidance)");
        p("");
        p("You are an expert SAP CAP and SAP BTP developer.");
        p("");
        p("Use the provided EDMX metadata to generate a complete enterprise-ready SAP CAP application for the SAP OData service:");
        p("- " + sServiceName);
        p("");
        p("Focus primarily on the main business entity:");
        p("- " + sMainEntity);
        p("");
        p("Expose it in CAP as:");
        p("- " + sMainEntity);
        p("");
        p("Also include only the direct dependent/navigation entities required for this use case, such as:");
        for (let ri = 0; ri < 5; ri++) {
            p("- " + (aRelated[ri] || "(none)"));
        }
        p("");
        p("Ignore unrelated entities unless directly navigated from " + sMainEntity + ".");
        p("");
        p("The generated project must follow SAP CAP best practices and be deployable to SAP BTP Cloud Foundry.");

        p("");
        hr();
        p("HIGH-LEVEL ARCHITECTURE REQUIREMENTS");
        hr();
        p("");
        p("The generated application must include:");
        p("");
        p("CAP Service");
        p("- Node.js CAP application exposing OData V4 services");
        p("");
        p("Database");
        p("- SQLite for local development only");
        p("- Include HANA compatibility");
        p("- Do NOT design this as a local persistence-first application if it is a remote OData consumption scenario");
        p("");
        p("Security");
        p("- Add XSUAA configuration as a project requirement");
        p("- Include scopes, role templates, and role collections guidance");
        p("- Explain clearly that XSUAA secures the CAP app, while CSRF protects backend write requests");
        p("");
        p("Connectivity");
        p("- Destination service for external SAP backend connectivity");
        p("- Connectivity service if Proxy Type is OnPremise");
        p("- Use backend destination settings supplied below");
        p("");
        p("Deployment");
        p("- Multi-Target Application (MTA) deployable to SAP BTP Cloud Foundry");

        p("");
        hr();
        p("IMPORTANT SOLUTION APPROACH");
        hr();
        p("");
        p("This is a REMOTE SERVICE CONSUMPTION CAP project.");
        p("");
        p("Do NOT build this as a local database-driven application.");
        p("");
        p("If the backend OData service supports framework-implemented CRUD operations, the CAP application must act as a FULL CRUD PROXY layer.");
        p("");
        p("The CAP app must:");
        p("1. Import the EDMX into srv/external");
        p("2. Generate the external CDS model");
        p("3. Create projection entities on top of the external service");
        p("4. Forward READ / CREATE / UPDATE / DELETE operations to backend using cds.connect.to(...)");
        p("5. Perform validations and business logic without owning persistence");
        p("6. Act purely as a proxy between the client and SAP backend");
        p("");
        p("IMPORTANT:");
        p("- Do NOT store or manage transactional data locally");
        p("- SAP backend is the source of truth");
        p("- Local SQLite is only for CAP runtime support if needed, not for primary business persistence");

        p("");
        hr();
        p("BACKEND / DESTINATION CONFIGURATION");
        hr();
        p("");
        p("Use the following backend configuration template and generate project files accordingly:");
        p("");
        p("Destination Name:");
        p("- " + sDestName);
        p("");
        p("Destination Type:");
        p("- HTTP");
        p("");
        p("Proxy Type:");
        p("- " + sProxyType);
        p("");
        p("Authentication:");
        p("- " + sAuthType);
        p("");
        p("Backend Base URL:");
        p("- " + sBaseUrl);
        p("");
        p("Location ID:");
        p("- " + (sLocationId || "(not applicable for Internet proxy)"));
        p("");
        p("Technical User:");
        p("- " + sUser);
        p("");
        p("Password:");
        p("- " + sPassword);
        p("");
        p("Service Path:");
        p("- " + sServicePath);
        p("");
        p("SAP Client (if required):");
        p("- " + (sSapClient || "(not set)"));
        p("");
        p("IMPORTANT:");
        p("Generate package.json, mta.yaml, and README so they clearly show how this destination is expected to be configured in BTP.");
        p("");
        if (bOnPremise) {
            p("Since Proxy Type is OnPremise:");
            p("- include connectivity service in mta.yaml");
            p("- include destination service in mta.yaml");
            p("- explain that Cloud Connector and Location ID must match the destination configuration");
        } else {
            p("Proxy Type is Internet:");
            p("- include destination service in mta.yaml");
            p("- connectivity service is not required");
        }

        p("");
        hr();
        p("PROJECT STRUCTURE");
        hr();
        p("");
        p(sProjectName + "/");
        p("│");
        p("├── srv/");
        p("│   ├── external/");
        p("│   │   ├── " + sServiceName + ".edmx");
        p("│   │   └── " + sServiceName + ".cds");
        p("│   ├── " + sServiceFile + ".cds");
        p("│   └── " + sImplFile + ".js");
        p("│");
        p("├── package.json");
        p("├── mta.yaml");
        p("├── xs-security.json");
        p("└── README.md");

        p("");
        hr();
        p("STEP-BY-STEP GENERATION INSTRUCTIONS");
        hr();
        p("");
        p("1. Project Initialization");
        p("");
        p("Create package.json with:");
        p("");
        p("Dependencies:");
        p("- @sap/cds");
        p("- express");
        p("- @sap/xssec");
        p("- @sap-cloud-sdk/http-client");
        p("- @sap-cloud-sdk/connectivity");
        p("- @sap-cloud-sdk/resilience");
        p("- @sap-cloud-sdk/util");
        p("");
        p("Dev Dependencies:");
        p("- @sap/cds-dk");
        p("- mbt");
        p("- rimraf");
        p("");
        p("Scripts:");
        p("  \"scripts\": {");
        p("    \"start\": \"cds-serve\",");
        p("    \"dev\": \"cds watch\",");
        p("    \"build\": \"mbt build\",");
        p("    \"clean\": \"rimraf gen mta_archives\"");
        p("  }");
        p("");
        p("Node version:");
        p("  \"engines\": {");
        p("    \"node\": \"20.x\"");
        p("  }");

        p("");
        p("2. External Service Import");
        p("");
        p("Place EDMX file at:");
        p("  srv/external/" + sServiceName + ".edmx");
        p("");
        p("Import it and generate the external CDS model.");
        p("");
        p("Use only entities from the EDMX relevant to the requested scenario.");

        p("");
        p("3. Database Model");
        p("");
        p("Keep db minimal or omit entirely.");

        p("");
        p("4. Service Layer");
        p("");
        p("File:");
        p("  srv/" + sServiceFile + ".cds");
        p("");
        p("Create service:");
        p("  service " + sCAPService);
        p("");
        p("Expose:");
        p("  - " + sMainEntity + " as projection on external " + sMainEntity);
        if (aRelated.length > 0) {
            p("");
            p("Also expose only required related entities:");
            aRelated.forEach(function (sEnt: string) { p("  - " + sEnt); });
        }

        p("");
        p("5. Service Implementation (VERY IMPORTANT)");
        p("");
        p("File:");
        p("  srv/" + sImplFile + ".js");
        p("");
        p("Generate a well-structured enterprise-style service implementation.");
        p("");
        p("ARCHITECTURE RULE:");
        p("- This is NOT a DB-owned app");
        p("- Do NOT use local CAP persistence as the main data source");
        p("- ALWAYS interact with SAP backend via remoteService");
        p("");
        p("Structure example:");
        p("  const cds = require('@sap/cds');");
        p("  const LOG = cds.log('" + sLogName + "');");
        p("");
        p("  Inside module.exports = cds.service.impl(async function () {");
        p("    - connect to remote service using cds.connect.to('" + sRemoteAlias + "')");
        p("    - destructure all exposed entities from this.entities");
        p("    - implement helper functions");
        p("    - implement validations");
        p("    - implement CRUD forwarding");
        p("    - wrap remote operations in try/catch");
        p("    - normalize and surface backend errors clearly");
        p("  })");
        p("");
        p("HELPERS");
        p("Implement helpers such as:");
        p("  - validateRequiredFields(data)");
        p("  - fetchExistingRecord(req)");
        p("  - validateUpdateAllowed(existing)");
        p("  - normalizeError(error)");
        p("  - sanitizePayload(data)");
        p("");
        p("BEFORE HANDLERS");
        p("Add before handlers for:");
        p("  - CREATE");
        p("  - UPDATE");
        p("  - DELETE");
        p("");
        p("Use them to:");
        p("  - validate required fields");
        p("  - reject invalid payloads");
        p("  - verify existence in backend");
        p("  - check business rules if needed");
        p("");
        p("CRUD HANDLERS");

        const aEntityList = aSelected.length ? aSelected : [sMainEntity];
        aEntityList.forEach(function (sEnt: string) {
            const oA = oEntityActions[sEnt] || { create: true, read: true, update: true, delete: false };
            const aOps = [];
            if (oA.read)   { aOps.push("READ"); }
            if (oA.create) { aOps.push("CREATE"); }
            if (oA.update) { aOps.push("UPDATE"); }
            if (oA.delete) { aOps.push("DELETE"); }
            if (oA.custom && oA.custom.length) { oA.custom.forEach(function(c: string){ aOps.push(c); }); }
            p("  " + sEnt + ": " + (aOps.length ? aOps.join(", ") : "READ"));
        });
        p("");
        p("Forward operations using:");
        p("  return remoteService.tx(req).run(req.query);");
        p("");
        p("If CREATE/UPDATE payload transformation is needed, build the payload explicitly and forward to the backend entity set.");
        p("");
        p("IMPORTANT:");
        p("If backend writes require CSRF token handling, generate implementation that supports it.");
        p("Do not assume XSUAA replaces CSRF.");
        p("Explain in comments:");
        p("  - XSUAA = CAP app authentication / authorization");
        p("  - CSRF  = backend anti-forgery protection for write requests");
        p("");
        p("Also add optional:");
        p("  - after handlers for logging");
        p("  - audit-style logging");
        p("  - response cleanup if required");

        p("");
        p("6. Remote Service Configuration");
        p("");
        p("In package.json under cds.requires, configure:");
        p("");
        p("  \"" + sRemoteAlias + "\": {");
        p("    \"kind\": \"odata-v2\",");
        p("    \"model\": \"srv/external/" + sServiceName + "\",");
        p("    \"credentials\": {");
        p("      \"destination\": \"" + sDestName + "\",");
        p("      \"path\": \"" + sServicePath + "\"" + (sLocationId ? "," : ""));
        if (sLocationId) { p("      \"locationId\": \"" + sLocationId + "\""); }
        p("    }");
        p("  }");
        p("");
        if (sSapClient) {
            p("Also add sap-client header to the destination or credentials:");
            p("  \"headers\": { \"sap-client\": \"" + sSapClient + "\" }");
            p("");
        }
        if (bOnPremise) {
            p("OnPremise connectivity notes:");
            p("  - Cloud Connector must be configured with Location ID: " + (sLocationId || "(set in destination)"));
            p("  - Destination must have ProxyType: OnPremise");
            p("  - connectivity service must be bound in mta.yaml");
            p("");
        }

        p("7. Security (Required)");
        p("");
        p("Create xs-security.json with:");
        p("  - one scope for read access  : $XSAPPNAME." + _toScopeId(sProjectName) + ".Display");
        p("  - one scope for write access : $XSAPPNAME." + _toScopeId(sProjectName) + ".Write");
        p("  - role templates");
        p("  - sample role collection guidance");
        p("");
        p("Protect service endpoints appropriately.");

        p("");
        p("8. MTA Configuration");
        p("");
        p("Create mta.yaml with:");
        p("  Modules:");
        p("  - CAP service module  (type: nodejs, path: gen/srv)");
        p("");
        p("  Resources:");
        p("  - XSUAA service       (xsuaa / " + (oServices.xsSecurityPlan || "application") + ")");
        p("  - Destination service (destination / lite)");
        if (bOnPremise || oServices.connectivity) {
            p("  - Connectivity service (connectivity / lite)  [required for OnPremise]");
        }
        p("");
        p("  MTA ID      : " + sProjectName);
        p("  MTA Version : " + (oMta.version || "0.0.1"));
        p("  Memory      : " + (oMta.memory || 256) + "M");
        p("  Disk Quota  : " + (oMta.diskQuota || 1024) + "M");
        p("");
        p("Ensure the CAP srv module is bound correctly to all required services.");

        p("");
        p("9. BAS / Cloud Foundry Readiness");
        p("");
        p("Project must support:");
        p("  - npm install");
        p("  - cds watch");
        p("  - cds build");
        p("  - mbt build");
        p("  - cf deploy");

        p("");
        p("10. README");
        p("");
        p("Include:");
        p("  - project overview");
        p("  - imported service name  : " + sServiceName);
        p("  - main entity name       : " + sMainEntity);
        p("  - backend destination configuration steps");
        if (bOnPremise) {
            p("  - Cloud Connector note for on-premise: Location ID = " + (sLocationId || "(configure in BTP destination)"));
        }
        p("  - how to test GET, POST, PATCH, DELETE");
        p("  - how to obtain OAuth token from XSUAA");
        p("  - reminder that backend writes may require CSRF token handling");

        p("");
        hr();
        p("DEPLOYMENT STEPS");
        hr();
        p("");
        p("  cds build --production");
        p("  mbt build");
        p("  cf deploy mta_archives/" + sProjectName + ".mtar");

        p("");
        hr();
        p("VALIDATION CHECKLIST");
        hr();
        p("");
        p("1. CAP service runs locally");
        p("2. EDMX imported correctly");
        p("3. CAP READ works");
        p("4. CAP CREATE works");
        p("5. CAP UPDATE works");
        p("6. CAP DELETE works");
        p("7. Destination works");
        p("8. XSUAA works");
        p("9. CF deployment succeeds");

        if (aSelected.length > 0) {
            p("");
            hr();
            p("ENTITY & FIELD REFERENCE (from EDMX wizard selections)");
            hr();
            p("");
            aSelected.forEach(function (sEnt: string) {
                const oFields = (oEntityFields[sEnt] || {});
                const aFields = (oFields.selected && oFields.selected.length)
                                ? oFields.selected
                                : (oFields.available || []);
                const oActions = oEntityActions[sEnt] || {};
                const aOps = [];
                if (oActions.create) { aOps.push("Create"); }
                if (oActions.read)   { aOps.push("Read"); }
                if (oActions.update) { aOps.push("Update"); }
                if (oActions.delete) { aOps.push("Delete"); }
                if (oActions.custom && oActions.custom.length) {
                    oActions.custom.forEach(function(c: string){ aOps.push(c); });
                }

                p("Entity: " + sEnt);
                p("  Operations : " + (aOps.length ? aOps.join(", ") : "Read"));
                if (aFields.length > 0) {
                    p("  Fields     :");
                    aFields.forEach(function (f: any) {
                        p("    - " + f.name + " (" + f.type + ")" + (f.key ? " [KEY]" : ""));
                    });
                } else {
                    p("  Fields     : (all fields – no selection made)");
                }
                p("");
            });
        }

        p("");
        hr();
        p("FINAL TASK");
        hr();
        p("");
        p("Generate the full project including:");
        p("  - folder structure");
        p("  - all files");
        p("  - service implementation");
        p("  - CDS service definition");
        p("  - package.json");
        p("  - mta.yaml");
        p("  - xs-security.json");
        p("  - README");
        p("  - sample GET, POST, PATCH, DELETE calls");
        p("");
        p("Ensure the solution is backend-only, production-ready, reusable, and follows CAP best practices.");
        p("");
        p("Do not hardcode " + sMainEntity + "-specific values unless they are explicitly supplied in the placeholders.");
        p("");
        p("-- Generated by CAP Prompt Generator on " + new Date().toLocaleString() + " --");

        return aLines.join("\n");
    }
};
