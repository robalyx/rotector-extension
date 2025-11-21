<script lang="ts">
	import type { Changelog, ChangelogEntry } from '@/lib/types/changelog';
	import { Plus, RefreshCw, AlertTriangle, Trash2, Bug, Lock, FileText } from 'lucide-svelte';
	import { _ } from 'svelte-i18n';

	interface ChangelogContentProps {
		changelog: Changelog;
		compact?: boolean;
	}

	let { changelog, compact = false }: ChangelogContentProps = $props();

	// Get color class for changelog entry type
	function getChangeTypeColor(type: ChangelogEntry['type']): string {
		switch (type) {
			case 'added':
				return 'changelog-entry-added';
			case 'changed':
				return 'changelog-entry-changed';
			case 'deprecated':
				return 'changelog-entry-deprecated';
			case 'removed':
				return 'changelog-entry-removed';
			case 'fixed':
				return 'changelog-entry-fixed';
			case 'security':
				return 'changelog-entry-security';
			default:
				return 'changelog-entry-default';
		}
	}

	// Get display name for change type
	function getChangeTypeLabel(type: ChangelogEntry['type']): string {
		switch (type) {
			case 'added':
				return $_('stats_changelog_type_added');
			case 'changed':
				return $_('stats_changelog_type_changed');
			case 'deprecated':
				return $_('stats_changelog_type_deprecated');
			case 'removed':
				return $_('stats_changelog_type_removed');
			case 'fixed':
				return $_('stats_changelog_type_fixed');
			case 'security':
				return $_('stats_changelog_type_security');
			default:
				return $_('stats_changelog_type_update');
		}
	}

	// Group changes by type for better organization
	const groupedChanges = $derived.by(() => {
		const groups: Record<string, ChangelogEntry[]> = {};
		changelog.changes.forEach((change) => {
			(groups[change.type] ??= []).push(change);
		});
		return groups;
	});

	// Get ordered types for consistent display
	const orderedTypes = $derived.by(() => {
		const typeOrder: ChangelogEntry['type'][] = [
			'added',
			'changed',
			'fixed',
			'security',
			'deprecated',
			'removed'
		];
		return typeOrder.filter((type) => groupedChanges[type]?.length > 0);
	});
</script>

<div class={compact ? 'changelog-content-compact' : 'changelog-content-full'}>
	<!-- Changelog Header -->
	<div class="changelog-header">
		<div class="changelog-version-info">
			<h3 class="changelog-title">{changelog.title}</h3>
			<div class="changelog-meta">
				<span class="changelog-version">v{changelog.version}</span>
				<span class="changelog-date">{new Date(changelog.date).toLocaleDateString()}</span>
			</div>
		</div>
	</div>

	<!-- Summary -->
	{#if changelog.summary}
		<div class="changelog-summary">
			<p class="changelog-summary-text">{changelog.summary}</p>
		</div>
	{/if}

	<!-- Changes -->
	{#if !compact}
		<div class="changelog-changes">
			{#each orderedTypes as type (type)}
				<div class="changelog-type-group">
					<div class="changelog-type-header">
						{#if type === 'added'}
							<Plus class="changelog-type-icon {getChangeTypeColor(type)}" size={16} />
						{:else if type === 'changed'}
							<RefreshCw class="changelog-type-icon {getChangeTypeColor(type)}" size={16} />
						{:else if type === 'deprecated'}
							<AlertTriangle class="changelog-type-icon {getChangeTypeColor(type)}" size={16} />
						{:else if type === 'removed'}
							<Trash2 class="changelog-type-icon {getChangeTypeColor(type)}" size={16} />
						{:else if type === 'fixed'}
							<Bug class="changelog-type-icon {getChangeTypeColor(type)}" size={16} />
						{:else if type === 'security'}
							<Lock class="changelog-type-icon {getChangeTypeColor(type)}" size={16} />
						{:else}
							<FileText class="changelog-type-icon {getChangeTypeColor(type)}" size={16} />
						{/if}
						<span class="changelog-type-label {getChangeTypeColor(type)}"
							>{getChangeTypeLabel(type)}</span
						>
						<span class="changelog-type-count">({groupedChanges[type].length})</span>
					</div>
					<ul class="changelog-type-list">
						{#each groupedChanges[type] as change, index (`${type}-${index}-${change.description}`)}
							<li class="changelog-change-item">
								{change.description}
								{#if change.subpoints && change.subpoints.length > 0}
									<ul class="changelog-change-subpoints">
										{#each change.subpoints as subpoint, subIndex (`${type}-${index}-subpoint-${subIndex}`)}
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
			{/each}
		</div>
	{/if}
</div>
