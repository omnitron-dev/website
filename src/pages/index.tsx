import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import CodeBlock from '@theme/CodeBlock';
import styles from './index.module.css';

const service = `import { Service, Public } from
  '@omnitron-dev/titan/decorators';

@Service('signals@1.0.0')
export class SignalsService {
  @Public()
  async read(): Promise<{ status: string }> {
    return { status: 'online' };
  }
}`;
const client = `import { createClient } from
  '@omnitron-dev/netron-browser';
import type { SignalsService } from './signals.service.js';

const client = createClient({ url: 'http://localhost:3000' });
await client.connect();
const signals = client.service<SignalsService>('signals@1.0.0');
const state = await signals.read();`;

const layers = [
  {id: '01', name: 'Titan', role: 'Runtime', to: '/docs/titan/overview',
    text: 'Compose services with dependency injection, explicit modules, validation and a managed lifecycle.'},
  {id: '02', name: 'Netron', role: 'Transport', to: '/docs/titan/netron',
    text: 'Expose a service contract over HTTP, WebSocket, TCP or Unix sockets. Connect a typed client.'},
  {id: '03', name: 'Prism', role: 'Interface', to: '/docs/frontend/prism',
    text: 'Build React interfaces with a shared theme, accessible primitives, forms and application layouts.'},
  {id: '04', name: 'Omnitron', role: 'Operations', to: '/docs/omnitron/overview',
    text: 'Supervise applications and infrastructure through the daemon, CLI, web console and MCP.'},
];
function Arrow() { return <span aria-hidden="true">↗</span>; }

export default function Home(): React.ReactElement {
  return (
    <Layout title="Own the whole system" description="Build, connect and operate TypeScript services. Titan runtime, Netron RPC, Prism interfaces and the Omnitron supervisor.">
      <main className={styles.home}>
        <header className={styles.hero}>
          <div className={styles.meta}>
            <span><span className={styles.signal} aria-hidden="true" /> OPEN SOURCE / TYPESCRIPT</span>
            <span>RUNTIME → INTERFACE → OPERATIONS</span>
          </div>
          <div className={styles.heroGrid}>
            <div>
              <p className={styles.eyebrow}>OMNITRON / ENGINEERING SYSTEMS</p>
              <h1>Own the<br />whole <span>system.</span></h1>
              <p className={styles.lead}>One language. Every layer under your control.</p>
              <p className={styles.description}>Build with Titan. Connect with Netron. Render with Prism.
                Operate with Omnitron. Start with one service. Add the layers you need.</p>
              <div className={styles.actions}>
                <Link className="button button--primary" to="/docs/getting-started/quickstart">Build your first service <span aria-hidden="true">→</span></Link>
                <Link className={styles.textLink} to="/docs/foundations/architecture">Explore the architecture <Arrow /></Link>
              </div>
            </div>
            <div className={styles.system} aria-label="System layers: interface, transport, runtime, and optional supervision">
              <div className={styles.systemHeader}><span>SYSTEM / 001</span><span>COMPOSABLE BY DESIGN</span></div>
              <div className={styles.systemBody}>
                <div className={styles.systemLayer}><span>INTERFACE</span><strong>Prism</strong><small>React + netron-react</small></div>
                <div className={styles.bus} aria-hidden="true"><span>↓</span><i /> TYPE CONTRACT <i /><span>↑</span></div>
                <div className={styles.systemLayer}><span>TRANSPORT</span><strong>Netron</strong><small>HTTP · WS · TCP · Unix</small></div>
                <div className={styles.bus} aria-hidden="true"><span>↓</span><i /> SERVICE BOUNDARY <i /><span>↑</span></div>
                <div className={`${styles.systemLayer} ${styles.runtime}`}><span>RUNTIME</span><strong>Titan</strong><small>Modules · DI · Lifecycle</small></div>
              </div>
              <div className={styles.supervisor}><span className={styles.signal} aria-hidden="true" /><strong>Omnitron</strong><span>OPTIONAL SUPERVISION</span></div>
            </div>
          </div>
          <div className={styles.specs}>
            <span><b>01</b> Shared TypeScript contracts</span>
            <span><b>02</b> Explicit service boundaries</span>
            <span><b>03</b> Independently composed layers</span>
          </div>
        </header>
        <section className={styles.section} aria-labelledby="layers-title">
          <div className={styles.sectionHead}><p className={styles.eyebrow}>01 / THE STACK</p><h2 id="layers-title">Four layers. One direction.</h2><p>From the first method to a running system.</p></div>
          <div className={styles.layers}>
            {layers.map(layer => <Link key={layer.id} to={layer.to} className={styles.layer}>
              <div className={styles.layerMeta}><span>{layer.id} / {layer.role}</span><Arrow /></div>
              <h3>{layer.name}</h3><p>{layer.text}</p>
              <span className={styles.layerLink}>Read the documentation <span aria-hidden="true">→</span></span>
            </Link>)}
          </div>
        </section>
        <section className={styles.section} aria-labelledby="contract-title">
          <div className={styles.sectionHead}><p className={styles.eyebrow}>02 / THE CONTRACT</p><h2 id="contract-title">Declare once. Call directly.</h2><p>Share a type between server and client. No client generation step.</p></div>
          <div className={styles.codeGrid}>
            <div><div className={styles.fileLabel}>SERVER / signals.service.ts</div><CodeBlock language="typescript" children={service} /></div>
            <div><div className={styles.fileLabel}>CLIENT / client.ts</div><CodeBlock language="typescript" children={client} /></div>
          </div>
          <p className={styles.codeNote}>Service and client excerpts. The <Link to="/docs/getting-started/quickstart">quickstart</Link> includes module registration, HTTP setup and runnable files. Validate untrusted inputs at the service boundary; TypeScript types are erased at runtime.</p>
        </section>
        <section className={styles.section} aria-labelledby="start-title">
          <div className={styles.sectionHead}><p className={styles.eyebrow}>03 / FIELD MANUAL</p><h2 id="start-title">Choose your next move.</h2><p>Working examples. Explicit limits. Operational detail.</p></div>
          <div className={styles.paths}>
            <Link to="/docs/getting-started/quickstart"><span>BUILD</span><h3>Run a service</h3><p>Install, compile and make your first RPC call.</p><Arrow /></Link>
            <Link to="/docs/reference/api-index"><span>INTEGRATE</span><h3>Find the right API</h3><p>Packages, modules, transports and client bindings.</p><Arrow /></Link>
            <Link to="/docs/deployment/production-readiness"><span>OPERATE</span><h3>Prepare for production</h3><p>Readiness, release checks, recovery and observability.</p><Arrow /></Link>
          </div>
          <div className={styles.closing}><span>YOUR CODE. YOUR INFRASTRUCTURE.</span><Link to="https://github.com/omnitron-dev/omni">Read the source <Arrow /></Link></div>
        </section>
      </main>
    </Layout>
  );
}
