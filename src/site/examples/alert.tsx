import { useState } from 'react';
import { Alert, FormAlert } from '@omnitron-dev/prism/components/alert';
import { Button, Stack } from '@omnitron-dev/prism/ui';

export default function AlertExample() {
  const [showError, setShowError] = useState(false);
  return <Stack spacing={1}>
    {showError
      ? <FormAlert title="Example validation error">An endpoint name is required in this sample.</FormAlert>
      : <Alert severity="success" title="Configuration valid">The example endpoint is named Gateway.</Alert>}
    <Button onClick={() => setShowError(!showError)}>{showError ? 'Restore valid example' : 'Show validation error'}</Button>
  </Stack>;
}
