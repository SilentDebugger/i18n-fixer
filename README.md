# i18n-fixer

Automatically detect hardcoded strings in React/Expo projects that need internationalization (i18n).

## Overview

`i18n-fixer` is a production-ready tool that uses AST (Abstract Syntax Tree) parsing to reliably find hardcoded strings in your React and Expo projects. It intelligently identifies user-facing strings in JSX components while filtering out technical strings like URLs, color codes, CSS units, and configuration values.

## Features

- **Comprehensive Detection**: Finds hardcoded strings in:
  - JSX text content
  - JSX attributes (title, placeholder, etc.)
  - JSX expressions
  - Template literals
  - Component return statements
  - Conditional renders
  - Functional and class components

- **Smart Filtering**: Automatically excludes:
  - Already internationalized strings (t(), i18n.t(), etc.)
  - Technical strings (URLs, paths, color codes)
  - Configuration values
  - Short strings (configurable minimum length)
  - Test files
  - Common false positives

- **i18n File Generation**: 
  - Auto-generate translation files from detected strings
  - Smart key generation from string content
  - Nested structure based on file paths (namespaces)
  - Flat structure option for simpler setups
  - Key mapping file for easy string replacement

- **Key Extraction** (for existing projects):
  - Extract all i18n keys from existing `t()` calls
  - Rebuild or audit translation files
  - Location tracking for each key usage

- **Complete Generation**:
  - Combines extraction + generation in one command
  - Gets existing i18n keys AND generates new ones for hardcoded strings
  - Perfect for projects partially using i18n

- **Key Validation**:
  - Find missing keys (used in code but not in translation files)
  - Find unused keys (in translation files but not used in code)
  - Detect duplicate keys and duplicate values
  - Detailed reports with clickable file locations
  - JSON export for CI/CD integration

- **String Search**:
  - Find where a translation text is used in your codebase
  - Search by text value, get the key, find all usages
  - Clickable file links (Cmd+click) for quick navigation

- **Production Ready**:
  - Fast AST-based parsing with Babel
  - TypeScript and JavaScript support
  - Configurable via JSON
  - Detailed reports with file locations
  - JSON export for CI/CD integration
  - Colored terminal output

## Installation

### Option 1: Install Globally (Recommended)

Install globally to use the CLI commands anywhere:

```bash
# Clone the repository
git clone https://github.com/SilentDebugger/i18n-fixer.git
cd i18n-fixer

# Install dependencies
npm install

# Link globally
npm link
```

Now you can use `i18n-finder` or `i18n-fixer` commands anywhere:

```bash
cd /path/to/your/project
i18n-finder
```

### Option 2: Install Directly from GitHub

Install as a dev dependency directly from the GitHub repository:

```bash
npm install --save-dev github:SilentDebugger/i18n-fixer
```

Or using the full Git URL:

```bash
npm install --save-dev git+https://github.com/SilentDebugger/i18n-fixer.git
```

Add to your package.json scripts:

```json
{
  "scripts": {
    "i18n-scan": "i18n-finder"
  }
}
```

### Option 3: Install from Local Directory

Install in your project from a local clone:

```bash
npm install --save-dev /path/to/i18n-fixer
```

### Option 4: Use Directly (Development)

For development or testing of i18n-fixer itself:

```bash
git clone https://github.com/SilentDebugger/i18n-fixer.git
cd i18n-fixer
npm install
```

## Quick Start

### If installed globally:

```bash
# Scan current directory
i18n-finder

# Scan specific directory
i18n-finder --path=./src

# Export to JSON
i18n-finder --output=results.json

# Use custom config
i18n-finder --config=.i18n-finder.config.json
```

### If running from source:

```bash
# Scan current directory
npm run scan

# Scan specific directory
node src/index.js --path=./src

# Export results to JSON
node src/index.js --output=results.json

# Use custom configuration
node src/index.js --config=.i18n-finder.config.json
```

## Usage

### Command Line Options

