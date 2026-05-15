<script lang="ts">
	import type { Changelog, ChangelogEntry } from '@/lib/types/changelog';
	import { Plus, RefreshCw, TriangleAlert, Trash2, Bug, Lock } from '@lucide/svelte';
	import { _ } from 'svelte-i18n';

	interface ChangelogContentProps {
		changelog: Changelog;
	}

	let { changelog }: ChangelogContentProps = $props();

	const TYPE_COLOR: Record<ChangelogEntry['type'], string> = {
		added: 'changelog-entry-added',
		changed: 'changelog-entry-changed',
		deprecated: 'changelog-entry-deprecated',
		removed: 'changelog-entry-removed',
		fixed: 'changelog-entry-fixed',
		security: 'changelog-entry-security'
	};

	const TYPE_LABEL_KEY: Record<ChangelogEntry['type'], string> = {
		added: 'stats_changelog_type_added',
		changed: 'stats_changelog_type_changed',
		deprecated: 'stats_changelog_type_deprecated',
		removed: 'stats_changelog_type_removed',
		fixed: 'stats_changelog_type_fixed',
		security: 'stats_changelog_type_security'
	};

	const TYPE_ORDER: ChangelogEntry['type'][] = [
		'added',
		'changed',
		'fixed',
		'security',
		'deprecated',
		'removed'
	];

	const groupedChanges = $derived.by(() => {
		const groups: Record<string, ChangelogEntry[]> = {};
		for (const change of changelog.changes) {
			(groups[change.type] ??= []).push(change);
		}
		return groups;
	});

	const orderedTypes = $derived(
		TYPE_ORDER.filter((type) => (groupedChanges[type]?.length ?? 0) > 0)
	);
</script>

<div class="changelog-content-full">
	<div class="changelog-header">
		<div class="changelog-version-info">
			<h3 class="changelog-title">{changelog.title}</h3>
			<div class="changelog-meta">
				<span class="changelog-version">v{changelog.version}</span>
				<span class="changelog-date">{new Date(changelog.date).toLocaleDateString()}</span>
			</div>
		</div>
	</div>

	{#if changelog.summary}
		<div class="changelog-summary">
			<p class="changelog-summary-text">{changelog.summary}</p>
		</div>
	{/if}

	<div class="changelog-changes">
		{#each orderedTypes as type (type)}
			{@const changes = groupedChanges[type]}
			{#if changes}
				<div class="changelog-type-group">
					<div class="changelog-type-header">
						{#if type === 'added'}
							<Plus class="changelog-type-icon {TYPE_COLOR[type]}" size={16} />
						{:else if type === 'changed'}
							<RefreshCw class="changelog-type-icon {TYPE_COLOR[type]}" size={16} />
						{:else if type === 'deprecated'}
							<TriangleAlert class="changelog-type-icon {TYPE_COLOR[type]}" size={16} />
						{:else if type === 'removed'}
							<Trash2 class="changelog-type-icon {TYPE_COLOR[type]}" size={16} />
						{:else if type === 'fixed'}
							<Bug class="changelog-type-icon {TYPE_COLOR[type]}" size={16} />
						{:else if type === 'security'}
							<Lock class="changelog-type-icon {TYPE_COLOR[type]}" size={16} />
						{/if}
						<span class="changelog-type-label {TYPE_COLOR[type]}">{$_(TYPE_LABEL_KEY[type])}</span>
						<span class="changelog-type-count">({changes.length})</span>
					</div>
					<ul class="changelog-type-list">
						{#each changes as change, index (`${type}-${String(index)}-${change.description}`)}
							<li class="changelog-change-item">
								{change.description}
								{#if change.subpoints && change.subpoints.length > 0}
									<ul class="changelog-change-subpoints">
										{#each change.subpoints as subpoint, subIndex (`${type}-${String(index)}-subpoint-${String(subIndex)}`)}
											<li class="changelog-subpoint-item">
												{subpoint}
											</li>
										{/each}
									</ul>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/each}
	</div>
</div>
