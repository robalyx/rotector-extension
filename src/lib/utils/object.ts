// Safe own-property check that ignores Object.prototype members
export function hasOwn(obj: object, key: string): boolean {
	return Object.prototype.hasOwnProperty.call(obj, key);
}
