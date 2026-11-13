import React, { useState } from 'react';
import { ScrollToTop } from '@omnitron-dev/prism/components/scroll-to-top';
import { mountDocument, RoutePreview } from './frame/route-preview';

export function ScrollRestorationDocument() {
  const [analysis, setAnalysis] = useState(false);
  const title = analysis ? 'Analysis' : 'Measurements';
  const next = analysis ? 'Measurements' : 'Analysis';
  return <>
    <ScrollToTop pathname={`/preview/${title.toLowerCase()}`} />
    <header><strong>{title}</strong></header>
    <p style={{ minHeight: 220 }}>Scroll this sample to its next page link.</p>
    <a href={`/preview/${next.toLowerCase()}`} onClick={event => {
      event.preventDefault();
      setAnalysis(current => !current);
    }}>Open {next}</a>
  </>;
}

mountDocument('scroll-to-top', ScrollRestorationDocument);

export default function ScrollToTopExample() {
  return <RoutePreview entry={import.meta.url} mode="scroll-to-top" title="Scroll restoration preview" />;
}
