import React from 'react';
import { Button, Card, CardActionArea, Link } from '@omnitron-dev/prism/ui';
import { ArrowRightIcon, ArrowUpRightIcon } from '@omnitron-dev/prism/icons';

const layers = [
  ['01', 'Titan', 'Runtime', 'Compose services with explicit modules, dependency injection and a managed lifecycle.', '/docs/titan/overview'],
  ['02', 'Netron', 'Connection', 'Share TypeScript contracts across service boundaries and connect through typed RPC.', '/docs/titan/netron'],
  ['03', 'Prism', 'Interface', 'Build accessible React interfaces from shared components, layouts and a coherent theme.', '/docs/frontend/prism'],
  ['04', 'Lumen', 'Documentation', 'Compile a verified document corpus into static pages, search and machine-readable sources.', '/docs/lumen/overview'],
  ['05', 'Omnitron', 'Operations', 'Inspect and supervise applications through the daemon, CLI, Console and MCP.', '/docs/omnitron/overview'],
];
export const serviceExample = `import { Service, Public } from\n  '@omnitron-dev/titan/decorators';\n\n@Service('signals@1.0.0')\nexport class SignalsService {\n  @Public()\n  async read(): Promise<{ status: string }> {\n    return { status: 'online' };\n  }\n}`;
export const clientExample = `import { createClient } from\n  '@omnitron-dev/netron-browser';\nimport type { SignalsService }\n  from './signals.service.js';\n\nconst client = createClient({\n  url: 'http://localhost:3000'\n});\nawait client.connect();\nconst signals = client.service<SignalsService>(\n  'signals@1.0.0'\n);\nconst state = await signals.read();`;

export function Home({ serverCode, clientCode }: { serverCode: string; clientCode: string }) {
  return <main id="main-content" className="home" tabIndex={-1}>
    <header className="home-hero">
      <div className="hero-meta"><span>OPEN SOURCE / TYPESCRIPT</span><span>COMPOSABLE SYSTEMS ENGINEERING</span></div>
      <div className="hero-grid"><div>
        <h1>Own the<br />whole <em>system.</em></h1>
        <p className="hero-lead">One language. Every layer under your control.</p>
        <p className="hero-description">Start with a service. Connect an interface. Document its contract. Add supervision when you need it.</p>
        <div className="hero-actions"><Button variant="contained" size="large" href="/docs/getting-started/quickstart" endIcon={<ArrowRightIcon />}>Build your first service</Button><Button variant="text" href="/docs/foundations/architecture" endIcon={<ArrowUpRightIcon />}>Explore the architecture</Button></div>
      </div><aside className="system-diagram" aria-labelledby="system-topology-title">
        <p className="diagram-meta">PLATFORM / TOPOLOGY</p>
        <h2 id="system-topology-title">From interface to service.</h2>
        <div className="topology-path">
          <Card variant="outlined" className="topology-node"><CardActionArea component="a" href="/docs/frontend/prism" sx={{ display: 'flex', flexDirection: 'column', p: 1.5, minWidth: 0 }}><small>CLIENT</small><strong>Prism</strong><span className="topology-description">React interface</span></CardActionArea></Card>
          <CardActionArea component="a" className="topology-connection" href="/docs/titan/netron" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}><span className="topology-direction" aria-hidden="true">↔</span><strong>Netron</strong><small>Typed RPC</small><small>HTTP / WebSocket</small></CardActionArea>
          <Card variant="outlined" className="topology-node"><CardActionArea component="a" href="/docs/titan/overview" sx={{ display: 'flex', flexDirection: 'column', p: 1.5, minWidth: 0 }}><small>SERVICE</small><strong>Titan</strong><span className="topology-description">Modules + lifecycle</span></CardActionArea></Card>
        </div>
        <p className="topology-caption">Shared types describe the contract. Validate requests at the service boundary.</p>
        <div className="system-tools">
          <CardActionArea component="a" href="/docs/lumen/overview"><small>DOCUMENT</small><strong>Lumen</strong><span className="tool-description">Publishes these contracts</span></CardActionArea>
          <CardActionArea component="a" href="/docs/omnitron/overview"><small>OPERATE</small><strong>Omnitron</strong><span className="tool-description">Supervises these processes</span></CardActionArea>
        </div>
      </aside></div>
      <div className="hero-principles"><span><b>01</b> Shared contracts</span><span><b>02</b> Explicit ownership</span><span><b>03</b> Observable outcomes</span></div>
    </header>
    <section className="home-section" aria-labelledby="layers-title"><div className="section-heading"><p className="eyebrow">01 / THE STACK</p><h2 id="layers-title">Compose what you need.</h2><p>Each layer has a clear job. Follow its contract from source to operation.</p></div>
      <div className="layer-list">{layers.map(([number,name,role,description,href]) => <CardActionArea component="a" href={href} key={name}><span className="layer-number">{number}</span><h3>{name}<small>{role}</small></h3><p>{description}</p><ArrowUpRightIcon className="layer-arrow" /></CardActionArea>)}</div>
    </section>
    <section className="home-section" aria-labelledby="contract-title"><div className="section-heading"><p className="eyebrow">02 / THE CONTRACT</p><h2 id="contract-title">Declare once. Call directly.</h2><p>A service type connects the server and client. Validate untrusted inputs at the boundary.</p></div>
      <div className="contract-grid"><div><div className="file-label">SERVER / signals.service.ts</div><div dangerouslySetInnerHTML={{ __html: serverCode }} /></div><div><div className="file-label">CLIENT / client.ts</div><div dangerouslySetInnerHTML={{ __html: clientCode }} /></div></div>
      <p className="section-note">These are service and client excerpts. The <Link href="/docs/getting-started/quickstart">quickstart</Link> includes registration, HTTP setup and runnable files.</p>
    </section>
    <section className="home-section" aria-labelledby="start-title"><div className="section-heading"><p className="eyebrow">03 / FIELD MANUAL</p><h2 id="start-title">Find the next useful step.</h2></div>
      <div className="start-paths"><CardActionArea component="a" href="/docs/getting-started/quickstart"><small>BUILD</small><h3>Run a service</h3><p>Install, compile and make the first RPC call.</p><ArrowRightIcon className="start-path-arrow" /></CardActionArea><CardActionArea component="a" href="/docs/reference/api-index"><small>INTEGRATE</small><h3>Find the API</h3><p>Search public exports and follow their guides.</p><ArrowRightIcon className="start-path-arrow" /></CardActionArea><CardActionArea component="a" href="/docs/deployment/production-readiness"><small>OPERATE</small><h3>Prepare for production</h3><p>Readiness, recovery and observable failures.</p><ArrowRightIcon className="start-path-arrow" /></CardActionArea></div>
      <div className="lumen-note"><span>THIS MANUAL IS A LUMEN REFERENCE PROJECT</span><p>Static HTML. Local search. Verified links. Markdown for tools.</p><Link href="/docs/lumen/this-site">Inspect how it is built ↗</Link></div>
    </section>
  </main>;
}
