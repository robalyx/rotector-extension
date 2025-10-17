<script lang="ts">
    import Portal from 'svelte-portal';
    import {AlertCircle, AlertTriangle, X} from 'lucide-svelte';

    interface ModalProps {
        isOpen: boolean;
        onClose?: () => void;
        title: string;
        confirmText?: string;
        cancelText?: string;
        blockText?: string;
        showCancel?: boolean;
        showBlock?: boolean;
        confirmVariant?: 'primary' | 'danger' | 'queue';
        confirmDisabled?: boolean;
        onConfirm?: () => void;
        onCancel?: () => void;
        onBlock?: () => void;
        icon?: string;
        actionsLayout?: 'horizontal' | 'vertical';
        size?: 'normal' | 'small';
        modalType?: 'mature-content' | 'friend-warning' | 'queue-success' | 'queue-error';
        children: import("svelte").Snippet;
    }

    let {
        isOpen = $bindable(),
        onClose,
        title,
        confirmText = "Confirm",
        cancelText = "Cancel",
        blockText = "Block User",
        showCancel = true,
        showBlock = false,
        confirmVariant = 'primary',
        confirmDisabled = false,
        onConfirm,
        onCancel,
        onBlock,
        icon,
        actionsLayout = 'vertical',
        size = 'normal',
        modalType = 'mature-content',
        children,
    }: ModalProps = $props();

    let isClosing = $state(false);
    let overlayElement = $state<HTMLDivElement>();

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
        }, 300);
    }

    function handleEscape(e: KeyboardEvent) {
        if (e.key === "Escape" && isOpen) {
            closeModal(false);
        }
    }

    function handleOverlayClick(e: MouseEvent | KeyboardEvent) {
        if (e.target === overlayElement) {
            closeModal(false);
        }
    }

    $effect(() => {
        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            // Show popup with animation
            requestAnimationFrame(() => {
                if (overlayElement) {
                    overlayElement.classList.add("visible");
                }
            });
            return () => document.removeEventListener("keydown", handleEscape);
        }
        return () => {}; // No-op cleanup for when isOpen is false
    });
</script>

{#if isOpen}
  <Portal target="body">
    <div
        bind:this={overlayElement}
        class={modalType === 'friend-warning' ? 'friend-warning-overlay' :
             modalType === 'queue-success' ? 'queue-success-overlay' :
             modalType === 'queue-error' ? 'queue-error-overlay' : `
               mature-content-overlay
             `}
        class:closing={isClosing}
        aria-label="Click to close modal"
        onclick={handleOverlayClick}
        onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOverlayClick(e);
        }
      }}
        role="button"
        tabindex="0"
    >
      <div class={size === 'small' ?
        (modalType === 'friend-warning' ? 'friend-warning-popup-small' : 
         modalType === 'queue-success' ? 'queue-success-popup-small' :
         modalType === 'queue-error' ? 'queue-error-popup-small' : `
           mature-content-popup-small
         `) : 
        (modalType === 'friend-warning' ? 'friend-warning-popup' : 
         modalType === 'queue-success' ? 'queue-success-popup' :
         modalType === 'queue-error' ? 'queue-error-popup' : `
           mature-content-popup
         `)}>
        <div class={modalType === 'friend-warning' ? 'friend-warning-header' :
                    modalType === 'queue-success' ? 'queue-success-header' :
                    modalType === 'queue-error' ? 'queue-error-header' : `
                      mature-content-header
                    `}>
          {#if icon}
            <div class="mr-2 flex items-center">
              {#if icon === 'warning'}
                {#if modalType === 'friend-warning'}
                  <AlertTriangle class="friend-warning-icon" color="#f44336" size={32} />
                {:else}
                  <AlertCircle class="mature-content-warning-icon" color="#ff9800" size={32} />
                {/if}
              {:else}
                <div class="text-2xl">{icon}</div>
              {/if}
            </div>
          {/if}
          <h3 class={modalType === 'friend-warning' ? 'friend-warning-title' :
                     modalType === 'queue-success' ? 'queue-success-title' :
                     modalType === 'queue-error' ? 'queue-error-title' : `
                       mature-content-title
                     `}>{title}</h3>
          <button
              class="modal-close"
              onclick={() => closeModal(false)}
              type="button"
          >
            <X color="var(--color-error)" size={24} />
          </button>
        </div>

        <div class={size === 'small' ?
          (modalType === 'friend-warning' ? 'friend-warning-content-small' : 
           modalType === 'queue-success' ? 'queue-success-content-small' :
           modalType === 'queue-error' ? 'queue-error-content-small' : `
             mature-content-content-small
           `) : 
          (modalType === 'friend-warning' ? 'friend-warning-content' : 
           modalType === 'queue-success' ? 'queue-success-content' :
           modalType === 'queue-error' ? 'queue-error-content' : `
             mature-content-content
           `)}>
          {@render children()}
        </div>

        <div class={actionsLayout === 'horizontal' ?
          (modalType === 'friend-warning' ? 'friend-warning-actions-horizontal' : 
           modalType === 'queue-success' ? 'queue-success-actions-horizontal' :
           modalType === 'queue-error' ? 'queue-error-actions-horizontal' : `
             modal-actions-horizontal
           `) : 
          (modalType === 'friend-warning' ? 'friend-warning-actions' : 
           modalType === 'queue-success' ? 'queue-success-actions' :
           modalType === 'queue-error' ? 'queue-error-actions' : `
             mature-content-actions
           `)}>
          {#if showBlock}
            <button
                class={modalType === 'friend-warning' ? 'friend-warning-block' : `
                  mature-content-block mature-content-cancel
                `}
                onclick={() => closeModal('block')}
                type="button"
            >
              {blockText}
            </button>
          {/if}
          {#if showCancel}
            <button
                class={modalType === 'friend-warning' ? 'friend-warning-cancel' : `
                  mature-content-cancel
                `}
                onclick={() => closeModal(false)}
                type="button"
            >
              {cancelText}
            </button>
          {/if}
          <button
              class={modalType === 'friend-warning' ? 'friend-warning-confirm' : `
                mature-content-confirm
              `}
              class:friend-warning-confirm-danger={modalType === 'friend-warning' && confirmVariant === 'danger'}
              class:mature-content-confirm-danger={modalType === 'mature-content' && confirmVariant === 'danger'}
              class:mature-content-confirm-queue={modalType === 'mature-content' && confirmVariant === 'queue'}
              disabled={confirmDisabled}
              onclick={() => closeModal(true)}
              type="button"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  </Portal>
{/if}