```bash
i18n-finder [options]

Options:
  --path, -p            Path to scan (default: current directory)
  --config, -c          Path to config file
  --output, -o          Output JSON file path (scan results)
  --min-length          Minimum string length to consider (default: 2)
  --generate, -g        Generate i18n translation file from detected strings
  --flat                Generate flat translation file (no nested structure)
  --no-namespace        Disable namespace generation based on file paths
  --validate, -v        Validate i18n keys against a translation file
  --validate-output     Output validation results to JSON file
  --check-duplicates, -d  Check for duplicate keys in a translation file
  --find-string, -f     Find where a translation string is used in the project
  --translation-file, -t  Translation file to use with --find-string
  --extract-keys, -e    Extract keys from existing i18n calls in code
  --complete            Complete generation: existing keys + hardcoded strings
  --placeholder         Placeholder value for extracted keys (default: empty)
  --with-locations      Include file showing where each key is used
  --help, -h            Show help
  --version             Show version number
```

### Example Commands

```bash
# Scan the src directory
i18n-finder --path=./src

# Scan with custom minimum length
i18n-finder --path=./src --min-length=3

# Export results to JSON for CI/CD
i18n-finder --output=./reports/i18n-scan.json

# Use custom configuration
i18n-finder --config=./custom-config.json

# Generate i18n file from detected strings
i18n-finder --generate=./locales/en.json

# Generate flat i18n file (no nested keys)
i18n-finder --generate=./locales/en.json --flat

# Validate keys against existing translation file
i18n-finder --validate=./locales/en.json

# Export validation results to JSON
i18n-finder --validate=./locales/en.json --validate-output=./validation-report.json

# Check for duplicate keys in translation file
i18n-finder --check-duplicates=./locales/en.json

# Find where a string is used in the codebase
i18n-finder --find-string="Welcome" -t=./locales/en.json --path=./src

# Extract keys from existing i18n calls (for existing projects)
i18n-finder --extract-keys=./locales/en.json --path=./src

# Extract keys with location info
i18n-finder --extract-keys=./locales/en.json --with-locations

# Complete generation: existing keys + hardcoded strings
i18n-finder --complete=./locales/en.json --path=./src

# Get help
i18n-finder --help

# Check version
i18n-finder --version
```

## Configuration

Create a `.i18n-finder.config.json` file in your project root to customize the scanner:

```json
{
  "includePatterns": ["**/*.{js,jsx,ts,tsx}"],
  "excludePatterns": [
    "**/node_modules/**",
    "**/dist/**",
    "**/__tests__/**"
  ],
  "minStringLength": 2,
  "i18nPatterns": [
    "^t\\(",
    "^i18n\\.",
    "translate\\("
  ],
  "i18nFunctionNames": [
    "t",
    "translate",
    "useTranslation"
  ],
  "excludeStringPatterns": [
    "^[a-z][a-zA-Z0-9]*$",
    "^#[0-9a-fA-F]{3,8}$",
    "^https?:\\/\\/"
  ],
  "excludeAttributeNames": [
    "testID",
    "key",
    "style",
    "className"
  ]
}
```

### Configuration Options

- **includePatterns**: File patterns to scan (glob format)
- **excludePatterns**: File patterns to ignore
- **minStringLength**: Minimum string length (filters out single chars)
- **i18nPatterns**: Regex patterns that indicate i18n usage
- **i18nFunctionNames**: Function names used for i18n
- **excludeStringPatterns**: String patterns to exclude
- **excludeAttributeNames**: JSX attribute names to skip

## Output

### Console Report

The scanner provides a detailed console report:

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
  ...

⚠️  Found 87 hardcoded strings:

📄 src/components/LoginForm.jsx
   (5 issues)

   1. Line 23:12
      Type: JSX Text
      String: "Welcome to our app"
      Context: <Text>

   ...
