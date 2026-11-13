import React, { useState } from 'react';
import { ResearchEditor } from '@omnitron-dev/prism/components/research-editor';
import { Button, Stack } from '@omnitron-dev/prism/ui';
import '@omnitron-dev/prism/components/research-editor/styles.css';

const initialSource = '## Observation\n\nThe warm run completed in 21 ms.';

export default function ResearchEditorExample() {
  const [draft, setDraft] = useState(initialSource);
  const [saved, setSaved] = useState(initialSource);
  return <Stack spacing={2}>
    <ResearchEditor initialSource={initialSource} onChange={snapshot => setDraft(snapshot.getSource())} />
    <Button onClick={() => setSaved(draft)} disabled={draft === saved}>Save snapshot</Button>
    <details><summary>Saved Markdown</summary><pre><code>{saved}</code></pre></details>
  </Stack>;
}
