import { getStorage, setStorage } from '@/lib/utils/storage';

const INSTALLATION_ID_KEY = 'installationId';

let cached: Promise<string> | null = null;

export async function getInstallationId(): Promise<string> {
	cached ??= readOrCreate();
	return cached;
}

async function readOrCreate(): Promise<string> {
	const existing = await getStorage<string>('local', INSTALLATION_ID_KEY, '');
	if (existing) return existing;

	const generated = crypto.randomUUID();
	await setStorage('local', INSTALLATION_ID_KEY, generated);
	return generated;
}
