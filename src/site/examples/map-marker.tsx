import React from 'react';
import { Map, MapMarker } from '@omnitron-dev/prism/components/map';
import { Button } from '@omnitron-dev/prism/ui';
import { initialViewport, transectStyle, workerUrl } from './map';
import '@omnitron-dev/prism/components/map/styles.css';

export default function MapMarkerExample() {
  return <Map styleUrl={transectStyle} workerUrl={workerUrl} initialViewport={initialViewport} style={{ height: 260 }}>
    <MapMarker longitude={0} latitude={51.5} anchor="center" popup="Zero meridian · 51.500° N">
      <Button variant="contained" size="small" aria-label="Inspect reference station">Station A</Button>
    </MapMarker>
  </Map>;
}
