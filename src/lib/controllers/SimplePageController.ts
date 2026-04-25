import { get } from 'svelte/store';
import { PageController } from './PageController';
import type { ComponentClassType } from '../types/constants';
import type { PageType } from '../types/api';
import type { SettingsKey } from '../types/settings';
import { settings } from '../stores/settings';
import { logger } from '../utils/logger';
import type { Component } from 'svelte';

/**
 * Config-driven controller for pages that follow a simple pattern:
 * check a settings flag, create a container, mount a component.
 */
interface SimplePageConfig<TProps extends Record<string, unknown>> {
	settingsKey: SettingsKey;
	component: Component<TProps>;
	containerClass: ComponentClassType;
	disabledMessage: string;
	getProps: () => TProps;
}

export class SimplePageController<TProps extends Record<string, unknown>> extends PageController {
	constructor(
		pageType: PageType,
		url: string,
		private readonly config: SimplePageConfig<TProps>
	) {
		super(pageType, url);
	}

	protected override async initializePage(): Promise<void> {
		// Check if feature is enabled
		const currentSettings = get(settings);
		if (!currentSettings[this.config.settingsKey]) {
			logger.debug(this.config.disabledMessage);
			return;
		}

		// Mount the component
		const container = this.createComponentContainer(this.config.containerClass);
		const props = this.config.getProps();
		this.mountComponent(this.config.component, container, props);
	}
}
