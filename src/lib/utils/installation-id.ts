import { getStorage, setStorage } from '@/lib/utils/storage';

const INSTALLATION_ID_KEY = 'installationId';

let cached: Promise<string> | null = null;

export async function getInstallationId(): Promise<string> {
	cached ??= readOrCreate();
	return cached;
}

async function readOrCreate(): Promise<string> {
	const synced = await getStorage<string>('sync', INSTALLATION_ID_KEY, '');
	if (synced) {
		await setStorage('local', INSTALLATION_ID_KEY, synced);
		return synced;
	}

	const local = await getStorage<string>('local', INSTALLATION_ID_KEY, '');
	if (local) {
		await setStorage('sync', INSTALLATION_ID_KEY, local);
		return local;
	}

	const generated = crypto.randomUUID();
	await setStorage('sync', INSTALLATION_ID_KEY, generated);
	await setStorage('local', INSTALLATION_ID_KEY, generated);
	return generated;
}
