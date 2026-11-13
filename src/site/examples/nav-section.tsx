import React, { useState } from 'react';
import { NavSectionVertical } from '@omnitron-dev/prism/components';
import { Button, Stack } from '@omnitron-dev/prism/ui';

const navigation = [{ subheader: 'Manual', items: [
  { title: 'Project structure', path: '/docs/getting-started/project-structure' },
  { title: 'Reference', path: '/docs/lumen/overview', children: [
    { title: 'API index', path: '/docs/reference/api-index' },
  ] },
  { title: 'Maintainer workflow', path: '/docs/community/contributing', allowedRoles: ['maintainer'] },
] }];

export default function NavSectionExample() {
  const [maintainer, setMaintainer] = useState(false);
  return <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
    <Button aria-pressed={maintainer} onClick={() => setMaintainer(value => !value)}>Preview maintainer navigation</Button>
    <NavSectionVertical aria-label="Manual navigation" data={navigation}
      checkPermissions={roles => !roles || (maintainer && roles.includes('maintainer'))} />
  </Stack>;
}
