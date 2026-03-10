from services.openai_service import OpenAIService
from openpyxl import Workbook
from docx import Document
import io
import json
import re

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
            # For SAP Cloud ALM format, use structured prompt
            if format_type == 'calm':
                user_prompt = f"""Generate {test_type} test cases for the following code in a structured format suitable for SAP Cloud ALM:

```abap
{code}
```

For each test case, provide:
1. Test Case Title (brief, descriptive)
2. Test Activities (logical groupings of test steps)
   - Each activity should have a title and sequence number
   - Each activity contains multiple test actions
3. Test Actions (specific steps within an activity)
   - Action title (what to do)
   - Action description (detailed instructions)
   - Expected result (what should happen) - THIS IS MANDATORY, NEVER LEAVE IT EMPTY
   - Sequence number
   - Whether evidence is required (true/false)

IMPORTANT: Every test action MUST have an expected result. The expected result should clearly describe what should happen after performing the action.

Generate at least 3-5 comprehensive test cases covering positive scenarios, negative scenarios, and edge cases.

Format your response as a clear, structured list that can be parsed into JSON.

Example format:
Test Case 1: Validate User Login
Activity: Login Process
  Step 1: Enter valid username
    Expected Result: Username field accepts input and displays entered text
  Step 2: Enter valid password
    Expected Result: Password field accepts input and displays masked characters
  Step 3: Click login button
    Expected Result: User is successfully logged in and redirected to dashboard"""
            else:
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
        elif format_type == 'calm':
            return self._parse_to_calm_format(test_cases)
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
    
    def _parse_to_calm_format(self, test_cases_text):
        """
        Parse AI-generated test cases into SAP Cloud ALM format.
        Returns a list of test case objects ready for Cloud ALM API.
        """
        test_cases = []
        
        # Try to parse structured format from AI response
        # Split by test case markers
        lines = test_cases_text.split('\n')
        current_test_case = None
        current_activity = None
        current_action = None
        activity_sequence = 0
        action_sequence = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            # Detect test case title (e.g., "Test Case 1:", "## Test Case:", etc.)
            if re.match(r'^(Test Case|TC|##+\s*Test)', line, re.IGNORECASE):
                # Save previous test case
                if current_test_case and current_activity:
                    if current_action:
                        current_activity['toActions'].append(current_action)
                        current_action = None
                    current_test_case['toActivities'].append(current_activity)
                    test_cases.append(current_test_case)
                
                # Start new test case
                title = re.sub(r'^(Test Case|TC|##+\s*Test\s*Case)\s*\d*[:\-]?\s*', '', line, flags=re.IGNORECASE).strip()
                if not title:
                    title = f"Test Case {len(test_cases) + 1}"
                
                current_test_case = {
                    'title': title,
                    'toActivities': []
                }
                current_activity = None
                current_action = None
                activity_sequence = 0
                action_sequence = 0
            
            # Detect activity (e.g., "Activity:", "Test Activity:", etc.)
            elif current_test_case and re.match(r'^(Activity|Test Activity|Scenario)[:\-]', line, re.IGNORECASE):
                # Save previous activity
                if current_activity:
                    if current_action:
                        current_activity['toActions'].append(current_action)
                        current_action = None
                    current_test_case['toActivities'].append(current_activity)
                
                # Start new activity
                activity_sequence += 1
                title = re.sub(r'^(Activity|Test Activity|Scenario)[:\-]\s*', '', line, flags=re.IGNORECASE).strip()
                if not title:
                    title = f"Test Activity {activity_sequence}"
                
                current_activity = {
                    'title': title,
                    'sequence': activity_sequence,
                    'isInScope': True,
                    'toActions': []
                }
                action_sequence = 0
            
            # Detect action/step
            elif current_test_case and re.match(r'^(Step|Action|\d+\.)\s*', line, re.IGNORECASE):
                # Save previous action
                if current_activity and current_action:
                    current_activity['toActions'].append(current_action)
                
                # Create default activity if none exists
                if not current_activity:
                    activity_sequence += 1
                    current_activity = {
                        'title': 'Test Execution',
                        'sequence': activity_sequence,
                        'isInScope': True,
                        'toActions': []
                    }
                
                # Start new action
                action_sequence += 1
                title = re.sub(r'^(Step|Action|\d+\.)\s*', '', line, flags=re.IGNORECASE).strip()
                
                current_action = {
                    'title': title[:100] if len(title) > 100 else title,
                    'description': title,
                    'expectedResult': '',
                    'sequence': action_sequence,
                    'isEvidenceRequired': False
                }
            
            # Detect expected result
            elif current_action and re.match(r'^(Expected|Result|Expected Result)[:\-]', line, re.IGNORECASE):
                result = re.sub(r'^(Expected|Result|Expected Result)[:\-]\s*', '', line, flags=re.IGNORECASE).strip()
                current_action['expectedResult'] = result
            
            # Add to current action description
            elif current_action and not re.match(r'^(Test Case|Activity|Step|Action)', line, re.IGNORECASE):
                if current_action['description']:
                    current_action['description'] += ' ' + line
                else:
                    current_action['description'] = line
        
        # Save last test case
        if current_test_case:
            if current_activity:
                if current_action:
                    current_activity['toActions'].append(current_action)
                current_test_case['toActivities'].append(current_activity)
            if current_test_case['toActivities']:
                test_cases.append(current_test_case)
        
        # If parsing failed, create a single test case with the entire content
        if not test_cases:
            test_cases = [{
                'title': 'Generated Test Case',
                'toActivities': [{
                    'title': 'Test Execution',
                    'sequence': 1,
                    'isInScope': True,
                    'toActions': [{
                        'title': 'Execute Test',
                        'description': test_cases_text[:500],
                        'expectedResult': 'Test should pass successfully',
                        'sequence': 1,
                        'isEvidenceRequired': False
                    }]
                }]
            }]
        
        # Validate and ensure all actions have non-empty expected results
        for test_case in test_cases:
            for activity in test_case.get('toActivities', []):
                for action in activity.get('toActions', []):
                    if not action.get('expectedResult') or not action['expectedResult'].strip():
                        # Generate a default expected result based on the action title/description
                        action_desc = action.get('title', action.get('description', 'Action'))
                        action['expectedResult'] = f"Action '{action_desc}' should complete successfully"
        
        return test_cases

