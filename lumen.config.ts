import { defineLumenConfig } from '@omnitron-dev/lumen';
import { SiteLayout } from './src/site/layout.tsx';
import { documentIslands } from './src/site/islands.ts';
import sidebars from './src/data/sidebars.json' with { type: 'json' };

export default defineLumenConfig({
  title: 'Omnitron',
  tagline: 'A privacy-first, self-hosted full-stack platform. Build and operate systems on infrastructure you control.',
  url: process.env.SITE_URL || 'https://omnitron.dev',
  baseUrl: process.env.SITE_BASE_URL || '/',
  srcDir: 'docs',
  pagesDir: 'pages',
  publicDir: 'static',
  outDir: process.env.LUMEN_OUT_DIR || 'build',
  clientEntry: 'src/site/client.ts',
  islands: documentIslands,
  trailingSlash: false,
  // On Lumen 0.4.13, other pages can block the event loop while a preview waits for its SSR imports.
  renderConcurrency: 1,
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  sidebars,
  theme: { defaultMode: 'dark', layout: SiteLayout },
});
