<script lang="ts">
	import Portal from 'svelte-portal';
	import { AlertCircle, AlertTriangle, CheckCircle, XCircle, X } from 'lucide-svelte';

	interface ModalProps {
		isOpen: boolean;
		onClose?: () => void;
		title: string;
		confirmText?: string;
		cancelText?: string;
		blockText?: string;
		showCancel?: boolean;
		showConfirm?: boolean;
		showClose?: boolean;
		showBlock?: boolean;
		confirmVariant?: 'primary' | 'danger' | 'queue';
		confirmDisabled?: boolean;
		onConfirm?: () => void;
		onCancel?: () => void;
		onBlock?: () => void;
		icon?: string;
		actionsLayout?: 'horizontal' | 'vertical';
		size?: 'normal' | 'small' | 'wide';
		modalType?: 'modal' | 'friend-warning' | 'queue-success' | 'queue-error' | 'queue-loading';
		children: import('svelte').Snippet;
		actions?: import('svelte').Snippet;
		headerContent?: import('svelte').Snippet;
	}

	let {
		isOpen = $bindable(),
		onClose,
		title,
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		blockText = 'Block User',
		showCancel = true,
		showConfirm = true,
		showClose = true,
		showBlock = false,
		confirmVariant = 'primary',
		confirmDisabled = false,
		onConfirm,
		onCancel,
		onBlock,
		icon,
		actionsLayout = 'vertical',
		size = 'normal',
		modalType = 'modal',
		children,
		actions,
		headerContent
	}: ModalProps = $props();

	let isClosing = $state(false);
	let overlayElement = $state<HTMLDivElement>();
	let popupElement = $state<HTMLDivElement>();
	let closeButtonEl = $state<HTMLButtonElement>();
	let previouslyFocusedElement = $state<HTMLElement | null>(null);
	const headingId = `modal-title-${Math.random().toString(36).slice(2)}`;

	const MODAL_CLASSES = {
		modal: {
			overlay: 'modal-overlay',
			popup: { normal: 'modal-popup', small: 'modal-popup-small', wide: 'modal-popup-wide' },
			header: 'modal-header',
			title: 'modal-title',
			content: { normal: 'modal-content', small: 'modal-content-small' },
			actions: { vertical: 'modal-actions', horizontal: 'modal-actions-horizontal' }
		},
		'friend-warning': {
			overlay: 'friend-warning-overlay',
			popup: {
				normal: 'friend-warning-popup',
				small: 'friend-warning-popup-small',
				wide: 'modal-popup-wide'
			},
			header: 'friend-warning-header',
			title: 'friend-warning-title',
			content: { normal: 'friend-warning-content', small: 'friend-warning-content-small' },
			actions: {
				vertical: 'friend-warning-actions',
				horizontal: 'friend-warning-actions-horizontal'
			}
		},
		'queue-success': {
			overlay: 'queue-success-overlay',
			popup: {
				normal: 'queue-success-popup',
				small: 'queue-success-popup-small',
				wide: 'modal-popup-wide'
			},
			header: 'queue-success-header',
			title: 'queue-success-title',
			content: { normal: 'queue-success-content', small: 'queue-success-content-small' },
			actions: { vertical: 'queue-success-actions', horizontal: 'queue-success-actions-horizontal' }
		},
		'queue-error': {
			overlay: 'queue-error-overlay',
			popup: {
				normal: 'queue-error-popup',
				small: 'queue-error-popup-small',
				wide: 'modal-popup-wide'
			},
			header: 'queue-error-header',
			title: 'queue-error-title',
			content: { normal: 'queue-error-content', small: 'queue-error-content-small' },
			actions: { vertical: 'queue-error-actions', horizontal: 'queue-error-actions-horizontal' }
		},
		'queue-loading': {
			overlay: 'queue-loading-overlay',
			popup: {
				normal: 'queue-loading-popup',
				small: 'queue-loading-popup-small',
				wide: 'modal-popup-wide'
			},
			header: 'queue-loading-header',
			title: 'queue-loading-title',
			content: { normal: 'queue-loading-content', small: 'queue-loading-content-small' },
			actions: { vertical: 'queue-loading-actions', horizontal: 'queue-loading-actions-horizontal' }
		}
	} as const;

	const classes = $derived({
		overlay: MODAL_CLASSES[modalType].overlay,
		popup:
			MODAL_CLASSES[modalType].popup[
				size === 'wide' ? 'wide' : size === 'small' ? 'small' : 'normal'
			],
		header: MODAL_CLASSES[modalType].header,
		title: MODAL_CLASSES[modalType].title,
		content: MODAL_CLASSES[modalType].content[size === 'small' ? 'small' : 'normal'],
		actions: MODAL_CLASSES[modalType].actions[actionsLayout]
	});

	function closeModal(result?: boolean | 'block') {
		isClosing = true;
		setTimeout(() => {
			isOpen = false;
			isClosing = false;
			if (result !== undefined) {
				if (result === true && onConfirm) {
					onConfirm();
				} else if (result === false && onCancel) {
					onCancel();
				} else if (result === 'block' && onBlock) {
					onBlock();
				}
			}
			if (onClose) {
				onClose();
			}
			// Restore focus to the element that opened the modal
			previouslyFocusedElement?.focus();
		}, 300);
	}

	function handleEscape(e: KeyboardEvent) {
		if (e.key === 'Escape' && isOpen && showClose) {
			closeModal(false);
		}
	}

	function handleOverlayClick(e: MouseEvent | KeyboardEvent) {
		if (e.target === overlayElement && showClose) {
			closeModal(false);
		}
	}

	// Trap focus within the modal content
	function trapFocus(e: KeyboardEvent) {
		if (e.key !== 'Tab' || !popupElement) return;
		const focusable = Array.from(
			popupElement.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			)
		).filter((el) => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true');
		if (focusable.length === 0) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		const active = document.activeElement as HTMLElement | null;
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
			// Capture the currently focused element
			previouslyFocusedElement = document.activeElement as HTMLElement | null;
			document.addEventListener('keydown', handleEscape);
			// Show popup with animation
			requestAnimationFrame(() => {
				if (overlayElement) {
					overlayElement.classList.add('visible');
				}
				// Move initial focus inside the dialog
				if (showClose && closeButtonEl) {
					closeButtonEl.focus();
				} else if (popupElement) {
					popupElement.focus();
				}
			});
			return () => document.removeEventListener('keydown', handleEscape);
		}
		return () => {}; // No-op cleanup for when isOpen is false
	});
