import { useState } from 'react';
import { Drawer } from '@omnitron-dev/prism/components';
import { Button, TextField } from '@omnitron-dev/prism/ui';

export default function DrawerExample() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('Gateway');
  return <>
    <Button onClick={() => setOpen(true)}>Edit display name</Button><output>{value}</output>
    <Drawer title="Display name" open={open} width="min(24rem, 100vw)" onClose={() => setOpen(false)}>
      <TextField autoFocus label="Name" value={value} onChange={event => setValue(event.target.value)} />
    </Drawer>
  </>;
}
