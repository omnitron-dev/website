import { useState, type ReactNode } from 'react';
import { CodeBlock } from '@omnitron-dev/lumen-ui/blocks';
import { Tabs } from '@omnitron-dev/prism/components/tabs';
import { Alert, Box, Button, Chip, Stack, Typography } from '@omnitron-dev/prism/ui';
import fixture from '../../data/lumen-pipeline.json';

const json = (value: unknown) => JSON.stringify(value, null, 2);
const pair = { display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2 };

function Output({ title, children }: { title: string; children: ReactNode }) {
  return <Box component="section" aria-label={title} sx={{ minWidth: 0 }}>
    <Typography component="h3" variant="subtitle2" sx={{ mb: 1 }}>{title}</Typography>
    {children}
  </Box>;
}

function Code({ value, language = 'json' }: { value: string; language?: string }) {
  return <Box sx={{ minWidth: 0, '& .lumen-code-block': { maxHeight: 272, fontSize: '0.75rem' } }}>
    <CodeBlock code={value} language={language} />
  </Box>;
}

// This is a real stateful component. The mode switch demonstrates handlers;
// it does not unload React or re-run Lumen's hydration lifecycle.
function ClickExample({ enabled }: { enabled: boolean }) {
  const [clicks, setClicks] = useState(0);
  return <Stack spacing={2} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
    <Typography role="status" aria-live="polite">Recorded clicks: {clicks}</Typography>
    <Button variant="outlined" disabled={!enabled} onClick={() => setClicks(value => value + 1)}>
      Record a click
    </Button>
    <Typography variant="caption" color="text.secondary">
      {enabled ? 'The React handler updates local state. No network request is made.' : 'Readable preview; this example intentionally disables its button.'}
    </Typography>
  </Stack>;
}

function GateResult({ broken }: { broken: boolean }) {
  const result = broken ? fixture.checks.broken : fixture.checks.valid;
  return <Stack spacing={2}>
    <Alert severity={result.passed ? 'success' : 'error'}>
      {result.passed ? 'Both gates passed for the captured corpus.' : 'The missing document was rejected by the captured gate run.'}
    </Alert>
    <Typography variant="body2">The link points to <code>{broken ? './missing.md#acceptance' : './verify.md#acceptance'}</code>.</Typography>
    <Code value={json(result)} />
  </Stack>;
}

