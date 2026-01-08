# ABAP AI Assistant - Eclipse Plugin

An intelligent Eclipse IDE plugin that uses **OpenAI GPT models** to analyze ABAP code and provide context-aware suggestions based on your project's coding practices and patterns.

> 🤖 **Powered by OpenAI** - This plugin leverages GPT-4o-mini and other OpenAI models to provide intelligent, AI-driven code suggestions tailored to your ABAP projects.

---

**⚡ Quick Start**: See [QUICKSTART.md](QUICKSTART.md) for 5-minute setup guide  
**🔑 API Setup**: See [API_KEY_SETUP.md](API_KEY_SETUP.md) for OpenAI configuration  
**📖 Full Setup**: See [SETUP.md](SETUP.md) for detailed instructions

---

## Features

### 🤖 **AI-Powered Analysis**
- **OpenAI Integration**: Uses GPT-4o-mini (and other models) for intelligent code analysis
- **Context-Aware**: Understands your project's unique coding patterns
- **Natural Language Suggestions**: Clear, actionable feedback in plain English
- **Adaptive Learning**: Learns from your codebase to provide relevant suggestions

### 🔍 **Pattern Learning**
- Automatically learns coding patterns from your entire project
- Detects naming conventions (variable prefixes, suffixes)
- Identifies preferred coding styles (OO vs procedural)
- Recognizes loop patterns and conditional statement preferences
- Sends pattern context to AI for more relevant suggestions

### 💡 **Smart Suggestions**
- **Naming Convention Checks**: AI validates variable names against project standards
- **Performance Optimization**: Intelligent suggestions for better-performing code
- **Modern Syntax**: Contextual recommendations for contemporary ABAP
- **Code Quality**: AI detects potential bugs, anti-patterns, and improvements
- **Best Practices**: Suggestions aligned with ABAP development standards

### ⚡ **Flexible Analysis Modes**
- **AI Mode**: Full GPT-powered analysis (recommended)
- **Rule-Based Mode**: Fast, offline analysis using pattern matching
- **Hybrid Mode**: Falls back to rules if AI is unavailable
- Automatic analysis on file save
- Builder integration for project-wide checks
- Marker annotations in the editor

### 🎯 **User-Friendly Interface**
- Right-click context menu for manual analysis
- Integration with Eclipse Problems view
- Customizable preferences with API key management
- Test connection button for OpenAI verification
- Severity levels (Info, Warning, Error)
- Detailed explanations for each suggestion

## Installation

