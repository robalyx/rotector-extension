<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getAvatar3DData,
		getOutfit3DData,
		resolveCdnUrl,
		Roblox3DBlockedError,
		type Roblox3DMetadata
	} from '@/lib/render/viewer-3d';
	import { logger } from '@/lib/utils/logging/logger';
	import { vertex, fragment } from '@/lib/render/lambert-shader';
	import { CircleAlert, ShieldOff } from '@lucide/svelte';
	import LoadingSpinner from '../../ui/LoadingSpinner.svelte';
	import type { Geometry, Program, Texture } from 'ogl';

	interface Props {
		outfitId?: number | undefined;
		userId?: number | undefined;
		width?: number;
		height?: number;
		brightness?: number;
	}

	let { outfitId, userId, width = 120, height = 120, brightness = 1 }: Props = $props();

	let canvasContainer: HTMLDivElement;
	let isLoading = $state(true);
	let hasError = $state(false);
	let isBlocked = $state(false);

	let orbitControls: { remove: () => void } | null = null;
	let animationFrameId: number | null = null;
	let blobUrls: string[] = [];
	let programs = $state.raw<Program[]>([]);
	let geometries: Geometry[] = [];
	let textures: Texture[] = [];
	let glRef: WebGL2RenderingContext | WebGLRenderingContext | null = null;

	onMount(() => {
		void initializeViewer();
		return cleanup;
	});

	$effect(() => {
		const b = brightness;
		for (const program of programs) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- OGL uniforms are typed as Record<string, any>
			program.uniforms['uBrightness'].value = b;
		}
	});

	function cleanup(): void {
		if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
		if (orbitControls) orbitControls.remove();

		// Free GPU resources before dropping references because OGL does not register finalizers
		for (const program of programs) program.remove();
		for (const geometry of geometries) geometry.remove();
		if (glRef) for (const tex of textures) glRef.deleteTexture(tex.texture);
		programs = [];
		geometries = [];
		textures = [];

		const canvas = canvasContainer.querySelector('canvas');
		if (canvas) canvas.remove();

		glRef?.getExtension('WEBGL_lose_context')?.loseContext();

		for (const url of blobUrls) URL.revokeObjectURL(url);
		blobUrls = [];
	}

	async function initializeViewer(): Promise<void> {
		try {
			let metadata: Roblox3DMetadata;
			if (outfitId) {
				metadata = await getOutfit3DData(outfitId);
			} else if (userId) {
				metadata = await getAvatar3DData(userId);
			} else {
				hasError = true;
				isLoading = false;
				return;
			}

			if (!canvasContainer.isConnected) return;

			await loadScene(metadata);
		} catch (error) {
			if (!canvasContainer.isConnected) return;

			if (error instanceof Roblox3DBlockedError) {
				isBlocked = true;
			} else {
				logger.error('Failed to load 3D viewer:', error);
				hasError = true;
			}
			isLoading = false;
		}
	}

	// Fetches OBJ and MTL via blob URLs, strips Roblox non-standard directives, and builds one mesh per material group
	async function loadScene(metadata: Roblox3DMetadata): Promise<void> {
		const [
			{ Renderer, Camera, Transform, Geometry, Program, Mesh, Texture, Vec3, Orbit },
			{ Mesh: OBJMesh, MaterialLibrary }
		] = await Promise.all([import('ogl'), import('webgl-obj-loader')]);

		if (!canvasContainer.isConnected) return;

		const renderer = new Renderer({
			width,
			height,
			dpr: Math.min(window.devicePixelRatio, 2),
			antialias: true,
			alpha: true
		});
		const gl = renderer.gl;
		glRef = gl;
		// eslint-disable-next-line svelte/no-dom-manipulating -- OGL requires direct DOM access for its canvas
		canvasContainer.append(gl.canvas);

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

		const center = new Vec3(
			(metadata.aabb.min.x + metadata.aabb.max.x) / 2,
			(metadata.aabb.min.y + metadata.aabb.max.y) / 2,
			(metadata.aabb.min.z + metadata.aabb.max.z) / 2
		);
		camera.lookAt(center);

		const scene = new Transform();

		const orbit = new Orbit(camera, {
			element: gl.canvas,
			target: center,
			ease: 0.05,
			enablePan: false,
			minDistance: 5,
			maxDistance: 50
		});
		orbitControls = orbit;

		const textureUrls = metadata.textureHashes.map((hash) => resolveCdnUrl(hash));
		const textureBlobUrls: Record<string, string> = {};
		await Promise.all(
			metadata.textureHashes.map(async (hash, i) => {
				const url = textureUrls[i];
				if (!url) throw new Error(`Missing texture URL at index ${String(i)}`);
				const response = await fetch(url);
				if (!response.ok) throw new Error(`Failed to fetch texture: ${String(response.status)}`);
				const blob = await response.blob();
				const blobUrl = URL.createObjectURL(blob);
				blobUrls.push(blobUrl);
				textureBlobUrls[hash] = blobUrl;
			})
		);

		const mtlUrl = resolveCdnUrl(metadata.mtlHash);
		const mtlResponse = await fetch(mtlUrl);
		if (!mtlResponse.ok) throw new Error(`Failed to fetch MTL: ${String(mtlResponse.status)}`);
		let mtlContent = await mtlResponse.text();
		for (const [hash, blobUrl] of Object.entries(textureBlobUrls)) {
			mtlContent = mtlContent.split(hash).join(blobUrl);
		}

		// Roblox MTL includes non-standard "Material" directive
		mtlContent = mtlContent.replaceAll(/^Material .+$/gm, '');
		const mtlLib = new MaterialLibrary(mtlContent);

		const objUrl = resolveCdnUrl(metadata.objHash);
		const objResponse = await fetch(objUrl);
		if (!objResponse.ok) throw new Error(`Failed to fetch OBJ: ${String(objResponse.status)}`);
		let objContent = await objResponse.text();

		// Roblox OBJ includes vertex colors (v x y z r g b a), keep only position
		objContent = objContent.replaceAll(/^(v\s+\S+\s+\S+\s+\S+)\s.+$/gm, '$1');

		const objMesh = new OBJMesh(objContent);

		// The component may unmount during the awaits above so re-check before touching DOM
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- isConnected can change across awaits
		if (!canvasContainer.isConnected) return;

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
				img.addEventListener('load', () => resolve());
				img.addEventListener('error', reject);
				img.src = blobUrl;
			});

			const tex = new Texture(gl, { generateMipmaps: true });
			tex.image = img;
			textureCache.set(blobUrl, tex);
			textures.push(tex);
			return tex;
		}

		const newPrograms: InstanceType<typeof Program>[] = [];
		for (let i = 0; i < objMesh.materialNames.length; i++) {
			const materialName = objMesh.materialNames[i];
			const indices = objMesh.indicesPerMaterial[i];
			if (!indices || indices.length === 0 || materialName === undefined) continue;

			const material = mtlLib.materials[materialName];

			let diffuseTexture: InstanceType<typeof Texture> | null = null;
			if (material?.mapDiffuse.filename) {
				diffuseTexture = await loadTexture(material.mapDiffuse.filename);
			}

			const diffuseColor = material?.diffuse ?? [1, 1, 1];

			const geometry = new Geometry(gl, {
				position: { size: 3, data: positions },
				normal: { size: 3, data: normals },
				uv: { size: 2, data: uvs },
				index: { data: new Uint32Array(indices) }
			});
			geometries.push(geometry);

			let placeholderTexture: InstanceType<typeof Texture> | null = null;
			if (!diffuseTexture) {
				placeholderTexture = new Texture(gl);
				textures.push(placeholderTexture);
			}

			const program = new Program(gl, {
				vertex,
				fragment,
				uniforms: {
					tMap: { value: diffuseTexture ?? placeholderTexture },
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
	{:else if hasError}
		<div class="outfit-3d-error">
			<CircleAlert size={16} />
		</div>
	{/if}
</div>
