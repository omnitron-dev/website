import React, { useState } from 'react';
import { MapPlaceSearch, type MapPlace } from '@omnitron-dev/prism/components/map';
import { Stack } from '@omnitron-dev/prism/ui';

const places: MapPlace[] = [
  { id: 'station:east', label: 'East platform', point: { lng: 0.017, lat: 51.506 } },
  { id: 'station:west', label: 'West platform', point: { lng: -0.017, lat: 51.494 } },
];

export default function MapPlaceSearchExample() {
  const [selected, setSelected] = useState<MapPlace>();
  return <Stack spacing={1}>
    <MapPlaceSearch labels={{ label: 'Station name', search: 'Find station' }}
      search={async (query, { signal, limit }) => {
        signal.throwIfAborted();
        return places.filter(place => place.label.toLowerCase().includes(query.toLowerCase())).slice(0, limit);
      }} onSelect={setSelected} />
    <output>{selected ? `${selected.label}: ${selected.point.lat}, ${selected.point.lng}` : 'Search for East or West'}</output>
  </Stack>;
}
