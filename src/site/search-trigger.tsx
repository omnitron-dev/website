import { createContext, useContext } from 'react';
import { Button, IconButton } from '@omnitron-dev/prism/ui';
import { Tooltip } from '@omnitron-dev/prism/components';
import { SearchIcon } from '@omnitron-dev/prism/icons';

export const OpenSearch = createContext<(() => void) | null>(null);

export function SearchTrigger({ full = false }: { full?: boolean }) {
  const open = useContext(OpenSearch);
  return full
    ? <Button type="button" disabled={!open} onClick={open ?? undefined} aria-haspopup="dialog">
      Search all documentation
    </Button>
    : <Tooltip title="Search documentation (/)"><span>
      <IconButton type="button" disabled={!open} onClick={open ?? undefined} aria-haspopup="dialog"
        aria-label="Search documentation" data-open-search=""><SearchIcon /></IconButton>
    </span></Tooltip>;
}
