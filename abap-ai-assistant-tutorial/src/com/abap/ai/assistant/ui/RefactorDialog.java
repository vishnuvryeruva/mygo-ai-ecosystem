package com.abap.ai.assistant.ui;

import java.util.List;

import org.eclipse.jface.dialogs.Dialog;
import org.eclipse.jface.dialogs.IDialogConstants;
import org.eclipse.swt.SWT;
import org.eclipse.swt.custom.SashForm;
import org.eclipse.swt.custom.StyleRange;
import org.eclipse.swt.custom.StyledText;
import org.eclipse.swt.dnd.Clipboard;
import org.eclipse.swt.dnd.TextTransfer;
import org.eclipse.swt.dnd.Transfer;
import org.eclipse.swt.graphics.Color;
import org.eclipse.swt.graphics.Font;
import org.eclipse.swt.graphics.FontData;
import org.eclipse.swt.layout.GridData;
import org.eclipse.swt.layout.GridLayout;
import org.eclipse.swt.widgets.Button;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Control;
import org.eclipse.swt.widgets.Display;
import org.eclipse.swt.widgets.Label;
import org.eclipse.swt.widgets.Shell;
import org.eclipse.swt.widgets.Text;

import com.abap.ai.assistant.ui.DiffUtils.DiffLine;
import com.abap.ai.assistant.ui.DiffUtils.DiffType;

/**
 * Enhanced dialog for showing original and refactored code with diff
 * highlighting
 * Inspired by modern IDEs like VS Code, Cursor, and GitHub
 */
public class RefactorDialog extends Dialog {

    private String originalCode;
    private String refactoredCode;
    private String finalRefactoredCode;
    private Text refactoredText;
    private StyledText diffView;

    // Colors for diff highlighting
    private Color addedBackground;
    private Color removedBackground;
    private Color addedForeground;
    private Color removedForeground;

    private Font monoFont;

    public RefactorDialog(Shell parentShell, String originalCode, String refactoredCode) {
        super(parentShell);
        this.originalCode = originalCode;
        this.refactoredCode = refactoredCode;
        this.finalRefactoredCode = refactoredCode;
        setShellStyle(getShellStyle() | SWT.RESIZE | SWT.MAX);
    }

    @Override
    protected void configureShell(Shell newShell) {
        super.configureShell(newShell);
        newShell.setText("AI Code Refactoring");
        newShell.setSize(1000, 700);

        // Initialize colors
        Display display = newShell.getDisplay();
        addedBackground = new Color(display, 230, 255, 230); // Light green
        removedBackground = new Color(display, 255, 230, 230); // Light red
        addedForeground = new Color(display, 0, 128, 0); // Dark green
        removedForeground = new Color(display, 180, 0, 0); // Dark red

        // Create monospace font
        FontData[] fontData = display.getSystemFont().getFontData();
        for (FontData fd : fontData) {
            fd.setName("Menlo"); // macOS monospace font
            fd.setHeight(12);
        }
        monoFont = new Font(display, fontData);
    }

    @Override
    protected Control createDialogArea(Composite parent) {
        Composite container = (Composite) super.createDialogArea(parent);
        container.setLayout(new GridLayout(1, false));

        // Header with info and action buttons
        createHeader(container);

        // Main content - tabs for different views
        createMainContent(container);

        return container;
    }

