#!/usr/bin/env node

/**
 * i18n Validation Script
 *
 * Validates translation keys across the codebase to ensure:
 * 1. No unused translation keys exist in locale files
 * 2. All translation keys used in code are defined
 * 3. All locales have matching keys (no missing translations)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOCALE_DIR = path.join(__dirname, '..', 'public', 'locales');
const SRC_DIR = path.join(__dirname, '..', 'src');

// ANSI color codes for terminal output
const colors = {
	reset: '\x1b[0m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	cyan: '\x1b[36m',
	bold: '\x1b[1m'
};

/**
 * Dynamically discover all available locales from the _locales directory
 */
function discoverLocales() {
	if (!fs.existsSync(LOCALE_DIR)) {
		console.error(`${colors.red}Error: Locale directory not found: ${LOCALE_DIR}${colors.reset}`);
		return ['en'];
	}

	const locales = fs
		.readdirSync(LOCALE_DIR, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name)
		.filter((name) => {
			// Verify that each directory contains a messages.json file
			const messagesPath = path.join(LOCALE_DIR, name, 'messages.json');
			return fs.existsSync(messagesPath);
		})
		.sort(); // Sort alphabetically for consistent output

	// Ensure 'en' is first (base locale)
	if (locales.includes('en')) {
		locales.splice(locales.indexOf('en'), 1);
		locales.unshift('en');
	}

	return locales;
}

const LOCALES = discoverLocales();

/**
 * Load translation keys from a locale file
 */
function loadLocaleKeys(locale) {
	const filePath = path.join(LOCALE_DIR, locale, 'messages.json');

	if (!fs.existsSync(filePath)) {
		console.error(`${colors.red}Error: Locale file not found: ${filePath}${colors.reset}`);
		return new Set();
	}

	try {
		const content = fs.readFileSync(filePath, 'utf8');
		const data = JSON.parse(content);
		return new Set(Object.keys(data));
	} catch (error) {
		console.error(
			`${colors.red}Error parsing ${locale}/messages.json: ${error.message}${colors.reset}`
		);
		return new Set();
	}
}

/**
 * Recursively find all files in a directory matching the pattern
 */
function findFiles(dir, pattern, fileList = []) {
	const files = fs.readdirSync(dir);

	for (const file of files) {
		const filePath = path.join(dir, file);
		const stat = fs.statSync(filePath);

		if (stat.isDirectory()) {
			// Skip node_modules and .wxt directories
			if (file !== 'node_modules' && file !== '.wxt' && file !== 'dist') {
				findFiles(filePath, pattern, fileList);
			}
		} else if (pattern.test(file)) {
			fileList.push(filePath);
		}
	}

	return fileList;
}

/**
 * Extract translation keys used in code files
 */
