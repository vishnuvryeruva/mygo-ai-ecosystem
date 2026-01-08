package com.abap.ai.assistant.handlers;

import java.util.List;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.core.resources.IFile;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.runtime.IAdaptable;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.jface.viewers.IStructuredSelection;
import org.eclipse.ui.handlers.HandlerUtil;

import com.abap.ai.assistant.analyzer.AbapCodeAnalyzer;
import com.abap.ai.assistant.model.CodeSuggestion;
import com.abap.ai.assistant.services.SuggestionsManager;

/**
 * Handler for manual code analysis command.
 * Shows analysis results in the AI Suggestions panel.
 */
public class AnalyzeCodeHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        ISelection selection = HandlerUtil.getCurrentSelection(event);

        if (selection instanceof IStructuredSelection) {
            IStructuredSelection structuredSelection = (IStructuredSelection) selection;
            Object element = structuredSelection.getFirstElement();

            if (element instanceof IAdaptable) {
                IFile file = ((IAdaptable) element).getAdapter(IFile.class);

                if (file != null && AbapCodeAnalyzer.isAbapFile(file)) {
                    analyzeFile(file);
                } else {
                    MessageDialog.openWarning(
                            HandlerUtil.getActiveShell(event),
                            "Not an ABAP File",
                            "Please select an ABAP file to analyze.");
                }
            }
        }

        return null;
    }

    private void analyzeFile(IFile file) {
        try {
            AbapCodeAnalyzer analyzer = new AbapCodeAnalyzer();
            IProject project = file.getProject();

            // Learn patterns from project
            analyzer.learnProjectPatterns(project);

            // Analyze the file
            List<CodeSuggestion> suggestions = analyzer.analyzeSingleFile(file);

            // Display suggestions in AI panel (no popup dialog)
            SuggestionsManager.getInstance().showSuggestionsView();
            SuggestionsManager.getInstance().displaySuggestions(suggestions, file);

            // No popup dialog - everything is in the AI panel now

        } catch (Exception e) {
            MessageDialog.openError(
                    null,
                    "Analysis Error",
                    "Error analyzing file: " + e.getMessage());
            e.printStackTrace();
        }
    }
}
