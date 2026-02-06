<script lang="ts">
	import { onMount } from 'svelte';
	import {
		roblox3DService,
		Roblox3DBlockedError,
		type Roblox3DMetadata
	} from '@/lib/services/roblox-3d-service';
	import { logger } from '@/lib/utils/logger';
	import { vertex, fragment } from '@/lib/shaders/lambert';
	import { AlertCircle, ShieldOff } from 'lucide-svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import type { Program } from 'ogl';

	interface Props {
		outfitId?: number;
		userId?: number;
		width?: number;
		height?: number;
		brightness?: number;
	}

	let { outfitId, userId, width = 120, height = 120, brightness = 1.0 }: Props = $props();

	let canvasContainer: HTMLDivElement;
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let isBlocked = $state(false);

	let orbitControls: { remove: () => void } | null = null;
	let animationFrameId: number | null = null;
	let blobUrls: string[] = [];
	let programs = $state.raw<Program[]>([]);

	onMount(() => {
		void initializeViewer();
		return cleanup;
	});

	// Update brightness uniform across all material programs
	$effect(() => {
		const b = brightness;
		for (const program of programs) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- OGL uniforms are typed as Record<string, any>
			program.uniforms.uBrightness.value = b;
		}
	});

	function cleanup(): void {
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}

		if (orbitControls) {
			orbitControls.remove();
			orbitControls = null;
		}

		programs = [];

		if (canvasContainer) {
			const canvas = canvasContainer.querySelector('canvas');
			if (canvas) canvas.remove();
		}

		for (const url of blobUrls) {
			URL.revokeObjectURL(url);
		}
		blobUrls = [];
	}

	async function initializeViewer(): Promise<void> {
		if (!outfitId && !userId) {
			error = 'No outfit or user ID provided';
			isLoading = false;
			return;
		}

		try {
			const metadata = outfitId
				? await roblox3DService.getOutfit3DData(outfitId)
				: await roblox3DService.getAvatar3DData(userId!);

			if (!canvasContainer?.isConnected) return;

			await loadScene(metadata);
		} catch (err) {
			if (!canvasContainer?.isConnected) return;

			if (err instanceof Roblox3DBlockedError) {
				isBlocked = true;
			} else {
				logger.error('Failed to load 3D viewer:', err);
				error = err instanceof Error ? err.message : 'Failed to load 3D model';
			}
			isLoading = false;
		}
	}

	async function loadScene(metadata: Roblox3DMetadata): Promise<void> {
		const [
			{ Renderer, Camera, Transform, Geometry, Program, Mesh, Texture, Vec3, Orbit },
			{ Mesh: OBJMesh, MaterialLibrary }
		] = await Promise.all([import('ogl'), import('webgl-obj-loader')]);

		if (!canvasContainer?.isConnected) return;

		const renderer = new Renderer({
			width,
			height,
			dpr: Math.min(window.devicePixelRatio, 2),
			antialias: true,
			alpha: true
		});
		const gl = renderer.gl;
		// eslint-disable-next-line svelte/no-dom-manipulating -- OGL requires direct DOM access for its canvas
		canvasContainer.appendChild(gl.canvas);

		const camera = new Camera(gl, {
			fov: metadata.camera.fov,
			aspect: width / height,
			near: 0.1,
			far: 1000
		});
		camera.position.set(
			metadata.camera.position.x,
			metadata.camera.position.y,
			metadata.camera.position.z
		);

		// Bounding box center for camera target and orbit pivot
		const center = new Vec3(
			(metadata.aabb.min.x + metadata.aabb.max.x) / 2,
			(metadata.aabb.min.y + metadata.aabb.max.y) / 2,
			(metadata.aabb.min.z + metadata.aabb.max.z) / 2
		);
		camera.lookAt(center);

		const scene = new Transform();

		const orbit = new Orbit(camera, {
			element: gl.canvas as HTMLElement,
			target: center,
			ease: 0.05,
			enablePan: false,
			minDistance: 5,
			maxDistance: 50
		});
		orbitControls = orbit;

		// Fetch textures as blob URLs
		const textureUrls = metadata.textureHashes.map((hash) => roblox3DService.resolveCdnUrl(hash));
		const textureBlobUrls: Record<string, string> = {};
		await Promise.all(
			metadata.textureHashes.map(async (hash, i) => {
				const response = await fetch(textureUrls[i]);
				if (!response.ok) throw new Error(`Failed to fetch texture: ${response.status}`);
				const blob = await response.blob();
				const blobUrl = URL.createObjectURL(blob);
				blobUrls.push(blobUrl);
				textureBlobUrls[hash] = blobUrl;
			})
		);

		// Fetch and parse MTL with texture hashes
		const mtlUrl = roblox3DService.resolveCdnUrl(metadata.mtlHash);
		const mtlResponse = await fetch(mtlUrl);
		if (!mtlResponse.ok) throw new Error(`Failed to fetch MTL: ${mtlResponse.status}`);
		let mtlContent = await mtlResponse.text();
		for (const [hash, blobUrl] of Object.entries(textureBlobUrls)) {
			mtlContent = mtlContent.split(hash).join(blobUrl);
		}
		const mtlLib = new MaterialLibrary(mtlContent);

		// Fetch and parse OBJ
		const objUrl = roblox3DService.resolveCdnUrl(metadata.objHash);
		const objResponse = await fetch(objUrl);
		if (!objResponse.ok) throw new Error(`Failed to fetch OBJ: ${objResponse.status}`);
		const objContent = await objResponse.text();
		const objMesh = new OBJMesh(objContent);

		if (!canvasContainer?.isConnected) return;

		// Shared vertex data across all material groups
		const positions = new Float32Array(objMesh.vertices);
		const normals = new Float32Array(objMesh.vertexNormals);
		const uvs = new Float32Array(objMesh.textures);

		// Cache loaded textures to avoid duplicating shared textures across materials
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- non-reactive local cache inside async function
		const textureCache = new Map<string, InstanceType<typeof Texture>>();
		async function loadTexture(blobUrl: string): Promise<InstanceType<typeof Texture>> {
			const cached = textureCache.get(blobUrl);
			if (cached) return cached;

			const img = new Image();
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = reject;
				img.src = blobUrl;
			});

			const tex = new Texture(gl, { generateMipmaps: true });
			tex.image = img;
			textureCache.set(blobUrl, tex);
			return tex;
		}

		// Create one Mesh per material group (body parts, accessories, etc.)
		const newPrograms: InstanceType<typeof Program>[] = [];
		for (let i = 0; i < objMesh.materialNames.length; i++) {
			const materialName = objMesh.materialNames[i];
			const indices = objMesh.indicesPerMaterial[i];
			if (!indices || indices.length === 0) continue;

			const material = mtlLib.materials[materialName];

			let diffuseTexture: InstanceType<typeof Texture> | null = null;
			if (material?.mapDiffuse?.filename) {
				diffuseTexture = await loadTexture(material.mapDiffuse.filename);
			}

			const diffuseColor = material?.diffuse || [1, 1, 1];

			const geometry = new Geometry(gl, {
				position: { size: 3, data: positions },
				normal: { size: 3, data: normals },
				uv: { size: 2, data: uvs },
				index: { data: new Uint32Array(indices) }
			});

			const program = new Program(gl, {
				vertex,
				fragment,
				uniforms: {
					tMap: { value: diffuseTexture || new Texture(gl) },
					uHasTexture: { value: !!diffuseTexture },
					uDiffuseColor: { value: diffuseColor },
					uBrightness: { value: brightness }
				},
				transparent: false
			});
			newPrograms.push(program);

			const mesh = new Mesh(gl, { geometry, program });
			mesh.setParent(scene);
		}
		programs = newPrograms;

		isLoading = false;

		function animate(): void {
			animationFrameId = requestAnimationFrame(animate);
			orbit.update();
			renderer.render({ scene, camera });
		}
		animate();
	}
</script>

<div
	bind:this={canvasContainer}
	style:width="{width}px"
	style:height="{height}px"
	class="outfit-3d-viewer"
>
	{#if isLoading}
		<div class="outfit-3d-loading">
			<LoadingSpinner size="small" />
		</div>
	{:else if isBlocked}
		<div class="outfit-3d-blocked">
			<ShieldOff size={24} />
			<span>Moderated</span>
		</div>
	{:else if error}
		<div class="outfit-3d-error">
			<AlertCircle size={16} />
		</div>
	{/if}
</div>
