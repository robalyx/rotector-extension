/**
 * Component instance types for Svelte components
 */

export interface QueueModalManagerInstance {
    showQueue: (userId: string) => void;
    hideQueue: () => void;
}

export interface SettingsSectionInstance {
    highlightSetting: (settingKey: string) => void;
}