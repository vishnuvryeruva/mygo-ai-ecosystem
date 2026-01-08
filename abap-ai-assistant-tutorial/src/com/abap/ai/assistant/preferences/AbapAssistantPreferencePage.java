package com.abap.ai.assistant.preferences;

import org.eclipse.jface.dialogs.MessageDialog;
import org.eclipse.jface.preference.BooleanFieldEditor;
import org.eclipse.jface.preference.ComboFieldEditor;
import org.eclipse.jface.preference.FieldEditorPreferencePage;
import org.eclipse.jface.preference.IntegerFieldEditor;
import org.eclipse.jface.preference.StringFieldEditor;
import org.eclipse.swt.SWT;
import org.eclipse.swt.events.SelectionAdapter;
import org.eclipse.swt.events.SelectionEvent;
import org.eclipse.swt.layout.GridData;
import org.eclipse.swt.widgets.Button;
import org.eclipse.swt.widgets.Composite;
import org.eclipse.swt.widgets.Label;
import org.eclipse.ui.IWorkbench;
import org.eclipse.ui.IWorkbenchPreferencePage;

import com.abap.ai.assistant.Activator;
import com.abap.ai.assistant.ai.OpenAIService;

/**
 * Preference page for ABAP AI Assistant
 */
public class AbapAssistantPreferencePage extends FieldEditorPreferencePage 
        implements IWorkbenchPreferencePage {

    public AbapAssistantPreferencePage() {
        super(GRID);
        setPreferenceStore(Activator.getDefault().getPreferenceStore());
        setDescription("Configure ABAP AI Assistant behavior");
    }

    @Override
    public void createFieldEditors() {
        // OpenAI Configuration Section
        Label openAiLabel = new Label(getFieldEditorParent(), SWT.NONE);
        openAiLabel.setText("OpenAI Configuration:");
        openAiLabel.setFont(org.eclipse.jface.resource.JFaceResources.getFontRegistry().getBold(
            org.eclipse.jface.resource.JFaceResources.DEFAULT_FONT));
        GridData gd = new GridData();
        gd.horizontalSpan = 3;
        openAiLabel.setLayoutData(gd);
        
        addField(new BooleanFieldEditor(
            "use_openai",
            "&Use OpenAI for AI-powered suggestions",
            getFieldEditorParent()
        ));
        
        StringFieldEditor apiKeyField = new StringFieldEditor(
            "openai_api_key",
            "OpenAI API Key:",
            getFieldEditorParent()
        );
        apiKeyField.getTextControl(getFieldEditorParent()).setEchoChar('*');
        addField(apiKeyField);
        
        String[][] models = {
            {"GPT-4o Mini (Recommended)", "gpt-4o-mini"},
            {"GPT-4o", "gpt-4o"},
            {"GPT-4 Turbo", "gpt-4-turbo"},
            {"GPT-3.5 Turbo", "gpt-3.5-turbo"}
        };
        addField(new ComboFieldEditor(
            "openai_model",
            "OpenAI Model:",
            models,
            getFieldEditorParent()
        ));
        
        // Test Connection Button
        Button testButton = new Button(getFieldEditorParent(), SWT.PUSH);
        testButton.setText("Test OpenAI Connection");
        GridData buttonGd = new GridData();
        buttonGd.horizontalSpan = 3;
        testButton.setLayoutData(buttonGd);
        testButton.addSelectionListener(new SelectionAdapter() {
            @Override
            public void widgetSelected(SelectionEvent e) {
                testOpenAIConnection();
            }
        });
        
        // Separator
        Label separator = new Label(getFieldEditorParent(), SWT.SEPARATOR | SWT.HORIZONTAL);
        GridData sepGd = new GridData(GridData.FILL_HORIZONTAL);
        sepGd.horizontalSpan = 3;
        separator.setLayoutData(sepGd);
        
        // Analysis Options Section
        Label analysisLabel = new Label(getFieldEditorParent(), SWT.NONE);
        analysisLabel.setText("Analysis Options:");
        analysisLabel.setFont(org.eclipse.jface.resource.JFaceResources.getFontRegistry().getBold(
            org.eclipse.jface.resource.JFaceResources.DEFAULT_FONT));
        GridData analysisGd = new GridData();
        analysisGd.horizontalSpan = 3;
        analysisLabel.setLayoutData(analysisGd);

        addField(new BooleanFieldEditor(
            "enableAutoAnalysis",
            "&Enable automatic code analysis",
            getFieldEditorParent()
        ));

        addField(new BooleanFieldEditor(
            "checkNamingConventions",
            "Check &naming conventions",
            getFieldEditorParent()
        ));

        addField(new BooleanFieldEditor(
            "checkPerformance",
            "Check &performance patterns",
            getFieldEditorParent()
        ));

        addField(new BooleanFieldEditor(
            "suggestModernSyntax",
            "Suggest &modern ABAP syntax",
            getFieldEditorParent()
        ));

        addField(new IntegerFieldEditor(
            "minPatternFrequency",
            "Minimum pattern frequency for suggestions:",
            getFieldEditorParent()
        ));
    }
    
    private void testOpenAIConnection() {
        try {
            // Save current values first
            performApply();
            
            // Get API key directly from preference store to test
            String apiKey = getPreferenceStore().getString("openai_api_key");
            
            if (apiKey == null || apiKey.trim().isEmpty()) {
                MessageDialog.openError(
                    getShell(),
                    "Configuration Error",
                    "Please enter your OpenAI API key before testing the connection."
                );
                return;
            }
            
            // Show testing dialog
            MessageDialog.openInformation(
                getShell(),
                "Testing Connection",
                "Testing connection to OpenAI API...\nThis may take a few seconds."
            );
            
            // Run in separate thread to avoid blocking UI
            new Thread(() -> {
                try {
                    OpenAIService service = new OpenAIService();
                    boolean success = service.testConnection();
                    
                    getShell().getDisplay().asyncExec(() -> {
                        if (success) {
                            MessageDialog.openInformation(
                                getShell(),
                                "Connection Successful",
                                "Successfully connected to OpenAI API!\n\n" +
                                "Your AI-powered ABAP suggestions are ready to use."
                            );
                        } else {
                            MessageDialog.openError(
                                getShell(),
                                "Connection Failed",
                                "Failed to connect to OpenAI API.\n\n" +
                                "Please check:\n" +
                                "- Your API key is correct\n" +
                                "- You have internet connectivity\n" +
                                "- Your OpenAI account has available credits"
                            );
                        }
                    });
                } catch (Exception e) {
                    getShell().getDisplay().asyncExec(() -> {
                        MessageDialog.openError(
                            getShell(),
                            "Connection Error",
                            "Error testing connection: " + e.getMessage() + "\n\n" +
                            "Check the Error Log for details."
                        );
                    });
                    e.printStackTrace();
                }
            }).start();
            
        } catch (Exception e) {
            MessageDialog.openError(
                getShell(),
                "Error",
                "Error testing connection: " + e.getMessage()
            );
            e.printStackTrace();
        }
    }

    @Override
    public void init(IWorkbench workbench) {
        // Initialize default values
        getPreferenceStore().setDefault("use_openai", true);
        getPreferenceStore().setDefault("openai_api_key", "");
        getPreferenceStore().setDefault("openai_model", "gpt-4o-mini");
        getPreferenceStore().setDefault("enableAutoAnalysis", true);
        getPreferenceStore().setDefault("checkNamingConventions", true);
        getPreferenceStore().setDefault("checkPerformance", true);
        getPreferenceStore().setDefault("suggestModernSyntax", true);
        getPreferenceStore().setDefault("minPatternFrequency", 3);
    }
}

