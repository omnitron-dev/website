import { useState } from 'react';
import { Avatar, CustomAvatarGroup } from '@omnitron-dev/prism/components';
import { Stack, TextField } from '@omnitron-dev/prism/ui';

export default function AvatarExample() {
  const [name, setName] = useState('Lin Chen');
  return <Stack spacing={2}>
    <TextField size="small" label="Display name" value={name} onChange={event => setName(event.target.value)} />
    <Avatar name={name} online /><CustomAvatarGroup avatars={[{ name }, { name: 'Sam Liu' }, { name: 'Alex Roy' }]} max={3} />
  </Stack>;
}
