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
 * Handler for adding ABAP AI Nature to a project
 */
public class AddNatureHandler extends AbstractHandler {

    @Override
    public Object execute(ExecutionEvent event) throws ExecutionException {
        ISelection selection = HandlerUtil.getCurrentSelection(event);
        
        if (selection instanceof IStructuredSelection) {
            IStructuredSelection structuredSelection = (IStructuredSelection) selection;
            Object element = structuredSelection.getFirstElement();
            
            if (element instanceof IAdaptable) {
                IProject project = ((IAdaptable) element).getAdapter(IProject.class);
                
                if (project != null) {
                    addNature(project);
                }
            }
        }
        
        return null;
    }

    private void addNature(IProject project) {
        try {
            IProjectDescription description = project.getDescription();
            String[] natures = description.getNatureIds();
            
            // Check if nature already exists
            for (String nature : natures) {
                if (AbapNature.NATURE_ID.equals(nature)) {
                    MessageDialog.openInformation(
                        null,
                        "Already Configured",
                        "Project '" + project.getName() + "' already has ABAP AI Nature."
                    );
                    return;
                }
            }
            
            // Add the nature
            String[] newNatures = new String[natures.length + 1];
            System.arraycopy(natures, 0, newNatures, 0, natures.length);
            newNatures[natures.length] = AbapNature.NATURE_ID;
            description.setNatureIds(newNatures);
            project.setDescription(description, null);
            
            MessageDialog.openInformation(
                null,
                "Success",
                "ABAP AI Nature added to project '" + project.getName() + "'.\n\n" +
                "The project will now automatically analyze .abap files."
            );
            
        } catch (Exception e) {
            MessageDialog.openError(
                null,
                "Error",
                "Failed to add ABAP AI Nature: " + e.getMessage()
            );
            e.printStackTrace();
        }
    }
}