    private void createHeader(Composite parent) {
        Composite header = new Composite(parent, SWT.NONE);
        header.setLayout(new GridLayout(3, false));
        header.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));

        // Info label
        Label infoLabel = new Label(header, SWT.NONE);
        infoLabel.setText("🔄 AI has suggested changes to your code. Review the diff below.");
        infoLabel.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));

        // Copy button
        Button copyButton = new Button(header, SWT.PUSH);
        copyButton.setText("📋 Copy New Code");
        copyButton.addListener(SWT.Selection, e -> copyToClipboard());

        // Stats label
        List<DiffLine> diff = DiffUtils.computeDiff(originalCode, refactoredCode);
        int additions = 0, deletions = 0;
        for (DiffLine line : diff) {
            if (line.getType() == DiffType.ADDED)
                additions++;
            if (line.getType() == DiffType.REMOVED)
                deletions++;
        }
        Label statsLabel = new Label(header, SWT.NONE);
        statsLabel.setText(String.format("  +%d  -%d", additions, deletions));
        statsLabel.setForeground(parent.getDisplay().getSystemColor(SWT.COLOR_DARK_GRAY));
    }

    private void createMainContent(Composite parent) {
        // Tab-like buttons
        Composite tabBar = new Composite(parent, SWT.NONE);
        tabBar.setLayout(new GridLayout(2, false));
        tabBar.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));

        Button diffViewBtn = new Button(tabBar, SWT.TOGGLE);
        diffViewBtn.setText("📊 Diff View");
        diffViewBtn.setSelection(true);

        Button sideBySideBtn = new Button(tabBar, SWT.TOGGLE);
        sideBySideBtn.setText("↔ Side by Side");

        // Content area
        Composite content = new Composite(parent, SWT.NONE);
        content.setLayout(new GridLayout(1, false));
        content.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));

        // Create diff view (default)
        diffView = new StyledText(content, SWT.MULTI | SWT.V_SCROLL | SWT.H_SCROLL | SWT.BORDER);
        diffView.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));
        diffView.setFont(monoFont);
        diffView.setEditable(false);

        // Populate diff view
        populateDiffView();

        // Side by side panel (hidden initially)
        SashForm sideBySide = new SashForm(content, SWT.HORIZONTAL);
        sideBySide.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));
        sideBySide.setVisible(false);
        ((GridData) sideBySide.getLayoutData()).exclude = true;

        createSideBySideView(sideBySide);

        // Toggle between views
        diffViewBtn.addListener(SWT.Selection, e -> {
            if (diffViewBtn.getSelection()) {
                sideBySideBtn.setSelection(false);
                diffView.setVisible(true);
                ((GridData) diffView.getLayoutData()).exclude = false;
                sideBySide.setVisible(false);
                ((GridData) sideBySide.getLayoutData()).exclude = true;
                content.layout(true);
            }
        });

        sideBySideBtn.addListener(SWT.Selection, e -> {
            if (sideBySideBtn.getSelection()) {
                diffViewBtn.setSelection(false);
                diffView.setVisible(false);
                ((GridData) diffView.getLayoutData()).exclude = true;
                sideBySide.setVisible(true);
                ((GridData) sideBySide.getLayoutData()).exclude = false;
                content.layout(true);
            }
        });
    }

    private void populateDiffView() {
        List<DiffLine> diff = DiffUtils.computeDiff(originalCode, refactoredCode);
        StringBuilder sb = new StringBuilder();
        java.util.List<StyleRange> styles = new java.util.ArrayList<>();

        int lineNum = 1;
        for (DiffLine line : diff) {
            int start = sb.length();
            String prefix;
            Color bg = null;
            Color fg = null;

            switch (line.getType()) {
                case ADDED:
                    prefix = "+ ";
                    bg = addedBackground;
                    fg = addedForeground;
                    break;
                case REMOVED:
                    prefix = "- ";
                    bg = removedBackground;
                    fg = removedForeground;
                    break;
                default:
                    prefix = "  ";
            }

            String lineText = String.format("%4d %s%s\n", lineNum, prefix, line.getContent());
            sb.append(lineText);

            if (bg != null) {
                StyleRange style = new StyleRange();
                style.start = start;
                style.length = lineText.length() - 1; // Exclude newline
                style.background = bg;
                style.foreground = fg;
                styles.add(style);
            }

            lineNum++;
        }

        diffView.setText(sb.toString());
        for (StyleRange style : styles) {
            diffView.setStyleRange(style);
        }
    }

    private void createSideBySideView(SashForm parent) {
        // Left panel - Original Code
        Composite leftPanel = new Composite(parent, SWT.NONE);
        leftPanel.setLayout(new GridLayout(1, false));

        Label originalLabel = new Label(leftPanel, SWT.NONE);
        originalLabel.setText("📄 Original Code");
        originalLabel.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));

        StyledText originalText = new StyledText(leftPanel, SWT.MULTI | SWT.BORDER | SWT.V_SCROLL | SWT.H_SCROLL);
        originalText.setFont(monoFont);
        originalText.setEditable(false);
        originalText.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));

        // Add line numbers to original
        StringBuilder origWithLines = new StringBuilder();
        String[] origLines = originalCode.split("\n", -1);
        for (int i = 0; i < origLines.length; i++) {
            origWithLines.append(String.format("%4d | %s\n", i + 1, origLines[i]));
        }
        originalText.setText(origWithLines.toString());
        originalText.setBackground(parent.getDisplay().getSystemColor(SWT.COLOR_WIDGET_BACKGROUND));

        // Right panel - Refactored Code (editable)
        Composite rightPanel = new Composite(parent, SWT.NONE);
        rightPanel.setLayout(new GridLayout(1, false));

        Label refactoredLabel = new Label(rightPanel, SWT.NONE);
        refactoredLabel.setText("✨ Refactored Code (Editable)");
        refactoredLabel.setLayoutData(new GridData(SWT.FILL, SWT.CENTER, true, false));

        refactoredText = new Text(rightPanel, SWT.MULTI | SWT.BORDER | SWT.V_SCROLL | SWT.H_SCROLL);
        refactoredText.setFont(monoFont);
        refactoredText.setText(refactoredCode);
        refactoredText.setLayoutData(new GridData(SWT.FILL, SWT.FILL, true, true));

        // Set equal weights for both panels
        parent.setWeights(new int[] { 1, 1 });
    }

    private void copyToClipboard() {
        Clipboard clipboard = new Clipboard(getShell().getDisplay());
        String textToCopy = refactoredText != null && !refactoredText.isDisposed()
                ? refactoredText.getText()
                : refactoredCode;
        clipboard.setContents(
                new Object[] { textToCopy },
                new Transfer[] { TextTransfer.getInstance() });
        clipboard.dispose();
    }

    @Override
    protected void createButtonsForButtonBar(Composite parent) {
        createButton(parent, IDialogConstants.OK_ID, "✓ Accept Changes", true);
        createButton(parent, IDialogConstants.CANCEL_ID, "✗ Reject", false);
    }

    @Override
    protected void okPressed() {
        if (refactoredText != null && !refactoredText.isDisposed()) {
            finalRefactoredCode = refactoredText.getText();
        }
        super.okPressed();
    }

    @Override
    public boolean close() {
        // Dispose colors and fonts
        if (addedBackground != null && !addedBackground.isDisposed())
            addedBackground.dispose();
        if (removedBackground != null && !removedBackground.isDisposed())
            removedBackground.dispose();
        if (addedForeground != null && !addedForeground.isDisposed())
            addedForeground.dispose();
        if (removedForeground != null && !removedForeground.isDisposed())
            removedForeground.dispose();
        if (monoFont != null && !monoFont.isDisposed())
            monoFont.dispose();

        return super.close();
    }

    public String getRefactoredCode() {
        return finalRefactoredCode;
    }
}
