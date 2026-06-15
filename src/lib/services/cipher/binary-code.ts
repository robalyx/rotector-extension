// Minimum bit-groups required for valid detection
const MIN_GROUPS = 3;

// Fraction of bio that must be 0/1/space
const MIN_COVERAGE = 0.9;

function decodeGroups(groups: string[]): string {
	const bytes = new Uint8Array(groups.map((g) => Number.parseInt(g, 2)));
	return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

// True if the decoded text contains a control byte other than tab/newline/carriage-return
function hasControlChar(text: string): boolean {
	for (let i = 0; i < text.length; i++) {
		const code = text.charCodeAt(i);
		if (code === 0x7f) return true;
		if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) return true;
	}
	return false;
}

// Candidate fixed-width groupings for a binary bio, widest width first
function extractBinaryGroupCandidates(bio: string): string[][] {
	const trimmed = bio.trim();

	// Spaced format: "01110100 01110010 01100001"
	const tokens = trimmed.split(/\s+/);
	if (tokens.length > 1 && tokens.every((t) => /^[01]{7,8}$/.test(t))) {
		return [tokens];
	}

	// Continuous format: "011101000111001001100001"
	const stripped = trimmed.replaceAll(/\s/g, '');
	if (!/^[01]+$/.test(stripped)) return [];

	// A length divisible by both 7 and 8 is ambiguous, so try 8-bit first then 7-bit
	const candidates: string[][] = [];
	for (const width of [8, 7]) {
		if (stripped.length % width !== 0) continue;
		const groups: string[] = [];
		for (let i = 0; i < stripped.length; i += width) {
			groups.push(stripped.slice(i, i + width));
		}
		candidates.push(groups);
	}
	return candidates;
}

// First candidate grouping that decodes to printable UTF-8 with no control bytes
function decodeBinaryCandidate(bio: string): { groups: string[]; decoded: string } | null {
	for (const groups of extractBinaryGroupCandidates(bio)) {
		try {
			const decoded = decodeGroups(groups);
			if (hasControlChar(decoded)) continue;
			if (!/\S/.test(decoded)) continue;
			return { groups, decoded };
		} catch {
			continue;
		}
	}
	return null;
}

// Detect whether a bio is binary-encoded text
export function detectBinary(bio: string): boolean {
	if (bio.length < 7) return false;

	// Binary-alphabet coverage ratio
	const binaryChars = bio.replaceAll(/[^01\s]/g, '').length;
	const coverage = binaryChars / bio.length;
	if (coverage < MIN_COVERAGE) return false;

	const result = decodeBinaryCandidate(bio);
	return result !== null && result.groups.length >= MIN_GROUPS;
}

export function decodeBinary(text: string): string {
	return decodeBinaryCandidate(text)?.decoded ?? text;
}
