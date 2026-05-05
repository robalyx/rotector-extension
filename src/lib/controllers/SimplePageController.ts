import { PageController } from './PageController';
import type { ComponentClassType } from '@/lib/types/constants';
import type { PageType } from '@/lib/types/api';
import type { SettingsKey } from '@/lib/types/settings';
import type { Component } from 'svelte';

// Config-driven controller: check settings flag, create container, mount component
interface SimplePageConfig<TProps extends Record<string, unknown>> {
	settingsKey: SettingsKey;
	component: Component<TProps>;
	containerClass: ComponentClassType;
	getProps: () => TProps;
}

export class SimplePageController<TProps extends Record<string, unknown>> extends PageController {
	protected override readonly settingsKey: SettingsKey;

	constructor(
		pageType: PageType,
		url: string,
		private readonly config: SimplePageConfig<TProps>
	) {
		super(pageType, url);
		this.settingsKey = config.settingsKey;
	}

	protected override async initializePage(): Promise<void> {
		const container = this.createComponentContainer(this.config.containerClass);
		const props = this.config.getProps();
		this.mountComponent(this.config.component, container, props);
	}
}
