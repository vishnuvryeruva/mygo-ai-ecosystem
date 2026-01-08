package com.abap.ai.assistant.quickfix;

import org.eclipse.core.resources.IMarker;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.ui.IMarkerResolution;
import org.eclipse.ui.IMarkerResolutionGenerator;

/**
 * Provides quick fixes for ABAP code suggestions
 */
public class AbapQuickFixProcessor implements IMarkerResolutionGenerator {

    @Override
    public IMarkerResolution[] getResolutions(IMarker marker) {
        try {
            String message = (String) marker.getAttribute(IMarker.MESSAGE);
            String detailedDesc = (String) marker.getAttribute("detailedDescription");
            
            if (message.contains("naming convention")) {
                return new IMarkerResolution[] {
                    new ShowDetailResolution(detailedDesc)
                };
            } else if (message.contains("FIELD-SYMBOL")) {
                return new IMarkerResolution[] {
                    new ShowDetailResolution(detailedDesc)
                };
            } else if (message.contains("modern method call")) {
                return new IMarkerResolution[] {
                    new ShowDetailResolution(detailedDesc)
                };
            } else {
                return new IMarkerResolution[] {
                    new ShowDetailResolution(detailedDesc)
                };
            }
        } catch (CoreException e) {
            e.printStackTrace();
        }
        
        return new IMarkerResolution[0];
    }

    /**
     * Resolution that shows detailed information
     */
    private static class ShowDetailResolution implements IMarkerResolution {
        private String detailedDescription;

        public ShowDetailResolution(String detailedDescription) {
            this.detailedDescription = detailedDescription;
        }

        @Override
        public String getLabel() {
            return "Show suggestion details";
        }

        @Override
        public void run(IMarker marker) {
            // Show detailed description in a dialog
            org.eclipse.jface.dialogs.MessageDialog.openInformation(
                null,
                "ABAP AI Assistant Suggestion",
                detailedDescription
            );
        }
    }
}

