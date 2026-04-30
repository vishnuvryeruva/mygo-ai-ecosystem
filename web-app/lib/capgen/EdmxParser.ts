export const EdmxParser = {
    parse: function (sXml: string) {
        let oParser;
        if (typeof window !== 'undefined' && window.DOMParser) {
            oParser = new window.DOMParser();
        } else {
            // fallback if needed
            return { entities: [], entityTypes: {}, functionImports: [], namespace: "" };
        }
        const oDoc = oParser.parseFromString(sXml, "application/xml");
        const oError = oDoc.querySelector("parsererror");
        if (oError) {
            throw new Error("Invalid XML: " + oError.textContent);
        }

        const oResult: any = {
            entities: [],
            entityTypes: {},
            functionImports: [],
            namespace: ""
        };

        const oSchema = oDoc.querySelector("Schema");
        if (oSchema) {
            oResult.namespace = oSchema.getAttribute("Namespace") || "";
        }

        const aEntityTypes = Array.from(oDoc.querySelectorAll("EntityType"));
        aEntityTypes.forEach(function (oET: any) {
            const sName = oET.getAttribute("Name");
            if (!sName) { return; }

            const aProperties: any[] = [];
            Array.from(oET.querySelectorAll("Property")).forEach(function (oProp: any) {
                aProperties.push({
                    name: oProp.getAttribute("Name"),
                    type: oProp.getAttribute("Type") || "Edm.String",
                    nullable: oProp.getAttribute("Nullable") !== "false",
                    key: false
                });
            });

            Array.from(oET.querySelectorAll("Key > PropertyRef")).forEach(function (oRef: any) {
                const sKeyName = oRef.getAttribute("Name");
                aProperties.forEach(function (p: any) {
                    if (p.name === sKeyName) { p.key = true; }
                });
            });

            const aNavProps: any[] = [];
            Array.from(oET.querySelectorAll("NavigationProperty")).forEach(function (oNav: any) {
                aNavProps.push({
                    name: oNav.getAttribute("Name"),
                    type: oNav.getAttribute("Type") || oNav.getAttribute("ToRole") || ""
                });
            });

            oResult.entityTypes[sName] = {
                properties: aProperties,
                navigationProperties: aNavProps
            };
        });

        const aEntitySets = Array.from(oDoc.querySelectorAll("EntitySet"));
        aEntitySets.forEach(function (oES: any) {
            const sSetName = oES.getAttribute("Name");
            const sTypeName = (oES.getAttribute("EntityType") || "").replace(/^.*\./, "");
            if (sSetName) {
                oResult.entities.push({
                    setName: sSetName,
                    typeName: sTypeName
                });
            }
        });

        if (oResult.entities.length === 0) {
            Object.keys(oResult.entityTypes).forEach(function (sTypeName) {
                oResult.entities.push({
                    setName: sTypeName + "Set",
                    typeName: sTypeName
                });
            });
        }

        const aFunctionImports = Array.from(oDoc.querySelectorAll("FunctionImport, Action"));
        aFunctionImports.forEach(function (oFI: any) {
            const sName = oFI.getAttribute("Name");
            if (sName) {
                oResult.functionImports.push(sName);
            }
        });

        return oResult;
    }
};
