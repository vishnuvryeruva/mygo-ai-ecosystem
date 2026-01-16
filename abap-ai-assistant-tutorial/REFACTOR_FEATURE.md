# Refactor Code Feature

## Overview
A new "Refactor Selected Code" feature has been added to the ABAP AI Assistant plugin. This feature allows users to select code, get AI-powered refactoring suggestions, review and edit them, and then accept or reject the changes.

## How It Works

### User Workflow
1. **Select Code**: Select the ABAP code you want to refactor in the editor
2. **Right-Click**: Right-click on the selected code
3. **Choose Menu**: Select "ABAP AI Assistant" > "Refactor Selected Code"
4. **Review**: A dialog appears showing:
   - **Left Side**: Original code (read-only)
   - **Right Side**: Refactored code (editable)
5. **Edit (Optional)**: You can modify the refactored code before accepting
6. **Accept or Reject**:
   - Click **Accept**: Replaces your selected code with the refactored version
   - Click **Reject**: Discards the refactoring and keeps original code

### What Gets Refactored
The AI will:
- Use modern ABAP syntax where applicable
- Improve code readability and maintainability
- Apply ABAP best practices
- Optimize performance where possible
- Add helpful comments for complex logic
- **Keep the same functionality** (doesn't change what the code does)

## Implementation Details

### Files Created

#### 1. **RefactorCodeHandler.java**
- Handles the "Refactor Code" command
- Gets selected text from the editor
- Calls OpenAI API to get refactored code
- Opens the RefactorDialog for user review
- Replaces the text if user accepts

Key Features:
- Works with text selections (via `ITextSelection`)
- Runs AI processing in background thread
- Uses document API to replace text safely
- Handles errors gracefully

#### 2. **RefactorDialog.java** (New UI Component)
- Custom dialog with side-by-side comparison
- **Left Panel**: Shows original code (read-only, gray background)
- **Right Panel**: Shows refactored code (editable, white background)
- Resizable and maximizable dialog (900x600 default)
- Two buttons: "Accept" and "Reject"

Key Features:
- Uses `SashForm` for resizable split view
- Editable text area for refactored code
- Returns the (possibly edited) refactored code when accepted

#### 3. **OpenAIService.java** (Updated)
Added three new methods:
- `refactorCode(String code)`: Main method for refactoring
- `buildRefactorPrompt(String code)`: Creates the AI prompt with refactoring rules
- `extractRefactoredCode(String response)`: Parses response and removes markdown

#### 4. **plugin.xml** (Updated)
- Added command: `com.abap.ai.assistant.refactorCode`
- Registered handler: `RefactorCodeHandler`
- Added menu item: "Refactor Selected Code"

### New Package: `com.abap.ai.assistant.ui`
Created a new package for UI components like dialogs.

## User Experience

### Dialog Layout
```
+------------------------------------------------------------------+
|  Review the refactored code below. You can edit it before...    |
+------------------------------------------------------------------+
|                                                                  |
| Original Code:              |  Refactored Code (Editable):      |
| (read-only, gray)           |  (editable, white)                |
|                             |                                   |
| DATA: lv_value TYPE string. |  " Improved variable naming       |
| lv_value = 'test'.          |  DATA lv_result TYPE string.      |
|                             |  lv_result = 'test'.              |
|                             |                                   |
+------------------------------------------------------------------+
|                                       [Accept]  [Reject]         |
+------------------------------------------------------------------+
```

### Editing Before Accepting
- Users can modify the refactored code directly in the right panel
- Click anywhere in the text and type to edit
- Can copy/paste, undo/redo as normal
- Whatever is in the right panel when you click "Accept" will replace the original

## Error Handling

The feature handles:
- **No Selection**: Warning to select code first
- **Not a Text Editor**: Warning if not in a text editor
- **API Key Not Configured**: Error message with instructions
- **Network Errors**: Clear error messages
- **Text Replacement Errors**: Shows error if document update fails

## Key Design Decisions

### Side-by-Side Comparison
- Users can see both versions at once
- Makes it easy to verify changes
- Original code always visible for reference

### Editable Refactored Code
- Users have full control before accepting
- Can combine AI suggestions with their own edits
- Provides flexibility and trust in the tool

### Safe Text Replacement
- Uses Eclipse's document API for safe text replacement
- Works with any text editor
- Respects undo/redo history

## Differences from Other Features

| Feature | Explain Code | Refactor Code (NEW) |
|---------|-------------|---------------------|
| **Input** | Selected text | Selected text |
| **Output** | Plain text explanation | Refactored ABAP code |
| **User Action** | Read only | Review, edit, accept/reject |
| **Editor Change** | No | Yes (if accepted) |
| **Dialog Type** | Simple message box | Custom side-by-side dialog |

## Testing the Feature

1. Open an ABAP file in Eclipse
2. Select some code (e.g., a method or loop)
3. Right-click > "ABAP AI Assistant" > "Refactor Selected Code"
4. Wait for the dialog to appear
5. Review the refactored code on the right
6. Optionally edit it further
7. Click "Accept" to replace or "Reject" to cancel

## Example Refactoring

**Before (Original):**
```abap
DATA: lv_cnt TYPE i.
lv_cnt = 0.
LOOP AT gt_items INTO DATA(ls_item).
  IF ls_item-status = 'A'.
    lv_cnt = lv_cnt + 1.
  ENDIF.
ENDLOOP.
```

**After (Refactored by AI):**
```abap
" Count active items using modern ABAP syntax
DATA(lv_active_count) = REDUCE i( 
  INIT count = 0
  FOR item IN gt_items
  WHERE ( status = 'A' )
  NEXT count = count + 1 
).
```

## Future Enhancements (Optional)

Potential improvements:
- Add "Diff View" to highlight exact changes
- Provide refactoring explanation alongside code
- Allow multiple refactoring iterations
- Save refactoring history
- Custom refactoring rules in preferences

## Conclusion

The "Refactor Code" feature provides an interactive way for users to improve their ABAP code with AI assistance while maintaining full control over the final result. The side-by-side comparison and editable preview ensure users can trust and customize the refactoring before applying it.

