import React, { type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { PrismProvider } from '@omnitron-dev/prism/core';
import { useSettingsStore } from '@omnitron-dev/prism/state';

type PreviewMode = 'navigation-progress' | 'scroll-to-top' | 'settings';

/** The same example module is loaded by the site and, separately, by its private preview document. */
export function mountDocument(mode: PreviewMode, Screen: ComponentType) {
  if (typeof document === 'undefined' || window.parent === window || document.body?.dataset.preview !== mode) return;
  const root = document.getElementById('preview-root');
  if (!root) return;
  // These settings belong only to this frame. No preference changes are written to the site's browser storage.
  useSettingsStore.persist.setOptions({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } });
  useSettingsStore.getState().reset();
  createRoot(root).render(<PrismProvider mode="light"><Screen /></PrismProvider>);
}

export function RoutePreview({ entry, mode, title }: { entry: string; mode: PreviewMode; title: string }) {
  const src = entry.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const content = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body data-preview="${mode}"><div id="preview-root"></div><script type="module" src="${src}"></script></body></html>`;
  return <iframe title={title} srcDoc={content}
    style={{ width: '100%', height: mode === 'settings' ? 300 : 190, border: 0, display: 'block' }} />;
}