```

### JSON Export

Export results for programmatic processing:

```json
{
  "timestamp": "2025-11-13T07:56:50.571Z",
  "stats": {
    "filesScanned": 45,
    "filesWithIssues": 12,
    "totalStrings": 87,
    "stringsByType": {
      "JSX Text": 45,
      "JSX Attribute": 28
    }
  },
  "results": [
    {
      "file": "/path/to/file.jsx",
      "line": 23,
      "column": 12,
      "value": "Welcome to our app",
      "type": "JSX Text",
      "context": "<Text>"
    }
  ]
}
```

## Extracting Keys from Existing Code

For projects that already use i18n, extract all keys currently in use to generate or rebuild your translation file.

### Basic Extraction

```bash
i18n-finder --extract-keys=./locales/en.json --path=./src
```

This scans your code for all `t()`, `i18n.t()`, etc. calls and generates a translation file:

```json
{
  "welcome": {
    "greeting": "",
    "title": "",
    "userGreeting": ""
  },
  "buttons": {
    "clickMe": "",
    "submit": "",
    "save": ""
  }
}
```

### With Locations

Include a separate file showing where each key is used:

```bash
i18n-finder --extract-keys=./locales/en.json --with-locations
```

This creates `en.locations.json`:

```json
{
  "welcome.greeting": [
    {
      "file": "src/components/Header.jsx",
      "line": 12,
      "link": "/path/to/src/components/Header.jsx:12:13"
    }
  ]
}
```

### With Placeholder Values

Set a placeholder for all extracted keys:

```bash
i18n-finder --extract-keys=./locales/en.json --placeholder="TODO: translate"
```

### Use Cases

- **Rebuild lost translation files** from existing codebase
- **Audit** which keys are actually being used
- **Migrate** to a new i18n structure
- **Generate templates** for translators

## Complete Generation (Existing + New)

For projects that have partial i18n coverage, use complete generation to get everything in one file:

```bash
i18n-finder --complete=./locales/en.json --path=./src
```

This combines both extraction and generation:

1. **Extracts** all keys from existing `t()` calls (values left empty for you to fill)
2. **Generates** new keys for all remaining hardcoded strings (values pre-filled)

Example output:

```
🔄 Complete i18n Generation

Step 1: Extracting existing i18n keys...
   Found 21 existing i18n keys

Step 2: Scanning for hardcoded strings...
   Found 48 hardcoded strings

Step 3: Generating keys for hardcoded strings...
   Generated 48 new keys

📊 Complete Generation Results
================================================================================

✅ Generated: ./locales/en.json
   Total keys: 69
   • Existing i18n keys: 21
   • New keys (from hardcoded strings): 48
```

Generated file structure:

```json
{
  "welcome": {
    "greeting": "",           // Existing key - needs value
    "title": ""               // Existing key - needs value
  },
  "components": {
    "login_form": {
      "submit_button": "Submit Form",    // New key - value pre-filled
      "welcome_message": "Welcome!"      // New key - value pre-filled
    }
  }
}
```

A keymap file is also generated showing the source and location of each key.

## Generating i18n Files

Automatically generate translation files from detected hardcoded strings. This creates a ready-to-use i18n structure with auto-generated keys.

### Basic Generation

```bash
# Generate nested translation file
i18n-finder --path=./src --generate=./locales/en.json
```

This creates a JSON file with keys organized by namespace (based on file paths):

```json
{
  "components": {
    "login_form": {
      "welcome_to_our_app": "Welcome to our app",
      "please_sign_in": "Please sign in",
      "forgot_password": "Forgot password?"
    },
    "dashboard": {
      "hello_user": "Hello, User!"
    }
  }
}
```

### Flat Generation

For simpler i18n setups, generate a flat key structure:

```bash
i18n-finder --generate=./locales/en.json --flat
```

Output:

```json
{
  "welcome_to_our_app": "Welcome to our app",
  "please_sign_in": "Please sign in",
  "forgot_password": "Forgot password?",
  "hello_user": "Hello, User!"
}
```

### Key Mapping File

When generating, a `.keymap.json` file is also created showing where each string originated:

```json
{
  "Welcome to our app": {
    "key": "components.login_form.welcome_to_our_app",
    "file": "/src/components/LoginForm.jsx",
    "line": 15
  }
}
```

This helps you find and replace the hardcoded strings with their new i18n keys.

## Validating i18n Keys

Scan your codebase to find:
- **Missing keys**: Keys used in code but not defined in translation files
- **Unused keys**: Keys defined in translation files but never used in code

### Basic Validation

```bash
i18n-finder --path=./src --validate=./locales/en.json
```

Example output:

```
🔍 Validating i18n keys...

