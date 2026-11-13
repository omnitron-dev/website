import { Accordion } from '@omnitron-dev/prism/components';

export default function AccordionExample() {
  return <Accordion multiple items={[
    { id: 'transport', title: 'Transport', content: 'Netron routes typed service calls.' },
    { id: 'runtime', title: 'Runtime', content: 'Titan hosts application services.' },
  ]} />;
}
