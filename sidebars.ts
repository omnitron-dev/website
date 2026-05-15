import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docs: [
    'intro',
    {
      type: 'category',
      label: 'Getting Started',
      link: {type: 'generated-index', slug: '/category/getting-started'},
      items: [
        'getting-started/installation',
        'getting-started/quickstart',
        'getting-started/project-structure',
      ],
    },
    {
      type: 'category',
      label: 'Foundations',
      link: {type: 'generated-index', slug: '/category/foundations'},
      items: [
        'foundations/philosophy',
        'foundations/architecture',
        'foundations/monorepo',
      ],
    },
    {
      type: 'category',
      label: 'Community',
      link: {type: 'generated-index', slug: '/category/community'},
      items: [
        'community/contributing',
      ],
    },
  ],

  titan: [
    'titan/overview',
    'titan/application',
    'titan/netron',
    {
      type: 'category',
      label: 'Modules',
      link: {type: 'doc', id: 'titan/modules/index'},
      items: [
        'titan/modules/auth',
        'titan/modules/cache',
        'titan/modules/database',
        'titan/modules/discovery',
        'titan/modules/events',
        'titan/modules/health',
        'titan/modules/lock',
        'titan/modules/metrics',
        'titan/modules/notifications',
        'titan/modules/pm',
        'titan/modules/ratelimit',
        'titan/modules/redis',
        'titan/modules/scheduler',
        'titan/modules/telemetry-relay',
      ],
    },
  ],

  frontend: [
    'frontend/overview',
    'frontend/prism',
    'frontend/netron-browser',
    'frontend/netron-react',
  ],

  omnitron: [
    'omnitron/overview',
    'omnitron/cli',
    'omnitron/orchestrator',
    'omnitron/console',
  ],

  reference: [
    'reference/packages',
    'reference/glossary',
  ],
};

export default sidebars;
