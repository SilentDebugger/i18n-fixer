# Quick Start Guide

## TL;DR - Fastest Way

```bash
# From your React/Expo project directory
npx github:SilentDebugger/i18n-fixer
```

That's it! No installation needed.

---

## For Users Who Want to Scan Their Project

### Installation Options

Choose the method that works best for you:

#### Option A: No Installation (Quickest - Use npx)

```bash
# Just run it directly from GitHub - no installation needed!
cd /path/to/your/project
npx github:SilentDebugger/i18n-fixer
```

#### Option B: Install in Your Project Only

```bash
# Install directly from GitHub into your project
cd /path/to/your/project
npm install --save-dev github:SilentDebugger/i18n-fixer

# Add to package.json scripts
# Add this to your package.json:
# "scripts": {
#   "i18n-check": "i18n-finder"
# }

# Then run
npm run i18n-check
```

#### Option C: Install Globally

```bash
# Clone and install globally (use anywhere on your system)
git clone https://github.com/SilentDebugger/i18n-fixer.git
cd i18n-fixer
npm install
npm link
```

### Step 2: Navigate to Your Project

```bash
cd /path/to/your/react-or-expo-project
```

### Step 3: Run the Scanner

```bash
# Basic scan (scans current directory)
i18n-finder

# Scan specific directory
i18n-finder --path=./src

# Export results to JSON
i18n-finder --output=i18n-report.json
```

### Step 4: Review Results

The scanner will show you:
- Total files scanned
- Number of hardcoded strings found
- Exact file locations (file:line:column)
- Type of string (JSX Text, JSX Attribute, etc.)
- The actual string that needs i18n

### Example Output

```
🔍 Starting i18n string scan...

📊 Scan Results
================================================================================

Summary:
  Files scanned: 45
  Files with issues: 12
  Total hardcoded strings: 87

Strings by type:
  JSX Text: 45
  JSX Attribute: 28
  Return Statement: 8

⚠️  Found 87 hardcoded strings:

📄 src/components/LoginForm.jsx
   (5 issues)

   1. Line 23:12
      Type: JSX Text
      String: "Welcome to our app"
      Context: <Text>
```

## Alternative: Use Without Installing Globally

If you don't want to install globally:

```bash
# From the i18n-fixer directory
node src/index.js --path=/path/to/your/project
```

## Alternative: Install as Dev Dependency

Add to your project:

```bash
npm install --save-dev /path/to/i18n-fixer
```

Then add to your package.json:

```json
{
  "scripts": {
    "i18n-check": "i18n-finder"
  }
}
```

Run with:

```bash
npm run i18n-check
```

## Uninstalling

To remove the global installation:

```bash
npm unlink -g i18n-fixer
```

## Getting Help

```bash
i18n-finder --help
```

## Common Use Cases

### Check before committing
```bash
i18n-finder && echo "No hardcoded strings!" || echo "Please fix hardcoded strings"
```

### Generate report for team
```bash
i18n-finder --output=i18n-audit-$(date +%Y%m%d).json
```

### Scan only components directory
```bash
i18n-finder --path=./src/components
```

### Use custom config
```bash
i18n-finder --config=.i18n-finder.config.json
```
