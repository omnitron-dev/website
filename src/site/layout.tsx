import React from 'react';
import { PrismProvider } from '@omnitron-dev/prism/core';
import { OmnitronBrand, omnitronCssVariables, omnitronTheme } from '@omnitron-dev/prism/identity';
import { DocLayout, DocSectionNav, LumenFooter } from '@omnitron-dev/lumen-ui';
import type { LumenPageLayoutProps, LumenSidebarItem } from '@omnitron-dev/lumen';
import { PortalIslandHost } from '@omnitron-dev/lumen-ui/runtime';
import { Home } from './home.tsx';

const sections = [
  ['Learn', '/docs/intro'], ['Titan', '/docs/titan/overview'],
  ['Frontend', '/docs/frontend/overview'], ['Lumen', '/docs/lumen/overview'],
  ['Operations', '/docs/omnitron/overview'], ['Reference', '/docs/reference/api-index'],
];

export function SiteLayout({ children, document: doc, documents, config }: LumenPageLayoutProps) {
  const byId = new Map(documents.map(document => [document.id, document]));
  const contains = (items: LumenSidebarItem[]): boolean => items.some(item =>
    item.type === 'doc' ? item.id === doc.id : item.type === 'category' &&
      (item.href === doc.routePath || contains(item.items)));
  const group = Object.entries(config.sidebars).find(([, items]) => contains(items));
  const items = group?.[1] ?? [];
  const flatten = (items: LumenSidebarItem[]): string[] => items.flatMap(item =>
    item.type === 'doc' ? [item.id] : item.type === 'category' ? flatten(item.items) : []);
  const ordered = flatten(items).map(id => byId.get(id)).filter(Boolean);
  const index = ordered.findIndex(item => item?.id === doc.id);
  const previous = ordered[index - 1];
  const next = ordered[index + 1];
  const home = doc.frontmatter?.layout === 'home';
  const sidebar = (items: LumenSidebarItem[]) => <ul>{items.map((item, i) => {
    if (item.type === 'category') return <li key={i}><details open={contains(item.items) || item.collapsed === false}>
      <summary>{item.label}</summary>
      {item.href && <a className="sidebar-overview" href={item.href}>Overview</a>}
      {sidebar(item.items)}
    </details></li>;
    const target = item.type === 'doc' ? byId.get(item.id) : undefined;
    const href = item.type === 'link' ? item.href : target?.routePath;
    if (!href) throw new Error(`Sidebar target is unavailable: ${JSON.stringify(item)}`);
    return <li key={i}><a href={href} aria-current={target?.id === doc.id ? 'page' : undefined}>
      {item.label || target?.title}
    </a></li>;
  })}</ul>;
  const css = (mode: 'dark' | 'light') => `[data-omnitron-theme="${mode}"]{${Object.entries(omnitronCssVariables(mode)).map(([key,value]) => `${key}:${value}`).join(';')}}`;

  return <PrismProvider mode="dark" disableCssBaseline themeOverrides={omnitronTheme}>
    <link rel="icon" type="image/svg+xml" href="/img/logo.svg" />
    <style>{css('dark') + css('light')}</style>
    <div className="omnitron-site" data-omnitron-theme="dark">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <a href="/" className="brand" aria-label="Omnitron home"><PortalIslandHost islandId="site-brand" component="SiteBrand" hydrate="load" props={{ size: 30 }}><OmnitronBrand size={30} /></PortalIslandHost></a>
        <span className="site-edition">FIELD MANUAL</span>
        <nav aria-label="Main navigation">{sections.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>
        <div className="header-actions">
          <button type="button" className="search-trigger" data-open-search>Search <kbd>/</kbd></button>
          <button type="button" className="theme-trigger" data-toggle-theme aria-label="Switch color theme">◐</button>
          <details className="mobile-nav"><summary aria-label="Open navigation">Menu</summary><nav>{sections.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav></details>
        </div>
      </header>
      {home ? <Home /> : <>
        <div className="document-context"><a href="/docs/intro">Documentation</a><span>/</span><span>{group?.[0] === 'docs' ? 'Learn' : group?.[0] || 'Project'}</span><span>/</span><strong>{doc.title}</strong></div>
        {items.length > 0 && <details className="mobile-document-nav"><summary>In this section</summary><nav aria-label="Mobile documentation sections">{sidebar(items)}</nav></details>}
        <DocLayout sidebar={items.length ? <nav aria-label="Documentation sections"><p className="sidebar-label">{group?.[0] === 'docs' ? 'Start building' : group?.[0]}</p>{sidebar(items)}</nav> : undefined}
          sectionNav={<><p className="sidebar-label">On this page</p><DocSectionNav headings={(doc.headers ?? []).filter(h => h.depth === 2 || h.depth === 3).map(h => ({...h, level: h.depth}))} /><div className="page-exports"><a href={`${doc.routePath === '/' ? '/index' : doc.routePath}.md`}>Read as Markdown ↗</a><a href="/llms.txt">Agent index ↗</a></div></>}>
          <div id="main-content" tabIndex={-1}>{children}</div>
          {(previous || next) && <nav className="page-pagination" aria-label="Adjacent guides">
            {previous ? <a href={previous.routePath}><small>Previous</small>{previous.title}<span>←</span></a> : <span />}
            {next ? <a href={next.routePath}><small>Next</small>{next.title}<span>→</span></a> : <span />}
          </nav>}
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
