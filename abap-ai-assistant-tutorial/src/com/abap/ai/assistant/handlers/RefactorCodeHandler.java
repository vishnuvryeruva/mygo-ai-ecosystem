package com.abap.ai.assistant.handlers;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.jface.dialogs.IDialogConstants;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.jface.text.BadLocationException;
import org.eclipse.jface.text.IDocument;
import org.eclipse.jface.text.ITextSelection;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Shell;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.handlers.HandlerUtil;
import org.eclipse.ui.texteditor.ITextEditor;

import com.abap.ai.assistant.ai.OpenAIService;
import com.abap.ai.assistant.ui.RefactorDialog;

/**
 * Handler for refactoring selected ABAP code using AI
 */
public class RefactorCodeHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        ISelection selection = HandlerUtil.getCurrentSelection(event);
        IEditorPart editor = HandlerUtil.getActiveEditor(event);
        
        if (!(editor instanceof ITextEditor)) {
            MessageDialog.openWarning(
                HandlerUtil.getActiveShell(event),
                "Not Supported",
                "Refactoring is only supported in text editors."
            );
            return null;
        }
        
        ITextEditor textEditor = (ITextEditor) editor;
        
        if (selection instanceof ITextSelection) {
            ITextSelection textSelection = (ITextSelection) selection;
            String selectedText = textSelection.getText();
            
            if (selectedText == null || selectedText.trim().isEmpty()) {
                MessageDialog.openWarning(
                    HandlerUtil.getActiveShell(event),
                    "No Selection",
                    "Please select some code to refactor."
                );
                return null;
            }
            
            final int offset = textSelection.getOffset();
            final int length = textSelection.getLength();
            
            Shell shell = HandlerUtil.getActiveShell(event);
            
            // Show processing message in a separate thread
            new Thread(() -> {
                try {
                    // Show "please wait" message
                    Display.getDefault().asyncExec(() -> {
                        MessageDialog.openInformation(
                            shell,
                            "Processing",
                            "Refactoring code using AI... This may take a few seconds."
                        );
                    });
                    
                    // Get refactored code from AI
                    String refactoredCode = refactorCode(selectedText);
                    
                    // Show refactor dialog in UI thread
                    Display.getDefault().asyncExec(() -> {
                        RefactorDialog dialog = new RefactorDialog(
                            shell,
                            selectedText,
                            refactoredCode
                        );
                        
                        int result = dialog.open();
                        
                        if (result == IDialogConstants.OK_ID) {
                            // User accepted - replace the code
                            String finalCode = dialog.getRefactoredCode();
                            replaceText(textEditor, offset, length, finalCode);
                        }
                        // If cancelled, do nothing
                    });
                    
                } catch (Exception e) {
                    Display.getDefault().asyncExec(() -> {
                        MessageDialog.openError(
                            shell,
                            "Error",
                            "Error refactoring code: " + e.getMessage()
                        );
                    });
                    e.printStackTrace();
                }
            }).start();
            
        } else {
            MessageDialog.openWarning(
                HandlerUtil.getActiveShell(event),
                "No Selection",
                "Please select some code in the editor to refactor."
            );
        }
        
        return null;
    }
    
    private String refactorCode(String code) {
        OpenAIService service = new OpenAIService();
        
        if (!service.isConfigured()) {
            return "ERROR: OpenAI API key not configured.\n\n" +
                   "Please configure your OpenAI API key in:\n" +
                   "Preferences > ABAP AI Assistant";
        }
        
        return service.refactorCode(code);
    }
    
    private void replaceText(final ITextEditor editor, final int offset, final int length, final String newText) {
        // Ensure we're in the UI thread
        Display.getDefault().syncExec(() -> {
            try {
                IDocument document = editor.getDocumentProvider().getDocument(editor.getEditorInput());
                
                if (document == null) {
                    MessageDialog.openError(
                        editor.getSite().getShell(),
                        "Error",
                        "Could not access document."
                    );
                    return;
                }
                
                // Replace the text
                document.replace(offset, length, newText);
                
                // Mark editor as dirty so user knows to save
                editor.setFocus();
                
            } catch (BadLocationException e) {
                MessageDialog.openError(
                    editor.getSite().getShell(),
                    "Error",
                    "Could not replace text at the specified location: " + e.getMessage()
                );
                e.printStackTrace();
            } catch (Exception e) {
                MessageDialog.openError(
                    editor.getSite().getShell(),
                    "Error",
                    "Unexpected error replacing text: " + e.getMessage()
                );
                e.printStackTrace();
            }
        });
    }
}

curl --location 'http://api-ifsp-sit.sf.global/openapi/api/dispatch' \
--header 'msgType: ICES_PRINT_ORDER' \
--header 'appKey: c4d93a2fc10442d19cc5edc146ab64bf' \
--header 'token: auth_8c93158e-8001-4790-92ca-de8aacb91473_1763060649623' \
--header 'timestamp: 1699901715000' \
--header 'nonce: 123456789' \
--header 'signature: YOUR_GENERATED_SIGNATURE' \
--header 'lang: en' \
--header 'Content-Type: application/json' \
--data '{
  "printWaybillNoDtoList": [
    {
      "waybillNo": "SF1234567890",
      "documentType": "1"
    }
  ],
  "apiUsername": "YOUR_CUSTOMER_CODE",
  "printPicking": false,
  "onePdf": true,
  "fileFormat": "PDF"
}'



72df9058ccb66f6b565f5ec59c70a3dc