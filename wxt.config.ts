import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// Determine API domain based on build mode
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('dev');
const apiDomain = isDev ? 'dev-roscoe.robalyx.com' : 'roscoe.robalyx.com';

// See https://wxt.dev/api/config.html
export default defineConfig({
	srcDir: 'src',
	manifestVersion: 3,
	modules: ['@wxt-dev/module-svelte'],
	vite: () => ({
		plugins: [tailwindcss()],
		define: {
			'import.meta.env.USE_DEV_API': JSON.stringify(isDev ? 'true' : 'false')
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
		version: '2.5.1',
		permissions: ['storage'],
		host_permissions: [`https://${apiDomain}/*`],
		optional_host_permissions: ['https://*/*', 'https://translate.googleapis.com/*'],
		externally_connectable: {
			matches: [`https://${apiDomain}/*`]
		},
		web_accessible_resources: [
			{
				resources: ['assets/*', 'locales/*/*'],
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
