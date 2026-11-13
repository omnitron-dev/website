import { useState } from 'react';
import { SearchInput } from '@omnitron-dev/prism/components/search-input';

export default function SearchExample() {
  const [query, setQuery] = useState('');
  const rows = ['Gateway', 'Worker', 'Scheduler'].filter(name => name.toLowerCase().includes(query.toLowerCase()));
  return <>
    <SearchInput aria-label="Find a service" placeholder="Find a service" value={query} onChange={setQuery} debounce={180} />
    <ul>{rows.map(row => <li key={row}>{row}</li>)}</ul><output>{rows.length} services</output>
  </>;
}
