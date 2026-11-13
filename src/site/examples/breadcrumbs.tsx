import { Breadcrumbs } from '@omnitron-dev/prism/components/breadcrumbs';

export default function BreadcrumbsExample() {
  return <Breadcrumbs heading="Components" links={[
    { name: 'Documentation', href: '/docs/intro' },
    { name: 'Frontend', href: '/docs/frontend/overview' },
    { name: 'Components' },
  ]} />;
}
