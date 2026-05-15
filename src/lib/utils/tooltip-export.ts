import { snapdom } from '@zumer/snapdom';
import { get } from 'svelte/store';
import { _ } from 'svelte-i18n';
import { showError } from '@/lib/stores/toast';
import { logger } from '@/lib/utils/logging/logger';
import { ENGINE_STATUS_KEY, type EngineStatus } from '@/lib/utils/status/engine-status';

const CANVAS_MAX_DIM = 32_767;
const CAPTURE_SCALE = 2;

export type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';
export type ExportMode = 'clipboard' | ExportFormat;

// Selectors removed from the capture: interactive UI that has no meaning in a static image
const EXCLUDE_SELECTORS = [
	'.tooltip-options-container',
	'.tooltip-resize-handle',
	'.tooltip-header-toggle',
	'.cross-signal-indicator',
	'.outfit-only-indicator',
	'.source-info-indicator',
	'.reviewer-anonymous-indicator',
	'.reportable-pill',
	'.voting-buttons',
	'.voting-description',
	'.discord-summary-actions',
	'.discord-chevron-wrapper',
	'.queue-button',
	'.tooltip-metadata-reprocess',
	'.translation-toggle-container',
	'.translate-status-container',
	'.safe-reasons-toggle'
];

interface ExportOpts {
	mode: ExportMode;
	kind: 'user' | 'group';
	identifier: string;
	engineStatus: EngineStatus;
}

class TooTallError extends Error {}

export async function exportTooltipImage(node: HTMLElement, opts: ExportOpts): Promise<boolean> {
	try {
		if (opts.mode === 'clipboard') {
			await navigator.clipboard.write([
				new ClipboardItem({ 'image/png': renderTooltipBlob(node, opts, 'png') })
			]);
		} else {
			const blob = await renderTooltipBlob(node, opts, opts.mode);
			triggerDownload(blob, buildFilename(opts, opts.mode));
		}
		return true;
	} catch (error) {
		const t = get(_);
		if (error instanceof TooTallError) {
			showError(t('tooltip_export_error_too_tall'));
		} else {
			logger.error('Tooltip export failed:', error);
			showError(t('tooltip_export_error_generic'));
		}
		return false;
	}
}

async function renderTooltipBlob(
	node: HTMLElement,
	opts: ExportOpts,
	format: ExportFormat
): Promise<Blob> {
	const t = get(_);
	const host = document.createElement('div');

	const liveRect = node.getBoundingClientRect();
	host.className = 'tooltip-export-host';
	host.setAttribute('aria-hidden', 'true');
	host.dataset['tooltipExportHost'] = 'true';
	host.style.width = `${String(liveRect.width)}px`;

	const clone = node.cloneNode(true) as HTMLElement;
	clone.dataset['tooltipExport'] = 'true';

	// Canvas pixels rasterize blurry in exports so restore the original text via aria-label
	for (const canvas of clone.querySelectorAll('canvas')) {
		const text = canvas.getAttribute('aria-label');
		if (text === null) continue;
		const replacement = document.createElement('span');
		replacement.textContent = text;
		if (Object.hasOwn(canvas.dataset, 'multiline')) replacement.dataset['multiline'] = '';
		canvas.replaceWith(replacement);
	}

	// Screenshot exports show the original encoded text and not the decoded version
	for (const item of clone.querySelectorAll<HTMLElement>('.decoded-evidence-item')) {
		const encoded = item.dataset['encodedOriginal'];
		if (encoded === undefined) {
			throw new Error('decoded-evidence-item missing data-encoded-original attribute');
		}
		const replacement = document.createElement('div');
		replacement.className = 'evidence-item';
		replacement.textContent = encoded;
		item.replaceWith(replacement);
	}

	// Freshness warning for shared screenshots which is not shown in the live tooltip
	if (opts.engineStatus === 'behind-major') {
		const scrollContent = clone.querySelector<HTMLElement>('.tooltip-scrollable-content');
		if (!scrollContent) throw new Error('tooltip clone missing .tooltip-scrollable-content');
		const pill = document.createElement('div');
		pill.className = 'tooltip-export-footer';
		const tag = document.createElement('span');
		tag.className = `tooltip-options-engine-tag ${opts.engineStatus}`;
		tag.textContent = t(ENGINE_STATUS_KEY[opts.engineStatus]);
		pill.append(tag);
		scrollContent.append(pill);
	}

	host.append(clone);
	getExportMountTarget(node).append(host);

	try {
		await document.fonts.load('14px "Builder Sans"');
		await document.fonts.ready;
		await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

		if (format !== 'svg') {
			const heightLimit = Math.floor(CANVAS_MAX_DIM / (CAPTURE_SCALE * window.devicePixelRatio));
			if (clone.scrollHeight > heightLimit) throw new TooTallError();
		}

		return await snapdom.toBlob(clone, {
			type: format,
			scale: CAPTURE_SCALE,
			embedFonts: true,
			exclude: EXCLUDE_SELECTORS,
			excludeMode: 'remove'
		});
	} finally {
		host.remove();
	}
}

function getExportMountTarget(node: HTMLElement): HTMLElement {
	const root = node.getRootNode();
	const body = root instanceof ShadowRoot ? root.querySelector<HTMLElement>('body') : null;
	if (!body) throw new Error('tooltip export must run inside a shadow root with body');
	return body;
}

function buildFilename(opts: ExportOpts, format: ExportFormat): string {
	const date = new Date().toISOString().slice(0, 10);
	return `rotector-${opts.kind}-${opts.identifier}-${date}.${format}`;
}

function triggerDownload(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	document.body.append(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
