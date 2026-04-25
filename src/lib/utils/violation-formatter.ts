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
}

interface ParsedOutfitEvidence {
	name: string;
	reason: string;
	confidence: number | null;
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
	reason: string;
	confidence: number;
}

// Wire format: "name|reason|confidence"
function parseOutfitEvidence(evidenceText: string): ParsedOutfitEvidence | null {
	const parts = evidenceText.split('|');
	if (parts.length !== 3) return null;

	const [name, reason, confidenceStr] = parts.map((part) => part.trim()) as [
		string,
		string,
		string
	];
	if (!name) return null;

	const confidence = parseFloat(confidenceStr);
	return {
		name,
		reason,
		confidence: isNaN(confidence) ? null : Math.round(confidence * 100)
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
		outfitConfidence: parsed.confidence
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

export function extractFlaggedOutfitNames(evidence: string[]): Map<string, FlaggedOutfitInfo> {
	const flaggedOutfits = new Map<string, FlaggedOutfitInfo>();

	for (const item of evidence) {
		const parsed = parseOutfitEvidence(item);
		if (!parsed) continue;

		flaggedOutfits.set(parsed.name, {
			reason: parsed.reason,
			confidence: parsed.confidence ?? 0
		});
	}

	return flaggedOutfits;
}
