import '@omnitron-dev/prism/components/research/styles.css';
import './site.css';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DocSectionNav, MermaidDiagram, NetronPlayground } from '@omnitron-dev/lumen-ui';
import { LumenShell } from '@omnitron-dev/lumen-ui/runtime';
import { LumenSearchDialog } from '@omnitron-dev/lumen-ui/search';
import { PrismProvider, usePrismContext } from '@omnitron-dev/prism/core';
import { OmnitronBrand, omnitronTheme } from '@omnitron-dev/prism/identity';
import { ThemeSelector } from './theme-selector.tsx';
import { readThemePreference } from './theme-preference.ts';
const ApiExplorer = lazy(() => import('./api-explorer.tsx'));
function ApiExplorerIsland() {
  return React.createElement(Suspense, { fallback: React.createElement('p', { role: 'status' }, 'Loading public API inventory…') }, React.createElement(ApiExplorer));
}

function SearchPage() {
  return React.createElement('button', { type: 'button', onClick: () => document.querySelector<HTMLButtonElement>('[data-open-search]')?.click() }, 'Search all documentation');
}
const islands = { DocSectionNav, MermaidDiagram, SiteBrand: OmnitronBrand, ThemeSelector, ApiExplorer: ApiExplorerIsland, SearchPage, Playground: NetronPlayground };
function Client() {
  const [mode, setMode] = useState(readThemePreference);
  useEffect(() => {
    try { localStorage.setItem('omnitron-theme', mode); } catch { /* The explicit choice still works for this page. */ }
    const sync = (event: StorageEvent) => { if (event.key === 'omnitron-theme' || event.key === null) setMode(readThemePreference()); };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [mode]);
  return React.createElement(PrismProvider, { children: null, disableCssBaseline: true, mode, onModeChange: setMode, themeOverrides: omnitronTheme },
    React.createElement(SiteClient));
}
function SiteClient() {
  const { theme: prismTheme } = usePrismContext();
  const theme = prismTheme.palette.mode;
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => {
    document.documentElement.setAttribute('data-omnitron-theme', theme);
    document.documentElement.style.colorScheme = theme;
  }, [theme]);
  useEffect(() => {
    const open = () => setSearchOpen(true);
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if ((event.key === '/' && !target?.closest('input,textarea,[contenteditable]')) || ((event.metaKey || event.ctrlKey) && event.key === 'k')) {
        event.preventDefault(); open();
      }
    };
    const search = document.querySelector<HTMLButtonElement>('[data-open-search]');
    search?.addEventListener('click', open);
    if (search) search.disabled = false;
    document.addEventListener('keydown', key);
    return () => {
      search?.removeEventListener('click', open);
      if (search) search.disabled = true;
      document.removeEventListener('keydown', key);
    };
  }, []);
  return React.createElement(LumenShell, { theme, currentPath: location.pathname, islands, disablePrismProvider: true },
      searchOpen && React.createElement('div', { className: 'search-overlay', onClick: (event: React.MouseEvent) => { if (event.target === event.currentTarget) setSearchOpen(false); } },
        React.createElement(LumenSearchDialog, { open: true, onClose: () => setSearchOpen(false), maxResults: 12, pagefindUrl: '/pagefind/pagefind.js' })));
}
const host = document.getElementById('lumen-interactive-root');
if (host) createRoot(host).render(React.createElement(Client));
