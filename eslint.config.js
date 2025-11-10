import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import unusedImports from 'eslint-plugin-unused-imports';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import svelteEslintParser from 'svelte-eslint-parser';

export default tseslint.config(
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
			'**/scripts/**',
			'**/*.min.js',
			'*.config.{js,ts,mjs,cjs}'
		]
	},
	// Global settings
	{
		settings: {
			'better-tailwindcss': { entryPoint: 'src/styles/index.css' }
		}
	},
	// Base JavaScript and TypeScript configuration
	js.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	// General configuration for all files
	{
		files: ['**/*.{js,ts,mjs,cjs}'],
		ignores: ['**/*.config.{js,ts,mjs,cjs}'],
		plugins: {
			'unused-imports': unusedImports,
			'better-tailwindcss': betterTailwindcss
		},
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			parser: tseslint.parser,
			parserOptions: {
				projectService: true
			},
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
			/* === Code Quality & Safety === */ 'no-console': 'warn',
			'no-debugger': 'warn',
			eqeqeq: ['error', 'always'],
			'no-eval': 'error',
			'no-implied-eval': 'error',
			'no-new-func': 'error',
			'no-script-url': 'error',
			/* === Import Management === */ 'no-unused-vars': 'off',
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
			'no-duplicate-imports': 'error',
			'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
			/* === TypeScript Configuration === */ '@typescript-eslint/explicit-function-return-type':
				'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'@typescript-eslint/no-var-requires': 'off',
			/* === TypeScript Best Practices === */ '@typescript-eslint/no-unnecessary-type-assertion':
				'error',
			'@typescript-eslint/prefer-nullish-coalescing': 'error',
			'@typescript-eslint/prefer-optional-chain': 'error',
			'@typescript-eslint/prefer-as-const': 'error',
			'@typescript-eslint/no-redundant-type-constituents': 'error',
			'@typescript-eslint/no-useless-empty-export': 'error',
			'@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
			'@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
			'@typescript-eslint/no-unsafe-argument': 'error',
			'@typescript-eslint/no-unsafe-assignment': 'error',
			'@typescript-eslint/no-unsafe-call': 'error',
			'@typescript-eslint/no-unsafe-member-access': 'error',
			'@typescript-eslint/no-unsafe-return': 'error',
			'@typescript-eslint/prefer-for-of': 'warn',
			'@typescript-eslint/no-array-delete': 'error',
			'@typescript-eslint/switch-exhaustiveness-check': 'error',
			'@typescript-eslint/prefer-readonly': 'error',
			'@typescript-eslint/prefer-string-starts-ends-with': 'error',
			'@typescript-eslint/prefer-includes': 'error',
			'@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
			'@typescript-eslint/prefer-reduce-type-parameter': 'error',
			'@typescript-eslint/prefer-function-type': 'error',
			'@typescript-eslint/no-import-type-side-effects': 'error',
			'@typescript-eslint/no-base-to-string': 'error',
			'@typescript-eslint/no-for-in-array': 'error',
			'@typescript-eslint/restrict-plus-operands': 'error',
			'@typescript-eslint/restrict-template-expressions': 'error',
			'@typescript-eslint/no-confusing-void-expression': 'error',
			'@typescript-eslint/prefer-find': 'warn',
			'@typescript-eslint/require-array-sort-compare': 'warn',
			'@typescript-eslint/no-deprecated': 'warn',
			'@typescript-eslint/prefer-regexp-exec': 'warn',
			'@typescript-eslint/return-await': 'error',
			'@typescript-eslint/consistent-type-exports': 'error',
			/* === Promise/Async Handling === */ '@typescript-eslint/await-thenable': 'error',
			'@typescript-eslint/require-await': 'off', // note: we disable this for interface consistency
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': [
				'error',
				{
					checksVoidReturn: { arguments: false, attributes: false }
				}
			],
			'@typescript-eslint/promise-function-async': 'error',
			'prefer-promise-reject-errors': 'error',
			/* === Modern JavaScript === */ 'prefer-const': 'error',
			'no-var': 'error',
			'object-shorthand': 'error',
			'prefer-arrow-callback': 'error',
			'prefer-template': 'error',
			/* === Error Prevention === */ 'no-throw-literal': 'error',
			'no-constructor-return': 'error',
			'no-self-compare': 'error',
			'no-unmodified-loop-condition': 'warn',
			'no-unreachable-loop': 'error',
			'no-unused-private-class-members': 'warn',
			'no-template-curly-in-string': 'warn'
		}
	},
	/* === Svelte Configuration === */ ...svelte.configs['flat/recommended'],
	...svelte.configs.prettier,
	{
		files: ['**/*.svelte'],
		plugins: { 'unused-imports': unusedImports },
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			parserOptions: {
				parser: tseslint.parser,
				projectService: true,
				extraFileExtensions: ['.svelte'],
				svelteFeatures: { runes: true }
			},
			globals: {
				...globals.browser,
				...globals.webextensions,
				browser: 'readonly',
				chrome: 'readonly',
				$state: 'readonly',
				$derived: 'readonly',
				$effect: 'readonly',
				$props: 'readonly',
				$bindable: 'readonly',
				$inspect: 'readonly'
			}
		},
		rules: {
			/* === Import Management === */ 'unused-imports/no-unused-imports': 'error',
			'unused-imports/no-unused-vars': [
				'warn',
				{
					vars: 'all',
					varsIgnorePattern: '^_',
					args: 'after-used',
					argsIgnorePattern: '^_'
				}
			],
			/* === Svelte Correctness === */ 'svelte/valid-compile': 'error', // Ensure Svelte code compiles
			'svelte/no-at-debug-tags': 'warn', // Warn about debug tags in production
			'svelte/no-unused-svelte-ignore': 'warn', // Clean up unused ignore comments
			'svelte/require-store-reactive-access': 'warn', // Ensure proper store access in templates
			'svelte/no-store-async': 'error', // Prevent async stores (causes issues)
			'svelte/no-dom-manipulating': 'error', // Prevent direct DOM manipulation
			'svelte/no-dupe-else-if-blocks': 'error', // Prevent duplicate else-if conditions
			'svelte/no-dupe-on-directives': 'error', // Prevent duplicate on: handlers
			'svelte/no-dupe-use-directives': 'error', // Prevent duplicate use: directives
			'svelte/no-dupe-style-properties': 'error', // Prevent duplicate CSS properties
			'svelte/no-not-function-handler': 'error', // Ensure event handlers are functions
			'svelte/no-object-in-text-mustaches': 'error', // Prevent objects in {text}
			'svelte/valid-each-key': 'error', // Validate {#each} key variables
			'svelte/no-shorthand-style-property-overrides': 'error', // CSS shorthand conflicts
			'svelte/no-at-html-tags': 'error', // Prevent XSS with {@html}
			'svelte/no-target-blank': 'warn', // Security: require rel="noopener noreferrer"
			'svelte/infinite-reactive-loop': 'error', // Prevent infinite reactive loops
			'svelte/no-reactive-reassign': 'warn', // Prevent reassigning reactive values
			'svelte/require-each-key': 'warn', // Performance: keyed {#each} blocks
			'svelte/no-unnecessary-state-wrap': 'warn', // Don't wrap reactive classes in $state
			'svelte/prefer-writable-derived': 'warn', // Use writable $derived over $state + $effect
			'svelte/no-useless-children-snippet': 'warn', // Remove unnecessary children snippets
			'svelte/prefer-svelte-reactivity': 'error', // Use Svelte reactivity over JS classes
			'svelte/button-has-type': 'warn', // Explicit button types
			'svelte/no-ignored-unsubscribe': 'error', // Always handle store unsubscribe
			'svelte/require-store-callbacks-use-set-param': 'error', // Proper store callback patterns
			'svelte/no-raw-special-elements': 'error', // Prevent invalid HTML elements
			'svelte/valid-style-parse': 'error', // Valid CSS in style blocks
			'svelte/no-unknown-style-directive-property': 'error', // Valid style: directives
			'svelte/no-immutable-reactive-statements': 'error', // Reactive statements must be reactive
			'svelte/no-reactive-functions': 'error', // Don't define functions in reactive statements
			'svelte/no-reactive-literals': 'error', // Don't assign literals in reactive statements
			'svelte/require-event-dispatcher-types': 'warn', // Type-safe event dispatchers
			'svelte/require-stores-init': 'warn', // Initialize stores properly
			'svelte/no-svelte-internal': 'error', // Avoid svelte/internal (deprecated)
			'svelte/derived-has-same-inputs-outputs': 'warn', // Consistent derived store naming
			/* === Svelte Style Preferences === */ 'svelte/html-self-closing': 'warn', // Consistent self-closing tag style
			'svelte/mustache-spacing': 'warn', // Consistent spacing in mustache expressions
			'svelte/no-spaces-around-equal-signs-in-attribute': 'warn',
			'svelte/prefer-class-directive': 'warn', // Use class: directives over manual classes
			'svelte/prefer-style-directive': 'warn', // Use style: directives over manual styles
			'svelte/shorthand-attribute': 'warn', // Use {value} instead of value={value}
			'svelte/shorthand-directive': 'warn', // Use on:click instead of on:click={handler}
			'svelte/sort-attributes': 'warn', // Consistent attribute ordering
			'svelte/spaced-html-comment': 'warn', // Consistent HTML comment spacing
			'svelte/no-useless-mustaches': 'warn' // Remove unnecessary {expression}
		}
	},
	/* === Tailwind CSS for Svelte === */ {
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteEslintParser,
			parserOptions: {
				parser: tseslint.parser,
				projectService: true,
				extraFileExtensions: ['.svelte']
			}
		},
		plugins: { 'better-tailwindcss': betterTailwindcss },
		rules: {
			/* === Correctness Rules === */ 'better-tailwindcss/no-duplicate-classes': 'error',
			'better-tailwindcss/no-conflicting-classes': 'error',
			'better-tailwindcss/no-unregistered-classes': 'off',
			'better-tailwindcss/no-restricted-classes': 'off',
			/* === Stylistic Rules === */ 'better-tailwindcss/no-unnecessary-whitespace': 'warn',
			'better-tailwindcss/no-deprecated-classes': 'warn',
			'better-tailwindcss/enforce-consistent-class-order': 'off',
			'better-tailwindcss/enforce-consistent-line-wrapping': 'off',
			'better-tailwindcss/enforce-consistent-variable-syntax': 'warn',
			'better-tailwindcss/enforce-consistent-important-position': 'warn',
			'better-tailwindcss/enforce-shorthand-classes': 'warn'
		}
	},
	/* === WXT Framework Configuration === */ {
		files: ['**/entrypoints/**/*.{ts,js}'],
		languageOptions: {
			globals: {
				defineBackground: 'readonly', // WXT background script globals
				defineContentScript: 'readonly', // WXT content script globals
				defineUnlistedScript: 'readonly', // WXT unlisted script globals
				defineConfig: 'readonly' // WXT config globals
			}
		}
	},
	/* === Files Where Console Logging Is Acceptable === */ {
		files: [
			'**/lib/utils/logger.ts', // Logger utility needs console access
			'**/lib/services/api-client.ts', // API client logs important events
			'**/lib/services/settings-bridge.ts', // Settings bridge logs initialization
			'**/lib/stores/settings.ts', // Settings store logs changes
			'**/lib/stores/statistics.ts' // Statistics store logs operations
		],
		rules: {
			'no-console': 'off' // Allow console statements in these files
		}
	},

	/* === Prettier Integration === */
	prettier
);
