import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import OmniMark from '@site/src/components/OmniMark';
import styles from './index.module.css';

// ---------------------------------------------------------------------------
// HERO — end-to-end in one screen of code, verified APIs.
// ---------------------------------------------------------------------------

const HERO_CODE = `// 1. Declare a service. The decorator is the contract.
@Service('users@1.0.0')
export class UsersService {
  constructor(private readonly repo: UserRepo) {}

  @Public()
  @Validate(IdSchema)
  async findById(id: string): Promise<User> {
    return this.repo.findById(id);
  }
}

// 2. Compose modules. DI, lifecycle, RPC exposure — wired by the container.
@Module({ imports: [DatabaseModule], providers: [UserRepo, UsersService] })
export class AppModule {}

// 3. Boot. One module, multiple transports.
const app = await Application.create(AppModule);
await app.start();

// 4. Call from React. The interface IS the hook.
const users = useService<UsersService>('users');
const { data, isLoading } = users.findById.useQuery(['u_42']);

// → No codegen. No schema sync. No drift. Pure TypeScript.`;

function Hero() {
  return (
    <header className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>
            <span className="omni-gradient-text">Omnitron</span>
          </h1>
          <p className={styles.heroTagline}>
            One TypeScript stack. Backend, RPC, UI, supervision.
            <br/>No bridges. No codegen. No drift.
          </p>
          <p className={styles.heroDesc}>
            <strong>Titan</strong> is the backend framework — DI, lifecycle,
            modules, decorators. <strong>Netron</strong> is the RPC plane —
            HTTP, WebSocket, TCP, Unix sockets, one service contract.
            <strong> Prism</strong> renders the frontend.
            <strong> Omnitron</strong> the daemon supervises the fleet.
            Same types from the database row to the React hook. Zero
            generated code.
          </p>
          <div className={styles.heroButtons}>
            <Link className="button button--primary button--lg" to="/docs/getting-started/quickstart">
              Quickstart
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/foundations/architecture">
              Architecture
            </Link>
          </div>
        </div>
        <div className={styles.heroVis}>
          <OmniMark size={460} />
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// PILLARS — one paragraph + one verified code block per layer.
// Every API shown here matches current source.
// ---------------------------------------------------------------------------

const PILLARS = [
  {
    title: 'Titan — backend in a decorator',
    accent: 'var(--omni-violet)',
    blurb:
      'Decorator-driven services, container-based DI (Nexus), structured ' +
      'lifecycle (onInit / onStart / onStop / onDestroy), zod-validated ' +
      'configuration, typed error classes that travel across the wire. ' +
      'No ambient state, no thread-locals, no surprises.',
    code: `@Module({
  imports: [
    ConfigModule.forRoot({ schema: AppConfigSchema }),
    LoggerModule.forRoot({ level: 'info' }),
    TitanDatabaseModule.forRoot({ dialect: 'postgres' }),
    TitanAuthModule.forRootAsync({
      useFactory: (cfg: ConfigService) => ({ jwtSecret: cfg.get('jwt.secret') }),
      inject: [CONFIG_SERVICE_TOKEN],
    }),
  ],
  providers: [UsersService],
})
export class AppModule {}`,
  },
  {
    title: 'Netron — one service, four transports',
    accent: 'var(--omni-violet-300)',
    blurb:
      'The same @Service is reachable over HTTP, WebSocket, TCP, and Unix ' +
      'sockets. Auth, middleware, rate limits, and tracing layer once and ' +
      'apply uniformly. Subscriptions stream over WS; everything else takes ' +
      'the cheapest path that fits.',
    code: `@Service('orders@1.0.0')
export class OrdersService {
  @Public() @Auth({ roles: ['user'] })
  async create(input: CreateOrder) { /* ... */ }

  @Public()
  async *watch(filter: OrderFilter): AsyncIterable<OrderEvent> {
    for await (const event of this.bus.subscribe(filter)) yield event;
  }
}

// Client picks the transport; the contract is identical.
const ws = new NetronClient({ url: 'wss://api', transport: 'websocket' });
for await (const evt of (await ws.queryInterface<OrdersService>('orders@1.0.0'))
                          .watch({ tier: 'pro' })) handle(evt);`,
  },
  {
    title: 'End-to-end types — no codegen',
    accent: 'var(--omni-emerald)',
    blurb:
      'The service interface IS the hook contract. Refactor a method ' +
      'signature on the server, TypeScript fails the build on every client ' +
      'caller in the same `tsc` pass. No OpenAPI, no protobuf, no .d.ts ' +
      'sync step. The compiler is the source of truth.',
    code: `// Backend signature changes —
@Public() async findById(id: string, opts?: GetOpts): Promise<User | null>

// Frontend breaks loudly until you migrate:
const users = useService<UsersService>('users');
const { data } = users.findById.useQuery([id]);
//      ^? User | null | undefined  ✓ traced through

// Forget the new opts arg? Type error. No drift. No runtime surprise.`,
  },
  {
    title: 'Prism — 50+ components, three layers',
    accent: 'var(--omni-violet-700)',
    blurb:
      'MUI v7 foundation; schema-aware forms (react-hook-form + zod); three ' +
      'pre-built layouts; three full-page blocks; 25+ React hooks. Tree-shaken ' +
      'per subpath. Dark mode without flicker. Accessibility built in, ' +
      'never bolted on.',
    code: `<DataGridBlock
  title="Users"
  columns={[
    { field: 'email',  header: 'Email',  sortable: true },
    { field: 'role',   header: 'Role',   filterable: { type: 'select', options: ROLES } },
    { field: 'status', header: 'Status', render: (r) => <StatusChip status={r.status} /> },
  ]}
  query={({ page, sort, filter }) =>
    users.list.useQuery([{ page, sort, filter }])
  }
  rowActions={[{ id: 'remove', label: 'Remove', danger: true,
                 confirm: { title: 'Remove user?' }, onClick: onRemove }]}
/>`,
  },
  {
    title: '16+ modules. Pick what you need.',
    accent: 'var(--omni-amber)',
    blurb:
      'Auth, cache, database, discovery, events, health, lock, metrics, ' +
      'notifications, process-manager, rate-limit, redis, scheduler, telemetry ' +
      '— plus built-in config + logger. Each independently versioned, each ' +
      'opt-in. No invisible runtime tax.',
    code: `// Compose the modules you need. Skip the rest.
@Module({
  imports: [
    TitanRedisModule.forRoot({ config: { url: env.REDIS_URL } }),
    TitanCacheModule.forRoot({ multiTier: true }),
    TitanRateLimitModule.forRoot({ strategy: 'sliding-window', defaultLimit: 100 }),
    TitanLockModule.forRoot(),
    SchedulerModule.forRoot({ persistence: { provider: 'redis' } }),
    TitanHealthModule.forRoot({ enableMemoryIndicator: true }),
  ],
})`,
  },
  {
    title: 'Omnitron — supervisor + console + CLI',
    accent: 'var(--omni-violet-500)',
    blurb:
      'One daemon supervises N apps × M projects × K stacks. 20+ RPC services ' +
      'on the management plane. Web console (React + Vite + Prism). 75+ CLI ' +
      'subcommands. Declarative infrastructure (Postgres, Redis, MinIO, custom) ' +
      'via Docker or bare-metal. MCP server for AI agents.',
    code: `# Boot the daemon + provision infra + start all apps.
$ omnitron up

# Stream logs across the fleet with filters.
$ omnitron logs api -f -l warn -g 'payment'

# Inspect the live DI graph of any running app.
$ omnitron inspect api --graph --format mermaid

# Drive everything from MCP — agents speak the same surface.
$ omnitron kb mcp`,
  },
];

const PillarCard: React.FC<{pillar: typeof PILLARS[number]}> = ({pillar}) => {
  return (
    <div className={styles.pillarCard} style={{'--accent': pillar.accent} as React.CSSProperties}>
      <div className={styles.pillarAccent} />
      <h3 className={styles.pillarTitle}>{pillar.title}</h3>
      <p className={styles.pillarBlurb}>{pillar.blurb}</p>
      <div className={styles.pillarCode}>
        <CodeBlock language="typescript" children={pillar.code} />
      </div>
    </div>
  );
};

function Pillars() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>The stack</h2>
        <p>
          Six layers, one toolchain. Each one shipped, documented, and used
          in production. Nothing aspirational, nothing roadmap.
        </p>
      </div>
      <div className={styles.pillarGrid}>
        {PILLARS.map((p) => <PillarCard key={p.title} pillar={p} />)}
      </div>
    </section>
  );
}

