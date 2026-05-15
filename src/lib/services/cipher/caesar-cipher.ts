import { COMMON_WORDS } from './word-list';

// Caesar cipher detection result
interface CipherDetection {
	shift: number;
	confidence: number;
	labelDetected: boolean;
}

// Stored text node state for toggle operations
export interface TextNodeEntry {
	original: string;
	decoded: string;
}

// Combined label pattern for preserving cipher labels during decode
const LABEL_MATCH_PATTERN =
	/\b(?:caesar\s*(?:cipher|shift)?\s*\d{1,2}|rot\s*\d{1,2}|cc\s*\d{1,2}|shift\s*\d{1,2})\b/gi;

export function caesarShift(text: string, shift: number): string {
	return text.replaceAll(/[a-zA-Z]/g, (char) => {
		const base = char <= 'Z' ? 65 : 97;
		return String.fromCharCode(((char.charCodeAt(0) - base + shift + 26) % 26) + base);
	});
}

// Shift text while preserving cipher label substrings intact
export function labelPreservingShift(text: string, shift: number): string {
	let result = '';
	let lastIndex = 0;

	for (const match of text.matchAll(LABEL_MATCH_PATTERN)) {
		result += caesarShift(text.slice(lastIndex, match.index), shift);
		result += match[0];
		lastIndex = match.index + match[0].length;
	}

	result += caesarShift(text.slice(lastIndex), shift);
	return result;
}

function extractWords(text: string): string[] {
	return text.toLowerCase().match(/[a-z]{3,}/g) ?? [];
}

function countEnglishWords(words: string[]): number {
	let count = 0;
	for (const word of words) {
		if (COMMON_WORDS.has(word)) count++;
	}
	return count;
}

// Segments with enough English dictionary hits are plaintext.
// Non-alphabetic segments under 5 chars (emojis, numbers) pass through,
// longer ones (morse dots/dashes) are treated as encoded.
function isPlaintext(text: string): boolean {
	const words = extractWords(text);
	if (words.length === 0) {
		return text.replaceAll(/\s/g, '').length < 5;
	}
	return countEnglishWords(words) / words.length > 0.4;
}

// Scan for self-labeling patterns like "cc 3", "rot13", "caesar cipher", "shift 7"
function detectLabel(bio: string): number | null {
	const patterns = [
		/\b(?:caesar)\s*(?:cipher|shift)?\s*(\d{1,2})\b/i,
		/\b(?:rot)\s*(\d{1,2})\b/i,
		/\b(?:cc)\s*(\d{1,2})\b/i,
		/\b(?:shift)\s*(\d{1,2})\b/i
	];

	for (const pattern of patterns) {
		const match = bio.match(pattern);
		if (match?.[1]) {
			const shift = Number.parseInt(match[1], 10);
			if (shift >= 1 && shift <= 25) return shift;
		}
	}

	return null;
}

// Detect whether a bio contains a Caesar cipher and determine the shift
export function detectCaesarShift(bio: string): CipherDetection | null {
	// Label detection with dictionary validation
	const labelShift = detectLabel(bio);
	if (labelShift !== null) {
		const decoded = caesarShift(bio, -labelShift);
		const words = extractWords(decoded);
		if (words.length > 0) {
			const decodedRatio = countEnglishWords(words) / words.length;
			if (decodedRatio >= 0.25) {
				return { shift: labelShift, confidence: decodedRatio, labelDetected: true };
			}
		}
	}

	// Dictionary brute force
	const words = extractWords(bio);
	if (words.length < 3) return null;

	// Skip if the bio is already mostly English
	const baselineRatio = countEnglishWords(words) / words.length;
	if (baselineRatio > 0.3) return null;

	let bestShift = 0;
	let bestRatio = 0;

	for (let shift = 1; shift <= 25; shift++) {
		const decoded = words.map((w) => caesarShift(w, -shift));
		const ratio = countEnglishWords(decoded) / decoded.length;
		if (ratio > bestRatio) {
			bestRatio = ratio;
			bestShift = shift;
		}
	}

	if (bestShift === 0 || bestRatio < 0.25) return null;

	return { shift: bestShift, confidence: bestRatio, labelDetected: false };
}

// Walk text nodes in a description element and pair each non-plaintext
// node with its decoded form for later toggle operations
export function buildDecodeMap(
	descEl: HTMLElement,
	decoder: (text: string) => string
): Map<Text, TextNodeEntry> {
	const map = new Map<Text, TextNodeEntry>();
	const walker = document.createTreeWalker(descEl, NodeFilter.SHOW_TEXT);

	for (let raw = walker.nextNode(); raw; raw = walker.nextNode()) {
		if (!(raw instanceof Text)) continue;
		const original = raw.data;
		if (original.trim() && !isPlaintext(original)) {
			const decoded = decoder(original);
			map.set(raw, { original, decoded });
		}
	}

	return map;
}

export function applyDecode(nodeMap: Map<Text, TextNodeEntry>): void {
	for (const [node, entry] of nodeMap) {
		node.data = entry.decoded;
	}
}

export function restoreOriginal(nodeMap: Map<Text, TextNodeEntry>): void {
	for (const [node, entry] of nodeMap) {
		node.data = entry.original;
	}
}
