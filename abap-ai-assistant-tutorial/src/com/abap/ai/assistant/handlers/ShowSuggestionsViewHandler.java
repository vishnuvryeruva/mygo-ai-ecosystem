package com.abap.ai.assistant.handlers;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;

import com.abap.ai.assistant.services.SuggestionsManager;

/**
 * Handler to show the AI Suggestions view
 */
public class ShowSuggestionsViewHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        // Show the AI Suggestions view
        SuggestionsManager.getInstance().showSuggestionsView();
        return null;
    }
}
