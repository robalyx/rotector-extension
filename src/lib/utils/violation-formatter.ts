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

export interface FlaggedOutfitInfo {
	reason: string;
	confidence: number;
}

// Parses outfit evidence in format "name|reason|confidence"
function parseOutfitEvidence(evidenceText: string): ParsedOutfitEvidence | null {
	const parts = evidenceText.split('|');
	if (parts.length !== 3) return null;

	const [name, reason, confidenceStr] = parts.map((part) => part.trim());
	if (!name) return null;

	const confidence = parseFloat(confidenceStr);
	return {
		name,
		reason,
		confidence: isNaN(confidence) ? null : Math.round(confidence * 100)
	};
}

// Formats a single outfit evidence item with the pattern "outfit name|reason|confidence"
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

// Formats evidence array into FormattedEvidence objects
function formatEvidence(evidence: string[], isOutfitReason: boolean): FormattedEvidence[] {
	return evidence.map((item) => {
		if (isOutfitReason) {
			return formatOutfitEvidence(item);
		} else {
			return {
				type: 'regular',
				content: item
			};
		}
	});
}

// Extracts a leading [Source] tag from reason message text
export function parseSourceTag(text: string): ParsedSourceTag | null {
	const match = /^\[([^\]]+)\]\s*(.*)$/.exec(text);
	if (!match) return null;
	return { source: match[1], description: match[2] };
}

// Formats the reasons from the API response into a structured format for display
export function formatViolationReasons(
	reasons: Record<string, ReasonData>
): FormattedReasonEntry[] {
	if (!reasons || Object.keys(reasons).length === 0) {
		return [];
	}

	return Object.entries(reasons).map(([reasonType, reason]) => {
		const typeName = reasonType;
		const isOutfitReason = reasonType === 'Avatar Outfit';

		const confidence = Math.round(reason.confidence * 100);

		const formattedEntry: FormattedReasonEntry = {
			typeName,
			confidence
		};

		// Add message if available
		if (reason.message) {
			formattedEntry.message = reason.message;
		}

		// Add evidence if available
		if (reason.evidence && reason.evidence.length > 0) {
			formattedEntry.evidence = formatEvidence(reason.evidence, isOutfitReason);
		}

		return formattedEntry;
	});
}

// Extracts flagged outfit names with their reasons and confidence from evidence array
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
