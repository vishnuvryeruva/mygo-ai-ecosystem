package com.abap.ai.assistant.model;

/**
 * Represents a detected code pattern in the project
 */
public class CodePattern {

    private String patternType;
    private String patternValue;
    private int frequency;
    private double confidence;

    public CodePattern(String patternType, String patternValue, int frequency) {
        this.patternType = patternType;
        this.patternValue = patternValue;
        this.frequency = frequency;
        this.confidence = 0.0;
    }

    public String getPatternType() {
        return patternType;
    }

    public void setPatternType(String patternType) {
        this.patternType = patternType;
    }

    public String getPatternValue() {
        return patternValue;
    }

    public void setPatternValue(String patternValue) {
        this.patternValue = patternValue;
    }

    public int getFrequency() {
        return frequency;
    }

    public void setFrequency(int frequency) {
        this.frequency = frequency;
    }

    public double getConfidence() {
        return confidence;
    }

    public void setConfidence(double confidence) {
        this.confidence = confidence;
    }

    @Override
    public String toString() {
        return String.format("CodePattern[type=%s, value=%s, freq=%d, conf=%.2f]",
                patternType, patternValue, frequency, confidence);
    }
}