function extractUsedKeys() {
	const usedKeys = new Set();

	// Find all .svelte, .ts, and .js files
	const files = findFiles(SRC_DIR, /\.(svelte|ts|js)$/);

	for (const file of files) {
		const content = fs.readFileSync(file, 'utf8');

		// Pattern 1: All string literals within $_() calls using proper bracket matching
		// This handles direct calls, ternary operators, multiline calls, and nested structures
		// svelte-i18n uses $_() instead of t()
		let pos = 0;
		while (pos < content.length) {
			// Find next '$_(' occurrence
			const fnIndex = content.indexOf('$_(', pos);
			if (fnIndex === -1) break;

			// Parse the full $_() call with proper bracket/string tracking
			let depth = 1;
			let i = fnIndex + 3;
			let callContent = '';
			let inString = false;
			let stringChar = null;
			let escaped = false;

			// Find matching closing parenthesis, respecting strings
			while (i < content.length && depth > 0) {
				const char = content[i];

				// Handle escape sequences
				if (escaped) {
					escaped = false;
					callContent += char;
					i++;
					continue;
				}

				if (char === '\\') {
					escaped = true;
					callContent += char;
					i++;
					continue;
				}

				// Handle string boundaries
				if ((char === '"' || char === "'" || char === '`') && !inString) {
					inString = true;
					stringChar = char;
				} else if (char === stringChar && inString) {
					inString = false;
					stringChar = null;
				}

				// Count parentheses outside of strings
				if (!inString) {
					if (char === '(') depth++;
					if (char === ')') depth--;
				}

				if (depth > 0) callContent += char;
				i++;
			}

			// Extract all string literals that look like translation keys
			const stringRegex = /['"]([a-z][a-z0-9_]*)['"]/g;
			let stringMatch;

			while ((stringMatch = stringRegex.exec(callContent)) !== null) {
				const key = stringMatch[1];
				// Only add if it contains underscore (translation key pattern)
				if (key.includes('_')) {
					usedKeys.add(key);
				}
			}

			pos = i;
		}

		// Pattern 2: Keys used as property values in objects
		// Matches: titleKey: 'key', labelKey: "key", helpTextKey: 'key', nameKey: 'key', descKey: 'key'
		const keyPropertyRegex =
			/\b(?:titleKey|labelKey|helpTextKey|nameKey|descKey)\s*:\s*['"]([a-z][a-z0-9_]*)['"](?:\s*,|\s*})/g;
		let match;

		while ((match = keyPropertyRegex.exec(content)) !== null) {
			usedKeys.add(match[1]);
		}
	}

	return usedKeys;
}

/**
 * Main validation function
 */
function validateI18n() {
	console.log(`\n${colors.bold}${colors.cyan}=== i18n Validation ===${colors.reset}\n`);

	// Load all locale keys
	const localeKeys = {};
	for (const locale of LOCALES) {
		localeKeys[locale] = loadLocaleKeys(locale);
		console.log(
			`${colors.blue}Loaded ${localeKeys[locale].size} keys from ${locale}/messages.json${colors.reset}`
		);
	}

	// Extract used keys from source code
	const usedKeys = extractUsedKeys();
	console.log(
		`${colors.blue}Found ${usedKeys.size} translation keys used in source code${colors.reset}\n`
	);

	let hasErrors = false;

	// Check 1: Find unused keys (defined but not used)
	console.log(
		`${colors.bold}${colors.yellow}Checking for unused translation keys...${colors.reset}`
	);
	const baseLocale = LOCALES[0]; // Use 'en' as base
	const unusedKeys = new Set([...localeKeys[baseLocale]].filter((key) => !usedKeys.has(key)));

	if (unusedKeys.size > 0) {
		console.log(
			`${colors.yellow}⚠ Found ${unusedKeys.size} unused translation key(s):${colors.reset}`
		);
		for (const key of unusedKeys) {
			console.log(`  - ${key}`);
		}
		console.log('');
	} else {
		console.log(`${colors.green}✓ No unused translation keys${colors.reset}\n`);
	}

	// Check 2: Find missing keys (used but not defined)
	console.log(
		`${colors.bold}${colors.yellow}Checking for missing translation keys...${colors.reset}`
	);
	const missingKeys = new Set([...usedKeys].filter((key) => !localeKeys[baseLocale].has(key)));

	if (missingKeys.size > 0) {
		console.log(
			`${colors.red}✗ Found ${missingKeys.size} missing translation key(s) in ${baseLocale}/messages.json:${colors.reset}`
		);
		for (const key of missingKeys) {
			console.log(`  - ${key}`);
		}
		console.log('');
		hasErrors = true;
	} else {
		console.log(`${colors.green}✓ All used keys are defined${colors.reset}\n`);
	}

	// Check 3: Find locale mismatches (keys in one locale but not another)
	console.log(`${colors.bold}${colors.yellow}Checking for locale mismatches...${colors.reset}`);
	let hasMismatches = false;

	for (let i = 1; i < LOCALES.length; i++) {
		const locale = LOCALES[i];
		const missingInLocale = new Set(
			[...localeKeys[baseLocale]].filter((key) => !localeKeys[locale].has(key))
		);
		const extraInLocale = new Set(
			[...localeKeys[locale]].filter((key) => !localeKeys[baseLocale].has(key))
		);

		if (missingInLocale.size > 0) {
			console.log(`${colors.red}✗ Keys in ${baseLocale} but missing in ${locale}:${colors.reset}`);
			for (const key of missingInLocale) {
				console.log(`  - ${key}`);
			}
			console.log('');
			hasErrors = true;
			hasMismatches = true;
		}

		if (extraInLocale.size > 0) {
			console.log(`${colors.yellow}⚠ Keys in ${locale} but not in ${baseLocale}:${colors.reset}`);
			for (const key of extraInLocale) {
				console.log(`  - ${key}`);
			}
			console.log('');
			hasMismatches = true;
		}
	}

	if (!hasMismatches) {
		console.log(`${colors.green}✓ All locales have matching keys${colors.reset}\n`);
	}

	// Summary
	console.log(`${colors.bold}${colors.cyan}=== Summary ===${colors.reset}`);
	console.log(`Total keys defined (${baseLocale}): ${localeKeys[baseLocale].size}`);
	console.log(`Total keys used in code: ${usedKeys.size}`);
	console.log(`Unused keys: ${unusedKeys.size}`);
	console.log(`Missing keys: ${missingKeys.size}`);
	console.log('');

	if (hasErrors) {
		console.log(`${colors.red}${colors.bold}✗ Validation failed${colors.reset}\n`);
		process.exit(1);
	} else if (unusedKeys.size > 0) {
		console.log(
			`${colors.yellow}${colors.bold}⚠ Validation passed with warnings${colors.reset}\n`
		);
		process.exit(0);
	} else {
		console.log(`${colors.green}${colors.bold}✓ Validation passed${colors.reset}\n`);
		process.exit(0);
	}
}

// Run validation
validateI18n();
