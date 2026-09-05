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
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts')) {
        for (const m of fs.readFileSync(p, 'utf8').matchAll(/export const (\w+)(?::\s*string)?\s*=\s*['"]([^'"]+)['"]/g)) {
          out.set(m[1], m[2]);
        }
      }
    }
  };
  walk(srcRoot);
  return out;
}

/** Every *.rpc-service.ts under src/, with its Netron id and @Public methods. */
function realServices() {
  const consts = constants();
  const out = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.rpc-service.ts')) {
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
  walk(srcRoot);
  return out;
}

/** Index-table rows: service id → declared method count. */
function documentedServices() {
  const md = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), '../docs/omnitron/services-reference.md'),
    'utf8'
  );
  const rows = new Map();
  for (const m of md.matchAll(/\|\s*`[^`]*\.rpc-service\.ts`\s*\|\s*`(Omnitron\w+)`\s*\|\s*(\d+)\s*\|/g)) {
    rows.set(m[1], Number(m[2]));
  }
  return rows;
}

const real = realServices();
const documented = documentedServices();

// Guard the guard: an empty side would make every check vacuously pass.
if (real.size < 15 || documented.size < 15) {
  console.error(`extraction failed: ${real.size} services in source, ${documented.size} rows in the page`);
  process.exit(2);
}

let bad = 0;
for (const [id, { file, methods }] of [...real].sort()) {
  const n = documented.get(id);
  if (n === undefined) {
    console.error(`MISSING  ${id} (${file}, ${methods.length} methods) is not in the index table`);
    bad++;
  } else if (n !== methods.length) {
    console.error(`COUNT    ${id}: page says ${n}, source has ${methods.length} — ${methods.join(', ')}`);
    bad++;
  }
}
for (const id of documented.keys()) {
  if (!real.has(id)) {
    console.error(`STALE    ${id} is in the index table but no service registers that name`);
    bad++;
  }
}

console.log(bad === 0
  ? `ok — ${real.size} services, method counts agree`
  : `\n${bad} disagreement(s) between the page and ${path.relative(process.cwd(), srcRoot)}`);
process.exit(bad === 0 ? 0 : 1);
