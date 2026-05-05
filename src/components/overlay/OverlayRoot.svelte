<script lang="ts">
	import { get } from 'svelte/store';
	import OnboardingManager from '@/components/onboarding/OnboardingManager.svelte';
	import ChangelogModal from '@/components/changelog/ChangelogModal.svelte';
	import LegalUpdateModal from '@/components/legal/LegalUpdateModal.svelte';
	import OutfitViewerModal from '@/components/features/outfit/OutfitViewerModal.svelte';
	import FirstDetectionModal from '@/components/features/profile/FirstDetectionModal.svelte';
	import RestrictionNoticeModal from '@/components/features/report/RestrictionNoticeModal.svelte';
	import { shouldShowChangelogModal } from '@/lib/stores/changelog';
	import { shouldShowLegalModal, triggerLegalReview } from '@/lib/stores/legal';
	import { shouldShowFirstDetection } from '@/lib/stores/first-detection';
	import { shouldShowRestrictionNotice } from '@/lib/stores/restricted-access';
	import { triggerOnboardingReplay } from '@/lib/stores/onboarding';

	import { closeOutfitViewer, outfitViewerRequest } from '@/lib/stores/outfit-viewer';
	import { shouldShowOnboarding } from '@/lib/stores/onboarding';
	import { logger } from '@/lib/utils/logging/logger';
	import { getStorage, removeStorage } from '@/lib/utils/storage';

	const showChangelog = get(shouldShowChangelogModal);

	async function checkPopupRequests() {
		const [replayRequested, legalRequested] = await Promise.all([
			getStorage<boolean>('local', 'onboardingReplayRequested', false),
			getStorage<boolean>('local', 'legalReviewRequested', false)
		]);
		const toRemove: string[] = [];
		if (replayRequested) {
			toRemove.push('onboardingReplayRequested');
			triggerOnboardingReplay();
			logger.debug('Onboarding replay triggered from popup');
		}
		if (legalRequested) {
			toRemove.push('legalReviewRequested');
			await triggerLegalReview();
			logger.debug('Legal review triggered from popup');
		}
		if (toRemove.length) await removeStorage('local', toRemove);
	}

	void checkPopupRequests();
</script>

{#if $shouldShowOnboarding}
	<OnboardingManager />
{/if}

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

{#if $outfitViewerRequest}
	<OutfitViewerModal
		flaggedOutfits={$outfitViewerRequest.flaggedOutfits}
		onClose={closeOutfitViewer}
		userId={$outfitViewerRequest.userId}
	/>
{/if}
