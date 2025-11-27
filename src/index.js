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
    this.usedKeys = []; // Keys found in code
    this.stats = {
      filesScanned: 0,
      filesWithIssues: 0,
      totalStrings: 0,
      stringsByType: {},
    };
  }

  /**
   * Generate a key from a string value
   */
  generateKey(value, context = '') {
    // Clean and normalize the string
    let key = value
      .toLowerCase()
      .trim()
      // Remove special characters except spaces
      .replace(/[^a-z0-9\s]/g, '')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Convert to snake_case
      .replace(/\s/g, '_')
      // Limit length
      .substring(0, 40)
      // Remove trailing underscores
      .replace(/_+$/, '');

    // If key is too short or empty, generate from hash
    if (key.length < 2) {
      key = 'text_' + this.simpleHash(value);
    }

    return key;
  }

  /**
   * Simple hash function for generating unique keys
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 8);
  }

  /**
   * Get namespace from file path
   */
  getNamespaceFromPath(filePath, rootPath) {
    const relativePath = path.relative(rootPath, filePath);
    const parts = relativePath.split(path.sep);
    
    // Remove file extension and get meaningful parts
    const fileName = parts.pop().replace(/\.(jsx?|tsx?)$/, '');
    
    // Build namespace from directory structure
    const namespace = [];
    
    // Add relevant directory parts (skip common ones like 'src', 'components')
    const skipDirs = ['src', 'app', 'lib', 'utils'];
    for (const part of parts) {
      if (!skipDirs.includes(part.toLowerCase())) {
        namespace.push(part.toLowerCase());
      }
    }
    
    // Add file name if it's meaningful (not index)
    if (fileName.toLowerCase() !== 'index') {
      // Convert PascalCase to snake_case
      const snakeName = fileName
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
      namespace.push(snakeName);
    }
    
    return namespace.length > 0 ? namespace.join('.') : 'common';
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
    console.log(chalk.white('   1. Generate i18n file: i18n-finder --generate=./locales/en.json'));
    console.log(chalk.white('   2. Set up i18n in your project (react-i18next, react-intl, etc.)'));
    console.log(chalk.white('   3. Replace hardcoded strings with i18n calls using the keymap file'));
    console.log(chalk.white('   4. Validate keys: i18n-finder --validate=./locales/en.json'));
    console.log(chalk.white('   5. Run this scan again to verify\n'));
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

  /**
   * Generate i18n translation file from detected strings
   */
  generateI18nFile(outputPath, rootPath, options = {}) {
    const { flat = false, namespace = true } = options;
    
    if (this.results.length === 0) {
      console.log(chalk.yellow('\n⚠️  No hardcoded strings found to generate translations from.\n'));
      return;
    }

    const translations = {};
    const keyMap = {}; // Track original string -> key mapping
    const usedKeys = new Set(); // Track used keys to avoid duplicates

    this.results.forEach((result) => {
      const ns = namespace ? this.getNamespaceFromPath(result.file, rootPath) : '';
      let baseKey = this.generateKey(result.value, result.context);
      
      // Ensure unique key
      let key = baseKey;
      let counter = 1;
      const fullKey = ns ? `${ns}.${key}` : key;
      
      while (usedKeys.has(ns ? `${ns}.${key}` : key)) {
        key = `${baseKey}_${counter}`;
        counter++;
      }
      
      const finalFullKey = ns ? `${ns}.${key}` : key;
      usedKeys.add(finalFullKey);

      if (flat || !namespace) {
        // Flat structure
        translations[key] = result.value;
      } else {
        // Nested structure based on namespace
        const parts = finalFullKey.split('.');
        let current = translations;
        
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = {};
          }
          current = current[parts[i]];
        }
        
        current[parts[parts.length - 1]] = result.value;
      }

      // Store mapping for reference
      keyMap[result.value] = {
        key: finalFullKey,
        file: result.file,
        line: result.line,
      };
    });

    // Write translation file
    fs.writeFileSync(outputPath, JSON.stringify(translations, null, 2));
    console.log(chalk.green(`\n✅ Generated i18n file: ${outputPath}`));
    console.log(chalk.gray(`   Contains ${Object.keys(keyMap).length} translation keys\n`));

    // Also write key mapping file for reference
    const mapPath = outputPath.replace(/\.json$/, '.keymap.json');
    fs.writeFileSync(mapPath, JSON.stringify(keyMap, null, 2));
    console.log(chalk.gray(`   Key mapping saved to: ${mapPath}\n`));

    return translations;
  }

  /**
   * Extract i18n keys used in the codebase
   */
  extractUsedKeys(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');

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

      traverse.default(ast, {
        CallExpression: (nodePath) => {
          const callee = nodePath.node.callee;
          let isI18nCall = false;
          let functionName = '';

          // Check direct function call: t('key')
          if (t.isIdentifier(callee) && 
              this.config.i18nFunctionNames.includes(callee.name)) {
            isI18nCall = true;
            functionName = callee.name;
          }

          // Check member expression: i18n.t('key')
          if (t.isMemberExpression(callee) && 
              t.isIdentifier(callee.property) &&
              this.config.i18nFunctionNames.includes(callee.property.name)) {
            isI18nCall = true;
            functionName = callee.property.name;
          }

          if (isI18nCall && nodePath.node.arguments.length > 0) {
            const firstArg = nodePath.node.arguments[0];
            
            // String literal key
            if (t.isStringLiteral(firstArg)) {
              this.usedKeys.push({
                key: firstArg.value,
                file: filePath,
                line: firstArg.loc?.start.line,
                column: firstArg.loc?.start.column,
                function: functionName,
              });
            }
            
            // Template literal with no expressions (static key)
            if (t.isTemplateLiteral(firstArg) && firstArg.expressions.length === 0) {
              const key = firstArg.quasis[0].value.cooked;
              this.usedKeys.push({
                key,
                file: filePath,
                line: firstArg.loc?.start.line,
                column: firstArg.loc?.start.column,
                function: functionName,
              });
            }
          }
        },
      });

    } catch (error) {
      // Silently skip files that can't be parsed
    }
  }

  /**
   * Scan project for all used i18n keys
   */
  async scanUsedKeys(rootPath) {
    console.log(chalk.blue.bold('\n🔑 Scanning for i18n keys in use...\n'));

    const files = await glob(this.config.includePatterns, {
      cwd: rootPath,
      absolute: true,
      ignore: this.config.excludePatterns,
    });

    console.log(chalk.gray(`Scanning ${files.length} files for i18n keys\n`));

    files.forEach((file) => {
      this.extractUsedKeys(file);
    });

    console.log(chalk.gray(`Found ${this.usedKeys.length} i18n key usages\n`));
  }

  /**
   * Get all keys from a translation file (flattened)
   */
  getTranslationKeys(translationPath) {
    if (!fs.existsSync(translationPath)) {
      console.log(chalk.red(`\n❌ Translation file not found: ${translationPath}\n`));
      return null;
    }

    const content = fs.readFileSync(translationPath, 'utf-8');
    const translations = JSON.parse(content);
    
    const keys = new Set();
    
    const extractKeys = (obj, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'object' && value !== null) {
          extractKeys(value, fullKey);
        } else {
          keys.add(fullKey);
        }
      }
    };
    
    extractKeys(translations);
    return keys;
  }

  /**
   * Format file location as clickable link
   */
  formatFileLink(filePath, line = null, column = null) {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    if (line) {
      return `${absolutePath}:${line}${column ? ':' + column : ''}`;
    }
    return absolutePath;
  }

  /**
   * Check for duplicate keys in a translation file
   */
  checkDuplicateKeys(translationPath) {
    console.log(chalk.blue.bold('\n🔍 Checking for duplicate keys...\n'));

    if (!fs.existsSync(translationPath)) {
      console.log(chalk.red(`\n❌ Translation file not found: ${translationPath}\n`));
      return null;
    }

    const content = fs.readFileSync(translationPath, 'utf-8');
    const duplicates = [];
    const keyOccurrences = {};

    // Parse JSON while tracking key locations
    const findDuplicatesInObject = (obj, prefix = '', depth = 0) => {
      if (typeof obj !== 'object' || obj === null) return;
      
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (!keyOccurrences[fullKey]) {
          keyOccurrences[fullKey] = { count: 1, value };
        } else {
          keyOccurrences[fullKey].count++;
          duplicates.push({
            key: fullKey,
            value,
            existingValue: keyOccurrences[fullKey].value,
          });
        }
        
        if (typeof value === 'object' && value !== null) {
          findDuplicatesInObject(value, fullKey, depth + 1);
        }
      }
    };

    try {
      const translations = JSON.parse(content);
      findDuplicatesInObject(translations);
    } catch (error) {
      console.log(chalk.red(`\n❌ Error parsing translation file: ${error.message}\n`));
      return null;
    }

    // Also check for duplicate values (same text, different keys)
    const valueToKeys = {};
    const collectValues = (obj, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (typeof value === 'string') {
          if (!valueToKeys[value]) {
            valueToKeys[value] = [];
          }
          valueToKeys[value].push(fullKey);
        } else if (typeof value === 'object' && value !== null) {
          collectValues(value, fullKey);
        }
      }
    };

    const translations = JSON.parse(content);
    collectValues(translations);

    const duplicateValues = Object.entries(valueToKeys)
      .filter(([_, keys]) => keys.length > 1)
      .map(([value, keys]) => ({ value, keys }));

    // Report
    console.log(chalk.blue.bold('📊 Duplicate Check Results\n'));
    console.log(chalk.gray('='.repeat(80)));

    if (duplicates.length === 0 && duplicateValues.length === 0) {
      console.log(chalk.green.bold('\n✅ No duplicates found!\n'));
      return { duplicateKeys: [], duplicateValues: [] };
    }

    if (duplicates.length > 0) {
      console.log(chalk.red.bold(`\n❌ Duplicate Keys (${duplicates.length}):`));
      console.log(chalk.gray('   The same key appears multiple times:\n'));
      duplicates.forEach((dup) => {
        console.log(chalk.yellow(`   • ${dup.key}`));
        console.log(chalk.gray(`     Value 1: "${dup.existingValue}"`));
        console.log(chalk.gray(`     Value 2: "${dup.value}"`));
      });
    }

    if (duplicateValues.length > 0) {
      console.log(chalk.yellow.bold(`\n⚠️  Duplicate Values (${duplicateValues.length}):`));
      console.log(chalk.gray('   The same translation text exists under multiple keys:\n'));
      duplicateValues.slice(0, 20).forEach((dup) => {
        console.log(chalk.cyan(`   "${dup.value.substring(0, 50)}${dup.value.length > 50 ? '...' : ''}"`));
        dup.keys.forEach((key) => {
          console.log(chalk.gray(`     • ${key}`));
        });
      });
      if (duplicateValues.length > 20) {
        console.log(chalk.gray(`\n   ... and ${duplicateValues.length - 20} more`));
      }
    }

    console.log(chalk.gray('\n' + '='.repeat(80) + '\n'));

    return { duplicateKeys: duplicates, duplicateValues };
  }

  /**
   * Find where a translation string is used in the project
   */
  async findStringUsage(rootPath, translationPath, searchString) {
    console.log(chalk.blue.bold(`\n🔍 Finding usage of "${searchString}"...\n`));

    if (!fs.existsSync(translationPath)) {
      console.log(chalk.red(`\n❌ Translation file not found: ${translationPath}\n`));
      return null;
    }

    const content = fs.readFileSync(translationPath, 'utf-8');
    let translations;
    
    try {
      translations = JSON.parse(content);
    } catch (error) {
      console.log(chalk.red(`\n❌ Error parsing translation file: ${error.message}\n`));
      return null;
    }

    // Find keys that match the search string (by value)
    const matchingKeys = [];
    const searchLower = searchString.toLowerCase();

    const searchInObject = (obj, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof value === 'string') {
          // Match if value contains the search string (case-insensitive)
          if (value.toLowerCase().includes(searchLower)) {
            matchingKeys.push({ key: fullKey, value });
          }
        } else if (typeof value === 'object' && value !== null) {
          searchInObject(value, fullKey);
        }
      }
    };

    searchInObject(translations);

    if (matchingKeys.length === 0) {
      console.log(chalk.yellow(`\n⚠️  No translations found containing "${searchString}"\n`));
      return { matchingKeys: [], usages: [] };
    }

    console.log(chalk.cyan(`Found ${matchingKeys.length} matching translation(s):\n`));
    matchingKeys.forEach((match) => {
      console.log(chalk.white(`  • ${chalk.bold(match.key)}`));
      console.log(chalk.gray(`    "${match.value}"\n`));
    });

    // Now scan the codebase for usages of these keys
    console.log(chalk.blue.bold('Scanning codebase for key usages...\n'));
    
    // Reset used keys and scan
    this.usedKeys = [];
    await this.scanUsedKeys(rootPath);

    // Find usages of the matching keys
    const usages = [];
    matchingKeys.forEach((match) => {
      const keyUsages = this.usedKeys.filter((usage) => usage.key === match.key);
      if (keyUsages.length > 0) {
        usages.push({
          key: match.key,
          value: match.value,
          locations: keyUsages,
        });
      }
    });

    // Report
    console.log(chalk.blue.bold('\n📊 Usage Results\n'));
    console.log(chalk.gray('='.repeat(80)));

    if (usages.length === 0) {
      console.log(chalk.yellow.bold('\n⚠️  No usages found in code for these keys.\n'));
      console.log(chalk.gray('   The translation exists but might not be used anywhere.\n'));
      
      // Show the keys that weren't found
      matchingKeys.forEach((match) => {
        console.log(chalk.gray(`   • ${match.key} - not used in code`));
      });
    } else {
      usages.forEach((usage) => {
        console.log(chalk.green.bold(`\n✅ "${usage.value}"`));
        console.log(chalk.cyan(`   Key: ${usage.key}`));
        console.log(chalk.white(`   Found in ${usage.locations.length} location(s):\n`));
        
        usage.locations.forEach((loc) => {
          const link = this.formatFileLink(loc.file, loc.line, loc.column);
          console.log(chalk.blue(`   📄 ${link}`));
          console.log(chalk.gray(`      ${loc.function}('${loc.key}')\n`));
        });
      });
    }

    // Show keys that exist but weren't found in code
    const unusedMatchingKeys = matchingKeys.filter(
      (match) => !usages.some((u) => u.key === match.key)
    );
    
    if (unusedMatchingKeys.length > 0 && usages.length > 0) {
      console.log(chalk.yellow.bold(`\n⚠️  Keys not found in code:`));
      unusedMatchingKeys.forEach((match) => {
        console.log(chalk.gray(`   • ${match.key}`));
      });
    }

    console.log(chalk.gray('\n' + '='.repeat(80) + '\n'));

    return { matchingKeys, usages };
  }

  /**
   * Complete i18n generation - extract existing keys AND generate new ones from hardcoded strings
   */
  async generateComplete(rootPath, outputPath, options = {}) {
    const { flat = false, namespace = true, placeholder = '' } = options;
    
    console.log(chalk.blue.bold('\n🔄 Complete i18n Generation\n'));
    console.log(chalk.gray('   This will extract existing keys AND generate new ones for hardcoded strings\n'));

    // Step 1: Extract existing keys
    console.log(chalk.cyan('Step 1: Extracting existing i18n keys...\n'));
    this.usedKeys = [];
    await this.scanUsedKeys(rootPath);
    
    const existingKeys = new Map();
    this.usedKeys.forEach((keyInfo) => {
      if (!existingKeys.has(keyInfo.key)) {
        existingKeys.set(keyInfo.key, {
          key: keyInfo.key,
          value: placeholder, // Empty or placeholder - user needs to fill these
          source: 'existing',
          locations: [],
        });
      }
      existingKeys.get(keyInfo.key).locations.push({
        file: keyInfo.file,
        line: keyInfo.line,
      });
    });

    console.log(chalk.gray(`   Found ${existingKeys.size} existing i18n keys\n`));

    // Step 2: Scan for hardcoded strings
    console.log(chalk.cyan('Step 2: Scanning for hardcoded strings...\n'));
    this.results = [];
    this.stats = { filesScanned: 0, filesWithIssues: 0, totalStrings: 0, stringsByType: {} };
    await this.scanProject(rootPath);

    console.log(chalk.gray(`   Found ${this.results.length} hardcoded strings\n`));

    // Step 3: Generate new keys for hardcoded strings
    console.log(chalk.cyan('Step 3: Generating keys for hardcoded strings...\n'));
    
    const newKeys = new Map();
    const usedKeyNames = new Set(existingKeys.keys());

    this.results.forEach((result) => {
      const ns = namespace ? this.getNamespaceFromPath(result.file, rootPath) : '';
      let baseKey = this.generateKey(result.value, result.context);
      
      // Ensure unique key
      let key = baseKey;
      let counter = 1;
      let fullKey = ns ? `${ns}.${key}` : key;
      
      while (usedKeyNames.has(fullKey) || newKeys.has(fullKey)) {
        key = `${baseKey}_${counter}`;
        fullKey = ns ? `${ns}.${key}` : key;
        counter++;
      }

      if (!newKeys.has(fullKey)) {
        newKeys.set(fullKey, {
          key: fullKey,
          value: result.value, // Use the actual string as the value
          source: 'hardcoded',
          locations: [],
        });
      }
      
      newKeys.get(fullKey).locations.push({
        file: result.file,
        line: result.line,
        originalValue: result.value,
      });
    });

    console.log(chalk.gray(`   Generated ${newKeys.size} new keys\n`));

    // Step 4: Merge and build translation file
    console.log(chalk.cyan('Step 4: Building translation file...\n'));
    
    const translations = {};
    const allKeys = new Map([...existingKeys, ...newKeys]);
    
    allKeys.forEach((keyData, fullKey) => {
      if (flat) {
        translations[fullKey] = keyData.value;
      } else {
        const parts = fullKey.split('.');
        let current = translations;
        
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = {};
          }
          if (typeof current[parts[i]] === 'string') {
            current[parts[i]] = { _value: current[parts[i]] };
          }
          current = current[parts[i]];
        }
        
        current[parts[parts.length - 1]] = keyData.value;
      }
    });

    // Write translation file
    fs.writeFileSync(outputPath, JSON.stringify(translations, null, 2));

    // Write detailed keymap
    const keymapPath = outputPath.replace(/\.json$/, '.keymap.json');
    const keymap = {};
    allKeys.forEach((keyData, fullKey) => {
      keymap[fullKey] = {
        value: keyData.value,
        source: keyData.source,
        locations: keyData.locations.map((loc) => ({
          file: path.relative(rootPath, loc.file),
          line: loc.line,
          link: this.formatFileLink(loc.file, loc.line),
        })),
      };
    });
    fs.writeFileSync(keymapPath, JSON.stringify(keymap, null, 2));

    // Report
    console.log(chalk.blue.bold('\n📊 Complete Generation Results\n'));
    console.log(chalk.gray('='.repeat(80)));
    
    console.log(chalk.green.bold(`\n✅ Generated: ${outputPath}`));
    console.log(chalk.white(`   Total keys: ${allKeys.size}`));
    console.log(chalk.cyan(`   • Existing i18n keys: ${existingKeys.size}`));
    console.log(chalk.yellow(`   • New keys (from hardcoded strings): ${newKeys.size}`));
    
    console.log(chalk.gray(`\n   Keymap saved to: ${keymapPath}\n`));

    // Show breakdown by source
    if (existingKeys.size > 0) {
      console.log(chalk.cyan('\nExisting keys (need translation values):'));
      const existingSample = Array.from(existingKeys.keys()).slice(0, 5);
      existingSample.forEach((key) => {
        console.log(chalk.gray(`   • ${key}`));
      });
      if (existingKeys.size > 5) {
        console.log(chalk.gray(`   ... and ${existingKeys.size - 5} more`));
      }
    }

    if (newKeys.size > 0) {
      console.log(chalk.yellow('\nNew keys (values pre-filled from hardcoded strings):'));
      const newSample = Array.from(newKeys.entries()).slice(0, 5);
      newSample.forEach(([key, data]) => {
        console.log(chalk.gray(`   • ${key}`));
        console.log(chalk.gray(`     "${data.value.substring(0, 40)}${data.value.length > 40 ? '...' : ''}"`));
      });
      if (newKeys.size > 5) {
        console.log(chalk.gray(`   ... and ${newKeys.size - 5} more`));
      }
    }

    console.log(chalk.cyan('\n💡 Next steps:'));
    if (existingKeys.size > 0) {
      console.log(chalk.white('   1. Fill in translation values for existing keys (currently empty)'));
    }
    console.log(chalk.white(`   ${existingKeys.size > 0 ? '2' : '1'}. Replace hardcoded strings with t() calls using the keymap`));
    console.log(chalk.white(`   ${existingKeys.size > 0 ? '3' : '2'}. Run validation: i18n-finder --validate=${outputPath}`));
    
    console.log(chalk.gray('\n' + '='.repeat(80) + '\n'));

    return {
      translations,
      existingKeys: Array.from(existingKeys.values()),
      newKeys: Array.from(newKeys.values()),
      stats: {
        total: allKeys.size,
        existing: existingKeys.size,
        new: newKeys.size,
      },
    };
  }

  /**
   * Extract keys from existing i18n calls and generate translation file
   */
  async extractKeysFromCode(rootPath, outputPath, options = {}) {
    const { placeholder = '', includeLocations = false } = options;
    
    console.log(chalk.blue.bold('\n🔑 Extracting i18n keys from codebase...\n'));

    // Scan for used keys
    this.usedKeys = [];
    await this.scanUsedKeys(rootPath);

    if (this.usedKeys.length === 0) {
      console.log(chalk.yellow('\n⚠️  No i18n keys found in the codebase.\n'));
      return null;
    }

    // Deduplicate keys
    const uniqueKeys = new Map();
    this.usedKeys.forEach((keyInfo) => {
      if (!uniqueKeys.has(keyInfo.key)) {
        uniqueKeys.set(keyInfo.key, {
          key: keyInfo.key,
          locations: [],
        });
      }
      uniqueKeys.get(keyInfo.key).locations.push({
        file: keyInfo.file,
        line: keyInfo.line,
        column: keyInfo.column,
        function: keyInfo.function,
      });
    });

    console.log(chalk.cyan(`Found ${uniqueKeys.size} unique keys\n`));

    // Build nested translation structure
    const translations = {};
    const keyList = [];

    uniqueKeys.forEach((keyData, key) => {
      keyList.push(keyData);
      
      // Split key by dots and build nested structure
      const parts = key.split('.');
      let current = translations;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        // If current value is a string (leaf), convert to object
        if (typeof current[parts[i]] === 'string') {
          current[parts[i]] = { _value: current[parts[i]] };
        }
        current = current[parts[i]];
      }
      
      const lastPart = parts[parts.length - 1];
      current[lastPart] = placeholder;
    });

    // Write translation file
    fs.writeFileSync(outputPath, JSON.stringify(translations, null, 2));
    console.log(chalk.green(`\n✅ Generated translation file: ${outputPath}`));
    console.log(chalk.gray(`   Contains ${uniqueKeys.size} keys\n`));

    // Write locations file if requested
    if (includeLocations) {
      const locationsPath = outputPath.replace(/\.json$/, '.locations.json');
      const locationsData = {};
      keyList.forEach((keyData) => {
        locationsData[keyData.key] = keyData.locations.map((loc) => ({
          file: path.relative(rootPath, loc.file),
          line: loc.line,
          link: this.formatFileLink(loc.file, loc.line, loc.column),
        }));
      });
      fs.writeFileSync(locationsPath, JSON.stringify(locationsData, null, 2));
      console.log(chalk.gray(`   Key locations saved to: ${locationsPath}\n`));
    }

    // Display summary by namespace
    const namespaces = {};
    keyList.forEach((keyData) => {
      const parts = keyData.key.split('.');
      const ns = parts.length > 1 ? parts[0] : '_root';
      namespaces[ns] = (namespaces[ns] || 0) + 1;
    });

    console.log(chalk.cyan('Keys by namespace:'));
    Object.entries(namespaces)
      .sort((a, b) => b[1] - a[1])
      .forEach(([ns, count]) => {
        console.log(chalk.white(`  ${ns}: ${count}`));
      });

    // Show sample keys
    console.log(chalk.cyan('\nSample keys found:'));
    keyList.slice(0, 10).forEach((keyData) => {
      console.log(chalk.gray(`  • ${keyData.key}`));
      if (keyData.locations.length > 0) {
        const loc = keyData.locations[0];
        console.log(chalk.gray(`    └─ ${path.relative(rootPath, loc.file)}:${loc.line}`));
      }
    });
    if (keyList.length > 10) {
      console.log(chalk.gray(`  ... and ${keyList.length - 10} more`));
    }

    console.log('');

    return { translations, keys: keyList };
  }

  /**
   * Validate i18n keys - find missing and unused keys
   */
  async validateKeys(rootPath, translationPath) {
    console.log(chalk.blue.bold('\n🔍 Validating i18n keys...\n'));

    // Get keys from translation file
    const definedKeys = this.getTranslationKeys(translationPath);
    if (!definedKeys) return;

    console.log(chalk.gray(`Found ${definedKeys.size} keys in translation file\n`));

    // Scan for used keys
    await this.scanUsedKeys(rootPath);

    // Analyze
    const usedKeySet = new Set(this.usedKeys.map(k => k.key));
    const missingKeys = []; // Used but not defined
    const unusedKeys = []; // Defined but not used

    // Find missing keys
    this.usedKeys.forEach((keyInfo) => {
      if (!definedKeys.has(keyInfo.key)) {
        missingKeys.push(keyInfo);
      }
    });

    // Find unused keys
    definedKeys.forEach((key) => {
      if (!usedKeySet.has(key)) {
        unusedKeys.push(key);
      }
    });

    // Report
    console.log(chalk.blue.bold('\n📊 Validation Results\n'));
    console.log(chalk.gray('='.repeat(80)));
    
    console.log(chalk.cyan('\nSummary:'));
    console.log(chalk.white(`  Keys in translation file: ${definedKeys.size}`));
    console.log(chalk.white(`  Keys used in code: ${usedKeySet.size}`));
    console.log(chalk.white(`  Missing keys (used but not defined): ${missingKeys.length}`));
    console.log(chalk.white(`  Unused keys (defined but not used): ${unusedKeys.length}`));

    if (missingKeys.length > 0) {
      console.log(chalk.red.bold(`\n❌ Missing Keys (${missingKeys.length}):`));
      console.log(chalk.gray('   These keys are used in code but not defined in translation file:\n'));
      
      // Group by file
      const byFile = {};
      missingKeys.forEach((keyInfo) => {
        if (!byFile[keyInfo.file]) byFile[keyInfo.file] = [];
        byFile[keyInfo.file].push(keyInfo);
      });

      Object.entries(byFile).forEach(([file, keys]) => {
        const link = this.formatFileLink(file, keys[0].line);
        console.log(chalk.blue(`   📄 ${link}`));
        keys.forEach((keyInfo) => {
          const lineLink = this.formatFileLink(keyInfo.file, keyInfo.line, keyInfo.column);
          console.log(chalk.yellow(`      ${lineLink}`));
          console.log(chalk.gray(`      ${keyInfo.function}('${keyInfo.key}')`));
        });
      });
    }

    if (unusedKeys.length > 0) {
      console.log(chalk.yellow.bold(`\n⚠️  Unused Keys (${unusedKeys.length}):`));
      console.log(chalk.gray('   These keys are defined but not found in code:\n'));
      
      unusedKeys.forEach((key) => {
        console.log(chalk.gray(`   • ${key}`));
      });
    }

    if (missingKeys.length === 0 && unusedKeys.length === 0) {
      console.log(chalk.green.bold('\n✅ All keys are valid! No missing or unused keys found.\n'));
    }

    console.log(chalk.gray('\n' + '='.repeat(80) + '\n'));

    return {
      definedKeys: Array.from(definedKeys),
      usedKeys: Array.from(usedKeySet),
      missingKeys,
      unusedKeys,
    };
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
      description: 'Output JSON file path (scan results)',
    })
    .option('min-length', {
      type: 'number',
      description: 'Minimum string length to consider',
      default: 2,
    })
    .option('generate', {
      alias: 'g',
      type: 'string',
      description: 'Generate i18n translation file from detected strings',
    })
    .option('flat', {
      type: 'boolean',
      description: 'Generate flat translation file (no nested structure)',
      default: false,
    })
    .option('no-namespace', {
      type: 'boolean',
      description: 'Disable namespace generation based on file paths',
      default: false,
    })
    .option('validate', {
      alias: 'v',
      type: 'string',
      description: 'Validate i18n keys against a translation file',
    })
    .option('validate-output', {
      type: 'string',
      description: 'Output validation results to JSON file',
    })
    .option('check-duplicates', {
      alias: 'd',
      type: 'string',
      description: 'Check for duplicate keys in a translation file',
    })
    .option('find-string', {
      alias: 'f',
      type: 'string',
      description: 'Find where a translation string is used in the project',
    })
    .option('translation-file', {
      alias: 't',
      type: 'string',
      description: 'Translation file to use with --find-string',
    })
    .option('extract-keys', {
      alias: 'e',
      type: 'string',
      description: 'Extract keys from existing i18n calls and generate translation file',
    })
    .option('complete', {
      type: 'string',
      description: 'Complete generation: existing keys + new keys for hardcoded strings',
    })
    .option('placeholder', {
      type: 'string',
      description: 'Placeholder value for extracted keys (default: empty string)',
      default: '',
    })
    .option('with-locations', {
      type: 'boolean',
      description: 'Include a locations file showing where each key is used',
      default: false,
    })
    .example('$0 --path=./src', 'Scan for hardcoded strings')
    .example('$0 --generate=./locales/en.json', 'Generate translation file')
    .example('$0 --validate=./locales/en.json', 'Validate keys against translation file')
    .example('$0 --generate=./en.json --flat', 'Generate flat translation file')
    .example('$0 --check-duplicates=./locales/en.json', 'Check for duplicate keys')
    .example('$0 --find-string="Welcome" -t=./locales/en.json', 'Find where "Welcome" is used')
    .example('$0 --extract-keys=./locales/en.json', 'Extract keys from existing i18n calls')
    .example('$0 --extract-keys=./en.json --with-locations', 'Extract keys with usage locations')
    .example('$0 --complete=./locales/en.json', 'Complete: existing keys + hardcoded strings')
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

  // Mode: Complete generation (existing + hardcoded)
  if (argv.complete) {
    const result = await finder.generateComplete(argv.path, argv.complete, {
      flat: argv.flat,
      namespace: !argv.noNamespace,
      placeholder: argv.placeholder,
    });
    if (argv.validateOutput && result) {
      fs.writeFileSync(argv.validateOutput, JSON.stringify(result, null, 2));
      console.log(chalk.green(`✅ Complete generation results exported to ${argv.validateOutput}\n`));
    }
    return;
  }

  // Mode: Extract keys from existing i18n calls
  if (argv.extractKeys) {
    const result = await finder.extractKeysFromCode(argv.path, argv.extractKeys, {
      placeholder: argv.placeholder,
      includeLocations: argv.withLocations,
    });
    if (argv.validateOutput && result) {
      fs.writeFileSync(argv.validateOutput, JSON.stringify(result, null, 2));
      console.log(chalk.green(`✅ Extraction results exported to ${argv.validateOutput}\n`));
    }
    return;
  }

  // Mode: Check duplicates
  if (argv.checkDuplicates) {
    const result = finder.checkDuplicateKeys(argv.checkDuplicates);
    if (argv.validateOutput && result) {
      fs.writeFileSync(argv.validateOutput, JSON.stringify(result, null, 2));
      console.log(chalk.green(`✅ Duplicate check results exported to ${argv.validateOutput}\n`));
    }
    return;
  }

  // Mode: Find string usage
  if (argv.findString) {
    const translationFile = argv.translationFile || argv.t;
    if (!translationFile) {
      console.log(chalk.red('\n❌ Please provide a translation file with --translation-file or -t\n'));
      console.log(chalk.gray('   Example: i18n-finder --find-string="Welcome" -t=./locales/en.json\n'));
      return;
    }
    const result = await finder.findStringUsage(argv.path, translationFile, argv.findString);
    if (argv.validateOutput && result) {
      fs.writeFileSync(argv.validateOutput, JSON.stringify(result, null, 2));
      console.log(chalk.green(`✅ Search results exported to ${argv.validateOutput}\n`));
    }
    return;
  }

  // Mode: Validate keys
  if (argv.validate) {
    const validationResult = await finder.validateKeys(argv.path, argv.validate);
    
    if (argv.validateOutput && validationResult) {
      fs.writeFileSync(argv.validateOutput, JSON.stringify(validationResult, null, 2));
      console.log(chalk.green(`✅ Validation results exported to ${argv.validateOutput}\n`));
    }
    return;
  }

  // Default mode: Scan for hardcoded strings
  await finder.scanProject(argv.path);
  finder.generateReport();

  // Export scan results
  if (argv.output) {
    finder.exportToJson(argv.output);
  }

  // Generate i18n file
  if (argv.generate) {
    finder.generateI18nFile(argv.generate, argv.path, {
      flat: argv.flat,
      namespace: !argv.noNamespace,
    });
  }
}

main().catch(console.error);
