import { logger } from '../utils/logger';

const ROBLOX_THUMBNAILS_API = 'https://thumbnails.roblox.com';
const RETRY_DELAY_MS = 2000;
const MAX_RETRIES = 5;

/**
 * Calculate the CDN subdomain (t0-t7) from a hash using Roblox's algorithm.
 * XORs each of the first 38 characters with an accumulator starting at 31, then mod 8.
 * The 38 char count accounts for "30DAY-" prefix (6) + hash (32).
 * @see https://devforum.roblox.com/t/roblox-cdn-how-to-work-out-the-hash/2731447
 */
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

interface Roblox3DApiResponse {
	targetId: number;
	state: 'Completed' | 'Pending' | 'Blocked' | 'Error';
	imageUrl: string | null;
	version: string;
}

interface Roblox3DMetadataRaw {
	camera: {
		position: Vector3;
		direction: Vector3;
		fov: number;
	};
	aabb: {
		min: Vector3;
		max: Vector3;
	};
	mtl: string;
	obj: string;
	textures: string[];
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

class Roblox3DService {
	private readonly metadataCache: Map<string, Roblox3DMetadata> = new Map();
	private readonly pendingRequests: Map<string, Promise<Roblox3DMetadata>> = new Map();
	private readonly cdnUrlCache: Map<string, string> = new Map();

	/**
	 * Build CDN URL for a hash using Roblox's subdomain algorithm.
	 */
	resolveCdnUrl(hash: string): string {
		const cached = this.cdnUrlCache.get(hash);
		if (cached) {
			return cached;
		}

		const subdomain = calculateCdnSubdomain(hash);
		const url = `https://t${subdomain}.rbxcdn.com/${hash}`;

		this.cdnUrlCache.set(hash, url);
		return url;
	}

	/**
	 * Fetch 3D metadata for an outfit
	 */
	async getOutfit3DData(outfitId: number): Promise<Roblox3DMetadata> {
		const cacheKey = `outfit:${outfitId}`;
		return this.fetch3DData(
			cacheKey,
			`${ROBLOX_THUMBNAILS_API}/v1/users/outfit-3d?outfitId=${outfitId}`
		);
	}

	/**
	 * Fetch 3D metadata for a user's current avatar
	 */
	async getAvatar3DData(userId: number): Promise<Roblox3DMetadata> {
		const cacheKey = `avatar:${userId}`;
		return this.fetch3DData(
			cacheKey,
			`${ROBLOX_THUMBNAILS_API}/v1/users/avatar-3d?userId=${userId}`
		);
	}

	/**
	 * Fetch 3D data from Roblox API
	 */
	private async fetch3DData(cacheKey: string, apiUrl: string): Promise<Roblox3DMetadata> {
		const cached = this.metadataCache.get(cacheKey);
		if (cached) {
			return cached;
		}

		const pending = this.pendingRequests.get(cacheKey);
		if (pending) {
			return pending;
		}

		const promise = this.fetchAndParse3DData(apiUrl);
		this.pendingRequests.set(cacheKey, promise);

		try {
			const result = await promise;
			this.metadataCache.set(cacheKey, result);
			return result;
		} finally {
			this.pendingRequests.delete(cacheKey);
		}
	}

	/**
	 * Fetch and parse 3D data from Roblox
	 */
	private async fetchAndParse3DData(apiUrl: string): Promise<Roblox3DMetadata> {
		let lastState = '';

		for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
			const response = await fetch(apiUrl);
			if (!response.ok) {
				throw new Error(`Failed to fetch 3D data: ${response.status}`);
			}

			const apiResponse = (await response.json()) as Roblox3DApiResponse;
			lastState = apiResponse.state;

			if (apiResponse.state === 'Completed' && apiResponse.imageUrl) {
				const metadataResponse = await fetch(apiResponse.imageUrl);
				if (!metadataResponse.ok) {
					throw new Error(`Failed to fetch 3D metadata: ${metadataResponse.status}`);
				}

				const metadata = (await metadataResponse.json()) as Roblox3DMetadataRaw;

				logger.debug('Fetched 3D metadata', {
					obj: metadata.obj,
					mtl: metadata.mtl,
					textureCount: metadata.textures.length
				});

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
					`3D data pending, retrying in ${RETRY_DELAY_MS}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
				);
				await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
				continue;
			}

			if (apiResponse.state === 'Blocked') {
				throw new Roblox3DBlockedError();
			}

			throw new Error(`3D data not available: state=${apiResponse.state}`);
		}

		throw new Error(`3D data not available after ${MAX_RETRIES} retries: state=${lastState}`);
	}

	/**
	 * Clear cached 3D data
	 */
	clearCache(): void {
		this.metadataCache.clear();
	}
}

export const roblox3DService = new Roblox3DService();
