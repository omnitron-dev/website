import { useState } from 'react';
import { ConfirmDialog } from '@omnitron-dev/prism/components/confirm-dialog';
import { Button, Stack } from '@omnitron-dev/prism/ui';

export default function ConfirmDialogExample() {
  const [open, setOpen] = useState(false);
  const [archived, setArchived] = useState(false);
  return <Stack spacing={1}>
    <output>{archived ? 'Draft archived' : 'Draft in progress'}</output>
    <Button onClick={() => archived ? setArchived(false) : setOpen(true)}>{archived ? 'Restore draft' : 'Archive draft'}</Button>
    <ConfirmDialog open={open} title="Archive this draft?" content="You can restore it in this example."
      onClose={() => setOpen(false)} onConfirm={() => { setArchived(true); setOpen(false); }}
      confirmLabel="Archive" cancelLabel="Keep draft" />
  </Stack>;
}
