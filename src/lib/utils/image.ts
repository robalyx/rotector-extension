// Fetch an image URL and encode as a base64 data URL
// Chunks the buffer through String.fromCharCode to dodge stack overflows
// on large images that would otherwise blow `apply()`
export async function fetchImageAsDataUrl(url: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Image fetch failed with status ${String(response.status)}`);
	}

	const buffer = await response.arrayBuffer();
	const bytes = new Uint8Array(buffer);

	const chunkSize = 0x80_00;
	let binary = '';
	for (let i = 0; i < bytes.length; i += chunkSize) {
		const chunk = bytes.subarray(i, i + chunkSize);
		binary += String.fromCharCode(...chunk);
	}

	return `data:image/webp;base64,${btoa(binary)}`;
}
