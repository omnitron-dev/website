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
      <div className="hero-meta"><span>OPEN SOURCE / SELF-HOSTED</span><span>PRIVACY-FIRST FULL STACK</span></div>
      <div className="hero-grid"><div>
        <h1>Own the<br />whole <em>system.</em></h1>
        <p className="hero-lead">A full-stack platform. On your terms.</p>
        <p className="hero-description">Build and operate your entire application on infrastructure you control. Keep your data, credentials and operational history within your chosen boundary — without a required vendor cloud.</p>
        <div className="hero-actions"><Button variant="contained" size="large" href="/docs/getting-started/quickstart" endIcon={<ArrowRightIcon />}>Build your first service</Button><Button variant="text" href="/docs/foundations/privacy" endIcon={<ArrowRightIcon />}>Privacy by architecture</Button></div>
      </div><aside className="system-diagram" aria-labelledby="system-topology-title">
        <p className="diagram-meta">YOUR INFRASTRUCTURE / ONE STACK</p>
        <h2 id="system-topology-title">Build it. Run it. Own it.</h2>
        <div className="topology-path">
          <Card variant="outlined" className="topology-node"><CardActionArea component="a" href="/docs/frontend/prism" sx={{ display: 'flex', flexDirection: 'column', p: 1.5, minWidth: 0 }}><small>CLIENT</small><strong>Prism</strong><span className="topology-description">React interface</span></CardActionArea></Card>
          <CardActionArea component="a" className="topology-connection" href="/docs/titan/netron" sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, minWidth: 0 }}><span className="topology-direction" aria-hidden="true">↔</span><strong>Netron</strong><small>Typed RPC</small><small>HTTP / WebSocket</small></CardActionArea>
          <Card variant="outlined" className="topology-node"><CardActionArea component="a" href="/docs/titan/overview" sx={{ display: 'flex', flexDirection: 'column', p: 1.5, minWidth: 0 }}><small>SERVICE</small><strong>Titan</strong><span className="topology-description">Modules + lifecycle</span></CardActionArea></Card>
        </div>
        <p className="topology-caption">Application code, interfaces, documentation and operations. You choose where each layer runs.</p>
        <div className="system-tools">
          <CardActionArea component="a" href="/docs/lumen/overview"><small>DOCUMENT</small><strong>Lumen</strong><span className="tool-description">Publishes your knowledge</span></CardActionArea>
          <CardActionArea component="a" href="/docs/omnitron/overview"><small>OPERATE</small><strong>Omnitron</strong><span className="tool-description">Operates your infrastructure</span></CardActionArea>
        </div>
      </aside></div>
      <div className="hero-principles"><span><b>01</b> Your infrastructure</span><span><b>02</b> Your operational data</span><span><b>03</b> Your control plane</span></div>
    </header>
    <section className="home-section" aria-labelledby="layers-title"><div className="section-heading"><p className="eyebrow">01 / THE STACK</p><h2 id="layers-title">The complete path from code to operation.</h2><p>One platform connects backend logic, service communication, React interfaces, documentation and infrastructure management. Adopt the full stack or the parts you need.</p></div>
      <div className="layer-list">{layers.map(([number,name,role,description,href]) => <CardActionArea component="a" href={href} key={name}><span className="layer-number">{number}</span><h3>{name}<small>{role}</small></h3><p>{description}</p><ArrowUpRightIcon className="layer-arrow" /></CardActionArea>)}</div>
    </section>
    <section className="home-section" aria-labelledby="contract-title"><div className="section-heading"><p className="eyebrow">02 / THE CONTRACT</p><h2 id="contract-title">Declare once. Call directly.</h2><p>A service type connects the server and client. Validate untrusted inputs at the boundary.</p></div>
      <div className="contract-grid">
        <div className="contract-panel" role="region" aria-labelledby="contract-server">
          <div className="file-label" id="contract-server">SERVER / signals.service.ts</div>
          <div className="contract-code" dangerouslySetInnerHTML={{ __html: serverCode }} />
        </div>
        <div className="contract-panel" role="region" aria-labelledby="contract-client">
          <div className="file-label" id="contract-client">CLIENT / client.ts</div>
          <div className="contract-code" dangerouslySetInnerHTML={{ __html: clientCode }} />
        </div>
      </div>
      <p className="section-note">These are service and client excerpts. The <Link href="/docs/getting-started/quickstart">quickstart</Link> includes registration, HTTP setup and runnable files.</p>
    </section>
    <section className="home-section" aria-labelledby="ownership-title"><div className="section-heading"><p className="eyebrow">03 / YOUR BOUNDARY</p><h2 id="ownership-title">Understand what you own.</h2><p>Inspect the paths your commands and data take. Choose the machines, storage and access policies that define your system.</p></div>
      <div className="start-paths"><CardActionArea component="a" href="/docs/foundations/privacy"><small>PRIVACY</small><h3>Follow your data</h3><p>Where logs, metrics, credentials and artifacts live. Which connections you configure.</p><ArrowRightIcon className="start-path-arrow" /></CardActionArea><CardActionArea component="a" href="/docs/omnitron/architecture"><small>RELIABILITY</small><h3>Look inside a node</h3><p>Meet the owner, guardian and backend. See what survives an update or a lost connection.</p><ArrowRightIcon className="start-path-arrow" /></CardActionArea><CardActionArea component="a" href="/docs/omnitron/architecture#cluster-subsystem"><small>TOPOLOGY</small><h3>Operate your fleet</h3><p>Manage private nodes from a workstation or a dedicated controller in your management network.</p><ArrowRightIcon className="start-path-arrow" /></CardActionArea></div>
    </section>
    <section className="home-section" aria-labelledby="start-title">
      <div className="section-heading"><h2 id="start-title">Build a project, a team or a flow.</h2></div>
      <div className="start-paths">
        <CardActionArea component="a" href="/docs/omnitron/projects#choose-a-project"><h3>Create a project</h3><p>Choose a starter for a service, an automation task or a database-backed application.</p><ArrowRightIcon className="start-path-arrow" /></CardActionArea>
        <CardActionArea component="a" href="/docs/omnitron/studio#team-room"><h3>Work with agents</h3><p>Connect local adapters, choose a lead and share tasks and notes in a project room.</p><ArrowRightIcon className="start-path-arrow" /></CardActionArea>
        <CardActionArea component="a" href="/docs/omnitron/flows#disk-space"><h3>Automate a host</h3><p>Draw a disk-space monitor and preview what it will do when storage runs low.</p><ArrowRightIcon className="start-path-arrow" /></CardActionArea>
      </div>
      <div className="lumen-note"><span>THIS MANUAL IS A LUMEN REFERENCE PROJECT</span><p>Static HTML. Local search. Verified links. Markdown for tools.</p><Link href="/docs/lumen/this-site">Inspect how it is built →</Link></div>
    </section>
  </main>;
}
