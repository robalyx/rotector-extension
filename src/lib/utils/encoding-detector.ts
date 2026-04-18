import { detectBinary, decodeBinary } from './binary-code';
import { detectCaesarShift, caesarShift, labelPreservingShift } from './caesar-cipher';
import { logger } from './logger';
import { detectMorse, decodeMorse } from './morse-code';

// Discriminated union covering supported encoding types
export type EncodingResult =
	| { type: 'caesar'; shift: number; confidence: number; labelDetected: boolean }
	| { type: 'morse' }
	| { type: 'morse+caesar'; shift: number; confidence: number; labelDetected: boolean }
	| { type: 'binary' };

// Decoder factory that maps an encoding result to its decode function
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

// Detect encoding in a bio string
export function detectEncoding(bio: string): EncodingResult | null {
	if (!bio || bio.trim().length === 0) return null;

	// Binary detection pass
	if (detectBinary(bio)) {
		logger.debug('Encoding detected', { type: 'binary' });
		return { type: 'binary' };
	}

	// Morse detection pass
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

	// Caesar-only detection pass
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
