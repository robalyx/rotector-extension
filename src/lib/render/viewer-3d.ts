import { ROBLOX_API } from '../types/constants';
import { logger } from '../utils/logging/logger';
import { DedupeCache } from '../utils/caching/dedupe-cache';
import { parseRoblox3DApiResponse, parseRoblox3DMetadataRaw } from '../schemas/roblox-api';

const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 5;

// XOR the first 38 chars (= "30DAY-" prefix + 32-char hash) with an accumulator
// starting at 31, then mod 8. Roblox's algorithm, see
// https://devforum.roblox.com/t/roblox-cdn-how-to-work-out-the-hash/2731447
function calculateCdnSubdomain(hash: string): number {
	let value = 31;
	const length = Math.min(hash.length, 38);
	for (let i = 0; i < length; i++) {
		value ^= hash.charCodeAt(i);
	}
	return value % 8;
}

export class Roblox3DBlockedError extends Error {
	constructor() {
		super('Outfit is moderated');
		this.name = 'Roblox3DBlockedError';
	}
}

interface Vector3 {
	x: number;
	y: number;
	z: number;
}

export interface Roblox3DMetadata {
	camera: {
		position: Vector3;
		direction: Vector3;
		fov: number;
	};
	aabb: {
		min: Vector3;
		max: Vector3;
	};
	mtlHash: string;
	objHash: string;
	textureHashes: string[];
}

const metadataCache = new DedupeCache<string, Roblox3DMetadata>(() => Infinity);

export function resolveCdnUrl(hash: string): string {
	return `https://t${String(calculateCdnSubdomain(hash))}.rbxcdn.com/${hash}`;
}

export async function getOutfit3DData(outfitId: number): Promise<Roblox3DMetadata> {
	const cacheKey = `outfit:${String(outfitId)}`;
	return metadataCache.get(cacheKey, () =>
		fetchAndParse3DData(`${ROBLOX_API.THUMBNAILS}/v1/users/outfit-3d?outfitId=${String(outfitId)}`)
	);
}

export async function getAvatar3DData(userId: number): Promise<Roblox3DMetadata> {
	const cacheKey = `avatar:${String(userId)}`;
	return metadataCache.get(cacheKey, () =>
		fetchAndParse3DData(`${ROBLOX_API.THUMBNAILS}/v1/users/avatar-3d?userId=${String(userId)}`)
	);
}

// Polls the thumbnail API up to MAX_RETRIES while Pending, throws Roblox3DBlockedError on Blocked
async function fetchAndParse3DData(apiUrl: string): Promise<Roblox3DMetadata> {
	let lastState = '';

	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		const response = await fetch(apiUrl, {
			credentials: 'include'
		});
		if (!response.ok) {
			throw new Error(`Failed to fetch 3D data: ${String(response.status)}`);
		}

		const apiResponse = parseRoblox3DApiResponse(await response.json());
		lastState = apiResponse.state;

		if (apiResponse.state === 'Completed' && apiResponse.imageUrl) {
			const metadataResponse = await fetch(apiResponse.imageUrl);
			if (!metadataResponse.ok) {
				throw new Error(`Failed to fetch 3D metadata: ${String(metadataResponse.status)}`);
			}

			const metadata = parseRoblox3DMetadataRaw(await metadataResponse.json());

			return {
				camera: metadata.camera,
				aabb: metadata.aabb,
				mtlHash: metadata.mtl,
				objHash: metadata.obj,
				textureHashes: metadata.textures
			};
		}

		if (apiResponse.state === 'Pending') {
			logger.debug(
				`3D data pending, retrying in ${String(RETRY_DELAY_MS)}ms (attempt ${String(attempt + 1)}/${String(MAX_RETRIES)})`
			);
			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
			continue;
		}

		if (apiResponse.state === 'Blocked') {
			throw new Roblox3DBlockedError();
		}

		throw new Error(`3D data not available: state=${apiResponse.state}`);
	}

	throw new Error(`3D data not available after ${String(MAX_RETRIES)} retries: state=${lastState}`);
}
