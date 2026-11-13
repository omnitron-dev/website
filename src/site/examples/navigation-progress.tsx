import React, { useState } from 'react';
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
    <a href={`/preview/${next.toLowerCase()}`} onClick={event => {
      event.preventDefault();
      setAnalysis(current => !current);
    }}>Open {next}</a>
  </>;
}

mountDocument('navigation-progress', NavigationProgressDocument);

export default function NavigationProgressExample() {
  return <RoutePreview entry={import.meta.url} mode="navigation-progress" title="Route progress preview" />;
}
