# Troubleshooting - No Markers Appearing

## Issue: Nothing happens when saving .abap files

### Step 1: Enable Build Automatically ⚙️

**In TEST Eclipse (where you created the test project):**

#### On macOS:
1. Look at **top of screen** (menu bar)
2. Click **`Project`** menu
3. Look for **`Build Automatically`**
4. If it has NO checkmark ✓, click it
5. It should now have a checkmark ✓

#### Alternative:
- Press: **`⌘⌥B`** (Command + Option + B)

---

### Step 2: Verify Nature is Added ✅

**In TEST Eclipse:**

1. Right-click your project
2. Select **`Properties`**
3. Look at the list on the left
4. If you see a section about "Builders" or "Natures", check there

OR manually check:

1. In Project Explorer, expand your project
2. Double-click the **`.project`** file
3. Look for this line:
   ```xml
   <nature>com.abap.ai.assistant.abapNature</nature>
   ```

If you DON'T see that line, the nature wasn't added!

---

### Step 3: Manually Add Nature to .project File

If the Configure menu didn't work, add it manually:

**In TEST Eclipse:**

1. Right-click project → **`New > File`**
2. Name: `.project` (if it doesn't exist) or open existing one
3. Edit the file to include:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<projectDescription>
	<name>test-abap-project</name>
	<comment></comment>
	<projects>
	</projects>
	<buildSpec>
		<buildCommand>
			<name>com.abap.ai.assistant.abapBuilder</name>
			<arguments>
			</arguments>
		</buildCommand>
	</buildSpec>
	<natures>
		<nature>com.abap.ai.assistant.abapNature</nature>
	</natures>
</projectDescription>
```

4. Save the file
5. Right-click project → **`Refresh`** (F5)
6. Right-click project → **`Clean...`**

---

### Step 4: Force a Build 🔨

**In TEST Eclipse:**

1. Right-click your project
2. Select **`Clean...`**
3. Click **`Clean`**
4. Then: Right-click project → **`Build Project`**

---

### Step 5: Check Main Eclipse Console 📋

**In MAIN Eclipse (where you're running the plugin from):**

1. Look at bottom panel
2. Find **`Console`** tab
3. You should see output when you save a .abap file

If you see NOTHING, the builder isn't running at all.

---

### Step 6: Try Manual Analysis Instead 🎯

Skip automatic building and try manual:

**In TEST Eclipse:**

1. Create/open your `.abap` file
2. Right-click on the `.abap` file (not the project)
3. Look for **`ABAP AI Assistant > Analyze Code`**
4. Click it

This should trigger analysis manually and you should see a dialog.

---

## Common Issues & Solutions

### Issue A: "Configure" menu doesn't show "Add ABAP AI Nature"

**Solution:** Add the nature manually to `.project` file (see Step 3 above)

### Issue B: Build Automatically grayed out

**Solution:** 
1. Close all editors
2. Enable it again
3. Reopen files

### Issue C: Still nothing in console

**Possible causes:**
1. Plugin didn't compile properly
2. Builder isn't registered
3. Nature wasn't actually added

**Solution:** Let's verify the plugin actually loaded:

**In TEST Eclipse:**
1. Go to: **`Help > About Eclipse`**
2. Click **`Installation Details`**
3. Click **`Plug-ins`** tab
4. Search for: **"abap"** or **"com.abap.ai.assistant"**
5. Do you see it listed?

If NO → The plugin didn't load at all!

---

## Next Steps if Still Not Working

If none of this works, we need to:

1. ✅ Verify the plugin is actually loading
2. ✅ Check Error Log for startup errors
3. ✅ Try a simpler test without the nature

Let me know what you find!


