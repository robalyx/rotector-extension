import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import { config as loadEnv } from 'dotenv';

loadEnv();

// Determine API domain based on environment variable
const useDevApi = process.env.USE_DEV_API === 'true';
const apiDomain = useDevApi ? 'dev-roscoe.robalyx.com' : 'roscoe.robalyx.com';

// See https://wxt.dev/api/config.html
export default defineConfig({
	srcDir: 'src',
	modules: ['@wxt-dev/module-svelte'],
	vite: () => ({
		plugins: [tailwindcss()],
		define: {
			'import.meta.env.USE_DEV_API': JSON.stringify(process.env.USE_DEV_API ?? 'false')
		},
		build: {
			cssMinify: 'lightningcss'
		},
		css: {
			lightningcss: {
				targets: {
					chrome: 128,
					firefox: 129,
					edge: 128
				}
			}
		},
		server: {
			watch: {
				ignored: [
					'**/node_modules/**',
					'**/.git/**',
					'**/dist/**',
					'**/.wxt/**',
					'**/.output/**',
					'**/bun.lock',
					'**/.env',
					'**/.env.example',
					'**/web-ext.config.ts',
					'**/*.md',
					'**/docs/**',
					'**/assets/**'
				]
			}
		}
	}),
	manifest: {
		name: 'Rotector - Roblox Safety Warnings',
		description:
			'Real-time warnings about inappropriate Roblox users before you interact with them.',
		version: '2.4.0',
		permissions: ['storage'],
		host_permissions: ['https://*.roblox.com/*', `https://${apiDomain}/*`],
		externally_connectable: {
			matches: [`https://${apiDomain}/*`]
		},
		web_accessible_resources: [
			{
				resources: ['assets/*'],
				matches: ['https://*.roblox.com/*']
			}
		],
		browser_specific_settings: {
			gecko: {
				id: 'rotector@jaxron.me'
			}
		}
	}
});
