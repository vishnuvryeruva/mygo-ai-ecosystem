# ABAP AI Assistant - Setup Guide

## Prerequisites

- Eclipse IDE (2020-12 or later)
- Java 21 or higher
- Eclipse Plugin Development Environment (PDE)
- OpenAI API Key

## Setup Instructions

### 1. Download Dependencies

This plugin requires the `org.json` library for JSON parsing. Download it before building:

```bash
# Navigate to the lib directory
cd lib/

# Download org.json library
curl -L -o org.json-20240303.jar \
  "https://repo1.maven.org/maven2/org/json/json/20240303/json-20240303.jar"
```

Or manually download from:
- https://mvnrepository.com/artifact/org.json/json/20240303

### 2. Import into Eclipse

1. Open Eclipse with PDE (Plugin Development Environment)
2. Go to `File > Import > Existing Projects into Workspace`
3. Select the plugin directory: `/Users/maaz/sites/abap-ai-assistant-tutorial`
4. Click "Finish"

### 3. Verify Build

1. The project should compile without errors
2. Check that `lib/org.json-20240303.jar` is present
3. Verify Java 21 is configured in Project Properties

### 4. Test the Plugin

1. Right-click on the project
2. Select `Run As > Eclipse Application`
3. A new Eclipse instance will launch with the plugin installed

### 5. Configure OpenAI API

In the new Eclipse instance:

1. Open Preferences:
   - **macOS**: `Eclipse > Preferences` (or press `⌘,`)
   - **Windows/Linux**: `Window > Preferences`
2. Navigate to `ABAP AI Assistant`
3. Enter your OpenAI API key
4. Select your preferred model (GPT-4o-mini recommended)
5. Click "Test OpenAI Connection" to verify
6. Click "Apply and Close"

## Getting an OpenAI API Key

1. Visit https://platform.openai.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key and paste it into the plugin preferences

**Important:** Keep your API key secure and never commit it to version control!

## Configuration Options

### OpenAI Settings

- **Use OpenAI**: Toggle between AI-powered and rule-based analysis
- **API Key**: Your OpenAI API key (stored securely in Eclipse preferences)
- **Model**: Choose from available models:
  - `gpt-4o-mini` (Recommended - Fast and cost-effective)
  - `gpt-4o` (Most capable)
  - `gpt-4-turbo` (Balanced performance)
  - `gpt-3.5-turbo` (Budget option)

### Analysis Options

- **Enable automatic code analysis**: Analyze files on save
- **Check naming conventions**: Monitor variable naming patterns
- **Check performance patterns**: Detect performance issues
- **Suggest modern ABAP syntax**: Recommend contemporary syntax
- **Minimum pattern frequency**: Threshold for pattern-based suggestions

## Usage

### First-Time Setup in User's Eclipse

1. Create or open an ABAP project
2. Right-click on the project
3. Select `Configure > Add ABAP AI Nature`
4. Create `.abap` files in your project
5. The plugin will automatically analyze them on save

### Manual Analysis

- Right-click on an `.abap` file
- Select `ABAP AI Assistant > Analyze Code`

### Refresh Patterns

- Right-click anywhere in the project
- Select `ABAP AI Assistant > Refresh Patterns`
- This rebuilds the pattern database from all project files

## Troubleshooting

### JSON Library Not Found

If you see compilation errors about `JSONObject` or `JSONArray`:

1. Ensure `lib/org.json-20240303.jar` exists
2. Check `.classpath` includes the library
3. Clean and rebuild: `Project > Clean`

### OpenAI Connection Failed

1. Verify your API key is correct
2. Check internet connectivity
3. Ensure you have available OpenAI credits
4. Check the Error Log: `Window > Show View > Error Log`

### Plugin Not Appearing

1. Verify all dependencies in `MANIFEST.MF` are satisfied
2. Check for errors in Error Log
3. Try `Project > Clean` and rebuild

### API Key Storage

API keys are stored in Eclipse preferences:
- Location: `<workspace>/.metadata/.plugins/org.eclipse.core.runtime/.settings/com.abap.ai.assistant.prefs`
- The key is stored in plain text in preferences (consider encryption for production use)

## Cost Considerations

OpenAI API usage incurs costs:

- **GPT-4o-mini**: ~$0.15 per 1M input tokens (most economical)
- **GPT-4o**: ~$2.50 per 1M input tokens
- **GPT-4-turbo**: ~$10 per 1M input tokens

**Typical Usage:**
- Small file (100 lines): ~500 tokens = $0.0001 with gpt-4o-mini
- Large file (1000 lines): ~5000 tokens = $0.001 with gpt-4o-mini

**Tips to minimize costs:**
1. Use `gpt-4o-mini` for most cases
2. Disable auto-analysis if not needed
3. Use manual analysis only when required
4. Consider rule-based mode for simple checks

## Development

### Building from Source

```bash
# Clone repository
git clone [repository-url]
cd abap-ai-assistant-tutorial

# Download dependencies
cd lib/
curl -L -o org.json-20240303.jar \
  "https://repo1.maven.org/maven2/org/json/json/20240303/json-20240303.jar"
cd ..

# Import into Eclipse and build
```

### Exporting the Plugin

1. Right-click project
2. `Export > Plug-in Development > Deployable plug-ins and fragments`
3. Select destination
4. Click "Finish"
5. Copy generated JAR to Eclipse `dropins` folder

## Security Notes

⚠️ **Important Security Considerations:**

1. **API Keys**: Never commit API keys to version control
2. **Code Privacy**: Your code is sent to OpenAI for analysis
3. **Data Handling**: Ensure compliance with your organization's policies
4. **Network**: Plugin requires internet access for AI features

## Support

For issues and questions:
- Check the Error Log: `Window > Show View > Error Log`
- Review this documentation
- Create an issue in the repository

## Next Steps

After setup:
1. ✅ Configure your OpenAI API key
2. ✅ Test the connection
3. ✅ Create a test ABAP project
4. ✅ Add the ABAP AI Nature to the project
5. ✅ Create `.abap` files and watch the suggestions appear!

---

**Version**: 1.0.0  
**Java Version**: 21  
**Last Updated**: November 2025


