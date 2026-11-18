import type { LumenPageLayoutProps, LumenSidebarItem } from '@omnitron-dev/lumen';
import type { DocPaginationProps } from '@omnitron-dev/lumen-ui';
import type { DocSidebarItem } from '@omnitron-dev/prism/components/doc-layout';

type Document = LumenPageLayoutProps['document'];
type Category = Extract<LumenSidebarItem, { type: 'category' }>;
type Page = { href: string; label: string; categories: readonly Category[] };

export function documentNavigation(
  entries: LumenSidebarItem[],
  byId: ReadonlyMap<string, Document>,
  byRoute: ReadonlyMap<string | undefined, Document>,
  activeId: string,
  section: string,
): { navigation: DocSidebarItem[]; pagination: DocPaginationProps } {
  const pages = new Map<string, Page>();

  function addPage(doc: Document, categories: readonly Category[]) {
    if (!doc.routePath) throw new Error(`Sidebar document has no public route: ${doc.id}`);
    if (!pages.has(doc.id)) pages.set(doc.id, { href: doc.routePath, label: doc.title, categories });
    return doc.routePath;
  }

  function visit(items: LumenSidebarItem[], categories: readonly Category[], parent: string): DocSidebarItem[] {
    return items.map((item, index) => {
      const id = `${parent}/${index}`;
      if (item.type === 'link') return { id, label: item.label, href: item.href };
      if (item.type === 'doc') {
        const doc = byId.get(item.id);
        if (!doc) throw new Error(`Sidebar document is unavailable: ${item.id}`);
        return { id: doc.id, href: addPage(doc, categories), label: item.label || doc.title };
      }
      const path = [...categories, item];
      const children: DocSidebarItem[] = [];
      if (item.href) {
        const landing = byRoute.get(item.href);
        if (landing) addPage(landing, path);
        children.push({ id: landing?.id ?? `${id}/overview`, label: 'Overview', href: item.href });
      }
      children.push(...visit(item.items, path, id));
      return { id, label: item.label, children };
    });
  }

  const navigation = visit(entries, [], 'root');
  const current = pages.get(activeId);
  if (!current) return { navigation, pagination: {} };
  const order = [...pages.values()];
  const index = order.indexOf(current);
  const currentPath = current.categories;
  const prev = order[index - 1];
  const next = order[index + 1];

  function direction(label: string, target?: Page) {
    if (!target) return label;
    const path = target.categories;
    let shared = 0;
    while (shared < path.length && path[shared] === currentPath[shared]) shared++;
    if (shared === path.length && shared === currentPath.length) return label;
    const context = shared < path.length
      ? path.slice(shared).map(category => category.label)
      : [path.at(-1)?.label ?? section];
    if (context.at(-1)?.toLowerCase() === target.label.toLowerCase()) context.pop();
    return context.length ? `${label} · ${context.join(' / ')}` : label;
  }

  return {
    navigation,
    pagination: {
      prev, next,
      labels: { previous: direction('Previous', prev), next: direction('Next', next) },
    },
  };
}
