import { lazy, Suspense, useState, type ComponentType } from 'react';
import { CodeBlock } from '@omnitron-dev/lumen-ui/blocks';
import { ErrorBoundary } from '@omnitron-dev/prism/components/error-boundary';
import { Accordion } from '@omnitron-dev/prism/components';
import { Alert, Box, Button, Stack } from '@omnitron-dev/prism/ui';

// The same checked-in module supplies the runnable component and its displayed source.
const modules = import.meta.glob<{ default: ComponentType }>('./examples/*.tsx');
const sources = import.meta.glob<string>('./examples/*.tsx', { query: '?raw', import: 'default' });

function loadExample(key: string) {
  return lazy(async () => {
    const [{ default: Preview }, code] = await Promise.all([modules[key](), sources[key]()]);
    function PreviewAndSource() {
      return <Stack spacing={2}>
        <Preview />
        <Accordion items={[{ id: 'source', title: 'Source code', content: <CodeBlock code={code} language="tsx" copyable /> }]} />
      </Stack>;
    }
    return { default: PreviewAndSource };
  });
}

const previews = new Map(Object.keys(modules).map(key => [key, loadExample(key)]));

export function PrismExample({ example, deferred = false }: { example: string; deferred?: boolean | string }) {
  const [active, setActive] = useState(deferred !== true && deferred !== 'true');
  const Preview = previews.get(`./examples/${example}.tsx`);
  if (!Preview) return <Alert role="alert" severity="error">Unknown Prism documentation example: {example}</Alert>;
  return <Box component="section" data-example={example} aria-label={`${example} example`}
    sx={{ my: 2, p: { xs: 1.5, sm: 2 }, minWidth: 0, border: 1, borderColor: 'divider', borderRadius: 1 }}>
    {active ? <ErrorBoundary fallback={({ error }) => <Alert severity="error">{error.message}</Alert>}>
      <Suspense fallback={<span role="status">Loading example…</span>}><Preview /></Suspense>
    </ErrorBoundary> : <Button onClick={() => setActive(true)}>Load example</Button>}
  </Box>;
}
