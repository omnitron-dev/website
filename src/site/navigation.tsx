import React, { useState } from 'react';
import { Button, IconButton, List, ListItemButton, ListItemText } from '@omnitron-dev/prism/ui';
import { MenuIcon, CloseIcon } from '@omnitron-dev/prism/icons';
import { Drawer } from '@omnitron-dev/prism/components';
import { DocSidebar, type DocSidebarItem } from '@omnitron-dev/prism/components/doc-layout';

export const sections = [
  { id: 'docs', label: 'Learn', href: '/docs/intro' },
  { id: 'titan', label: 'Titan', href: '/docs/titan/overview' },
  { id: 'frontend', label: 'Frontend', href: '/docs/frontend/overview' },
  { id: 'lumen', label: 'Lumen', href: '/docs/lumen/overview' },
  { id: 'omnitron', label: 'Operations', href: '/docs/omnitron/overview' },
  { id: 'reference', label: 'Reference', href: '/docs/reference/api-index' },
];

type NavigationLocation = { currentPath: string; sectionId: string | null };

function currentLocation(href: string, id: string, { currentPath, sectionId }: NavigationLocation) {
  if (href === currentPath) return 'page';
  if (id === sectionId) return 'location';
}

export function MainNavigation(location: NavigationLocation) {
  return <nav aria-label="Main navigation" className="main-navigation">
    {sections.map(({ id, label, href }) => <Button key={id} href={href} variant="text" color="inherit" size="small"
      aria-current={currentLocation(href, id, location)}>{label}</Button>)}
  </nav>;
}

export function MobileNavigation({ disabled = false, ...location }: NavigationLocation & { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <IconButton type="button" aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={open}
      disabled={disabled} onClick={() => setOpen(true)}><MenuIcon /></IconButton>
    <Drawer open={open} onClose={() => setOpen(false)} title="Navigation" closeIcon={<CloseIcon />}
      width="min(320px, 100vw)" PaperProps={{ role: 'dialog', 'aria-label': 'Navigation', 'aria-modal': true }}>
      <nav aria-label="Mobile navigation"><List disablePadding>
        {sections.map(({ id, label, href }) => {
          const current = currentLocation(href, id, location);
          return <ListItemButton key={id} component="a" href={href} selected={Boolean(current)} aria-current={current}>
            <ListItemText primary={label} />
          </ListItemButton>;
        })}
      </List></nav>
    </Drawer>
  </>;
}

export function SectionNavigation({ items, activeId, title, disabled = false }: {
  items: DocSidebarItem[]; activeId: string; title: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" variant="text" startIcon={<MenuIcon />} aria-haspopup="dialog" aria-expanded={open}
      disabled={disabled} onClick={() => setOpen(true)}>In this section</Button>
    <Drawer open={open} onClose={() => setOpen(false)} title={title} closeIcon={<CloseIcon />}
      anchor="left" width="min(360px, 100vw)"
      PaperProps={{ role: 'dialog', 'aria-label': 'Documentation sections', 'aria-modal': true }}>
      <nav aria-label="Mobile documentation sections"><DocSidebar items={items} activeId={activeId} /></nav>
    </Drawer>
  </>;
}
