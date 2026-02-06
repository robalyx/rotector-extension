import { API_CONFIG } from '@/lib/types/constants';

/**
 * Bridge content script for Firefox compatibility.
 *
 * Firefox does not support `externally_connectable`, so roscoe web pages
 * cannot use `browser.runtime.sendMessage(extensionId)` to reach the
 * extension. The backend falls back to `window.postMessage` on non-Chromium
 * browsers. This script forwards those messages to the background script.
 *
 * On Chrome the web page communicates directly via `onMessageExternal`,
 * so this listener never fires.
 */
export default defineContentScript({
	matches: ['https://roscoe.rotector.com/*', 'https://roscoe-dev.rotector.com/*'],
	runAt: 'document_start',

	main() {
		window.addEventListener('message', (event: MessageEvent<unknown>) => {
			if (event.origin !== API_CONFIG.BASE_URL) return;

			const data = event.data as Record<string, unknown> | null;
			if (!data || typeof data !== 'object') return;
			if (data.source !== 'rotector-web' || !data.type) return;

			const { source: _, ...payload } = data;

			browser.runtime.sendMessage(payload).catch(() => {});
			window.postMessage({ source: 'rotector-extension' }, event.origin);
		});
	}
});
