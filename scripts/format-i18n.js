#!/usr/bin/env node

/**
 * i18n Formatting Script
 *
 * Formats all translation files by sorting keys alphabetically.
 *
 * Usage: bun run format:i18n
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOCALE_DIR = path.join(__dirname, '..', 'public', 'locales');

// ANSI color codes for terminal output
const colors = {
	reset: '\x1b[0m',
	green: '\x1b[32m',
	cyan: '\x1b[36m',
	bold: '\x1b[1m'
};

/**
 * Dynamically discover all available locales from the _locales directory
 */
function discoverLocales() {
	if (!fs.existsSync(LOCALE_DIR)) {
		console.error(`Error: Locale directory not found: ${LOCALE_DIR}`);
		return [];
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

	return locales;
}

/**
 * Format a single locale file by sorting keys alphabetically
 */
function formatLocaleFile(locale) {
	const filePath = path.join(LOCALE_DIR, locale, 'messages.json');

	try {
		// Read the file
		const content = fs.readFileSync(filePath, 'utf8');
		const data = JSON.parse(content);

		// Sort keys alphabetically
		const sortedData = Object.keys(data)
			.sort()
			.reduce((acc, key) => {
				acc[key] = data[key];
				return acc;
			}, {});

		// Write back with tab indentation
		const formatted = JSON.stringify(sortedData, null, '\t') + '\n';
		fs.writeFileSync(filePath, formatted, 'utf8');

		return true;
	} catch (error) {
		console.error(`Error formatting ${locale}/messages.json: ${error.message}`);
		return false;
	}
}

/**
 * Main formatting function
 */
function formatI18n() {
	console.log(`\n${colors.bold}${colors.cyan}=== i18n Formatting ===${colors.reset}\n`);

	const locales = discoverLocales();

	if (locales.length === 0) {
		console.error('No locale files found to format.');
		process.exit(1);
	}

	console.log(`Found ${locales.length} locale(s) to format: ${locales.join(', ')}\n`);

	let successCount = 0;
	let failCount = 0;

	for (const locale of locales) {
		if (formatLocaleFile(locale)) {
			console.log(`${colors.green}✓${colors.reset} Formatted ${locale}/messages.json`);
			successCount++;
		} else {
			failCount++;
		}
	}

	console.log(`\n${colors.bold}${colors.cyan}=== Summary ===${colors.reset}`);
	console.log(`Successfully formatted: ${successCount} file(s)`);
	if (failCount > 0) {
		console.log(`Failed: ${failCount} file(s)`);
	}
	console.log(`\n${colors.green}${colors.bold}✓ Formatting complete${colors.reset}\n`);

	process.exit(failCount > 0 ? 1 : 0);
}

// Run formatting
formatI18n();
