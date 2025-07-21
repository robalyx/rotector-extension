import { STATUS } from '../types/constants';
import type { ReasonData } from '../types/api';
import { sanitizeText, sanitizeDisplayText } from './sanitizer';

// Interface for formatted reason entry
export interface FormattedReasonEntry {
  typeName: string;
  confidence: number;
  message?: string;
  evidence?: FormattedEvidence[];
}

// Interface for formatted evidence
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
      content: sanitizeDisplayText(evidenceText)
    };
  }

  const [outfitName, reason, confidenceStr] = parts.map(part => part.trim());
  
  // Parse confidence (should be a decimal like 0.70)
  const confidence = parseFloat(confidenceStr);
  const confidencePercent = isNaN(confidence) ? null : Math.round(confidence * 100);

  return {
    type: 'outfit',
    content: evidenceText,
    outfitName: sanitizeDisplayText(outfitName),
    outfitReason: sanitizeDisplayText(reason),
    outfitConfidence: confidencePercent
  };
}

// Formats evidence array into FormattedEvidence objects
function formatEvidence(evidence: string[], isOutfitReason: boolean): FormattedEvidence[] {
  return evidence.map(item => {
    if (isOutfitReason) {
      return formatOutfitEvidence(item);
    } else {
      return {
        type: 'regular',
        content: sanitizeDisplayText(item)
      };
    }
  });
}

// Formats the reasons from the API response into a structured format for display
export function formatViolationReasons(reasons: Record<string, ReasonData>): FormattedReasonEntry[] {
  if (!reasons || Object.keys(reasons).length === 0) {
    return [];
  }

  return Object.entries(reasons).map(([reasonType, reason]) => {
    const reasonTypeKey = reasonType as unknown as keyof typeof STATUS.REASON_TYPE_NAMES;
    const typeName = STATUS.REASON_TYPE_NAMES[reasonTypeKey] || 'Other';
    const confidence = Math.round(reason.confidence * 100);

    // Check if this is an outfit reason
    const isOutfitReason = parseInt(reasonType) === STATUS.REASON_TYPES.AVATAR_OUTFIT;
    
    const formattedEntry: FormattedReasonEntry = {
      typeName: sanitizeText(typeName),
      confidence
    };

    // Add message if available
    if (reason.message) {
      formattedEntry.message = sanitizeDisplayText(reason.message);
    }

    // Add evidence if available
    if (reason.evidence && reason.evidence.length > 0) {
      formattedEntry.evidence = formatEvidence(reason.evidence, isOutfitReason);
    }

    return formattedEntry;
  });
}


