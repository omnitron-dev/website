import React from 'react';
import { Lightbox, useLightbox } from '@omnitron-dev/prism/components';
import { Button, Stack } from '@omnitron-dev/prism/ui';

const slides = [
  { src: '/img/logo-mark.png', alt: 'Omnitron filled symbol', title: 'Filled symbol' },
  { src: '/img/logo-outline.svg', alt: 'Omnitron outlined symbol', title: 'Outline drawing' },
];

export default function LightboxExample() {
  const gallery = useLightbox({ totalSlides: slides.length });
  return <>
    <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
      {slides.map((slide, index) => <Button key={slide.src} onClick={() => gallery.onOpen(index)}
        aria-label={`Open ${slide.title}`}><img src={slide.src} alt={slide.alt} width={64} height={64} /></Button>)}
    </Stack>
    <Lightbox {...gallery.getLightboxProps()} slides={slides} thumbnails zoom keyboard />
  </>;
}
