import React from 'react';
import { SettingsDrawer, SettingsProvider, useSettings } from '@omnitron-dev/prism/components';
import { Button, Stack } from '@omnitron-dev/prism/ui';
import { mountDocument, RoutePreview } from './frame/route-preview';

function Preferences() {
  const { settings, drawer } = useSettings();
  return <Stack spacing={1} sx={{ alignItems: 'flex-start' }}>
    <Button onClick={drawer.onOpen}>Open preview preferences</Button>
    <output>Density: {settings.density}</output>
    <SettingsDrawer sections={['density']} width={260} />
  </Stack>;
}

/** Mounted by the preview entry with an in-memory Prism store. */
export function SettingsDocument() {
  return <SettingsProvider><Preferences /></SettingsProvider>;
}

mountDocument('settings', SettingsDocument);

export default function SettingsExample() {
  return <RoutePreview entry={import.meta.url} mode="settings" title="Preferences preview" />;
}
