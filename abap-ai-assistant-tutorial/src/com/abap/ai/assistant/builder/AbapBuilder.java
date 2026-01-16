package com.abap.ai.assistant.builder;

import java.util.List;
import java.util.Map;

import org.eclipse.core.resources.IFile;
import org.eclipse.core.resources.IMarker;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.resources.IResourceDelta;
import org.eclipse.core.resources.IResourceDeltaVisitor;
import org.eclipse.core.resources.IResourceVisitor;
import org.eclipse.core.resources.IncrementalProjectBuilder;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.IProgressMonitor;

import com.abap.ai.assistant.Activator;
import com.abap.ai.assistant.analyzer.AbapCodeAnalyzer;
import com.abap.ai.assistant.model.CodeSuggestion;
import com.abap.ai.assistant.services.SuggestionsManager;

/**
 * Builder that automatically analyzes ABAP files when they change
 */
public class AbapBuilder extends IncrementalProjectBuilder {

    public static final String BUILDER_ID = "com.abap.ai.assistant.abapBuilder";
    public static final String MARKER_TYPE = "com.abap.ai.assistant.abapProblem";

    private AbapCodeAnalyzer analyzer = new AbapCodeAnalyzer();

    @Override
    protected IProject[] build(int kind, Map<String, String> args, IProgressMonitor monitor)
            throws CoreException {
        
        if (kind == FULL_BUILD) {
            fullBuild(monitor);
        } else {
            IResourceDelta delta = getDelta(getProject());
            if (delta == null) {
                fullBuild(monitor);
            } else {
                incrementalBuild(delta, monitor);
            }
        }
        return null;
    }

    protected void fullBuild(final IProgressMonitor monitor) throws CoreException {
        try {
            // First, learn patterns from all files
            analyzer.learnProjectPatterns(getProject());
            
            // Then analyze each file
            getProject().accept(new IResourceVisitor() {
                public boolean visit(IResource resource) {
                    analyzeResource(resource);
                    return true;
                }
            });
        } catch (CoreException e) {
            e.printStackTrace();
        }
    }

    protected void incrementalBuild(IResourceDelta delta, IProgressMonitor monitor)
            throws CoreException {
        // Learn patterns from project first
        analyzer.learnProjectPatterns(getProject());
        
        // Then check delta for changes
        delta.accept(new IResourceDeltaVisitor() {
            public boolean visit(IResourceDelta delta) throws CoreException {
                IResource resource = delta.getResource();
                switch (delta.getKind()) {
                    case IResourceDelta.ADDED:
                    case IResourceDelta.CHANGED:
                        analyzeResource(resource);
                        break;
                    case IResourceDelta.REMOVED:
                        // Remove markers
                        break;
                }
                return true;
            }
        });
    }

    private void analyzeResource(IResource resource) {
        if (resource instanceof IFile && AbapCodeAnalyzer.isAbapFile((IFile) resource)) {
            IFile file = (IFile) resource;
            // Clear old markers (still needed for cleanup)
            deleteMarkers(file);
            checkAbapFile(file);
        }
    }

    private void checkAbapFile(IFile file) {
        try {
            System.out.println("=== ABAP AI Assistant: Analyzing file: " + file.getName() + " ===");
            
            // Clear any existing suggestions for this file first
            SuggestionsManager.getInstance().clearSuggestionsForFile(file);
            
            // Analyze the file
            List<CodeSuggestion> suggestions = analyzer.analyzeSingleFile(file);
            
            System.out.println("Found " + suggestions.size() + " suggestions for " + file.getName());
            
            // Display suggestions in custom view instead of Problems tab
            if (!suggestions.isEmpty()) {
                SuggestionsManager.getInstance().displaySuggestions(suggestions, file);
                
                // Log suggestions for debugging
                for (CodeSuggestion suggestion : suggestions) {
                    System.out.println("  - Line " + suggestion.getLineNumber() + ": " + 
                        suggestion.getMessage());
                }
            }
            
        } catch (CoreException e) {
            System.err.println("Error analyzing ABAP file: " + e.getMessage());
            e.printStackTrace();
        } catch (Exception e) {
            System.err.println("Unexpected error: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    private void addTestMarker(IFile file, String message) {
        try {
            IMarker marker = file.createMarker(MARKER_TYPE);
            marker.setAttribute(IMarker.MESSAGE, message);
            marker.setAttribute(IMarker.LINE_NUMBER, 1);
            marker.setAttribute(IMarker.SEVERITY, IMarker.SEVERITY_INFO);
            System.out.println("Created test marker: " + message);
        } catch (CoreException e) {
            System.err.println("Failed to create test marker: " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void addMarker(IFile file, CodeSuggestion suggestion) {
        try {
            IMarker marker = file.createMarker(MARKER_TYPE);
            marker.setAttribute(IMarker.MESSAGE, suggestion.getMessage());
            marker.setAttribute(IMarker.LINE_NUMBER, suggestion.getLineNumber());
            
            int severity = IMarker.SEVERITY_INFO;
            switch (suggestion.getSeverity()) {
                case ERROR:
                    severity = IMarker.SEVERITY_ERROR;
                    break;
                case WARNING:
                    severity = IMarker.SEVERITY_WARNING;
                    break;
                case INFO:
                    severity = IMarker.SEVERITY_INFO;
                    break;
            }
            
            marker.setAttribute(IMarker.SEVERITY, severity);
            marker.setAttribute("detailedDescription", suggestion.getDetailedDescription());
        } catch (CoreException e) {
            e.printStackTrace();
        }
    }

    private void deleteMarkers(IFile file) {
        try {
            file.deleteMarkers(MARKER_TYPE, false, IResource.DEPTH_ZERO);
        } catch (CoreException e) {
            e.printStackTrace();
        }
    }

    @Override
    protected void clean(IProgressMonitor monitor) throws CoreException {
        // Delete all markers
        getProject().deleteMarkers(MARKER_TYPE, true, IResource.DEPTH_INFINITE);
    }
}

