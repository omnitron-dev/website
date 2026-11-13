import { useState } from 'react';
import { LinearProgress, CircularProgress, ProgressBar, CountdownRing } from '@omnitron-dev/prism/components';
import { Button, Slider, Stack } from '@omnitron-dev/prism/ui';

export default function ProgressExample() {
  const [value, setValue] = useState(60);
  const [deadline, setDeadline] = useState<Date | null>(null);
  return <Stack spacing={2}>
    <Slider aria-label="Completed percentage" value={value} onChange={(_, next) => setValue(Number(next))} valueLabelDisplay="auto" />
    <LinearProgress variant="determinate" value={value} />
    <CircularProgress variant="determinate" value={value} />
    <ProgressBar segments={[{ value, color: 'success', label: 'Done' }, { value: 100 - value, color: 'info', label: 'Queued' }]} />
    <Button onClick={() => setDeadline(new Date(Date.now() + 10000))}>Start 10-second countdown</Button>
    {deadline && <CountdownRing deadline={deadline} totalMs={10000} />}
  </Stack>;
}
