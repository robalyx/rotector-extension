<script lang="ts">
	import { onMount } from 'svelte';
	import {
		roblox3DService,
		Roblox3DBlockedError,
		type Roblox3DMetadata
	} from '@/lib/services/roblox-3d-service';
	import { logger } from '@/lib/utils/logger';
	import { AlertCircle, ShieldOff } from 'lucide-svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';

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

	// Store Three.js objects for cleanup
	let scene: { traverse: (cb: (obj: unknown) => void) => void } | null = null;
	let renderer: { dispose: () => void; domElement: HTMLCanvasElement } | null = null;
	let controls: { dispose: () => void } | null = null;
	let animationFrameId: number | null = null;

	// Store light references for brightness control
	type Light = { intensity: number };
	let lights = $state<{ base: number; ref: Light }[]>([]);

	onMount(() => {
		void initializeViewer();
		return cleanup;
	});

	// Update light intensities when brightness changes
	$effect(() => {
		for (const light of lights) {
			light.ref.intensity = light.base * brightness;
		}
	});

	function cleanup(): void {
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}

		if (controls) {
			controls.dispose();
			controls = null;
		}

		lights = [];

		// Dispose all geometries, materials, and textures in the scene
		if (scene) {
			scene.traverse((object: unknown) => {
				const obj = object as {
					geometry?: { dispose: () => void };
					material?:
						| { dispose: () => void; map?: { dispose: () => void } }
						| Array<{ dispose: () => void; map?: { dispose: () => void } }>;
				};
				if (obj.geometry) {
					obj.geometry.dispose();
				}
				if (obj.material) {
					const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
					for (const material of materials) {
						if (material.map) {
							material.map.dispose();
						}
						material.dispose();
					}
				}
			});
			scene = null;
		}

		if (renderer) {
			renderer.dispose();
			if (renderer.domElement.parentElement) {
				renderer.domElement.remove();
			}
			renderer = null;
		}
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

			await loadThreeJS(metadata);
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

	async function loadThreeJS(metadata: Roblox3DMetadata): Promise<void> {
		const THREE = await import('three');
		const { OBJLoader } = await import('three/addons/loaders/OBJLoader.js');
		const { MTLLoader } = await import('three/addons/loaders/MTLLoader.js');
		const { OrbitControls } = await import('three/addons/controls/OrbitControls.js');

		if (!canvasContainer?.isConnected) return;

		const threeScene = new THREE.Scene();
		scene = threeScene;
		threeScene.background = null;

		// Ambient light for overall illumination
		const ambientLight = new THREE.AmbientLight(0xffffff, 1.0 * brightness);
		threeScene.add(ambientLight);

		// Main directional light from front-top
		const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2 * brightness);
		directionalLight.position.set(5, 10, 10);
		threeScene.add(directionalLight);

		// Fill light from left side
		const fillLight = new THREE.DirectionalLight(0xffffff, 0.6 * brightness);
		fillLight.position.set(-10, 5, 5);
		threeScene.add(fillLight);

		// Back light for rim lighting
		const backLight = new THREE.DirectionalLight(0xffffff, 0.4 * brightness);
		backLight.position.set(0, 5, -10);
		threeScene.add(backLight);

		// Store light references for brightness updates
		lights = [
			{ base: 1.0, ref: ambientLight },
			{ base: 1.2, ref: directionalLight },
			{ base: 0.6, ref: fillLight },
			{ base: 0.4, ref: backLight }
		];

		// Camera setup using Roblox metadata
		const camera = new THREE.PerspectiveCamera(metadata.camera.fov, width / height, 0.1, 1000);

		// Calculate center of bounding box for camera target
		const center = new THREE.Vector3(
			(metadata.aabb.min.x + metadata.aabb.max.x) / 2,
			(metadata.aabb.min.y + metadata.aabb.max.y) / 2,
			(metadata.aabb.min.z + metadata.aabb.max.z) / 2
		);

		camera.position.set(
			metadata.camera.position.x,
			metadata.camera.position.y,
			metadata.camera.position.z
		);
		camera.lookAt(center);

		// Renderer
		const webGLRenderer = new THREE.WebGLRenderer({
			antialias: true,
			alpha: true
		});
		webGLRenderer.setSize(width, height);
		webGLRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		// eslint-disable-next-line svelte/no-dom-manipulating -- Three.js requires direct DOM access for its canvas
		canvasContainer.appendChild(webGLRenderer.domElement);
		renderer = webGLRenderer;

		// Orbit controls for rotation/zoom
		const orbitControls = new OrbitControls(camera, webGLRenderer.domElement);
		controls = orbitControls;
		orbitControls.target.copy(center);
		orbitControls.enableDamping = true;
		orbitControls.dampingFactor = 0.05;
		orbitControls.enableZoom = true;
		orbitControls.enablePan = false;
		orbitControls.minDistance = 5;
		orbitControls.maxDistance = 50;
		orbitControls.update();

		// Build CDN URLs
		const mtlUrl = roblox3DService.resolveCdnUrl(metadata.mtlHash);
		const objUrl = roblox3DService.resolveCdnUrl(metadata.objHash);
		const textureUrls = metadata.textureHashes.map((hash) => roblox3DService.resolveCdnUrl(hash));

		// Fetch textures as data URLs
		const textureDataUrls: Record<string, string> = {};
		await Promise.all(
			metadata.textureHashes.map(async (hash, i) => {
				const response = await fetch(textureUrls[i]);
				if (!response.ok) {
					throw new Error(`Failed to fetch texture: ${response.status}`);
				}
				const blob = await response.blob();
				const dataUrl = await new Promise<string>((resolve) => {
					const reader = new FileReader();
					reader.onloadend = () => resolve(reader.result as string);
					reader.readAsDataURL(blob);
				});
				textureDataUrls[hash] = dataUrl;
			})
		);

		// Fetch and parse MTL file
		const mtlResponse = await fetch(mtlUrl);
		if (!mtlResponse.ok) {
			throw new Error(`Failed to fetch MTL: ${mtlResponse.status}`);
		}
		let mtlContent = await mtlResponse.text();
		for (const [hash, dataUrl] of Object.entries(textureDataUrls)) {
			mtlContent = mtlContent.split(hash).join(dataUrl);
		}

		// Parse MTL from text
		const mtlLoader = new MTLLoader();
		const materials = mtlLoader.parse(mtlContent, '');
		materials.preload();

		// Fetch and parse OBJ file
		const objResponse = await fetch(objUrl);
		if (!objResponse.ok) {
			throw new Error(`Failed to fetch OBJ: ${objResponse.status}`);
		}
		const objContent = await objResponse.text();
		const objLoader = new OBJLoader();
		objLoader.setMaterials(materials);
		const object = objLoader.parse(objContent);

		// Fix material transparency
		object.traverse((child) => {
			const mesh = child as {
				isMesh?: boolean;
				material?:
					| { transparent: boolean; opacity: number }
					| Array<{ transparent: boolean; opacity: number }>;
			};
			if (mesh.isMesh && mesh.material) {
				const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
				for (const mat of materials) {
					mat.transparent = false;
					mat.opacity = 1;
				}
			}
		});

		if (!canvasContainer?.isConnected) return;

		threeScene.add(object);

		isLoading = false;

		// Animation loop
		function animate(): void {
			animationFrameId = requestAnimationFrame(animate);
			orbitControls.update();
			webGLRenderer.render(threeScene, camera);
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
