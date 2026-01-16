package com.abap.ai.assistant.services;

import java.util.List;

import org.eclipse.core.resources.IFile;
import org.eclipse.ui.IWorkbenchPage;
import org.eclipse.ui.PartInitException;
import org.eclipse.ui.PlatformUI;

import com.abap.ai.assistant.model.CodeSuggestion;
import com.abap.ai.assistant.views.AISuggestionsView;

/**
 * Central service for managing AI suggestions display
 * Coordinates between the analysis process and the custom view
 */
public class SuggestionsManager {
    
    private static SuggestionsManager instance;
    
    private SuggestionsManager() {
        // Private constructor for singleton
    }
    
    /**
     * Get singleton instance
     */
    public static synchronized SuggestionsManager getInstance() {
        if (instance == null) {
            instance = new SuggestionsManager();
        }
        return instance;
    }
    
    /**
     * Display suggestions in the custom AI Suggestions view
     */
    public void displaySuggestions(List<CodeSuggestion> suggestions, IFile file) {
        PlatformUI.getWorkbench().getDisplay().asyncExec(() -> {
            try {
                AISuggestionsView view = getOrCreateView();
                if (view != null) {
                    view.addSuggestions(suggestions, file);
                }
            } catch (Exception e) {
                System.err.println("Error displaying suggestions in view: " + e.getMessage());
                e.printStackTrace();
            }
        });
    }
    
    /**
     * Clear suggestions for a specific file
     */
    public void clearSuggestionsForFile(IFile file) {
        PlatformUI.getWorkbench().getDisplay().asyncExec(() -> {
            try {
                AISuggestionsView view = AISuggestionsView.getInstance();
                if (view != null) {
                    view.clearSuggestionsForFile(file);
                }
            } catch (Exception e) {
                System.err.println("Error clearing suggestions for file: " + e.getMessage());
                e.printStackTrace();
            }
        });
    }
    
    /**
     * Clear all suggestions
     */
    public void clearAllSuggestions() {
        PlatformUI.getWorkbench().getDisplay().asyncExec(() -> {
            try {
                AISuggestionsView view = AISuggestionsView.getInstance();
                if (view != null) {
                    view.clearSuggestions();
                }
            } catch (Exception e) {
                System.err.println("Error clearing all suggestions: " + e.getMessage());
                e.printStackTrace();
            }
        });
    }
    
    /**
     * Get existing view or create/show it if it doesn't exist
     */
    private AISuggestionsView getOrCreateView() {
        try {
            // First try to get existing view
            AISuggestionsView view = AISuggestionsView.getInstance();
            if (view != null) {
                return view;
            }
            
            // If view doesn't exist, create it
            IWorkbenchPage page = PlatformUI.getWorkbench()
                    .getActiveWorkbenchWindow()
                    .getActivePage();
            
            if (page != null) {
                view = (AISuggestionsView) page.showView(AISuggestionsView.ID);
                return view;
            }
            
        } catch (PartInitException e) {
            System.err.println("Failed to create AI Suggestions view: " + e.getMessage());
            e.printStackTrace();
        } catch (Exception e) {
            System.err.println("Unexpected error getting AI Suggestions view: " + e.getMessage());
            e.printStackTrace();
        }
        
        return null;
    }
    
    /**
     * Show the AI Suggestions view (bring it to front)
     */
    public void showSuggestionsView() {
        PlatformUI.getWorkbench().getDisplay().asyncExec(() -> {
            try {
                getOrCreateView();
            } catch (Exception e) {
                System.err.println("Error showing suggestions view: " + e.getMessage());
                e.printStackTrace();
            }
        });
    }
}
