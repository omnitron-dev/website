import { useState } from 'react';
import { useIsClient } from '@omnitron-dev/prism/core';
import { Box, Chip, Slider, Stack, Typography } from '@omnitron-dev/prism/ui';
import samples from '../data/flow-disk-trace.json';

export function DiskFlowTrace() {
  const interactive = useIsClient();
  const [index, setIndex] = useState(0);
  const sample = samples[index]!;
  return <Box component="section" aria-label="Recorded disk monitor" sx={{ my: 3, minWidth: 0 }}>
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
      <Typography variant="subtitle1" component="h3">Disk monitor</Typography>
      <Chip variant="outlined" size="small" color={sample.low ? 'warning' : 'default'} label={sample.low ? 'Low space' : 'Healthy'} />
    </Stack>
    <Box sx={{ px: 1, pt: 2 }}>
      <Slider disabled={!interactive} aria-label="Disk observation" value={index} min={0} max={samples.length - 1} step={1} marks
        getAriaValueText={value => `Observation ${value + 1}, ${samples[value]!.gib} GiB free`}
        onChange={(_, value) => setIndex(Number(value))} />
    </Box>
    <Typography variant="body2" aria-live="polite">{sample.gib} GiB free · {sample.effect || 'No notification'}</Typography>
    <Typography variant="caption" color="text.secondary">Observation {index + 1} of {samples.length} · {sample.path.join(' → ')}</Typography>
  </Box>;
}
