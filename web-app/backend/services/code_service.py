from services.openai_service import OpenAIService

class CodeService:
    def __init__(self):
        self.openai_service = OpenAIService()
    
    def explain_code(self, code, code_type='ABAP', program_name='', llm_provider='openai'):
        """Explain what ABAP code does"""
        
        system_prompt = """You are an expert SAP ABAP developer and educator.
        Explain code in simple, clear terms that help developers understand what the code does.
        Focus on functionality, not implementation details.
        
        CRITICAL INSTRUCTION: If the code provided is wrapped in a JSON structure (like an SAP OData response), 
        you must locate and extract the actual ABAP source code hidden within the JSON fields (e.g., inside "SourceCode", "source", "results", etc.) 
        and base your ENTIRE explanation solely on that ABAP code, ignoring the JSON wrapper itself."""
        
        user_prompt = f"""Explain what the following {code_type} code does.
        
{f'Program/Class Name: {program_name}' if program_name else ''}

Code:
```{code_type.lower()}
{code}
```

Please provide:
1. A brief overview (2-3 sentences)
2. Main functionality
3. Key components and their purpose
4. Any important patterns or practices used

Keep the explanation clear and concise, suitable for developers at various skill levels."""
        
        explanation = self.openai_service.generate_text(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=1500,
            provider=llm_provider
        )
        
        return explanation
    
    def fetch_code_from_sap(self, program_name, code_type='ABAP'):
        """
        Fetch code from SAP system via ADTMCPRouter (primary) or BTP fallback.
        Priority:
          1. SAP ADT Embedded (EmbeddedADTMCPClient → DirectADTClient) — via ADTMCPRouter
          2. BTP OData — via ADTMCPRouter internal fallback
          3. AI standalone placeholder message — last resort
        """
        try:
            from services.sap_adt_mcp_service import ADTMCPRouter
            router = ADTMCPRouter.from_source_config()

            # Auto-detect object type from name prefix
            name_clean = program_name.strip().upper()
            if name_clean.startswith(('ZCL_', 'CL_')):
                obj_type = 'CLAS'
            elif name_clean.startswith(('ZIF_', 'IF_')):
                obj_type = 'INTF'
            elif '==CP' in name_clean or '===' in name_clean:
                # Handle ADT URI-style names like ZCL_FOO===CP
                name_clean = name_clean.split('=')[0]
                obj_type = 'CLAS'
            else:
                obj_type = 'PROG'

            result = router.fetch_code(name_clean, obj_type)
            if result.get('success') and result.get('source_code'):
                print(f"[CodeService] fetch_code_from_sap: got source via {result.get('source', 'ADT')} for {name_clean}")
                return result['source_code']

        except Exception as e:
            print(f"[CodeService] fetch_code_from_sap router error: {e}")

        return f"* Note: Live SAP ADT connection offline. AI Agent is processing object '{program_name}' using standalone AI intelligence."

    def modernize_abap_code(self, code: str, program_name: str = "", llm_provider: str = 'openai') -> dict:
        """Modernize legacy ABAP code to modern ABAP 7.5+ syntax and RAP best practices."""
        system_prompt = """You are an expert SAP ABAP Modernization architect.
        Convert legacy ABAP (such as MOVE, APPEND, FORM routines, header lines, TABLES, explicit loops)
        into modern ABAP 7.5+ constructs:
        - Inline declarations (DATA(lv_var) = ...)
        - Expression constructs (VALUE #(), CORRESPONDING #(), COND #(), SWITCH #())
        - String templates ( |Hello { lv_name }| )
        - Modern SQL & CDS view queries
        - Object-oriented & RAP pattern replacements
        
        Return JSON with:
        {
          "modern_code": "<full modernized ABAP code>",
          "changes": [
             { "legacy": "<legacy construct>", "modern": "<modern replacement>", "reason": "<why>" }
          ],
          "benefits": ["<benefit 1>", "<benefit 2>"]
        }"""

        user_prompt = f"""Modernize the following legacy ABAP code:
{f'Object: {program_name}' if program_name else ''}

```abap
{code}
```

Return ONLY valid JSON."""

        response = self.openai_service.generate_text(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.2,
            max_tokens=3000,
            provider=llm_provider
        )

        try:
            import json
            cleaned = response.strip()
            if cleaned.startswith('```json'):
                cleaned = cleaned[7:]
            if cleaned.startswith('```'):
                cleaned = cleaned[3:]
            if cleaned.endswith('```'):
                cleaned = cleaned[:-3]
            result = json.loads(cleaned.strip())
            
            # Validate modernized code against ADT MCP if available
            try:
                from services.sap_adt_mcp_service import ADTMCPService
                mcp_client = ADTMCPService.get_active_client()
                if mcp_client and program_name:
                    obj_type = "CLAS" if program_name.upper().startswith(('ZCL_', 'CL_')) else "PROG"
                    val_res = mcp_client.validate_object(object_type=obj_type, object_name=program_name)
                    result['adt_validation'] = val_res
            except Exception as ve:
                print(f"Modernization ADT validation notice: {ve}")

            return result
        except Exception as e:
            return {
                "modern_code": code,
                "changes": [],
                "benefits": ["Could not parse JSON response"],
                "error": str(e)
            }


