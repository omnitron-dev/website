import './site.css';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MermaidDiagram, NetronPlayground } from '@omnitron-dev/lumen-ui';
import { LumenShell } from '@omnitron-dev/lumen-ui/runtime';
import { LumenSearchDialog } from '@omnitron-dev/lumen-ui/search';
import { PrismProvider } from '@omnitron-dev/prism/core';
import { OmnitronBrand, OmnitronMark, omnitronTheme } from '@omnitron-dev/prism/identity';
const ApiExplorer = lazy(() => import('./api-explorer.tsx'));
function ApiExplorerIsland() {
  return React.createElement(Suspense, { fallback: React.createElement('p', { role: 'status' }, 'Loading public API inventory…') }, React.createElement(ApiExplorer));
}

const readMode = (): 'light' | 'dark' => {
  try { return localStorage.getItem('omnitron-theme') === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
};
function SearchPage() {
  return React.createElement('button', { type: 'button', onClick: () => document.querySelector<HTMLButtonElement>('[data-open-search]')?.click() }, 'Search all documentation');
}
const islands = { MermaidDiagram, SiteBrand: OmnitronBrand, SiteMark: OmnitronMark, ApiExplorer: ApiExplorerIsland, SearchPage, Playground: NetronPlayground };
function Client() {
  const [theme, setTheme] = useState(readMode);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    document.querySelector('.omnitron-site')?.setAttribute('data-omnitron-theme', theme);
    document.body.dataset.theme = theme;
    document.querySelectorAll('.lumen-shell').forEach(el => el.setAttribute('data-theme', theme));
    try { localStorage.setItem('omnitron-theme', theme); } catch { /* Theme still works without persistent storage. */ }
  }, [theme]);
  useEffect(() => {
    const open = () => setSearchOpen(true);
    const toggle = () => setTheme(mode => mode === 'dark' ? 'light' : 'dark');
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if ((event.key === '/' && !target?.closest('input,textarea,[contenteditable]')) || ((event.metaKey || event.ctrlKey) && event.key === 'k')) {
        event.preventDefault(); open();
      }
    };
    const search = document.querySelector('[data-open-search]');
    const mode = document.querySelector('[data-toggle-theme]');
    search?.addEventListener('click', open); mode?.addEventListener('click', toggle); document.addEventListener('keydown', key);
    return () => { search?.removeEventListener('click', open); mode?.removeEventListener('click', toggle); document.removeEventListener('keydown', key); };
  }, []);
  return React.createElement(PrismProvider, { children: null, disableCssBaseline: true, mode: theme, onModeChange: mode => setTheme(mode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode), themeOverrides: omnitronTheme },
    React.createElement(LumenShell, { theme, currentPath: location.pathname, islands, disablePrismProvider: true },
      searchOpen && React.createElement('div', { className: 'search-overlay', onClick: (event: React.MouseEvent) => { if (event.target === event.currentTarget) setSearchOpen(false); } },
        React.createElement(LumenSearchDialog, { open: true, onClose: () => setSearchOpen(false), maxResults: 12, pagefindUrl: '/pagefind/pagefind.js' }))));
}
const host = document.getElementById('lumen-interactive-root');
if (host) createRoot(host).render(React.createElement(Client));
