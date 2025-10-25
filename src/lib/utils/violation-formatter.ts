import { ENTITY_TYPES, INTEGRATION_SOURCE_NAMES, STATUS } from '../types/constants';
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
	reasons: Record<string, ReasonData>,
	integrationSources?: Record<string, string>,
	entityType?: string
): FormattedReasonEntry[] {
	if (!reasons || Object.keys(reasons).length === 0) {
		return [];
	}

	return Object.entries(reasons).map(([reasonType, reason]) => {
		let typeName: string;

		// Handle integration source reasons
		if (integrationSources && reasonType in integrationSources) {
			const integrationName =
				INTEGRATION_SOURCE_NAMES[reasonType as keyof typeof INTEGRATION_SOURCE_NAMES];
			const version = integrationSources[reasonType];

			if (integrationName && version) {
				const formattedVersion = version.startsWith('v') ? version : `v${version}`;
				typeName = `${integrationName} (${formattedVersion})`;
			} else if (integrationName) {
				typeName = integrationName;
			} else {
				typeName = `${reasonType.charAt(0).toUpperCase() + reasonType.slice(1)} Analysis`;
			}
		} else {
			if (entityType === ENTITY_TYPES.GROUP) {
				const reasonTypeKey = reasonType as unknown as keyof typeof STATUS.GROUP_REASON_TYPE_NAMES;
				typeName = STATUS.GROUP_REASON_TYPE_NAMES[reasonTypeKey] || 'Other';
			} else {
				const reasonTypeKey = reasonType as unknown as keyof typeof STATUS.USER_REASON_TYPE_NAMES;
				typeName = STATUS.USER_REASON_TYPE_NAMES[reasonTypeKey] || 'Other';
			}
		}

		const confidence = Math.round(reason.confidence * 100);

		const isIntegrationReason = integrationSources && reasonType in integrationSources;
		const isOutfitReason =
			!isIntegrationReason && parseInt(reasonType) === STATUS.USER_REASON_TYPES.AVATAR_OUTFIT;

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
