import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

const isDev = process.env['NODE_ENV'] === 'development' || process.argv.includes('dev');
const apiDomain = isDev ? 'roscoe-dev.rotector.com' : 'roscoe.rotector.com';

// See https://wxt.dev/api/config.html
export default defineConfig({
	srcDir: 'src',
	manifestVersion: 3,
	modules: ['@wxt-dev/module-svelte'],
	vite: () => ({
		plugins: [
			tailwindcss(),
			{
				// Chrome refuses to load content scripts containing Unicode non-characters
				// ("It isn't UTF-8 encoded") as some deps ship them raw inside regex literals
				// (e.g. https://github.com/zumerlab/snapdom/issues/432), so re-escape them in
				// emitted chunks.
				name: 'escape-unicode-non-characters',
				generateBundle(_options, bundle) {
					for (const chunk of Object.values(bundle)) {
						if (chunk.type === 'chunk') {
							chunk.code = chunk.code.replaceAll(
								/[\uFDD0-\uFDEF\uFFFE\uFFFF]/g,
								(ch) => `\\u${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`
							);
						}
					}
				}
			}
		],
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
				usePolling: process.env['WXT_USE_POLLING'] === '1',
				...(process.env['WXT_USE_POLLING'] === '1' ? { interval: 1000 } : {}),
				ignored: ['**/.git/**', '**/.output/**', '**/.wxt/**', '**/bun.lock', '**/docs/**']
			}
		}
	}),
	manifest: ({ browser, manifestVersion }) => {
		const optionalHosts = ['https://*/*', 'https://translate.googleapis.com/*'];
		const robloxFetch = browser === 'firefox' ? ['https://*.roblox.com/*'] : [];
		return {
			name: '__MSG_extensionName__',
			description: '__MSG_extensionDescription__',
			default_locale: 'en',
			version: '2.17.1',
			minimum_chrome_version: '128',
			permissions: ['storage', 'notifications', ...robloxFetch],
			host_permissions: [`https://${apiDomain}/*`, 'https://cdn.rotector.com/*'],
			...(manifestVersion === 2
				? { optional_permissions: optionalHosts }
				: { optional_host_permissions: optionalHosts }),
			...(browser !== 'firefox' && {
				externally_connectable: {
					matches: [`https://${apiDomain}/*`]
				}
			}),
			web_accessible_resources: [
				{
					resources: [
						'assets/*',
						'icon/*',
						'locales/*/*',
						'fonts/*',
						'content-scripts/content.css'
					],
					matches: ['https://*.roblox.com/*']
				}
			],
			...(browser === 'firefox' && {
				browser_specific_settings: {
					gecko: {
						id: 'rotector@jaxron.me',
						strict_min_version: '129.0',
						// See src/lib/utils/device-fingerprint.ts for what this declares and why
						data_collection_permissions: {
							optional: ['technicalAndInteraction']
						}
					}
				}
			})
		};
	}
});
