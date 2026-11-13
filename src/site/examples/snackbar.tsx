import { useState } from 'react';
import { SimpleSnackbar } from '@omnitron-dev/prism/components/snackbar';
import { Button } from '@omnitron-dev/prism/ui';

export default function SnackbarExample() {
  const [open, setOpen] = useState(false);
  return <>
    <Button onClick={() => setOpen(true)}>Show notification</Button>
    <SimpleSnackbar open={open} onClose={() => setOpen(false)} severity="success" message="View saved" />
  </>;
}
