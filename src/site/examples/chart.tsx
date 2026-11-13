import React, { useState } from 'react';
import { Chart, type ChartOptions } from '@omnitron-dev/prism/components/chart';
import { Button, Stack } from '@omnitron-dev/prism/ui';

const options: ChartOptions = {
  chart: { toolbar: { show: false } }, xaxis: { categories: ['Run A', 'Run B', 'Run C'] },
  dataLabels: { enabled: false },
};

export default function ChartExample() {
  const [metric, setMetric] = useState<'median' | 'p95'>('median');
  const values = metric === 'median' ? [18, 21, 24] : [30, 34, 35];
  return <Stack spacing={1}>
    <Button aria-pressed={metric === 'p95'} onClick={() => setMetric(metric === 'median' ? 'p95' : 'median')}>
      Show 95th percentile
    </Button>
    <Chart type="bar" height={220} series={[{ name: 'Latency (ms)', data: values }]} options={options} />
    <output>{metric === 'median' ? 'Median' : '95th percentile'} latency (ms): {values.join(', ')}</output>
  </Stack>;
}
