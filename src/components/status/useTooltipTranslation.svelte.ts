import { get } from 'svelte/store';
import { locale } from 'svelte-i18n';
import { apiClient } from '@/lib/services/rotector/api-client';
import { logger } from '@/lib/utils/logging/logger';
import { extractErrorMessage } from '@/lib/utils/dom/sanitizer';
import type { FormattedReasonEntry } from '@/lib/utils/status/violation-formatter';

interface Options {
	reasonEntries: () => FormattedReasonEntry[];
	shouldAutoTranslate: () => boolean;
	getDecodedContent: (content: string) => string;
	resetKey: () => unknown;
}

interface TooltipTranslation {
	readonly translationsMap: Record<string, string>;
	readonly isTranslating: boolean;
	readonly translationError: string | null;
	showTranslated: boolean;
	readonly hasActualTranslations: boolean;
	getDisplayText(text: string): string;
}

// Owns the auto-translation state machine for the tooltip:
// resets on activeTab/reasonEntries change, kicks off translation when the
// gate is on, and exposes a getDisplayText helper for templates
export function useTooltipTranslation(opts: Options): TooltipTranslation {
	let translationsMap = $state<Record<string, string>>({});
	let isTranslating = $state(false);
	let translationError = $state<string | null>(null);
	let showTranslated = $state(true);
	let translationAttempted = $state(false);

	const hasActualTranslations = $derived.by(() => {
		const entries = Object.entries(translationsMap);
		if (entries.length === 0) return false;
		return entries.some(([original, translated]) => original !== translated);
	});

	$effect(() => {
		void opts.resetKey();
		translationsMap = {};
		translationError = null;
		translationAttempted = false;
		showTranslated = true;
	});

	$effect(() => {
		if (opts.shouldAutoTranslate() && !translationAttempted && !isTranslating) {
			void performAutoTranslation();
		}
	});

	async function performAutoTranslation() {
		if (isTranslating || Object.keys(translationsMap).length > 0) return;

		try {
			isTranslating = true;
			translationError = null;

			const currentLanguage = get(locale) ?? 'en';
			const isEnglishUser = currentLanguage.split('-')[0]?.toLowerCase() === 'en';
			const targetLanguage = isEnglishUser ? 'en' : currentLanguage;

			const allTranslations: Record<string, string> = {};
			let totalTextsCount = 0;

			for (const reason of opts.reasonEntries()) {
				const textsForReason: string[] = [];

				if (!isEnglishUser && reason.message) {
					textsForReason.push(reason.message);
				}

				if (reason.evidence) {
					for (const evidence of reason.evidence) {
						if (evidence.type === 'outfit') {
							if (evidence.outfitName) textsForReason.push(evidence.outfitName);
							if (evidence.outfitReason) textsForReason.push(evidence.outfitReason);
						} else if (evidence.content) {
							textsForReason.push(opts.getDecodedContent(evidence.content));
						}
					}
				}

				if (textsForReason.length > 0) {
					try {
						const result = await apiClient.translateTexts(textsForReason, targetLanguage, 'auto');
						Object.assign(allTranslations, result.translations);
						totalTextsCount += textsForReason.length;
					} catch (err) {
						logger.warn('Translation failed for reason, keeping original:', err);
					}
				}
			}

			translationsMap = allTranslations;

			if (totalTextsCount > 0) {
				logger.userAction('auto_translation_completed', {
					count: totalTextsCount,
					to: targetLanguage
				});
			}
		} catch (err) {
			logger.error('Auto-translation failed:', err);
			translationError = extractErrorMessage(err);
		} finally {
			isTranslating = false;
			translationAttempted = true;
		}
	}

	return {
		get translationsMap() {
			return translationsMap;
		},
		get isTranslating() {
			return isTranslating;
		},
		get translationError() {
			return translationError;
		},
		get showTranslated() {
			return showTranslated;
		},
		set showTranslated(value: boolean) {
			showTranslated = value;
		},
		get hasActualTranslations() {
			return hasActualTranslations;
		},
		getDisplayText(text: string): string {
			return showTranslated ? translationsMap[text] || text : text;
		}
	};
}
