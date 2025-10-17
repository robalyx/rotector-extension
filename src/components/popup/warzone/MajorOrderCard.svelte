<script lang="ts">
	import type { MajorOrder } from '../../../lib/types/api';
	import { Trophy } from 'lucide-svelte';

	interface Props {
		order: MajorOrder;
	}

	let { order }: Props = $props();

	function formatDate(dateString: string | undefined | null): string {
		if (!dateString) return 'N/A';
		const date = new Date(dateString);
		if (isNaN(date.getTime())) return 'N/A';
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function getProgressColor(progress: number): string {
		if (progress >= 75) return 'var(--color-status-safe)';
		if (progress >= 50) return 'var(--color-primary)';
		if (progress >= 25) return 'var(--color-warning)';
		return 'var(--color-error)';
	}

	function getOrderTypeLabel(type: string): string {
		const labels: Record<string, string> = {
			ban_count: 'Ban Count',
			zone_liberation: 'Zone Liberation',
			verification: 'Verification'
		};
		return labels[type] || type;
	}

	const isExpiringSoon = $derived.by(() => {
		if (!order.expiresAt) return false;
		const expiryDate = new Date(order.expiresAt);
		const now = new Date();
		const hoursRemaining = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
		return hoursRemaining < 24 && hoursRemaining > 0;
	});
</script>

<div class="major-order-card" class:expiring={isExpiringSoon}>
	<div class="order-header">
		<div class="order-title-section">
			<h4 class="order-title">{order.title}</h4>
			<span class="order-type-badge">{getOrderTypeLabel(order.type)}</span>
		</div>
		<div class="order-expiry">
			<span class="expiry-label">{order.completedAt ? 'Completed' : 'Expires'}</span>
			<span class="expiry-date">{formatDate(order.completedAt || order.expiresAt)}</span>
		</div>
	</div>

	<p class="order-description">{order.description}</p>

	<div class="order-progress-section">
		<div class="progress-header">
			<span class="progress-label">Progress</span>
			<span class="progress-value"
				>{order.currentValue.toLocaleString()} / {order.targetValue.toLocaleString()}</span
			>
		</div>
		<div class="progress-bar-container">
			<div
				style:width="{order.progress}%"
				style:background-color={getProgressColor(order.progress)}
				class="progress-bar-fill"
			></div>
		</div>
		<span class="progress-percentage">{order.progress.toFixed(1)}%</span>
	</div>

	<div class="order-reward">
		<Trophy class="reward-icon" size={20} />
		<span class="reward-text">{order.rewardDescription}</span>
	</div>
</div>
