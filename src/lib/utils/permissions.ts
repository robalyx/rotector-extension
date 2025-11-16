import { logger } from './logger';

// Check if the extension has optional permissions for custom API integration
export async function hasCustomApiPermissions(): Promise<boolean> {
	try {
		if (!browser.permissions) {
			logger.warn('Permissions API not available');
			return false;
		}

		const result = await browser.permissions.contains({
			origins: ['https://*/*']
		});
		return result;
	} catch (error) {
		logger.error('Failed to check permissions:', error);
		return false;
	}
}

// Request optional permissions for custom API integration
export async function requestCustomApiPermissions(): Promise<boolean> {
	try {
		if (!browser.permissions) {
			logger.warn('Permissions API not available');
			return false;
		}

		const granted = await browser.permissions.request({
			origins: ['https://*/*']
		});

		logger.info('Custom API permissions request result:', { granted });
		return granted;
	} catch (error) {
		logger.error('Failed to request permissions:', error);
		return false;
	}
}
