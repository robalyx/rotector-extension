import type { ReasonData } from '../types/api';

export interface FormattedReasonEntry {
	typeName: string;
	confidence: number;
	message?: string;
	evidence?: FormattedEvidence[];
}

interface FormattedEvidence {
	type: 'regular' | 'outfit';
	content: string;
	outfitName?: string;
	outfitReason?: string;
	outfitConfidence?: number | null;
	outfitId?: string | null;
}

interface ParsedOutfitEvidence {
	name: string;
	reason: string;
	confidence: number | null;
	outfitId: string | null;
}

interface ParsedSourceTag {
	source: string;
	description: string;
}

// Source-tagged line group
interface SourceGroup {
	kind: 'source';
	source: string;
	description: string;
	subItems: string[];
}

// Plain untagged line
interface PlainLine {
	kind: 'plain';
	text: string;
}

type GroupedSourceLine = SourceGroup | PlainLine;

// Flagged outfit info
export interface FlaggedOutfitInfo {
	name: string;
	reason: string;
	confidence: number;
	outfitId: string | null;
}

// Wire format: "name|reason|confidence" or "name|reason|confidence|outfitID"
function parseOutfitEvidence(evidenceText: string): ParsedOutfitEvidence | null {
	const parts = evidenceText.split('|');
	if (parts.length < 3 || parts.length > 4) return null;

	const trimmed = parts.map((part) => part.trim());
	const [name, reason, confidenceStr] = trimmed as [string, string, string];
	if (!name) return null;

	let outfitId: string | null = null;
	if (parts.length === 4) {
		const rawId = trimmed[3] ?? '';
		if (!/^\d+$/.test(rawId)) return null;
		outfitId = rawId;
	}

	const confidence = parseFloat(confidenceStr);
	return {
		name,
		reason,
		confidence: isNaN(confidence) ? null : Math.round(confidence * 100),
		outfitId
	};
}

function formatOutfitEvidence(evidenceText: string): FormattedEvidence {
	const parsed = parseOutfitEvidence(evidenceText);
	if (!parsed) {
		return { type: 'regular', content: evidenceText };
	}

	return {
		type: 'outfit',
		content: evidenceText,
		outfitName: parsed.name,
		outfitReason: parsed.reason,
		outfitConfidence: parsed.confidence,
		outfitId: parsed.outfitId
	};
}

function formatEvidence(evidence: string[], isOutfitReason: boolean): FormattedEvidence[] {
	return evidence.map((item) =>
		isOutfitReason ? formatOutfitEvidence(item) : { type: 'regular', content: item }
	);
}

// Wire format: "[Source] description text"
function parseSourceTag(text: string): ParsedSourceTag | null {
	const match = /^\[([^\]]+)\]\s*(.*)$/.exec(text);
	if (!match) return null;
	return { source: match[1] ?? '', description: match[2] ?? '' };
}

// Non-tagged lines are grouped under their preceding source tag
export function groupSourceLines(lines: string[]): GroupedSourceLine[] {
	const result: GroupedSourceLine[] = [];
	let currentGroup: SourceGroup | null = null;

	for (const line of lines) {
		const parsed = parseSourceTag(line.trim());
		if (parsed) {
			if (currentGroup) result.push(currentGroup);
			currentGroup = {
				kind: 'source',
				source: parsed.source,
				description: parsed.description,
				subItems: []
			};
		} else if (currentGroup) {
			currentGroup.subItems.push(line.trim());
		} else {
			result.push({ kind: 'plain', text: line });
		}
	}

	if (currentGroup) result.push(currentGroup);
	return result;
}

export function formatViolationReasons(
	reasons: Record<string, ReasonData>
): FormattedReasonEntry[] {
	return Object.entries(reasons).map(([reasonType, reason]) => ({
		typeName: reasonType,
		confidence: Math.round(reason.confidence * 100),
		...(reason.message && { message: reason.message }),
		...(reason.evidence?.length && {
			evidence: formatEvidence(reason.evidence, reasonType === 'Avatar Outfit')
		})
	}));
}

export function extractFlaggedOutfits(evidence: string[]): FlaggedOutfitInfo[] {
	const flaggedOutfits: FlaggedOutfitInfo[] = [];

	for (const item of evidence) {
		const parsed = parseOutfitEvidence(item);
		if (!parsed) continue;

		flaggedOutfits.push({
			name: parsed.name,
			reason: parsed.reason,
			confidence: parsed.confidence ?? 0,
			outfitId: parsed.outfitId
		});
	}

	return flaggedOutfits;
}