Found 150 keys in translation file
Found 143 i18n key usages

📊 Validation Results
================================================================================

Summary:
  Keys in translation file: 150
  Keys used in code: 143
  Missing keys (used but not defined): 3
  Unused keys (defined but not used): 10

❌ Missing Keys (3):
   These keys are used in code but not defined in translation file:

   📄 src/components/NewFeature.jsx
      Line 23: t('feature.new_title')
      Line 45: t('feature.description')

   📄 src/screens/Settings.tsx
      Line 89: t('settings.dark_mode')

⚠️  Unused Keys (10):
   These keys are defined but not found in code:

   • old_feature.title
   • old_feature.description
   • deprecated.message
   ...
```

### Export Validation Results

```bash
i18n-finder --validate=./locales/en.json --validate-output=./validation-report.json
```

The JSON output is useful for CI/CD pipelines:

```json
{
  "definedKeys": ["welcome.title", "welcome.subtitle", ...],
  "usedKeys": ["welcome.title", "feature.new", ...],
  "missingKeys": [
    {
      "key": "feature.new",
      "file": "/src/components/Feature.jsx",
      "line": 23,
      "function": "t"
    }
  ],
  "unusedKeys": ["old.deprecated_key", ...]
}
```

### CI/CD Integration for Validation

Add key validation to your pipeline:

```yaml
- name: Validate i18n keys
  run: |
    npx i18n-finder --validate=./locales/en.json --validate-output=./validation.json
    MISSING=$(node -e "console.log(require('./validation.json').missingKeys.length)")
    if [ "$MISSING" -gt 0 ]; then
      echo "Found $MISSING missing i18n keys!"
      exit 1
    fi
```

## Checking for Duplicate Keys

Find duplicate keys and duplicate values in your translation files:

```bash
i18n-finder --check-duplicates=./locales/en.json
```

This detects two types of issues:

1. **Duplicate Keys**: The same key appears multiple times (can happen with manual edits or merge conflicts)
2. **Duplicate Values**: The same translation text exists under multiple keys (potential for consolidation)

Example output:

```
📊 Duplicate Check Results
================================================================================

❌ Duplicate Keys (1):
   The same key appears multiple times:

   • buttons.submit
     Value 1: "Submit"
     Value 2: "Send"

⚠️  Duplicate Values (2):
   The same translation text exists under multiple keys:

   "Cancel"
     • buttons.cancel
     • modal.cancelButton
     • form.cancelAction
```

## Finding String Usage

Find where a specific translation is used in your codebase. Enter a text string, and it will:
1. Search the translation file for matching values
2. Get the corresponding keys
3. Find where those keys are used in your code
4. Return clickable file links (Cmd+click in terminal)

```bash
i18n-finder --find-string="Welcome" -t=./locales/en.json --path=./src
```

Example output:

```
🔍 Finding usage of "Welcome"...

Found 3 matching translation(s):

  • common.welcome_message
    "Welcome to our app"

  • auth.welcome_back
    "Welcome back!"

📊 Usage Results
================================================================================

✅ "Welcome to our app"
   Key: common.welcome_message
   Found in 2 location(s):

   📄 /Users/you/project/src/screens/Home.tsx:23:12
      t('common.welcome_message')

   📄 /Users/you/project/src/components/Header.tsx:15:8
      t('common.welcome_message')

⚠️  Keys not found in code:
   • auth.welcome_back
```

The file paths are clickable in most terminals (Cmd+click on macOS, Ctrl+click on Linux/Windows).

## What Gets Detected

### ✅ Detected (User-Facing Strings)

```jsx
// JSX Text
<Text>Welcome to the app</Text>

// JSX Attributes
<Button title="Click Me" />
<TextInput placeholder="Enter name" />

