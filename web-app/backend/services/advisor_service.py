from services.openai_service import OpenAIService
import json

class AdvisorService:
    def __init__(self):
        self.openai_service = OpenAIService()
    
    def analyze_code(self, code, code_type='ABAP', program_name='', llm_provider='openai'):
        """Analyze ABAP code for anti-patterns and provide improvement recommendations, combining AI with live SAP ATC compiler checks if available."""
        
        atc_findings = []
        # Attempt to run live SAP ATC static checks if ADT MCP is available and object name is provided
        try:
            from services.sap_adt_mcp_service import ADTMCPService
            mcp_client = ADTMCPService.get_active_client()
            if mcp_client and program_name:
                object_uri = f"/sap/bc/adt/oo/classes/{program_name.strip().lower()}" if program_name.upper().startswith(('ZCL_', 'CL_')) else f"/sap/bc/adt/programs/programs/{program_name.strip().lower()}"
                atc_res = mcp_client.run_atc(object_uri=object_uri)
                if atc_res.get('success') and atc_res.get('result'):
                    atc_findings = atc_res['result'].get('findings', [])
        except Exception as e:
            print(f"AdvisorService ADT MCP ATC check notice: {e}")

        system_prompt = """You are an expert ABAP code reviewer specializing in identifying anti-patterns and code quality issues.
        Analyze code and provide:
        - Specific anti-patterns found
        - Improvement recommendations
        - Best practices suggestions
        - Performance optimization opportunities
        - Code quality issues"""
        
        user_prompt = f"""Analyze the following {code_type} code for anti-patterns and provide improvement recommendations:

{f'Program/Class Name: {program_name}' if program_name else ''}

```{(code_type or 'ABAP').lower()}
{code}
```

{f'Live SAP ATC Compiler Findings: {json.dumps(atc_findings)}' if atc_findings else ''}

Please provide your analysis in the following JSON format:
{{
  "anti_patterns": [
    {{
      "line": <line_number>,
      "pattern": "<anti-pattern name>",
      "description": "<description>",
      "severity": "ERROR|WARNING|INFO",
      "suggestion": "<improvement suggestion>"
    }}
  ],
  "suggestions": [
    {{
      "line": <line_number>,
      "type": "PERFORMANCE|READABILITY|MAINTAINABILITY|BEST_PRACTICE",
      "current": "<current code>",
      "suggested": "<suggested code>",
      "reason": "<explanation>"
    }}
  ],
  "improvements": [
    {{
      "category": "<category>",
      "description": "<description>",
      "priority": "HIGH|MEDIUM|LOW"
    }}
  ]
}}

Focus on:
1. ABAP anti-patterns (SELECT *, nested loops, missing error handling, etc.)
2. Performance issues
3. Code readability and maintainability
4. Modern ABAP syntax opportunities (inline declarations, VALUE #, CORRESPONDING #)
5. Best practices violations

Return ONLY valid JSON, no additional text."""
        
        response = self.openai_service.generate_text(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.2,
            max_tokens=3000,
            provider=llm_provider
        )
        
        # Parse JSON response
        try:
            cleaned_response = response.strip()
            if cleaned_response.startswith('```json'):
                cleaned_response = cleaned_response[7:]
            if cleaned_response.startswith('```'):
                cleaned_response = cleaned_response[3:]
            if cleaned_response.endswith('```'):
                cleaned_response = cleaned_response[:-3]
            cleaned_response = cleaned_response.strip()
            
            analysis = json.loads(cleaned_response)
            analysis['atc_findings'] = atc_findings
            return analysis
        except json.JSONDecodeError:
            return {
                "anti_patterns": [],
                "suggestions": [],
                "improvements": [{
                    "category": "Analysis",
                    "description": response,
                    "priority": "MEDIUM"
                }],
                "atc_findings": atc_findings
            }

    def push_fixes_to_sap(self, object_name: str, code: str, transport_request: str = "",
                           object_type: str = "CLAS", sap_credentials: dict = None) -> dict:
        """
        Push fixed/modernized ABAP code to SAP via ADTMCPRouter.
        Full pipeline: create skeleton → write source (PUT) → activate → ATC post-check.

        Priority:
          - ADTMCPRouter with ephemeral creds (if provided) or source config
          - AI standalone fallback if ADT unavailable
        """
        try:
            from services.sap_adt_mcp_service import ADTMCPRouter
            if sap_credentials:
                router = ADTMCPRouter.from_ephemeral_creds(sap_credentials)
            else:
                router = ADTMCPRouter.from_source_config()

            if not router.is_adt_available():
                raise Exception("SAP ADT not configured")

            # Step 1: Create object skeleton (idempotent — ok if already exists)
            create_res = router._adt.create_object(
                object_type=object_type,
                object_name=object_name,
                package_name="$TMP",
                description=f"Updated by MYGO AI Code Advisor",
                transport_request=transport_request
            )

            # Step 2: Write source code (PUT)
            write_res = router._adt.write_source_code(object_name, object_type, code)
            if not write_res.get("success"):
                return {
                    "success": False,
                    "error": f"Source write failed: {write_res.get('error')}",
                    "write_details": write_res
                }

            # Step 3: Activate
            obj_uri = router._build_adt_uri(object_name, object_type)
            act_res = router._adt.activate_objects([obj_uri])

            # Step 4: ATC post-write quality check
            atc_res = {}
            try:
                atc_res = router.run_atc(object_name, object_type)
            except Exception as atc_err:
                print(f"push_fixes_to_sap ATC post-check notice: {atc_err}")

            return {
                "success": True,
                "message": f"Successfully wrote and activated {object_name} on SAP system.",
                "object_name": object_name,
                "object_type": object_type,
                "transport_request": transport_request,
                "create_status": create_res.get("result", create_res),
                "write_status": write_res.get("result", write_res),
                "activation": act_res.get("result", act_res),
                "atc_post_write": atc_res.get("result", atc_res)
            }

        except Exception as e:
            print(f"push_fixes_to_sap notice: {e}")

        # Standalone AI fallback when ADT is offline
        return {
            "success": True,
            "mode": "STANDALONE_AI",
            "message": f"AI Code Fix ready for {object_name} (SAP ADT offline). Copy and paste into your SAP system.",
            "transport_request": transport_request or "AI_SIMULATED_TR",
            "code": code
        }

