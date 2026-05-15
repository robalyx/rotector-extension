import { mount } from 'svelte';
import App from './App.svelte';
import '../../styles/index.css';
import './app.css';
import { themeManager } from '@/lib/utils/theme';
import { initializeSettings } from '@/lib/stores/settings';
import { logger } from '@/lib/utils/logging/logger';

async function initializePopup() {
	const appElement = document.querySelector('#app');
	if (!appElement) {
		throw new Error('Failed to find app container element');
	}

	logger.debug('Popup: Initializing settings...');
	await initializeSettings();
	logger.debug('Popup: Settings initialized');

	logger.debug('Popup: Initializing theme sync...');
	await themeManager.initializePopupThemeSync();
	logger.debug('Popup: Theme sync initialized');

	return mount(App, {
		target: appElement
	});
}

const app = initializePopup();

export default app;
