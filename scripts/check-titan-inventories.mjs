#!/usr/bin/env node
/**
 * Diff the titan inventory pages against the packages they inventory.
 *
 *   docs/titan/modules/tokens-reference.mdx    — DI tokens
 *   docs/titan/modules/decorators-catalog.mdx  — decorators, and which entry
 *                                                point each is importable from
 *
 * Both pages were verified by hand once. A hand check is a claim with the
 * same shelf life as a line number: it is true on the day it is made and
 * decays with every commit to the packages, silently. This is the runnable
 * version.
 *
 *   node scripts/check-titan-inventories.mjs ../..
 *
 * Exits non-zero on any disagreement, and also when either side extracts
 * implausibly little — a zero diff must mean "agrees", never "the extraction
 * broke".
 */

import fs from 'node:fs';
import path from 'node:path';

const repo = process.argv[2];
if (!repo) {
  console.error('usage: node scripts/check-titan-inventories.mjs <path-to-omni-repo>');
  process.exit(2);
}

const pkgRoot = path.join(repo, 'packages');
if (!fs.existsSync(pkgRoot)) {
  console.error(`not an omni checkout: ${pkgRoot} does not exist`);
  process.exit(2);
}

const docsRoot = path.join(process.cwd(), 'docs/titan/modules');

/** Every .ts under a package's src. */
function sources(pkgDir) {
  const out = [];
  const src = path.join(pkgDir, 'src');
  if (!fs.existsSync(src)) return out;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!['node_modules', 'dist', 'build'].includes(e.name)) walk(p);
      } else if (/\.ts$/.test(e.name) && !/\.(spec|test)\.ts$/.test(e.name)) out.push(p);
    }
  })(src);
  return out;
}

const titanPkgs = fs
  .readdirSync(pkgRoot, { withFileTypes: true })
  .filter((e) => e.isDirectory() && /^titan(-|$)/.test(e.name))
  .map((e) => path.join(pkgRoot, e.name));

let failures = 0;
/** [what, got, expected] — each one printed, and each one able to fail. */
const controls = [];

const fail = (msg) => {
  console.error(`FAIL  ${msg}`);
  failures++;
};

// ---------------------------------------------------------------------------
// 1. Tokens
// ---------------------------------------------------------------------------
{
  const declared = new Set();
  for (const pkg of titanPkgs) {
    for (const f of sources(pkg)) {
      const text = fs.readFileSync(f, 'utf8');
      for (const m of text.matchAll(/export const ([A-Z][A-Z0-9_]{3,})\b/g)) declared.add(m[1]);
    }
  }
  if (declared.size < 50) {
    fail(`token extraction found only ${declared.size} exported constants — the checker is broken, not the docs`);
  }

  const page = fs.readFileSync(path.join(docsRoot, 'tokens-reference.mdx'), 'utf8');
  const documented = new Set([...page.matchAll(/`([A-Z][A-Z0-9_]{3,})`/g)].map((m) => m[1]));
  if (documented.size < 40) {
    fail(`tokens-reference.mdx yielded only ${documented.size} names — extraction broke`);
  }

  // The comparison, as a function, so the control below can run through THE
  // SAME code and not a copy of it. The first version of that control rebuilt
  // the filter itself; breaking the real comparison left it passing, which made
  // it exactly the decorative control this file was given one to avoid.
  const undocumented = (names) => [...names].filter((n) => !declared.has(n)).sort();

  const missing = undocumented(documented);
  for (const n of missing) fail(`tokens-reference.mdx documents \`${n}\`, which no titan package exports`);
  if (missing.length === 0) console.log(`ok — ${documented.size} documented tokens all exist`);

  // Control. The size floors above catch an extraction that broke OUTRIGHT;
  // they say nothing about one that still returns plenty of names while the
  // comparison has stopped comparing. So put a name in the documented set that
  // certainly is not exported and require it to be caught.
  //
  // Printed as got/expected rather than as "ok", because a control that reports
  // a bare pass cannot be contradicted by anything: the example checker in this
  // directory printed "1 deliberate error(s) detected" beside a control file
  // with TWO of them, on every run, for as long as it existed.
  controls.push([
    'a documented token that no package exports',
    undocumented(new Set([...documented, '__CONTROL_TOKEN_THAT_DOES_NOT_EXIST__'])).length,
    missing.length + 1,
  ]);
}

