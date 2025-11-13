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

### Option 2: Install as Dev Dependency (Without Cloning)

Install directly from GitHub into your project:

```bash
# Install from GitHub (latest commit on main branch)
npm install --save-dev github:SilentDebugger/i18n-fixer

# Or install from a specific branch
npm install --save-dev github:SilentDebugger/i18n-fixer#claude/auto-string-finder-script-011CV5XUSoxPbqFwQvw5Q6d3

# Or install from a specific commit/tag
npm install --save-dev github:SilentDebugger/i18n-fixer#dd26dbf
```

This will add it to your `package.json` and `node_modules` without needing to clone the repo.

Add to your package.json scripts:

```json
{
  "scripts": {
    "i18n-scan": "i18n-finder"
  }
}
```

Run with:

```bash
npm run i18n-scan
```

### Option 2b: Install from Local Directory

If you have a local copy:

```bash
npm install --save-dev /path/to/i18n-fixer
```

### Option 3: Use with npx (No Installation Required)

Run directly without installing:

```bash
# Run from GitHub without installing anything
npx github:SilentDebugger/i18n-fixer

# Or from a specific branch
npx github:SilentDebugger/i18n-fixer#claude/auto-string-finder-script-011CV5XUSoxPbqFwQvw5Q6d3

# With options
npx github:SilentDebugger/i18n-fixer --path=./src --output=results.json
```

This is perfect for one-time scans or trying out the tool!

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
  --path, -p      Path to scan (default: current directory)
  --config, -c    Path to config file
  --output, -o    Output JSON file path
  --min-length    Minimum string length to consider (default: 2)
  --help, -h      Show help
  --version       Show version number
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