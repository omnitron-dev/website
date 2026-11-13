import React, { useState } from 'react';
import { DataGridBlock, type DataGridBlockProps } from '@omnitron-dev/prism/blocks';

const rows = [
  { id: 'north', station: 'North platform', samples: 12 },
  { id: 'east', station: 'East receiver', samples: 7 },
  { id: 'south', station: 'South platform', samples: 18 },
];
const columns: DataGridBlockProps<(typeof rows)[number]>['columns'] = [
  { field: 'station', headerName: 'Station', flex: 1, minWidth: 120 },
  { field: 'samples', headerName: 'Samples', type: 'number', width: 100 },
];

export default function DataGridBlockExample() {
  const [selected, setSelected] = useState<string>();
  return <>
    <DataGridBlock rows={rows} columns={columns} height={320}
      toolbar={{ quickFilter: { placeholder: 'Filter stations' },
        columnVisibility: { enabled: false }, densitySelector: false, export: { csv: false, print: false } }}
      pagination={{ defaultPageSize: 2, pageSizeOptions: [2, 3] }}
      onRowClick={({ row }) => setSelected(row.station)} />
    <output>{selected ? `Selected station: ${selected}` : 'Select a station'}</output>
  </>;
}
