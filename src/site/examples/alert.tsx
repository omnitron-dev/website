import { useState } from 'react';
import { Alert, FormAlert } from '@omnitron-dev/prism/components/alert';
import { Button, Stack } from '@omnitron-dev/prism/ui';

export default function AlertExample() {
  const [checked, setChecked] = useState(false);
  return <Stack spacing={1}>
    {checked
      ? <Alert severity="success" title="Configuration valid">The endpoint now has a name.</Alert>
      : <FormAlert title="Endpoint name required">Give the endpoint a name before saving.</FormAlert>}
    <Button onClick={() => setChecked(!checked)}>{checked ? 'Clear name' : 'Use default name'}</Button>
  </Stack>;
}
