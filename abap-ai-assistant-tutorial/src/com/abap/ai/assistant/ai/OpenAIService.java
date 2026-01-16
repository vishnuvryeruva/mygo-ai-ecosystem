package com.abap.ai.assistant.ai;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import org.eclipse.core.runtime.preferences.InstanceScope;
import org.osgi.service.prefs.Preferences;

import com.abap.ai.assistant.Activator;
import com.abap.ai.assistant.model.CodeSuggestion;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Service for interacting with OpenAI API to generate code suggestions
 */
public class OpenAIService {

    private static final String OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
    private static final int TIMEOUT = 30000; // 30 seconds

    private String apiKey;
    private String model;

    public OpenAIService() {
        loadConfiguration();
    }

    private void loadConfiguration() {
        Preferences prefs = InstanceScope.INSTANCE.getNode(Activator.PLUGIN_ID);
        this.apiKey = prefs.get("openai_api_key", "");
        this.model = prefs.get("openai_model", "gpt-4o-mini");
    }

    /**
     * Checks if OpenAI is configured
     */
    public boolean isConfigured() {
        return apiKey != null && !apiKey.trim().isEmpty();
    }

    /**
     * Generates suggestions for ABAP code using OpenAI
     */
    public List<CodeSuggestion> generateSuggestions(String code, String projectPatterns) {
        List<CodeSuggestion> suggestions = new ArrayList<>();

        if (!isConfigured()) {
            CodeSuggestion configSuggestion = new CodeSuggestion(
                    1,
                    "OpenAI API key not configured",
                    "Please configure your OpenAI API key in Preferences > ABAP AI Assistant",
                    CodeSuggestion.SeverityLevel.WARNING);
            suggestions.add(configSuggestion);
            return suggestions;
        }

        try {
            String prompt = buildPrompt(code, projectPatterns);
            String response = callOpenAI(prompt);
            suggestions = parseResponse(response);
        } catch (Exception e) {
            CodeSuggestion errorSuggestion = new CodeSuggestion(
                    1,
                    "Error communicating with OpenAI: " + e.getMessage(),
                    "Check your internet connection and API key configuration",
                    CodeSuggestion.SeverityLevel.ERROR);
            suggestions.add(errorSuggestion);
            e.printStackTrace();
        }

        return suggestions;
    }

    /**
     * Builds the prompt for OpenAI with code context
     */
    private String buildPrompt(String code, String projectPatterns) {
        StringBuilder prompt = new StringBuilder();

        prompt.append("You are an expert ABAP code reviewer and assistant. ");
        prompt.append("Analyze the following ABAP code and provide specific, actionable suggestions.\n\n");

        if (projectPatterns != null && !projectPatterns.isEmpty()) {
            prompt.append("PROJECT PATTERNS:\n");
            prompt.append(projectPatterns);
            prompt.append("\n\n");
        }

        prompt.append("CODE TO ANALYZE:\n");
        prompt.append("```abap\n");
        prompt.append(code);
        prompt.append("\n```\n\n");

        prompt.append("Please analyze this code and provide suggestions in the following JSON format:\n");
        prompt.append("[\n");
        prompt.append("  {\n");
        prompt.append("    \"line\": <line_number>,\n");
        prompt.append("    \"severity\": \"INFO|WARNING|ERROR\",\n");
        prompt.append("    \"message\": \"Brief description\",\n");
        prompt.append("    \"details\": \"Detailed explanation with context\"\n");
        prompt.append("  }\n");
        prompt.append("]\n\n");

        prompt.append("Focus on:\n");
        prompt.append("1. Naming conventions consistency with project patterns\n");
        prompt.append("2. Performance optimization opportunities\n");
        prompt.append("3. Modern ABAP syntax recommendations\n");
        prompt.append("4. Best practices and code quality\n");
        prompt.append("5. Potential bugs or issues\n\n");

        prompt.append("Return ONLY the JSON array, no additional text.");

        return prompt.toString();
    }