function CodeShowcase() {
  return (
    <section className={clsx(styles.section, styles.codeShowcase)}>
      <div className={styles.sectionHeader}>
        <h2>Four steps. One language. Zero glue.</h2>
        <p>
          Declare. Compose. Boot. Call. From a Postgres row to a React hook —
          one type system end-to-end. No OpenAPI, no protobuf, no client-server
          drift. <strong>This is the entire wire format.</strong>
        </p>
      </div>
      <div className={styles.codeWrap}>
        <CodeBlock language="typescript" showLineNumbers children={HERO_CODE} />
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CAPABILITIES — what the platform actually delivers, by role.
// Numbers and primitives, not adjectives.
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: '◆',
    title: 'Backend',
    body:
      'Decorators (@Service, @Module, @Injectable, @Public, @Validate, @Auth, ' +
      '@Cron, @Cached, @WithDistributedLock, @Metrics, @CircuitBreaker). ' +
      'Container DI with scopes + contextual injection. Lifecycle hooks. ' +
      'Typed errors travel the wire intact.',
  },
  {
    icon: '↔',
    title: 'RPC',
    body:
      'Four transports, one service contract. Middleware pipeline (auth, ' +
      'rate-limit, validation, instrumentation). Token cache + JWKS rotation. ' +
      'AsyncIterable streaming over WS. Multi-backend client routing. ' +
      'Cross-tab auth sync via BroadcastChannel.',
  },
  {
    icon: '◊',
    title: 'Frontend',
    body:
      'Prism: 50+ MUI v7 components, 3 layouts, 3 blocks, schema-aware ' +
      'forms, 25+ hooks, dark mode without flicker. netron-react: ' +
      'useQuery / useMutation / useSubscription / useInfiniteQuery / useService — ' +
      'all typed from the backend interface.',
  },
  {
    icon: '⟁',
    title: 'Observability',
    body:
      'pino logs with rotation. titan-metrics with Prometheus exposition + ' +
      'pluggable storage (memory / SQLite / Postgres). titan-health with k8s ' +
      'probes. titan-telemetry-relay store-and-forward over WAL. Per-app ' +
      'distributed traces. All aggregated by the daemon.',
  },
  {
    icon: '✦',
    title: 'Supervision',
    body:
      'Process pools with P2C balancing. Crash-restart with exponential ' +
      'backoff. Graceful shutdown in dependency order. File-watch hot ' +
      'reload in dev. Multi-app, multi-process, multi-instance topology. ' +
      'Persistent state across daemon restart.',
  },
  {
    icon: '⌬',
    title: 'Infrastructure',
    body:
      'Declarative app requirements: database / redis / s3 / custom daemons. ' +
      'Docker provider for dev/test; bare-metal hooks for prod. Reconcile ' +
      'loop. Env-var templating with secrets (${host}, ${port:name}, ' +
      '${secret:name}). One declaration, every environment.',
  },
  {
    icon: '⊞',
    title: 'Cluster + Fleet',
    body:
      'Multi-node cluster with simplified Raft leader election (5–15 s ' +
      'timeouts, 2 s heartbeat). Master-slave state sync via batch ' +
      'replication. Per-node uptime bars with 90-day retention. Remote ' +
      'daemons addressed by alias. Cross-region patterns.',
  },
  {
    icon: '🜂',
    title: 'Agent-ready',
    body:
      'omnitron-kb MCP server exposes ~9 KB tools + ~30 management tools ' +
      'to AI agents. Semantic + full-text hybrid search over the codebase. ' +
      'Agents read/write the same RPC surface as the CLI. Authoring + ' +
      'invocation through one protocol.',
  },
];

