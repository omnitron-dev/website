import { useState } from 'react';
import { ErrorBoundary } from '@omnitron-dev/prism/components/error-boundary';
import { Button } from '@omnitron-dev/prism/ui';

function Results({ failed }: { failed: boolean }) {
  if (failed) throw new Error('The sample result could not be read.');
  return <output>Result available</output>;
}

export default function ErrorBoundaryExample() {
  const [failed, setFailed] = useState(false);
  return <ErrorBoundary onReset={() => setFailed(false)} fallback={({ error, resetErrorBoundary }) =>
    <><p role="alert">{error.message}</p><Button onClick={resetErrorBoundary}>Retry result</Button></>}>
    <Results failed={failed} />
    <Button onClick={() => setFailed(true)}>Simulate failed read</Button>
  </ErrorBoundary>;
}
