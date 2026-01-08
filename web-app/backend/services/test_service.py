from services.openai_service import OpenAIService
from openpyxl import Workbook
from docx import Document
import io

class TestService:
    def __init__(self):
        self.openai_service = OpenAIService()
    
    def generate_test_cases(self, code, test_type='manual', format_type='excel', custom_prompt=None):
        """Generate manual test cases or ABAP Unit test skeletons"""
        
        # Use custom prompt if provided, otherwise load from config
        if custom_prompt:
            system_prompt = custom_prompt
        else:
            try:
                from config.prompts import get_prompt
                prompt_key = f'test_{test_type}'
                system_prompt = get_prompt(prompt_key, 'system')
                
                if not system_prompt:
                    # Fallback to default
                    system_prompt = f"""You are an expert SAP test engineer specializing in {test_type} test case creation.
                    Create comprehensive, well-structured test cases."""
            except Exception as e:
                print(f"Error loading prompts from config: {e}")
                system_prompt = f"""You are an expert SAP test engineer specializing in {test_type} test case creation.
                Create comprehensive, well-structured test cases that cover:
                - Positive test scenarios
                - Negative test scenarios
                - Edge cases
                - Boundary conditions
                - Error handling"""
        
        # Check if we have a template to use
        try:
            from config.prompts import get_prompt
            prompt_key = f'test_{test_type}'
            user_template = get_prompt(prompt_key, 'user_template')
            if user_template:
                user_prompt = user_template.format(code=code)
            else:
                raise ValueError("No template found")
        except:
            user_prompt = f"""Generate {test_type} test cases for the following code:

```abap
{code}
```

Please create test cases that include:
1. Test Case ID
2. Test Description
3. Preconditions
4. Test Steps
5. Expected Results
6. Actual Results (to be filled)
7. Status (Pass/Fail - to be filled)

For ABAP Unit tests, also include the test class structure with:
- Test class definition
- Test method signatures
- Test data setup
- Assertions

Generate at least 5-10 comprehensive test cases."""
        
        test_cases = self.openai_service.generate_text(
            user_prompt,
            system_prompt=system_prompt,
            temperature=0.4,
            max_tokens=3000
        )
        
        if format_type == 'excel':
            return self._create_excel(test_cases)
        elif format_type == 'word':
            return self._create_word(test_cases)
        elif format_type == 'jira':
            return self._create_jira_format(test_cases)
        else:
            return test_cases
    
    def _create_excel(self, test_cases):
        """Create Excel file with test cases"""
        wb = Workbook()
        ws = wb.active
        ws.title = "Test Cases"
        
        # Headers
        headers = ['Test Case ID', 'Description', 'Preconditions', 'Test Steps', 'Expected Results', 'Status']
        ws.append(headers)
        
        # Parse test cases and add to Excel
        # This is a simplified version - in production, you'd parse the AI response more carefully
        lines = test_cases.split('\n')
        current_row = 2
        for line in lines:
            if line.strip() and not line.startswith('#'):
                ws.append([line.strip()])
                current_row += 1
        
        # Save to bytes
        excel_bytes = io.BytesIO()
        wb.save(excel_bytes)
        excel_bytes.seek(0)
        
        return excel_bytes.getvalue()
    
    def _create_word(self, test_cases):
        """Create Word document with test cases with proper markdown formatting"""
        from services.markdown_utils import convert_markdown_to_docx
        
        doc = Document()
        
        # Convert markdown content to Word document with proper formatting
        convert_markdown_to_docx(doc, test_cases, title='Test Cases')
        
        # Save to bytes
        doc_bytes = io.BytesIO()
        doc.save(doc_bytes)
        doc_bytes.seek(0)
        
        return doc_bytes.getvalue()
    
    def _create_jira_format(self, test_cases):
        """Format test cases for Jira/Xray import"""
        # Return test cases in Jira format (JSON or CSV)
        return {
            "format": "jira",
            "test_cases": test_cases,
            "instructions": "Import this into Jira/Xray using the appropriate format"
        }

