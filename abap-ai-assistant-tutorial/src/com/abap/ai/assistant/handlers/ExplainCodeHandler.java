package com.abap.ai.assistant.handlers;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.jface.text.ITextSelection;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Shell;
import org.eclipse.ui.IEditorInput;
import org.eclipse.ui.IEditorPart;
import org.eclipse.ui.handlers.HandlerUtil;
import org.eclipse.ui.part.FileEditorInput;

import com.abap.ai.assistant.ai.OpenAIService;
import com.abap.ai.assistant.model.ChatMessage;
import com.abap.ai.assistant.views.AISuggestionsView;

/**
 * Handler for explaining selected ABAP code using AI.
 * Shows the explanation in the AI Assistant panel instead of a popup dialog.
 */
public class ExplainCodeHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        ISelection selection = HandlerUtil.getCurrentSelection(event);
        IEditorPart editor = HandlerUtil.getActiveEditor(event);

        if (selection instanceof ITextSelection) {
            ITextSelection textSelection = (ITextSelection) selection;
            String selectedText = textSelection.getText();

            if (selectedText == null || selectedText.trim().isEmpty()) {
                MessageDialog.openWarning(
                        HandlerUtil.getActiveShell(event),
                        "No Selection",
                        "Please select some code to explain.");
                return null;
            }

            // Get the file name for context
            String fileName = getFileName(editor);

            // Show the AI panel and add user message
            Shell shell = HandlerUtil.getActiveShell(event);

            Display.getDefault().asyncExec(() -> {
                AISuggestionsView view = AISuggestionsView.showView();
                if (view != null) {
                    // Set context
                    view.setContext(fileName, selectedText);

                    // Add user's request message
                    view.addMessage(ChatMessage.userMessage("Explain this code:\n```abap\n" +
                            truncateCode(selectedText, 10) + "\n```"));

                    // Add loading message
                    ChatMessage loading = ChatMessage.loading();
                    view.addMessage(loading);

                    // Get explanation in background thread
                    new Thread(() -> {
                        String explanation = explainCode(selectedText);

                        Display.getDefault().asyncExec(() -> {
                            view.removeMessage(loading);
                            view.addMessage(ChatMessage.codeExplanation(explanation, selectedText, fileName));
                        });
                    }).start();
                }
            });

        } else {
            MessageDialog.openWarning(
                    HandlerUtil.getActiveShell(event),
                    "No Selection",
                    "Please select some code in the editor to explain.");
        }

        return null;
    }

    /**
     * Get the file name from the editor
     */
    private String getFileName(IEditorPart editor) {
        if (editor != null) {
            IEditorInput input = editor.getEditorInput();
            if (input instanceof FileEditorInput) {
                return ((FileEditorInput) input).getName();
            }
            return input.getName();
        }
        return "Unknown File";
    }

    /**
     * Truncate code for display in the user message bubble
     */
    private String truncateCode(String code, int maxLines) {
        String[] lines = code.split("\n");
        if (lines.length <= maxLines) {
            return code;
        }

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < maxLines; i++) {
            sb.append(lines[i]).append("\n");
        }
        sb.append("... (").append(lines.length - maxLines).append(" more lines)");
        return sb.toString();
    }

    /**
     * Get explanation from OpenAI service
     */
    private String explainCode(String code) {
        OpenAIService service = new OpenAIService();

        if (!service.isConfigured()) {
            return "⚠️ **OpenAI API key not configured**\n\n" +
                    "Please configure your OpenAI API key in:\n" +
                    "Preferences → ABAP AI Assistant";
        }

        return service.explainCode(code);
    }
}
