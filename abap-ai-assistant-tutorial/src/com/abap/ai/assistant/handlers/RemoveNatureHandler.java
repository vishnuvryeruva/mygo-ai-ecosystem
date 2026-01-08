package com.abap.ai.assistant.handlers;

import org.eclipse.core.commands.AbstractHandler;
import org.eclipse.core.commands.ExecutionEvent;
import org.eclipse.core.commands.ExecutionException;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IProjectDescription;
import org.eclipse.core.runtime.IAdaptable;
import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.jface.viewers.ISelection;
import org.eclipse.jface.viewers.IStructuredSelection;
import org.eclipse.ui.handlers.HandlerUtil;

import com.abap.ai.assistant.nature.AbapNature;

/**
 * Handler for removing ABAP AI Nature from a project
 */
public class RemoveNatureHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        ISelection selection = HandlerUtil.getCurrentSelection(event);
        
        if (selection instanceof IStructuredSelection) {
            IStructuredSelection structuredSelection = (IStructuredSelection) selection;
            Object element = structuredSelection.getFirstElement();
            
            if (element instanceof IAdaptable) {
                IProject project = ((IAdaptable) element).getAdapter(IProject.class);
                
                if (project != null) {
                    removeNature(project);
                }
            }
        }
        
        return null;
    }

    private void removeNature(IProject project) {
        try {
            IProjectDescription description = project.getDescription();
            String[] natures = description.getNatureIds();
            
            // Check if nature exists
            boolean found = false;
            for (int i = 0; i < natures.length; i++) {
                if (AbapNature.NATURE_ID.equals(natures[i])) {
                    found = true;
                    // Remove the nature
                    String[] newNatures = new String[natures.length - 1];
                    System.arraycopy(natures, 0, newNatures, 0, i);
                    System.arraycopy(natures, i + 1, newNatures, i, natures.length - i - 1);
                    description.setNatureIds(newNatures);
                    project.setDescription(description, null);
                    break;
                }
            }
            
            if (found) {
                MessageDialog.openInformation(
                    null,
                    "Success",
                    "ABAP AI Nature removed from project '" + project.getName() + "'.\n\n" +
                    "The project will no longer automatically analyze .abap files."
                );
            } else {
                MessageDialog.openInformation(
                    null,
                    "Not Found",
                    "Project '" + project.getName() + "' does not have ABAP AI Nature."
                );
            }
            
        } catch (Exception e) {
            MessageDialog.openError(
                null,
                "Error",
                "Failed to remove ABAP AI Nature: " + e.getMessage()
            );
            e.printStackTrace();
        }
    }
}

