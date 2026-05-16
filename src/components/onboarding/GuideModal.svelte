<script lang="ts">
	import { _ } from 'svelte-i18n';
	import AppLogo from '@/components/ui/AppLogo.svelte';
	import Modal from '@/components/ui/Modal.svelte';
	import GuideStepStatus from './steps/GuideStepStatus.svelte';
	import GuideStepBadges from './steps/GuideStepBadges.svelte';
	import GuideStepScope from './steps/GuideStepScope.svelte';

	interface GuideModalProps {
		onDismiss: () => void;
		onFinish: () => void;
	}

	let { onDismiss, onFinish }: GuideModalProps = $props();

	const TOTAL_STEPS = 3;
	let currentStepIndex = $state(0);
	let isOpen = $state(true);

	function handleBack() {
		if (currentStepIndex > 0) {
			currentStepIndex--;
		}
	}

	function handleNext() {
		if (currentStepIndex < TOTAL_STEPS - 1) {
			currentStepIndex++;
		} else {
			isOpen = false;
			onFinish();
		}
	}
</script>

<Modal
	onCancel={onDismiss}
	showCancel={false}
	showConfirm={false}
	showStatusChip={false}
	title={$_('onboarding_guide_title')}
	bind:isOpen
>
	{#snippet headerContent()}
		<div
			class="onboarding-progress"
			aria-label={$_('onboarding_guide_step_aria', {
				values: { current: currentStepIndex + 1, total: TOTAL_STEPS }
			})}
			role="group"
		>
			{#each Array.from({ length: TOTAL_STEPS }, (_, i) => i) as stepIndex (stepIndex)}
				<div
					class="onboarding-progress-dot"
					class:active={stepIndex === currentStepIndex}
					class:completed={stepIndex < currentStepIndex}
				></div>
			{/each}
		</div>
	{/snippet}

	<div class="onboarding-hero-logo">
		<AppLogo />
	</div>
	{#if currentStepIndex === 0}
		<GuideStepStatus />
	{:else if currentStepIndex === 1}
		<GuideStepBadges />
	{:else if currentStepIndex === 2}
		<GuideStepScope />
	{/if}

	{#snippet actions()}
		{#if currentStepIndex > 0}
			<button class="modal-button-cancel" onclick={handleBack} type="button">
				{$_('onboarding_guide_back')}
			</button>
		{/if}
		<button class="modal-button-primary" onclick={handleNext} type="button">
			{#if currentStepIndex === TOTAL_STEPS - 1}
				{$_('onboarding_guide_finish')}
			{:else}
				{$_('onboarding_guide_next')}
			{/if}
		</button>
	{/snippet}
</Modal>
