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

// Formats a single outfit evidence item with the pattern: "outfit name|reason|confidence"
function formatOutfitEvidence(evidenceText: string): FormattedEvidence {
	// Check if the evidence matches the outfit pattern: "name|reason|confidence"
	const parts = evidenceText.split('|');
	if (parts.length !== 3) {
		// Not the expected format, return as regular evidence
		return {
			type: 'regular',
			content: evidenceText
		};
	}

	const [outfitName, reason, confidenceStr] = parts.map((part) => part.trim());

	// Parse confidence (should be a decimal like 0.70)
	const confidence = parseFloat(confidenceStr);
	const confidencePercent = isNaN(confidence) ? null : Math.round(confidence * 100);

	return {
		type: 'outfit',
		content: evidenceText,
		outfitName,
		outfitReason: reason,
		outfitConfidence: confidencePercent
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
