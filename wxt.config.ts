import {defineConfig} from 'wxt';
import tailwindcss from "@tailwindcss/vite";

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  vite: () => ({
    plugins: [tailwindcss()],
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
    }
  }),
  manifest: {
    name: 'Rotector',
    description: 'Real-time warnings about inappropriate Roblox users before you interact with them.',
    version: '2.2.0',
    permissions: ['storage'],
    host_permissions: [
      'https://*.roblox.com/*',
      'https://roscoe.robalyx.com/*'
    ],
    web_accessible_resources: [
      {
        resources: ['assets/*'],
        matches: ['https://*.roblox.com/*']
      }
    ],
    browser_specific_settings: {
      gecko: {
        id: 'extension@rotector.com'
      }
    }
  }
});
