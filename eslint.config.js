import prettier from 'eslint-config-prettier';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import unusedImports from 'eslint-plugin-unused-imports';
import betterTailwindcss from 'eslint-plugin-better-tailwindcss';
import sonarjs from 'eslint-plugin-sonarjs';
import svelteEslintParser from 'svelte-eslint-parser';

export default tseslint.config(
	// ── Ignore patterns ──────────────────────────────────────────────
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

	// ── Global settings ──────────────────────────────────────────────
	{
		settings: {
			'better-tailwindcss': { entryPoint: 'src/styles/index.css' }
		}
	},

	// ── Base presets ─────────────────────────────────────────────────
	js.configs.recommended,
	...tseslint.configs.strictTypeChecked,

	// ── strictTypeChecked overrides ──────────────────────────────────
	{
		rules: {
			'@typescript-eslint/no-confusing-void-expression': [
				'error',
				{ ignoreArrowShorthand: true, ignoreVoidOperator: true }
			],
			'@typescript-eslint/no-dynamic-delete': 'off',
			'@typescript-eslint/no-non-null-assertion': 'warn',
			'@typescript-eslint/no-deprecated': 'warn'
		}
	},

	// ── TypeScript / JavaScript files ────────────────────────────────
	{
		files: ['**/*.{js,ts,mjs,cjs}'],
		ignores: ['**/*.config.{js,ts,mjs,cjs}', '**/*.svelte.{ts,js}'],
		plugins: {
			'unused-imports': unusedImports,
			'better-tailwindcss': betterTailwindcss,
			sonarjs
		},
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			parser: tseslint.parser,
			parserOptions: { projectService: true },
			globals: {
				...globals.browser,
				...globals.node,
				...globals.webextensions,
				browser: 'readonly',
				chrome: 'readonly',
				logger: 'readonly',
				defineBackground: 'readonly',
				defineContentScript: 'readonly',
				defineUnlistedScript: 'readonly'
			}
		},
		rules: {
			// Code quality & safety
			'no-console': 'warn',
			'no-debugger': 'warn',
			eqeqeq: ['error', 'always'],
			'no-eval': 'error',
			'no-implied-eval': 'error',
			'no-new-func': 'error',
			'no-script-url': 'error',

			// Import management
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
			'no-duplicate-imports': 'error',
			'@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

			// TypeScript configuration
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/explicit-module-boundary-types': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-var-requires': 'off',

			// TypeScript best practices
			'@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
			'@typescript-eslint/array-type': ['error', { default: 'array-simple' }],
			'@typescript-eslint/prefer-for-of': 'warn',
			'@typescript-eslint/switch-exhaustiveness-check': 'error',
			'@typescript-eslint/prefer-function-type': 'error',
			'@typescript-eslint/no-import-type-side-effects': 'error',
			'@typescript-eslint/consistent-type-exports': 'error',

			// Promise/async handling
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/no-misused-promises': [
				'error',
				{ checksVoidReturn: { arguments: false, attributes: false } }
			],
			'prefer-promise-reject-errors': 'error',

			// Modern JavaScript
			'prefer-const': 'error',
			'no-var': 'error',
			'object-shorthand': 'error',
			'prefer-arrow-callback': 'error',
			'prefer-template': 'error',

			// Error prevention
			'no-throw-literal': 'error',
			'no-constructor-return': 'error',
			'no-self-compare': 'error',
			'no-unmodified-loop-condition': 'warn',
			'no-unreachable-loop': 'error',
			'no-unused-private-class-members': 'warn',
			'no-template-curly-in-string': 'warn',

			// SonarJS code smells
			'sonarjs/cognitive-complexity': ['warn', 20],
			'sonarjs/no-identical-functions': 'error',
			'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
			'sonarjs/no-identical-expressions': 'error',
			'sonarjs/no-all-duplicated-branches': 'error',
			'sonarjs/no-redundant-boolean': 'error',
			'sonarjs/no-useless-catch': 'error',
			'sonarjs/prefer-immediate-return': 'warn',
			'sonarjs/no-nested-template-literals': 'warn',
			'sonarjs/no-small-switch': 'warn',
			'sonarjs/no-collapsible-if': 'warn',
			'sonarjs/no-inverted-boolean-check': 'warn',
			'sonarjs/prefer-single-boolean-return': 'warn'
		}
	},

	// ── Svelte rune modules ────────────────
	{
		files: ['**/*.svelte.{ts,js}'],
		plugins: {
			'unused-imports': unusedImports,
			sonarjs
		},
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			parser: svelteEslintParser,
			parserOptions: {
				parser: tseslint.parser,
				projectService: true,
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
		}
	},

	// ── Svelte files ─────────────────────────────────────────────────
	...svelte.configs['flat/recommended'],
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
			// Svelte 5 syntax incompatibilities
			//   - $bindable() declaration uses `prop = $bindable()` even on required props
			//   - {@render snippet()} accepts only call expressions; inline {#snippet} returns void
			'@typescript-eslint/no-useless-default-assignment': 'off',
			'@typescript-eslint/no-confusing-void-expression': 'off',

			// Off: SvelteKit-specific rule that doesn't apply to browser extensions (no resolve())
			'svelte/no-navigation-without-resolve': 'off',

			// Import management
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

			// Svelte correctness
			'svelte/valid-compile': 'error',
			'svelte/no-at-debug-tags': 'warn',
			'svelte/no-unused-svelte-ignore': 'warn',
			'svelte/require-store-reactive-access': 'warn',
			'svelte/no-store-async': 'error',
			'svelte/no-dom-manipulating': 'error',
			'svelte/no-dupe-else-if-blocks': 'error',
			'svelte/no-dupe-on-directives': 'error',
			'svelte/no-dupe-use-directives': 'error',
			'svelte/no-dupe-style-properties': 'error',
			'svelte/no-not-function-handler': 'error',
			'svelte/no-object-in-text-mustaches': 'error',
			'svelte/valid-each-key': 'error',
			'svelte/no-shorthand-style-property-overrides': 'error',
			'svelte/no-at-html-tags': 'error',
			'svelte/no-target-blank': 'warn',
			'svelte/infinite-reactive-loop': 'error',
			'svelte/no-reactive-reassign': 'warn',
			'svelte/require-each-key': 'warn',
			'svelte/no-unnecessary-state-wrap': 'warn',
			'svelte/prefer-writable-derived': 'warn',
			'svelte/no-useless-children-snippet': 'warn',
			'svelte/prefer-svelte-reactivity': 'error',
			'svelte/button-has-type': 'warn',
			'svelte/no-ignored-unsubscribe': 'error',
			'svelte/require-store-callbacks-use-set-param': 'error',
			'svelte/no-raw-special-elements': 'error',
			'svelte/valid-style-parse': 'error',
			'svelte/no-unknown-style-directive-property': 'error',
			'svelte/no-immutable-reactive-statements': 'error',
			'svelte/no-reactive-functions': 'error',
			'svelte/no-reactive-literals': 'error',
			'svelte/require-event-dispatcher-types': 'warn',
			'svelte/require-stores-init': 'warn',
			'svelte/no-svelte-internal': 'error',
			'svelte/derived-has-same-inputs-outputs': 'warn',

			// Svelte style preferences
			'svelte/html-self-closing': 'warn',
			'svelte/mustache-spacing': 'warn',
			'svelte/no-spaces-around-equal-signs-in-attribute': 'warn',
			'svelte/prefer-class-directive': 'warn',
			'svelte/prefer-style-directive': 'warn',
			'svelte/shorthand-attribute': 'warn',
			'svelte/shorthand-directive': 'warn',
			'svelte/sort-attributes': 'warn',
			'svelte/spaced-html-comment': 'warn',
			'svelte/no-useless-mustaches': 'warn'
		}
	},

	// ── Tailwind CSS in Svelte ───────────────────────────────────────
	{
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
			// Correctness
			'better-tailwindcss/no-duplicate-classes': 'error',
			'better-tailwindcss/no-conflicting-classes': 'error',
			'better-tailwindcss/no-unregistered-classes': 'off',
			'better-tailwindcss/no-restricted-classes': 'off',

			// Stylistic
			'better-tailwindcss/no-unnecessary-whitespace': 'warn',
			'better-tailwindcss/no-deprecated-classes': 'warn',
			'better-tailwindcss/enforce-consistent-class-order': 'off',
			'better-tailwindcss/enforce-consistent-line-wrapping': 'off',
			'better-tailwindcss/enforce-consistent-variable-syntax': 'warn',
			'better-tailwindcss/enforce-consistent-important-position': 'warn',
			'better-tailwindcss/enforce-shorthand-classes': 'warn'
		}
	},

	// ── WXT framework globals ────────────────────────────────────────
	{
		files: ['**/entrypoints/**/*.{ts,js}'],
		languageOptions: {
			globals: {
				defineBackground: 'readonly',
				defineContentScript: 'readonly',
				defineUnlistedScript: 'readonly',
				defineConfig: 'readonly'
			}
		}
	},

	// ── Files where console logging is acceptable ────────────────────
	{
		files: [
			'**/lib/utils/logging/logger.ts',
			'**/lib/services/rotector/api-client.ts',
			'**/lib/stores/settings.ts',
			'**/lib/stores/statistics.ts',
			'**/lib/stores/persistent-list-store.ts'
		],
		rules: { 'no-console': 'off' }
	},

	// ── Prettier integration ─────────────────────────────────────────
	prettier
);
