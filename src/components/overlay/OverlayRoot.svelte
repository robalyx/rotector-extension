<script lang="ts">
	import { get } from 'svelte/store';
	import OnboardingManager from '@/components/onboarding/OnboardingManager.svelte';
	import ChangelogModal from '@/components/changelog/ChangelogModal.svelte';
	import OutfitViewerModal from '@/components/features/OutfitViewerModal.svelte';
	import { shouldShowChangelogModal } from '@/lib/stores/changelog';
	import { triggerOnboardingReplay } from '@/lib/stores/onboarding';
	import {
		closeOutfitViewer,
		getOutfitViewerRequest,
		onOutfitViewerChange
	} from '@/lib/stores/outfit-viewer';
	import { logger } from '@/lib/utils/logger';

	const showChangelog = get(shouldShowChangelogModal);

	// Outfit viewer singleton
	let outfitRequest = $state(getOutfitViewerRequest());

	$effect(() => {
		return onOutfitViewerChange(() => {
			outfitRequest = getOutfitViewerRequest();
		});
	});

	// Check for replay request from popup
	async function checkReplayRequest() {
		const replayResult = await browser.storage.local.get('onboardingReplayRequested');
		if (replayResult['onboardingReplayRequested']) {
			await browser.storage.local.remove('onboardingReplayRequested');
			triggerOnboardingReplay();
			logger.debug('Onboarding replay triggered from popup');
		}
	}

	void checkReplayRequest();
</script>

<OnboardingManager />

{#if showChangelog}
	<ChangelogModal onClose={() => logger.debug('Changelog modal closed')} />
{/if}

<!-- Outfit Viewer Modal -->
{#if outfitRequest}
	<OutfitViewerModal
		flaggedOutfits={outfitRequest.flaggedOutfits}
		isOpen={true}
		onClose={closeOutfitViewer}
		userId={outfitRequest.userId}
	/>
{/if}
