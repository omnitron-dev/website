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
    {
      type: 'category',
      label: 'Concepts',
      link: {type: 'generated-index', slug: '/titan/concepts'},
      items: [
        'titan/concepts/design-principles',
        'titan/concepts/architecture',
        'titan/concepts/mental-model',
      ],
    },
    {
      type: 'category',
      label: 'Application',
      link: {type: 'doc', id: 'titan/application/index'},
      items: [
        'titan/application/bootstrap',
        'titan/application/lifecycle',
        'titan/application/shutdown',
        'titan/application/health',
        'titan/application/events',
      ],
    },
    {
      type: 'category',
      label: 'Modules',
      link: {type: 'generated-index', slug: '/titan/modules-system'},
      items: [
        'titan/modules-system/defining-modules',
        'titan/modules-system/dynamic-modules',
        'titan/modules-system/module-discovery',
        'titan/modules-system/authoring-modules',
      ],
    },
    {
      type: 'category',
      label: 'Dependency Injection',
      link: {type: 'generated-index', slug: '/titan/di'},
      items: [
        'titan/di/overview',
        'titan/di/providers',
        'titan/di/scopes',
        'titan/di/tokens',
        'titan/di/multi-injection',
        'titan/di/contextual-injection',
        'titan/di/middleware',
        'titan/di/circular-dependencies',
        'titan/di/devtools',
      ],
    },
    {
      type: 'category',
      label: 'Decorators',
      link: {type: 'doc', id: 'titan/decorators/index'},
      items: [
        'titan/decorators/index',
        'titan/decorators/lifecycle',
        'titan/decorators/method-traits',
      ],
    },
    {
      type: 'category',
      label: 'Validation',
      link: {type: 'generated-index', slug: '/titan/validation'},
      items: [
        'titan/validation/overview',
        'titan/validation/contracts',
        'titan/validation/error-handling',
      ],
    },
    {
      type: 'category',
      label: 'Errors',
      link: {type: 'generated-index', slug: '/titan/errors'},
      items: [
        'titan/errors/overview',
        'titan/errors/hierarchy',
        'titan/errors/factories',
        'titan/errors/classification',
      ],
    },
    {
      type: 'category',
      label: 'Netron RPC',
      link: {type: 'doc', id: 'titan/netron'},
      items: [
        'titan/netron',
        'titan/netron/services',
        'titan/netron/transports',
        'titan/netron/middleware',
        'titan/netron/authentication',
        'titan/netron/streaming',
        'titan/netron/multi-backend',
        'titan/netron/serialization',
      ],
    },
    {
      type: 'category',
      label: 'Configuration',
      link: {type: 'generated-index', slug: '/titan/configuration'},
      items: [
        'titan/configuration/overview',
        'titan/configuration/sources',
        'titan/configuration/validation',
        'titan/configuration/hot-reload',
      ],
    },
    {
      type: 'category',
      label: 'Logging',
      link: {type: 'generated-index', slug: '/titan/logging'},
      items: [
        'titan/logging/overview',
        'titan/logging/transports',
        'titan/logging/processors',
        'titan/logging/child-loggers',
      ],
    },
    'titan/tracing',
    {
      type: 'category',
      label: 'Resilience',
      link: {type: 'generated-index', slug: '/titan/resilience'},
      items: [
        'titan/resilience/overview',
        'titan/resilience/retry',
        'titan/resilience/circuit-breaker',
        'titan/resilience/timeout',
      ],
    },
    {
      type: 'category',
      label: 'Testing',
      link: {type: 'generated-index', slug: '/titan/testing'},
      items: [
        'titan/testing/overview',
        'titan/testing/di-overrides',
        'titan/testing/integration',
        'titan/testing/modules',
      ],
    },
    {
      type: 'category',
      label: 'Best Practices',
      link: {type: 'generated-index', slug: '/titan/best-practices'},
      items: [
        'titan/best-practices/structuring-services',
        'titan/best-practices/error-handling',
        'titan/best-practices/observability',
        'titan/best-practices/performance',
      ],
    },
    {
      type: 'category',
      label: 'Recipes',
      link: {type: 'doc', id: 'titan/recipes/index'},
      items: [
        'titan/recipes/api-service',
        'titan/recipes/worker-fleet',
        'titan/recipes/observability-stack',
        'titan/recipes/notifications-pipeline',
        'titan/recipes/multi-tenant-saas',
        'titan/recipes/webhook-receiver',
        'titan/recipes/oauth-callback',
      ],
    },
    {
      type: 'category',
      label: 'Modules',
      link: {type: 'doc', id: 'titan/modules/index'},
      items: [
        'titan/modules/module-map',
        'titan/modules/options-patterns',
        'titan/modules/lifecycle-reference',
        'titan/modules/tokens-reference',
        'titan/modules/observability-matrix',
        'titan/modules/security-checklist',
        {
          type: 'category',
          label: 'Built-in',
          collapsed: false,
          items: [
            'titan/modules/config',
            'titan/modules/logger',
          ],
        },
        {
          type: 'category',
          label: 'Official',
          collapsed: false,
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
        {
          type: 'category',
          label: 'Community',
          collapsed: false,
          items: [
            'titan/modules/community',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Migrations',
      link: {type: 'doc', id: 'titan/migrations/index'},
      items: [
        'titan/migrations/from-nestjs',
        'titan/migrations/from-express',
        'titan/migrations/from-prom-client',
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