    /**
     * Makes HTTP call to OpenAI API
     */
    private String callOpenAI(String prompt) throws IOException {
        URL url = new URL(OPENAI_API_URL);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();

        try {
            // Set request properties
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + apiKey);
            conn.setDoOutput(true);
            conn.setConnectTimeout(TIMEOUT);
            conn.setReadTimeout(TIMEOUT);

            // Build request body
            JSONObject requestBody = new JSONObject();
            requestBody.put("model", model);

            JSONArray messages = new JSONArray();
            JSONObject message = new JSONObject();
            message.put("role", "user");
            message.put("content", prompt);
            messages.put(message);

            requestBody.put("messages", messages);
            requestBody.put("temperature", 0.3);
            requestBody.put("max_tokens", 2000);

            // Send request
            try (OutputStream os = conn.getOutputStream()) {
                byte[] input = requestBody.toString().getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            // Read response
            int responseCode = conn.getResponseCode();
            if (responseCode != 200) {
                throw new IOException("OpenAI API returned error code: " + responseCode);
            }

            StringBuilder response = new StringBuilder();
            try (BufferedReader br = new BufferedReader(
                    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) {
                    response.append(line);
                }
            }

            return response.toString();

        } finally {
            conn.disconnect();
        }
    }

    /**
     * Parses OpenAI response and converts to CodeSuggestion objects
     */
    private List<CodeSuggestion> parseResponse(String response) {
        List<CodeSuggestion> suggestions = new ArrayList<>();

        try {
            JSONObject jsonResponse = new JSONObject(response);
            JSONArray choices = jsonResponse.getJSONArray("choices");

            if (choices.length() > 0) {
                JSONObject choice = choices.getJSONObject(0);
                JSONObject message = choice.getJSONObject("message");
                String content = message.getString("content");

                // Extract JSON array from content (may have markdown formatting)
                content = content.trim();
                if (content.startsWith("```json")) {
                    content = content.substring(7);
                }
                if (content.startsWith("```")) {
                    content = content.substring(3);
                }
                if (content.endsWith("```")) {
                    content = content.substring(0, content.length() - 3);
                }
                content = content.trim();

                // Parse suggestions
                JSONArray suggestionsArray = new JSONArray(content);

                for (int i = 0; i < suggestionsArray.length(); i++) {
                    JSONObject suggestionObj = suggestionsArray.getJSONObject(i);

                    int line = suggestionObj.optInt("line", 1);
                    String severityStr = suggestionObj.optString("severity", "INFO");
                    String message2 = suggestionObj.optString("message", "");
                    String details = suggestionObj.optString("details", "");

                    CodeSuggestion.SeverityLevel severity = parseSeverity(severityStr);

                    CodeSuggestion suggestion = new CodeSuggestion(line, message2, details, severity);
                    suggestions.add(suggestion);
                }
            }
        } catch (Exception e) {
            System.err.println("Error parsing OpenAI response: " + e.getMessage());
            e.printStackTrace();

            // Return a suggestion about parsing error
            CodeSuggestion errorSuggestion = new CodeSuggestion(
                    1,
                    "Unable to parse AI suggestions",
                    "The AI response format was unexpected. Please try again.",
                    CodeSuggestion.SeverityLevel.INFO);
            suggestions.add(errorSuggestion);
        }

        return suggestions;
    }

    private CodeSuggestion.SeverityLevel parseSeverity(String severity) {
        switch (severity.toUpperCase()) {
            case "ERROR":
                return CodeSuggestion.SeverityLevel.ERROR;
            case "WARNING":
                return CodeSuggestion.SeverityLevel.WARNING;
            case "INFO":
            default:
                return CodeSuggestion.SeverityLevel.INFO;
        }
    }

    /**
     * Explains what a piece of ABAP code does using OpenAI
     */
    public String explainCode(String code) {
        if (!isConfigured()) {
            return "OpenAI API key not configured.\n\n" +
                    "Please configure your OpenAI API key in Preferences > ABAP AI Assistant";
        }

        try {
            String prompt = buildExplanationPrompt(code);
            String response = callOpenAI(prompt);
            return extractExplanation(response);
        } catch (Exception e) {
            return "Error getting explanation: " + e.getMessage() + "\n\n" +
                    "Please check your internet connection and API key configuration.";
        }
    }

