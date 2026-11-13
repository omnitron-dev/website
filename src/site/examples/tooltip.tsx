import { useState } from 'react';
import { Tooltip } from '@omnitron-dev/prism/components';
import { Button } from '@omnitron-dev/prism/ui';

export default function TooltipExample() {
  const [pinned, setPinned] = useState(false);
  return <Tooltip title={pinned ? 'Remove from your shortcuts' : 'Add to your shortcuts'} placement="top">
    <Button aria-pressed={pinned} onClick={() => setPinned(!pinned)}>{pinned ? 'Unpin view' : 'Pin view'}</Button>
  </Tooltip>;
}
