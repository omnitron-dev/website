import React, { useState } from 'react';
import { DashboardBlock } from '@omnitron-dev/prism/blocks';
import { Button } from '@omnitron-dev/prism/ui';

const samples = [21, 18, 24];

export default function DashboardBlockExample() {
  const [sample, setSample] = useState(0);
  return <DashboardBlock title="Median request latency" subtitle="Three local observations" collapsible
    labels={{ expand: 'Expand observations', collapse: 'Collapse observations' }}
    actions={<Button size="small" onClick={() => setSample(index => (index + 1) % samples.length)}>Next observation</Button>}>
    <output>{`Run ${sample + 1}: ${samples[sample]} ms`}</output>
  </DashboardBlock>;
}
