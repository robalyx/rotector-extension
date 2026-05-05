<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { settings, updateSetting } from '@/lib/stores/settings';
	import { SETTINGS_KEYS } from '@/lib/types/settings';
	import { logger } from '@/lib/utils/logging/logger';
	import { SOURCE_INFO_MAP, type HoverPopoverKind } from './hover-popover-types';

	const HOVER_POPOVER_OFFSET = 6;
	const HOVER_POPOVER_VIEWPORT_PADDING = 12;
	const HOVER_POPOVER_HIDE_DELAY = 80;

	interface Props {
		scrollContent?: HTMLElement | undefined;
	}

	let { scrollContent }: Props = $props();

	let popoverRef = $state<HTMLElement>();
	let active = $state<{ anchor: HTMLElement; kind: HoverPopoverKind } | null>(null);
	let position = $state({ left: 0, top: 0 });

	let hideTimeout: ReturnType<typeof setTimeout> | null = null;
	let positionFrame: number | null = null;
	let hintWriteQueue: Promise<unknown> = Promise.resolve();

	const hintsSeen = $derived(new Set<string>($settings[SETTINGS_KEYS.INFO_POPOVER_HINTS_SEEN]));

	function clearHideTimeoutInternal() {
		if (hideTimeout !== null) {
			clearTimeout(hideTimeout);
			hideTimeout = null;
		}
	}

	function clearPositionFrame() {
		if (positionFrame !== null) {
			cancelAnimationFrame(positionFrame);
			positionFrame = null;
		}
	}

	function close() {
		clearHideTimeoutInternal();
		clearPositionFrame();
		active = null;
	}

	function reposition() {
		if (!active || !popoverRef) return;

		const { anchor } = active;
		if (!anchor.isConnected) {
			close();
			return;
		}

		const anchorRect = anchor.getBoundingClientRect();
		const popoverWidth = popoverRef.offsetWidth;
		const popoverHeight = popoverRef.offsetHeight;
		if (!popoverWidth || !popoverHeight) return;

		const minLeft = HOVER_POPOVER_VIEWPORT_PADDING;
		const maxLeft = Math.max(minLeft, window.innerWidth - popoverWidth - minLeft);
		const belowTop = anchorRect.bottom + HOVER_POPOVER_OFFSET;
		const aboveTop = anchorRect.top - popoverHeight - HOVER_POPOVER_OFFSET;
		const fitsBelow =
			belowTop + popoverHeight <= window.innerHeight - HOVER_POPOVER_VIEWPORT_PADDING;
		const fitsAbove = aboveTop >= HOVER_POPOVER_VIEWPORT_PADDING;
		const left = Math.min(Math.max(anchorRect.right - popoverWidth, minLeft), maxLeft);
		let top = belowTop;

		if (!fitsBelow && fitsAbove) top = aboveTop;

		const minTop = HOVER_POPOVER_VIEWPORT_PADDING;
		const maxTop = Math.max(minTop, window.innerHeight - popoverHeight - minTop);

		position = {
			left: Math.round(left),
			top: Math.round(Math.min(Math.max(top, minTop), maxTop))
		};
	}

	function queueReposition() {
		if (positionFrame !== null) return;
		positionFrame = requestAnimationFrame(() => {
			positionFrame = null;
			reposition();
		});
	}

	function markHintSeen(kind: HoverPopoverKind) {
		if (hintsSeen.has(kind)) return;
		hintWriteQueue = hintWriteQueue
			.then(() => {
				const existing = $settings[SETTINGS_KEYS.INFO_POPOVER_HINTS_SEEN];
				if (existing.includes(kind)) return;
				return updateSetting(SETTINGS_KEYS.INFO_POPOVER_HINTS_SEEN, [...existing, kind]);
			})
			.catch((err: unknown) => {
				logger.error('Failed to mark info hint seen:', err);
			});
	}

	export function show(anchor: HTMLElement, kind: HoverPopoverKind) {
		clearHideTimeoutInternal();
		active = { anchor, kind };
		queueReposition();
		markHintSeen(kind);
	}

	export function scheduleClose() {
		clearHideTimeoutInternal();
		hideTimeout = setTimeout(() => {
			hideTimeout = null;
			active = null;
		}, HOVER_POPOVER_HIDE_DELAY);
	}

	export function cancelClose() {
		clearHideTimeoutInternal();
	}

	export function markSeen(kind: HoverPopoverKind) {
		markHintSeen(kind);
	}

	$effect(() => {
		if (!active || !popoverRef) return;
		queueReposition();
	});

	$effect(() => {
		if (!active) return;

		const onViewportChange = () => {
			queueReposition();
		};
		scrollContent?.addEventListener('scroll', onViewportChange);
		window.addEventListener('resize', onViewportChange);
		window.addEventListener('scroll', onViewportChange, true);

		return () => {
			scrollContent?.removeEventListener('scroll', onViewportChange);
			window.removeEventListener('resize', onViewportChange);
			window.removeEventListener('scroll', onViewportChange, true);
		};
	});
</script>

{#if active}
	<div
		bind:this={popoverRef}
		style:left={`${String(position.left)}px`}
		style:top={`${String(position.top)}px`}
		class="tooltip-hover-popover"
		class:cross-signal-popover={active.kind === 'cross-signal'}
		class:outfit-only-popover={active.kind === 'outfit-only'}
		class:source-info-popover={active.kind.endsWith('-info')}
		onmouseenter={cancelClose}
		onmouseleave={scheduleClose}
		role="tooltip"
	>
		{#if active.kind === 'cross-signal'}
			<strong>{$_('tooltip_cross_signal_title')}</strong>
			<p>{$_('tooltip_cross_signal_message')}</p>
		{:else if active.kind === 'outfit-only'}
			<strong>{$_('tooltip_outfit_title')}</strong>
			<p>{$_('tooltip_outfit_message')}</p>
		{:else if active.kind === 'trap-info'}
			<strong>{$_('tooltip_trap_info_title')}</strong>
			<p>
				{$_('tooltip_trap_info_message')}
				<a
					href="https://rotector.com/blog/trap-game-detection-explained"
					onclick={(event) => event.stopPropagation()}
					rel="noopener noreferrer"
					target="_blank">{$_('tooltip_trap_info_link')}</a
				>
			</p>
		{:else if active.kind === 'discord-info'}
			<strong>{$_('tooltip_discord_info_title')}</strong>
			<p>{$_('tooltip_discord_info_message')}</p>
			<ul class="source-info-list">
				<li class="source-info-list-item">
					<span><strong>Joined</strong> - {$_('tooltip_discord_info_joined')}</span>
				</li>
				<li class="source-info-list-item">
					<span><strong>First seen</strong> - {$_('tooltip_discord_info_first_seen')}</span>
				</li>
				<li class="source-info-list-item">
					<span><strong>Updated</strong> - {$_('tooltip_discord_info_updated')}</span>
				</li>
			</ul>
		{:else if active.kind.endsWith('-info')}
			{@const entry = SOURCE_INFO_MAP[active.kind.slice(0, -'-info'.length)]}
			{#if entry}
				<strong>{$_(entry.titleKey)}</strong>
				<p>{$_(entry.messageKey)}</p>
			{/if}
		{/if}
	</div>
{/if}
