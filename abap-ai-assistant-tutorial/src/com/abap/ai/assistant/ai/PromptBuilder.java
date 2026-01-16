package com.abap.ai.assistant.ai;

import java.util.List;
import java.util.Map;

/**
 * Builds context-aware prompts for OpenAI based on project patterns
 */
public class PromptBuilder {

    /**
     * Builds a string representation of project patterns for the prompt
     */
    public static String buildProjectPatternsContext(
            Map<String, Integer> namingConventions,
            Map<String, Integer> codingPatterns,
            List<String> commonPrefixes) {
        
        StringBuilder context = new StringBuilder();
        
        if (!commonPrefixes.isEmpty()) {
            context.append("Common Variable Prefixes in this project:\n");
            for (String prefix : commonPrefixes) {
                context.append("  - ").append(prefix).append("_\n");
            }
            context.append("\n");
        }
        
        if (!namingConventions.isEmpty()) {
            context.append("Naming Conventions:\n");
            namingConventions.entrySet().stream()
                .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue()))
                .limit(5)
                .forEach(e -> {
                    context.append("  - ")
                           .append(e.getKey())
                           .append(": ")
                           .append(e.getValue())
                           .append(" occurrences\n");
                });
            context.append("\n");
        }
        
        if (!codingPatterns.isEmpty()) {
            context.append("Coding Patterns:\n");
            
            int ooCount = codingPatterns.getOrDefault("object_oriented_style", 0);
            int procCount = codingPatterns.getOrDefault("procedural_style", 0);
            if (ooCount > 0 || procCount > 0) {
                context.append("  - Method Call Style: ");
                if (ooCount > procCount) {
                    context.append("Object-oriented (->) preferred\n");
                } else {
                    context.append("Procedural (CALL METHOD) used\n");
                }
            }
            
            int loopInto = codingPatterns.getOrDefault("loop_into_workarea", 0);
            int loopFs = codingPatterns.getOrDefault("loop_field_symbol", 0);
            int loopRef = codingPatterns.getOrDefault("loop_reference", 0);
            if (loopInto > 0 || loopFs > 0 || loopRef > 0) {
                context.append("  - Loop Style: ");
                if (loopFs >= loopInto && loopFs >= loopRef) {
                    context.append("Field symbols (ASSIGNING) preferred\n");
                } else if (loopRef >= loopInto) {
                    context.append("References (REFERENCE INTO) preferred\n");
                } else {
                    context.append("Work areas (INTO) used\n");
                }
            }
            
            int checkInitial = codingPatterns.getOrDefault("check_initial", 0);
            int checkNotInitial = codingPatterns.getOrDefault("check_not_initial", 0);
            if (checkInitial > 0 || checkNotInitial > 0) {
                context.append("  - Empty checks: IS INITIAL pattern used ")
                       .append(checkInitial + checkNotInitial)
                       .append(" times\n");
            }
        }
        
        return context.toString();
    }

    /**
     * Builds a focused prompt for analyzing a specific code section
     */
    public static String buildFocusedPrompt(String codeSection, String focus) {
        StringBuilder prompt = new StringBuilder();
        
        prompt.append("Focus specifically on: ").append(focus).append("\n\n");
        prompt.append("Code section:\n");
        prompt.append("```abap\n");
        prompt.append(codeSection);
        prompt.append("\n```\n");
        
        return prompt.toString();
    }

    /**
     * Builds a prompt for explaining a specific issue
     */
    public static String buildExplanationPrompt(String code, int lineNumber, String issue) {
        StringBuilder prompt = new StringBuilder();
        
        prompt.append("Explain why this is an issue and provide a solution:\n\n");
        prompt.append("Issue at line ").append(lineNumber).append(": ").append(issue).append("\n\n");
        prompt.append("Code:\n");
        prompt.append("```abap\n");
        prompt.append(code);
        prompt.append("\n```\n");
        
        return prompt.toString();
    }
}


