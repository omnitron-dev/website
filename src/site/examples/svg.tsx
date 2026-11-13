import { useState } from 'react';
import { SvgColor } from '@omnitron-dev/prism/components';
import { Button, Stack } from '@omnitron-dev/prism/ui';

export default function SvgExample() {
  const [accent, setAccent] = useState(false);
  return <Stack direction="row" spacing={2}>
    <SvgColor src="/img/logo.svg" size={32} sx={{ color: accent ? 'primary.main' : 'text.secondary' }} />
    <Button aria-pressed={accent} onClick={() => setAccent(!accent)}>Use accent color</Button>
  </Stack>;
}
