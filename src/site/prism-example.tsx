import { lazy, Suspense, useState, type ComponentType } from 'react';
import { ComponentExample } from '@omnitron-dev/lumen-ui/blocks';
import { useIsClient } from '@omnitron-dev/prism/core';
import { ErrorBoundary } from '@omnitron-dev/prism/components/error-boundary';
import { Alert, Box, Button } from '@omnitron-dev/prism/ui';

// The same checked-in module supplies the runnable component and its displayed source.
const modules = import.meta.glob<{ default: ComponentType }>('./examples/*.tsx');
const sources = import.meta.glob<string>('./examples/*.tsx', { query: '?raw', import: 'default' });

function loadExample(key: string) {
  return lazy(async () => {
    const [{ default: Preview }, code] = await Promise.all([modules[key](), sources[key]()]);
    function PreviewAndSource() {
      return <ComponentExample title="Interactive example" code={code} language="tsx" resettable>
        <Preview />
      </ComponentExample>;
    }
    return { default: PreviewAndSource };
  });
}

const previews = new Map(Object.keys(modules).map(key => [key, loadExample(key)]));

export function PrismExample({ example, deferred = false }: { example: string; deferred?: boolean | string }) {
  const interactive = useIsClient();
  const optIn = deferred === true || deferred === 'true';
  const [active, setActive] = useState(!optIn);
  const Preview = previews.get(`./examples/${example}.tsx`);
  if (!Preview) return <Alert role="alert" severity="error">Unknown Prism documentation example: {example}</Alert>;
  return <Box component="section" data-example={example} aria-label={`${example} example`}
    sx={{ my: 2, minWidth: 0 }}>
    <Box component="fieldset" disabled={!interactive} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
      {active ? <ErrorBoundary fallback={({ error }) => <Alert severity="error">{error.message}</Alert>}>
        {optIn ? <Suspense fallback={<span role="status">Loading example…</span>}><Preview /></Suspense> : <Preview />}
      </ErrorBoundary> : <Button onClick={() => setActive(true)}>Load example</Button>}
    </Box>
  </Box>;
}
