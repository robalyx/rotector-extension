import { writable, derived } from 'svelte/store';
import { logger } from '../utils/logger';

interface TooltipInstance {
  id: string;
  type: 'preview' | 'expanded';
  userId: string;
  element: HTMLElement;
  priority: number;
  timestamp: number;
}

interface TooltipPosition {
  x: number;
  y: number;
}

class TooltipManager {
  private static instance: TooltipManager;
  private activeTooltips = new Map<string, TooltipInstance>();
  private tooltipStore = writable<TooltipInstance | null>(null);
  private expandedTooltipStore = writable<TooltipInstance | null>(null);
  private positionStore = writable<TooltipPosition>({ x: 0, y: 0 });
  private escapeListener: ((event: KeyboardEvent) => void) | null = null;

  // Public stores for components to subscribe to
  public readonly activeTooltip = derived(this.tooltipStore, ($store) => $store);
  public readonly activeExpandedTooltip = derived(this.expandedTooltipStore, ($store) => $store);
  public readonly tooltipPosition = derived(this.positionStore, ($store) => $store);

  private constructor() {
    this.setupEscapeListener();
  }

  public static getInstance(): TooltipManager {
    if (!TooltipManager.instance) {
      TooltipManager.instance = new TooltipManager();
    }
    return TooltipManager.instance;
  }

  // Register a tooltip instance
  public register(tooltip: Omit<TooltipInstance, 'timestamp'>): string {
    const instance: TooltipInstance = {
      ...tooltip,
      timestamp: Date.now()
    };

    // If this is a preview tooltip, hide any existing preview tooltips
    if (tooltip.type === 'preview') {
      this.hideAllPreviews();
    }

    // If this is an expanded tooltip, hide any existing expanded tooltips
    if (tooltip.type === 'expanded') {
      this.hideAllExpanded();
    }

    this.activeTooltips.set(tooltip.id, instance);
    
    if (tooltip.type === 'preview') {
      this.tooltipStore.set(instance);
    } else {
      this.expandedTooltipStore.set(instance);
    }

    logger.info('TooltipManager', 'Tooltip registered', { 
      id: tooltip.id, 
      type: tooltip.type,
      userId: tooltip.userId 
    });

    return tooltip.id;
  }

  // Unregister a tooltip
  public unregister(id: string): void {
    const tooltip = this.activeTooltips.get(id);
    if (!tooltip) return;

    this.activeTooltips.delete(id);

    // Update stores if this was the active tooltip
    if (tooltip.type === 'preview') {
      const currentActive = this.getCurrentPreview();
      if (currentActive?.id === id) {
        this.tooltipStore.set(null);
      }
    } else {
      const currentExpanded = this.getCurrentExpanded();
      if (currentExpanded?.id === id) {
        this.expandedTooltipStore.set(null);
      }
    }

    logger.info('TooltipManager', 'Tooltip unregistered', { id });
  }

  // Show a specific tooltip
  public show(id: string): void {
    const tooltip = this.activeTooltips.get(id);
    if (!tooltip) return;

    if (tooltip.type === 'preview') {
      this.hideAllPreviews();
      this.tooltipStore.set(tooltip);
    } else {
      this.hideAllExpanded();
      this.expandedTooltipStore.set(tooltip);
    }
  }

  // Hide a specific tooltip
  public hide(id: string): void {
    const tooltip = this.activeTooltips.get(id);
    if (!tooltip) return;

    if (tooltip.type === 'preview') {
      const current = this.getCurrentPreview();
      if (current?.id === id) {
        this.tooltipStore.set(null);
      }
    } else {
      const current = this.getCurrentExpanded();
      if (current?.id === id) {
        this.expandedTooltipStore.set(null);
      }
    }
  }

  // Hide all preview tooltips
  public hideAllPreviews(): void {
    this.tooltipStore.set(null);
    logger.info('TooltipManager', 'All preview tooltips hidden');
  }

  // Hide all expanded tooltips
  public hideAllExpanded(): void {
    this.expandedTooltipStore.set(null);
    logger.info('TooltipManager', 'All expanded tooltips hidden');
  }

  // Get current preview tooltip
  public getCurrentPreview(): TooltipInstance | null {
    let current: TooltipInstance | null = null;
    this.tooltipStore.subscribe(value => {
      current = value;
    })();
    return current;
  }

  // Get current expanded tooltip
  public getCurrentExpanded(): TooltipInstance | null {
    let current: TooltipInstance | null = null;
    this.expandedTooltipStore.subscribe(value => {
      current = value;
    })();
    return current;
  }

  /**
   * Cleanup all tooltips and listeners
   */
  public cleanup(): void {
    this.hideAllPreviews();
    this.hideAllExpanded();
    this.activeTooltips.clear();
    this.removeEscapeListener();
    logger.info('TooltipManager', 'Cleaned up');
  }

  private setupEscapeListener(): void {
    this.escapeListener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // First try to close expanded tooltip, then preview
        if (this.getCurrentExpanded()) {
          this.hideAllExpanded();
        } else if (this.getCurrentPreview()) {
          this.hideAllPreviews();
        }
      }
    };

    document.addEventListener('keydown', this.escapeListener);
  }

  private removeEscapeListener(): void {
    if (this.escapeListener) {
      document.removeEventListener('keydown', this.escapeListener);
      this.escapeListener = null;
    }
  }
}

export const tooltipManager = TooltipManager.getInstance();