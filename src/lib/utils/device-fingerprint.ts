import { getStorage, setStorage } from '@/lib/utils/storage';

// X-Device-FP is a coarse, hashed device signal the extension sends alongside an
// installation identifier to prevent abuse of the service. It lets our backend
// recognize a returning client so abuse and ban evasion can be caught. It is never
// used for analytics, advertising, personalization, or any purpose unrelated to
// security, it is sent only to our own backend and nowhere else, and full details
// are in the privacy policy at https://rotector.com/privacy.
//
// Why it is allowed
//   - Chrome Web Store Limited Use permits user data necessary for security
//     purposes such as investigating abuse
//     https://developer.chrome.com/docs/webstore/program-policies/limited-use
//   - GDPR treats fraud and abuse prevention as a legitimate interest that does
//     not rely on opt in consent the way tracking or ads would
//     https://gdpr-info.eu/recitals/no-47/
//   - ePrivacy allows access to device data that is strictly necessary, which
//     covers abuse prevention rather than tracking
//     https://eur-lex.europa.eu/eli/dir/2002/58/oj
//   - Firefox wants the data declared and consented, handled by the
//     data_collection_permissions entry in wxt.config.ts and the onboarding gate
//     https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/
//
// The signal is kept coarse and stable on purpose. It favors a value that stays the
// same for a device over one that is highly unique, it leans on hardware traits a
// user cannot change from settings, and it deliberately avoids the invasive canvas
// and audio probing that privacy law and privacy focused browsers push back on.
// Everything is hashed on the device, so only an opaque value ever leaves the
// browser. Because Rotector is a child-safety tool that may be accessed by minors,
// we treat data minimization as the binding constraint and keep this signal no more
// detailed than abuse prevention requires.

const DEVICE_FINGERPRINT_KEY = 'deviceFingerprint';

declare global {
	interface Navigator {
		readonly deviceMemory?: number;
	}
}

function readWebglSignature(): string {
	const canvas = document.createElement('canvas');
	const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
	if (!(gl instanceof WebGLRenderingContext)) return '';

	const info = gl.getExtension('WEBGL_debug_renderer_info');
	const extensions = gl.getSupportedExtensions() ?? [];
	const highFloat = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);

	return [
		info ? String(gl.getParameter(info.UNMASKED_VENDOR_WEBGL)) : '',
		info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '',
		String(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
		String(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE)),
		String(gl.getParameter(gl.MAX_VERTEX_ATTRIBS)),
		String(gl.getParameter(gl.MAX_VIEWPORT_DIMS)),
		highFloat ? [highFloat.precision, highFloat.rangeMin, highFloat.rangeMax].join(',') : '',
		extensions.toSorted().join(',')
	].join('~');
}

function readColorGamut(): string {
	return (
		['rec2020', 'p3', 'srgb'].find(
			(gamut) => globalThis.matchMedia(`(color-gamut: ${gamut})`).matches
		) ?? ''
	);
}

function collectStableSignals(): string {
	const nav = globalThis.navigator;
	const scr = globalThis.screen;
	return [
		readWebglSignature(),
		String(nav.deviceMemory ?? ''),
		String(nav.maxTouchPoints),
		[scr.width, scr.height, scr.colorDepth].join('x'),
		String(globalThis.devicePixelRatio),
		readColorGamut()
	].join('|');
}

async function sha256Hex(input: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function computeAndCacheDeviceFingerprint(): Promise<string> {
	const fingerprint = await sha256Hex(collectStableSignals());
	await setStorage('sync', DEVICE_FINGERPRINT_KEY, fingerprint);
	await setStorage('local', DEVICE_FINGERPRINT_KEY, fingerprint);
	return fingerprint;
}

export async function getCachedDeviceFingerprint(): Promise<string> {
	const local = await getStorage<string>('local', DEVICE_FINGERPRINT_KEY, '');
	if (local) return local;
	return getStorage<string>('sync', DEVICE_FINGERPRINT_KEY, '');
}
