// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages configuration (see docs/SPEC.md §14).
// PUBLIC_SITE_URL:  origin of the deployed site, e.g. https://username.github.io
// PUBLIC_BASE_PATH: base path for project pages, e.g. /sigma-rule-library ('' for user/root pages)
const SITE_URL = process.env.PUBLIC_SITE_URL ?? 'https://username.github.io';
const BASE_PATH = process.env.PUBLIC_BASE_PATH ?? '/sigma-rule-library';

export default defineConfig({
  site: SITE_URL,
  base: BASE_PATH === '' ? '/' : BASE_PATH,
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Never inline scripts/assets: the CSP is `script-src 'self'`, so every
      // script must load as an external same-origin file.
      assetsInlineLimit: 0,
    },
  },
});
