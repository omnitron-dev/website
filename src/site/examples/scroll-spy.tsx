import React, { useId, useState } from 'react';
import { ScrollSpyProvider, useScrollSpy } from '@omnitron-dev/prism/components';
import { Box } from '@omnitron-dev/prism/ui';

const sections = [
  { title: 'Observe', text: 'Capture a stable sample before changing the workload.' },
  { title: 'Compare', text: 'Compare the same workload under both configurations.' },
  { title: 'Record', text: 'Keep the measurement with its units and configuration.' },
];

function ActiveSection({ prefix }: { prefix: string }) {
  const { activeId } = useScrollSpy();
  const section = sections.find((_, index) => activeId === `${prefix}-${index}`);
  return <Box component="output" aria-live="polite" sx={{ position: 'sticky', top: 0, display: 'block', bgcolor: 'background.paper', p: 1 }}>
    Current section: {section?.title ?? 'Measuring…'}
  </Box>;
}

export default function ScrollSpyExample() {
  const prefix = useId();
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  return <Box ref={setRoot} role="region" aria-label="Scrollable observations" tabIndex={0}
    sx={{ height: 180, overflowY: 'auto', overscrollBehaviorY: 'contain', pb: 1 }}>
    {root && <ScrollSpyProvider offset={0} root={root} headingSelector="[data-observation]">
      <ActiveSection prefix={prefix} />
      {sections.map(({ title, text }, index) => <Box key={title} id={`${prefix}-${index}`} data-observation
        sx={{ minHeight: 180, px: 1, py: 1, boxSizing: 'border-box' }}>
        <strong>{title}</strong><p>{text}</p>
      </Box>)}
    </ScrollSpyProvider>}
  </Box>;
}
