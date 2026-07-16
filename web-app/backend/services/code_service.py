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
        """Fetch code from SAP system via direct ADT client."""
        try:
            from services import source_config_service
            sources = source_config_service.list_sources()
            sap_source = next((s for s in sources if s['type'] == 'SAP_ADT'), None)
            
            if not sap_source:
                return f"No active SAP ADT configuration found in Settings."
                
            source_details = source_config_service.get_source(sap_source['id'])
            if not source_details:
                return f"SAP ADT configuration could not be loaded."
                
            config = source_details.get('config', {})
            from services.sap_adt_service import DirectADTClient
            client = DirectADTClient(
                api_endpoint=config.get('apiEndpoint', ''),
                client=config.get('sapClient', '100'),
                username=config.get('clientId', ''),
                password=config.get('clientSecret', '')
            )
            
            success = client.connect()
            if not success:
                return f"Failed to connect and authenticate against the SAP ADT system."
                
            # Heuristic to detect class vs program
            name_clean = program_name.strip().upper()
            if name_clean.startswith(('ZCL_', 'CL_')) or '==CP' in name_clean:
                # Class
                if '===' in name_clean:
                    name_clean = name_clean.split('=')[0]
                code = client.fetch_abap_class_code(name_clean)
            else:
                # Program/Include
                code = client.fetch_abap_program_code(name_clean)
                
            if not code:
                return f"Object '{program_name}' not found or has no source code on the SAP system."
                
            return code
        except Exception as e:
            return f"Error fetching code from SAP: {str(e)}"

