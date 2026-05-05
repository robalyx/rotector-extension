<script lang="ts">
	import {
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

	let currentStep = $state<OnboardingStep>(isOnboardingReplay() ? 'guide' : 'welcome');

	async function handleSkip() {
		await applyAgePreset(AGE_PRESETS.ADULT);
		await completeOnboarding();
	}
</script>

{#if currentStep === 'welcome'}
	<WelcomeModal
		onContinue={() => (currentStep = 'language')}
		onDismiss={dismissOnboarding}
		onSkip={handleSkip}
	/>
{:else if currentStep === 'language'}
	<LanguageModal onContinue={() => (currentStep = 'preset')} onDismiss={handleSkip} />
{:else if currentStep === 'preset'}
	<PresetModal onContinue={() => (currentStep = 'guide')} onDismiss={handleSkip} />
{:else if currentStep === 'guide'}
	<GuideModal onDismiss={handleSkip} onFinish={() => (currentStep = 'finish')} />
{:else if currentStep === 'finish'}
	<FinishModal onFinish={completeOnboarding} />
{/if}
