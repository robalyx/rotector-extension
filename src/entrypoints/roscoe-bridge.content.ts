import { API_CONFIG } from '@/lib/types/constants';

// Firefox lacks `externally_connectable`, so roscoe pages can't reach the extension
// via `browser.runtime.sendMessage(extensionId)`. The backend falls back to
// `window.postMessage` on non-Chromium browsers and this script forwards those to background.
export default defineContentScript({
	matches: [
		`https://${import.meta.env.USE_DEV_API === 'true' ? 'roscoe-dev' : 'roscoe'}.rotector.com/*`
	],
	runAt: 'document_start',

	main() {
		window.addEventListener('message', (event: MessageEvent<unknown>) => {
			if (event.origin !== API_CONFIG.BASE_URL) return;

			const data = event.data as Record<string, unknown> | null;
			if (!data || typeof data !== 'object') return;
			if (data['source'] !== 'rotector-web' || !data['type']) return;

			const { source: _, ...payload } = data;

			browser.runtime.sendMessage(payload).catch(() => {});
			window.postMessage({ source: 'rotector-extension' }, event.origin);
		});
	}
});
