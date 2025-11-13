# Quick Start Guide

## For Users Who Want to Scan Their Project

### Step 1: Install the Tool

```bash
# Clone this repository
git clone https://github.com/SilentDebugger/i18n-fixer.git
cd i18n-fixer

# Install dependencies
npm install

# Install globally (creates i18n-finder and i18n-fixer commands)
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
