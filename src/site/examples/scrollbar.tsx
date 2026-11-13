import { Scrollbar } from '@omnitron-dev/prism/components';

export default function ScrollbarExample() {
  return <Scrollbar tabIndex={0} role="region" aria-label="Build steps" sx={{ height: 100 }}>
    <ol>{['Resolve', 'Install', 'Typecheck', 'Compile', 'Package', 'Verify'].map(step => <li key={step}>{step}</li>)}</ol>
  </Scrollbar>;
}
