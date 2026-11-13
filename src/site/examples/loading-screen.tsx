import { useState } from 'react';
import { LoadingScreen } from '@omnitron-dev/prism/components/loading-screen';
import { Button, Stack } from '@omnitron-dev/prism/ui';

export default function LoadingScreenExample() {
  const [loading, setLoading] = useState(true);
  return <Stack spacing={1}>
    <div role="status" aria-label={loading ? 'Loading report' : 'Report ready'}>
      {loading ? <LoadingScreen portal={false} sx={{ position: 'relative', height: 52, minHeight: 0 }} /> : 'Report ready'}
    </div>
    <Button onClick={() => setLoading(!loading)}>{loading ? 'Complete request' : 'Load again'}</Button>
  </Stack>;
}
