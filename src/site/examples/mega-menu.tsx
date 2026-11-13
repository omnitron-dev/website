import React from 'react';
import { MegaMenuMobile } from '@omnitron-dev/prism/components';

const sections = [{
  title: 'Documentation', path: '/docs/lumen/overview', children: [
    { subheader: 'Write a manual', items: [
      { title: 'Authoring with Lumen', path: '/docs/lumen/authoring' },
      { title: 'How this manual is built', path: '/docs/lumen/this-site' },
    ] },
  ],
}, { title: 'API reference', path: '/docs/reference/api-index' }];

export default function MegaMenuExample() {
  return <MegaMenuMobile aria-label="Documentation destinations" data={sections} />;
}
