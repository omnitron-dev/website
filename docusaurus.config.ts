import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const siteUrl = process.env.SITE_URL || 'https://omnitron.dev';
const siteBaseUrl = process.env.SITE_BASE_URL || '/';

const config: Config = {
  title: 'Omnitron',
  tagline: 'A unified TypeScript stack for verifiable systems — backend, RPC, UI, and orchestration in one toolchain',
  favicon: 'img/favicon.ico',
  url: siteUrl,
  baseUrl: siteBaseUrl,
  organizationName: process.env.GH_ORG_NAME || 'omnitron-dev',
  projectName: process.env.GH_PROJECT_NAME || 'omni',
  trailingSlash: false,
  onBrokenLinks: 'warn',
  onBrokenAnchors: 'warn',

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
      onBrokenMarkdownLinks: 'warn',
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
    image: 'img/social-card.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    docs: {
      sidebar: {
        hideable: true,
        autoCollapseCategories: true,
      },
    },
    navbar: {
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
          label: 'Omnitron App',
        },
        {
          type: 'docSidebar',
          sidebarId: 'reference',
          position: 'left',
          label: 'Reference',
        },
        {to: '/blog', label: 'Blog', position: 'left'},
        {
          href: 'https://github.com/omnitron-dev/omni',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Get started',
          items: [
            {label: 'Introduction', to: '/docs/intro'},
            {label: 'Installation', to: '/docs/getting-started/installation'},
            {label: 'Quickstart', to: '/docs/getting-started/quickstart'},
            {label: 'Project structure', to: '/docs/getting-started/project-structure'},
            {label: 'Architecture', to: '/docs/foundations/architecture'},
            {label: 'Principles', to: '/docs/foundations/principles'},
          ],
        },
        {
          title: 'Titan',
          items: [
            {label: 'Overview', to: '/docs/titan/overview'},
            {label: 'Application & DI', to: '/docs/titan/application'},
            {label: 'Decorators', to: '/docs/titan/decorators'},
            {label: 'Netron RPC', to: '/docs/titan/netron'},
            {label: '16 modules', to: '/docs/titan/modules'},
            {label: 'Migrations', to: '/docs/titan/migrations'},
          ],
        },
        {
          title: 'Frontend',
          items: [
            {label: 'Overview', to: '/docs/frontend/overview'},
            {label: 'Prism design system', to: '/docs/frontend/prism'},
            {label: 'Prism components', to: '/docs/frontend/prism/components'},
            {label: 'netron-browser', to: '/docs/frontend/netron/browser'},
            {label: 'netron-react', to: '/docs/frontend/netron/react'},
            {label: 'Multi-backend', to: '/docs/frontend/netron/multi-backend'},
          ],
        },
        {
          title: 'Omnitron',
          items: [
            {label: 'Overview', to: '/docs/omnitron/overview'},
            {label: 'Architecture', to: '/docs/omnitron/architecture'},
            {label: 'CLI reference', to: '/docs/omnitron/cli'},
            {label: 'Web console', to: '/docs/omnitron/console'},
            {label: 'Recipes', to: '/docs/omnitron/recipes'},
            {label: 'MCP server', to: '/docs/omnitron/mcp'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'Contributing', to: '/docs/community/contributing'},
            {label: 'Glossary', to: '/docs/reference/glossary'},
            {label: 'Packages', to: '/docs/reference/packages'},
            {label: 'GitHub', href: 'https://github.com/omnitron-dev/omni'},
            {label: 'Blog', to: '/blog'},
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Omnitron Project · MIT licensed · Built with TypeScript end-to-end.`,
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
