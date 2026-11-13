import React, { useState } from 'react';
import { Map, MapCoverageLayer, type CoveragePoint } from '@omnitron-dev/prism/components/map';
import { Button, Stack } from '@omnitron-dev/prism/ui';
import { initialViewport, transectStyle, workerUrl } from './map';
import '@omnitron-dev/prism/components/map/styles.css';

const stations: CoveragePoint[] = [
  { id: 'sample-a', longitude: -0.017, latitude: 51.494, label: 'Station A', status: 'active' },
  { id: 'sample-b', longitude: 0.017, latitude: 51.506, label: 'Station B', status: 'pending' },
];

export default function MapCoverageExample() {
  const [activeOnly, setActiveOnly] = useState(false);
  const [selected, setSelected] = useState('');
  const points = activeOnly ? stations.filter(station => station.status === 'active') : stations;
  return <Stack spacing={1}>
    <Button aria-pressed={activeOnly} onClick={() => { setActiveOnly(!activeOnly); setSelected(''); }}>Active stations only</Button>
    <Map styleUrl={transectStyle} workerUrl={workerUrl} initialViewport={initialViewport} style={{ height: 260 }}
      interactiveLayerIds={['stations-circles']} onClick={event => setSelected(String(event.features?.[0]?.properties.label ?? ''))}>
      <MapCoverageLayer id="stations" points={points} radius={10} />
    </Map>
    <output>{selected || points.map(point => point.label).join(', ')}</output>
  </Stack>;
}
