from services.openai_service import OpenAIService
from docx import Document
import io
from services.markdown_utils import markdown_to_plain_text

class SpecService:
    def __init__(self):
        self.openai_service = OpenAIService()
    
    def generate_spec(self, spec_type, requirements, format_type='docx', custom_prompt=None, llm_provider='openai'):
        """Generate functional or technical specification document"""
        
        # Use custom prompt if provided, otherwise load from config
        if custom_prompt:
            system_prompt = custom_prompt
        else:
            try:
                from config.prompts import get_prompt
                prompt_key = f'spec_{spec_type}'
                system_prompt = get_prompt(prompt_key, 'system')
                user_template = get_prompt(prompt_key, 'user_template')
                
                if not system_prompt:
                    # Fallback to default
                    system_prompt = f"""You are an expert SAP consultant specializing in {spec_type} specifications.
                    Create comprehensive, well-structured {spec_type} specification documents."""
            except Exception as e:
                print(f"Error loading prompts from config: {e}")
                system_prompt = f"""You are an expert SAP consultant specializing in {spec_type} specifications.
                Create comprehensive, well-structured {spec_type} specification documents that include:
                - Clear requirements
                - Detailed descriptions
                - Technical/Functional details
                - Acceptance criteria
                - Dependencies and constraints"""
        
        # Check if we have a template to use
        try:
            from config.prompts import get_prompt
            prompt_key = f'spec_{spec_type}'
            user_template = get_prompt(prompt_key, 'user_template')
            if user_template:
                user_prompt = user_template.format(requirements=requirements)
            else:
                raise ValueError("No template found")
        except Exception:
            user_prompt = f"""Generate a {spec_type} specification document based on the following requirements:

{requirements}

Please create a complete specification document with:
1. Executive Summary
2. Objectives
3. Requirements (detailed)
4. Technical/Functional Design
5. Data Model (if applicable)
6. Interfaces (if applicable)
7. Security Considerations
8. Testing Requirements
9. Acceptance Criteria
10. Dependencies and Constraints

Format the output in a clear, professional manner suitable for a Word document."""
        
        spec_content = self.openai_service.generate_text(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.4,
            max_tokens=3000,
            provider=llm_provider
        )
        
        if format_type == 'docx':
            return self._create_docx(spec_content, spec_type)
        elif format_type in ('text', 'preview'):
            # Preview/upload flows need clean text without markdown markers.
            return markdown_to_plain_text(spec_content)
        else:
            return spec_content
    
    def _create_docx(self, content, spec_type):
        """Create a DOCX document from content with proper markdown formatting"""
        from services.markdown_utils import convert_markdown_to_docx
        
        doc = Document()
        
        # Convert markdown content to Word document with proper formatting
        title = f'{spec_type.capitalize()} Specification'
        convert_markdown_to_docx(doc, content, title=title)
        
        # Save to bytes
        doc_bytes = io.BytesIO()
        doc.save(doc_bytes)
        doc_bytes.seek(0)
        
        return doc_bytes.getvalue()

    def generate_rap_cap_app(self, app_name: str, requirements: str, package_name: str = "$TMP", llm_provider: str = 'openai') -> dict:
        """Generate RAP (RESTful Application Programming model) or CAP application artifacts with AI + direct SAP ADT MCP push capability."""
        system_prompt = """You are an expert SAP RAP and CAP application architect.
        Generate complete RAP package specifications including:
        1. Database Table (DDLS)
        2. Root View Entity (CDS View Entity)
        3. Projection View
        4. Behavior Definition (BDEF)
        5. Service Definition (SRVD)
        6. Service Binding (SRVB)
        
        Return JSON with keys:
        {
          "app_name": "<app_name>",
          "package": "<package>",
          "artifacts": {
             "database_table": "<code for DDLS>",
             "root_cds_view": "<code for CDS>",
             "projection_view": "<code for projection>",
             "behavior_definition": "<code for BDEF>",
             "service_definition": "<code for SRVD>",
             "service_binding": "<code for SRVB>"
          },
          "deployment_steps": ["<step 1>", "<step 2>"]
        }"""

        user_prompt = f"""Generate full RAP/CAP application artifacts for requirements:
App Name: {app_name}
Target Package: {package_name}
Requirements: {requirements}

Return ONLY valid JSON."""

        response = self.openai_service.generate_text(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.2,
            max_tokens=3500,
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
            
            # Check if ADT MCP generators can be invoked directly
            try:
                from services.sap_adt_mcp_service import ADTMCPService
                mcp_client = ADTMCPService.get_active_client()
                if mcp_client:
                    generators_res = mcp_client.list_generators()
                    result['available_sap_generators'] = generators_res.get('result')
            except Exception as ge:
                print(f"RAP generation generator check notice: {ge}")

            return result
        except Exception as e:
            return {
                "app_name": app_name,
                "package": package_name,
                "artifacts": {},
                "deployment_steps": [],
                "error": str(e)
            }

    def deploy_rap_artifacts_to_sap(self, artifacts: dict, app_name: str,
                                     package_name: str = "$TMP",
                                     transport_request: str = "") -> dict:
        """
        Push all AI-generated RAP/CDS artifacts directly into SAP via ADTMCPRouter.
        Uses the create → write source → activate pipeline for each artifact.

        Args:
            artifacts:         Dict of artifact_key → ABAP/DDL source code
                               Keys: database_table, root_cds_view, projection_view,
                                     behavior_definition, service_definition, service_binding
            app_name:          Base name for the application (used to derive object names)
            package_name:      Target SAP package (default $TMP)
            transport_request: Optional transport request number

        Returns:
            {
                "success": True,
                "results": {
                    "database_table":  {"success": True, "object_name": "ZMYTABLE", ...},
                    "root_cds_view":   {"success": True, ...},
                    ...
                },
                "deployed": ["ZMYTABLE", "ZI_MYAPP", ...],
                "failed":   [...]
            }
        """
        from services.sap_adt_mcp_service import ADTMCPRouter
        router = ADTMCPRouter.from_source_config()

        if not router.is_adt_available():
            return {
                "success": False,
                "error": "SAP ADT not configured. Cannot deploy to SAP without ADT credentials.",
                "results": {}
            }

        # Mapping from artifact key → SAP object type short code
        ARTIFACT_TYPE_MAP = {
            'database_table':       'TABL',
            'root_cds_view':        'DDLS',
            'projection_view':      'DDLS',
            'behavior_definition':  'BDEF',
            'service_definition':   'SRVD',
            'service_binding':      'SRVB',
        }

        # Name suffix per artifact type
        NAME_SUFFIX_MAP = {
            'database_table':       '',
            'root_cds_view':        '_CDS',
            'projection_view':      'P_CDS',
            'behavior_definition':  '_BDEF',
            'service_definition':   '_SD',
            'service_binding':      '_SB',
        }

        base_name = app_name.strip().upper().replace(' ', '_')
        if not base_name.startswith('Z'):
            base_name = 'Z' + base_name

        results  = {}
        deployed = []
        failed   = []

        for artifact_key, obj_type in ARTIFACT_TYPE_MAP.items():
            code = artifacts.get(artifact_key)
            if not code:
                continue

            suffix  = NAME_SUFFIX_MAP.get(artifact_key, '')
            obj_name = (base_name + suffix)[:30]  # SAP name max 30 chars

            try:
                deploy_result = router.create_and_deploy(
                    object_name=obj_name,
                    object_type=obj_type,
                    source_code=code,
                    package=package_name,
                    transport=transport_request
                )
                results[artifact_key] = {**deploy_result, "object_name": obj_name}

                if deploy_result.get('success'):
                    deployed.append(obj_name)
                    print(f"[SpecService] Deployed {obj_name} ({obj_type}) to SAP")
                else:
                    failed.append({"artifact": artifact_key, "object_name": obj_name,
                                   "error": deploy_result.get('error', 'Unknown error')})
            except Exception as e:
                failed.append({"artifact": artifact_key, "object_name": obj_name, "error": str(e)})
                results[artifact_key] = {"success": False, "object_name": obj_name, "error": str(e)}

        return {
            "success": len(deployed) > 0,
            "package": package_name,
            "transport_request": transport_request,
            "results": results,
            "deployed": deployed,
            "failed": failed,
            "total_deployed": len(deployed),
            "total_failed": len(failed)
        }

    def _derive_object_name(self, artifact_key: str, app_name: str) -> str:
        """Helper: derive a valid SAP object name from artifact type and app name."""
        base = app_name.strip().upper().replace(' ', '_')
        if not base.startswith('Z'):
            base = 'Z' + base
        suffixes = {
            'database_table': '', 'root_cds_view': '_CDS',
            'projection_view': 'P_CDS', 'behavior_definition': '_BDEF',
            'service_definition': '_SD', 'service_binding': '_SB'
        }
        return (base + suffixes.get(artifact_key, ''))[:30]
