<script lang="ts">
	import { locale as i18nLocale } from 'svelte-i18n';
	import { NO_WORD_BREAK_LOCALES, RTL_LOCALES } from '@/lib/utils/i18n';
	import { themeManager } from '@/lib/utils/theme';

	interface Props {
		text: string | undefined;
		multiline?: boolean;
		align?: 'start' | 'end' | 'center';
	}

	interface InheritedStyle {
		color: string;
		fontSize: number;
		fontWeight: number;
		fontFamily: string;
		lineHeight: number;
		letterSpacing: number;
		textTransform: string;
	}

	const DEFAULT_FONT_FAMILY = "'Builder Sans', helvetica, arial, sans-serif";
	const FALLBACK_COLOR = '#000';

	const effectiveTheme = themeManager.effectiveTheme;

	let sharedMeasureCtx: CanvasRenderingContext2D | null = null;

	function getMeasureCtx(): CanvasRenderingContext2D {
		if (!sharedMeasureCtx) {
			const c = document.createElement('canvas');
			const ctx = c.getContext('2d');
			if (!ctx) throw new Error('Canvas 2D context unavailable');
			sharedMeasureCtx = ctx;
		}
		return sharedMeasureCtx;
	}

	let { text, multiline = false, align = 'start' }: Props = $props();

	let canvas = $state<HTMLCanvasElement>();
	let dpr = $state(window.devicePixelRatio);
	let parentWidth = $state(0);

	let inherited = $state<InheritedStyle>({
		color: FALLBACK_COLOR,
		fontSize: 13,
		fontWeight: 500,
		fontFamily: DEFAULT_FONT_FAMILY,
		lineHeight: 1.4,
		letterSpacing: 0,
		textTransform: 'none'
	});

	const currentLocale = $derived($i18nLocale ?? 'en');
	const direction = $derived<'rtl' | 'ltr'>(RTL_LOCALES.has(currentLocale) ? 'rtl' : 'ltr');
	const rawText = $derived(text ?? '');
	const resolvedText = $derived.by(() => {
		switch (inherited.textTransform) {
			case 'uppercase': {
				return rawText.toUpperCase();
			}
			case 'lowercase': {
				return rawText.toLowerCase();
			}
			case 'capitalize': {
				return rawText.replaceAll(/\b\w/g, (c) => c.toUpperCase());
			}
			default: {
				return rawText;
			}
		}
	});
	const fontSpec = $derived(
		`${String(inherited.fontWeight)} ${String(inherited.fontSize)}px ${inherited.fontFamily}`
	);
	const letterSpacingPx = $derived(`${String(inherited.letterSpacing)}px`);

	function tokenize(line: string): string[] {
		// Array.from on a string iterates code points so emoji/surrogate pairs stay paired,
		// which is the whole point here as [...line] trips @typescript-eslint/no-misused-spread
		// eslint-disable-next-line unicorn/prefer-spread
		if (NO_WORD_BREAK_LOCALES.has(currentLocale)) return Array.from(line);
		return line.split(/(\s+)/).filter((s) => s.length > 0);
	}

	function wrapText(content: string, width: number): string[] {
		const paragraphs = content.split('\n');
		const lines: string[] = [];
		const ctx = getMeasureCtx();
		ctx.font = fontSpec;
		ctx.letterSpacing = letterSpacingPx;

		const breakLongToken = (token: string): string => {
			let line = '';
			for (const char of token) {
				if (ctx.measureText(line + char).width > width && line.length > 0) {
					lines.push(line);
					line = char;
				} else {
					line += char;
				}
			}
			return line;
		};

		for (const paragraph of paragraphs) {
			if (paragraph === '') {
				lines.push('');
				continue;
			}
			const tokens = tokenize(paragraph);
			let current = '';
			for (const token of tokens) {
				const candidate = current + token;
				if (ctx.measureText(candidate).width <= width) {
					current = candidate;
					continue;
				}
				if (current.length > 0) lines.push(current.trimEnd());
				const startToken = token.trimStart();
				current =
					ctx.measureText(startToken).width > width ? breakLongToken(startToken) : startToken;
			}
			if (current.length > 0) lines.push(current);
		}
		return lines.length > 0 ? lines : [''];
	}

	function paint() {
		const el = canvas;
		if (!el) return;
		const ctx = el.getContext('2d');
		if (!ctx) return;

		const measure = getMeasureCtx();
		measure.font = fontSpec;
		measure.letterSpacing = letterSpacingPx;

		const maxWidth = multiline ? parentWidth : 0;
		let lines: string[];
		let cssWidth: number;
		if (maxWidth > 0) {
			const singleLineWidth = measure.measureText(resolvedText).width;
			// 1px tolerance because measureText drifts sub-pixels between paints,
			// which would otherwise trick wrapText into breaking text that fits
			if (singleLineWidth <= maxWidth + 1) {
				lines = [resolvedText];
				cssWidth = singleLineWidth;
			} else {
				lines = wrapText(resolvedText, maxWidth);
				cssWidth = maxWidth;
			}
		} else {
			lines = [resolvedText];
			cssWidth = measure.measureText(resolvedText).width;
		}

		const lineHeightPx = inherited.fontSize * inherited.lineHeight;
		const cssHeight = lineHeightPx * lines.length;
		el.width = Math.max(1, Math.floor(cssWidth * dpr));
		el.height = Math.max(1, Math.floor(cssHeight * dpr));
		el.style.width = `${String(cssWidth)}px`;
		el.style.height = `${String(cssHeight)}px`;

		ctx.scale(dpr, dpr);
		ctx.font = fontSpec;
		ctx.letterSpacing = letterSpacingPx;
		ctx.fillStyle = inherited.color;
		ctx.direction = direction;
		ctx.textBaseline = 'top';

		const isRtl = direction === 'rtl';
		let textAlign: CanvasTextAlign;
		let x: number;
		if (align === 'center') {
			textAlign = 'center';
			x = cssWidth / 2;
		} else {
			const atEnd = (align === 'end') !== isRtl;
			textAlign = atEnd ? 'right' : 'left';
			x = atEnd ? cssWidth : 0;
		}
		ctx.textAlign = textAlign;

		const baselineOffset = (lineHeightPx - inherited.fontSize) / 2;
		for (const [i, line] of lines.entries()) {
			ctx.fillText(line, x, i * lineHeightPx + baselineOffset);
		}
	}

	$effect(() => {
		paint();
	});

	$effect(() => {
		if (!multiline || !canvas?.parentElement) return;
		const parent = canvas.parentElement;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) parentWidth = entry.contentRect.width;
		});
		observer.observe(parent);
		return () => observer.disconnect();
	});

	// Mirror parent's computed text styling. MutationObserver catches class/style
	// swaps (e.g. status badge transitioning between flagged variants); the theme
	// store covers token swaps.
	$effect(() => {
		void $effectiveTheme;
		if (!canvas?.parentElement) return;
		const parent = canvas.parentElement;

		const readStyle = () => {
			requestAnimationFrame(() => {
				if (!parent.isConnected) return;
				const cs = getComputedStyle(parent);
				const fontSize = Number.parseFloat(cs.fontSize);
				const parsedLineHeight = Number.parseFloat(cs.lineHeight);
				const parsedLetterSpacing = Number.parseFloat(cs.letterSpacing);
				const lineHeight = Number.isNaN(parsedLineHeight)
					? 1.4
					: cs.lineHeight.endsWith('px')
						? parsedLineHeight / fontSize
						: parsedLineHeight;
				const next = {
					color: cs.color,
					fontSize,
					fontWeight: Number.parseInt(cs.fontWeight, 10),
					fontFamily: cs.fontFamily,
					lineHeight,
					letterSpacing: Number.isNaN(parsedLetterSpacing) ? 0 : parsedLetterSpacing,
					textTransform: cs.textTransform
				};
				const prev = inherited;
				if (
					prev.color === next.color &&
					prev.fontSize === next.fontSize &&
					prev.fontWeight === next.fontWeight &&
					prev.fontFamily === next.fontFamily &&
					prev.lineHeight === next.lineHeight &&
					prev.letterSpacing === next.letterSpacing &&
					prev.textTransform === next.textTransform
				) {
					return;
				}
				inherited = next;
			});
		};

		readStyle();
		const observer = new MutationObserver(readStyle);
		observer.observe(parent, { attributes: true, attributeFilter: ['class', 'style'] });
		return () => observer.disconnect();
	});

	$effect(() => {
		void document.fonts.load(fontSpec).finally(paint);
	});

	$effect(() => {
		const mq = matchMedia(`(resolution: ${String(dpr)}dppx)`);
		const onChange = () => {
			dpr = window.devicePixelRatio;
		};
		mq.addEventListener('change', onChange);
		return () => mq.removeEventListener('change', onChange);
	});
</script>

<canvas
	bind:this={canvas}
	style:display="inline-block"
	style:vertical-align={multiline ? 'top' : 'middle'}
	aria-label={resolvedText}
	data-multiline={multiline ? '' : undefined}
></canvas>
