<script lang="ts">
	import OverlayPortal from '@/components/overlay/OverlayPortal.svelte';
	import { CircleCheckBig, CircleX, Info, TriangleAlert, X } from '@lucide/svelte';

	type ModalStatus = 'info' | 'warning' | 'success' | 'error';
	type ModalSize = 'normal' | 'small' | 'wide';

	interface ModalProps {
		isOpen: boolean;
		title: string;
		ariaLabel?: string;
		status?: ModalStatus;
		size?: ModalSize;
		showStatusChip?: boolean;
		showCancel?: boolean;
		showConfirm?: boolean;
		showClose?: boolean;
		confirmText?: string;
		cancelText?: string;
		confirmDanger?: boolean;
		confirmDisabled?: boolean;
		onClose?: () => void;
		onConfirm?: () => void;
		onCancel?: () => void;
		children: import('svelte').Snippet;
		actions?: import('svelte').Snippet;
		headerContent?: import('svelte').Snippet;
	}

	let {
		isOpen = $bindable(),
		title,
		ariaLabel,
		status,
		size = 'normal',
		showStatusChip = true,
		showCancel = true,
		showConfirm = true,
		showClose = true,
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		confirmDanger = false,
		confirmDisabled = false,
		onClose,
		onConfirm,
		onCancel,
		children,
		actions,
		headerContent
	}: ModalProps = $props();

	const POPUP_CLASS = {
		normal: 'modal-popup',
		small: 'modal-popup-small',
		wide: 'modal-popup-wide'
	} as const;

	const headingId = `modal-title-${Math.random().toString(36).slice(2)}`;

	let isClosing = $state(false);
	let overlayElement = $state<HTMLDivElement>();
	let popupElement = $state<HTMLDivElement>();
	let closeButtonEl = $state<HTMLButtonElement>();
	let previouslyFocusedElement = $state<HTMLElement | null>(null);

	const popupClass = $derived(POPUP_CLASS[size]);
	const renderStatusChip = $derived(showStatusChip && status !== undefined);

	function closeModal(result?: boolean) {
		isClosing = true;
		setTimeout(() => {
			isOpen = false;
			isClosing = false;
			(result === true ? onConfirm : result === false ? onCancel : undefined)?.();
			onClose?.();
			previouslyFocusedElement?.focus();
		}, 250);
	}

	function handleEscape(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen && showClose) {
			closeModal(false);
		}
	}

	function handleOverlayClick(e: MouseEvent) {
		const target = e.composedPath()[0];
		if (target === overlayElement && showClose) {
			closeModal(false);
		}
	}

	// Focus trap restricted to popup contents
	function trapFocus(e: KeyboardEvent) {
		if (e.key !== 'Tab' || !popupElement) return;
		const focusable = Array.from(
			popupElement.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			)
		).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (!first || !last) return;
		const root = popupElement.getRootNode() as Document | ShadowRoot;
		const active = root.activeElement instanceof HTMLElement ? root.activeElement : null;
		if (e.shiftKey && active === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && active === last) {
			e.preventDefault();
			first.focus();
		}
	}

	$effect(() => {
		if (isOpen) {
			previouslyFocusedElement =
				document.activeElement instanceof HTMLElement ? document.activeElement : null;
			document.addEventListener('keydown', handleEscape);
			requestAnimationFrame(() => {
				if (overlayElement) {
					overlayElement.classList.add('visible');
				}
				if (showClose && closeButtonEl) {
					closeButtonEl.focus();
				} else if (popupElement) {
					popupElement.focus();
				}
			});
			return () => document.removeEventListener('keydown', handleEscape);
		}
		return () => {};
	});
</script>

{#if isOpen}
	<OverlayPortal>
		<!--
			Modal overlay (backdrop) is intentionally mouse-only per ARIA best practices.
			Keyboard users dismiss via Escape key or dialog buttons (focus trapped inside).
		-->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={overlayElement}
			class="modal-overlay"
			class:closing={isClosing}
			onclick={handleOverlayClick}
		>
			<div
				bind:this={popupElement}
				class={popupClass}
				aria-label={ariaLabel}
				aria-labelledby={ariaLabel ? undefined : headingId}
				aria-modal="true"
				onkeydown={trapFocus}
				role="dialog"
				tabindex="-1"
			>
				<div class="modal-header">
					{#if headerContent}
						{@render headerContent()}
					{/if}
					{#if renderStatusChip}
						<span
							class="modal-status-chip"
							class:modal-status-chip-error={status === 'error'}
							class:modal-status-chip-info={status === 'info'}
							class:modal-status-chip-success={status === 'success'}
							class:modal-status-chip-warning={status === 'warning'}
							aria-hidden="true"
						>
							{#if status === 'warning'}
								<TriangleAlert class="modal-status-chip-icon" size={15} strokeWidth={2.25} />
							{:else if status === 'success'}
								<CircleCheckBig class="modal-status-chip-icon" size={15} strokeWidth={2.25} />
							{:else if status === 'error'}
								<CircleX class="modal-status-chip-icon" size={15} strokeWidth={2.25} />
							{:else}
								<Info class="modal-status-chip-icon" size={15} strokeWidth={2.25} />
							{/if}
						</span>
					{/if}
					<h3 id={headingId} class="modal-title">
						{title}
					</h3>
					{#if showClose}
						<button
							bind:this={closeButtonEl}
							class="modal-close"
							aria-label="Close dialog"
							onclick={() => closeModal(false)}
							type="button"
						>
							<X aria-hidden="true" size={18} />
						</button>
					{/if}
				</div>

				<div class="modal-divider"></div>

				<div class="modal-content">
					{@render children()}
				</div>

				{#if actions || showCancel || showConfirm}
					<div class="modal-divider"></div>
					<div class="modal-actions">
						{#if actions}
							{@render actions()}
						{:else}
							{#if showCancel}
								<button class="modal-button-cancel" onclick={() => closeModal(false)} type="button">
									{cancelText}
								</button>
							{/if}
							{#if showConfirm}
								<button
									class={confirmDanger ? 'modal-button-danger' : 'modal-button-primary'}
									disabled={confirmDisabled}
									onclick={() => closeModal(true)}
									type="button"
								>
									{confirmText}
								</button>
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</OverlayPortal>
{/if}
