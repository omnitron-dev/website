import React, { useState } from 'react';
import { MapPointPicker, type MapPointPickerValue, type MapStyle } from '@omnitron-dev/prism/components/map';
import '@omnitron-dev/prism/components/map/styles.css';

// Include the MapLibre worker in the browser build alongside the local GeoJSON source.
export const workerUrl = new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).href;

export const transectStyle: MapStyle = {
  version: 8,
  sources: {
    transect: { type: 'geojson', data: {
      type: 'Feature', properties: {},
      geometry: { type: 'LineString', coordinates: [[-0.04, 51.48], [0, 51.5], [0.04, 51.52]] },
    } },
  },
  layers: [
    { id: 'surface', type: 'background', paint: { 'background-color': '#162630' } },
    { id: 'transect', type: 'line', source: 'transect', paint: { 'line-color': '#69daca', 'line-width': 4 } },
  ],
};
export const initialViewport = { longitude: 0, latitude: 51.5, zoom: 11 };

export default function MapExample() {
  const [point, setPoint] = useState<MapPointPickerValue | null>({ lng: 0, lat: 51.5 });
  return <MapPointPicker value={point} onChange={setPoint} onClear={() => setPoint(null)}
    styleUrl={transectStyle} mapProps={{ workerUrl }} initialViewport={initialViewport} height={280}
    labels={{ chooseCenter: 'Select map center', clear: 'Clear sample point' }} />;
}
