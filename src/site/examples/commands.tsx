import { useState } from 'react';
import { CommandPalette } from '@omnitron-dev/prism/components/command-palette';
import { Button, Stack } from '@omnitron-dev/prism/ui';

export default function CommandsExample() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('Summary');
  return <Stack spacing={1}>
    <Button onClick={() => setOpen(true)}>Choose a view</Button><output>{view}</output>
    <CommandPalette disableShortcut open={open} onOpenChange={setOpen} actions={['Summary', 'Logs', 'Metrics'].map(title =>
      ({ id: title, title, onSelect: () => setView(title) }))} />
  </Stack>;
}
