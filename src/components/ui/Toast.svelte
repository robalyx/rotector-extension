<script lang="ts">
	import { toast, dismissToast } from '@/lib/stores/toast';
	import { X, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-svelte';

	const icons = { success: CheckCircle, error: XCircle, warning: AlertTriangle, info: Info };

	let isExiting = $state(false);

	function handleDismiss(): void {
		isExiting = true;
		setTimeout(() => {
			dismissToast();
			isExiting = false;
		}, 200);
	}
</script>

{#if $toast}
	{@const Icon = icons[$toast.type]}
	<div
		class="toast-container"
		class:toast-error={$toast.type === 'error'}
		class:toast-exiting={isExiting}
		class:toast-info={$toast.type === 'info'}
		class:toast-success={$toast.type === 'success'}
		class:toast-warning={$toast.type === 'warning'}
		aria-live="polite"
		role="alert"
	>
		<div class="toast-icon">
			<Icon size={18} strokeWidth={2.5} />
		</div>
		<span class="toast-message">{$toast.message}</span>
		<button class="toast-dismiss" aria-label="Dismiss" onclick={handleDismiss} type="button">
			<X size={14} strokeWidth={2} />
		</button>

		{#if $toast.type === 'success' || $toast.type === 'info'}
			<div class="toast-progress"></div>
		{/if}
	</div>
{/if}
