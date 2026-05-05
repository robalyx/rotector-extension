import { detectBinary, decodeBinary } from './binary-code';
import { detectCaesarShift, caesarShift, labelPreservingShift } from './caesar-cipher';
import { logger } from '@/lib/utils/logging/logger';
import { detectMorse, decodeMorse } from './morse-code';

// Discriminated union covering supported encoding types
export type EncodingResult =
	| { type: 'caesar'; shift: number; confidence: number; labelDetected: boolean }
	| { type: 'morse' }
	| { type: 'morse+caesar'; shift: number; confidence: number; labelDetected: boolean }
	| { type: 'binary' };

export function makeDecoder(result: EncodingResult): (text: string) => string {
	switch (result.type) {
		case 'caesar':
			return result.labelDetected
				? (t) => labelPreservingShift(t, -result.shift)
				: (t) => caesarShift(t, -result.shift);
		case 'morse':
			return decodeMorse;
		case 'morse+caesar':
			return (t) => caesarShift(decodeMorse(t), -result.shift);
		case 'binary':
			return decodeBinary;
	}
}

export function detectEncoding(bio: string): EncodingResult | null {
	if (!bio || bio.trim().length === 0) return null;

	if (detectBinary(bio)) {
		logger.debug('Encoding detected', { type: 'binary' });
		return { type: 'binary' };
	}

	if (detectMorse(bio)) {
		const intermediate = decodeMorse(bio);

		// Caesar cipher underneath the morse layer
		const caesar = detectCaesarShift(intermediate);
		if (caesar) {
			const result: EncodingResult = {
				type: 'morse+caesar',
				shift: caesar.shift,
				confidence: caesar.confidence,
				labelDetected: caesar.labelDetected
			};
			logger.debug('Encoding detected', result);
			return result;
		}

		logger.debug('Encoding detected', { type: 'morse' });
		return { type: 'morse' };
	}

	const caesar = detectCaesarShift(bio);
	if (caesar) {
		const result: EncodingResult = {
			type: 'caesar',
			shift: caesar.shift,
			confidence: caesar.confidence,
			labelDetected: caesar.labelDetected
		};
		logger.debug('Encoding detected', result);
		return result;
	}

	return null;
}