### Prerequisites
- Eclipse IDE (2020-12 or later)
- Java 21 or higher
- Eclipse Plugin Development Environment (PDE)
- **OpenAI API Key** (get one at https://platform.openai.com/)

### Quick Setup

See detailed setup instructions in [SETUP.md](SETUP.md)

**Short version:**

1. **Download JSON Library**:
   ```bash
   cd lib/
   curl -L -o org.json-20240303.jar \
     "https://repo1.maven.org/maven2/org/json/json/20240303/json-20240303.jar"
   ```

2. **Import into Eclipse**:
   - `File > Import > Existing Projects into Workspace`
   - Select the plugin directory

3. **Run & Configure**:
   - `Run As > Eclipse Application`
   - In new instance: **Preferences** (macOS: `Eclipse > Preferences` or `⌘,`, Windows/Linux: `Window > Preferences`)
   - Navigate to `ABAP AI Assistant`
   - Enter your OpenAI API key
   - Test the connection

### Deployment
1. Export as deployable plugin:
   - `File > Export > Plug-in Development > Deployable plug-ins and fragments`
2. Copy the generated JAR to Eclipse's `dropins` folder
3. Restart Eclipse
4. Configure API key in preferences

## Usage

### Enabling the Plugin

1. **Add ABAP Nature to your project**:
   - Right-click project → Configure → Add ABAP AI Nature

2. **Automatic Analysis**:
   - The plugin automatically analyzes files when saved
   - Check the Problems view for suggestions

3. **Manual Analysis**:
   - Right-click on an `.abap` file
   - Select `ABAP AI Assistant > Analyze Code`

4. **Refresh Patterns**:
   - Right-click anywhere
   - Select `ABAP AI Assistant > Refresh Patterns`
   - Rebuilds pattern database from entire project

### Configuration

**Access preferences:**
- **macOS**: `Eclipse > Preferences > ABAP AI Assistant` (or press `⌘,`)
- **Windows/Linux**: `Window > Preferences > ABAP AI Assistant`

#### OpenAI Settings
- **Use OpenAI**: Enable/disable AI-powered analysis
- **API Key**: Your OpenAI API key (masked for security)
- **Model Selection**: Choose from:
  - GPT-4o-mini (Recommended - fast & cost-effective)
  - GPT-4o (Most capable)
  - GPT-4-turbo (Balanced)
  - GPT-3.5-turbo (Budget option)
- **Test Connection**: Verify your API key works

#### Analysis Options
- **Enable automatic code analysis**: Toggle real-time analysis
- **Check naming conventions**: Monitor variable naming patterns
- **Check performance patterns**: Detect performance issues
- **Suggest modern ABAP syntax**: Recommend contemporary syntax
- **Minimum pattern frequency**: Set threshold for pattern suggestions

## How It Works

### 1. Pattern Learning Phase
```
Project Files → Code Analyzer → Pattern Database
```
- Scans all `.abap` files in the project
- Extracts patterns (naming, syntax, structure)
- Builds statistical model of coding preferences
- Creates context summary for AI

### 2. AI Analysis Phase (When OpenAI is enabled)
```
Current File + Project Patterns → OpenAI GPT → Intelligent Suggestions
```
- Reads the ABAP file content
- Includes learned project patterns as context
- Sends to OpenAI API with specialized prompt
- AI analyzes code considering:
  - Project-specific conventions
  - ABAP best practices
  - Performance implications
  - Potential bugs
  - Modern syntax alternatives
- Returns structured suggestions with explanations

### 3. Rule-Based Fallback (When AI is disabled or unavailable)
```
Current File → Analyzer → Pattern Matching → Generate Suggestions
```
- Analyzes individual file syntax
- Compares against learned patterns
- Generates rule-based suggestions

### 3. Suggestion Types

#### Naming Conventions
```abap
" Detected pattern: lv_ prefix for local variables
DATA: myvar TYPE string.  " ⚠️ Consider using prefix 'lv_'
DATA: lv_myvar TYPE string.  " ✓ Follows convention
```

#### Loop Patterns
```abap
" Project prefers field symbols
LOOP AT lt_data INTO ls_data.  " ⚠️ Consider using FIELD-SYMBOL
LOOP AT lt_data ASSIGNING <ls_data>.  " ✓ Better performance
```

#### Modern Syntax
```abap
" Old style
CALL METHOD object->method( ).  " ℹ️ Use modern syntax

" Modern style
object->method( ).  " ✓ Cleaner syntax
```

## Architecture

```
com.abap.ai.assistant/
├── analyzer/
│   └── AbapCodeAnalyzer.java      # Core analysis engine
├── builder/
│   └── AbapBuilder.java           # Eclipse builder integration
├── model/
│   ├── CodePattern.java           # Pattern representation
│   └── CodeSuggestion.java        # Suggestion data model
├── nature/
│   └── AbapNature.java            # Project nature
├── handlers/
│   ├── AnalyzeCodeHandler.java    # Manual analysis command
│   └── RefreshPatternsHandler.java # Pattern refresh command
├── quickfix/
│   └── AbapQuickFixProcessor.java # Quick fix provider
├── preferences/
│   └── AbapAssistantPreferencePage.java # Settings UI
└── Activator.java                 # Plugin activator
```

## Supported ABAP Constructs

- ✅ Variable declarations (`DATA`, `TYPES`)
- ✅ Loop statements (`LOOP AT`, `WHILE`, `DO`)
- ✅ Conditional statements (`IF`, `CASE`)
- ✅ Method calls (procedural and OO style)
- ✅ Object-oriented constructs
- 🔜 Class definitions
- 🔜 Interface implementations
- 🔜 Database operations

## Extending the Plugin

### Adding New Pattern Detectors

1. Edit `AbapCodeAnalyzer.java`
2. Add new pattern detection in `analyzeLine()`:

```java
private void analyzeCustomPattern(String line) {
    // Your pattern detection logic
    if (line.matches("your_pattern")) {
        incrementCount(codingPatterns, "custom_pattern");
    }
}
```

3. Add suggestion generation:

```java
private List<CodeSuggestion> checkCustomPattern(String line, int lineNumber) {
    // Generate suggestions based on your pattern
}
```

### Adding New Quick Fixes

Create a new `IMarkerResolution` implementation in `AbapQuickFixProcessor.java`.

## Troubleshooting

### Plugin Not Showing in Eclipse
- Check that all dependencies are satisfied
- Verify `MANIFEST.MF` bundle requirements
- Check Eclipse error log: `Window > Show View > Error Log`

### Patterns Not Detected
- Ensure project has multiple `.abap` files
- Run "Refresh Patterns" command
- Check minimum pattern frequency in preferences

### Markers Not Appearing
- Verify ABAP nature is added to project
- Check if auto-build is enabled
- Manually trigger analysis via context menu

## Development

### Building from Source
```bash
# Clone repository
git clone [repository-url]
cd abap-ai-assistant-tutorial

# Import into Eclipse
# File > Import > Existing Projects into Workspace

# Run as Eclipse Application
# Right-click project > Run As > Eclipse Application
```

### Testing
1. Create a test ABAP project in the runtime workspace
2. Add `.abap` files with various patterns
3. Verify suggestions appear correctly

## Contributing

Contributions welcome! Areas for improvement:
- Additional pattern detectors
- Machine learning integration
- SAP ADT integration
- Code fix automation
- Custom rule configuration

## License

[Specify your license here]

## Support

For issues and questions:
- Create an issue in the repository
- Check the Eclipse error log for debugging
- Review the documentation

## Roadmap

- [ ] Machine learning-based pattern recognition
- [ ] Integration with SAP ADT (ABAP Development Tools)
- [ ] Custom rule configuration via JSON
- [ ] Automated code refactoring
- [ ] Team-shared pattern libraries
- [ ] Performance analytics dashboard
- [ ] Support for additional ABAP constructs

---

**Version**: 1.0.0  
**Last Updated**: November 2025

