#!/usr/bin/env node
/**
 * Diff docs/omnitron/services-reference.md against the daemon's real RPC
 * surface.
 *
 * The page used to assert it had been "verified against
 * src/services/*.rpc-service.ts". Six of its method counts undercounted —
 * every one of them a method added after the page was written — and one
 * service, OmnitronCluster, was missing from the inventory entirely. The
 * sentence claiming verification is the one sentence nothing can check, so
 * it is the one that drifts furthest. This replaces it with something a
 * reader can run.
 *
 *   node scripts/check-services-reference.mjs ../omni
 *
 * Exits non-zero on any disagreement.
 */

import fs from 'node:fs';
import path from 'node:path';

const repo = process.argv[2];
if (!repo) {
  console.error('usage: node scripts/check-services-reference.mjs <path-to-omni-repo>');
  process.exit(2);
}

const srcRoot = path.join(repo, 'apps/omnitron/src');
if (!fs.existsSync(srcRoot)) {
  console.error(`not an omni checkout: ${srcRoot} does not exist`);
  process.exit(2);
}

/**
 * Not every service the daemon exposes lives in apps/omnitron.
 * `OmnitronMetrics` is declared in `packages/titan-metrics` and registered by
 * its module, so a checker reading only the app's own tree misses it — and
 * this one did, while reporting "ok — 21 services": the right count with the
 * wrong set. It had gained `OmnitronCluster`, which is registered only when
 * clustering is enabled, and lost `OmnitronMetrics`. Two errors of opposite
 * sign summing to a clean total is exactly what a count cannot detect.
 *
 * Caught by reading `availableServices` out of a running daemon's log, which
 * is the only ground truth here. Short of that, scan everywhere a
 * *.rpc-service.ts can live.
 */
const scanRoots = [srcRoot, path.join(repo, 'packages')].filter((d) => fs.existsSync(d));

/**
 * A service file is `<something>.rpc-service.ts` — or just `rpc-service.ts`.
 *
 * `titan-metrics` uses the bare name, and matching on `.rpc-service.ts` alone
 * skips it: the string is shorter than the suffix. Widening the SEARCH ROOTS
 * to `packages/` therefore did not find `OmnitronMetrics`, though the comment
 * added alongside that change said it had. Two fixes were needed and one was
 * written down as done — the same defect the page itself documents, in the
 * checker built to catch it.
 */
function isRpcServiceFile(name) {
  return name === 'rpc-service.ts' || name.endsWith('.rpc-service.ts');
}

/**
 * `@Service({ name: X })` where X is a constant, not a literal —
 * `DAEMON_SERVICE_ID` is declared in config/defaults.ts. Reading only string
 * literals made the daemon's own service look unregistered, i.e. the checker
 * reporting the page as wrong about the one row that was right.
 */
function constants() {
  const out = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== 'dist' && e.name !== 'test') walk(p);
      } else if (e.name.endsWith('.ts')) {
        for (const m of fs.readFileSync(p, 'utf8').matchAll(/export const (\w+)(?::\s*string)?\s*=\s*['"]([^'"]+)['"]/g)) {
          out.set(m[1], m[2]);
        }
      }
    }
  };
  for (const root of scanRoots) walk(root);
  return out;
}

/** Every *.rpc-service.ts under src/, with its Netron id and @Public methods. */
function realServices() {
  const consts = constants();
  const out = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== 'dist' && e.name !== 'test') walk(p);
      } else if (isRpcServiceFile(e.name)) {
        const src = fs.readFileSync(p, 'utf8');
        const decl = src.match(/@Service\(\s*\{\s*name:\s*(?:['"]([^'"]+)['"]|(\w+))/);
        const id = decl?.[1] ?? (decl?.[2] ? consts.get(decl[2]) : undefined);
        const methods = new Set(
          [...src.matchAll(/@Public\([^)]*\)[\s\S]{0,400}?\n\s+(?:async\s+)?(\w+)\s*\(/g)].map((m) => m[1])
        );
        if (id) out.set(id, { file: path.relative(srcRoot, p), methods: [...methods].sort() });
      }
    }
  };
  for (const root of scanRoots) walk(root);
  return out;
}

