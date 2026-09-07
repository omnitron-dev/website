#!/usr/bin/env node
/**
 * Every `@omnitron-dev/<pkg>/<subpath>` named in a documentation TABLE must be
 * a subpath the package actually exports.
 *
 * A table row naming a package entry point is a checkable claim of the same
 * kind as an import statement, and it fails the same way: a reader who follows
 * it writes an import that does not resolve. This zone has had the defect from
 * the package side already — `prism`'s `exports` carried `./components/*` and
 * `./blocks/*` globs, so every component directory typechecked while only
 * three shipped JavaScript, and these pages recommended that form in 55
 * places.
 *
 *   node scripts/check-package-subpaths.mjs ../omni
 *
 * Scope, chosen deliberately: TABLE ROWS ONLY, not prose. Prose names a
 * subpath in order to say it no longer works — `docs/frontend/prism/index.md`
 * explains that `@omnitron-dev/prism/components/alert` is now a compile error,
 * which is correct, and a checker reading prose would report that sentence as
 * a defect. A row asserts availability; a sentence may assert anything.
 *
 * Exits non-zero on a row naming a subpath that does not exist, and on its own
 * failure to extract.
 */

import fs from 'node:fs';
import path from 'node:path';

const repo = process.argv[2];
if (!repo) {
  console.error('usage: node scripts/check-package-subpaths.mjs <path-to-omni-repo>');
  process.exit(2);
}

/** name → exported subpath set, built from every package.json in the repo. */
function packageIndex(root) {
  const index = new Map();
  for (const dir of ['packages', 'apps']) {
    const base = path.join(root, dir);
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifest = path.join(base, entry.name, 'package.json');
      if (!fs.existsSync(manifest)) continue;
      let pkg;
      try {
        pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
      } catch {
        continue;
      }
      if (!pkg.name) continue;
      const subpaths = new Set();
      for (const key of Object.keys(pkg.exports ?? { '.': true })) {
        // A glob key makes everything under it resolvable, so a package
        // carrying one cannot be checked this way — record it and skip.
        if (key.includes('*')) {
          subpaths.add('*');
          continue;
        }
        const normalised = key === '.' ? '' : key.replace(/^\.\//, '/');
        // Every derived subpath must still be present in the key it came from.
        // A checker that mangles its input reports invented paths and reports
        // them confidently; a fail-on-empty guard cannot see it, because the
        // extraction is non-empty and wrong. `./theme` -> `/theme` keeps
        // `theme`, so this holds for the transformation and breaks for any
        // corruption of it.
        if (normalised && !key.includes(normalised.slice(1))) {
          console.error(
            `the checker is broken: exports key "${key}" of ${pkg.name} became "${normalised}"`
          );
          process.exit(2);
        }
        subpaths.add(normalised);
      }
      index.set(pkg.name, subpaths);
    }
  }
  return index;
}

function docFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...docFiles(p));
    else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) out.push(p);
  }
  return out;
}

const index = packageIndex(repo);
if (index.size < 10) {
  console.error(`the checker is broken, not the docs: only ${index.size} packages indexed under ${repo}`);
  process.exit(2);
}

const docsRoot = path.join(import.meta.dirname, '..', 'docs');
const ROW = /^\|\s*`(@omnitron-dev\/[a-z0-9-]+)((?:\/[a-z0-9-]+)*)`\s*\|/;

const rows = [];
for (const file of docFiles(docsRoot)) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const m = line.match(ROW);
    if (m) rows.push({ file: path.relative(docsRoot, file), line: i + 1, pkg: m[1], sub: m[2] ?? '' });
  });
}

// A zero must be able to mean only "agrees", never "the extraction broke".
if (rows.length < 30) {
  console.error(`the checker is broken, not the docs: only ${rows.length} table rows extracted`);
  process.exit(2);
}
console.log(`control ok — ${rows.length} entry-point rows extracted across ${new Set(rows.map((r) => r.file)).size} pages`);

function verdict(row) {
  const subpaths = index.get(row.pkg);
  if (!subpaths) return 'unknown-package';
  if (subpaths.has('*')) return 'ok'; // a glob export makes anything resolvable
  return subpaths.has(row.sub) ? 'ok' : 'missing-subpath';
}

// Planted defect: an invented subpath must be reported, and a real one must not.
const control = [
  { pkg: '@omnitron-dev/prism', sub: '/no-such-subpath-planted', want: 'missing-subpath' },
  { pkg: '@omnitron-dev/prism', sub: '/theme', want: 'ok' },
];
for (const c of control) {
  const got = verdict(c);
  if (got !== c.want) {
    console.error(`the checker is broken: \`${c.pkg}${c.sub}\` judged ${got}, expected ${c.want}`);
    process.exit(2);
  }
}
console.log('control ok — an invented subpath is reported and a real one is not');

let bad = 0;
for (const row of rows) {
  const v = verdict(row);
  if (v === 'ok') continue;
  bad++;
  if (v === 'unknown-package') {
    console.error(`${row.file}:${row.line} names \`${row.pkg}\`, which is no package in this repo`);
  } else {
    console.error(`${row.file}:${row.line} names \`${row.pkg}${row.sub}\`, which the package does not export`);
  }
}
if (bad > 0) process.exit(1);
console.log(`ok — all ${rows.length} documented entry points exist`);
