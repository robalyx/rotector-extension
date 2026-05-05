// Reads and clears the skipWarning marker so the proceed-after-confirm click bypasses the warning modal
export function consumeSkipWarning(button: HTMLElement): boolean {
	if (button.dataset['skipWarning']) {
		delete button.dataset['skipWarning'];
		return true;
	}
	return false;
}

// Sets skipWarning and clicks so the click handler treats this as a confirmed proceed
export function proceedFriendClick(button: HTMLElement): void {
	button.dataset['skipWarning'] = 'true';
	button.click();
}
