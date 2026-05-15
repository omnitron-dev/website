import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import OmniMark from '@site/src/components/OmniMark';
import styles from './index.module.css';

const HERO_CODE = `// 1. Define a service with a decorator. That's the whole interface.
@Service('users@1.0.0')
export class UsersService {
  @Public()
  async findById(id: string): Promise<User> {
    return this.repo.findById(id);
  }
}

// 2. Bind the module. DI, lifecycle, and Netron exposure are wired in.
@Module({ providers: [UsersService] })
export class UsersModule {}

// 3. Boot the application. HTTP, WS, TCP, Unix — same service surface.
const app = await Application.create(UsersModule, { netron: { http: 3000 } });
await app.start();

// 4. Call from the browser as if it were local. End-to-end types preserved.
const users = await client.queryInterface<UsersService>('users@1.0.0');
const user  = await users.findById('u_42');`;

function Hero() {
  return (
    <header className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroText}>
          <h1 className={styles.heroTitle}>
            <span className="omni-gradient-text">Omnitron</span>
          </h1>
          <p className={styles.heroTagline}>
            One TypeScript stack across backend, RPC, UI, and orchestration.
          </p>
          <p className={styles.heroDesc}>
            <strong>Titan</strong> gives you a decorator-driven backend with
            dependency injection, structured concurrency, and{' '}
            <strong>Netron</strong>&nbsp;— a transport-agnostic RPC plane that
            speaks HTTP, WebSocket, TCP, and Unix sockets with the same
            service surface. <strong>Prism</strong> renders the frontend on
            top of it. <strong>Omnitron</strong> the app supervises it all.
            Same types, end to end. No hidden runtime.
          </p>
          <div className={styles.heroButtons}>
            <Link className="button button--primary button--lg" to="/docs/intro">
              Get Started
            </Link>
            <Link className="button button--secondary button--lg" to="/docs/getting-started/quickstart">
              Quick Start
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

const PILLARS = [
  {
    title: 'Titan — backend in one decorator',
    accent: 'var(--omni-violet)',
    blurb:
      'A decorator-driven application framework: declare services, modules, ' +
      'middleware, and lifecycle hooks; the container wires the rest. ' +
      'Structured concurrency by default, no ambient state, no thread-locals. ' +
      'Validation, configuration, logging, and tracing are first-class — opt ' +
      'into them per module, never globally.',
    code: `@Module({
  imports: [ConfigModule.forRoot(), LoggerModule],
  providers: [UsersService, AuthService],
})
export class AppModule {}

@Service('users@1.0.0')
export class UsersService {
  constructor(private readonly db: Database) {}

  @Public()
  async findById(@Validate(IdSchema) id: string) {
    return this.db.users.findById(id);
  }
}`,
  },
  {
    title: 'Netron — transport-agnostic RPC',
    accent: 'var(--omni-cyan)',
    blurb:
      'One service, four transports. The same @Service surface is reachable ' +
      'over HTTP for browsers, WebSocket for live subscriptions, TCP for ' +
      'service-to-service, and Unix sockets for sidecars. Discovery, auth, ' +
      'and middleware are layered uniformly across every transport.',
    code: `// Server — exposes the same service over every wired transport.
const app = await Application.create(UsersModule, {
  netron: {
    http:      { port: 3000 },
    websocket: { port: 3001 },
    tcp:       { port: 4001 },
    unix:      { path: '/run/users.sock' },
  },
});

// Client — pick a transport, the contract is identical.
const wsClient = new NetronClient({ url: 'ws://api/users' });
const users = await wsClient.queryInterface<UsersService>('users@1.0.0');`,
  },
  {
    title: 'End-to-end type safety',
    accent: 'var(--omni-emerald)',
    blurb:
      'Service signatures defined on the backend become hooks on the frontend ' +
      'with no codegen step. netron-react gives you typed query and mutation ' +
      'hooks; netron-browser handles transport, retries, and middleware. ' +
      'Refactor a service signature and TypeScript fails the build on every ' +
      'caller — server, client, console, mobile.',
    code: `// React — the service interface is the hook contract.
function UserCard({ id }: { id: string }) {
  const { data, isLoading } = useNetronQuery(
    UsersService,
    'findById',
    [id],
  );

  if (isLoading) return <Spinner />;
  return <h3>{data.displayName}</h3>;
}`,
  },
  {
    title: 'Prism — design system, not a component dump',
    accent: 'var(--omni-magenta)',
    blurb:
      'Prism is a constructor of UIs, not a list of widgets. Theme tokens, ' +
      'layout primitives, semantic blocks, and forms compose into entire ' +
      'screens with consistent spacing, focus, and accessibility behaviour. ' +
      'Built on top of netron-react, so a screen is a thin orchestration of ' +
      'service calls and Prism blocks.',
    code: `<Page title="Users">
  <DataTable
    query={useNetronQuery(UsersService, 'list', [])}
    columns={[
      col('id'),
      col('email'),
      col('createdAt', { format: 'relative' }),
    ]}
    onRowClick={(u) => navigate(\`/users/\${u.id}\`)}
  />
</Page>`,
  },
  {
    title: 'Modules you would have built anyway',
    accent: 'var(--omni-amber)',
    blurb:
      'Auth, cache, database, discovery, events, health, lock, metrics, ' +
      'notifications, process management, rate limiting, redis, scheduler, ' +
      'telemetry — fourteen Titan modules covering the workhorse layer of ' +
      'every backend. Each is opt-in, each ships with the same DI grammar, ' +
      'each is independently versionable.',
    code: `// Compose the modules you need; skip the ones you don't.
@Module({
  imports: [
    AuthModule.forRoot({ jwt: { secret: env.JWT_SECRET } }),
    CacheModule.forRoot({ tier: 'redis-lru' }),
    DatabaseModule.forRoot({ dialect: 'postgres' }),
    SchedulerModule,
    MetricsModule,
  ],
})
export class AppModule {}`,
  },
  {
    title: 'Omnitron — the supervisor',
    accent: 'var(--omni-rose)',
    blurb:
      'A production-grade Titan application supervisor and CLI. Run, watch, ' +
      'log, and orchestrate Titan services across machines and projects. The ' +
      'web console aggregates dashboards over multiple stacks. Same ' +
      'observability primitives whether you are running a single dev box or ' +
      'a fleet.',
    code: `# Bring up a Titan service in dev mode with hot reload.
$ omnitron dev ./apps/users

# Tail structured logs across all running services.
$ omnitron logs --follow

# Inspect a remote orchestrator from the CLI.
$ omnitron status --host production.internal`,
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
        <h2>What Omnitron gives you</h2>
        <p>
          Six engineering decisions that change how you write, ship, and operate
          a TypeScript stack — without giving up the editor's type-checker or
          the platform's debugger.
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
        <h2>One service, four lines apart from the browser</h2>
        <p>
          Define the service. Bind the module. Boot the app. Call it from the
          frontend. The wire format, the validation, the discovery, the
          retries — all defaults you can override, never boilerplate you
          have to write.
        </p>
      </div>
      <div className={styles.codeWrap}>
        <CodeBlock language="typescript" showLineNumbers children={HERO_CODE} />
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: '◆',
    title: 'For backend engineers',
    body: 'Decorator-driven services, container DI, structured concurrency, configuration with schema validation, structured logging with trace propagation. No magic globals, no ambient state.',
  },
  {
    icon: '↔',
    title: 'For platform engineers',
    body: 'Process supervision, multi-transport RPC, health and readiness probes, distributed locks, rate limiting, cache tiers, scheduled jobs, metrics, telemetry relay. Operate a fleet, not just a service.',
  },
  {
    icon: '◊',
    title: 'For frontend engineers',
    body: 'Service interfaces become hooks. Prism gives you tokens, layouts, blocks, forms, and accessibility scaffolding. Same TypeScript types from the database row to the form field.',
  },
  {
    icon: '∑',
    title: 'For full-stack teams',
    body: 'One language, one toolchain, one type system. The contract between server and client is the service signature itself. No OpenAPI generation, no protobuf step, no client-server type drift.',
  },
  {
    icon: '✦',
    title: 'For SREs and operators',
    body: 'Omnitron the app: dev mode with hot reload, structured logs, dashboards, web console, MCP integration. Inspect, restart, scale, and audit any Titan service from one CLI.',
  },
  {
    icon: '⊡',
    title: 'For library authors',
    body: 'Independently versioned packages with explicit DI surfaces. Build a Titan module, expose a Netron service, ship a Prism block — each composes without forcing the consumer to adopt the rest of the stack.',
  },
  {
    icon: 'λ',
    title: 'Cross-runtime testing',
    body: 'The @omnitron-dev/testing package targets Node, Bun, and Deno from the same test source. Validate behaviour across runtimes before you commit to one.',
  },
  {
    icon: '⚙',
    title: 'Knowledge built in',
    body: 'The @omnitron-dev/kb package powers semantic code intelligence and the omnitron-kb MCP server. Your AI tooling reasons about the codebase using the same primitives Omnitron does.',
  },
];

function Features() {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2>Who Omnitron is for</h2>
        <p>
          A single stack across the full systems-engineering spectrum.
          Each role gets the surface it needs; the layers below stay out
          of the way until you ask for them.
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

function CTA() {
  return (
    <section className={styles.cta}>
      <div className={styles.ctaInner}>
        <h2>Start with one service. Grow into a stack.</h2>
        <p>
          Install <code>@omnitron-dev/titan</code>, write a decorated class,
          boot it. Add Netron when you need a client. Add Prism when you
          need a frontend. Add Omnitron when you need to run a fleet.
          Each step is the next decorator, not the next framework.
        </p>
        <div className={styles.heroButtons}>
          <Link className="button button--primary button--lg" to="/docs/getting-started/installation">
            Install Titan
          </Link>
          <Link className="button button--secondary button--lg" to="/docs/getting-started/quickstart">
            Quick Start
          </Link>
          <Link className="button button--link button--lg" to="/docs/foundations/architecture">
            Architecture
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): React.ReactElement {
  return (
    <Layout
      title="Omnitron — A unified TypeScript stack for backend, RPC, UI, and orchestration"
      description="Omnitron: Titan backend framework, Netron type-safe RPC, Prism design system, and orchestrator app. One toolchain, end-to-end TypeScript, no hidden runtime."
    >
      <Hero />
      <main>
        <Pillars />
        <CodeShowcase />
        <Features />
        <CTA />
      </main>
    </Layout>
  );
}
