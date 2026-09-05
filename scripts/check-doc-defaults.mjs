#!/usr/bin/env node
/**
 * Compare the defaults the docs STATE against the defaults the source DECLARES.
 *
 * Type checking cannot see this class: `timeout: 5000` and `timeout: 30000` are
 * both perfectly typed, and a doc that names the wrong one is wrong in the way
 * that costs an operator a night — the number looks authoritative and nothing
 * contradicts it.
 *
 * Two rules this script exists to obey, both learned the hard way:
 *
 *  1. It reads BOTH spellings of a declared default — the `@default` JSDoc tag
 *     and prose `(default: X)`. Reading only the tag silently skipped every
 *     option in titan-notifications, and the run still said "no mismatches".
 *  2. It CONTROLS itself: before reporting, it injects a known-wrong default
 *     into a copy of a real page and requires that it be caught. Without that,
 *     "0 findings" is a statement about the probe, not about the docs.
 *
 * usage: node scripts/check-doc-defaults.mjs <path-to-omni-repo>
 */
import fs from 'node:fs';
import path from 'node:path';

const OMNI = process.argv[2];
if (!OMNI || !fs.existsSync(path.join(OMNI, 'packages'))) {
  console.error('usage: node scripts/check-doc-defaults.mjs <path-to-omni-repo>');
  process.exit(2);
}

const PKGS = [
  'titan', 'titan-auth', 'titan-cache', 'titan-database', 'titan-discovery',
  'titan-events', 'titan-health', 'titan-lock', 'titan-metrics',
  'titan-notifications', 'titan-pm', 'titan-ratelimit', 'titan-redis',
  'titan-scheduler', 'titan-telemetry-relay',
];

/** A modules/ page documents ONE package. Without this, a page about
 *  titan-health "matches" titan's unrelated option of the same name. */
const PAGE_PKG = {
  redis: 'titan-redis', auth: 'titan-auth', cache: 'titan-cache',
  database: 'titan-database', discovery: 'titan-discovery', events: 'titan-events',
  health: 'titan-health', lock: 'titan-lock', metrics: 'titan-metrics',
  notifications: 'titan-notifications', pm: 'titan-pm', ratelimit: 'titan-ratelimit',
  scheduler: 'titan-scheduler', 'telemetry-relay': 'titan-telemetry-relay',
  config: 'titan', logger: 'titan',
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const JSDOC = /\/\*\*([\s\S]*?)\*\/\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/g;

function sourceDefaults() {
  const map = new Map(); // option -> [{pkg, value}]
  for (const pkg of PKGS) {
    const root = path.join(OMNI, 'packages', pkg, 'src');
    if (!fs.existsSync(root)) continue;
    for (const f of walk(root)) {
      if (!f.endsWith('.ts') || /\.(spec|test)\.ts$/.test(f)) continue;
      const text = fs.readFileSync(f, 'utf8');
      for (const m of text.matchAll(JSDOC)) {
        const [, doc, name] = m;
        const d = doc.match(/@default\s+([^\s*][^\n*]*)/) ?? doc.match(/\(default:?\s*([^)]+)\)/);
        if (!d) continue;
        const value = d[1].trim().replace(/\*\/$/, '').trim();
        if (!map.has(name)) map.set(name, []);
        map.get(name).push({ pkg, value });
      }
    }
  }
  return map;
}

const norm = (v) =>
  v.trim().replace(/^`|`$/g, '').replace(/\s*\(.*?\)\s*$/, '')
    .replace(/[_'"]/g, '').replace(/\s+/g, ' ').trim().replace(/\.$/, '').toLowerCase();

function scan(docRoot, src) {
  const findings = [];
  for (const f of walk(docRoot)) {
    if (!/\.mdx?$/.test(f)) continue;
    const base = path.basename(f).replace(/\.mdx?$/, '');
    const scope = f.includes(`${path.sep}modules${path.sep}`) ? PAGE_PKG[base] : undefined;
    const lines = fs.readFileSync(f, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (!/default/i.test(line)) return;
      const names = [...line.matchAll(/`([A-Za-z_$][\w$]*)`/g)].map((m) => m[1]);
      const vals = [...line.matchAll(/[Dd]efaults?\s*(?:to|:)?\s*`([^`]+)`|\(default:?\s*`?([^`)]+)`?\)/g)]
        .map((m) => m[1] ?? m[2]);
      if (!names.length || !vals.length) return;
      for (const n of names) {
        const entries = (src.get(n) ?? []).filter((e) => !scope || e.pkg === scope);
        if (!entries.length) continue;
        const claimed = norm(vals[0]);
        const actual = entries.map((e) => norm(e.value));
        if (claimed && !actual.some((a) => a === claimed || a.includes(claimed) || claimed.includes(a))) {
          findings.push({ file: f, line: i + 1, name: n, claimed: vals[0].trim(), entries });
        }
      }
    });
  }
  return findings;
}

const src = sourceDefaults();
if (src.size === 0) {
  console.error('SOURCE MAP EMPTY — the probe read no defaults at all. Aborting.');
  process.exit(2);
}

// ── Control ────────────────────────────────────────────────────────────────
// Pick any option the source map knows, claim a value it certainly does not
// have, and require a finding. A probe that cannot fail here cannot pass.
{
  const [name, entries] = [...src.entries()].find(([, e]) => /^\d+$/.test(norm(e[0].value))) ?? [];
  if (!name) {
    console.error('CONTROL IMPOSSIBLE: no numeric default found to test with. Aborting.');
    process.exit(2);
  }
  const tmp = fs.mkdtempSync(path.join(process.cwd(), '.doc-defaults-control-'));
  try {
    fs.writeFileSync(path.join(tmp, `${entries[0].pkg.replace('titan-', '')}.mdx`),
      `| \`${name}\` | something (default: \`424242\`) |\n`);
    if (scan(tmp, src).length === 0) {
      console.error(`CONTROL FAILED: an injected wrong default for \`${name}\` was not caught. Aborting.`);
      process.exit(2);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`control ok — injected wrong default for \`${name}\` was caught`);
}

const findings = scan(path.join(process.cwd(), 'docs', 'titan'), src);
console.log(`\n${src.size} options declare a default in source; ${findings.length} doc claim(s) disagree\n`);
for (const f of findings) {
  console.log(`${path.relative(process.cwd(), f.file)}:${f.line}`);
  console.log(`    \`${f.name}\` doc says ${JSON.stringify(f.claimed)}`);
  console.log(`    source says ${f.entries.map((e) => `${e.pkg}:${e.value}`).join(', ')}`);
}
console.log(
  findings.length
    ? '\nEach needs a look: option names repeat across packages, and a line naming two options with two values reads as one claim.'
    : '',
);
