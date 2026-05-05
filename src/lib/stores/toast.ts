import { writable } from 'svelte/store';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
	type: ToastType;
	message: string;
}

export const toast = writable<Toast | null>(null);

let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(type: ToastType, message: string): void {
	if (dismissTimer) clearTimeout(dismissTimer);
	dismissTimer = null;
	toast.set({ type, message });

	if (type === 'success' || type === 'info') {
		dismissTimer = setTimeout(dismissToast, 3000);
	}
}

export function dismissToast(): void {
	if (dismissTimer) clearTimeout(dismissTimer);
	dismissTimer = null;
	toast.set(null);
}

export function showSuccess(message: string): void {
	showToast('success', message);
}

// Persistent until dismissed, unlike success and info which auto-dismiss after 3 seconds
export function showError(message: string): void {
	showToast('error', message);
}

// Persistent until dismissed, unlike success and info which auto-dismiss after 3 seconds
export function showWarning(message: string): void {
	showToast('warning', message);
}
