<script lang="ts">
	import { waitForElement } from '@/lib/utils/dom/element-waiter';
	import { PAGE_TYPES } from '@/lib/types/constants';
	import { FRIENDS_CAROUSEL_SELECTORS } from '@/lib/controllers/selectors/friends';
	import UserListManager from '../lists/UserListManager.svelte';

	interface Props {
		onMount?: (cleanup: () => void) => void;
	}

	let { onMount }: Props = $props();

	let showCarousel = $state(false);

	$effect(() => {
		void waitForElement(FRIENDS_CAROUSEL_SELECTORS.CONTAINER).then((r) => {
			if (r.success) showCarousel = true;
		});
		onMount?.(cleanup);

		return cleanup;
	});

	function cleanup() {
		showCarousel = false;
	}
</script>

{#if showCarousel}
	<UserListManager pageType={PAGE_TYPES.HOME} />
{/if}
