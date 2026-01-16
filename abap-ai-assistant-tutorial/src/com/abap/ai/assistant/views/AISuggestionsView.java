package com.abap.ai.assistant.views;

import java.util.ArrayList;
import java.util.List;

import org.eclipse.core.resources.IFile;
import org.eclipse.jface.action.Action;
import org.eclipse.jface.action.IMenuManager;
import org.eclipse.jface.action.IToolBarManager;
import org.eclipse.jface.action.Separator;
import org.eclipse.swt.SWT;
import org.eclipse.swt.custom.ScrolledComposite;
import org.eclipse.swt.custom.StyledText;
import org.eclipse.swt.dnd.Clipboard;
import org.eclipse.swt.dnd.TextTransfer;
import org.eclipse.swt.dnd.Transfer;
import org.eclipse.swt.events.KeyAdapter;
import org.eclipse.swt.events.KeyEvent;
import org.eclipse.swt.graphics.Color;
import org.eclipse.swt.graphics.Font;
import org.eclipse.swt.graphics.FontData;
import org.eclipse.swt.layout.GridData;
import org.eclipse.swt.layout.GridLayout;
import org.eclipse.swt.layout.RowLayout;
import org.eclipse.swt.widgets.Button;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Label;
import org.eclipse.swt.widgets.Text;
import org.eclipse.ui.IActionBars;
import org.eclipse.ui.ISharedImages;
import org.eclipse.ui.PlatformUI;
import org.eclipse.ui.part.ViewPart;

import com.abap.ai.assistant.ai.OpenAIService;
import com.abap.ai.assistant.model.ChatMessage;
import com.abap.ai.assistant.model.ChatMessage.MessageRole;
import com.abap.ai.assistant.model.ChatMessage.MessageType;
import com.abap.ai.assistant.model.CodeSuggestion;

/**
 * Enhanced AI Assistant Panel with chat-style interface.
 * Inspired by Cursor, GitHub Copilot, and VS Code AI panels.
 */
public class AISuggestionsView extends ViewPart {

    public static final String ID = "com.abap.ai.assistant.views.AISuggestionsView";

    // UI Components
    private ScrolledComposite scrolledComposite;
    private Composite messagesContainer;
    private Text inputField;
    private Label contextLabel;
    private Composite contextBar;

    // Data
    private List<ChatMessage> messages = new ArrayList<>();
    private String currentFileName = null;
    private String currentSelection = null;

    // Actions
    private Action clearAction;
    private Action settingsAction;

    // Styling
    private Color userBubbleColor;
    private Color assistantBubbleColor;
    private Color codeBlockColor;
    private Color errorColor;
    private Font monoFont;
    private Font labelFont;

    @Override
    public void createPartControl(Composite parent) {
        initializeStyles(parent.getDisplay());
        createMainLayout(parent);
        createActions();
        createMenuAndToolbar();

        // Show welcome message
        addMessage(ChatMessage.assistantMessage(
                "👋 Hello! I'm your ABAP AI Assistant.\n\n" +
                        "I can help you with:\n" +
                        "• Explaining ABAP code\n" +
                        "• Suggesting improvements\n" +
                        "• Refactoring code\n" +
                        "• Finding anti-patterns\n\n" +
                        "Select some code in the editor and ask me a question, or type a command like:\n" +
                        "• \"explain\" - to explain the selected code\n" +
                        "• \"improve\" - to get improvement suggestions\n" +
                        "• \"refactor\" - to refactor the code"));
    }

    private void initializeStyles(Display display) {
        // Colors
        userBubbleColor = new Color(display, 220, 240, 255); // Light blue
        assistantBubbleColor = new Color(display, 245, 245, 245); // Light gray
        codeBlockColor = new Color(display, 40, 44, 52); // Dark (like VS Code)
        errorColor = new Color(display, 255, 220, 220); // Light red

        // Monospace font for code
        FontData[] fontData = display.getSystemFont().getFontData();
        for (FontData fd : fontData) {
            fd.setName("Menlo");
            fd.setHeight(11);
        }
        monoFont = new Font(display, fontData);

        // Label font
        FontData[] labelFontData = display.getSystemFont().getFontData();
        for (FontData fd : labelFontData) {
            fd.setHeight(9);
        }
        labelFont = new Font(display, labelFontData);
    }

