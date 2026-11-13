import { useState } from 'react';
import { Avatar, Badge, CountBadge, StatusDot } from '@omnitron-dev/prism/components';
import { Button, Stack } from '@omnitron-dev/prism/ui';

export default function BadgeExample() {
  const [count, setCount] = useState(2);
  return <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
    <Badge variant="dot" color="success"><Avatar name="Lin Chen" /></Badge>
    <CountBadge count={count} max={9}>Inbox</CountBadge><StatusDot status={count ? 'busy' : 'online'} />
    <Button onClick={() => setCount(count ? count - 1 : 2)}>{count ? 'Mark one read' : 'Add messages'}</Button>
  </Stack>;
}
