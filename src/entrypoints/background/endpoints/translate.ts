import type { TranslationResult } from '@/lib/types/api';
import { API_CONFIG } from '@/lib/types/constants';
import { logger } from '@/lib/utils/logging/logger';

// Extract the leading translated string from Google Translate's nested response
// Shape: [[["translated", "original", null, null, n], ...], null, "src-lang", ...]
function extractTranslatedText(data: unknown): string {
	if (!Array.isArray(data) || !Array.isArray(data[0]) || !Array.isArray(data[0][0])) {
		throw new Error('Invalid translation response format');
	}
	const translated: unknown = data[0][0][0];
	if (typeof translated !== 'string' || !translated) {
		throw new Error('No translation returned');
	}
	return translated;
}

interface CacheEntry {
	translation: string;
	timestamp: number;
}

const translationCache = new Map<string, CacheEntry>();

function getCacheKey(text: string, targetLanguage: string, sourceLanguage: string): string {
	return `${sourceLanguage}->${targetLanguage}:${text}`;
}

function getCachedTranslation(
	text: string,
	targetLanguage: string,
	sourceLanguage: string
): string | null {
	const key = getCacheKey(text, targetLanguage, sourceLanguage);
	const entry = translationCache.get(key);

	if (!entry) return null;

	if (Date.now() - entry.timestamp >= API_CONFIG.TRANSLATION_CACHE_TTL) {
		translationCache.delete(key);
		return null;
	}

	return entry.translation;
}

function setCachedTranslation(
	text: string,
	targetLanguage: string,
	sourceLanguage: string,
	translation: string
): void {
	const key = getCacheKey(text, targetLanguage, sourceLanguage);

	if (translationCache.size >= API_CONFIG.TRANSLATION_CACHE_MAX && !translationCache.has(key)) {
		const oldestKey = translationCache.keys().next().value;
		if (oldestKey !== undefined) {
			translationCache.delete(oldestKey);
		}
	}

	translationCache.set(key, {
		translation,
		timestamp: Date.now()
	});
}

async function translateBatch(
	texts: string[],
	targetLanguage: string,
	sourceLanguage: string = 'en'
): Promise<Record<string, string>> {
	const DELIMITER = '|||';

	const hasCollision = texts.some((text) => text.includes(DELIMITER));

	if (hasCollision) {
		logger.warn('Delimiter collision detected, falling back to parallel requests');
		return translateParallel(texts, targetLanguage, sourceLanguage);
	}

	const combinedText = texts.join(DELIMITER);

	logger.debug('Batch translating texts with delimiter', {
		count: texts.length,
		from: sourceLanguage,
		to: targetLanguage
	});

	const translatedCombined = await fetchTranslation(combinedText, sourceLanguage, targetLanguage);
	const translatedParts = translatedCombined.split(DELIMITER);

	if (translatedParts.length !== texts.length) {
		logger.warn('Translation part count mismatch', {
			expected: texts.length,
			received: translatedParts.length
		});
	}

	const translations: Record<string, string> = {};

	for (const [i, originalText] of texts.entries()) {
		const translatedText = (translatedParts[i] ?? originalText).trim();
		translations[originalText] = translatedText;
		setCachedTranslation(originalText, targetLanguage, sourceLanguage, translatedText);
	}

	logger.debug('Batch translation successful', {
		count: texts.length
	});

	return translations;
}

async function fetchTranslation(
	text: string,
	sourceLanguage: string,
	targetLanguage: string
): Promise<string> {
	const params = new URLSearchParams({
		client: 'gtx',
		sl: sourceLanguage,
		tl: targetLanguage,
		dt: 't',
		q: text
	});

	const url = `https://translate.googleapis.com/translate_a/single?${params.toString()}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Translation API returned status ${String(response.status)}`);
	}
	return extractTranslatedText(await response.json());
}

async function translateParallel(
	texts: string[],
	targetLanguage: string,
	sourceLanguage: string = 'en'
): Promise<Record<string, string>> {
	logger.debug('Translating texts in parallel', {
		count: texts.length,
		from: sourceLanguage,
		to: targetLanguage
	});

	const results = await Promise.all(
		texts.map(async (text) => {
			const translation = await fetchTranslation(text, sourceLanguage, targetLanguage);
			setCachedTranslation(text, targetLanguage, sourceLanguage, translation);
			return { text, translation };
		})
	);

	const translations: Record<string, string> = {};
	for (const { text, translation } of results) {
		translations[text] = translation;
	}

	logger.debug('Parallel translation successful', {
		count: texts.length
	});

	return translations;
}

// Honors the "auto" source sentinel, short-circuits same-language pairs, caches per text, and falls back to parallel on delimiter collision
export async function translateTexts(
	texts: string[],
	targetLanguage: string,
	sourceLanguage: string = 'en'
): Promise<TranslationResult> {
	if (texts.length === 0) {
		throw new Error('No texts provided for translation');
	}

	if (!targetLanguage) {
		throw new Error('Target language is required');
	}

	const normalizedTarget = (targetLanguage.split('-')[0] ?? targetLanguage).toLowerCase();
	const normalizedSource =
		sourceLanguage === 'auto'
			? 'auto'
			: (sourceLanguage.split('-')[0] ?? sourceLanguage).toLowerCase();

	if (normalizedSource !== 'auto' && normalizedSource === normalizedTarget) {
		const translations: Record<string, string> = {};
		for (const text of texts) {
			translations[text] = text;
		}
		return { translations };
	}

	logger.info('Translating texts', {
		count: texts.length,
		from: normalizedSource,
		to: normalizedTarget
	});

	const translations: Record<string, string> = {};
	const uncachedTexts: string[] = [];

	for (const text of texts) {
		if (!text || text.trim() === '') {
			translations[text] = text;
			continue;
		}

		const cached = getCachedTranslation(text, normalizedTarget, normalizedSource);
		if (cached) {
			translations[text] = cached;
			logger.debug('Translation cache hit', { len: text.length });
		} else {
			uncachedTexts.push(text);
		}
	}

	if (uncachedTexts.length > 0) {
		const batchTranslations = await translateBatch(
			uncachedTexts,
			normalizedTarget,
			normalizedSource
		);
		Object.assign(translations, batchTranslations);
	}

	return { translations };
}
