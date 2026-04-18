<script lang="ts">
	import { mount, unmount } from 'svelte';
	import { _ } from 'svelte-i18n';
	import { Lock, LockOpen } from '@lucide/svelte';
	import { buildDecodeMap, applyDecode, restoreOriginal } from '@/lib/utils/caesar-cipher';
	import type { TextNodeEntry } from '@/lib/utils/caesar-cipher';
	import { makeDecoder } from '@/lib/utils/encoding-detector';
	import type { EncodingResult } from '@/lib/utils/encoding-detector';
	import { BLUR_SELECTORS } from '@/lib/types/constants';
	import CipherIndicator from './CipherIndicator.svelte';

	// Shared toggle state reference between primary and modal instances
	interface ToggleState {
		decoded: boolean;
	}

	interface Props {
		descEl: HTMLElement;
		encoding: EncodingResult;
		onToggle?: () => void;
		toggleState?: ToggleState;
	}

	let { descEl, encoding, onToggle, toggleState }: Props = $props();

	// Modal instances delegate toggle and mirror parent state
	const isModalInstance = $derived(onToggle !== undefined);

	// Reactive toggle state where primary owns it and modal receives a reference
	const ownState: ToggleState = $state({ decoded: false });
	const shared = $derived(toggleState ?? ownState);
	const effectiveDecoded = $derived(shared.decoded);

	// Decode map
	const nodeMap = $derived(buildDecodeMap(descEl, makeDecoder(encoding)));
	const hasContent = $derived(nodeMap.size > 0);

	// Modal state
	let modalNodeMap: Map<Text, TextNodeEntry> | null = null;
	let modalInstance: ReturnType<typeof mount> | null = null;

	// Chip label detected state
	const detectedLabel = $derived.by(() => {
		switch (encoding.type) {
			case 'caesar':
				return $_('cipher_chip_detected');
			case 'morse':
				return $_('cipher_chip_detected_morse');
			case 'morse+caesar':
				return $_('cipher_chip_detected_morse_caesar');
			case 'binary':
				return $_('cipher_chip_detected_binary');
		}
	});

	// Chip label decoded state
	const decodedLabel = $derived.by(() => {
		switch (encoding.type) {
			case 'caesar':
				return $_('cipher_chip_decoded', { values: { shift: encoding.shift } });
			case 'morse':
				return $_('cipher_chip_decoded_morse');
			case 'morse+caesar':
				return $_('cipher_chip_decoded_morse_caesar', { values: { shift: encoding.shift } });
			case 'binary':
				return $_('cipher_chip_decoded_binary');
		}
	});

	// Chip label aria for undecoded state
	const showAriaLabel = $derived.by(() => {
		switch (encoding.type) {
			case 'caesar':
				return $_('cipher_chip_show_aria');
			case 'morse':
				return $_('cipher_chip_show_aria_morse');
			case 'morse+caesar':
				return $_('cipher_chip_show_aria_morse_caesar');
			case 'binary':
				return $_('cipher_chip_show_aria_binary');
		}
	});

	// Toggle decode/restore on profile and modal bio simultaneously
	function handleToggle() {
		if (isModalInstance) {
			onToggle!();
			return;
		}

		if (!shared.decoded) {
			applyDecode(nodeMap);
			if (modalNodeMap) applyDecode(modalNodeMap);
			shared.decoded = true;
		} else {
			restoreOriginal(nodeMap);
			if (modalNodeMap) restoreOriginal(modalNodeMap);
			shared.decoded = false;
		}
	}

	// Watch for the Roblox "About" dialog and mount a sibling CipherIndicator inside it
	$effect(() => {
		if (isModalInstance) return;

		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (!(node instanceof HTMLElement)) continue;

					// Dialog opened so find the description element inside it
					const isDialog = node.getAttribute('role') === 'dialog';
					const dialog = isDialog ? node : node.querySelector('[role="dialog"]');
					if (!dialog) continue;

					const modalDesc = dialog.querySelector<HTMLElement>(BLUR_SELECTORS.PROFILE_DESCRIPTION);
					if (!modalDesc) continue;

					const map = buildDecodeMap(modalDesc, makeDecoder(encoding));
					modalNodeMap = map;

					if (shared.decoded && map.size > 0) applyDecode(map);

					// Create a container and mount a CipherIndicator instance into it
					if (!modalInstance) {
						const container = document.createElement('div');
						modalDesc.insertAdjacentElement('afterend', container);
						modalInstance = mount(CipherIndicator, {
							target: container,
							props: {
								descEl: modalDesc,
								encoding,
								toggleState: ownState,
								onToggle: handleToggle
							}
						});
					}
				}

				for (const node of mutation.removedNodes) {
					if (!(node instanceof HTMLElement)) continue;

					// Dialog closed so tear down modal instance and clear map
					const isDialog = node.getAttribute('role') === 'dialog';
					const hadDialog = isDialog || !!node.querySelector('[role="dialog"]');
					if (hadDialog) {
						if (modalInstance) {
							void unmount(modalInstance);
							modalInstance = null;
						}
						modalNodeMap = null;
					}
				}
			}
		});

		observer.observe(document.body, { childList: true, subtree: true });

		return () => {
			if (shared.decoded) {
				restoreOriginal(nodeMap);
				if (modalNodeMap) restoreOriginal(modalNodeMap);
			}
			if (modalInstance) {
				void unmount(modalInstance);
				modalInstance = null;
			}
			modalNodeMap = null;
			observer.disconnect();
		};
	});
</script>

{#if hasContent}
	<button
		class="cipher-indicator-chip"
		aria-label={effectiveDecoded ? $_('cipher_chip_hide_aria') : showAriaLabel}
		onclick={handleToggle}
		type="button"
	>
		{#if effectiveDecoded}
			<LockOpen size={12} />
			<span>{decodedLabel}</span>
			<span>·</span>
			<span class="cipher-indicator-action">{$_('cipher_chip_show_original')}</span>
		{:else}
			<Lock size={12} />
			<span>{detectedLabel}</span>
			<span>·</span>
			<span class="cipher-indicator-action">{$_('cipher_chip_decode')}</span>
		{/if}
	</button>
{/if}
