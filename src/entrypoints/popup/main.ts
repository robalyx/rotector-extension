import {mount} from 'svelte';
import App from './App.svelte';
import '../../styles/index.css';
import './app.css';
import {initializePopupThemeSync} from '@/lib/utils/theme';
import {initializeSettings} from '@/lib/stores/settings';
import {logger} from '@/lib/utils/logger';

async function initializePopup() {
    const appElement = document.getElementById('app');
    if (!appElement) {
        throw new Error('Failed to find app container element');
    }

    // Initialize settings first
    logger.debug('Popup: Initializing settings...');
    await initializeSettings();
    logger.debug('Popup: Settings initialized');

    // Initialize popup theme synchronization with content script
    // This allows the popup to sync with Roblox theme when in auto mode
    logger.debug('Popup: Initializing theme sync...');
    await initializePopupThemeSync();
    logger.debug('Popup: Theme sync initialized');

    return mount(App, {
        target: appElement,
    });
}

// Initialize popup asynchronously
const app = initializePopup();

export default app;
