import { writable } from 'svelte/store';
import { apiClient } from '../services/api-client';
import { logger } from '../utils/logger';
import type { ExtensionUserProfile } from '../types/api';

// Authentication state interface
interface AuthState {
	isAuthenticated: boolean;
	profile: ExtensionUserProfile | null;
	uuid: string | null;
	isLoading: boolean;
	error: string | null;
}

// Initial authentication state
const initialState: AuthState = {
	isAuthenticated: false,
	profile: null,
	uuid: null,
	isLoading: false,
	error: null
};

// Create the auth store
export const authStore = writable<AuthState>(initialState);

// Track ongoing initialization to prevent concurrent calls
let initializationPromise: Promise<void> | null = null;

// Load authentication state from storage
export async function initializeAuth(): Promise<void> {
	// Return existing promise if initialization is already in progress
	if (initializationPromise) {
		return initializationPromise;
	}

	initializationPromise = (async () => {
		authStore.update((state) => ({ ...state, isLoading: true, error: null }));

		try {
			// Check if we have a stored UUID from Discord OAuth
			const result = await browser.storage.local.get(['extension_uuid']);
			const storedUuid = result.extension_uuid as string | undefined;

			if (storedUuid) {
				// Try to fetch profile with stored UUID
				const profile = await apiClient.getExtensionProfile();

				authStore.set({
					isAuthenticated: true,
					profile,
					uuid: storedUuid,
					isLoading: false,
					error: null
				});

				logger.info('Authentication restored from storage');
			} else {
				// No stored UUID, user needs to login with Discord
				authStore.set({
					isAuthenticated: false,
					profile: null,
					uuid: null,
					isLoading: false,
					error: null
				});

				logger.info('No authentication found, user needs to login with Discord');
			}
		} catch (error) {
			logger.error('Failed to initialize authentication:', error);

			// Clear invalid UUID (could be due to IP address change or other invalidation)
			await browser.storage.local.remove(['extension_uuid']);

			authStore.set({
				isAuthenticated: false,
				profile: null,
				uuid: null,
				isLoading: false,
				error: error instanceof Error ? error.message : String(error)
			});
		} finally {
			// Clear promise to allow future initialization attempts
			initializationPromise = null;
		}
	})();

	return initializationPromise;
}

// Initiate Discord OAuth login flow
export async function initiateDiscordLogin(): Promise<void> {
	authStore.update((state) => ({ ...state, isLoading: true, error: null }));

	try {
		await apiClient.initiateDiscordLogin();
		logger.info('Discord login initiated');
	} catch (error) {
		logger.error('Failed to initiate Discord login:', error);

		authStore.update((state) => ({
			...state,
			isLoading: false,
			error: error instanceof Error ? error.message : 'Failed to initiate Discord login'
		}));

		throw error;
	}
}

// Logout user
export async function logout(): Promise<void> {
	try {
		await browser.storage.local.remove(['extension_uuid']);

		authStore.set({
			isAuthenticated: false,
			profile: null,
			uuid: null,
			isLoading: false,
			error: null
		});

		logger.info('User logged out successfully');
	} catch (error) {
		logger.error('Failed to logout user:', error);
		throw error;
	}
}

// Update user anonymous status
export async function updateAnonymous(isAnonymous: boolean): Promise<void> {
	authStore.update((state) => ({ ...state, isLoading: true, error: null }));

	try {
		const updatedProfile = await apiClient.updateExtensionAnonymous(isAnonymous);

		authStore.update((state) => ({
			...state,
			profile: updatedProfile,
			isLoading: false,
			error: null
		}));

		logger.info('Anonymous status updated successfully', { isAnonymous });
	} catch (error) {
		logger.error('Failed to update anonymous status:', error);

		authStore.update((state) => ({
			...state,
			isLoading: false,
			error: error instanceof Error ? error.message : 'Anonymous status update failed'
		}));

		throw error;
	}
}

// Handle Discord authentication completion
export async function handleDiscordAuthComplete(
	uuid: string,
	user: ExtensionUserProfile
): Promise<void> {
	authStore.set({
		isAuthenticated: true,
		profile: user,
		uuid,
		isLoading: false,
		error: null
	});

	logger.info('Discord authentication completed', { uuid });
}
