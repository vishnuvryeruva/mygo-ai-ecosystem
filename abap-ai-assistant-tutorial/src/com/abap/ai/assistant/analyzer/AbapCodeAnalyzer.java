package com.abap.ai.assistant.analyzer;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.eclipse.core.resources.IFile;
import org.eclipse.core.resources.IProject;
import org.eclipse.core.resources.IResource;
import org.eclipse.core.runtime.CoreException;
import org.eclipse.core.runtime.preferences.InstanceScope;
import org.osgi.service.prefs.Preferences;

import com.abap.ai.assistant.Activator;
import com.abap.ai.assistant.ai.OpenAIService;
import com.abap.ai.assistant.ai.PromptBuilder;
import com.abap.ai.assistant.model.CodePattern;
import com.abap.ai.assistant.model.CodeSuggestion;

/**
 * Analyzes ABAP code to detect patterns and generate suggestions
 */
public class AbapCodeAnalyzer {

    private Map<String, Integer> namingConventions = new HashMap<>();
    private Map<String, Integer> codingPatterns = new HashMap<>();
    private List<String> commonPrefixes = new ArrayList<>();
    private List<String> commonSuffixes = new ArrayList<>();

    /**
     * Determines if a file is an ABAP file based on its content rather than extension
     * This allows the plugin to work with ABAP files regardless of their file extension
     */
    public static boolean isAbapFile(IFile file) {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getContents()))) {
            
            String line;
            int linesChecked = 0;
            int abapKeywordsFound = 0;
            
            // Check first 50 lines for ABAP characteristics
            while ((line = reader.readLine()) != null && linesChecked < 50) {
                linesChecked++;
                String upperLine = line.trim().toUpperCase();
                
                // Skip empty lines and comments
                if (upperLine.isEmpty() || upperLine.startsWith("*")) {
                    continue;
                }
                
                // Look for characteristic ABAP keywords and patterns
                if (containsAbapKeywords(upperLine)) {
                    abapKeywordsFound++;
                }
                
                // If we find multiple ABAP keywords, it's likely an ABAP file
                if (abapKeywordsFound >= 2) {
                    return true;
                }
            }
            
            // If we found at least one ABAP keyword and the file extension suggests ABAP
            return abapKeywordsFound >= 1 && (
                file.getName().toLowerCase().endsWith(".abap") ||
                file.getName().toLowerCase().endsWith(".txt") ||
                file.getName().toLowerCase().contains("abap") ||
                !file.getName().contains(".")  // Files without extension
            );
            
        } catch (CoreException | IOException e) {
            // If we can't read the file, fall back to extension check
            return file.getName().toLowerCase().endsWith(".abap");
        }
    }
    
    /**
     * Checks if a line contains characteristic ABAP keywords
     */
    private static boolean containsAbapKeywords(String upperLine) {
        // Common ABAP keywords that indicate ABAP code
        String[] abapKeywords = {
            "DATA:", "DATA ", "TYPES:", "TYPES ",
            "METHOD ", "ENDMETHOD", "CLASS ", "ENDCLASS",
            "FORM ", "ENDFORM", "FUNCTION ", "ENDFUNCTION",
            "SELECT ", "FROM ", "INTO ", "WHERE ",
            "LOOP AT", "ENDLOOP", "IF ", "ENDIF",
            "CASE ", "ENDCASE", "DO ", "ENDDO",
            "WHILE ", "ENDWHILE", "TRY", "ENDTRY",
            "WRITE", "MESSAGE", "APPEND", "CLEAR",
            "CALL METHOD", "CALL FUNCTION", "PERFORM",
            "IMPORT", "EXPORT", "TABLES", "USING",
            "CHANGING", "RETURNING", "EXCEPTIONS",
            "IS INITIAL", "IS NOT INITIAL", "TYPE ",
            "LIKE ", "VALUE ", "REFERENCE INTO",
            "FIELD-SYMBOL", "ASSIGN", "UNASSIGN"
        };
        
        for (String keyword : abapKeywords) {
            if (upperLine.contains(keyword)) {
                return true;
            }
        }
        
        // Check for ABAP-specific operators and syntax
        if (upperLine.contains("->") ||  // Method calls
            upperLine.contains("=>") ||  // Static method calls
            upperLine.matches(".*\\w+\\s*=\\s*'.*'.*") ||  // String assignments with single quotes
            upperLine.matches(".*\\w+\\(\\s*\\d+\\s*\\).*")) {  // Type declarations with length
            return true;
        }
        
        return false;
    }

    /**
     * Analyzes all ABAP files in a project to learn coding patterns
     */
    public void learnProjectPatterns(IProject project) throws CoreException {
        namingConventions.clear();
        codingPatterns.clear();
        commonPrefixes.clear();
        commonSuffixes.clear();

        IResource[] members = project.members();
        for (IResource member : members) {
            if (member instanceof IFile) {
                IFile file = (IFile) member;
                if (isAbapFile(file)) {
                    analyzeFilePatterns(file);
                }
            }
        }

        // Identify most common patterns
        identifyCommonPatterns();
    }

    /**
     * Analyzes a single ABAP file for patterns
     */
    private void analyzeFilePatterns(IFile file) throws CoreException {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getContents()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                analyzeLine(line.trim());
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    /**
     * Analyzes a single line of ABAP code
     */
    private void analyzeLine(String line) {
        // Skip comments and empty lines
        if (line.startsWith("*") || line.isEmpty()) {
            return;
        }

        // Analyze variable declarations
        if (line.toUpperCase().contains("DATA:") || line.toUpperCase().contains("DATA ")) {
            analyzeVariableDeclaration(line);
        }

        // Analyze method calls
        if (line.contains("->") || line.toUpperCase().contains("CALL METHOD")) {
            analyzeMethodCall(line);
        }

        // Analyze conditional statements
        if (line.toUpperCase().startsWith("IF ")) {
            analyzeConditional(line);
        }

        // Analyze loop patterns
        if (line.toUpperCase().contains("LOOP AT")) {
            analyzeLoopPattern(line);
        }
    }

    private void analyzeVariableDeclaration(String line) {
        // Pattern: DATA: lv_variable TYPE string.
        Pattern pattern = Pattern.compile("(\\w+)\\s+TYPE", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(line);

        while (matcher.find()) {
            String varName = matcher.group(1);
            if (varName.length() > 2) {
                String prefix = varName.substring(0, Math.min(3, varName.length()));
                incrementCount(namingConventions, "var_prefix_" + prefix.toLowerCase());

                // Detect naming patterns (e.g., lv_, lt_, ls_)
                if (varName.contains("_")) {
                    String[] parts = varName.split("_");
                    if (parts.length > 0) {
                        incrementCount(namingConventions, "prefix_" + parts[0].toLowerCase());
                    }
                }
            }
        }
    }

    private void analyzeMethodCall(String line) {
        // Detect method calling patterns
        if (line.contains("->")) {
            incrementCount(codingPatterns, "object_oriented_style");
        } else {
            incrementCount(codingPatterns, "procedural_style");
        }
    }

    private void analyzeConditional(String line) {
        String upper = line.toUpperCase();
        if (upper.contains("IS NOT INITIAL")) {
            incrementCount(codingPatterns, "check_not_initial");
        }
        if (upper.contains("IS INITIAL")) {
            incrementCount(codingPatterns, "check_initial");
        }
        if (upper.contains("EQ") || upper.contains("=")) {
            incrementCount(codingPatterns, "equality_check");
        }
    }

    private void analyzeLoopPattern(String line) {
        String upper = line.toUpperCase();
        if (upper.contains("INTO")) {
            incrementCount(codingPatterns, "loop_into_workarea");
        }
        if (upper.contains("ASSIGNING")) {
            incrementCount(codingPatterns, "loop_field_symbol");
        }
        if (upper.contains("REFERENCE INTO")) {
            incrementCount(codingPatterns, "loop_reference");
        }
    }

    private void incrementCount(Map<String, Integer> map, String key) {
        map.put(key, map.getOrDefault(key, 0) + 1);
    }

    private void identifyCommonPatterns() {
        // Find most common prefixes (e.g., lv_, lt_, ls_)
        namingConventions.entrySet().stream()
                .filter(e -> e.getKey().startsWith("prefix_"))
                .sorted((e1, e2) -> e2.getValue().compareTo(e1.getValue()))
                .limit(5)
                .forEach(e -> commonPrefixes.add(e.getKey().replace("prefix_", "")));
    }

    /**
     * Analyzes a specific file and generates suggestions based on learned patterns
     */
    public List<CodeSuggestion> analyzeSingleFile(IFile file) throws CoreException {
        Preferences prefs = InstanceScope.INSTANCE.getNode(Activator.PLUGIN_ID);
        boolean useAI = prefs.getBoolean("use_openai", true);
        
        if (useAI) {
            return analyzeSingleFileWithAI(file);
        } else {
            return analyzeSingleFileRuleBased(file);
        }
    }

    /**
     * Analyzes file using OpenAI API
     */
    private List<CodeSuggestion> analyzeSingleFileWithAI(IFile file) throws CoreException {
        List<CodeSuggestion> suggestions = new ArrayList<>();
        
        try {
            // Read entire file content
            StringBuilder fileContent = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(file.getContents()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    fileContent.append(line).append("\n");
                }
            }
            
            // Build project patterns context
            String patternsContext = PromptBuilder.buildProjectPatternsContext(
                namingConventions, 
                codingPatterns, 
                commonPrefixes
            );
            
            // Call OpenAI service
            OpenAIService openAI = new OpenAIService();
            suggestions = openAI.generateSuggestions(fileContent.toString(), patternsContext);
            
        } catch (IOException e) {
            e.printStackTrace();
            // Fall back to rule-based if AI fails
            CodeSuggestion fallbackMsg = new CodeSuggestion(
                1,
                "AI analysis unavailable, using rule-based analysis",
                "Enable OpenAI integration in preferences for AI-powered suggestions",
                CodeSuggestion.SeverityLevel.INFO
            );
            suggestions.add(fallbackMsg);
            suggestions.addAll(analyzeSingleFileRuleBased(file));
        }
        
        return suggestions;
    }

    /**
     * Analyzes file using rule-based approach (fallback)
     */
    private List<CodeSuggestion> analyzeSingleFileRuleBased(IFile file) throws CoreException {
        List<CodeSuggestion> suggestions = new ArrayList<>();

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getContents()))) {
            String line;
            int lineNumber = 0;

            while ((line = reader.readLine()) != null) {
                lineNumber++;
                suggestions.addAll(checkLineForSuggestions(line, lineNumber));
            }
        } catch (IOException e) {
            e.printStackTrace();
        }

        return suggestions;
    }

    private List<CodeSuggestion> checkLineForSuggestions(String line, int lineNumber) {
        List<CodeSuggestion> suggestions = new ArrayList<>();
        String trimmed = line.trim();

        // Check variable naming conventions
        if (trimmed.toUpperCase().contains("DATA:") || trimmed.toUpperCase().contains("DATA ")) {
            suggestions.addAll(checkNamingConvention(trimmed, lineNumber));
        }

        // Check for inefficient loop patterns
        if (trimmed.toUpperCase().contains("LOOP AT")) {
            suggestions.addAll(checkLoopPattern(trimmed, lineNumber));
        }

        // Check for deprecated syntax
        if (trimmed.toUpperCase().contains("CALL METHOD")) {
            suggestions.addAll(checkMethodCallStyle(trimmed, lineNumber));
        }

        // Check conditional patterns
        if (trimmed.toUpperCase().startsWith("IF ")) {
            suggestions.addAll(checkConditionalPattern(trimmed, lineNumber));
        }

        return suggestions;
    }

    private List<CodeSuggestion> checkNamingConvention(String line, int lineNumber) {
        List<CodeSuggestion> suggestions = new ArrayList<>();

        // Extract variable name
        Pattern pattern = Pattern.compile("(\\w+)\\s+TYPE", Pattern.CASE_INSENSITIVE);
        Matcher matcher = pattern.matcher(line);

        while (matcher.find()) {
            String varName = matcher.group(1);

            // Check if it follows project conventions
            boolean followsConvention = false;
            for (String prefix : commonPrefixes) {
                if (varName.toLowerCase().startsWith(prefix)) {
                    followsConvention = true;
                    break;
                }
            }

            if (!followsConvention && !commonPrefixes.isEmpty()) {
                CodeSuggestion suggestion = new CodeSuggestion(
                        lineNumber,
                        "Variable '" + varName + "' doesn't follow project naming convention",
                        "Consider using prefixes like: " + String.join(", ", commonPrefixes),
                        CodeSuggestion.SeverityLevel.INFO
                );
                suggestions.add(suggestion);
            }
        }

        return suggestions;
    }

    private List<CodeSuggestion> checkLoopPattern(String line, int lineNumber) {
        List<CodeSuggestion> suggestions = new ArrayList<>();
        String upper = line.toUpperCase();

        // Get most common loop pattern in project
        int loopIntoCount = codingPatterns.getOrDefault("loop_into_workarea", 0);
        int loopFieldSymbolCount = codingPatterns.getOrDefault("loop_field_symbol", 0);
        int loopReferenceCount = codingPatterns.getOrDefault("loop_reference", 0);

        // If LOOP INTO is used but project prefers FIELD-SYMBOL
        if (upper.contains("INTO") && !upper.contains("ASSIGNING") &&
                !upper.contains("REFERENCE") && loopFieldSymbolCount > loopIntoCount * 2) {
            CodeSuggestion suggestion = new CodeSuggestion(
                    lineNumber,
                    "Consider using FIELD-SYMBOL for better performance",
                    "Your project commonly uses 'LOOP AT ... ASSIGNING <fs>' pattern for better performance",
                    CodeSuggestion.SeverityLevel.WARNING
            );
            suggestions.add(suggestion);
        }

        return suggestions;
    }

    private List<CodeSuggestion> checkMethodCallStyle(String line, int lineNumber) {
        List<CodeSuggestion> suggestions = new ArrayList<>();

        // Check if project prefers object-oriented style
        int ooCount = codingPatterns.getOrDefault("object_oriented_style", 0);
        int proceduralCount = codingPatterns.getOrDefault("procedural_style", 0);

        if (line.toUpperCase().contains("CALL METHOD") && ooCount > proceduralCount * 2) {
            CodeSuggestion suggestion = new CodeSuggestion(
                    lineNumber,
                    "Consider using modern method call syntax",
                    "Replace 'CALL METHOD' with direct method call using '->' operator",
                    CodeSuggestion.SeverityLevel.INFO
            );
            suggestions.add(suggestion);
        }

        return suggestions;
    }

    private List<CodeSuggestion> checkConditionalPattern(String line, int lineNumber) {
        List<CodeSuggestion> suggestions = new ArrayList<>();
        String upper = line.toUpperCase();

        // Check for empty string checks
        if (upper.contains("= ''") || upper.contains("EQ ''")) {
            CodeSuggestion suggestion = new CodeSuggestion(
                    lineNumber,
                    "Consider using 'IS INITIAL' check",
                    "Instead of comparing to empty string, use 'IS INITIAL' for better readability",
                    CodeSuggestion.SeverityLevel.INFO
            );
            suggestions.add(suggestion);
        }

        return suggestions;
    }

    public Map<String, Integer> getNamingConventions() {
        return namingConventions;
    }

    public Map<String, Integer> getCodingPatterns() {
        return codingPatterns;
    }

    public List<String> getCommonPrefixes() {
        return commonPrefixes;
    }
}

