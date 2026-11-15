import { defineLumenConfig } from '@omnitron-dev/lumen';
import { SiteLayout } from './src/site/layout.tsx';
import { documentIslands } from './src/site/islands.ts';
import sidebars from './src/data/sidebars.json' with { type: 'json' };

export default defineLumenConfig({
  title: 'Omnitron',
  tagline: 'Build, connect, document and operate TypeScript systems.',
  url: process.env.SITE_URL || 'https://omnitron.dev',
  baseUrl: process.env.SITE_BASE_URL || '/',
  srcDir: 'docs',
  pagesDir: 'pages',
  publicDir: 'static',
  outDir: process.env.LUMEN_OUT_DIR || 'build',
  clientEntry: 'src/site/client.ts',
  islands: documentIslands,
  trailingSlash: false,
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',
  sidebars,
  theme: { defaultMode: 'dark', layout: SiteLayout },
});
