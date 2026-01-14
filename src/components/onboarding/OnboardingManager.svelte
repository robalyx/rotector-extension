<script lang="ts">
	import {
		shouldShowOnboarding,
		completeOnboarding,
		dismissOnboarding,
		isOnboardingReplay
	} from '@/lib/stores/onboarding';
	import { applyAgePreset } from '@/lib/stores/settings';
	import { AGE_PRESETS } from '@/lib/types/settings';
	import WelcomeModal from './WelcomeModal.svelte';
	import LanguageModal from './LanguageModal.svelte';
	import PresetModal from './PresetModal.svelte';
	import GuideModal from './GuideModal.svelte';
	import FinishModal from './FinishModal.svelte';

	type OnboardingStep = 'welcome' | 'language' | 'preset' | 'guide' | 'finish';

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

	// Proceed from welcome screen to language settings
	function handleWelcomeContinue() {
		currentStep = 'language';
	}

	// Skip onboarding with default Adult preset
	async function handleSkip() {
		await applyAgePreset(AGE_PRESETS.ADULT);
		await completeOnboarding();
	}

	// Proceed from language settings to preset selection
	function handleLanguageContinue() {
		currentStep = 'preset';
	}

	// Proceed from preset selection to feature guide
	function handlePresetContinue() {
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
		await completeOnboarding();
	}
</script>

{#if showOnboarding}
	{#if currentStep === 'welcome'}
		<WelcomeModal
			onContinue={handleWelcomeContinue}
			onDismiss={handleDismiss}
			onSkip={handleSkip}
		/>
	{:else if currentStep === 'language'}
		<LanguageModal onContinue={handleLanguageContinue} onDismiss={handleSkip} />
	{:else if currentStep === 'preset'}
		<PresetModal onContinue={handlePresetContinue} onDismiss={handleSkip} />
	{:else if currentStep === 'guide'}
		<GuideModal onDismiss={handleSkip} onFinish={handleGuideComplete} />
	{:else if currentStep === 'finish'}
		<FinishModal onFinish={handleFinish} />
	{/if}
{/if}
