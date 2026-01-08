package com.abap.ai.assistant.handlers;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IWorkspace;
import org.eclipse.core.resources.ResourcesPlugin;
import org.eclipse.jface.dialogs.MessageDialog;

/**
 * Handler for refreshing code patterns
 */
public class RefreshPatternsHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        try {
            IWorkspace workspace = ResourcesPlugin.getWorkspace();
            IProject[] projects = workspace.getRoot().getProjects();
            
            int projectCount = 0;
            for (IProject project : projects) {
                if (project.isOpen()) {
                    project.build(
                        org.eclipse.core.resources.IncrementalProjectBuilder.FULL_BUILD,
                        null
                    );
                    projectCount++;
                }
            }
            
            MessageDialog.openInformation(
                null,
                "Patterns Refreshed",
                "Code patterns refreshed for " + projectCount + " project(s).\n" +
                "All ABAP files have been re-analyzed."
            );
            
        } catch (Exception e) {
            MessageDialog.openError(
                null,
                "Refresh Error",
                "Error refreshing patterns: " + e.getMessage()
            );
            e.printStackTrace();
        }
        
        return null;
    }
}

