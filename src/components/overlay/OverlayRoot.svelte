<script lang="ts">
	import { get } from 'svelte/store';
	import OnboardingManager from '@/components/onboarding/OnboardingManager.svelte';
	import ChangelogModal from '@/components/changelog/ChangelogModal.svelte';
	import LegalUpdateModal from '@/components/legal/LegalUpdateModal.svelte';
	import OutfitViewerModal from '@/components/features/OutfitViewerModal.svelte';
	import FirstDetectionModal from '@/components/features/FirstDetectionModal.svelte';
	import RestrictionNoticeModal from '@/components/features/RestrictionNoticeModal.svelte';
	import { shouldShowChangelogModal } from '@/lib/stores/changelog';
	import { shouldShowLegalModal, triggerLegalReview } from '@/lib/stores/legal';
	import { shouldShowFirstDetection } from '@/lib/stores/first-detection';
	import { shouldShowRestrictionNotice } from '@/lib/stores/restricted-access';
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
	async function checkPopupRequests() {
		const result = await browser.storage.local.get([
			'onboardingReplayRequested',
			'legalReviewRequested'
		]);
		const toRemove: string[] = [];
		if (result['onboardingReplayRequested']) {
			toRemove.push('onboardingReplayRequested');
			triggerOnboardingReplay();
			logger.debug('Onboarding replay triggered from popup');
		}
		if (result['legalReviewRequested']) {
			toRemove.push('legalReviewRequested');
			await triggerLegalReview();
			logger.debug('Legal review triggered from popup');
		}
		if (toRemove.length) await browser.storage.local.remove(toRemove);
	}

	void checkPopupRequests();
</script>

<OnboardingManager />

{#if $shouldShowLegalModal}
	<LegalUpdateModal />
{/if}

{#if showChangelog}
	<ChangelogModal onClose={() => logger.debug('Changelog modal closed')} />
{/if}

{#if $shouldShowRestrictionNotice}
	<RestrictionNoticeModal />
{/if}

{#if $shouldShowFirstDetection}
	<FirstDetectionModal />
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