    /**
     * Refactors ABAP code using OpenAI to improve quality and readability
     */
    public String refactorCode(String code) {
        if (!isConfigured()) {
            return "ERROR: OpenAI API key not configured.\n\n" +
                    "Please configure your OpenAI API key in Preferences > ABAP AI Assistant";
        }

        try {
            String prompt = buildRefactorPrompt(code);
            String response = callOpenAI(prompt);
            return extractRefactoredCode(response);
        } catch (Exception e) {
            return "ERROR: " + e.getMessage() + "\n\n" +
                    "Please check your internet connection and API key configuration.";
        }
    }

    /**
     * Builds the prompt for code explanation
     */
    private String buildExplanationPrompt(String code) {
        StringBuilder prompt = new StringBuilder();

        prompt.append("Explain what the following ABAP code does in simple terms. ");
        prompt.append("Write as if explaining to someone who is not a programmer.\n\n");

        prompt.append("CODE:\n");
        prompt.append("```abap\n");
        prompt.append(code);
        prompt.append("\n```\n\n");

        prompt.append("RULES:\n");
        prompt.append("- Keep it SHORT (2-4 sentences maximum)\n");
        prompt.append("- Use plain, everyday language\n");
        prompt.append("- Avoid technical jargon when possible\n");
        prompt.append("- Focus only on what the code DOES, not how it works\n");

        return prompt.toString();
    }

    /**
     * Extracts the explanation text from OpenAI response
     */
    private String extractExplanation(String response) {
        try {
            JSONObject jsonResponse = new JSONObject(response);
            JSONArray choices = jsonResponse.getJSONArray("choices");

            if (choices.length() > 0) {
                JSONObject choice = choices.getJSONObject(0);
                JSONObject message = choice.getJSONObject("message");
                String content = message.getString("content");
                return content.trim();
            }

            return "No explanation received from AI.";

        } catch (Exception e) {
            return "Error parsing AI response: " + e.getMessage();
        }
    }

    /**
     * Builds the prompt for code refactoring
     */
    private String buildRefactorPrompt(String code) {
        StringBuilder prompt = new StringBuilder();

        prompt.append("You are an expert ABAP developer. Refactor the following ABAP code to improve its quality.\n\n");

        prompt.append("ORIGINAL CODE:\n");
        prompt.append("```abap\n");
        prompt.append(code);
        prompt.append("\n```\n\n");

        prompt.append("REFACTORING RULES:\n");
        prompt.append("1. Use modern ABAP syntax where applicable\n");
        prompt.append("2. Improve readability and maintainability\n");
        prompt.append("3. Apply ABAP best practices\n");
        prompt.append("4. Optimize performance where possible\n");
        prompt.append("5. Add helpful comments for complex logic\n");
        prompt.append("6. Keep the same functionality - DO NOT change what the code does\n");
        prompt.append("7. Return ONLY the refactored code, no explanations or markdown\n\n");

        prompt.append("Return the refactored ABAP code:");

        return prompt.toString();
    }

    /**
     * Extracts the refactored code from OpenAI response
     */
    private String extractRefactoredCode(String response) {
        try {
            JSONObject jsonResponse = new JSONObject(response);
            JSONArray choices = jsonResponse.getJSONArray("choices");

            if (choices.length() > 0) {
                JSONObject choice = choices.getJSONObject(0);
                JSONObject message = choice.getJSONObject("message");
                String content = message.getString("content").trim();

                // Remove markdown code blocks if present
                if (content.startsWith("```abap")) {
                    content = content.substring(7);
                } else if (content.startsWith("```")) {
                    content = content.substring(3);
                }

                if (content.endsWith("```")) {
                    content = content.substring(0, content.length() - 3);
                }

                return content.trim();
            }

            return "ERROR: No refactored code received from AI.";

        } catch (Exception e) {
            return "ERROR: Could not parse AI response - " + e.getMessage();
        }
    }

    /**
     * Ask a general question about ABAP code or development
     */
    public String askQuestion(String question) {
        if (!isConfigured()) {
            return "OpenAI API key not configured.\n\n" +
                    "Please configure your OpenAI API key in Preferences > ABAP AI Assistant";
        }

        try {
            String prompt = buildQuestionPrompt(question);
            String response = callOpenAI(prompt);
            return extractExplanation(response);
        } catch (Exception e) {
            return "Error getting answer: " + e.getMessage() + "\n\n" +
                    "Please check your internet connection and API key configuration.";
        }
    }

