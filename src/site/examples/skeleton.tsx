import { useState } from 'react';
import { CardSkeleton } from '@omnitron-dev/prism/components/skeleton';
import { Card } from '@omnitron-dev/prism/components/card';
import { Button, Stack } from '@omnitron-dev/prism/ui';

export default function SkeletonExample() {
  const [ready, setReady] = useState(false);
  return <Stack spacing={1}>
    {ready ? <Card title="Worker pool">3 active workers</Card> : <CardSkeleton lines={2} hasAvatar={false} />}
    <Button onClick={() => setReady(!ready)}>{ready ? 'Show placeholder' : 'Show content'}</Button>
  </Stack>;
}
