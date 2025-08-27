import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import unusedImports from 'eslint-plugin-unused-imports';

export default ts.config(
  // Ignore patterns
  {
    ignores: [
      '**/node_modules/**',
      '**/.wxt/**',
      '**/.output/**',
      '**/dist/**',
      '**/build/**',
      '**/.svelte-kit/**',
      '**/public/**',
      '**/*.min.js'
    ]
  },

  // Base JavaScript and TypeScript configuration
  js.configs.recommended,
  ...ts.configs.recommended,

  // General configuration for all files
  {
    files: ['**/*.{js,ts,mjs,cjs}'],
    plugins: {
      'unused-imports': unusedImports
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.webextensions,
        // WXT globals
        browser: 'readonly',
        chrome: 'readonly',
        // Custom globals for the extension
        logger: 'readonly',
        defineBackground: 'readonly',
        defineContentScript: 'readonly',
        defineUnlistedScript: 'readonly'
      }
    },
    rules: {
      // General JavaScript/TypeScript rules
      'no-console': 'warn',
      'no-debugger': 'warn',
      
      // Unused imports configuration
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_'
        }
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-var-requires': 'off',
      
      // Code style
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      
      // Best practices
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error'
    }
  },

  // Svelte configuration
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.svelte'],
    plugins: {
      'unused-imports': unusedImports
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: svelte.parser,
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: ['.svelte'],
        svelteFeatures: {
          runes: true
        }
      },
      globals: {
        ...globals.browser,
        $state: 'readonly',
        $derived: 'readonly',
        $effect: 'readonly',
        $props: 'readonly',
        $bindable: 'readonly',
        $inspect: 'readonly'
      }
    },
    rules: {
      // Unused imports for Svelte files
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_'
        }
      ],
      
      // Svelte rules
      'svelte/valid-compile': 'error',
      'svelte/no-at-debug-tags': 'warn',
      'svelte/no-unused-svelte-ignore': 'warn',
      'svelte/require-store-reactive-access': 'warn',
      'svelte/no-store-async': 'error',
      
      // Style preferences
      'svelte/html-self-closing': 'warn',
      'svelte/mustache-spacing': 'warn',
      'svelte/no-spaces-around-equal-signs-in-attribute': 'warn',
      'svelte/prefer-class-directive': 'warn',
      'svelte/prefer-style-directive': 'warn',
      'svelte/shorthand-attribute': 'warn',
      'svelte/shorthand-directive': 'warn',
      'svelte/sort-attributes': 'warn',
      'svelte/spaced-html-comment': 'warn',
    }
  },

  // WXT configuration
  {
    files: ['**/entrypoints/**/*.{ts,js}', '**/wxt.config.ts'],
    languageOptions: {
      globals: {
        defineBackground: 'readonly',
        defineContentScript: 'readonly',
        defineUnlistedScript: 'readonly',
        defineConfig: 'readonly'
      }
    }
  },

  // Configuration files
  {
    files: ['**/*.config.{js,ts,mjs,cjs}', '**/postcss.config.js'],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
      '@typescript-eslint/no-var-requires': 'off'
    }
  },

  // Files where console statements are acceptable
  {
    files: [
      '**/lib/utils/logger.ts',
      '**/lib/services/api-client.ts',
      '**/lib/services/settings-bridge.ts',
      '**/lib/stores/settings.ts', 
      '**/lib/stores/statistics.ts'
    ],
    rules: {
      'no-console': 'off'
    }
  }
); 