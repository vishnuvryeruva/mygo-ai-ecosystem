package com.abap.ai.assistant.model;

/**
 * Represents a code suggestion for the user
 */
public class CodeSuggestion {

    public enum SeverityLevel {
        INFO,
        WARNING,
        ERROR
    }

    private int lineNumber;
    private String message;
    private String detailedDescription;
    private SeverityLevel severity;
    private String suggestedFix;

    public CodeSuggestion(int lineNumber, String message, String detailedDescription, SeverityLevel severity) {
        this.lineNumber = lineNumber;
        this.message = message;
        this.detailedDescription = detailedDescription;
        this.severity = severity;
    }

    public int getLineNumber() {
        return lineNumber;
    }

    public void setLineNumber(int lineNumber) {
        this.lineNumber = lineNumber;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getDetailedDescription() {
        return detailedDescription;
    }

    public void setDetailedDescription(String detailedDescription) {
        this.detailedDescription = detailedDescription;
    }

    public SeverityLevel getSeverity() {
        return severity;
    }

    public void setSeverity(SeverityLevel severity) {
        this.severity = severity;
    }

    public String getSuggestedFix() {
        return suggestedFix;
    }

    public void setSuggestedFix(String suggestedFix) {
        this.suggestedFix = suggestedFix;
    }

    @Override
    public String toString() {
        return String.format("Line %d [%s]: %s", lineNumber, severity, message);
    }
}

