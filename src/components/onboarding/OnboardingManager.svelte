<script lang="ts">
	import {
		shouldShowOnboarding,
		completeOnboarding,
		dismissOnboarding,
		isOnboardingReplay
	} from '@/lib/stores/onboarding';
	import WelcomeModal from './WelcomeModal.svelte';
	import GuideModal from './GuideModal.svelte';
	import FinishModal from './FinishModal.svelte';

	type OnboardingStep = 'welcome' | 'guide' | 'finish';

	let currentStep = $state<OnboardingStep>('welcome');
	let showOnboarding = $state(false);

	// Subscribe to the onboarding store
	$effect(() => {
		const unsubscribe = shouldShowOnboarding.subscribe((value) => {
			showOnboarding = value;
			if (value && isOnboardingReplay()) {
				currentStep = 'guide';
			} else {
				currentStep = 'welcome';
			}
		});
		return unsubscribe;
	});

	// Proceed from welcome screen to feature guide
	function handleWelcomeContinue() {
		currentStep = 'guide';
	}

	// Dismiss without marking complete
	function handleDismiss() {
		dismissOnboarding();
	}

	// Transition to finish screen after completing guide
	function handleGuideComplete() {
		currentStep = 'finish';
	}

	// Mark onboarding as fully completed
	async function handleFinish() {
		const isReplay = isOnboardingReplay();
		await completeOnboarding();
		if (!isReplay) {
			location.reload();
		}
	}
</script>

{#if showOnboarding}
	{#if currentStep === 'welcome'}
		<WelcomeModal onContinue={handleWelcomeContinue} onDismiss={handleDismiss} />
	{:else if currentStep === 'guide'}
		<GuideModal onDismiss={handleDismiss} onFinish={handleGuideComplete} />
	{:else if currentStep === 'finish'}
		<FinishModal onFinish={handleFinish} />
	{/if}
{/if}
