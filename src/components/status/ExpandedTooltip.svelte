<script lang="ts">
  import type { UserStatus } from '../../lib/types/api';
  import UserTooltip from './UserTooltip.svelte';

  interface Props {
    userId: string | number;
    status?: UserStatus | null;
    error?: string | null;
    sourceElement: HTMLElement;
    onQueue?: (inappropriateOutfit?: boolean) => void;
    onClose?: () => void;
  }

  let {
    userId,
    status = null,
    error = null,
    sourceElement,
    onQueue,
    onClose
  }: Props = $props();

  let overlayRef = $state<HTMLElement>();
  let tooltipRef = $state<HTMLElement>();

  // Calculate transform-origin based on source element position
  function calculateTransformOrigin() {
    if (!sourceElement) return { originX: 50, originY: 50 };
    
    const sourceRect = sourceElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    const originX = ((sourceRect.left + sourceRect.width / 2) / viewportWidth) * 100;
    const originY = ((sourceRect.top + sourceRect.height / 2) / viewportHeight) * 100;
    
    return { originX, originY };
  }

  // Handle close via overlay click
  function handleOverlayClick(event: MouseEvent | KeyboardEvent) {
    if (event.target === overlayRef && onClose) {
      closeWithAnimation();
    }
  }

  // Handle escape key
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && onClose) {
      closeWithAnimation();
    }
  }

  // Close with animation
  function closeWithAnimation() {
    if (!overlayRef || !tooltipRef || !sourceElement) {
      onClose?.();
      return;
    }

    // Get the transform-origin for animation
    const { originX, originY } = calculateTransformOrigin();

    // Set transform-origin for collapse animation
    tooltipRef.style.setProperty('--tooltip-origin-x', `${originX}%`);
    tooltipRef.style.setProperty('--tooltip-origin-y', `${originY}%`);

    // Start collapse animation
    overlayRef.classList.remove('visible');
    tooltipRef.style.transform = 'translate(-50%, -50%) scale(0.05)';
    tooltipRef.style.opacity = '0';

    // Remove after animation completes
    setTimeout(() => {
      onClose?.();
    }, 350);
  }

  // Handle queue action
  function handleQueueAction(inappropriateOutfit = false) {
    if (onQueue) {
      onQueue(inappropriateOutfit);
    }
    closeWithAnimation();
  }

  $effect(() => {
    // Set initial position and transform-origin based on source element
    if (sourceElement && tooltipRef) {
      const { originX, originY } = calculateTransformOrigin();

      // Set transform-origin for natural expand animation
      tooltipRef.style.setProperty('--tooltip-origin-x', `${originX}%`);
      tooltipRef.style.setProperty('--tooltip-origin-y', `${originY}%`);

      // Start from collapsed state at center position
      tooltipRef.style.top = '50%';
      tooltipRef.style.left = '50%';
      tooltipRef.style.transform = 'translate(-50%, -50%) scale(0.05)';
      tooltipRef.style.opacity = '0';
    }

    // Add event listeners
    document.addEventListener('keydown', handleKeydown);

    // Animate to expanded state
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (overlayRef && tooltipRef) {
          overlayRef.classList.add('visible');
          tooltipRef.style.transform = 'translate(-50%, -50%) scale(1)';
          tooltipRef.style.opacity = '1';
        }
      });
    });

    return () => {
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div
  bind:this={overlayRef}
  class="expanded-tooltip-overlay"
  aria-label="Click to close tooltip"
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
  <div
    bind:this={tooltipRef}
    class="expanded-tooltip"
  >
    <!-- Close button -->
    <button
      class="expanded-tooltip-close"
      aria-label="Close"
      onclick={closeWithAnimation}
    >
      ×
    </button>

    <!-- Tooltip content -->
    <div class="expanded-tooltip-content">
      <UserTooltip
        anchorElement={sourceElement}
        {error}
        isExpanded={true}
        onQueue={handleQueueAction}
        {status}
        {userId}
      />
    </div>
  </div>
</div> 