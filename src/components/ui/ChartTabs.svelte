<script generics="T extends string" lang="ts">
	interface Tab {
		value: T;
		label: string;
	}

	interface Props {
		tabs: Tab[];
		selected: T;
		onSelect: (value: T) => void;
		class?: string;
	}

	let { tabs, selected, onSelect, class: className = '' }: Props = $props();
</script>

<div class="chart-tabs {className}" role="tablist">
	{#each tabs as tab (tab.value)}
		<button
			class="chart-tab"
			class:active={selected === tab.value}
			aria-selected={selected === tab.value}
			onclick={() => onSelect(tab.value)}
			role="tab"
			tabindex="0"
			type="button"
		>
			{tab.label}
		</button>
	{/each}
</div>
