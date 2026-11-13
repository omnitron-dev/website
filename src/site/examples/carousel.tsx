import React from 'react';
import { Carousel } from '@omnitron-dev/prism/components';
import { Box, Typography } from '@omnitron-dev/prism/ui';

const phases = [
  { title: 'Measure', description: 'Record three warm runs against the same fixture.' },
  { title: 'Compare', description: 'Sort the observations and select the median.' },
  { title: 'Report', description: 'Publish the result alongside its units and sampling method.' },
];

export default function CarouselExample() {
  return <Carousel arrows dots keyboard aria-label="Analysis steps" slidesToShow={1}>
    {phases.map(({ title, description }) => <Box key={title} sx={{ px: 5, py: 3 }}>
      <Typography component="strong" variant="subtitle1">{title}</Typography>
      <p>{description}</p>
    </Box>)}
  </Carousel>;
}
