import { writable } from 'svelte/store';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
	type: ToastType;
	message: string;
}

export const toast = writable<Toast | null>(null);

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function clearDismissTimer(): void {
	if (dismissTimer) {
		clearTimeout(dismissTimer);
		dismissTimer = null;
	}
}

function showToast(type: ToastType, message: string): void {
	clearDismissTimer();
	toast.set({ type, message });

	if (type === 'success' || type === 'info') {
		dismissTimer = setTimeout(dismissToast, 3000);
	}
}

export function dismissToast(): void {
	clearDismissTimer();
	toast.set(null);
}

export function showSuccess(message: string): void {
	showToast('success', message);
}

export function showError(message: string): void {
	showToast('error', message);
}

export function showWarning(message: string): void {
	showToast('warning', message);
}
