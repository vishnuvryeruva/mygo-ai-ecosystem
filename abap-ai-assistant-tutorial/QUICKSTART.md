# Quick Start Guide - ABAP AI Assistant

Get up and running with AI-powered ABAP code analysis in 5 minutes!

## ⚡ Quick Setup (5 Minutes)

### Step 1: Download Dependencies (1 min)

**On macOS/Linux:**
```bash
cd /Users/maaz/sites/abap-ai-assistant-tutorial
./download-dependencies.sh
```

**On Windows:**
```cmd
cd \Users\maaz\sites\abap-ai-assistant-tutorial
download-dependencies.bat
```

**Manual alternative:**
```bash
cd lib/
curl -L -o org.json-20240303.jar \
  "https://repo1.maven.org/maven2/org/json/json/20240303/json-20240303.jar"
```

### Step 2: Import into Eclipse (1 min)

1. Open Eclipse (with PDE installed)
2. `File > Import > Existing Projects into Workspace`
3. Browse to: `/Users/maaz/sites/abap-ai-assistant-tutorial`
4. Click **Finish**

### Step 3: Launch Plugin (1 min)

1. Right-click on project → `Run As > Eclipse Application`
2. Wait for new Eclipse instance to launch
3. This is your test environment!

### Step 4: Get OpenAI API Key (2 min)

1. Visit: https://platform.openai.com/api-keys
2. Sign up/Login
3. Click **"Create new secret key"**
4. Copy the key (you won't see it again!)
5. Store it somewhere safe

### Step 5: Configure Plugin (30 sec)

In the **new Eclipse instance**:

**On macOS:**
1. `Eclipse > Preferences` (or `⌘,`)
2. Find **"ABAP AI Assistant"**
3. Paste your API key
4. Select model: **"GPT-4o Mini (Recommended)"**
5. Click **"Test OpenAI Connection"**
6. Should see: ✓ Success!
7. Click **"Apply and Close"**

**On Windows/Linux:**
1. `Window > Preferences`
2. Follow steps 2-7 above

## 🎯 First Test (2 Minutes)

### Create a Test Project

1. In the test Eclipse: `File > New > Project > General > Project`
2. Name it: `test-abap-project`
3. Right-click project → `Configure > Add ABAP AI Nature`

### Create Test ABAP File

1. Right-click project → `New > File`
2. Name: `test.abap`
3. Paste this code:

```abap
*&---------------------------------------------------------------------*
*& Test ABAP Program
*&---------------------------------------------------------------------*
REPORT z_test.

DATA: myVariable TYPE string,
      customer_name TYPE string,
      lt_data TYPE TABLE OF kna1,
      ls_data TYPE kna1.

START-OF-SELECTION.

  " This uses old-style method call
  CALL METHOD cl_demo_output=>display(
    EXPORTING
      data = 'Hello'
  ).
  
  " Loop with work area (could be optimized)
  LOOP AT lt_data INTO ls_data.
    WRITE: / ls_data-kunnr.
  ENDLOOP.
  
  " Checking for empty string
  IF customer_name = ''.
    WRITE: / 'Empty'.
  ENDIF.

END-OF-SELECTION.
```

4. Save the file (`Ctrl+S` / `Cmd+S`)
5. Wait a few seconds...
6. Check **Problems view** at the bottom!

### Expected Results

You should see AI-generated suggestions like:

- ⚠️ Variable naming inconsistencies
- ℹ️ Loop performance suggestions
- ℹ️ Modern syntax recommendations
- ℹ️ Better conditional check patterns

## 📊 View Suggestions

### In Problems View

1. Bottom panel: **Problems** tab
2. Look for entries with **"ABAP AI Assistant"**
3. Double-click any suggestion to jump to that line

### In Editor

- Yellow/blue squiggly lines show suggestions
- Hover over them to read details
- Right-click → **Quick Fix** for options

## 🎨 Try Manual Analysis

1. Right-click on your `.abap` file
2. Select: `ABAP AI Assistant > Analyze Code`
3. Wait for analysis
4. Dialog shows: "Found X suggestions"
5. Check Problems view for details

## 💰 Cost Check

After your first analysis:

1. Visit: https://platform.openai.com/usage
2. See how much it cost (usually < $0.001)
3. With GPT-4o-mini, 100 analyses ≈ $0.05

## 🔧 Troubleshooting

### "API key not configured"
→ Did you configure it in the **test Eclipse instance**, not your main Eclipse?

### "Connection Failed"
→ Check:
- Internet connection working?
- API key copied correctly (no spaces)?
- OpenAI account has credits?
- Visit: https://platform.openai.com/account/billing

### No suggestions appearing
→ Try:
- Right-click file → `ABAP AI Assistant > Refresh Patterns`
- Save file again
- Check Error Log: `Window > Show View > Error Log`

### "JSON Library not found"
→ Run the download script again:
```bash
./download-dependencies.sh
```

## 🎓 Learn More

### Understanding Results

The AI considers:
- Your project's naming patterns
- ABAP best practices
- Performance implications
- Code readability
- Potential bugs

### Customize Behavior

**Preferences location:**
- **macOS**: `Eclipse > Preferences > ABAP AI Assistant` (or press `⌘,`)
- **Windows/Linux**: `Window > Preferences > ABAP AI Assistant`

**Options:**
- Toggle auto-analysis on/off
- Change AI model
- Adjust pattern sensitivity
- Enable/disable specific checks

## 🚀 Next Steps

### Test Different Models

Try switching models to see differences:
1. Go to Preferences
2. Change model to **GPT-4o** (more powerful, slower)
3. Re-analyze your code
4. Compare suggestions

### Add More Files

Create more `.abap` files with different patterns:
- Some with `lv_` prefix
- Some with `ls_` prefix
- Mix different styles

The AI will learn **your** project's preferences!

### Share with Team

When ready for team use:
1. Export plugin: `File > Export > Deployable plug-ins`
2. Share the `.jar` file
3. Each developer configures their own API key
4. Consistent code quality across team!

## 📖 Full Documentation

For detailed information:
- **SETUP.md** - Complete installation guide
- **API_KEY_SETUP.md** - OpenAI configuration details
- **README.md** - Full feature documentation
- **CHANGELOG.md** - Version history

## 💡 Pro Tips

### Tip 1: Use Rule-Based Mode Offline
Uncheck "Use OpenAI" in preferences → works without internet!

### Tip 2: Batch Analysis
Right-click project → `ABAP AI Assistant > Refresh Patterns` → analyzes all files

### Tip 3: Cost Control
Disable auto-analysis, use manual analysis only when needed

### Tip 4: Better Suggestions
More `.abap` files in project = better pattern learning = more relevant AI suggestions!

## ❓ Questions?

- Check Error Log: `Window > Show View > Error Log`
- Review full README.md
- Check OpenAI status: https://status.openai.com/

## 🎉 Success!

If you see AI-powered suggestions in your Problems view, you're all set!

**Enjoy AI-powered ABAP development! 🚀**

---

**Estimated setup time**: 5 minutes  
**First analysis**: < 10 seconds  
**Cost per analysis**: ~$0.0001 (GPT-4o-mini)  
**Coolness factor**: 💯


