---
sidebar_position: 8
title: Maps
description: Self-hosted MapLibre maps, markers, a point picker and a coverage layer.
---

# Maps

Prism ships four map components built on `react-map-gl/maplibre`. They pick up
the Prism theme, and they are written for a platform whose tiles are its own —
no third-party CDN is contacted at any point.

```tsx
import { Map, MapMarker, MapPointPicker, MapCoverageLayer } from '@omnitron-dev/prism/components';
```

## The tile source is yours

`<Map>` never falls back to a hosted tile provider. A style must come from one
of two places:

1. the `styleUrl` prop — a style JSON URL or an inline `StyleSpecification`;
2. `window.__MAP_STYLE_URL__`, which the host app injects at boot.

With neither, the map renders a **flat grey background** rather than an error
or a blank element. That fallback is deliberately unattractive: a map that
silently rendered nothing would look like a layout bug, and one that quietly
reached a public CDN would break the closed-platform guarantee without saying
so. Grey means "the tile source is not wired up yet", and it means it visibly.

`pmtiles://` is registered as a protocol on first mount, so a single-file
PMTiles archive served over plain HTTP is a valid style source — which is the
cheapest way to self-host, and works over Tor without a special case.

## `<Map>`

| Prop | Type | Default | Effect |
| ---- | ---- | ------- | ------ |
| `styleUrl` | `string \| StyleSpecification` | env var, then grey | Vector tile style |
| `viewport` | `Partial<MapViewport>` | — | Controlled camera; pair with `onViewportChange` |
| `initialViewport` | `Partial<MapViewport>` | Moscow, country zoom | Defaults when uncontrolled |
| `onViewportChange` | `(next: MapViewport) => void` | — | Every drag, zoom and rotate |
| `onClick` | `(e: { lngLat: { lng, lat } }) => void` | — | Click on the canvas |
| `showNavigation` | `boolean` | `true` | Zoom + compass control |
| `showScale` | `boolean` | `true` | Scale control |
| `showAttribution` | `boolean` | `true` | Attribution control |
| `style` | `CSSProperties` | 400 px tall | **Pass `height` here** |
| `cursor` | `string` | `'grab'` | Idle cursor |

The container is 400 px tall unless you say otherwise, and height goes in
`style` rather than in a prop of its own.

## `<MapMarker>`

A pin at a coordinate, themed by default and replaceable wholesale.

| Prop | Type | Effect |
| ---- | ---- | ------ |
| `longitude` / `latitude` | `number` | Position |
| `color` | `string` | Fill; defaults to the theme primary |
| `children` | `ReactNode` | Custom DOM instead of the default pin |
| `popup` | `ReactNode` | Popup body, opened on click |
| `anchor` | `'center' \| 'top' \| 'bottom' \| 'left' \| 'right'` | Default `bottom`, so the pin tip sits on the coordinate |
| `onClick` | `() => void` | Click-through handler |

## `<MapPointPicker>`

Controlled "click to choose a coordinate". Emits on both map click and
marker drag-end.

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

## `<MapCoverageLayer>`

Many typed points as one MapLibre symbol layer — the right choice when a
marker per item would be hundreds of DOM nodes.

```tsx
<MapCoverageLayer
  id="drops"
  points={drops.map((d) => ({
    id: d.id,
    longitude: d.lng,
    latitude: d.lat,
    status: d.status,     // bucket → colour
    label: d.title,       // shown at zoom 12+ when showLabels
  }))}
  colorByStatus={{ active: 'green', expired: 'grey' }}
  showLabels
/>
```

`status` is a free-form bucket, not an enum: the default palette covers
`active` / `pending` / `expired` / `disabled`, and `colorByStatus` replaces it
with your own domain's semantics. `radius` defaults to 6 px and is zoom-stable.

## Related

- [Components catalog](./components.md) — the rest of the widget set.
- [Theme](./theme.md) — the palette these components read.