const stages = [
  {
    value: 'parse', label: '1 · Parse', location: 'Build process',
    description: 'The parser reads source as document data. This captured tree keeps node kinds and meaningful fields; source positions and other fields are omitted from this view.',
    boundary: 'Parsing does not execute source imports or prove that a linked document exists.',
    content: <Box sx={pair}>
      <Output title="Input · docs/start.md"><Code value={fixture.sources['start.md']} language="markdown" /></Output>
      <Output title="Output · selected AST fields"><Code value={json(fixture.parsed)} /></Output>
    </Box>,
  },
  {
    value: 'link', label: '2 · Link', location: 'Build process',
    description: 'The corpus collects both documents, their routes and anchors. The link from start.md resolves to the acceptance heading in verify.md.',
    boundary: 'Document identity, a source filename and a public route are separate values.',
    content: <Box sx={pair}>
      <Output title="Input · docs/verify.md"><Code value={fixture.sources['verify.md']} language="markdown" /></Output>
      <Stack spacing={2}>
        <Output title="Output · corpus inventory"><Code value={json(fixture.corpus)} /></Output>
        <Output title="Output · resolved anchor"><Code value={json(fixture.resolution)} /></Output>
      </Stack>
    </Box>,
  },
  {
    value: 'verify', label: '3 · Verify', location: 'Build process',
    description: 'Compare two real gate results captured by the fixture generator. The second input changes only the link target from verify.md to missing.md.',
    boundary: 'Switching cases displays recorded API results; it does not run a compiler in this browser.',
    content: <Tabs defaultValue="valid" variant="scrollable" scrollButtons="auto" aria-label="Captured verification case" tabs={[
      { value: 'valid', label: 'Valid link', content: <GateResult broken={false} /> },
      { value: 'broken', label: 'Missing target', content: <GateResult broken /> },
    ]} />,
  },
  {
    value: 'project', label: '4 · Project', location: 'Before public output',
    description: `Anonymous projection keeps ${fixture.projection.afterNodes} of ${fixture.projection.beforeNodes} top-level nodes. The note marked internal is removed. Both sides are fictional teaching material, with no confidential data.`,
    boundary: 'Projection removes content before publication. A browser-side visibility toggle would not provide the same boundary.',
    content: <Box sx={pair}>
      <Output title="Before · parsed author content"><Code value={fixture.projection.original} language="markdown" /></Output>
      <Output title="After · anonymous projection"><Code value={fixture.projection.public} language="markdown" /></Output>
    </Box>,
  },
  {
    value: 'render', label: '5 · Render', location: 'Build process',
    description: 'Inspect outputs generated from the public corpus. The HTML is a toHtmlSsr document fragment, before the site layout and route rewriting. Search records accompany a real Pagefind build.',
    boundary: 'The site publishes files; reading them does not require a Titan service. Receiving a file grants access to its contents.',
    content: <Tabs defaultValue="html" variant="scrollable" scrollButtons="auto" aria-label="Captured public artifact" tabs={[
      { value: 'html', label: 'HTML', content: <Code value={fixture.outputs.html} language="html" /> },
      { value: 'markdown', label: 'Markdown', content: <Code value={fixture.outputs.markdown} language="markdown" /> },
      { value: 'search', label: 'Search', content: <Stack spacing={1}>
        <Typography variant="body2">{fixture.outputs.searchFiles.length} Pagefind files were generated for this two-document corpus. This panel shows the search records, not a live search interface.</Typography>
        <Code value={json(fixture.outputs.search)} />
      </Stack> },
      { value: 'agents', label: 'Agent index', content: <Code value={fixture.outputs.agentIndex} language="markdown" /> },
    ]} />,
  },
  {
    value: 'activate', label: '6 · Activate', location: 'Reader’s browser',
    description: 'A trusted React component supplies behavior. Try the same small control with handlers disabled or enabled. The interactive version really updates its local state.',
    boundary: 'This explorer is already an active Lumen island. The switch demonstrates behavior; it does not restart hydration, change loading triggers or measure performance.',
    content: <Tabs defaultValue="static" variant="scrollable" scrollButtons="auto" aria-label="Example interaction mode" tabs={[
      { value: 'static', label: 'Static preview', content: <ClickExample enabled={false} /> },
      { value: 'interactive', label: 'Interactive component', content: <ClickExample enabled /> },
    ]} />,
  },
];

export default function LumenPipelineExample() {
  return <Stack spacing={2} data-lumen-explorer sx={{ minWidth: 0 }}>
    <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
      <Chip size="small" variant="outlined" label="Architecture walkthrough" />
      <Chip size="small" variant="outlined" label={`Captured with Lumen ${fixture.sdkVersion}`} />
    </Stack>
    <Typography variant="body2" color="text.secondary">
      Follow two documents from source to publication, then try a live React control. Select a stage; arrow keys move between stage tabs.
    </Typography>
    <Tabs defaultValue="parse" variant="scrollable" scrollButtons="auto" aria-label="Lumen pipeline stage" tabs={stages.map(stage => ({
      value: stage.value, label: stage.label,
      content: <Stack spacing={2} sx={{ minWidth: 0, py: 1 }}>
        <Typography variant="overline" color="text.secondary">{stage.location}</Typography>
        <Typography variant="body2">{stage.description}</Typography>
        {stage.content}
        <Alert severity="info" role="note">{stage.boundary}</Alert>
      </Stack>,
    }))} />
  </Stack>;
}
