import { useState } from 'react';
import { Table } from '@omnitron-dev/prism/components/table';

const samples = [
  { id: 'alpha', latency: 28 }, { id: 'beta', latency: 12 }, { id: 'gamma', latency: 19 },
];

export default function TableExample() {
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<(string | number)[]>([]);
  const sorted = [...samples].sort((a, b) => (a.latency - b.latency) * (order === 'asc' ? 1 : -1));
  return <>
    <Table rowKey="id" data={sorted} columns={[{ id: 'id', label: 'Worker' }, { id: 'latency', label: 'Latency (ms)', sortable: true }]}
      sortable sortBy="latency" sortOrder={order} onSortChange={(_, next) => setOrder(next)}
      selectable selected={selected} onSelectChange={setSelected} />
    <output>{selected.length} selected</output>
  </>;
}
