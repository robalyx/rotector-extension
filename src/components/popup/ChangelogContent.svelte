<script lang="ts">
  import type { Changelog, ChangelogEntry } from '../../lib/types/changelog.js';

  interface ChangelogContentProps {
    changelog: Changelog;
    compact?: boolean;
    technicalMode?: boolean;
  }

  let { changelog, compact = false, technicalMode = false }: ChangelogContentProps = $props();

  // Get icon for changelog entry type
  function getChangeTypeIcon(type: ChangelogEntry['type']): string {
    switch (type) {
      case 'added':
        return '🎉';
      case 'changed':
        return '🔄';
      case 'deprecated':
        return '⚠️';
      case 'removed':
        return '🗑️';
      case 'fixed':
        return '🐛';
      case 'security':
        return '🔒';
      default:
        return '📝';
    }
  }

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
        return 'Added';
      case 'changed':
        return 'Changed';
      case 'deprecated':
        return 'Deprecated';
      case 'removed':
        return 'Removed';
      case 'fixed':
        return 'Fixed';
      case 'security':
        return 'Security';
      default:
        return 'Update';
    }
  }

  // Get the appropriate description based on technical mode
  function getChangeDescription(change: ChangelogEntry): string {
    if (technicalMode && change.technicalDescription) {
      return change.technicalDescription;
    }
    return change.description;
  }

  // Group changes by type for better organization
  const groupedChanges = $derived.by(() => {
    const groups: Record<string, ChangelogEntry[]> = {};
    changelog.changes.forEach(change => {
      if (!groups[change.type]) {
        groups[change.type] = [];
      }
      groups[change.type].push(change);
    });
    return groups;
  });

  // Get ordered types for consistent display
  const orderedTypes = $derived.by(() => {
    const typeOrder: ChangelogEntry['type'][] = ['added', 'changed', 'fixed', 'security', 'deprecated', 'removed'];
    return typeOrder.filter(type => groupedChanges[type]?.length > 0);
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

  <!-- Summary (always shown in compact mode, optional in full mode) -->
  {#if compact || changelog.summary}
    <div class="changelog-summary">
      <p class="changelog-summary-text">{changelog.summary}</p>
    </div>
  {/if}

  <!-- Changes (only in full mode or if not compact) -->
  {#if !compact}
    <div class="changelog-changes">
      {#each orderedTypes as type (type)}
        <div class="changelog-type-group">
          <div class="changelog-type-header">
            <span class="changelog-type-icon">{getChangeTypeIcon(type)}</span>
            <span class="changelog-type-label {getChangeTypeColor(type)}">{getChangeTypeLabel(type)}</span>
            <span class="changelog-type-count">({groupedChanges[type].length})</span>
          </div>
          <ul class="changelog-type-list">
            {#each groupedChanges[type] as change (change.description)}
              <li class="changelog-change-item">
                {getChangeDescription(change)}
              </li>
            {/each}
          </ul>
        </div>
      {/each}
    </div>
  {/if}
</div>