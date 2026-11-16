import React from 'react';
import { renderCodeBlockHtml } from '@omnitron-dev/lumen-ast';
import { PrismProvider, PrismThemeScript } from '@omnitron-dev/prism/core';
import { Link } from '@omnitron-dev/prism/ui';
import { DocSidebar, type DocSidebarItem } from '@omnitron-dev/prism/components/doc-layout';
import { OmnitronBrand, omnitronTheme } from '@omnitron-dev/prism/identity';
import { DocLayout, DocSectionNav, DocPagination } from '@omnitron-dev/lumen-ui';
import type { LumenPageLayoutProps, LumenSidebarItem } from '@omnitron-dev/lumen';
import { PortalIslandHost } from '@omnitron-dev/lumen-ui/runtime';
import { SearchTrigger } from './search-trigger.tsx';
import { Home, serviceExample, clientExample } from './home.tsx';
import { ThemeSelectorPlaceholder } from './theme-selector.tsx';
import { MainNavigation, MobileNavigation, SectionNavigation, sections } from './navigation.tsx';

const footerGroups = [
  { id: 'build', title: 'Build', links: [
    { label: 'Quickstart', href: '/docs/getting-started/quickstart' },
    { label: 'Application tutorial', href: '/docs/tutorial' },
    { label: 'Public APIs', href: '/docs/reference/api-index' },
  ] },
  { id: 'operate', title: 'Operate', links: [
    { label: 'Node and fleet architecture', href: '/docs/omnitron/architecture' },
    { label: 'Production readiness', href: '/docs/deployment/production-readiness' },
    { label: 'CLI reference', href: '/docs/omnitron/cli' },
  ] },
  { id: 'project', title: 'Project', links: [
    { label: 'Privacy and ownership', href: '/docs/foundations/privacy' },
    { label: 'Contributing', href: '/docs/community/contributing' },
    { label: 'Source on GitHub ↗', href: 'https://github.com/omnitron-dev/omni' },
  ] },
];

