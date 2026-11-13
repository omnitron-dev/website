import React from 'react';
import { IconButton } from '@omnitron-dev/prism/ui';
import { Menu, useMenu } from '@omnitron-dev/prism/components';
import { usePrismContext } from '@omnitron-dev/prism/core';
import type { ThemeMode } from '@omnitron-dev/prism/theme';
import { ThemeIcon } from './theme-icons.tsx';

export function ThemeSelector() {
  const { settings, setMode } = usePrismContext();
  const { open, handleOpen, menuProps } = useMenu();
  const modes: ThemeMode[] = ['light', 'dark', 'system'];
  const label = (mode: ThemeMode) => mode[0].toUpperCase() + mode.slice(1);
  return <>
    <IconButton className="theme-trigger" aria-label={`Color theme: ${label(settings.mode)}`}
      title={`Color theme: ${label(settings.mode)}`} aria-haspopup="menu" aria-expanded={open} onClick={handleOpen}>
      <ThemeIcon mode={settings.mode} />
    </IconButton>
    <Menu {...menuProps} minWidth={180} items={modes.map(mode => ({ key: mode,
      label: label(mode) + (settings.mode === mode ? ' · current' : ''),
      icon: <ThemeIcon mode={mode} />, onClick: () => setMode(mode),
    }))} />
  </>;
}
