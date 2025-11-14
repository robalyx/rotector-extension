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
		size?: 'normal' | 'small';
		modalType?: 'modal' | 'friend-warning' | 'queue-success' | 'queue-error' | 'queue-loading';
		children: import('svelte').Snippet;
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
		children
	}: ModalProps = $props();

	let isClosing = $state(false);
	let overlayElement = $state<HTMLDivElement>();
	let popupElement = $state<HTMLDivElement>();
	let closeButtonEl = $state<HTMLButtonElement>();
	let previouslyFocusedElement = $state<HTMLElement | null>(null);
	const headingId = `modal-title-${Math.random().toString(36).slice(2)}`;

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
			class={modalType === 'friend-warning'
				? 'friend-warning-overlay'
				: modalType === 'queue-success'
					? 'queue-success-overlay'
					: modalType === 'queue-error'
						? 'queue-error-overlay'
						: modalType === 'queue-loading'
							? 'queue-loading-overlay'
							: 'modal-overlay'}
			class:closing={isClosing}
			onclick={handleOverlayClick}
		>
			<div
				bind:this={popupElement}
				class={size === 'small'
					? modalType === 'friend-warning'
						? 'friend-warning-popup-small'
						: modalType === 'queue-success'
							? 'queue-success-popup-small'
							: modalType === 'queue-error'
								? 'queue-error-popup-small'
								: modalType === 'queue-loading'
									? 'queue-loading-popup-small'
									: 'modal-popup-small'
					: modalType === 'friend-warning'
						? 'friend-warning-popup'
						: modalType === 'queue-success'
							? 'queue-success-popup'
							: modalType === 'queue-error'
								? 'queue-error-popup'
								: modalType === 'queue-loading'
									? 'queue-loading-popup'
									: 'modal-popup'}
				aria-labelledby={headingId}
				aria-modal="true"
				onkeydown={trapFocus}
				role="dialog"
				tabindex="-1"
			>
				<div
					class={modalType === 'friend-warning'
						? 'friend-warning-header'
						: modalType === 'queue-success'
							? 'queue-success-header'
							: modalType === 'queue-error'
								? 'queue-error-header'
								: modalType === 'queue-loading'
									? 'queue-loading-header'
									: 'modal-header'}
				>
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
					<h3
						id={headingId}
						class={modalType === 'friend-warning'
							? 'friend-warning-title'
							: modalType === 'queue-success'
								? 'queue-success-title'
								: modalType === 'queue-error'
									? 'queue-error-title'
									: modalType === 'queue-loading'
										? 'queue-loading-title'
										: 'modal-title'}
					>
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

				<div
					class={size === 'small'
						? modalType === 'friend-warning'
							? 'friend-warning-content-small'
							: modalType === 'queue-success'
								? 'queue-success-content-small'
								: modalType === 'queue-error'
									? 'queue-error-content-small'
									: modalType === 'queue-loading'
										? 'queue-loading-content-small'
										: 'modal-content-small'
						: modalType === 'friend-warning'
							? 'friend-warning-content'
							: modalType === 'queue-success'
								? 'queue-success-content'
								: modalType === 'queue-error'
									? 'queue-error-content'
									: modalType === 'queue-loading'
										? 'queue-loading-content'
										: 'modal-content'}
				>
					{@render children()}
				</div>

				<div
					class={actionsLayout === 'horizontal'
						? modalType === 'friend-warning'
							? 'friend-warning-actions-horizontal'
							: modalType === 'queue-success'
								? 'queue-success-actions-horizontal'
								: modalType === 'queue-error'
									? 'queue-error-actions-horizontal'
									: modalType === 'queue-loading'
										? 'queue-loading-actions-horizontal'
										: 'modal-actions-horizontal'
						: modalType === 'friend-warning'
							? 'friend-warning-actions'
							: modalType === 'queue-success'
								? 'queue-success-actions'
								: modalType === 'queue-error'
									? 'queue-error-actions'
									: modalType === 'queue-loading'
										? 'queue-loading-actions'
										: 'modal-actions'}
				>
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
			</div>
		</div>
	</Portal>
{/if}
