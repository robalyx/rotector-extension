<script lang="ts">
	import type { Target } from '../../../lib/types/api';
	import { t } from '../../../lib/stores/i18n';
	import { formatActiveDuration } from '../../../lib/utils/time';

	interface Props {
		target: Target;
	}

	let { target }: Props = $props();

	function getConfidenceColor(confidence: number): string {
		if (confidence >= 0.8) return 'var(--color-error)';
		if (confidence >= 0.6) return 'var(--color-warning)';
		if (confidence >= 0.4) return 'var(--color-primary)';
		return 'var(--color-status-safe)';
	}

	function getStatusColor(status: number): string {
		return status === 2 ? 'var(--color-error)' : 'var(--color-warning)';
	}

	function getStatusLabel(status: number): string {
		return status === 2 ? t('warzone_target_status_confirmed') : t('warzone_target_status_flagged');
	}
</script>

<div class="target-card">
	<div class="target-header">
		<a
			class="target-username"
			href="https://www.roblox.com/users/{target.userId}/profile"
			rel="noopener noreferrer"
			target="_blank"
		>
			{target.userName}
		</a>
		<span
			style:color={getStatusColor(target.userStatus)}
			style:background-color={`color-mix(in srgb, ${getStatusColor(target.userStatus)} 15%, transparent)`}
			style:border-color={`color-mix(in srgb, ${getStatusColor(target.userStatus)} 30%, transparent)`}
			class="target-status-badge"
		>
			{getStatusLabel(target.userStatus)}
		</span>
	</div>

	<div class="target-meta">
		<div class="meta-item">
			<span class="meta-label">{t('warzone_target_meta_confidence')}</span>
			<span style:color={getConfidenceColor(target.confidence)} class="meta-value"
				>{(target.confidence * 100).toFixed(0)}%</span
			>
		</div>
		<div class="meta-item">
			<span class="meta-label">{t('warzone_target_meta_attempts')}</span>
			<span class="meta-value">{target.banAttempts}</span>
		</div>
		<div class="meta-item">
			<span class="meta-label">{t('warzone_target_meta_active')}</span>
			<span class="meta-value">{formatActiveDuration(target.assignedAt)}</span>
		</div>
	</div>
</div>