export function SiteLayout({ children, document: doc, documents, config }: LumenPageLayoutProps) {
  if (!doc.routePath) throw new Error(`Page document has no public route: ${doc.id}`);
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
  const homeProps = home ? { serverCode: renderCodeBlockHtml(serviceExample, 'typescript'), clientCode: renderCodeBlockHtml(clientExample, 'typescript') } : null;
  const headings = (doc.headers ?? []).filter(h => h.depth === 2 || h.depth === 3).map(h => ({ ...h, level: h.depth }));
  const sidebarItems = (entries: LumenSidebarItem[], parent = 'root'): DocSidebarItem[] => entries.map((item, index) => {
    const id = `${parent}/${index}`;
    if (item.type === 'category') {
      const landing = item.href ? byRoute.get(item.href) : undefined;
      return { id, label: item.label, children: [
        ...(item.href ? [{ id: landing?.id ?? `${id}/overview`, label: 'Overview', href: item.href }] : []),
        ...sidebarItems(item.items, id),
      ] };
    }
    const target = item.type === 'doc' ? byId.get(item.id) : undefined;
    const href = item.type === 'link' ? item.href : target?.routePath;
    if (!href) throw new Error(`Sidebar target is unavailable: ${JSON.stringify(item)}`);
    return { id: target?.id ?? id, href, label: item.label || target?.title || href };
  });
  const navigation = sidebarItems(items);
  const navigationTitle = sections.find(section => section.id === group?.[0])?.label ?? 'Documentation';
  const sidebarProps = { items: navigation, activeId: doc.id, title: navigationTitle };
  return <PrismProvider modeStorageKey="omnitron-theme" themeOverrides={omnitronTheme}>
    <link rel="icon" type="image/svg+xml" href="/img/logo.svg" />
    <link rel="preload" as="font" type="font/woff2" href="/fonts/inter-400.woff2" crossOrigin="anonymous" />
    <link rel="preload" as="font" type="font/woff2" href="/fonts/inter-600.woff2" crossOrigin="anonymous" />
    <PrismThemeScript modeStorageKey="omnitron-theme" />
    <div className="omnitron-site">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <a href="/" className="brand" aria-label="Omnitron home"><PortalIslandHost islandId="site-brand" component="SiteBrand" hydrate="load" props={{ size: 30 }}><OmnitronBrand size={30} /></PortalIslandHost></a>
        <PortalIslandHost className="lumen-portal-island header-navigation" islandId="main-navigation" component="MainNavigation" hydrate="load" props={{ currentPath: doc.routePath }}><MainNavigation currentPath={doc.routePath} /></PortalIslandHost>
        <div className="header-actions">
          <PortalIslandHost islandId="site-search" component="SearchTrigger" hydrate="load" props={{}}><SearchTrigger /></PortalIslandHost>
          <PortalIslandHost islandId="site-theme" component="ThemeSelector" hydrate="load" props={{}}><ThemeSelectorPlaceholder /></PortalIslandHost>
          <div className="mobile-nav"><PortalIslandHost islandId="site-navigation" component="MobileNavigation" hydrate="load" props={{ currentPath: doc.routePath }}><MobileNavigation currentPath={doc.routePath} disabled /></PortalIslandHost></div>
        </div>
      </header>
      <noscript><div className="static-navigation"><MainNavigation currentPath={doc.routePath} /></div></noscript>
      {homeProps ? <PortalIslandHost islandId="site-home" component="Home" hydrate="load" props={homeProps}><Home {...homeProps} /></PortalIslandHost> : <>
        <div className="document-context"><Link href="/docs/intro">Documentation</Link><span>/</span><span>{navigationTitle}</span><span>/</span><strong>{doc.title}</strong></div>
        {items.length > 0 && <div className="mobile-document-nav"><PortalIslandHost islandId="section-navigation" component="SectionNavigation" hydrate="load" props={sidebarProps}><SectionNavigation {...sidebarProps} disabled /></PortalIslandHost><noscript><nav aria-label="Mobile documentation sections"><DocSidebar {...sidebarProps} /></nav></noscript></div>}
        <DocLayout sidebar={items.length ? <nav aria-label="Documentation sections"><PortalIslandHost islandId="documentation-navigation" component="DocSidebar" hydrate="load" props={sidebarProps}><DocSidebar {...sidebarProps} /></PortalIslandHost></nav> : undefined}
          sectionNav={<><p className="sidebar-label">On this page</p><PortalIslandHost islandId="page-sections" component="DocSectionNav" hydrate="load" props={{ headings }}><DocSectionNav headings={headings} /></PortalIslandHost><div className="page-exports"><Link target="_blank" rel="noopener noreferrer" href={`${doc.routePath === '/' ? '/index' : doc.routePath}.md`}>Read as Markdown ↗</Link><Link href="/llms.txt" target="_blank" rel="noopener noreferrer">Agent index ↗</Link></div></>}>
          <div id="main-content" tabIndex={-1}>{children}</div>
          {(previous || next) && <div id={next ? 'next' : undefined}>
            <DocPagination className="page-pagination" prev={adjacent(previous)} next={adjacent(next)} />
          </div>}
        </DocLayout>
      </>}
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-about">
            <Link className="footer-name" href="/">OMNITRON</Link>
            <p>A private full-stack platform. Build and operate TypeScript applications on infrastructure you control.</p>
            <Link className="footer-architecture" href="/docs/foundations/architecture">Explore the architecture →</Link>
          </div>
          <nav className="footer-navigation" aria-label="Footer navigation">
            {footerGroups.map(group => <section className="footer-group" key={group.id} aria-labelledby={`footer-${group.id}`}>
              <h2 id={`footer-${group.id}`}>{group.title}</h2>
              <ul>{group.links.map(link => <li key={link.href}>
                <Link href={link.href} {...(link.href.startsWith('https://') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{link.label}</Link>
              </li>)}</ul>
            </section>)}
          </nav>
        </div>
        <div className="site-colophon">
          <span>Omnitron · Open source / MIT</span>
          <div className="footer-meta"><Link href="/docs/lumen/this-site">Built with Lumen</Link><Link href="/llms.txt" target="_blank" rel="noopener noreferrer">Agent index ↗</Link></div>
        </div>
      </footer>
      <div id="lumen-interactive-root" />
    </div>
  </PrismProvider>;
}