</script>

{#if isOpen}
	<Portal target="body">
		<!--
			Modal overlay (backdrop) is intentionally mouse-only per ARIA best practices.
			Keyboard users dismiss via Escape key or dialog buttons (focus trapped inside).
			Making the overlay keyboard-accessible would break the focus trap pattern.
		-->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={overlayElement}
			class={classes.overlay}
			class:closing={isClosing}
			onclick={handleOverlayClick}
		>
			<div
				bind:this={popupElement}
				class={classes.popup}
				aria-labelledby={headingId}
				aria-modal="true"
				onkeydown={trapFocus}
				role="dialog"
				tabindex="-1"
			>
				<div class={classes.header}>
					{#if headerContent}
						{@render headerContent()}
					{/if}
					{#if icon}
						<div class="mr-2 flex items-center">
							{#if icon === 'warning'}
								{#if modalType === 'friend-warning'}
									<AlertTriangle class="friend-warning-icon" size={32} />
								{:else}
									<AlertCircle class="modal-warning-icon" size={32} />
								{/if}
							{:else if icon === 'success'}
								<CheckCircle class="modal-success-icon" size={32} />
							{:else if icon === 'error'}
								<XCircle class="modal-error-icon" size={32} />
							{/if}
						</div>
					{/if}
					<h3 id={headingId} class={classes.title}>
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
							<X aria-hidden="true" color="var(--color-error)" size={24} />
						</button>
					{/if}
				</div>

				<div class={classes.content}>
					{@render children()}
				</div>

				{#if actions}
					<div class="modal-actions-horizontal">
						{@render actions()}
					</div>
				{:else if showBlock || showCancel || showConfirm}
					<div class={classes.actions}>
						{#if showBlock}
							<button
								class={modalType === 'friend-warning' ? 'friend-warning-block' : 'modal-cancel'}
								onclick={() => closeModal('block')}
								type="button"
							>
								{blockText}
							</button>
						{/if}
						{#if showCancel}
							<button
								class={modalType === 'friend-warning' ? 'friend-warning-cancel' : 'modal-cancel'}
								onclick={() => closeModal(false)}
								type="button"
							>
								{cancelText}
							</button>
						{/if}
						{#if showConfirm}
							<button
								class={modalType === 'friend-warning' ? 'friend-warning-confirm' : 'modal-confirm'}
								class:friend-warning-confirm-danger={modalType === 'friend-warning' &&
									confirmVariant === 'danger'}
								class:modal-confirm-danger={modalType !== 'friend-warning' &&
									confirmVariant === 'danger'}
								class:modal-confirm-queue={modalType !== 'friend-warning' &&
									confirmVariant === 'queue'}
								disabled={confirmDisabled}
								onclick={() => closeModal(true)}
								type="button"
							>
								{confirmText}
							</button>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</Portal>
{/if}
