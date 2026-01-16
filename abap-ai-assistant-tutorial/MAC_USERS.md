# Quick Guide for macOS Users 🍎

## Key Differences on macOS

### 1. **Accessing Preferences**

**macOS:**
```
Eclipse > Preferences
```
or simply press: **`⌘,`** (Command + Comma)

**NOT** `Window > Preferences` (that's for Windows/Linux)

### 2. **Keyboard Shortcuts**

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Preferences | `⌘,` | N/A |
| Save File | `⌘S` | `Ctrl+S` |
| Build Project | `⌘B` | `Ctrl+B` |
| Run | `⌘⇧F11` | `Ctrl+Shift+F11` |

### 3. **Menu Bar Location**

On macOS, the menu bar is at the **top of the screen**, not in the application window.

### 4. **File Paths**

This guide uses absolute paths like:
```
/Users/maaz/sites/abap-ai-assistant-tutorial
```

Your username may be different. Use:
```bash
cd ~/sites/abap-ai-assistant-tutorial
```

## Quick Setup for Mac

### Step 1: Download Dependencies
```bash
cd /Users/maaz/sites/abap-ai-assistant-tutorial
chmod +x download-dependencies.sh
./download-dependencies.sh
```

### Step 2: Import into Eclipse
1. Open Eclipse
2. `File > Import > Existing Projects into Workspace`
3. Browse to the project folder
4. Click "Finish"

### Step 3: Run Plugin
1. Right-click project
2. `Run As > Eclipse Application`
3. New Eclipse window opens

### Step 4: Configure (The Mac Way!)
1. In the **new Eclipse window**
2. Press **`⌘,`** (or `Eclipse > Preferences`)
3. Type "ABAP" in the search box
4. Click "ABAP AI Assistant"
5. Enter your OpenAI API key
6. Select "GPT-4o-mini"
7. Click "Test OpenAI Connection"
8. ✓ Success!
9. Click "Apply and Close"

### Step 5: Test It
1. `File > New > Project > General > Project`
2. Name: `test-abap`
3. Right-click project → `New > File`
4. Name: `test.abap`
5. Add some ABAP code
6. Press `⌘S` to save
7. Check **Problems** view at bottom!

## Common Mac Issues

### Issue 1: "Permission Denied" on Script
**Solution:**
```bash
chmod +x download-dependencies.sh
./download-dependencies.sh
```

### Issue 2: Can't Find Preferences
**Solution:**
- Look at the **top of your screen** (menu bar)
- Click "Eclipse" (far left, next to Apple menu)
- Select "Preferences"
- Or just press: **`⌘,`**

### Issue 3: Java Version Issues
Check your Java version:
```bash
java -version
```

Should show Java 21. If not:
```bash
# Install via Homebrew
brew install openjdk@21

# Set JAVA_HOME
export JAVA_HOME=/opt/homebrew/opt/openjdk@21
```

### Issue 4: Eclipse Won't Start Plugin
1. Check Console in Eclipse (bottom panel)
2. Look for errors
3. Verify Java 21 is set in project properties:
   - Right-click project
   - `Properties > Java Build Path`
   - Should show JavaSE-21

## Mac Terminal Commands

### Navigate to Project
```bash
cd ~/sites/abap-ai-assistant-tutorial
```

### List Files
```bash
ls -la
```

### Check Git Status
```bash
git status
```

### View Hidden Files in Finder
Press: **`⌘⇧.`** (Command + Shift + Period)

## Screenshots for Mac

### Where to Find Preferences
```
┌─────────────────────────────────────┐
│ 🍎 │ Eclipse │ File │ Edit │ ...   │  ← Menu bar at top of screen
└─────────────────────────────────────┘
       │
       └─→ Click "Eclipse"
           └─→ Click "Preferences..." (⌘,)
```

### Preferences Window
```
┌──────────────────────────────────────────┐
│ Preferences                         ✕    │
├──────────┬───────────────────────────────┤
│          │                               │
│ General  │  ABAP AI Assistant            │
│ Team     │  ┌─────────────────────────┐ │
│ Install  │  │ OpenAI Configuration:   │ │
│ ABAP AI  │  │                         │ │
│ Assistant│  │ ☑ Use OpenAI           │ │
│   ←───   │  │                         │ │
│          │  │ API Key: **********    │ │
│          │  │                         │ │
│          │  │ Model: GPT-4o-mini  ▼  │ │
│          │  │                         │ │
│          │  │ [Test Connection]      │ │
│          │  └─────────────────────────┘ │
└──────────┴───────────────────────────────┘
```

## Tips for Mac Users

### 1. Use Spotlight Search
Press `⌘Space` and type "Eclipse" to launch

### 2. Keep Eclipse in Dock
Drag Eclipse icon to your Dock for quick access

### 3. Use Multiple Desktops
- Development Eclipse on Desktop 1
- Test Eclipse on Desktop 2
- Swipe between them with 3 fingers

### 4. Enable Console
View logs in Eclipse:
- `Window > Show View > Console`
- Useful for debugging

### 5. Homebrew for Java
If you need Java:
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Java 21
brew install openjdk@21

# Link it
sudo ln -sfn /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk \
  /Library/Java/JavaVirtualMachines/openjdk-21.jdk
```

## macOS-Specific Features

### Dark Mode Support
Eclipse respects macOS dark mode setting:
- `System Preferences > General > Appearance`
- Choose "Dark" or "Light"
- Eclipse will match (if using native theme)

### Touch Bar Support
If you have Touch Bar on MacBook Pro:
- Common actions appear automatically
- Customize in System Preferences

### Notification Center
Eclipse can send notifications:
- Build complete
- Errors detected
- Shows in Notification Center

## Troubleshooting on Mac

### Eclipse Crashes on Startup
1. Check Eclipse logs:
   ```bash
   tail -f ~/eclipse-workspace/.metadata/.log
   ```

2. Clear workspace:
   ```bash
   rm -rf ~/eclipse-workspace/.metadata/.plugins/org.eclipse.core.resources/.projects
   ```

### "Malicious Software" Warning
If macOS blocks Eclipse plugin:
```bash
xattr -cr /path/to/eclipse/plugins/com.abap.ai.assistant*.jar
```

Or go to:
- `System Preferences > Security & Privacy`
- Click "Open Anyway"

### Performance Issues
1. Increase Eclipse memory:
   - Edit `eclipse.ini`
   - Increase `-Xmx` value
   ```
   -Xmx2048m  (default)
   -Xmx4096m  (better)
   ```

2. Disable unused plugins:
   - `Eclipse > Preferences > General > Startup and Shutdown`
   - Uncheck unused plugins

## Summary for Mac Users

✅ Preferences: **`⌘,`** or **`Eclipse > Preferences`**  
✅ Save: **`⌘S`**  
✅ Find: **`⌘F`**  
✅ Menu bar: **Top of screen** (not in window)  
✅ Quit Eclipse: **`⌘Q`**  
✅ Close window: **`⌘W`**  

**Remember:** When documentation says "Window > Preferences", on Mac it's actually "Eclipse > Preferences"!

---

**Happy coding on your Mac! 🚀🍎**

