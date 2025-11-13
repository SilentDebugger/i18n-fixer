#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import chalk from 'chalk';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DEFAULT_CONFIG = {
  // Patterns to include
  includePatterns: ['**/*.{js,jsx,ts,tsx}'],

  // Patterns to exclude
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.expo/**',
    '**/.git/**',
    '**/coverage/**',
    '**/__tests__/**',
    '**/*.test.{js,jsx,ts,tsx}',
    '**/*.spec.{js,jsx,ts,tsx}'
  ],

  // Minimum string length to consider (filters out single chars like ":" or "-")
  minStringLength: 2,

  // Patterns that indicate a string is already internationalized
  i18nPatterns: [
    /^t\(/,           // t('key')
    /^i18n\./,        // i18n.t('key')
    /translate\(/,    // translate('key')
    /^intl\./,        // intl.formatMessage
    /formatMessage\(/,
    /^__\(/,          // __('key')
    /^_\(/,           // _('key')
  ],

  // Function/hook names that indicate i18n usage
  i18nFunctionNames: [
    'useTranslation',
    'useIntl',
    'withTranslation',
    't',
    'translate',
    '__',
    '_',
  ],

  // Patterns to exclude (these are typically not user-facing)
  excludeStringPatterns: [
    /^[a-z][a-zA-Z0-9]*$/, // camelCase identifiers (likely prop names)
    /^[A-Z_]+$/, // CONSTANT_NAMES
    /^#[0-9a-fA-F]{3,8}$/, // Color hex codes
    /^rgba?\(/i, // RGB/RGBA colors
    /^https?:\/\//i, // URLs (may need i18n but often excluded)
    /^\.{1,2}\//i, // Relative paths
    /^\//i, // Absolute paths
    /^@/i, // Package imports
    /^data:/, // Data URIs
    /^\d+px$/i, // CSS units
    /^\d+%$/i, // Percentages
    /^[<>]=?$/i, // Comparison operators
    /^\s*$/i, // Empty or whitespace only
  ],

  // JSX attribute names to exclude (typically not user-facing)
  excludeAttributeNames: [
    'testID',
    'accessibilityLabel', // This might need i18n, but often excluded
    'accessibilityHint',
    'key',
    'ref',
    'style',
    'className',
    'id',
    'type',
    'name',
    'value',
    'defaultValue',
    'href',
    'src',
    'alt', // This SHOULD be i18n'd but often contains descriptions
    'role',
    'aria-label',
    'aria-describedby',
    'data-testid',
    'as',
  ],
};

class I18nStringFinder {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.results = [];
    this.stats = {
      filesScanned: 0,
      filesWithIssues: 0,
      totalStrings: 0,
      stringsByType: {},
    };
  }

  /**
   * Check if a string is already internationalized
   */
  isI18nString(value, parent) {
    if (!value || typeof value !== 'string') return true;

    // Check against i18n patterns
    return this.config.i18nPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Check if a string should be excluded
   */
  shouldExcludeString(value) {
    if (!value || typeof value !== 'string') return true;

    // Check minimum length
    if (value.trim().length < this.config.minStringLength) return true;

    // Check against exclude patterns
    return this.config.excludeStringPatterns.some(pattern => pattern.test(value));
  }

  /**
   * Check if we're inside an i18n function call
   */
  isInsideI18nCall(path) {
    let current = path;

    while (current) {
      if (t.isCallExpression(current.node)) {
        const callee = current.node.callee;

        // Check if it's a direct function call like t() or translate()
        if (t.isIdentifier(callee) &&
            this.config.i18nFunctionNames.includes(callee.name)) {
          return true;
        }

        // Check if it's a member expression like i18n.t()
        if (t.isMemberExpression(callee)) {
          const property = callee.property;
          if (t.isIdentifier(property) &&
              this.config.i18nFunctionNames.includes(property.name)) {
            return true;
          }
        }
      }

      current = current.parentPath;
    }

    return false;
  }

  /**
   * Check if the file uses i18n (to reduce false positives for files already set up)
   */
  fileUsesI18n(ast) {
    let usesI18n = false;

    traverse.default(ast, {
      ImportDeclaration(path) {
        const source = path.node.source.value;
        if (source.includes('i18n') ||
            source.includes('react-i18next') ||
            source.includes('react-intl') ||
            source.includes('expo-localization')) {
          usesI18n = true;
        }
      },
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee)) {
          const name = path.node.callee.name;
          if (this.config.i18nFunctionNames.includes(name)) {
            usesI18n = true;
          }
        }
      },
    });

    return usesI18n;
  }

  /**
   * Add a found string to results
   */
  addResult(filePath, line, column, value, type, context = '') {
    if (this.shouldExcludeString(value)) return;
    if (this.isI18nString(value)) return;

    this.results.push({
      file: filePath,
      line,
      column,
      value: value.trim(),
      type,
      context,
    });

    this.stats.totalStrings++;
    this.stats.stringsByType[type] = (this.stats.stringsByType[type] || 0) + 1;
  }

  /**
   * Parse a single file and find hardcoded strings
   */
  parseFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Parse with Babel
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: [
          'jsx',
          'typescript',
          'classProperties',
          'decorators-legacy',
          'dynamicImport',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'functionBind',
          'nullishCoalescingOperator',
          'optionalChaining',
        ],
      });

      this.stats.filesScanned++;
      const initialStringCount = this.stats.totalStrings;

      // Traverse the AST
      traverse.default(ast, {
        // JSX Text - e.g., <Text>Hello World</Text>
        JSXText: (path) => {
          const value = path.node.value.trim();
          if (value && !this.isInsideI18nCall(path)) {
            this.addResult(
              filePath,
              path.node.loc?.start.line,
              path.node.loc?.start.column,
              value,
              'JSX Text',
              this.getContextSnippet(path)
            );
          }
        },

        // JSX Attribute - e.g., <Button title="Click me" />
        JSXAttribute: (path) => {
          const attributeName = path.node.name.name;

          // Skip excluded attributes
          if (this.config.excludeAttributeNames.includes(attributeName)) {
            return;
          }

          const value = path.node.value;

          // String literal attribute
          if (t.isStringLiteral(value)) {
            if (!this.isInsideI18nCall(path)) {
              this.addResult(
                filePath,
                value.loc?.start.line,
                value.loc?.start.column,
                value.value,
                'JSX Attribute',
                `${attributeName}="${value.value}"`
              );
            }
          }

          // Expression container with string
          if (t.isJSXExpressionContainer(value)) {
            if (t.isStringLiteral(value.expression)) {
              if (!this.isInsideI18nCall(path)) {
                this.addResult(
                  filePath,
                  value.expression.loc?.start.line,
                  value.expression.loc?.start.column,
                  value.expression.value,
                  'JSX Attribute Expression',
                  `${attributeName}={${JSON.stringify(value.expression.value)}}`
                );
              }
            }
          }
        },

        // Template literals in JSX - e.g., <Text>{`Hello ${name}`}</Text>
        TemplateLiteral: (path) => {
          // Only check template literals inside JSX
          if (this.isInsideJSX(path) && !this.isInsideI18nCall(path)) {
            path.node.quasis.forEach((quasi) => {
              const value = quasi.value.cooked || quasi.value.raw;
              if (value && value.trim()) {
                this.addResult(
                  filePath,
                  quasi.loc?.start.line,
                  quasi.loc?.start.column,
                  value,
                  'Template Literal in JSX',
                  this.getContextSnippet(path)
                );
              }
            });
          }
        },

        // String literals in JSX expressions - e.g., <Text>{"Hello"}</Text>
        JSXExpressionContainer: (path) => {
          if (t.isStringLiteral(path.node.expression)) {
            if (!this.isInsideI18nCall(path)) {
              this.addResult(
                filePath,
                path.node.expression.loc?.start.line,
                path.node.expression.loc?.start.column,
                path.node.expression.value,
                'JSX Expression',
                this.getContextSnippet(path)
              );
            }
          }
        },

        // Detect strings returned from render functions or functional components
        ReturnStatement: (path) => {
          // Check if we're in a function that likely returns JSX
          if (this.isLikelyRenderFunction(path)) {
            this.checkReturnedStrings(path, filePath);
          }
        },
      });

      // Track if file has issues
      if (this.stats.totalStrings > initialStringCount) {
        this.stats.filesWithIssues++;
      }

    } catch (error) {
      console.error(chalk.red(`Error parsing ${filePath}:`), error.message);
    }
  }

  /**
   * Check if path is inside JSX
   */
  isInsideJSX(path) {
    let current = path;
    while (current) {
      if (t.isJSXElement(current.node) ||
          t.isJSXFragment(current.node) ||
          t.isJSXExpressionContainer(current.node)) {
        return true;
      }
      current = current.parentPath;
    }
    return false;
  }

  /**
   * Check if a function is likely a render function
   */
  isLikelyRenderFunction(path) {
    let current = path.parentPath;

    while (current) {
      const node = current.node;

      // Functional component (arrow function or function declaration at top level)
      if (t.isArrowFunctionExpression(node) || t.isFunctionDeclaration(node)) {
        // Check if it starts with capital letter (component convention)
        if (t.isVariableDeclarator(current.parent) &&
            t.isIdentifier(current.parent.id) &&
            /^[A-Z]/.test(current.parent.id.name)) {
          return true;
        }

        if (t.isFunctionDeclaration(node) &&
            t.isIdentifier(node.id) &&
            /^[A-Z]/.test(node.id.name)) {
          return true;
        }
      }

      // Class component render method
      if (t.isClassMethod(node) &&
          t.isIdentifier(node.key) &&
          node.key.name === 'render') {
        return true;
      }

      // renderXXX methods
      if (t.isClassMethod(node) &&
          t.isIdentifier(node.key) &&
          node.key.name.startsWith('render')) {
        return true;
      }

      current = current.parentPath;
    }

    return false;
  }

  /**
   * Check returned strings from a return statement
   */
  checkReturnedStrings(path, filePath) {
    const argument = path.node.argument;

    // Direct string return
    if (t.isStringLiteral(argument)) {
      if (!this.isInsideI18nCall(path)) {
        this.addResult(
          filePath,
          argument.loc?.start.line,
          argument.loc?.start.column,
          argument.value,
          'Return Statement',
          'Direct string return'
        );
      }
    }

    // Conditional expression returning strings
    if (t.isConditionalExpression(argument)) {
      [argument.consequent, argument.alternate].forEach((node) => {
        if (t.isStringLiteral(node)) {
          if (!this.isInsideI18nCall(path)) {
            this.addResult(
              filePath,
              node.loc?.start.line,
              node.loc?.start.column,
              node.value,
              'Conditional Return',
              'Ternary expression'
            );
          }
        }
      });
    }
  }

  /**
   * Get context snippet for a found string
   */
  getContextSnippet(path) {
    try {
      let current = path;

      // Find the nearest JSX element or meaningful parent
      while (current && !t.isJSXElement(current.node) && !t.isJSXFragment(current.node)) {
        current = current.parentPath;
      }

      if (current && t.isJSXElement(current.node)) {
        const openingElement = current.node.openingElement;
        if (t.isJSXIdentifier(openingElement.name)) {
          return `<${openingElement.name.name}>`;
        }
      }

      return '';
    } catch {
      return '';
    }
  }

  /**
   * Scan all files in the project
   */
  async scanProject(rootPath) {
    console.log(chalk.blue.bold('\n🔍 Starting i18n string scan...\n'));

    // Find all files matching patterns
    const files = await glob(this.config.includePatterns, {
      cwd: rootPath,
      absolute: true,
      ignore: this.config.excludePatterns,
    });

    console.log(chalk.gray(`Found ${files.length} files to scan\n`));

    // Parse each file
    files.forEach((file) => {
      this.parseFile(file);
    });
  }

  /**
   * Generate and display report
   */
  generateReport() {
    console.log(chalk.blue.bold('\n📊 Scan Results\n'));
    console.log(chalk.gray('='.repeat(80)));

    // Summary stats
    console.log(chalk.cyan('\nSummary:'));
    console.log(chalk.white(`  Files scanned: ${this.stats.filesScanned}`));
    console.log(chalk.white(`  Files with issues: ${this.stats.filesWithIssues}`));
    console.log(chalk.white(`  Total hardcoded strings: ${this.stats.totalStrings}`));

    if (this.stats.totalStrings > 0) {
      console.log(chalk.cyan('\nStrings by type:'));
      Object.entries(this.stats.stringsByType)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(chalk.white(`  ${type}: ${count}`));
        });
    }

    console.log(chalk.gray('\n' + '='.repeat(80)));

    // Detailed results
    if (this.results.length === 0) {
      console.log(chalk.green.bold('\n✅ No hardcoded strings found! Your project is i18n ready.\n'));
      return;
    }

    console.log(chalk.yellow.bold(`\n⚠️  Found ${this.results.length} hardcoded strings:\n`));

    // Group by file
    const byFile = {};
    this.results.forEach((result) => {
      if (!byFile[result.file]) {
        byFile[result.file] = [];
      }
      byFile[result.file].push(result);
    });

    // Display results by file
    Object.entries(byFile).forEach(([file, strings]) => {
      const relativePath = path.relative(process.cwd(), file);
      console.log(chalk.blue.bold(`\n📄 ${relativePath}`));
      console.log(chalk.gray(`   (${strings.length} issue${strings.length > 1 ? 's' : ''})`));

      strings.forEach((string, index) => {
        console.log(chalk.gray(`\n   ${index + 1}. Line ${string.line}:${string.column}`));
        console.log(chalk.yellow(`      Type: ${string.type}`));
        console.log(chalk.white(`      String: "${string.value}"`));
        if (string.context) {
          console.log(chalk.gray(`      Context: ${string.context}`));
        }
      });
    });

    console.log(chalk.gray('\n' + '='.repeat(80)));
    console.log(chalk.cyan('\n💡 Next steps:'));
    console.log(chalk.white('   1. Set up i18n in your project (react-i18next, react-intl, etc.)'));
    console.log(chalk.white('   2. Replace each hardcoded string with i18n calls'));
    console.log(chalk.white('   3. Add translations to your locale files'));
    console.log(chalk.white('   4. Run this scan again to verify\n'));
  }

  /**
   * Export results to JSON
   */
  exportToJson(outputPath) {
    const output = {
      timestamp: new Date().toISOString(),
      stats: this.stats,
      results: this.results,
    };

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(chalk.green(`\n✅ Results exported to ${outputPath}\n`));
  }
}

// CLI
async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('path', {
      alias: 'p',
      type: 'string',
      description: 'Path to scan',
      default: process.cwd(),
    })
    .option('config', {
      alias: 'c',
      type: 'string',
      description: 'Path to config file',
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      description: 'Output JSON file path',
    })
    .option('min-length', {
      type: 'number',
      description: 'Minimum string length to consider',
      default: 2,
    })
    .help()
    .alias('help', 'h')
    .argv;

  // Load custom config if provided
  let config = {};
  if (argv.config && fs.existsSync(argv.config)) {
    const configContent = fs.readFileSync(argv.config, 'utf-8');
    config = JSON.parse(configContent);
  }

  // Override with CLI options
  if (argv.minLength) {
    config.minStringLength = argv.minLength;
  }

  const finder = new I18nStringFinder(config);

  await finder.scanProject(argv.path);
  finder.generateReport();

  if (argv.output) {
    finder.exportToJson(argv.output);
  }
}

main().catch(console.error);
