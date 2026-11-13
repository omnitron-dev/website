import { PageContent } from '@omnitron-dev/prism/components/page-content';
import { Breadcrumbs } from '@omnitron-dev/prism/components/breadcrumbs';
import { Card } from '@omnitron-dev/prism/components/card';

export default function PageContentExample() {
  return <PageContent gap={2}>
    <Breadcrumbs links={[{ name: 'Frontend', href: '/docs/frontend/overview' }, { name: 'Sample workspace' }]} />
    <Card variant="outlined" title="Sample workspace">2 deployments</Card>
  </PageContent>;
}
