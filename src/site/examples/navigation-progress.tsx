import React, { useState } from 'react';
import { Button } from '@omnitron-dev/prism/ui';
import { NavigationProgress } from '@omnitron-dev/prism/components/navigation-progress';
import { mountDocument, RoutePreview } from './frame/route-preview';

export function NavigationProgressDocument() {
  const [analysis, setAnalysis] = useState(false);
  const title = analysis ? 'Analysis' : 'Measurements';
  const next = analysis ? 'Measurements' : 'Analysis';
  return <>
    <NavigationProgress pathname={`/preview/${title.toLowerCase()}`} delay={600} />
    <header><strong>{title}</strong></header>
    <p>{analysis ? 'Compare the observations with the baseline.' : 'Record the sample and its units.'}</p>
    <Button type="button" onClick={() => setAnalysis(current => !current)}>Open {next}</Button>
  </>;
}

mountDocument('navigation-progress', NavigationProgressDocument);

export default function NavigationProgressExample() {
  return <RoutePreview entry={import.meta.url} mode="navigation-progress" title="Route progress preview" />;
}
