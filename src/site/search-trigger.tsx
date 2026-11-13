import { createContext, useContext } from 'react';
import { Button } from '@omnitron-dev/prism/ui';

export const OpenSearch = createContext<(() => void) | null>(null);

export function SearchTrigger({ full = false }: { full?: boolean }) {
  const open = useContext(OpenSearch);
  return <Button type="button" className={full ? undefined : 'search-trigger'} disabled={!open}
    onClick={open ?? undefined} aria-haspopup="dialog" data-open-search={full ? undefined : ''}>
    {full ? 'Search all documentation' : <>Search <kbd>/</kbd></>}
  </Button>;
}
