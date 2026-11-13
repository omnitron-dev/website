import { useState } from 'react';
import { FilterToolbar, type FilterValues } from '@omnitron-dev/prism/components/admin-filters';

export default function FiltersExample() {
  const [values, setValues] = useState<FilterValues>({});
  const results = ['Gateway', 'Scheduler', 'Worker'].filter(row => row.toLowerCase().includes(String(values.search ?? '').toLowerCase()));
  return <>
    <FilterToolbar filters={[{ key: 'search', type: 'search', label: 'Filter by name' }]}
      values={values} onChange={setValues} onReset={() => setValues({})} total={results.length} />
    <ul>{results.map(name => <li key={name}>{name}</li>)}</ul>
  </>;
}
