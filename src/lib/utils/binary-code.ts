// Minimum bit-groups required for valid detection
const MIN_GROUPS = 3;

// Fraction of bio that must be 0/1/space
const MIN_COVERAGE = 0.9;

// Decode binary groups to a UTF-8 string
function decodeGroups(groups: string[]): string {
	const bytes = new Uint8Array(groups.map((g) => parseInt(g, 2)));
	return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

// Extract binary groups from spaced or continuous format
function extractBinaryGroups(bio: string): string[] | null {
	const trimmed = bio.trim();

	// Spaced format: "01110100 01110010 01100001"
	const tokens = trimmed.split(/\s+/);
	if (tokens.length > 1 && tokens.every((t) => /^[01]{7,8}$/.test(t))) {
		return tokens;
	}

	// Continuous format: "011101000111001001100001"
	const stripped = trimmed.replace(/\s/g, '');
	if (!/^[01]+$/.test(stripped)) return null;

	// 8-bit grouping preferred, fall back to 7-bit
	if (stripped.length % 8 === 0) {
		return stripped.match(/.{8}/g);
	}
	if (stripped.length % 7 === 0) {
		return stripped.match(/.{7}/g);
	}

	return null;
}

// Detect whether a bio is binary-encoded text
export function detectBinary(bio: string): boolean {
	if (bio.length < 7) return false;

	// Binary-alphabet coverage ratio
	const binaryChars = bio.replace(/[^01\s]/g, '').length;
	const coverage = binaryChars / bio.length;
	if (coverage < MIN_COVERAGE) return false;

	const groups = extractBinaryGroups(bio);
	if (!groups || groups.length < MIN_GROUPS) return false;

	// Decoded output must contain printable characters and no control bytes
	try {
		const decoded = decodeGroups(groups);
		// eslint-disable-next-line no-control-regex
		if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(decoded)) return false;
		return /\S/.test(decoded);
	} catch {
		return false;
	}
}

// Decode a binary-encoded string to plaintext
export function decodeBinary(text: string): string {
	const groups = extractBinaryGroups(text);
	if (!groups) return text;

	try {
		return decodeGroups(groups);
	} catch {
		return text;
	}
}
