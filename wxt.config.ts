import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

// Determine API domain based on build mode
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('dev');
const apiDomain = isDev ? 'roscoe-dev.rotector.com' : 'roscoe.rotector.com';

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
		resolve: {
			alias: {
				// The minified build uses webpack eval() which violates MV3 CSP
				'webgl-obj-loader': 'webgl-obj-loader/dist/webgl-obj-loader.js'
			}
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
				usePolling: true,
				interval: 1000,
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
	manifest: ({ browser }) => ({
		name: '__MSG_extensionName__',
		description: '__MSG_extensionDescription__',
		default_locale: 'en',
		version: '2.16.0',
		permissions: ['storage', 'notifications'],
		host_permissions: [`https://${apiDomain}/*`, 'https://cdn.rotector.com/*'],
		optional_host_permissions: ['https://*/*', 'https://translate.googleapis.com/*'],
		...(browser !== 'firefox' && {
			externally_connectable: {
				matches: [`https://${apiDomain}/*`]
			}
		}),
		web_accessible_resources: [
			{
				resources: ['assets/*', 'icon/*', 'locales/*/*', 'content-scripts/content.css'],
				matches: ['https://*.roblox.com/*']
			}
		],
		...(browser === 'firefox' && {
			browser_specific_settings: {
				gecko: {
					id: 'rotector@jaxron.me'
				}
			}
		})
	})
});
