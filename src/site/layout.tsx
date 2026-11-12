import React from 'react';
import { PrismProvider } from '@omnitron-dev/prism/core';
import { OmnitronBrand, omnitronCssVariables, omnitronTheme } from '@omnitron-dev/prism/identity';
import { DocLayout, DocSectionNav, DocPagination, LumenFooter } from '@omnitron-dev/lumen-ui';
import type { LumenPageLayoutProps, LumenSidebarItem } from '@omnitron-dev/lumen';
import { PortalIslandHost } from '@omnitron-dev/lumen-ui/runtime';
import { Home } from './home.tsx';
import { ThemeSelectorPlaceholder } from './theme-icons.tsx';
import { themeBootstrap } from './theme-preference.ts';

const sections = [
  ['Learn', '/docs/intro'], ['Titan', '/docs/titan/overview'],
  ['Frontend', '/docs/frontend/overview'], ['Lumen', '/docs/lumen/overview'],
  ['Operations', '/docs/omnitron/overview'], ['Reference', '/docs/reference/api-index'],
];

export function SiteLayout({ children, document: doc, documents, config }: LumenPageLayoutProps) {
  const byId = new Map(documents.map(document => [document.id, document]));
  const byRoute = new Map(documents.map(document => [document.routePath, document]));
  const contains = (items: LumenSidebarItem[]): boolean => items.some(item =>
    item.type === 'doc' ? item.id === doc.id : item.type === 'category' &&
      (item.href === doc.routePath || contains(item.items)));
  const group = Object.entries(config.sidebars).find(([, items]) => contains(items));
  const items = group?.[1] ?? [];
  const flatten = (items: LumenSidebarItem[]): string[] => items.flatMap(item => {
    if (item.type === 'doc') return [item.id];
    if (item.type !== 'category') return [];
    const landing = item.href ? byRoute.get(item.href) : undefined;
    return [...(landing ? [landing.id] : []), ...flatten(item.items)];
  });
  const ordered = [...new Set(flatten(items))].map(id => byId.get(id)).filter(Boolean);
  const index = ordered.findIndex(item => item?.id === doc.id);
  const previous = index < 0 ? undefined : ordered[index - 1];
  const next = index < 0 ? undefined : ordered[index + 1];
  const adjacent = (item: typeof previous) => {
    if (!item) return undefined;
    if (!item.routePath) throw new Error(`Adjacent document has no public route: ${item.id}`);
    return { href: item.routePath, label: item.title };
  };
  const home = doc.frontmatter?.layout === 'home';
  const sidebar = (items: LumenSidebarItem[]) => <ul>{items.map((item, i) => {
    if (item.type === 'category') return <li key={i}><details open={item.href === doc.routePath || contains(item.items) || item.collapsed === false}>
      <summary>{item.label}</summary>
      {item.href && <a className="sidebar-overview" href={item.href} aria-current={item.href === doc.routePath ? 'page' : undefined}>Overview</a>}
      {sidebar(item.items)}
    </details></li>;
    const target = item.type === 'doc' ? byId.get(item.id) : undefined;
    const href = item.type === 'link' ? item.href : target?.routePath;
    if (!href) throw new Error(`Sidebar target is unavailable: ${JSON.stringify(item)}`);
    return <li key={i}><a href={href} aria-current={target?.id === doc.id ? 'page' : undefined}>
      {item.label || target?.title}
    </a></li>;
  })}</ul>;
  const css = (mode: 'dark' | 'light', selector: string) => `${selector}{${Object.entries(omnitronCssVariables(mode)).map(([key,value]) => `${key}:${value}`).join(';')};color-scheme:${mode}}`;

  return <PrismProvider mode="dark" disableCssBaseline themeOverrides={omnitronTheme}>
    <link rel="icon" type="image/svg+xml" href="/img/logo.svg" />
    <style>{css('dark', ':root') + css('light', ':root[data-omnitron-theme=light]') + `@media(prefers-color-scheme:light){${css('light', ':root:not([data-omnitron-theme])')}}`}</style>
    <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
    <div className="omnitron-site">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <a href="/" className="brand" aria-label="Omnitron home"><PortalIslandHost islandId="site-brand" component="SiteBrand" hydrate="load" props={{ size: 30 }}><OmnitronBrand size={30} /></PortalIslandHost></a>
        <span className="site-edition">FIELD MANUAL</span>
        <nav aria-label="Main navigation">{sections.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>
        <div className="header-actions">
          <button type="button" className="search-trigger" data-open-search disabled>Search <kbd>/</kbd></button>
          <PortalIslandHost islandId="site-theme" component="ThemeSelector" hydrate="load" props={{}}><ThemeSelectorPlaceholder /></PortalIslandHost>
          <details className="mobile-nav"><summary aria-label="Open navigation">Menu</summary><nav>{sections.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav></details>
        </div>
      </header>
      {home ? <Home /> : <>
        <div className="document-context"><a href="/docs/intro">Documentation</a><span>/</span><span>{group?.[0] === 'docs' ? 'Learn' : group?.[0] || 'Project'}</span><span>/</span><strong>{doc.title}</strong></div>
        {items.length > 0 && <details className="mobile-document-nav"><summary>In this section</summary><nav aria-label="Mobile documentation sections">{sidebar(items)}</nav></details>}
        <DocLayout sidebar={items.length ? <nav aria-label="Documentation sections"><p className="sidebar-label">{group?.[0] === 'docs' ? 'Start building' : group?.[0]}</p>{sidebar(items)}</nav> : undefined}
          sectionNav={<><p className="sidebar-label">On this page</p><DocSectionNav headings={(doc.headers ?? []).filter(h => h.depth === 2 || h.depth === 3).map(h => ({...h, level: h.depth}))} /><div className="page-exports"><a href={`${doc.routePath === '/' ? '/index' : doc.routePath}.md`}>Read as Markdown ↗</a><a href="/llms.txt">Agent index ↗</a></div></>}>
          <div id="main-content" tabIndex={-1}>{children}</div>
          {(previous || next) && <DocPagination className="page-pagination"
            prev={adjacent(previous)}
            next={adjacent(next)} />}
        </DocLayout>
      </>}
      <LumenFooter copyright="Omnitron · Open source / MIT" columns={[
        { title: 'Build', items: [{ label: 'Quickstart', href: '/docs/getting-started/quickstart' }, { label: 'Architecture', href: '/docs/foundations/architecture' }] },
        { title: 'Reference', items: [{ label: 'Public APIs', href: '/docs/reference/api-index' }, { label: 'Compatibility', href: '/docs/reference/compatibility' }] },
        { title: 'Project', items: [{ label: 'Source ↗', href: 'https://github.com/omnitron-dev/omni' }, { label: 'Contributing', href: '/docs/community/contributing' }] },
      ]} />
      <div className="site-colophon"><span>BUILT WITH LUMEN</span><a href="/docs/lumen/this-site">How this manual works →</a></div>
      <div id="lumen-interactive-root" />
    </div>
  </PrismProvider>;
}
