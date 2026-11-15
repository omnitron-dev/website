import React, { useState } from 'react';
import { Button, IconButton, List, ListItemButton, ListItemText } from '@omnitron-dev/prism/ui';
import { MenuIcon, CloseIcon } from '@omnitron-dev/prism/icons';
import { Drawer } from '@omnitron-dev/prism/components';
import { DocSidebar, type DocSidebarItem } from '@omnitron-dev/prism/components/doc-layout';

export const sections = [
  ['Learn', '/docs/intro'], ['Titan', '/docs/titan/overview'],
  ['Frontend', '/docs/frontend/overview'], ['Lumen', '/docs/lumen/overview'],
  ['Operations', '/docs/omnitron/overview'], ['Reference', '/docs/reference/api-index'],
];

export function MainNavigation({ currentPath }: { currentPath: string }) {
  return <nav aria-label="Main navigation" className="main-navigation">
    {sections.map(([label, href]) => <Button key={href} href={href} variant="text" color="inherit" size="small"
      aria-current={currentPath === href ? 'page' : undefined}>{label}</Button>)}
  </nav>;
}

export function MobileNavigation({ currentPath, disabled = false }: { currentPath: string; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return <>
    <IconButton type="button" aria-label="Open navigation" aria-haspopup="dialog" aria-expanded={open}
      disabled={disabled} onClick={() => setOpen(true)}><MenuIcon /></IconButton>
    <Drawer open={open} onClose={() => setOpen(false)} title="Navigation" closeIcon={<CloseIcon />}
      width="min(320px, 100vw)" PaperProps={{ role: 'dialog', 'aria-label': 'Navigation', 'aria-modal': true }}>
      <nav aria-label="Mobile navigation"><List disablePadding>
        {sections.map(([label, href]) => <ListItemButton key={href} component="a" href={href}
          selected={currentPath === href} aria-current={currentPath === href ? 'page' : undefined}>
          <ListItemText primary={label} />
        </ListItemButton>)}
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
