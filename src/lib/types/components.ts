/**
 * Component instance types for Svelte components
 */

import type {UserStatus} from './api';

export interface QueueModalManagerInstance {
    showQueue: (userId: string, isReprocess?: boolean, userStatus?: UserStatus | null) => void;
    hideQueue: () => void;
}

export interface SettingsSectionInstance {
    highlightSetting: (settingKey: string) => void;
    unlockDeveloperMode: () => Promise<void>;
}

export interface SettingsPageInstance {
    unlockDeveloperMode: () => Promise<void>;
}