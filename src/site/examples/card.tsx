import { useState } from 'react';
import { Card, StatCard } from '@omnitron-dev/prism/components/card';
import { Button } from '@omnitron-dev/prism/ui';

export default function CardExample() {
  const [runs, setRuns] = useState(3);
  return <Card title="Deployment queue" variant="outlined" actions={<Button onClick={() => setRuns(runs + 1)}>Queue build</Button>}>
    <StatCard label="Queued builds" value={runs} />
  </Card>;
}
