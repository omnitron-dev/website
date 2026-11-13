import React, { useState } from 'react';
import { DocLayout, DocSidebar } from '@omnitron-dev/prism/components/doc-layout';
import { Button } from '@omnitron-dev/prism/ui';

const pages = [
  { id: 'prepare', label: 'Prepare', text: 'Record the release and the intended target before the change.' },
  { id: 'verify', label: 'Verify', text: 'Check the running release and keep the acceptance receipt.' },
];

export default function DocLayoutExample() {
  const [index, setIndex] = useState(0);
  const section = pages[index];
  return <DocLayout sx={{ '& > nav': { width: 102, pr: 1, top: 0 } }}
    sidebar={<DocSidebar title="Release notes" activeId={section.id} items={pages}
      onItemClick={item => setIndex(pages.findIndex(page => page.id === item.id))} />}>
    <strong>{section.label}</strong>
    <p>{section.text}</p>
    <Button onClick={() => setIndex(1 - index)}>{pages[1 - index].label}</Button>
  </DocLayout>;
}
