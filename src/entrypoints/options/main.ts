import { mount } from 'svelte';
import App from '../popup/App.svelte';
import '../../styles/index.css';
import '../popup/app.css';
import { themeManager } from '@/lib/utils/theme';
import { initializeSettings } from '@/lib/stores/settings';
import { logger } from '@/lib/utils/logging/logger';

async function initializeOptionsPage() {
	const appElement = document.querySelector('#app');
	if (!appElement) {
		throw new Error('Failed to find app container element');
	}

	logger.debug('Options: Initializing settings...');
	await initializeSettings();
	logger.debug('Options: Settings initialized');

	logger.debug('Options: Initializing theme sync...');
	await themeManager.initializePopupThemeSync();
	logger.debug('Options: Theme sync initialized');

	return mount(App, {
		target: appElement,
		props: {
			surface: 'options'
		}
	});
}

const app = initializeOptionsPage();

export default app;
