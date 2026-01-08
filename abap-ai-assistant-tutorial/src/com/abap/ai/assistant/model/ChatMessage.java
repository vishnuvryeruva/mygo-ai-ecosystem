package com.abap.ai.assistant.model;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Model class representing a chat message in the AI assistant panel.
 * Messages can be from the user or from the AI.
 */
public class ChatMessage {

    public enum MessageRole {
        USER,
        ASSISTANT,
        SYSTEM
    }

    public enum MessageType {
        TEXT, // Plain text response
        CODE_EXPLANATION, // Code with explanation
        CODE_SUGGESTION, // Code that can be applied
        ERROR, // Error message
        LOADING // Loading indicator
    }

    private final String id;
    private final MessageRole role;
    private final MessageType type;
    private final String content;
    private final String codeContent; // Optional: code block content
    private final String codeLanguage; // Optional: language for syntax highlighting
    private final String fileName; // Optional: associated file name
    private final int lineNumber; // Optional: line number in file
    private final LocalDateTime timestamp;
    private boolean canApply; // Whether this suggestion can be applied

    // Private constructor - use Builder
    private ChatMessage(Builder builder) {
        this.id = builder.id;
        this.role = builder.role;
        this.type = builder.type;
        this.content = builder.content;
        this.codeContent = builder.codeContent;
        this.codeLanguage = builder.codeLanguage;
        this.fileName = builder.fileName;
        this.lineNumber = builder.lineNumber;
        this.timestamp = builder.timestamp != null ? builder.timestamp : LocalDateTime.now();
        this.canApply = builder.canApply;
    }

    // Getters
    public String getId() {
        return id;
    }

    public MessageRole getRole() {
        return role;
    }

    public MessageType getType() {
        return type;
    }

    public String getContent() {
        return content;
    }

    public String getCodeContent() {
        return codeContent;
    }

    public String getCodeLanguage() {
        return codeLanguage;
    }

    public String getFileName() {
        return fileName;
    }

    public int getLineNumber() {
        return lineNumber;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public boolean canApply() {
        return canApply;
    }

    public String getFormattedTime() {
        return timestamp.format(DateTimeFormatter.ofPattern("HH:mm"));
    }

    public boolean hasCode() {
        return codeContent != null && !codeContent.isEmpty();
    }

    // Builder pattern for flexible message creation
    public static class Builder {
        private String id;
        private MessageRole role = MessageRole.ASSISTANT;
        private MessageType type = MessageType.TEXT;
        private String content = "";
        private String codeContent;
        private String codeLanguage = "abap";
        private String fileName;
        private int lineNumber = -1;
        private LocalDateTime timestamp;
        private boolean canApply = false;

        public Builder() {
            this.id = java.util.UUID.randomUUID().toString();
        }

        public Builder id(String id) {
            this.id = id;
            return this;
        }

        public Builder role(MessageRole role) {
            this.role = role;
            return this;
        }

        public Builder type(MessageType type) {
            this.type = type;
            return this;
        }

        public Builder content(String content) {
            this.content = content;
            return this;
        }

        public Builder code(String code) {
            this.codeContent = code;
            return this;
        }

        public Builder language(String language) {
            this.codeLanguage = language;
            return this;
        }

        public Builder file(String fileName) {
            this.fileName = fileName;
            return this;
        }

        public Builder line(int lineNumber) {
            this.lineNumber = lineNumber;
            return this;
        }

        public Builder timestamp(LocalDateTime timestamp) {
            this.timestamp = timestamp;
            return this;
        }

        public Builder canApply(boolean canApply) {
            this.canApply = canApply;
            return this;
        }

        public ChatMessage build() {
            return new ChatMessage(this);
        }
    }

    // Convenience factory methods
    public static ChatMessage userMessage(String content) {
        return new Builder()
                .role(MessageRole.USER)
                .type(MessageType.TEXT)
                .content(content)
                .build();
    }

    public static ChatMessage assistantMessage(String content) {
        return new Builder()
                .role(MessageRole.ASSISTANT)
                .type(MessageType.TEXT)
                .content(content)
                .build();
    }

    public static ChatMessage codeExplanation(String explanation, String code, String fileName) {
        return new Builder()
                .role(MessageRole.ASSISTANT)
                .type(MessageType.CODE_EXPLANATION)
                .content(explanation)
                .code(code)
                .file(fileName)
                .build();
    }

    public static ChatMessage codeSuggestion(String description, String code, String fileName, int line) {
        return new Builder()
                .role(MessageRole.ASSISTANT)
                .type(MessageType.CODE_SUGGESTION)
                .content(description)
                .code(code)
                .file(fileName)
                .line(line)
                .canApply(true)
                .build();
    }

    public static ChatMessage error(String errorMessage) {
        return new Builder()
                .role(MessageRole.SYSTEM)
                .type(MessageType.ERROR)
                .content(errorMessage)
                .build();
    }

    public static ChatMessage loading() {
        return new Builder()
                .role(MessageRole.SYSTEM)
                .type(MessageType.LOADING)
                .content("Thinking...")
                .build();
    }
}
