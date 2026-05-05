import { logger } from '@/lib/utils/logging/logger';

// ITU International Morse Code: character to pattern
const MORSE_TABLE: Record<string, string> = {
	A: '.-',
	B: '-...',
	C: '-.-.',
	D: '-..',
	E: '.',
	F: '..-.',
	G: '--.',
	H: '....',
	I: '..',
	J: '.---',
	K: '-.-',
	L: '.-..',
	M: '--',
	N: '-.',
	O: '---',
	P: '.--.',
	Q: '--.-',
	R: '.-.',
	S: '...',
	T: '-',
	U: '..-',
	V: '...-',
	W: '.--',
	X: '-..-',
	Y: '-.--',
	Z: '--..',
	'0': '-----',
	'1': '.----',
	'2': '..---',
	'3': '...--',
	'4': '....-',
	'5': '.....',
	'6': '-....',
	'7': '--...',
	'8': '---..',
	'9': '----.',
	'.': '.-.-.-',
	',': '--..--',
	'?': '..--..',
	'!': '-.-.--',
	"'": '.----.',
	'/': '-..-.',
	'(': '-.--.',
	')': '-.--.-',
	'&': '.-...',
	':': '---...',
	';': '-.-.-.',
	'=': '-...-',
	'+': '.-.-.',
	'-': '-....-',
	_: '..--.-',
	'"': '.-..-.',
	$: '...-..-',
	'@': '.--.-.'
};

// Morse pattern to character
const REVERSE_MORSE: Record<string, string> = {};
for (const [char, pattern] of Object.entries(MORSE_TABLE)) {
	REVERSE_MORSE[pattern] = char;
}

// Word boundary placeholder for internal normalization
const WORD_BOUNDARY = '|';

// Minimum decoded words required for valid detection
const MIN_WORDS = 3;

// Fraction of bio characters that must be morse-alphabet (. - space /)
const MIN_COVERAGE = 0.7;

// Fraction of letter codes that must map to valid morse characters
const MIN_DECODE_RATIO = 0.75;

// Reduced thresholds when a self-label like "morse" is present
const LABEL_MIN_COVERAGE = 0.3;
const LABEL_MIN_WORDS = 1;

export function detectMorse(bio: string): boolean {
	if (bio.length < 3) return false;

	const hasLabel = /\bmorse|m0rse\b/i.test(bio);

	// Morse-alphabet coverage ratio
	const morseChars = bio.replace(/[^.\-\s/]/g, '').length;
	const coverage = morseChars / bio.length;
	const coverageThreshold = hasLabel ? LABEL_MIN_COVERAGE : MIN_COVERAGE;
	if (coverage < coverageThreshold) return false;

	const morsePortion = extractMorsePortion(bio);
	if (!morsePortion) return false;

	// Word and code validation
	const words = morsePortion.split(WORD_BOUNDARY);
	const validWords = words.filter((w) => w.trim().length > 0);
	const wordThreshold = hasLabel ? LABEL_MIN_WORDS : MIN_WORDS;
	if (validWords.length < wordThreshold) return false;

	let totalCodes = 0;
	let validCodes = 0;

	for (const word of validWords) {
		for (const code of word.trim().split(/\s+/)) {
			if (!code) continue;
			totalCodes++;
			if (REVERSE_MORSE[code]) validCodes++;
		}
	}

	if (totalCodes === 0) return false;

	const decodeRatio = validCodes / totalCodes;
	const detected = decodeRatio >= MIN_DECODE_RATIO;
	logger.debug('Morse detection', {
		detected,
		coverage: coverage.toFixed(2),
		decodeRatio: decodeRatio.toFixed(2)
	});
	return detected;
}

export function decodeMorse(text: string): string {
	const normalized = extractMorsePortion(text);
	if (!normalized) return text;

	return normalized
		.split(WORD_BOUNDARY)
		.map((word) => {
			const trimmed = word.trim();
			if (!trimmed) return '';
			return trimmed
				.split(/\s+/)
				.map((code) => REVERSE_MORSE[code] ?? code)
				.join('');
		})
		.filter((w) => w.length > 0)
		.join(' ')
		.toLowerCase();
}

// Normalize word separators and strip non-morse content
function extractMorsePortion(bio: string): string | null {
	// Replace word separators with boundary token
	let normalized = bio.replace(/\s*\/\s*/g, WORD_BOUNDARY).replace(/\s{2,}/g, WORD_BOUNDARY);

	// Strip characters outside the morse alphabet
	normalized = normalized.replace(/[^.\-\s|]/g, '').trim();
	if (normalized.length === 0) return null;

	return normalized;
}
