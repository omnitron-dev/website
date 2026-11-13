import React, { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { NavCard, NavCardGrid } from '@omnitron-dev/prism/components';

const SiteLink = forwardRef<HTMLAnchorElement, ComponentPropsWithoutRef<'a'> & { to: string }>(
  ({ to, ...rest }, ref) => <a ref={ref} href={to} {...rest} />
);

export default function NavCardExample() {
  return <NavCardGrid minTileWidth={190} gap={1}>
    <NavCard title="Install Omnitron" description="Prepare a development machine"
      to="/docs/getting-started/installation" linkComponent={SiteLink} />
    <NavCard title="Run a project" description="Build and start a first application"
      to="/docs/getting-started/quickstart" linkComponent={SiteLink} />
  </NavCardGrid>;
}