/** Index-table rows: service id → declared method count. */
function documentedServices() {
  const md = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), '../docs/omnitron/services-reference.md'),
    'utf8'
  );
  const rows = new Map();
  // The id pattern has to admit more than `Omnitron<Word>`: `Health@1.0.0`
  // carries Netron's versioned form, and while the pattern excluded it the
  // checker skipped the row silently and went on reporting the service as
  // MISSING — a page that documented it correctly could not have satisfied
  // this script. A pattern that cannot match a real value fails closed and
  // looks like a finding about the page.
  for (const m of md.matchAll(/\|\s*`[^`]*rpc-service\.ts`\s*\|\s*`([\w@.-]+)`\s*\|\s*(\d+)\s*\|/g)) {
    rows.set(m[1], Number(m[2]));
  }
  return rows;
}

/**
 * The comparison, as one function — because the control below has to run
 * through it rather than beside it. A control that re-derives the comparison
 * is a second implementation of it, and the two agree right up until the
 * first one breaks, which is the only moment the control was for.
 */
function compare(real, documented) {
  const problems = [];
  for (const [id, { file, methods }] of [...real].sort()) {
    const n = documented.get(id);
    if (n === undefined) {
      problems.push(`MISSING  ${id} (${file}, ${methods.length} methods) is not in the index table`);
    } else if (n !== methods.length) {
      problems.push(`COUNT    ${id}: page says ${n}, source has ${methods.length} — ${methods.join(', ')}`);
    }
  }
  for (const id of documented.keys()) {
    if (!real.has(id)) {
      problems.push(`STALE    ${id} is in the index table but no service registers that name`);
    }
  }
  return problems;
}

/**
 * Control: prove each of the three findings can still be reported.
 *
 * `ok — 21 services` is indistinguishable from `ok` printed by a comparison
 * that has stopped comparing, and this script has already produced the right
 * count over the wrong set once (see the note on scanRoots). So a corrupted
 * copy of the two inventories goes through `compare` — one fault per branch —
 * and the result is checked as a pair of numbers, not as a boolean.
 *
 * The COUNT fault is planted on a row that currently agrees; planting it on a
 * row that already disagrees would leave the total unchanged and the control
 * would pass while proving nothing.
 */
function control(real, documented) {
  const baseline = compare(real, documented).length;
  const agreeing = [...real].find(([id, { methods }]) => documented.get(id) === methods.length);
  if (!agreeing) return { ok: false, why: 'no service currently agrees, so the COUNT branch cannot be exercised' };

  const r = new Map(real);
  const d = new Map(documented);
  r.set('OmnitronControlNotInPage', { file: 'control', methods: ['controlMethod'] });
  d.set('OmnitronControlNotInSource', 1);
  d.set(agreeing[0], agreeing[1].methods.length + 1);

  const found = compare(r, d);
  const kinds = new Set(found.map((l) => l.split(/\s+/)[0]));
  const extra = found.length - baseline;
  const missing = ['MISSING', 'COUNT', 'STALE'].filter((k) => !kinds.has(k));

  // The opposite error. Everything above proves the comparison CAN report; a
  // comparison that reported every service would satisfy it too, since the
  // planted ones are among "every". Inputs that agree by construction must
  // produce nothing — and this is not the same as the real run coming back
  // clean, which only holds for as long as the page happens to agree.
  const matchingRows = new Map([...real].map(([id, v]) => [id, v.methods.length]));
  const spurious = compare(real, matchingRows);

  const problems = [];
  if (extra !== 3) problems.push(`got ${extra} planted disagreement(s), expected 3`);
  if (missing.length) problems.push(`branch(es) that did not fire: ${missing.join(', ')}`);
  if (spurious.length) {
    problems.push(`reported ${spurious.length} disagreement(s) between inventories that agree: ${spurious[0]}`);
  }

  return { ok: problems.length === 0, extra, missing, why: problems.join('; ') };
}

const real = realServices();
const documented = documentedServices();

// Guard the guard: an empty side would make every check vacuously pass.
if (real.size < 15 || documented.size < 15) {
  console.error(`extraction failed: ${real.size} services in source, ${documented.size} rows in the page`);
  process.exit(2);
}

const c = control(real, documented);
if (!c.ok) {
  console.error(`CONTROL FAILED — ${c.why}`);
  console.error('The comparison below is not checking what it reports; fix this before reading its result.');
  process.exit(2);
}

const problems = compare(real, documented);
for (const line of problems) console.error(line);

console.log(problems.length === 0
  ? `ok — ${real.size} services, method counts agree (control: 3/3 planted disagreements detected)`
  : `\n${problems.length} disagreement(s) between the page and ${path.relative(process.cwd(), srcRoot)}`);
process.exit(problems.length === 0 ? 0 : 1);
