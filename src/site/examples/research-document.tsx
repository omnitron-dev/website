import React from 'react';
import { ResearchDocument } from '@omnitron-dev/prism/components/research';
import '@omnitron-dev/prism/components/research/styles.css';

const source = `## Sampling window

We measured the same request over three warm runs.

| Run | Latency (ms) |
| --- | --- |
| A | 18 |
| B | 21 |
| C | 24 |

## Result

The median of the three observations is **21 ms**.`;

export default function ResearchDocumentExample() {
  return <ResearchDocument source={source} documentId="example-latency" contents
    labels={{ contents: 'Sections in this report' }} />;
}
