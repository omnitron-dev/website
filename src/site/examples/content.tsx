import { useState } from 'react';
import { ContentRenderer } from '@omnitron-dev/prism/components';
import { TextField } from '@omnitron-dev/prism/ui';

export default function ContentExample() {
  const [markdown, setMarkdown] = useState('A **typed** reply.');
  return <>
    <TextField label="Markdown source" size="small" fullWidth value={markdown} onChange={event => setMarkdown(event.target.value)} />
    <ContentRenderer content={markdown} />
  </>;
}
