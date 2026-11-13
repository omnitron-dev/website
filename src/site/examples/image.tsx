import { useState } from 'react';
import { Image } from '@omnitron-dev/prism/components';
import { Button, Stack } from '@omnitron-dev/prism/ui';

export default function ImageExample() {
  const [ratio, setRatio] = useState<'1/1' | '16/9'>('16/9');
  return <Stack spacing={1} sx={{ maxWidth: 240 }}>
    <Image src="/img/logo.svg" alt="Omnitron mark" ratio={ratio} sx={{ objectFit: 'contain' }} />
    <Button onClick={() => setRatio(ratio === '1/1' ? '16/9' : '1/1')}>Change aspect ratio</Button>
  </Stack>;
}