    /**
     * Builds prompt for general questions
     */
    private String buildQuestionPrompt(String question) {
        StringBuilder prompt = new StringBuilder();

        prompt.append("You are an expert ABAP developer and SAP consultant. ");
        prompt.append("Answer the following question about ABAP development, SAP, or code.\n\n");

        prompt.append("QUESTION:\n");
        prompt.append(question);
        prompt.append("\n\n");

        prompt.append("RULES:\n");
        prompt.append("- Be concise but thorough\n");
        prompt.append("- Provide code examples when helpful\n");
        prompt.append("- Use proper ABAP syntax in examples\n");
        prompt.append("- Focus on practical, actionable advice\n");

        return prompt.toString();
    }

    /**
     * Analyzes ABAP code and provides improvement suggestions
     */
    public String analyzeCode(String code) {
        if (!isConfigured()) {
            return "OpenAI API key not configured.\n\n" +
                    "Please configure your OpenAI API key in Preferences > ABAP AI Assistant";
        }

        try {
            String prompt = buildAnalyzePrompt(code);
            String response = callOpenAI(prompt);
            return extractExplanation(response);
        } catch (Exception e) {
            return "Error analyzing code: " + e.getMessage() + "\n\n" +
                    "Please check your internet connection and API key configuration.";
        }
    }

    /**
     * Builds prompt for code analysis
     */
    private String buildAnalyzePrompt(String code) {
        StringBuilder prompt = new StringBuilder();

        prompt.append(
                "You are an expert ABAP code reviewer. Analyze the following code and provide specific improvement suggestions.\n\n");

        prompt.append("CODE:\n");
        prompt.append("```abap\n");
        prompt.append(code);
        prompt.append("\n```\n\n");

        prompt.append("Provide a brief analysis covering:\n");
        prompt.append("1. Code quality issues\n");
        prompt.append("2. Performance improvements\n");
        prompt.append("3. Best practice recommendations\n");
        prompt.append("4. Potential bugs or risks\n\n");

        prompt.append("Keep your response concise and actionable.");

        return prompt.toString();
    }

    /**
     * Tests the API connection
     */
    public boolean testConnection() {
        if (!isConfigured()) {
            System.err.println("OpenAI not configured - API key is missing");
            return false;
        }

        try {
            System.out.println("Testing OpenAI connection with key: " +
                    apiKey.substring(0, Math.min(10, apiKey.length())) + "...");

            // Build a minimal test request
            JSONObject requestBody = new JSONObject();
            requestBody.put("model", model);

            JSONArray messages = new JSONArray();
            JSONObject message = new JSONObject();
            message.put("role", "user");
            message.put("content", "Say 'OK'");
            messages.put(message);

            requestBody.put("messages", messages);
            requestBody.put("temperature", 0.3);
            requestBody.put("max_tokens", 10);

            System.out.println("Sending test request to OpenAI...");

            URL url = new URL(OPENAI_API_URL);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();

            try {
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + apiKey);
                conn.setDoOutput(true);
                conn.setConnectTimeout(TIMEOUT);
                conn.setReadTimeout(TIMEOUT);

                // Send request
                try (OutputStream os = conn.getOutputStream()) {
                    byte[] input = requestBody.toString().getBytes(StandardCharsets.UTF_8);
                    os.write(input, 0, input.length);
                }

                // Check response code
                int responseCode = conn.getResponseCode();
                System.out.println("OpenAI response code: " + responseCode);

                if (responseCode == 200) {
                    System.out.println("OpenAI connection successful!");
                    return true;
                } else {
                    // Read error response
                    StringBuilder errorResponse = new StringBuilder();
                    try (BufferedReader br = new BufferedReader(
                            new InputStreamReader(conn.getErrorStream(), StandardCharsets.UTF_8))) {
                        String line;
                        while ((line = br.readLine()) != null) {
                            errorResponse.append(line);
                        }
                    }
                    System.err.println("OpenAI error response: " + errorResponse.toString());
                    return false;
                }
            } finally {
                conn.disconnect();
            }
        } catch (Exception e) {
            System.err.println("Error testing OpenAI connection: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
}
