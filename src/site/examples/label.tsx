import { useState } from 'react';
import { Label, BooleanLabel } from '@omnitron-dev/prism/components/label';
import { Button, Stack } from '@omnitron-dev/prism/ui';

export default function LabelExample() {
  const [enabled, setEnabled] = useState(true);
  return <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
    <Label color={enabled ? 'success' : 'warning'}>{enabled ? 'Ready' : 'Paused'}</Label><BooleanLabel value={enabled} />
    <Button onClick={() => setEnabled(!enabled)}>Toggle state</Button>
  </Stack>;
}
