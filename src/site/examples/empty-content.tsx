import { useState } from 'react';
import { EmptyContent } from '@omnitron-dev/prism/components/empty-content';
import { Button } from '@omnitron-dev/prism/ui';

export default function EmptyContentExample() {
  const [created, setCreated] = useState(false);
  return created ? <><p>Personal workspace</p><Button onClick={() => setCreated(false)}>Remove workspace</Button></>
    : <EmptyContent title="No workspaces" action={<Button onClick={() => setCreated(true)}>Create workspace</Button>} />;
}