    private void createMainLayout(Composite parent) {
        parent.setLayout(new GridLayout(1, false));

        // Context bar at top
        createContextBar(parent);

        // Messages area (scrollable)
        scrolledComposite = new ScrolledComposite(parent, SWT.V_SCROLL);
        scrolledComposite.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));
        scrolledComposite.setExpandHorizontal(true);
        scrolledComposite.setExpandVertical(true);

        messagesContainer = new Composite(scrolledComposite, SWT.NONE);
        messagesContainer.setLayout(new GridLayout(1, false));
        scrolledComposite.setContent(messagesContainer);

        // Input area at bottom
        createInputArea(parent);
    }

    private void createContextBar(Composite parent) {
        contextBar = new Composite(parent, SWT.NONE);
        contextBar.setLayout(new GridLayout(2, false));
        contextBar.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));
        contextBar.setBackground(parent.getDisplay().getSystemColor(SWT.COLOR_WIDGET_LIGHT_SHADOW));

        Label icon = new Label(contextBar, SWT.NONE);
        icon.setText("📄");

        contextLabel = new Label(contextBar, SWT.NONE);
        contextLabel.setText("No file context - Select code in the editor");
        contextLabel.setFont(labelFont);
        contextLabel.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));
    }

    private void createInputArea(Composite parent) {
        Composite inputArea = new Composite(parent, SWT.NONE);
        inputArea.setLayout(new GridLayout(2, false));
        inputArea.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));

        // Text input
        inputField = new Text(inputArea, SWT.BORDER | SWT.SINGLE);
        inputField.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));
        inputField.setMessage("Ask about your code... (Enter to send)");

        // Send button
        Button sendButton = new Button(inputArea, SWT.PUSH);
        sendButton.setText("➤");
        sendButton.setToolTipText("Send message");
        sendButton.addListener(SWT.Selection, e -> sendMessage());

        // Enter key handler
        inputField.addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (e.keyCode == SWT.CR || e.keyCode == SWT.KEYPAD_CR) {
                    sendMessage();
                }
            }
        });
    }

    private void sendMessage() {
        String text = inputField.getText().trim();
        if (text.isEmpty())
            return;

        inputField.setText("");

        // Add user message
        addMessage(ChatMessage.userMessage(text));

        // Process the message
        processUserMessage(text);
    }

    private void processUserMessage(String text) {
        String lowerText = text.toLowerCase();

        // Show loading
        ChatMessage loading = ChatMessage.loading();
        addMessage(loading);

        // Process in background thread
        new Thread(() -> {
            try {
                String response;
                ChatMessage resultMessage;

                if (lowerText.contains("explain") && currentSelection != null) {
                    response = explainCode(currentSelection);
                    resultMessage = ChatMessage.codeExplanation(response, currentSelection, currentFileName);
                } else if (lowerText.contains("improve") || lowerText.contains("suggest")) {
                    response = improveCode(currentSelection);
                    resultMessage = ChatMessage.codeSuggestion(response, currentSelection, currentFileName, -1);
                } else if (lowerText.contains("refactor")) {
                    response = refactorCode(currentSelection);
                    resultMessage = ChatMessage.codeSuggestion(response, currentSelection, currentFileName, -1);
                } else {
                    // General question
                    response = askQuestion(text);
                    resultMessage = ChatMessage.assistantMessage(response);
                }

                final ChatMessage finalResult = resultMessage;
                Display.getDefault().asyncExec(() -> {
                    removeMessage(loading);
                    addMessage(finalResult);
                });

            } catch (Exception e) {
                Display.getDefault().asyncExec(() -> {
                    removeMessage(loading);
                    addMessage(ChatMessage.error("Error: " + e.getMessage()));
                });
            }
        }).start();
    }

    private String explainCode(String code) {
        OpenAIService service = new OpenAIService();
        if (!service.isConfigured()) {
            return "⚠️ OpenAI API key not configured.\n\nPlease set it in Preferences > ABAP AI Assistant.";
        }
        return service.explainCode(code != null ? code : "No code selected");
    }

    private String improveCode(String code) {
        OpenAIService service = new OpenAIService();
        if (!service.isConfigured()) {
            return "⚠️ OpenAI API key not configured.\n\nPlease set it in Preferences > ABAP AI Assistant.";
        }
        return service.analyzeCode(code != null ? code : "No code selected");
    }

    private String refactorCode(String code) {
        OpenAIService service = new OpenAIService();
        if (!service.isConfigured()) {
            return "⚠️ OpenAI API key not configured.\n\nPlease set it in Preferences > ABAP AI Assistant.";
        }
        return service.refactorCode(code != null ? code : "No code selected");
    }

    private String askQuestion(String question) {
        OpenAIService service = new OpenAIService();
        if (!service.isConfigured()) {
            return "⚠️ OpenAI API key not configured.\n\nPlease set it in Preferences > ABAP AI Assistant.";
        }

        String context = currentSelection != null
                ? "Context code:\n```\n" + currentSelection + "\n```\n\nQuestion: " + question
                : question;
        return service.askQuestion(context);
    }

    public void addMessage(ChatMessage message) {
        messages.add(message);

        Display.getDefault().asyncExec(() -> {
            if (messagesContainer == null || messagesContainer.isDisposed())
                return;

            Composite bubble = createMessageBubble(messagesContainer, message);

            // Refresh layout
            messagesContainer.layout(true, true);
            scrolledComposite.setMinSize(messagesContainer.computeSize(SWT.DEFAULT, SWT.DEFAULT));

            // Scroll to bottom
            scrolledComposite.setOrigin(0, messagesContainer.getSize().y);
        });
    }

    public void removeMessage(ChatMessage message) {
        messages.remove(message);
        Display.getDefault().asyncExec(this::refreshMessages);
    }

    private void refreshMessages() {
        if (messagesContainer == null || messagesContainer.isDisposed())
            return;

        // Clear all children
        for (org.eclipse.swt.widgets.Control child : messagesContainer.getChildren()) {
            child.dispose();
        }

        // Recreate message bubbles
        for (ChatMessage msg : messages) {
            createMessageBubble(messagesContainer, msg);
        }

        messagesContainer.layout(true, true);
        scrolledComposite.setMinSize(messagesContainer.computeSize(SWT.DEFAULT, SWT.DEFAULT));
    }

    private Composite createMessageBubble(Composite parent, ChatMessage message) {
        Composite bubble = new Composite(parent, SWT.NONE);
        bubble.setLayout(new GridLayout(1, false));

        GridData gd = new GridData(SWT.FILL, SWT.TOP, true, false);
        gd.horizontalIndent = message.getRole() == MessageRole.USER ? 50 : 0;
        gd.widthHint = 400;
        bubble.setLayoutData(gd);

        // Set background color
        Color bgColor;
        switch (message.getType()) {
            case ERROR:
                bgColor = errorColor;
                break;
            case LOADING:
                bgColor = parent.getDisplay().getSystemColor(SWT.COLOR_WIDGET_LIGHT_SHADOW);
                break;
            default:
                bgColor = message.getRole() == MessageRole.USER ? userBubbleColor : assistantBubbleColor;
        }
        bubble.setBackground(bgColor);

        // Role indicator
        Label roleLabel = new Label(bubble, SWT.NONE);
        roleLabel.setFont(labelFont);
        roleLabel.setBackground(bgColor);
        if (message.getRole() == MessageRole.USER) {
            roleLabel.setText("You • " + message.getFormattedTime());
        } else if (message.getType() == MessageType.LOADING) {
            roleLabel.setText("⏳ AI Assistant");
        } else {
            roleLabel.setText("🤖 AI Assistant • " + message.getFormattedTime());
        }

        // Message content
        Label contentLabel = new Label(bubble, SWT.WRAP);
        contentLabel.setText(message.getContent());
        contentLabel.setBackground(bgColor);
        GridData contentGd = new GridData(SWT.FILL, SWT.TOP, true, false);
        contentGd.widthHint = 380;
        contentLabel.setLayoutData(contentGd);

        // Code block (if present)
        if (message.hasCode()) {
            createCodeBlock(bubble, message);
        }

        // Action buttons for code suggestions
        if (message.canApply()) {
            createActionButtons(bubble, message);
        }

        return bubble;
    }

    private void createCodeBlock(Composite parent, ChatMessage message) {
        Label codeLabel = new Label(parent, SWT.NONE);
        codeLabel.setText("📄 " + (message.getFileName() != null ? message.getFileName() : "Code"));
        codeLabel.setFont(labelFont);

        StyledText codeText = new StyledText(parent, SWT.BORDER | SWT.MULTI | SWT.V_SCROLL | SWT.H_SCROLL);
        codeText.setFont(monoFont);
        codeText.setText(message.getCodeContent());
        codeText.setEditable(false);
        codeText.setBackground(codeBlockColor);
        codeText.setForeground(parent.getDisplay().getSystemColor(SWT.COLOR_WHITE));

        GridData codeGd = new GridData(SWT.FILL, SWT.TOP, true, false);
        codeGd.heightHint = 100;
        codeText.setLayoutData(codeGd);
    }

    private void createActionButtons(Composite parent, ChatMessage message) {
        Composite buttons = new Composite(parent, SWT.NONE);
        buttons.setLayout(new RowLayout(SWT.HORIZONTAL));
        buttons.setBackground(parent.getBackground());

        Button copyBtn = new Button(buttons, SWT.PUSH);
        copyBtn.setText("📋 Copy");
        copyBtn.addListener(SWT.Selection, e -> {
            if (message.hasCode()) {
                copyToClipboard(message.getCodeContent());
            }
        });

        Button applyBtn = new Button(buttons, SWT.PUSH);
        applyBtn.setText("✓ Apply");
        applyBtn.addListener(SWT.Selection, e -> {
            // TODO: Apply the code change to the editor
            addMessage(ChatMessage.assistantMessage("Applied the code change! (Implementation pending)"));
        });
    }

    private void copyToClipboard(String text) {
        Clipboard clipboard = new Clipboard(Display.getDefault());
        clipboard.setContents(
                new Object[] { text },
                new Transfer[] { TextTransfer.getInstance() });
        clipboard.dispose();
    }

    /**
     * Set the current context (called from handlers)
     */
    public void setContext(String fileName, String selection) {
        this.currentFileName = fileName;
        this.currentSelection = selection;

        Display.getDefault().asyncExec(() -> {
            if (contextLabel != null && !contextLabel.isDisposed()) {
                if (fileName != null && selection != null) {
                    int lines = selection.split("\n").length;
                    contextLabel.setText(String.format("📄 %s (%d lines selected)", fileName, lines));
                } else if (fileName != null) {
                    contextLabel.setText("📄 " + fileName);
                } else {
                    contextLabel.setText("No file context - Select code in the editor");
                }
            }
        });
    }

    /**
     * Add suggestions from code analysis
     */
    public void addSuggestions(List<CodeSuggestion> suggestions, IFile file) {
        String fileName = file != null ? file.getName() : "Unknown file";

        // Set context
        setContext(fileName, null);

        // Add header message showing analysis results
        String headerText = String.format("🔍 **Analysis Complete for %s**\n\nFound %d suggestion%s:",
                fileName,
                suggestions.size(),
                suggestions.size() == 1 ? "" : "s");
        addMessage(ChatMessage.assistantMessage(headerText));

        // Add each suggestion as a separate message
        for (CodeSuggestion suggestion : suggestions) {
            // Build formatted message with severity icon and line number
            String severityIcon;
            switch (suggestion.getSeverity()) {
                case ERROR:
                    severityIcon = "🔴";
                    break;
                case WARNING:
                    severityIcon = "🟡";
                    break;
                default:
                    severityIcon = "🔵";
            }

            StringBuilder content = new StringBuilder();
            content.append(severityIcon).append(" **Line ").append(suggestion.getLineNumber()).append("**: ");
            content.append(suggestion.getMessage());

            // Add detailed description if available
            if (suggestion.getDetailedDescription() != null && !suggestion.getDetailedDescription().isEmpty()) {
                content.append("\n\n").append(suggestion.getDetailedDescription());
            }

            ChatMessage msg = new ChatMessage.Builder()
                    .role(MessageRole.ASSISTANT)
                    .type(MessageType.CODE_SUGGESTION)
                    .content(content.toString())
                    .file(fileName)
                    .line(suggestion.getLineNumber())
                    .build();
            addMessage(msg);
        }
    }

    public void clearSuggestions() {
        messages.clear();
        Display.getDefault().asyncExec(this::refreshMessages);
    }

    public void clearSuggestionsForFile(IFile file) {
        messages.removeIf(msg -> {
            String fileName = msg.getFileName();
            return fileName != null && fileName.equals(file.getName());
        });
        Display.getDefault().asyncExec(this::refreshMessages);
    }

    private void createActions() {
        clearAction = new Action() {
            @Override
            public void run() {
                clearSuggestions();
                addMessage(ChatMessage.assistantMessage("Chat cleared. How can I help you?"));
            }
        };
        clearAction.setText("Clear");
        clearAction.setToolTipText("Clear chat history");
        clearAction.setImageDescriptor(PlatformUI.getWorkbench().getSharedImages()
                .getImageDescriptor(ISharedImages.IMG_ELCL_REMOVE));

        settingsAction = new Action() {
            @Override
            public void run() {
                // Open preferences
                org.eclipse.ui.dialogs.PreferencesUtil.createPreferenceDialogOn(
                        PlatformUI.getWorkbench().getActiveWorkbenchWindow().getShell(),
                        "com.abap.ai.assistant.preferences",
                        null, null).open();
            }
        };
        settingsAction.setText("Settings");
        settingsAction.setToolTipText("Open AI Assistant settings");
        settingsAction.setImageDescriptor(PlatformUI.getWorkbench().getSharedImages()
                .getImageDescriptor(ISharedImages.IMG_OBJS_INFO_TSK));
    }

    private void createMenuAndToolbar() {
        IActionBars bars = getViewSite().getActionBars();
        IMenuManager menuManager = bars.getMenuManager();
        IToolBarManager toolBarManager = bars.getToolBarManager();

        menuManager.add(clearAction);
        menuManager.add(new Separator());
        menuManager.add(settingsAction);

        toolBarManager.add(clearAction);
        toolBarManager.add(settingsAction);
    }

    @Override
    public void setFocus() {
        if (inputField != null && !inputField.isDisposed()) {
            inputField.setFocus();
        }
    }

    @Override
    public void dispose() {
        // Dispose colors and fonts
        if (userBubbleColor != null && !userBubbleColor.isDisposed())
            userBubbleColor.dispose();
        if (assistantBubbleColor != null && !assistantBubbleColor.isDisposed())
            assistantBubbleColor.dispose();
        if (codeBlockColor != null && !codeBlockColor.isDisposed())
            codeBlockColor.dispose();
        if (errorColor != null && !errorColor.isDisposed())
            errorColor.dispose();
        if (monoFont != null && !monoFont.isDisposed())
            monoFont.dispose();
        if (labelFont != null && !labelFont.isDisposed())
            labelFont.dispose();

        super.dispose();
    }

    /**
     * Static method to get the view instance
     */
    public static AISuggestionsView getInstance() {
        try {
            return (AISuggestionsView) PlatformUI.getWorkbench()
                    .getActiveWorkbenchWindow()
                    .getActivePage()
                    .findView(ID);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Static method to show the view
     */
    public static AISuggestionsView showView() {
        try {
            return (AISuggestionsView) PlatformUI.getWorkbench()
                    .getActiveWorkbenchWindow()
                    .getActivePage()
                    .showView(ID);
        } catch (Exception e) {
            e.printStackTrace();
            return null;
        }
    }
}
