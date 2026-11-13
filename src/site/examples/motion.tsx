import { AnimateBorder, MotionLazy } from '@omnitron-dev/prism/components/animate';
import { Box } from '@omnitron-dev/prism/ui';

export default function MotionExample() {
  return <MotionLazy><AnimateBorder duration={8}>
    <Box sx={{ p: 2, textAlign: 'center' }}>Service discovered</Box>
  </AnimateBorder></MotionLazy>;
}
