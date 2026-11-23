import React from 'react';
import { renderCodeBlockHtml } from '@omnitron-dev/lumen-ast';
import { PrismProvider, PrismThemeScript } from '@omnitron-dev/prism/core';
import { Link } from '@omnitron-dev/prism/ui';
import { Breadcrumbs } from '@omnitron-dev/prism/components/breadcrumbs';
import { DocSidebar } from '@omnitron-dev/prism/components/doc-layout';
import { OmnitronBrand, omnitronTheme } from '@omnitron-dev/prism/identity';
import { DocLayout, DocSectionNav, DocPagination } from '@omnitron-dev/lumen-ui';
import type { LumenPageLayoutProps, LumenSidebarItem } from '@omnitron-dev/lumen';
import { PortalIslandHost } from '@omnitron-dev/lumen-ui/runtime';
import { documentNavigation } from './document-navigation.ts';
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
    { label: 'Release notes', href: '/docs/community/changelog' },
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
  const home = doc.frontmatter?.layout === 'home';
  const homeProps = home ? { serverCode: renderCodeBlockHtml(serviceExample, 'typescript'), clientCode: renderCodeBlockHtml(clientExample, 'typescript') } : null;
  const headings = (doc.headers ?? []).filter(h => h.depth === 2 || h.depth === 3).map(h => ({ ...h, level: h.depth }));
  const section = sections.find(entry => entry.id === group?.[0]);
  const overviewHeadings = headings.filter(heading => heading.level === 2);
  const navigationTitle = section?.label ?? 'Documentation';
  const { navigation, pagination, parents } = documentNavigation(items, byId, byRoute, doc.id, navigationTitle);
  const sidebarProps = { items: navigation, activeId: doc.id, title: navigationTitle };
  const location = { currentPath: doc.routePath, sectionId: section?.id ?? null };
  const ancestors = new Map<string, string>();
  if (section) {
    ancestors.set('/docs/intro', 'Documentation');
    if (section.href !== '/docs/intro') ancestors.set(section.href, section.label);
    for (const parent of parents) {
      if (parent.href && byRoute.has(parent.href)) ancestors.set(parent.href, parent.label);
    }
  } else {
    ancestors.set('/', 'Home');
    const segments = doc.routePath.split('/').filter(Boolean);
    for (let depth = 1; depth < segments.length; depth++) {
      const href = '/' + segments.slice(0, depth).join('/');
      const parent = byRoute.get(href);
      if (parent) ancestors.set(href, parent.title);
    }
  }
  ancestors.delete(doc.routePath);
  const breadcrumbLinks = [...ancestors].map(([href, name]) => ({ href, name }));
  const pageExports = <div className="page-exports"><Link href={`${doc.routePath}.md`} target="_blank" rel="noopener noreferrer">Read as Markdown ↗</Link><Link href="/llms.txt" target="_blank" rel="noopener noreferrer">Agent index ↗</Link></div>;
  return <PrismProvider modeStorageKey="omnitron-theme" themeOverrides={omnitronTheme}>
    <link rel="icon" type="image/svg+xml" href="/img/logo.svg" />
    <link rel="preload" as="font" type="font/woff2" href="/fonts/inter-400.woff2" crossOrigin="anonymous" />
    <link rel="preload" as="font" type="font/woff2" href="/fonts/inter-600.woff2" crossOrigin="anonymous" />
    <PrismThemeScript modeStorageKey="omnitron-theme" />
    <div className="omnitron-site">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <a href="/" className="brand" aria-label="Omnitron home"><PortalIslandHost islandId="site-brand" component="SiteBrand" hydrate="load" props={{ size: 30 }}><OmnitronBrand size={30} /></PortalIslandHost></a>
        <PortalIslandHost className="lumen-portal-island header-navigation" islandId="main-navigation" component="MainNavigation" hydrate="load" props={location}><MainNavigation {...location} /></PortalIslandHost>
        <div className="header-actions">
          <PortalIslandHost islandId="site-search" component="SearchTrigger" hydrate="load" props={{}}><SearchTrigger /></PortalIslandHost>
          <PortalIslandHost islandId="site-theme" component="ThemeSelector" hydrate="load" props={{}}><ThemeSelectorPlaceholder /></PortalIslandHost>
          <div className="mobile-nav"><PortalIslandHost islandId="site-navigation" component="MobileNavigation" hydrate="load" props={location}><MobileNavigation {...location} disabled /></PortalIslandHost></div>
        </div>
      </header>
      <noscript>
        <style>{'.omnitron-site .header-actions,.mobile-document-nav > .lumen-portal-island{display:none}'}</style>
        <details className="static-navigation">
          <summary>Browse sections</summary>
          <MainNavigation {...location} />
        </details>
      </noscript>
      {homeProps ? <PortalIslandHost islandId="site-home" component="Home" hydrate="load" props={homeProps}><Home {...homeProps} /></PortalIslandHost> : <>
        <Breadcrumbs className="document-context" links={[...breadcrumbLinks, { name: doc.title }]}
          slotProps={{ breadcrumbs: { 'aria-label': 'Breadcrumb', maxItems: breadcrumbLinks.length + 1 } }} />
        <DocLayout className={items.length ? undefined : 'document-standalone'}
          sidebar={items.length ? <nav aria-label="Documentation sections"><PortalIslandHost islandId="documentation-navigation" component="DocSidebar" hydrate="load" props={sidebarProps}><DocSidebar {...sidebarProps} /></PortalIslandHost></nav> : undefined}
          sectionNav={<>{headings.length > 0 && <><p className="sidebar-label">On this page</p><PortalIslandHost islandId="page-sections" component="DocSectionNav" hydrate="load" props={{ headings }}><DocSectionNav headings={headings} /></PortalIslandHost></>}{pageExports}</>}>
          <div className="document-tools">
            {items.length > 0 && <div className="mobile-document-nav"><PortalIslandHost islandId="section-navigation" component="SectionNavigation" hydrate="load" props={sidebarProps}><SectionNavigation {...sidebarProps} disabled /></PortalIslandHost><noscript><details className="static-section"><summary>In this section</summary><nav aria-label="Mobile documentation sections"><DocSidebar {...sidebarProps} /></nav></details></noscript></div>}
            <details className="page-outline">
              <summary>{headings.length ? 'On this page' : 'Page options'}</summary>
              <div className="page-outline-body">
                {headings.length > 0 && <DocSectionNav headings={overviewHeadings.length ? overviewHeadings : headings} ariaLabel="Page sections" />}
                {pageExports}
              </div>
            </details>
          </div>
          <div id="main-content" tabIndex={-1}>{children}</div>
          {(pagination.prev || pagination.next) && <div id={pagination.next ? 'next' : undefined}>
            <DocPagination className="page-pagination" {...pagination} />
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
