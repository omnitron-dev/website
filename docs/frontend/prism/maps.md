---
id: "frontend/prism/maps"
slug: "/docs/frontend/prism/maps"
sidebar_position: 8
title: Maps
description: Self-hosted MapLibre maps, markers, a point picker and a coverage layer.
---

# Maps

Prism ships reusable map components built on `react-map-gl/maplibre`. They pick up
the Prism theme, and they are written for a platform whose tiles are its own —
Prism makes no automatic requests to public providers. The host is responsible
for every URL referenced by its styles, fonts and tile sources.

```tsx
import { Map, MapMarker, MapPointPicker, MapCoverageLayer, MapPlaceSearch } from '@omnitron-dev/prism/components/map';
import '@omnitron-dev/prism/components/map/styles.css';
```

## The tile source is yours {#the-tile-source-is-yours}

`<Map>` never falls back to a hosted tile provider. A style must come from one
of three sources, in order of precedence:

1. `styleUrl` accepts a style JSON URL or an inline `StyleSpecification`.
2. `styles={{ light, dark }}` supplies complete styles for both Prism themes.
3. The host can inject `window.__MAP_STYLE_URL__` at boot.

A missing style displays a localizable alert. A progress indicator tracks loading, and a warning reports source errors.

The map entry registers `pmtiles://` before creating a map. Reference your own
HTTP-served PMTiles archive from a vector or raster source in the style.

## `<Map>` {#map}

| Prop | Type | Default | Effect |
| ---- | ---- | ------- | ------ |
| `styleUrl` | `string \| StyleSpecification` | host configuration, then alert | Vector tile style |
| `viewport` | `Partial<MapViewport>` | — | Controlled camera; pair with `onViewportChange` |
| `initialViewport` | `Partial<MapViewport>` | world, zoom 1 | Defaults when uncontrolled |
| `onViewportChange` | `(next: MapViewport) => void` | — | Every drag, zoom and rotate |
| `onClick` | `(e: { lngLat: { lng, lat } }) => void` | — | Click on the canvas |
| `showNavigation` | `boolean` | `true` | Zoom + compass control |
| `showScale` | `boolean` | `true` | Scale control |
| `showAttribution` | `boolean` | `true` | Attribution control |
| `style` | `CSSProperties` | 400 px tall | **Pass `height` here** |
| `styles` | `{ light: MapStyle; dark: MapStyle }` | — | Theme-specific styles |
| `messages` | `Partial<MapMessages>` | English | Localized label and status text |

The container is 400 px tall unless you say otherwise, and height goes in
`style` rather than in a prop of its own.

## `<MapMarker>` {#mapmarker}

A pin at a coordinate, themed by default and replaceable wholesale.

| Prop | Type | Effect |
| ---- | ---- | ------ |
| `longitude` / `latitude` | `number` | Position |
| `color` | `string` | Fill; defaults to the theme primary |
| `children` | `ReactNode` | Custom DOM instead of the default pin |
| `popup` | `ReactNode` | Popup body, opened on click |
| `anchor` | `'center' \| 'top' \| 'bottom' \| 'left' \| 'right'` | Default `bottom`, so the pin tip sits on the coordinate |
| `onClick` | `() => void` | Click-through handler |

<PrismExample example="map-marker" deferred="true" hydrate="visible" />

## `<MapPointPicker>` {#mappointpicker}

Controlled coordinate selection by map click, marker drag or the keyboard-accessible
"Select map centre" action. `labels` localizes every picker label. `selectionZoom`
(default 10) controls focus after selecting a point. `readOnly`, `showDetails`,
`onClear` and typed `mapProps` adapt the picker without an application-specific copy.
Longitude wraps at the antimeridian; latitude is validated in [-90,90]. The
Mercator camera limit never alters the stored geographical coordinate.

```tsx
const [point, setPoint] = useState<MapPointPickerValue | null>(null);

<MapPointPicker
  value={point}
  onChange={setPoint}
  height={480}
  geocodeResult={address}        // your RPC result, rendered in the side panel
  geocodeLoading={isGeocoding}
  placeholder="Click the map to choose a location"
/>
```

**Reverse geocoding is the host app's job.** The picker takes
`geocodeResult` and `geocodeLoading` and renders them; it does not know which
backend to ask, and deliberately so — the component would otherwise carry a
dependency on one app's RPC client.

<PrismExample example="map" deferred="true" hydrate="visible" />

## `<MapCoverageLayer>` {#mapcoveragelayer}

`MapCoverageLayer` draws its points in a single MapLibre circle layer. Enable
`showLabels` to add a symbol layer for names. Both layers use the same GeoJSON source.

```tsx
<MapCoverageLayer
  id="drops"
  points={drops.map((d) => ({
    id: d.id,
    longitude: d.lng,
    latitude: d.lat,
    status: d.status,     // bucket → colour
    label: d.title,       // shown at zoom 11+ when showLabels is enabled
  }))}
  colorByStatus={{ active: 'green', expired: 'grey' }}
  showLabels
/>
```

The default palette covers `active`, `pending`, `expired`, `disabled` and `retired`.
Use `colorByStatus` to add or override colors. `radius` defaults to 6 pixels at every zoom.

<PrismExample example="map-coverage" deferred="true" hydrate="visible" />

## `<MapPlaceSearch>` {#mapplacesearch}

The host supplies a provider function, typically a Netron call. The component
has no knowledge of authentication, provider credentials or public services.
Default `mode="submit"` performs a request only after explicit submission;
`mode="autocomplete"` opts into debounced search when the provider permits it.
New input aborts the previous request, and stale responses cannot replace the
current results. Provider ranking is preserved; invalid coordinates are rejected.

```tsx
<MapPlaceSearch
  search={(query, { signal, limit }) => placeProvider.search(query, { signal, limit })}
  onSelect={(place) => setPoint(place.point)}
  labels={{ label: 'Место рождения', search: 'Найти' }}
/>
```

Every result has `id`, `label` and `point: { lng, lat }`. Generic result types
preserve provider metadata. `labels`, `minLength`, `limit`, `debounceMs` and
`disabled` configure the control. Failure, empty result and loading are distinct.
The host should propagate aborts to its transport when supported.

<PrismExample example="map-place-search" deferred="true" hydrate="visible" />

## Related {#related}

- [Components catalog](./components.md) — the rest of the widget set.
- [Theme](./theme.md) — the palette these components read.
