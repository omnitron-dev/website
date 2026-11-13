import React from 'react';
import { KnowledgeGraph, type KnowledgeGraphData } from '@omnitron-dev/prism/components/knowledge-graph';
import '@omnitron-dev/prism/components/knowledge-graph/styles.css';

const graph: KnowledgeGraphData = {
  entities: [
    { id: 'sample', kind: 'dataset', label: 'Latency samples', description: 'Three warm measurements in milliseconds.' },
    { id: 'median', kind: 'statistic', label: 'Median latency', description: 'The middle value is 21 ms.' },
  ],
  relations: [{
    id: 'aggregate', kind: 'calculation', label: 'Calculate median',
    inputs: [{ entity: 'sample', role: 'observations' }],
    outputs: [{ entity: 'median', role: 'result' }],
  }],
};

export default function KnowledgeGraphExample() {
  return <KnowledgeGraph data={graph} height={360} labels={{ title: 'Latency evidence' }} />;
}
