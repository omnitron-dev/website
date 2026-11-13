import React, { useState } from 'react';
import { Editor } from '@omnitron-dev/prism/components/editor';
import { TipTapRenderer, type TipTapDoc } from '@omnitron-dev/prism/components';
import { Stack } from '@omnitron-dev/prism/ui';

const initialDocument: TipTapDoc = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Record an observation.' }] }],
};

export default function EditorExample() {
  const [document, setDocument] = useState(initialDocument);
  return <Stack spacing={2}>
    <Editor toolbar="compact" format="json" minHeight={88}
      value={JSON.stringify(document)} onChange={value => setDocument(JSON.parse(value))} />
    <section aria-label="Rendered document"><TipTapRenderer content={document} compact /></section>
  </Stack>;
}
