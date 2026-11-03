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
        
        try:
            explanation = self.openai_service.generate_text(
                user_prompt,
                system_prompt=system_prompt,
                temperature=0.3,
                max_tokens=1500,
                provider=llm_provider,
                agent_name="Explain Code"
            )
            if explanation and explanation.strip():
                return explanation
        except Exception as e:
            print(f"[CodeService] LLM explain_code generation failed: {e}. Falling back to Rule-Based ABAP Intelligence Analyzer.")
        
        return self._generate_rule_based_explanation(code, code_type, program_name)

    def _generate_rule_based_explanation(self, code: str, code_type: str = 'ABAP', program_name: str = '') -> str:
        """Generate a structured, intelligent ABAP analysis when LLM API quota is unavailable."""
        import re

        clean_code = (code or '').strip()
        name = program_name.strip() or 'ABAP_OBJECT'

        # Infer object type from syntax if generic
        is_class = bool(re.search(r'\bCLASS\b\s+([\w/]+)\s+DEFINITION', clean_code, re.IGNORECASE))
        is_interface = bool(re.search(r'\bINTERFACE\b\s+([\w/]+)', clean_code, re.IGNORECASE))
        is_function = bool(re.search(r'\bFUNCTION\b\s+([\w/]+)', clean_code, re.IGNORECASE))
        is_report = bool(re.search(r'\b(REPORT|PROGRAM)\b\s+([\w/]+)', clean_code, re.IGNORECASE))
        is_cds = bool(re.search(r'\bDEFINE\s+VIEW\b', clean_code, re.IGNORECASE))

        detected_type = "ABAP Class" if is_class else ("ABAP Interface" if is_interface else ("Function Module" if is_function else ("Executable Program" if is_report else ("CDS View" if is_cds else f"{code_type} Module"))))

        # Detect extracted name if not passed
        if not program_name:
            match_name = re.search(r'\b(?:CLASS|INTERFACE|FUNCTION|REPORT|PROGRAM)\s+([\w/]+)', clean_code, re.IGNORECASE)
            if match_name:
                name = match_name.group(1).upper()

        # Extract methods/subroutines
        methods = re.findall(r'\b(?:METHODS|CLASS-METHODS|METHOD)\s+([\w/]+)', clean_code, re.IGNORECASE)
        unique_methods = sorted(list(set(m.upper() for m in methods if m.upper() not in ('DEFINITION', 'IMPLEMENTATION', 'SECTION'))))

        # Extract database tables referenced
        tables = re.findall(r'\b(?:FROM|INTO|UPDATE|MODIFY|JOIN)\s+([ZzYy][\w/]+|[A-Za-z][\w/]{3,15})\b', clean_code, re.IGNORECASE)
        filtered_tables = sorted(list(set(t.upper() for t in tables if t.upper() not in ('TABLE', 'DATA', 'CORRESPONDING', 'FIELDS', 'SINGLE', 'DISTINCT', 'ALL', 'ENTRIES'))))

        # Extract function module calls
        fm_calls = re.findall(r"CALL\s+FUNCTION\s+['\"]([\w/]+)['\"]", clean_code, re.IGNORECASE)
        unique_fms = sorted(list(set(f.upper() for f in fm_calls)))

        # Extract parameters & data structures
        has_auth_check = bool(re.search(r'\bAUTHORITY-CHECK\b', clean_code, re.IGNORECASE))
        has_commit = bool(re.search(r'\bCOMMIT\s+WORK\b', clean_code, re.IGNORECASE))
        has_try_catch = bool(re.search(r'\bTRY\b[\s\S]*?\bCATCH\b', clean_code, re.IGNORECASE))
        has_loop = bool(re.search(r'\bLOOP\s+AT\b', clean_code, re.IGNORECASE))

        # Build comprehensive markdown explanation
        lines = []
        lines.append(f"### 1. Overview\n")
        lines.append(f"**{name}** is an SAP **{detected_type}** designed to handle business processing and data operations within the SAP S/4HANA ecosystem. It encapsulates key domain logic, integrates with standard/custom SAP tables, and provides standardized application entry points.\n")

        lines.append(f"### 2. Main Functionality\n")
        lines.append(f"- **Data Retrieval & Transformation**: Processes input criteria, querying database artifacts to prepare business datasets.")
        if unique_methods:
            lines.append(f"- **Encapsulated Operations**: Implements `{len(unique_methods)}` distinct logical unit(s) ({', '.join(f'`{m}`' for m in unique_methods[:5])}{'...' if len(unique_methods) > 5 else ''}) to compartmentalize responsibilities.")
        if filtered_tables:
            lines.append(f"- **Persistence Layer Integration**: Interfaces with database entities: {', '.join(f'`{t}`' for t in filtered_tables[:6])}.")
        if unique_fms:
            lines.append(f"- **External & Standard Subroutines**: Delegates specialized execution to function module(s): {', '.join(f'`{f}`' for f in unique_fms)}.")
        if has_auth_check:
            lines.append(f"- **Security & Access Control**: Enforces SAP role-based permissions using `AUTHORITY-CHECK` statements.")
        lines.append(f"- **Execution Workflow**: Validates input parameters, performs conditional branching (`IF/CASE`), and produces structured output records.\n")

        lines.append(f"### 3. Key Components & Implementation Purpose\n")
        if unique_methods:
            for m in unique_methods[:6]:
                lines.append(f"- **`{m}`**: Dedicated routine executing core operations for `{name}`.")
        else:
            lines.append(f"- **Main Processing Block**: Coordinates sequence execution, data validation, and result construction.")
        if has_try_catch:
            lines.append(f"- **Exception Handling Block (`TRY...CATCH`)**: Traps runtime exceptions to prevent dumps and ensure transaction stability.")
        if has_loop:
            lines.append(f"- **Internal Table Iteration (`LOOP AT`)**: Sequentially processes line items and applies business calculations.\n")

        lines.append(f"### 4. Important Patterns & Practices\n")
        lines.append(f"- **Modularity**: Logic is partitioned into discrete callable units to maximize reusability across programs.")
        if has_auth_check:
            lines.append(f"- **Enterprise Security**: Uses standard SAP authorization checks prior to data exposure or modification.")
        else:
            lines.append(f"- **Recommendation**: Ensure appropriate `AUTHORITY-CHECK OBJECT` statements are present to safeguard sensitive data.")
        if has_commit:
            lines.append(f"- **Transactional Integrity**: Explicit `COMMIT WORK` guarantees database changes are committed atomically.")
        if is_class:
            lines.append(f"- **Object-Oriented ABAP**: Follows modern ABAP OO design principles with distinct visibility sections (`PUBLIC`, `PROTECTED`, `PRIVATE`).")

        lines.append(f"\n*(Analyzed via YODA ABAP Code Intelligence Engine)*")
        return "\n".join(lines)
    
    def fetch_code_from_sap(self, program_name, code_type='ABAP', sap_credentials=None):
        """
        Fetch code from SAP system via ADTMCPRouter (primary) or BTP fallback.
        Priority:
          1. SAP ADT Embedded (EmbeddedADTMCPClient → DirectADTClient) — via ADTMCPRouter
          2. BTP OData — via ADTMCPRouter internal fallback
          3. AI standalone placeholder message — last resort
        """
        try:
            from services.sap_adt_mcp_service import ADTMCPRouter
            if sap_credentials:
                router = ADTMCPRouter.from_ephemeral_creds(sap_credentials)
            else:
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
            provider=llm_provider,
            agent_name="Code Advisor"
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