// ---------------------------------------------------------------------------
// 2. Decorators, and the entry point each is importable from
// ---------------------------------------------------------------------------
{
  const declared = new Set();
  for (const pkg of titanPkgs) {
    for (const f of sources(pkg)) {
      const text = fs.readFileSync(f, 'utf8');
      for (const m of text.matchAll(/export (?:const|function) ([A-Z][A-Za-z0-9]*)\b/g)) declared.add(m[1]);
    }
  }
  if (declared.size < 100) {
    fail(`decorator extraction found only ${declared.size} exported names — the checker is broken`);
  }

  const page = fs.readFileSync(path.join(docsRoot, 'decorators-catalog.mdx'), 'utf8');
  const documented = new Set([...page.matchAll(/@([A-Z][A-Za-z0-9]*)/g)].map((m) => m[1]));
  if (documented.size < 50) {
    fail(`decorators-catalog.mdx yielded only ${documented.size} names — extraction broke`);
  }

  const undocumented = (names) => [...names].filter((n) => !declared.has(n)).sort();
  const missing = undocumented(documented);
  for (const n of missing) fail(`decorators-catalog.mdx documents \`@${n}\`, which no titan package exports`);
  if (missing.length === 0) console.log(`ok — ${documented.size} documented decorators all exist`);

  controls.push([
    'a documented decorator that no package exports',
    undocumented(new Set([...documented, 'ControlDecoratorThatDoesNotExist'])).length,
    missing.length + 1,
  ]);

  // The page states the root re-exports exactly these nine. That sentence is
  // the kind that rots: adding one export to titan's index silently makes it
  // false, and nothing else would notice.
  const CLAIMED_ROOT = [
    'Service', 'Injectable', 'Inject', 'Optional', 'Singleton',
    'Transient', 'Module', 'PostConstruct', 'PreDestroy',
  ];
  /**
   * Names a barrel exports, following `export * from` transitively.
   *
   * Reading only `export { … } from` was wrong and said so loudly: it found a
   * three-name intersection where there are nine, because
   * `decorators/index.ts` re-exports three whole modules with `export *`. The
   * checker accused the page of a claim the page had right. A probe that can
   * under-read its own input reports absence as disagreement.
   */
  const namesOf = (file, seen = new Set()) => {
    const out = new Set();
    if (!fs.existsSync(file) || seen.has(file)) return out;
    seen.add(file);
    // Strip comments first. A trailing `// …` inside an export block swallows
    // the newline and the name after it when the block is split on commas —
    // which is how `Injectable` (listed directly under a commented `Module,`)
    // went missing and made the checker report a wrong intersection.
    const text = fs
      .readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/[^\n]*/g, '');
    for (const m of text.matchAll(/export\s*\{([^}]*)\}\s*from/g)) {
      for (const part of m[1].split(',')) {
        const n = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
        if (/^[A-Za-z_$][\w$]*$/.test(n)) out.add(n);
      }
    }
    for (const m of text.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
      const base = path.resolve(path.dirname(file), m[1].replace(/\.js$/, ''));
      for (const cand of [base + '.ts', path.join(base, 'index.ts')]) {
        if (fs.existsSync(cand)) {
          for (const n of namesOf(cand, seen)) out.add(n);
          break;
        }
      }
    }
    // Names declared and exported in the barrel itself.
    for (const m of text.matchAll(/^export\s+(?:declare\s+)?(?:const|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm)) {
      out.add(m[1]);
    }
    return out;
  };
  const rootNames = namesOf(path.join(pkgRoot, 'titan/src/index.ts'));
  const decNames = namesOf(path.join(pkgRoot, 'titan/src/decorators/index.ts'));
  if (rootNames.size === 0 || decNames.size === 0) {
    fail('could not read titan index exports — the checker is broken');
  } else {
    const actual = [...rootNames].filter((n) => decNames.has(n)).sort();
    const claimed = [...CLAIMED_ROOT].sort();
    if (JSON.stringify(actual) !== JSON.stringify(claimed)) {
      fail(
        'decorators-catalog.mdx says the root re-exports exactly nine decorators;\n' +
          `      the actual root ∩ decorators intersection is: ${actual.join(' ') || '(none)'}`
      );
    } else {
      console.log(`ok — the root re-exports exactly the ${actual.length} decorators the page names`);
    }
  }
}

// ---------------------------------------------------------------------------
// Controls — reported last, so a broken comparison cannot hide behind a clean
// diff above it.
// ---------------------------------------------------------------------------
let controlFailed = false;
for (const [what, got, expected] of controls) {
  const okay = got === expected;
  if (!okay) controlFailed = true;
  console.log(`${okay ? 'control ok' : 'CONTROL FAILED'} — ${what}: got ${got}, expected ${expected}`);
}
if (controlFailed) {
  console.error('\nA control did not fire: the comparison above is not checking what it reports.');
  process.exit(2);
}

process.exit(failures > 0 ? 1 : 0);
