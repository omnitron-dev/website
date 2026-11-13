import { useState } from 'react';
import { DurationPicker } from '@omnitron-dev/prism/components';

export default function DurationExample() {
  const [seconds, setSeconds] = useState<number | null>(3600);
  return <><DurationPicker value={seconds} onChange={setSeconds} /><output>{seconds ?? 0} seconds</output></>;
}
