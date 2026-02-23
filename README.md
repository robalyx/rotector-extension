<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/png/rotector-logo-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="./assets/png/rotector-logo-light.png">
    <img width="300" alt="Rotector Extension" src="./assets/png/rotector-logo-light.png">
  </picture>
  <br>
  <a href="https://github.com/robalyx/rotector-extension/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/robalyx/rotector-extension?style=flat-square&color=4a92e1">
  </a>
  <a href="https://github.com/robalyx/rotector-extension/issues">
    <img src="https://img.shields.io/github/issues/robalyx/rotector-extension?style=flat-square&color=4a92e1">
  </a>
  <a href="https://discord.gg/2Cn7kXqqhY">
    <img src="https://img.shields.io/discord/1294585467462746292?style=flat-square&color=4a92e1&label=discord" alt="Join our Discord">
  </a>
</h1>

<p align="center">
  <em>A browser extension that integrates with the <a href="https://github.com/robalyx/rotector">Rotector</a> system to help identify inappropriate users on Roblox.</em>
</p>

---

> [!IMPORTANT]
> This is a **community-driven initiative** and is not affiliated with, endorsed by, or sponsored by Roblox Corporation.

---

## ❓ How It Works

This extension is a browser-based client for the [Rotector](https://github.com/robalyx/rotector) system. It communicates with Rotector's API service to display status indicators for Roblox users directly on the Roblox website.

The extension does not perform any analysis itself. All user analysis is performed by the Rotector system using AI and specialized algorithms. The extension simply displays the results of this analysis to help users identify potentially inappropriate accounts while browsing Roblox.

## 🌐 Learn More

Want to learn more about the Rotector project? Visit our website at **[rotector.com](https://rotector.com)** to explore the full system and see how our browser extension fits into the larger ecosystem of child safety tools.

<p align="center">
  <img src="./assets/png/website.png" alt="Rotector Website - Browser Extension Section" width="700">
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/rotector/ilegibonffbmecfchpcmcmknocboagan">
    <img src="https://img.shields.io/chrome-web-store/v/ilegibonffbmecfchpcmcmknocboagan?style=flat-square&color=4a92e1&label=chrome%20extension" alt="Chrome Web Store">
  </a>
  <a href="https://addons.mozilla.org/en-US/firefox/addon/rotector/">
    <img src="https://img.shields.io/amo/v/rotector?style=flat-square&color=4a92e1&label=firefox%20extension" alt="Firefox Add-ons">
  </a>
</p>

## 📦 Installation

### 🏪 From Browser Stores

- **Chrome**: [Chrome Web Store](https://chromewebstore.google.com/detail/rotector/ilegibonffbmecfchpcmcmknocboagan)
- **Firefox**: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/rotector/)

### 🔧 From Source

#### Prerequisites

- [Bun](https://bun.sh/) (v1.2+)

#### Setup

```bash
# Clone the repository
git clone https://github.com/robalyx/rotector-extension.git
cd rotector-extension

# Install dependencies
bun install

# Development
bun run dev          # Chrome
bun run dev:firefox  # Firefox
bun run dev:edge     # Edge

# Build for production
bun run build         # Chrome
bun run build:firefox # Firefox
bun run build:edge    # Edge

# Create distributable packages
bun run zip          # Chrome
bun run zip:firefox  # Firefox
bun run zip:edge     # Edge
```

#### 🔄 Loading the Extension

##### Chrome / Edge

1. Navigate to `chrome://extensions/` (Chrome) or `edge://extensions/` (Edge)
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `.output/chrome-mv3` directory

##### Firefox

1. Navigate to `about:debugging`
2. Click "This Firefox"
3. Click "Load Temporary Add-on"
4. Select any file in the `.output/firefox-mv3` directory

## 🛠️ Development

### 🔧 Tech Stack

#### Core Technologies

- **Framework**: [WXT](https://wxt.dev/) - Modern web extension framework
- **Frontend**: [Svelte 5](https://svelte.dev/) with runes syntax
- **Language**: [TypeScript](https://www.typescriptlang.org/) (100% type coverage with strict mode)
- **CSS**: [Tailwind CSS 4](https://tailwindcss.com/) with [PostCSS](https://postcss.org/)
- **Build Tool**: [Vite](https://vite.dev/) with [Lightning CSS](https://lightningcss.dev/) minification
- **Package Manager**: [Bun](https://bun.sh/) (v1.2+)

#### Development Tools

- **Code Quality**: [ESLint](https://eslint.org/) with TypeScript and Svelte plugins, [Prettier](https://prettier.io/) for formatting
- **Dead Code**: [Knip](https://knip.dev/) for analysis
- **Type Checking**: [svelte-check](https://www.npmjs.com/package/svelte-check) with TypeScript integration
- **i18n Validation**: Custom scripts for translation key integrity

### ✅ Quality Checks

```bash
# Run all quality checks (type check + dead code + i18n validation + lint)
bun run quality

# Individual checks
bun run check         # Svelte type checking
bun run lint          # ESLint + Prettier
bun run lint:fix      # ESLint + Prettier auto-fix
bun run knip          # Dead code detection
bun run validate:i18n # Translation key validation
bun run format:i18n   # Sort translation keys alphabetically
```

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Run quality checks before committing
4. Submit a pull request

Please note that this project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/robalyx/rotector-extension/issues)
- **Discord**: [Join our Discord](https://discord.gg/2Cn7kXqqhY)

## 📄 License

This project is licensed under the GNU General Public License v2.0 - see the [LICENSE](LICENSE) file for details.

---

Built with ❤️ for a safer Roblox community
