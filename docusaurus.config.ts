import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const siteUrl = process.env.SITE_URL || 'https://omnitron.dev';
const siteBaseUrl = process.env.SITE_BASE_URL || '/';

const config: Config = {
  title: 'Omnitron',
  tagline: 'Own the whole system. Build, connect and operate in TypeScript.',
  favicon: 'img/favicon.ico',
  url: siteUrl,
  baseUrl: siteBaseUrl,
  organizationName: process.env.GH_ORG_NAME || 'omnitron-dev',
  projectName: process.env.GH_PROJECT_NAME || 'website',
  trailingSlash: false,
  // A warning in a build log is a check whose result nobody has to read: the
  // build succeeds, CI is green, and the broken link ships. The site currently
  // produces zero of these — measured, not assumed — so raising the bar costs
  // nothing today and stops the first one that appears.
  //
  // The in-page anchor system generates section ids at build time and
  // cross-links resolve against them, so an anchor that stops matching is the
  // most likely of the three to appear and the least likely to be noticed.
  onBrokenLinks: 'throw',
  onBrokenAnchors: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
    localeConfigs: {
      en: {label: 'English', htmlLang: 'en-US'},
    },
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          showLastUpdateTime: false,
          showLastUpdateAuthor: false,
          editUrl: undefined,
        },
        blog: {
          showReadingTime: true,
          blogTitle: 'Omnitron Blog',
          blogDescription: 'Release notes and engineering articles from the Omnitron project',
          postsPerPage: 10,
          blogSidebarTitle: 'Posts',
          blogSidebarCount: 'ALL',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: ['@docusaurus/theme-mermaid'],

  // Client-side modules that run on every page. Currently only the
  // chunk-error handler — it auto-reloads the page when an old cached
  // HTML tries to fetch a chunk that the latest deploy has removed.
  clientModules: [
    require.resolve('./src/clientModules/chunk-error-handler.ts'),
  ],

  markdown: {
    mermaid: true,
    format: 'detect',     // .md → markdown, .mdx → MDX with JSX
    hooks: {
      onBrokenMarkdownLinks: 'throw',
    },
  },

  plugins: [
    function silenceVscodeWarning() {
      return {
        name: 'silence-vscode-warning',
        configureWebpack() {
          return {
            ignoreWarnings: [{module: /vscode-languageserver-types/}],
            module: {exprContextCritical: false},
          };
        },
      };
    },
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        language: ['en'],
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        docsRouteBasePath: '/docs',
        indexBlog: true,
      },
    ],
  ],

  themeConfig: {
    metadata: [
      {name: 'keywords', content: 'omnitron, titan, netron, prism, typescript, rpc, dependency injection, framework, monorepo'},
      {name: 'description', content: 'Omnitron is a unified TypeScript stack: Titan backend framework, Netron type-safe RPC, Prism design system, and an orchestrator app — one toolchain across the full systems-engineering spectrum.'},
    ],
    image: 'img/logo.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: true,
      },
    },
    navbar: {
      title: 'omnitron',
      logo: {
        alt: 'Omnitron Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docs',
          position: 'left',
          label: 'Docs',
        },
        {
          type: 'docSidebar',
          sidebarId: 'titan',
          position: 'left',
          label: 'Titan',
        },
        {
          type: 'docSidebar',
          sidebarId: 'frontend',
          position: 'left',
          label: 'Frontend',
        },
        {
          type: 'docSidebar',
          sidebarId: 'omnitron',
          position: 'left',
          label: 'Operations',
        },
        {
          type: 'docSidebar',
          sidebarId: 'reference',
          position: 'left',
          label: 'Reference',
        },
        {
          href: 'https://github.com/omnitron-dev/omni',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      links: [
        {title: 'Start', items: [
          {label: 'Introduction', to: '/docs/intro'},
          {label: 'Quickstart', to: '/docs/getting-started/quickstart'},
          {label: 'Architecture', to: '/docs/foundations/architecture'},
        ]},
        {title: 'Build', items: [
          {label: 'Titan runtime', to: '/docs/titan/overview'},
          {label: 'Netron RPC', to: '/docs/titan/netron'},
          {label: 'Prism interfaces', to: '/docs/frontend/prism'},
        ]},
        {title: 'Operate', items: [
          {label: 'Production readiness', to: '/docs/deployment/production-readiness'},
          {label: 'CLI reference', to: '/docs/omnitron/cli'},
          {label: 'Troubleshooting', to: '/docs/troubleshooting'},
        ]},
        {title: 'Project', items: [
          {label: 'Source', href: 'https://github.com/omnitron-dev/omni'},
          {label: 'Contributing', to: '/docs/community/contributing'},
          {label: 'Compatibility', to: '/docs/reference/compatibility'},
          {label: 'Changelog', to: '/docs/community/changelog'},
        ]},
      ],
      copyright: `© ${new Date().getFullYear()} Omnitron · Open source / MIT`,
    },
    prism: {
      theme: prismThemes.oneLight,
      darkTheme: prismThemes.oneDark,
      additionalLanguages: ['rust', 'bash', 'toml', 'json', 'diff', 'yaml', 'docker'],
      magicComments: [
        {
          className: 'theme-code-block-highlighted-line',
          line: 'highlight-next-line',
          block: {start: 'highlight-start', end: 'highlight-end'},
        },
      ],
    },
    mermaid: {
      theme: {light: 'neutral', dark: 'dark'},
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