// JSX Expressions
<Text>{"Hello World"}</Text>

// Template Literals
<Text>{`Welcome ${name}`}</Text>

// Conditional Renders
<Text>{loggedIn ? "Welcome back" : "Please login"}</Text>

// Function Returns
const getMessage = () => "Hello";
const Component = () => "Text content";

// Class Component Renders
class MyComponent extends React.Component {
  render() {
    return <Text>Hello</Text>;
  }
}
```

### ❌ Not Detected (Already i18n'd or Technical)

```jsx
// Already internationalized
<Text>{t('welcome.message')}</Text>
<Button title={i18n.t('buttons.submit')} />

// Technical strings
<View testID="container" />
<View style={{ color: '#FF5733' }} />
<Image source={{ uri: 'https://example.com/image.png' }} />

// Short strings
<Text>:</Text>
<Text>-</Text>

// Configuration
const API_URL = 'https://api.example.com';
```

## Integration with CI/CD

### GitHub Actions

```yaml
name: i18n Check

on: [push, pull_request]

jobs:
  i18n-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      # Option 1: If installed as dev dependency
      - name: Install project dependencies
        run: npm install
      - name: Run i18n scan
        run: npx i18n-finder --output=results.json

      # Option 2: If cloning and using directly
      # - name: Clone i18n-fixer
      #   run: |
      #     git clone https://github.com/SilentDebugger/i18n-fixer.git
      #     cd i18n-fixer
      #     npm install
      # - name: Run i18n scan
      #   run: node i18n-fixer/src/index.js --path=. --output=results.json

      - name: Check results
        run: |
          TOTAL=$(node -e "console.log(require('./results.json').stats.totalStrings)")
          if [ "$TOTAL" -gt 0 ]; then
            echo "Found $TOTAL hardcoded strings"
            exit 1
          fi
```

## Supported i18n Libraries

The scanner automatically recognizes common i18n patterns from:

- **react-i18next**: `t()`, `useTranslation()`
- **react-intl**: `formatMessage()`, `useIntl()`
- **expo-localization**: `i18n.t()`
- **Custom**: Configure your own patterns

## Common Patterns

### Setting Up i18n (react-i18next)

Once you've identified hardcoded strings:

1. Install react-i18next:
```bash
npm install react-i18next i18next
```

2. Replace hardcoded strings:
```jsx
// Before
<Text>Welcome to the app</Text>

// After
const { t } = useTranslation();
<Text>{t('welcome.message')}</Text>
```

3. Add translations:
```json
{
  "welcome": {
    "message": "Welcome to the app"
  }
}
```

## Examples

The `examples/` directory contains sample files demonstrating:

- **BadExample.jsx**: Common mistakes with hardcoded strings
- **GoodExample.jsx**: Properly internationalized code
- **TypeScriptExample.tsx**: TypeScript patterns

Run the scanner on examples:

```bash
npm run test
```

## Performance

- Scans ~1000 files in under 5 seconds
- Memory efficient with streaming AST parsing
- Parallel file processing ready

## Troubleshooting

### False Positives

If legitimate strings are detected:

1. Add patterns to `excludeStringPatterns` in config
2. Check if string is truly user-facing
3. Consider if it should be i18n'd

### Missing Strings

If strings aren't detected:

1. Ensure file extensions match `includePatterns`
2. Check if files are in `excludePatterns`
3. Verify the string meets `minStringLength`

### Parse Errors

If files fail to parse:

1. Check for syntax errors in source files
2. Ensure Babel plugins support your syntax
3. Check the error message for details

## Contributing

Contributions welcome! Areas for improvement:

- Additional i18n library patterns
- Performance optimizations
- More exclude patterns
- Better context detection

## License

MIT

## Credits

Built with:
- [@babel/parser](https://babeljs.io/docs/en/babel-parser) - AST parsing
- [@babel/traverse](https://babeljs.io/docs/en/babel-traverse) - AST traversal
- [chalk](https://github.com/chalk/chalk) - Terminal colors
- [glob](https://github.com/isaacs/node-glob) - File matching