function Features() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Capabilities</h2>
        <p>
          What the platform delivers, by layer. Every primitive verified
          against shipping source — no roadmap, no "coming soon".
        </p>
      </div>
      <div className={styles.featureGrid}>
        {FEATURES.map((f) => (
          <div key={f.title} className={styles.featureCard}>
            <div className={styles.featureIcon}>{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// NUMBERS — concrete scale signal.
// ---------------------------------------------------------------------------

const NUMBERS = [
  { value: '16+', label: 'modules' },
  { value: '20+', label: 'daemon RPC services' },
  { value: '75+', label: 'CLI subcommands' },
  { value: '50+', label: 'Prism components' },
  { value: '4',   label: 'transports' },
  { value: '3',   label: 'RBAC roles' },
  { value: '0',   label: 'codegen steps' },
];

function Numbers() {
  return (
    <section className={clsx(styles.section, styles.numbers)}>
      <div className={styles.numbersGrid}>
        {NUMBERS.map((n) => (
          <div key={n.label} className={styles.numberCell}>
            <div className={styles.numberValue}>{n.value}</div>
            <div className={styles.numberLabel}>{n.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// CTA — short, decisive.
// ---------------------------------------------------------------------------

function CTA() {
  return (
    <section className={styles.cta}>
      <div className={styles.ctaInner}>
        <h2>One stack. Ship.</h2>
        <p>
          <code>pnpm add @omnitron-dev/titan</code>. Write a decorated class.
          Boot. Add Netron when a client wants in. Add Prism when you render.
          Add Omnitron when you scale. Each step is the next import —
          never the next framework.
        </p>
        <div className={styles.heroButtons}>
          <Link className="button button--primary button--lg" to="/docs/getting-started/installation">
            Install
          </Link>
          <Link className="button button--secondary button--lg" to="/docs/getting-started/quickstart">
            Quickstart
          </Link>
          <Link className="button button--link button--lg" to="/docs/foundations/principles">
            Read the principles
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): React.ReactElement {
  return (
    <Layout
      title="Omnitron — TypeScript stack: Titan backend · Netron RPC · Prism UI · Omnitron supervisor"
      description="One TypeScript stack: Titan (decorator-driven backend), Netron (transport-agnostic RPC over HTTP/WS/TCP/Unix), Prism (50+ component design system), Omnitron (production supervisor with 19 RPC services, 90+ CLI commands, web console, MCP server)."
    >
      <Hero />
      <main>
        <Pillars />
        <CodeShowcase />
        <Numbers />
        <Features />
        <CTA />
      </main>
    </Layout>
  );
}
